#!/usr/bin/env node
// Makes sure every source URL has a snapshot in the Internet Archive (Wayback Machine)
// and records it in content/archive.json. Runs monthly in GitHub Actions.
//
//   node scripts/archive-sources.mjs [--max 150]
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';

const ROOT = new URL('..', import.meta.url).pathname;
const MAX = Number(process.argv[process.argv.indexOf('--max') + 1]) || 150;
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

function urlsOf(sources) {
  const out = [];
  for (const s of Object.values(sources ?? {})) {
    if (!s || typeof s !== 'object') continue;
    if (s.url) out.push(s.url);
    else if (s.doi) out.push(`https://doi.org/${s.doi}`);
    else if (s.arxiv) out.push(`https://arxiv.org/abs/${s.arxiv}`);
  }
  return out;
}

const all = new Set();
for (const f of walk(join(ROOT, 'content/nodes'))) urlsOf(yaml.load(readFileSync(f, 'utf8'))?.sources).forEach((u) => all.add(u));
for (const extra of ['content/shared-sources.yaml', 'content/dashboard.yaml']) {
  const p = join(ROOT, extra);
  if (!existsSync(p)) continue;
  const d = yaml.load(readFileSync(p, 'utf8')) ?? {};
  urlsOf(extra.includes('dashboard') ? d.sources : d).forEach((u) => all.add(u));
}

const file = join(ROOT, 'content/archive.json');
const db = JSON.parse(readFileSync(file, 'utf8'));
db.urls ??= {};
const now = Date.now();
const todo = [...all].filter((u) => {
  const r = db.urls[u];
  return !r || now - Date.parse(r.checked) > RECHECK_DAYS * 86400000;
});
console.log(`${all.size} source URLs, ${todo.length} need a snapshot, processing up to ${MAX}`);

async function available(u) {
  const res = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(u)}`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) return null;
  const j = await res.json();
  return j?.archived_snapshots?.closest?.available ? j.archived_snapshots.closest.url.replace(/^http:/, 'https:') : null;
}

async function save(u) {
  const res = await fetch(`https://web.archive.org/save/${u}`, { headers: { 'User-Agent': UA }, redirect: 'manual' });
  const loc = res.headers.get('location') || res.headers.get('content-location');
  if (loc) return loc.startsWith('http') ? loc : `https://web.archive.org${loc}`;
  if (res.ok) return `https://web.archive.org/web/${u}`;
  throw new Error(`save failed: HTTP ${res.status}`);
}

let done = 0;
for (const u of todo.slice(0, MAX)) {
  try {
    let snap = await available(u);
    if (!snap) {
      snap = await save(u);
      await sleep(8000); // Save Page Now rate limit for anonymous use
    }
    db.urls[u] = { snapshot: snap, checked: new Date().toISOString() };
    done++;
    console.log(`  ok    ${u}`);
  } catch (e) {
    console.warn(`  fail  ${u}: ${e.message}`);
  }
  await sleep(1500);
}

db.urls = Object.fromEntries(Object.entries(db.urls).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(file, JSON.stringify(db, null, 2) + '\n');
console.log(`\narchived ${done}; ${Object.keys(db.urls).length} URLs recorded in content/archive.json`);
