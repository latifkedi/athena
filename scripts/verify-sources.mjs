#!/usr/bin/env node
// Checks that every DOI and arXiv id in the content exists and points to the work we cite:
// the registered title should resemble our title and the year should be close. Problems are
// written to verify-report.md (and the GitHub step summary) for a person to look at; nothing is
// changed automatically. Runs from .github/workflows/verify.yml.
//
//   node scripts/verify-sources.mjs
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as yaml from 'js-yaml';

const ROOT = new URL('..', import.meta.url).pathname;
const UA = 'athena-verify/1.0 (+https://github.com/latifkedi/athena)';
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

const entries = []; // { file, key, s }
const collect = (file, sources) =>
  Object.entries(sources ?? {}).forEach(([key, s]) => s && (s.doi || s.arxiv) && entries.push({ file, key, s }));
for (const f of walk(join(ROOT, 'content/nodes'))) collect(relative(ROOT, f), yaml.load(readFileSync(f, 'utf8'))?.sources);
for (const extra of ['content/shared-sources.yaml', 'content/dashboard.yaml']) {
  const p = join(ROOT, extra);
  if (!existsSync(p)) continue;
  const d = yaml.load(readFileSync(p, 'utf8')) ?? {};
  collect(extra, extra.includes('dashboard') ? d.sources : d);
}

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
function similar(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x.includes(y) || y.includes(x)) return 1;
  const A = new Set(x.split(' ').filter((w) => w.length > 2));
  const B = new Set(y.split(' ').filter((w) => w.length > 2));
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / Math.max(1, Math.min(A.size, B.size));
}

async function get(url, as = 'json') {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (res.status === 404) return { status: 404 };
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) return { status: res.status };
      return { status: 200, body: as === 'json' ? await res.json() : await res.text() };
    } catch (e) {
      if (i === 2) return { status: 0, error: e.message };
      await sleep(3000 * (i + 1));
    }
  }
}

async function checkDoi(doi) {
  const r = await get(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  if (r.status === 200) {
    const m = r.body.message ?? {};
    const year = m.issued?.['date-parts']?.[0]?.[0] ?? m.published?.['date-parts']?.[0]?.[0];
    return { found: true, title: m.title?.[0] ?? '', year, container: m['container-title']?.[0] ?? '' };
  }
  if (r.status === 404) {
    // not a Crossref DOI (DataCite, mEDRA …): check that it resolves at all
    const h = await get(`https://doi.org/api/handles/${encodeURI(doi)}`);
    if (h.status === 200 && h.body?.responseCode === 1) return { found: true, title: null };
    return { found: false };
  }
  return { error: r.error ?? `HTTP ${r.status}` };
}

async function checkArxiv(id) {
  const r = await get(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`, 'text');
  if (r.status !== 200) return { error: r.error ?? `HTTP ${r.status}` };
  const entry = r.body.split('<entry>')[1];
  if (!entry || /<title>Error<\/title>/.test(entry)) return { found: false };
  const title = (entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.replace(/\s+/g, ' ').trim();
  const year = Number((entry.match(/<published>(\d{4})/) || [])[1]);
  return { found: true, title, year };
}

const problems = [];
const unreachable = [];
let ok = 0;
for (const { file, key, s } of entries) {
  const kind = s.doi ? 'DOI' : 'arXiv';
  const id = s.doi ?? s.arxiv;
  const r = s.doi ? await checkDoi(s.doi) : await checkArxiv(s.arxiv);
  await sleep(s.doi ? 150 : 3100); // arXiv asks for about three seconds between calls
  if (r.error) {
    unreachable.push({ file, key, kind, id, note: r.error });
    continue;
  }
  if (!r.found) {
    problems.push({ file, key, kind, id, note: 'not registered / kayıtlı değil' });
    continue;
  }
  const notes = [];
  if (r.title !== null && r.title !== undefined && similar(r.title, s.title) < 0.5)
    notes.push(`title differs / başlık farklı: “${r.title}”`);
  const y = Number(s.year);
  if (r.year && y && Math.abs(r.year - y) > 1) notes.push(`year ${r.year} (ours ${s.year})`);
  if (notes.length) problems.push({ file, key, kind, id, note: notes.join('; ') });
  else ok++;
}

const summary = `${entries.length} identifiers checked: ${ok} match, ${problems.length} to review, ${unreachable.length} could not be checked`;
console.log(summary);
const row = (p) => `| \`${p.file}\` | ${p.key} | ${p.kind} ${p.id} | ${p.note.replace(/\|/g, '/')} |`;
const report = [
  `# Kaynak doğrulama / Source verification (${new Date().toISOString().slice(0, 10)})`,
  '',
  summary,
  '',
  'Aşağıdaki kaynaklar elle kontrol edilmelidir: DOI ya da arXiv numarası yanlış olabilir veya kaynağın başlığı/yılı',
  'kayıtla uyuşmuyor. Bazı farklar (çeviri başlık, kitap bölümü, yeniden basım) doğaldır.',
  '',
  ...(problems.length ? ['| dosya / file | anahtar / key | kimlik / id | not |', '|---|---|---|---|', ...problems.map(row)] : ['Sorun bulunmadı. / No problems found.']),
  ...(unreachable.length
    ? ['', '## Denetlenemeyenler / Could not be checked', '', '| dosya | anahtar | kimlik | hata |', '|---|---|---|---|', ...unreachable.map(row)]
    : []),
].join('\n');
writeFileSync(join(ROOT, 'verify-report.md'), problems.length ? report + '\n' : '');
for (const p of problems) console.log(`::warning file=${p.file}::${p.key} (${p.kind} ${p.id}): ${p.note}`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
