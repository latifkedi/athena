#!/usr/bin/env node
// Matches the month's new papers (content/feed/latest.json) with the existing nodes of their branch
// and writes review.md: a list for editors of papers that may add evidence, a position or an update
// to a node. The monthly workflow opens it as a GitHub issue. Nothing is changed automatically.
//
//   node scripts/review-queue.mjs
// Nodes can list extra match words in an optional `keywords:` field.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';

const ROOT = new URL('..', import.meta.url).pathname;
const SITE = 'https://latifkedi.github.io/athena';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.yaml')) out.push(p);
  }
  return out;
}

const nodes = new Map();
for (const f of walk(join(ROOT, 'content/nodes'))) {
  const n = yaml.load(readFileSync(f, 'utf8'));
  if (n?.id) nodes.set(n.id, n);
}
const children = new Map();
for (const n of nodes.values()) if (n.parent) (children.get(n.parent) ?? children.set(n.parent, []).get(n.parent)).push(n.id);
const descendants = (id) => (children.get(id) ?? []).flatMap((c) => [c, ...descendants(c)]);

const STOP = new Set(
  (
    'the and for with from into over under about between among through during without within their there these those ' +
    'this that what which when where while were have been being than then also only more most such very using based ' +
    'study studies analysis new novel approach approaches effect effects case evidence review role model models data ' +
    'results result high low large small first second two three toward towards across after before via its our can ' +
    've ile bir bu için olan olarak gibi daha çok üzerine üzerinde ilk yeni açık soru görüşler kuramı kuram'
  ).split(/\s+/),
);
const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i');
const stem = (w) => w.replace(/(ies)$/, 'y').replace(/(es|s)$/, '').replace(/(ing|ed)$/, '');
const tokens = (s) =>
  norm(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOP.has(w))
    .map(stem);

// how distinctive a word is among node titles: rare words make a match meaningful
const nodeWords = new Map();
const df = new Map();
for (const n of nodes.values()) {
  const words = new Set([
    ...tokens(n.title?.en),
    ...tokens(n.title?.tr),
    ...(n.people ?? []).flatMap((p) => tokens(p.split(/\s+/).pop())),
    ...(n.keywords ?? []).flatMap(tokens),
  ]);
  nodeWords.set(n.id, words);
  for (const w of words) df.set(w, (df.get(w) ?? 0) + 1);
}

const feed = JSON.parse(readFileSync(join(ROOT, 'content/feed/latest.json'), 'utf8'));
const matches = new Map(); // node id -> papers
for (const [branch, papers] of Object.entries(feed.branches ?? {})) {
  const pool = [branch, ...descendants(branch)].filter((id) => nodes.get(id)?.type !== 'field' || id !== branch);
  for (const p of papers) {
    const pw = new Set(tokens(p.title));
    let best = null;
    for (const id of pool) {
      const shared = [...nodeWords.get(id)].filter((w) => pw.has(w));
      const strong = shared.filter((w) => (df.get(w) ?? 99) <= 3 && w.length >= 5);
      const score = strong.length * 2 + shared.length;
      if (strong.length && (shared.length >= 2 || strong.some((w) => w.length >= 7)) && (!best || score > best.score))
        best = { id, score, shared };
    }
    if (best) (matches.get(best.id) ?? matches.set(best.id, []).get(best.id)).push({ ...p, shared: best.shared });
  }
}

const month = (feed.generated ?? new Date().toISOString()).slice(0, 7);
if (!matches.size) {
  writeFileSync(join(ROOT, 'review.md'), '');
  console.log('No papers matched existing nodes this month');
} else {
  const lines = [
    `# Aylık inceleme listesi / Monthly review list (${month})`,
    '',
    'Bu ayki yeni makalelerden bazıları mevcut düğümlerle ilgili görünüyor. Her biri için şunlara bakın: yeni bir kanıt',
    '(destekleyen ya da karşı çıkan), yeni bir görüş ya da güncellenmesi gereken bir bilgi var mı? Eşleştirme kelime',
    'benzerliğine dayanır; yanlış eşleşmeler olabilir. Hiçbir şey otomatik olarak değiştirilmez.',
    '',
    'Some of this month\'s new papers look related to existing nodes. For each, check whether it adds evidence (supporting',
    'or challenging), a new position, or an update. Matching is by shared words, so some matches will be wrong.',
    '',
  ];
  const sorted = [...matches.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [id, papers] of sorted) {
    const n = nodes.get(id);
    lines.push(`## [${n.title.tr}](${SITE}/d/${id}/) · \`content/nodes/…/${id}.yaml\``, '');
    for (const p of papers)
      lines.push(
        `- [ ] [${p.title}](${p.url}) — ${[p.authors, p.date, p.source, p.kind === 'journal' ? 'hakemli' : 'ön baskı'].filter(Boolean).join(' · ')} _(ortak: ${p.shared.join(', ')})_`,
      );
    lines.push('');
  }
  lines.push('---', '_Bu liste aylık iş akışı tarafından oluşturuldu (scripts/review-queue.mjs)._');
  writeFileSync(join(ROOT, 'review.md'), lines.join('\n') + '\n');
  console.log(`${[...matches.values()].flat().length} papers matched ${matches.size} nodes; wrote review.md`);
}
