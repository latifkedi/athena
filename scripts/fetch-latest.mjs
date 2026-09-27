#!/usr/bin/env node
// Pulls the newest research for every top-level branch that declares `feed:` in its YAML
// and writes content/feed/latest.json. Runs monthly in GitHub Actions (see .github/workflows/deploy.yml).
//
// Two kinds of papers are kept apart:
//   journal   peer-reviewed articles from OpenAlex, the open index of scholarly works that brings
//             together Crossref, PubMed, DOAJ, arXiv, institutional repositories and publisher data
//             (an open counterpart to Google Scholar, which offers no API). The most-cited articles
//             of the last two months come first.
//   preprint  the newest postings on preprint servers; these may not be peer-reviewed yet.
//
// Supported feed tags:
//   openalex:field/<id>      OpenAlex field, e.g. openalex:field/31 (Physics and Astronomy)
//   openalex:subfield/<id>   OpenAlex subfield, e.g. openalex:subfield/3103 (Astronomy and Astrophysics)
//   openalex:search:<words>  most-cited journal articles of the last year with these words in the title
//                            (OR and "phrases" allowed, no commas)
//   arxiv:<category>         e.g. arxiv:math, arxiv:cs.AI, arxiv:astro-ph
//   biorxiv | medrxiv
//   chemrxiv
//   psyarxiv | socarxiv      (OSF preprint servers)
// An OpenAlex API key, if the service asks for one, is read from OPENALEX_API_KEY.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';

const ROOT = new URL('..', import.meta.url).pathname;
const PER_FEED = 8;
const PER_KIND = 6; // per branch: up to this many journal articles and this many preprints
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
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      return as === 'json' ? await res.json() : await res.text();
    } catch (e) {
      // a rejected query (4xx other than 429) will not succeed on a retry
      if (attempt === 2 || (e.status >= 400 && e.status < 500 && e.status !== 429)) throw e;
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

const day = (x) => x.toISOString().slice(0, 10);
const daysAgo = (n) => day(new Date(Date.now() - n * 86400000));

function openalexPaper(w) {
  const src = w.primary_location?.source;
  return {
    title: clean(String(w.display_name ?? w.title ?? '').replace(/<[^>]+>/g, '')),
    authors: shortAuthors((w.authorships ?? []).map((a) => a.author?.display_name ?? '')),
    date: String(w.publication_date ?? ''),
    url: w.doi || w.primary_location?.landing_page_url || w.id,
    source: clean(src?.display_name ?? ''),
    category: '',
    kind: src?.type === 'repository' ? 'preprint' : 'journal',
    via: 'OpenAlex',
    cited: w.cited_by_count ?? 0,
  };
}

async function openalex(spec) {
  const key = process.env.OPENALEX_API_KEY ? `&api_key=${encodeURIComponent(process.env.OPENALEX_API_KEY)}` : '';
  const select = 'select=id,doi,display_name,publication_date,authorships,primary_location,cited_by_count';
  const until = `to_publication_date:${day(new Date())}`;
  let variants;
  const trusted = 'is_retracted:false,is_paratext:false';
  if (spec.startsWith('search:')) {
    // words (OR and "phrases" allowed, no commas: they separate filters) matched in the title,
    // then in title and abstract; never full text, which drags in unrelated papers
    const q = encodeURIComponent(spec.slice(7));
    const since = `from_publication_date:${daysAgo(365)},${until}`;
    const journal = `type:article|review,primary_location.source.type:journal,${trusted}`;
    variants = [
      `filter=title.search:${q},${since},${journal}&sort=cited_by_count:desc`,
      `filter=title_and_abstract.search:${q},${since},${journal}&sort=cited_by_count:desc`,
    ];
  } else {
    const [level, id] = spec.split('/'); // field | subfield
    const since = `from_publication_date:${daysAgo(60)},${until}`;
    // the id form and some filters have changed over time; try the strict query first
    variants = [
      `filter=primary_topic.${level}.id:${id},${since},type:article|review,primary_location.source.type:journal,${trusted}&sort=cited_by_count:desc`,
      `filter=primary_topic.${level}.id:${level}s/${id},${since},type:article|review,is_retracted:false&sort=cited_by_count:desc`,
      `filter=topics.${level}.id:${id},${since}&sort=cited_by_count:desc`,
    ];
  }
  await sleep(300); // OpenAlex allows about ten requests a second
  let lastError;
  for (const v of variants) {
    try {
      const json = await get(`https://api.openalex.org/works?${v}&per_page=${PER_FEED}&${select}${key}`, 'json');
      const items = (json.results ?? []).map(openalexPaper);
      if (items.length) return items;
    } catch (e) {
      lastError = e;
    }
  }
  if (lastError) throw lastError;
  return [];
}

async function fetchTag(tag) {
  if (tag.startsWith('openalex:')) return openalex(tag.slice(9));
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
      const got = await fetchTag(tag);
      papers.push(...got.map((p) => ({ kind: 'preprint', via: p.source, ...p })));
      console.log(`  ok    ${n.id} ← ${tag}`);
    } catch (e) {
      failures.push(`${n.id} ← ${tag}: ${e.message}`);
      console.warn(`  fail  ${n.id} ← ${tag}: ${e.message}`);
    }
  }
  const seen = new Set();
  const unique = papers.filter((p) => p.title && p.url && !seen.has(p.url) && seen.add(p.url));
  const journals = unique
    .filter((p) => p.kind === 'journal')
    .sort((a, b) => b.cited - a.cited || b.date.localeCompare(a.date))
    .slice(0, PER_KIND);
  const preprints = unique
    .filter((p) => p.kind !== 'journal')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, PER_KIND);
  branches[n.id] = [...journals, ...preprints];
}

const outFile = join(ROOT, 'content/feed/latest.json');
const previous = JSON.parse(readFileSync(outFile, 'utf8'));
// keep the previous list for any branch whose feeds all failed this time
for (const [id, list] of Object.entries(previous.branches ?? {})) if (!branches[id]?.length) branches[id] = list;

writeFileSync(outFile, JSON.stringify({ generated: new Date().toISOString(), branches }, null, 2) + '\n');
console.log(`\nwrote ${outFile}: ${Object.keys(branches).length} branches, ${failures.length} failed feeds`);
