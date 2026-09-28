#!/usr/bin/env node
// Validates every node before the site is built. Errors stop the build.
//   node scripts/check-content.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename, relative } from 'node:path';
import * as yaml from 'js-yaml';

const ROOT = new URL('..', import.meta.url).pathname;
const NODES = join(ROOT, 'content/nodes');

const TYPES = ['center', 'field', 'idea', 'event', 'tradition', 'practice', 'question', 'technology', 'text'];
const KINDS = [
  'proof', 'experiment', 'observation', 'measurement', 'archaeological', 'genetic', 'statistical', 'replication',
  'theoretical', 'argument', 'scripture', 'experience', 'historical', 'critique', 'clinical', 'computation',
];
const RELS = ['builds-on', 'influenced-by', 'opposes', 'replaces'];
const SOURCE_TYPES = ['article', 'book', 'preprint', 'scripture', 'manuscript', 'web', 'report', 'encyclopedia', 'dataset', 'news'];
// Words that pass judgement. Athena reports claims and evidence; it does not rule on them.
const VERDICT_WORDS = [
  /sözde ?bilim/i, /sahte ?bilim/i, /çürütül/i, /batıl/i, /hurafe/i, /kanıtlanmış gerçek/i,
  /pseudo-?science/i, /debunk/i, /\brefuted\b/i, /\bproven fact\b/i, /\bsuperstition/i, /\bquack/i,
];

const errors = [];
const warnings = [];
const err = (f, m) => errors.push(`${f}: ${m}`);
const warn = (f, m) => warnings.push(`${f}: ${m}`);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.yaml')) out.push(p);
  }
  return out;
}

const shared = existsSync(join(ROOT, 'content/shared-sources.yaml'))
  ? yaml.load(readFileSync(join(ROOT, 'content/shared-sources.yaml'), 'utf8')) ?? {}
  : {};

function checkSource(f, key, s) {
  if (!s || typeof s !== 'object') return err(f, `source "${key}" is empty`);
  if (!s.title) err(f, `source "${key}" has no title`);
  if (!SOURCE_TYPES.includes(s.type)) err(f, `source "${key}" has unknown type "${s.type}"`);
  if (!s.doi && !s.arxiv && !s.isbn && !s.url && !s.in) warn(f, `source "${key}" has no locator (doi/arxiv/isbn/url/in)`);
  if (s.doi && /^https?:/.test(s.doi)) err(f, `source "${key}": doi must be bare (10.xxxx/...), not a URL`);
}
for (const [k, s] of Object.entries(shared)) checkSource('shared-sources.yaml', k, s);

const l10n = (f, field, v, required = true) => {
  if (!v) return required ? err(f, `missing ${field}`) : warn(f, `missing ${field}`);
  if (typeof v !== 'object') return err(f, `${field} must have tr and en`);
  for (const lang of ['tr', 'en']) {
    if (!v[lang] || !String(v[lang]).trim()) (required ? err : warn)(f, `${field}.${lang} is empty`);
  }
};

const files = walk(NODES);
const nodes = new Map();
for (const file of files) {
  const f = relative(ROOT, file);
  let d;
  try {
    d = yaml.load(readFileSync(file, 'utf8'));
  } catch (e) {
    err(f, `YAML error: ${e.message}`);
    continue;
  }
  if (!d || typeof d !== 'object') {
    err(f, 'empty file');
    continue;
  }
  if (d.id !== basename(file, '.yaml')) err(f, `id "${d.id}" must match the file name`);
  if (nodes.has(d.id)) err(f, `duplicate id "${d.id}" (also in ${nodes.get(d.id).f})`);
  nodes.set(d.id, { ...d, f });
}

