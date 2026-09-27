#!/usr/bin/env node
// Pulls the newest preprints for every top-level branch that declares `feed:` in its YAML
// and writes content/feed/latest.json. Runs monthly in GitHub Actions (see .github/workflows/deploy.yml).
//
// Supported feed tags:
//   arxiv:<category>   e.g. arxiv:math, arxiv:cs.AI, arxiv:astro-ph
//   biorxiv | medrxiv
//   chemrxiv
//   psyarxiv | socarxiv   (OSF preprint servers)
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';

const ROOT = new URL('..', import.meta.url).pathname;
const PER_FEED = 8;
const PER_BRANCH = 10;
const UA = 'athena-feed/1.0 (+https://github.com/latifkedi/athena)';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.yaml')) out.push(p);
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, as = 'text') {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return as === 'json' ? await res.json() : await res.text();
    } catch (e) {
      if (attempt === 2) throw e;
      await sleep(2000 * 2 ** attempt);
    }
  }
}

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const shortAuthors = (list) => {
  const a = list.map(clean).filter(Boolean);
  return a.length > 3 ? `${a.slice(0, 3).join(', ')} et al.` : a.join(', ');
};
const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

function parseAtom(xml, source, category) {
  const entries = xml.split(/<entry[\s>]/).slice(1);
  return entries.map((e) => {
    const pick = (re) => decode(clean((e.match(re) || [])[1]));
    const authors = [...e.matchAll(/<name>([\s\S]*?)<\/name>/g)].map((m) => decode(m[1]));
    const link =
      (e.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/) || e.match(/<link[^>]*href="([^"]+)"/) || [])[1] ||
      pick(/<id>([\s\S]*?)<\/id>/);
    return {
      title: pick(/<title[^>]*>([\s\S]*?)<\/title>/),
      authors: shortAuthors(authors),
      date: (pick(/<published>([\s\S]*?)<\/published>/) || pick(/<updated>([\s\S]*?)<\/updated>/)).slice(0, 10),
      url: link.replace(/^http:/, 'https:'),
      source,
      category,
    };
  });
}

async function arxiv(cat) {
  const q = cat.includes('.') ? `cat:${cat}` : `cat:${cat}*`;
  const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(q)}&sortBy=submittedDate&sortOrder=descending&max_results=${PER_FEED}`;
  let items = [];
  try {
    items = parseAtom(await get(url), 'arXiv', cat);
  } catch {
    /* fall back to the listing feed below */
  }
  if (!items.length) items = parseAtom(await get(`https://rss.arxiv.org/atom/${cat}`), 'arXiv', cat).slice(0, PER_FEED);
  await sleep(3500); // arXiv asks for a pause between API calls
  return items;
}

async function rxiv(server) {
  const to = new Date();
  const from = new Date(to.getTime() - 4 * 86400000);
  const d = (x) => x.toISOString().slice(0, 10);
  const json = await get(`https://api.biorxiv.org/details/${server}/${d(from)}/${d(to)}/0`, 'json');
  const rows = (json.collection ?? []).slice(-PER_FEED * 3).reverse();
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    if (seen.has(r.doi)) continue;
    seen.add(r.doi);
    out.push({
      title: clean(r.title),
      authors: shortAuthors(String(r.authors ?? '').split(';')),
      date: r.date,
      url: `https://www.${server}.org/content/${r.doi}v${r.version ?? 1}`,
      source: server === 'biorxiv' ? 'bioRxiv' : 'medRxiv',
      category: clean(r.category),
    });
    if (out.length >= PER_FEED) break;
  }
  return out;
}

async function chemrxiv() {
  try {
    const json = await get(
      `https://chemrxiv.org/engage/chemrxiv/public-api/v1/items?limit=${PER_FEED}&sort=PUBLISHED_DATE_DESC`,
      'json',
    );
    return (json.itemHits ?? []).map(({ item }) => ({
      title: clean(item.title),
      authors: shortAuthors((item.authors ?? []).map((a) => `${a.firstName ?? ''} ${a.lastName ?? ''}`)),
      date: String(item.publishedDate ?? '').slice(0, 10),
      url: `https://chemrxiv.org/engage/chemrxiv/article-details/${item.id}`,
      source: 'ChemRxiv',
      category: clean(item.categories?.[0]?.name ?? ''),
    }));
  } catch {
    // ChemRxiv's own API often refuses cloud runners (HTTP 403); Crossref lists the same preprints
    return chemrxivCrossref();
  }
}

