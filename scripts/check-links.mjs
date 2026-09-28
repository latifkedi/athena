#!/usr/bin/env node
// Checks every source link (sources with a url; DOIs and arXiv ids are persistent and skipped)
// and records the ones that do not answer in content/linkcheck.json. Runs monthly in GitHub Actions.
// A link is shown as "not responding" on the site only when the page is gone (404/410), the host no
// longer exists, or it has failed in two runs in a row. 401/403/429 usually mean a bot is refused,
// not that the page is gone, so they are ignored.
//
//   node scripts/check-links.mjs
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';

const ROOT = new URL('..', import.meta.url).pathname;
const UA = 'Mozilla/5.0 (compatible; athena-linkcheck/1.0; +https://github.com/latifkedi/athena)';
const CONCURRENCY = 6;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.yaml')) out.push(p);
  }
  return out;
}

const urls = new Set();
const addFrom = (sources) => Object.values(sources ?? {}).forEach((s) => s?.url && urls.add(s.url));
for (const f of walk(join(ROOT, 'content/nodes'))) addFrom(yaml.load(readFileSync(f, 'utf8'))?.sources);
for (const extra of ['content/shared-sources.yaml', 'content/dashboard.yaml']) {
  const p = join(ROOT, extra);
  if (!existsSync(p)) continue;
  const d = yaml.load(readFileSync(p, 'utf8')) ?? {};
  addFrom(extra.includes('dashboard') ? d.sources : d);
}

const file = join(ROOT, 'content/linkcheck.json');
const prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).urls ?? {} : {};
const today = new Date().toISOString().slice(0, 10);

async function probe(u) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(u, {
        method,
        redirect: 'follow',
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*' },
        signal: AbortSignal.timeout(25000),
      });
      if (method === 'HEAD' && [405, 403, 400, 501].includes(res.status)) continue; // some servers only answer GET
      return { code: res.status };
    } catch (e) {
      const code = e.cause?.code ?? e.name;
      if (method === 'HEAD') continue;
      return { code, network: true };
    }
  }
  return { code: 'unknown' };
}

const result = {};
const list = [...urls];
let i = 0;
async function worker() {
  while (i < list.length) {
    const u = list[i++];
    const r = await probe(u);
    const gone = r.code === 404 || r.code === 410 || r.code === 'ENOTFOUND';
    const failing = gone || (r.network && r.code !== 'TimeoutError') || (typeof r.code === 'number' && r.code >= 500);
    if (!failing) continue;
    const before = prev[u];
    const count = (before?.count ?? 0) + 1;
    result[u] = { code: r.code, since: before?.since ?? today, seen: today, count, show: gone || count >= 2 };
    console.log(`  ${result[u].show ? 'down ' : 'flaky'}  ${r.code}  ${u}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(file, JSON.stringify({ checked: today, urls: sorted }, null, 2) + '\n');
const shown = Object.values(sorted).filter((r) => r.show).length;
const summary = `${list.length} links checked, ${Object.keys(sorted).length} not answering, ${shown} marked on the site`;
console.log(`\n${summary}`);
if (process.env.GITHUB_ACTIONS) {
  console.log(`::notice title=Links::${summary}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = Object.entries(sorted).map(([u, r]) => `| ${r.show ? 'down' : 'flaky'} | ${r.code} | ${r.since} | ${u} |`);
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Link check\n\n${summary}\n\n| state | code | since | url |\n|---|---|---|---|\n${rows.join('\n')}\n`,
    );
  }
}