let centers = 0;
for (const n of nodes.values()) {
  const f = n.f;
  if (n.parent == null) centers++;
  else if (!nodes.has(n.parent)) err(f, `parent "${n.parent}" does not exist`);
  if (!TYPES.includes(n.type)) err(f, `unknown type "${n.type}"`);
  l10n(f, 'title', n.title);
  l10n(f, 'summary', n.summary);
  l10n(f, 'technical', n.technical, false);

  const local = n.sources ?? {};
  for (const [k, s] of Object.entries(local)) checkSource(f, k, s);
  const cited = [];
  const collect = (arr, where) => {
    if (arr === undefined) return;
    if (!Array.isArray(arr)) return err(f, `${where}.src must be a list`);
    cited.push(...arr.map((k) => [k, where]));
  };
  (n.claims ?? []).forEach((c, i) => {
    l10n(f, `claims[${i}]`, c);
    collect(c.src, `claims[${i}]`);
  });
  (n.evidence ?? []).forEach((e, i) => {
    l10n(f, `evidence[${i}]`, e);
    if (!['for', 'against'].includes(e.stance)) err(f, `evidence[${i}].stance must be for|against`);
    if (!KINDS.includes(e.kind)) err(f, `evidence[${i}].kind "${e.kind}" unknown`);
    if (!e.src || !e.src.length) err(f, `evidence[${i}] has no source`);
    collect(e.src, `evidence[${i}]`);
  });
  (n.positions ?? []).forEach((p, i) => {
    l10n(f, `positions[${i}].who`, p.who);
    l10n(f, `positions[${i}]`, p);
    if (!p.src || !p.src.length) err(f, `positions[${i}] has no source`);
    collect(p.src, `positions[${i}]`);
  });
  (n.datings ?? []).forEach((d, i) => {
    l10n(f, `datings[${i}].view`, d.view);
    l10n(f, `datings[${i}].value`, d.value);
    if (!d.src || !d.src.length) err(f, `datings[${i}] has no source`);
    collect(d.src, `datings[${i}]`);
  });
  (n.open ?? []).forEach((o, i) => l10n(f, `open[${i}]`, o));
  (n.links ?? []).forEach((l, i) => {
    if (!l || !l.to) return err(f, `links[${i}] needs "to"`);
    if (!RELS.includes(l.rel)) err(f, `links[${i}].rel "${l.rel}" must be one of ${RELS.join(' | ')}`);
    if (l.to === n.id) err(f, `links[${i}] points to itself`);
    if (l.note) l10n(f, `links[${i}].note`, l.note);
    collect(l.src, `links[${i}]`);
  });
  for (const [k, where] of cited) {
    if (k.startsWith('@')) {
      if (!shared[k.slice(1)]) err(f, `${where} cites unknown shared source "${k}"`);
    } else if (!local[k]) err(f, `${where} cites unknown source "${k}"`);
  }
  const usesShared = cited.some(([k]) => k.startsWith('@'));
  if (!Object.keys(local).length && !usesShared) err(f, 'node has no sources (every node needs at least one)');
  for (const k of Object.keys(local)) {
    if (!cited.some(([c]) => c === k)) warn(f, `source "${k}" is listed but never cited`);
  }
  for (const r of n.related ?? []) if (!nodes.has(r)) err(f, `related "${r}" does not exist`);
  for (const l of n.links ?? []) if (l?.to && !nodes.has(l.to)) err(f, `links: "${l.to}" does not exist`);
  if (n.date) {
    if (typeof n.date.year !== 'number') err(f, 'date.year must be a number (negative = BCE)');
  }
  if (n.parent && nodes.get(n.parent)?.parent == null && !['canopy', 'roots'].includes(n.side))
    err(f, 'top-level nodes need side: canopy | roots');
  for (const field of ['summary', 'technical']) {
    for (const lang of ['tr', 'en']) {
      const txt = n[field]?.[lang] ?? '';
      for (const re of VERDICT_WORDS) if (re.test(txt)) warn(f, `${field}.${lang} contains a verdict word (${re}) — report, don't judge`);
    }
  }
}
if (centers !== 1) err('content/nodes', `exactly one node must have no parent (found ${centers})`);