async function chemrxivCrossref() {
  const json = await get(
    `https://api.crossref.org/prefixes/10.26434/works?filter=type:posted-content&sort=created&order=desc&rows=${PER_FEED * 3}`,
    'json',
  );
  const pad = (n) => String(n).padStart(2, '0');
  const seen = new Set();
  const out = [];
  for (const w of json.message?.items ?? []) {
    const doi = String(w.DOI ?? '');
    if (!doi.toLowerCase().startsWith('10.26434/chemrxiv')) continue;
    const base = doi.replace(/-v\d+$/i, '');
    if (seen.has(base)) continue;
    seen.add(base);
    const [y, m = 1, d = 1] = w.posted?.['date-parts']?.[0] ?? w.created?.['date-parts']?.[0] ?? [];
    out.push({
      title: clean(String(w.title?.[0] ?? '').replace(/<[^>]+>/g, '')),
      authors: shortAuthors((w.author ?? []).map((a) => `${a.given ?? ''} ${a.family ?? a.name ?? ''}`)),
      date: y ? `${y}-${pad(m)}-${pad(d)}` : '',
      url: `https://doi.org/${doi}`,
      source: 'ChemRxiv',
      category: clean(w['group-title'] ?? ''),
    });
    if (out.length >= PER_FEED) break;
  }
  return out;
}

async function osf(provider) {
  const json = await get(
    `https://api.osf.io/v2/preprints/?filter[provider]=${provider}&sort=-date_created&page[size]=${PER_FEED}&embed=contributors`,
    'json',
  );
  return (json.data ?? []).map((p) => {
    const contrib = p.embeds?.contributors?.data ?? [];
    const names = contrib.map((c) => c.embeds?.users?.data?.attributes?.full_name).filter(Boolean);
    return {
      title: clean(p.attributes?.title),
      authors: shortAuthors(names),
      date: String(p.attributes?.date_created ?? '').slice(0, 10),
      url: p.links?.html ?? `https://osf.io/${p.id}`,
      source: provider === 'psyarxiv' ? 'PsyArXiv' : 'SocArXiv',
      category: '',
    };
  });
}

async function fetchTag(tag) {
  if (tag.startsWith('arxiv:')) return arxiv(tag.slice(6));
  if (tag === 'biorxiv' || tag === 'medrxiv') return rxiv(tag);
  if (tag === 'chemrxiv') return chemrxiv();
  if (tag === 'psyarxiv' || tag === 'socarxiv') return osf(tag);
  throw new Error(`unknown feed tag ${tag}`);
}

const branches = {};
const failures = [];
for (const file of walk(join(ROOT, 'content/nodes'))) {
  const n = yaml.load(readFileSync(file, 'utf8'));
  if (!n?.feed?.length) continue;
  const papers = [];
  for (const tag of n.feed) {
    try {
      papers.push(...(await fetchTag(tag)));
      console.log(`  ok    ${n.id} ← ${tag}`);
    } catch (e) {
      failures.push(`${n.id} ← ${tag}: ${e.message}`);
      console.warn(`  fail  ${n.id} ← ${tag}: ${e.message}`);
    }
  }
  const seen = new Set();
  branches[n.id] = papers
    .filter((p) => p.title && p.url && !seen.has(p.url) && seen.add(p.url))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, PER_BRANCH);
}

const outFile = join(ROOT, 'content/feed/latest.json');
const previous = JSON.parse(readFileSync(outFile, 'utf8'));
// keep the previous list for any branch whose feeds all failed this time
for (const [id, list] of Object.entries(previous.branches ?? {})) if (!branches[id]?.length) branches[id] = list;

writeFileSync(outFile, JSON.stringify({ generated: new Date().toISOString(), branches }, null, 2) + '\n');
console.log(`\nwrote ${outFile}: ${Object.keys(branches).length} branches, ${failures.length} failed feeds`);
