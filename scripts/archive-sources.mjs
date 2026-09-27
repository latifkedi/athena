#!/usr/bin/env node
// Makes sure every source URL has a snapshot in the Internet Archive (Wayback Machine)
// and records it in content/archive.json. Runs monthly in GitHub Actions.
//
//   node scripts/archive-sources.mjs [--max 60] [--minutes 20]
//
// - Plain links: an existing snapshot is looked up first; if there is none, one is requested
//   with Save Page Now (anonymous use allows only a few captures per minute, so at most --max).
// - DOI links: most publishers refuse Save Page Now, and a DOI is already a persistent link.
//   The DOI is resolved to the publisher's page and an existing snapshot of either is recorded.
// - Rate limits (HTTP 429) and unreachable hosts are not errors: the script waits, and after
//   several in a row it stops and leaves the rest for the next run. Progress is saved as it goes.
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';

const ROOT = new URL('..', import.meta.url).pathname;
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? Number(process.argv[i + 1]) || fallback : fallback;
};
const MAX_SAVES = arg('--max', 60);
const DEADLINE = Date.now() + arg('--minutes', 20) * 60000;
const MAX_STREAK = 5;
const RECHECK_DAYS = 365;
const UA = 'athena-archiver/1.0 (+https://github.com/latifkedi/athena)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.yaml')) out.push(p);
  }
  return out;
}

// same precedence as primaryUrl() in src/lib/data.ts, so the keys match what the site looks up
function linksOf(sources) {
  const out = [];
  for (const s of Object.values(sources ?? {})) {
    if (!s || typeof s !== 'object') continue;
    if (s.url) out.push({ url: s.url });
    else if (s.doi) out.push({ url: `https://doi.org/${s.doi}`, doi: String(s.doi) });
    else if (s.arxiv) out.push({ url: `https://arxiv.org/abs/${s.arxiv}` });
  }
  return out;
}

const all = new Map();
const add = (list) => list.forEach((l) => all.set(l.url, l));
for (const f of walk(join(ROOT, 'content/nodes'))) add(linksOf(yaml.load(readFileSync(f, 'utf8'))?.sources));
for (const extra of ['content/shared-sources.yaml', 'content/dashboard.yaml']) {
  const p = join(ROOT, extra);
  if (!existsSync(p)) continue;
  const d = yaml.load(readFileSync(p, 'utf8')) ?? {};
  add(linksOf(extra.includes('dashboard') ? d.sources : d));
}

const file = join(ROOT, 'content/archive.json');
const db = JSON.parse(readFileSync(file, 'utf8'));
db.urls ??= {};
const persist = () => {
  db.urls = Object.fromEntries(Object.entries(db.urls).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(file, JSON.stringify(db, null, 2) + '\n');
};

const now = Date.now();
const todo = [...all.values()]
  .filter(({ url }) => {
    const r = db.urls[url];
    return !r || now - Date.parse(r.checked) > RECHECK_DAYS * 86400000;
  })
  // plain links first: they are the ones Save Page Now can capture
  .sort((a, b) => Number(!!a.doi) - Number(!!b.doi));
console.log(`${all.size} source URLs, ${todo.length} without a recent snapshot`);

class Later extends Error {
  constructor(message, wait = 15) {
    super(message);
    this.wait = wait;
  }
}

async function request(url, init = {}) {
  let res;
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000), ...init });
  } catch (e) {
    throw new Later(`network: ${e.cause?.code ?? e.message}`);
  }
  if (res.status === 429) throw new Later('rate limited (HTTP 429)', Math.min(Number(res.headers.get('retry-after')) || 60, 120));
  return res;
}

async function snapshotOf(u) {
  const res = await request(`https://archive.org/wayback/available?url=${encodeURIComponent(u)}`);
  if (!res.ok) throw new Later(`lookup HTTP ${res.status}`);
  const j = await res.json();
  const c = j?.archived_snapshots?.closest;
  return c?.available ? c.url.replace(/^http:/, 'https:') : null;
}

async function resolveDoi(doi) {
  const res = await request(`https://doi.org/api/handles/${encodeURI(doi)}`);
  if (!res.ok) return null;
  const j = await res.json();
  return j?.values?.find((v) => v.type === 'URL')?.data?.value ?? null;
}

async function save(u) {
  const res = await request(`https://web.archive.org/save/${u}`, { redirect: 'manual' });
  const loc = res.headers.get('location') || res.headers.get('content-location');
  if (loc) return loc.startsWith('http') ? loc : `https://web.archive.org${loc}`;
  if (res.ok) return `https://web.archive.org/web/${u}`;
  // 5xx here means the Internet Archive could not fetch the page (blocked or down); try next run
  return null;
}

const stats = { found: 0, saved: 0, doiPending: 0, refused: 0, later: 0 };
let saves = 0;
let streak = 0;
let stopped = '';

for (const item of todo) {
  if (Date.now() > DEADLINE) {
    stopped = 'time budget used up';
    break;
  }
  try {
    let snap = await snapshotOf(item.url);
    if (!snap && item.doi) {
      const target = await resolveDoi(item.doi);
      if (target) snap = await snapshotOf(target);
    }
    if (snap) {
      stats.found++;
      console.log(`  found  ${item.url}`);
    } else if (item.doi) {
      stats.doiPending++;
      console.log(`  doi    ${item.url} (no snapshot yet; the DOI itself stays resolvable)`);
    } else if (saves < MAX_SAVES) {
      saves++;
      snap = await save(item.url);
      if (snap) {
        stats.saved++;
        console.log(`  saved  ${item.url}`);
      } else {
        stats.refused++;
        console.log(`  skip   ${item.url} (the Internet Archive could not capture it this time)`);
      }
      await sleep(12000); // anonymous Save Page Now allows only a few captures per minute
    }
    if (snap) {
      db.urls[item.url] = { snapshot: snap, checked: new Date().toISOString() };
      persist();
    }
    streak = 0;
  } catch (e) {
    if (!(e instanceof Later)) throw e;
    stats.later++;
    streak++;
    console.log(`  later  ${item.url}: ${e.message}`);
    if (streak >= MAX_STREAK) {
      stopped = 'the Internet Archive is rate limiting or unreachable';
      break;
    }
    await sleep(e.wait * 1000);
  }
  await sleep(1000);
}

persist();
const left = todo.length - (stats.found + stats.saved + stats.doiPending + stats.refused + stats.later);
const summary =
  `${stats.found} existing snapshots recorded, ${stats.saved} new captures, ` +
  `${stats.doiPending} DOIs without a snapshot yet, ${stats.refused} refused by the site, ` +
  `${stats.later + left} left for the next run; ${Object.keys(db.urls).length} URLs in content/archive.json` +
  (stopped ? ` (stopped early: ${stopped})` : '');
console.log(`\n${summary}`);
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=Archive::${summary}`);