// cycles
for (const n of nodes.values()) {
  const seen = new Set();
  let cur = n;
  while (cur && cur.parent != null) {
    if (seen.has(cur.id)) {
      err(n.f, 'parent chain has a cycle');
      break;
    }
    seen.add(cur.id);
    cur = nodes.get(cur.parent);
  }
}

// tree groups: every top-level node sits in exactly one group on its own side
const treeFile = join(ROOT, 'content/tree.yaml');
if (existsSync(treeFile)) {
  const t = yaml.load(readFileSync(treeFile, 'utf8')) ?? {};
  const center = [...nodes.values()].find((n) => n.parent == null);
  const top = [...nodes.values()].filter((n) => center && n.parent === center.id);
  const placedIn = new Map();
  for (const side of ['canopy', 'roots']) {
    for (const g of t[side] ?? []) {
      if (!g.id) err('tree.yaml', `a ${side} group has no id`);
      l10n('tree.yaml', `${side}.${g.id}.title`, g.title);
      for (const id of g.fields ?? []) {
        const n = nodes.get(id);
        if (!n) err('tree.yaml', `${g.id}: node "${id}" does not exist`);
        else if (n.parent !== center?.id) err('tree.yaml', `${g.id}: "${id}" is not a top-level node`);
        else if (n.side !== side) err('tree.yaml', `${g.id}: "${id}" is on the ${n.side} side, not ${side}`);
        if (placedIn.has(id)) err('tree.yaml', `"${id}" is in both ${placedIn.get(id)} and ${g.id}`);
        placedIn.set(id, g.id);
      }
    }
  }
  for (const n of top) if (!placedIn.has(n.id)) warn('tree.yaml', `"${n.id}" is in no group (drawn in an extra group)`);
}

// journeys: every step points to an existing node
const journeyFile = join(ROOT, 'content/journeys.yaml');
if (existsSync(journeyFile)) {
  const js = yaml.load(readFileSync(journeyFile, 'utf8')) ?? [];
  const ids = new Set();
  for (const j of js) {
    const w = `journeys.yaml (${j.id})`;
    if (!j.id || !/^[a-z0-9-]+$/.test(j.id)) err(w, 'id must be lowercase letters, digits and dashes');
    if (ids.has(j.id)) err(w, 'duplicate journey id');
    ids.add(j.id);
    l10n(w, 'title', j.title);
    l10n(w, 'intro', j.intro);
    if (!j.steps?.length || j.steps.length < 3) err(w, 'a journey needs at least 3 steps');
    (j.steps ?? []).forEach((s, i) => {
      if (!nodes.has(s.node)) err(w, `steps[${i}]: node "${s.node}" does not exist`);
      l10n(w, `steps[${i}].text`, s.text);
      for (const lang of ['tr', 'en'])
        for (const re of VERDICT_WORDS) if (re.test(s.text?.[lang] ?? '')) warn(w, `steps[${i}].text.${lang} contains a verdict word (${re})`);
    });
  }
}

// dashboard
const dashFile = join(ROOT, 'content/dashboard.yaml');
if (existsSync(dashFile)) {
  const d = yaml.load(readFileSync(dashFile, 'utf8'));
  for (const [k, s] of Object.entries(d.sources ?? {})) checkSource('dashboard.yaml', k, s);
  for (const s of d.sections ?? [])
    for (const it of s.items ?? []) {
      for (const k of it.src ?? []) if (!d.sources?.[k]) err('dashboard.yaml', `unknown source "${k}"`);
      if (!it.src?.length) err('dashboard.yaml', `item "${it.title?.tr}" has no source`);
      if (it.node && !nodes.has(it.node)) err('dashboard.yaml', `node "${it.node}" does not exist`);
    }
}

const srcCount = [...nodes.values()].reduce((s, n) => s + Object.keys(n.sources ?? {}).length, 0);
for (const w of warnings) console.warn('  warn  ' + w);
for (const e of errors) console.error('  ERROR ' + e);
console.log(`\n${nodes.size} nodes, ${srcCount} sources, ${errors.length} errors, ${warnings.length} warnings`);
if (errors.length) process.exit(1);
