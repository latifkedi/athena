// Loads every node YAML file under /content/nodes and builds the tree.
// Validation lives in scripts/check-content.mjs (runs before every build).
import * as yaml from 'js-yaml';

export type Lang = 'tr' | 'en';
export type L10n = { tr: string; en: string };

export interface Source {
  key: string;
  type: string;
  authors?: string;
  title: string;
  year?: number | string;
  in?: string;
  doi?: string;
  arxiv?: string;
  isbn?: string;
  url?: string;
  archive?: string;
  note?: L10n;
}

export interface Cited extends L10n {
  src?: string[];
}
export interface Evidence extends Cited {
  kind: string;
  stance: 'for' | 'against';
}
export interface Position extends Cited {
  who: L10n;
}
export interface Dating {
  view: L10n;
  value: L10n;
  src?: string[];
}
/** Typed connection, written on the node it starts from: "this node <rel> that node". */
export type RelKind = 'builds-on' | 'influenced-by' | 'opposes' | 'replaces';
export const REL_KINDS: RelKind[] = ['builds-on', 'influenced-by', 'opposes', 'replaces'];
export interface Link {
  to: string;
  rel: RelKind;
  note?: L10n;
  src?: string[];
}
export interface NodeDate {
  year: number;
  month?: number;
  day?: number;
  approx?: boolean;
  end?: number;
}

export interface NodeData {
  id: string;
  parent: string | null;
  side: 'canopy' | 'roots' | 'center';
  type: string;
  order?: number;
  related: string[];
  links: Link[];
  people: string[];
  date?: NodeDate;
  datings: Dating[];
  title: L10n;
  summary: L10n;
  technical?: L10n;
  claims: Cited[];
  evidence: Evidence[];
  positions: Position[];
  open: L10n[];
  sources: Record<string, Omit<Source, 'key'>>;
  feed?: string[];
  children: string[];
  depth: number;
  /** repository-relative path of the node's YAML file */
  file: string;
}

const nodeFiles = import.meta.glob('/content/nodes/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const sharedRaw = import.meta.glob('/content/shared-sources.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const archiveRaw = import.meta.glob('/content/archive.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const sharedText = Object.values(sharedRaw)[0] ?? '';
export const sharedSources: Record<string, Omit<Source, 'key'>> = sharedText.trim()
  ? ((yaml.load(sharedText) as any) ?? {})
  : {};

export const archiveMap: Record<string, { snapshot: string; checked: string }> =
  JSON.parse(Object.values(archiveRaw)[0] ?? '{}').urls ?? {};

const linkRaw = import.meta.glob('/content/linkcheck.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
/** Source links that stopped answering in the monthly check (see scripts/check-links.mjs). */
const linkDown: Record<string, { show?: boolean; since?: string }> =
  JSON.parse(Object.values(linkRaw)[0] ?? '{}').urls ?? {};
export const isLinkDown = (u?: string): boolean => !!u && !!linkDown[u]?.show;

const treeRaw = import.meta.glob('/content/tree.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export interface TreeGroup {
  id: string;
  title: L10n;
  fields: string[];
}
const treeText = Object.values(treeRaw)[0] ?? '';
const treeConfig = (treeText.trim() ? yaml.load(treeText) : {}) as Partial<Record<'canopy' | 'roots', TreeGroup[]>>;

function load(): Map<string, NodeData> {
  const map = new Map<string, NodeData>();
  for (const [file, raw] of Object.entries(nodeFiles)) {
    const d = yaml.load(raw) as any;
    const node: NodeData = {
      ...d,
      parent: d.parent ?? null,
      related: d.related ?? [],
      links: d.links ?? [],
      people: d.people ?? [],
      datings: d.datings ?? [],
      claims: d.claims ?? [],
      evidence: d.evidence ?? [],
      positions: d.positions ?? [],
      open: d.open ?? [],
      sources: d.sources ?? {},
      children: [],
      depth: 0,
      side: d.side ?? 'canopy',
      file: file.replace(/^\//, ''),
    };
    map.set(node.id, node);
  }
  // children
  for (const n of map.values()) {
    if (n.parent && map.has(n.parent)) map.get(n.parent)!.children.push(n.id);
  }
  // side + depth, inherited from the top-level ancestor
  const center = [...map.values()].find((n) => !n.parent);
  if (center) {
    center.side = 'center';
    const walk = (id: string, depth: number, side: NodeData['side']) => {
      const n = map.get(id)!;
      n.depth = depth;
      if (depth === 1) side = n.side;
      else if (depth > 1) n.side = side;
      for (const c of n.children) walk(c, depth + 1, side);
    };
    walk(center.id, 0, 'center');
  }
  for (const n of map.values()) n.children.sort((a, b) => compareNodes(map.get(a)!, map.get(b)!));
  // at the centre list the branches before the roots
  if (center) {
    const rank = (id: string) => (map.get(id)!.side === 'roots' ? 1 : 0);
    center.children.sort((a, b) => rank(a) - rank(b));
  }
  return map;
}

function sortKey(n: NodeData): number {
  if (n.order !== undefined) return n.order;
  if (n.date) return n.date.year;
  return Number.POSITIVE_INFINITY;
}

function compareNodes(a: NodeData, b: NodeData): number {
  const ka = sortKey(a);
  const kb = sortKey(b);
  if (ka !== kb) return ka - kb;
  return a.title.tr.localeCompare(b.title.tr, 'tr');
}

export const nodes = load();
export const allNodes = [...nodes.values()];
export const centerNode = allNodes.find((n) => n.side === 'center')!;

/** The limbs of the tree view: groups of related top-level nodes, left to right (see content/tree.yaml). */
export function treeGroups(side: 'canopy' | 'roots'): TreeGroup[] {
  const top = centerNode.children.map((id) => nodes.get(id)!).filter((n) => n.side === side);
  const used = new Set<string>();
  const groups = (treeConfig[side] ?? []).map((g) => {
    const fields = g.fields.filter((id) => top.some((n) => n.id === id));
    fields.forEach((id) => used.add(id));
    return { ...g, fields };
  });
  const rest = top.filter((n) => !used.has(n.id)).map((n) => n.id);
  if (rest.length) groups.push({ id: `diger-${side}`, title: { tr: 'Diğer', en: 'Other' }, fields: rest });
  return groups.filter((g) => g.fields.length);
}

export function getNode(id: string): NodeData | undefined {
  return nodes.get(id);
}

export function ancestors(id: string): NodeData[] {
  const out: NodeData[] = [];
  let cur = nodes.get(id);
  while (cur && cur.parent) {
    cur = nodes.get(cur.parent);
    if (cur) out.unshift(cur);
  }
  return out;
}

export function descendantCount(id: string): number {
  const n = nodes.get(id);
  if (!n) return 0;
  return n.children.reduce((s, c) => s + 1 + descendantCount(c), 0);
}

export function topLevel(id: string): NodeData | undefined {
  const chain = [...ancestors(id), nodes.get(id)!];
  return chain.find((n) => n.depth === 1);
}

/** Nodes that list `id` as related (reverse links). */
export function relatedTo(id: string): NodeData[] {
  return allNodes.filter((n) => n.related.includes(id));
}

/** Typed links touching a node, in both directions: 'out' = written on this node, 'in' = written on the other. */
export function typedLinks(id: string): { rel: RelKind; dir: 'out' | 'in'; node: NodeData; note?: L10n }[] {
  const out: { rel: RelKind; dir: 'out' | 'in'; node: NodeData; note?: L10n }[] = [];
  const self = nodes.get(id);
  for (const l of self?.links ?? []) {
    const m = nodes.get(l.to);
    if (m) out.push({ rel: l.rel, dir: 'out', node: m, note: l.note });
  }
  for (const n of allNodes)
    for (const l of n.links) if (l.to === id) out.push({ rel: l.rel, dir: 'in', node: n, note: l.note });
  return out;
}

/** Resolve a citation key: local first, then shared (keys beginning with @). */
export function resolveSource(node: NodeData, key: string): Source | undefined {
  if (key.startsWith('@')) {
    const s = sharedSources[key.slice(1)];
    return s ? { key, ...s } : undefined;
  }
  const s = node.sources[key];
  return s ? { key, ...s } : undefined;
}

/** All sources of a node in display order: local ones, then shared ones it cites. */
export function nodeSources(node: NodeData): Source[] {
  const out: Source[] = Object.entries(node.sources).map(([key, s]) => ({ key, ...s }));
  const cited = new Set<string>();
  const collect = (arr?: string[]) => arr?.forEach((k) => k.startsWith('@') && cited.add(k));
  node.claims.forEach((c) => collect(c.src));
  node.evidence.forEach((c) => collect(c.src));
  node.positions.forEach((c) => collect(c.src));
  node.datings.forEach((c) => collect(c.src));
  node.links.forEach((c) => collect(c.src));
  for (const k of cited) {
    const s = resolveSource(node, k);
    if (s) out.push(s);
  }
  return out;
}

export function sourceLinks(s: Source): { href: string; label: string }[] {
  const links: { href: string; label: string }[] = [];
  if (s.doi) links.push({ href: `https://doi.org/${s.doi}`, label: `DOI ${s.doi}` });
  if (s.arxiv) links.push({ href: `https://arxiv.org/abs/${s.arxiv}`, label: `arXiv:${s.arxiv}` });
  if (s.url) links.push({ href: s.url, label: prettyHost(s.url) });
  return links;
}

export function primaryUrl(s: Source): string | undefined {
  if (s.url) return s.url;
  if (s.doi) return `https://doi.org/${s.doi}`;
  if (s.arxiv) return `https://arxiv.org/abs/${s.arxiv}`;
  return undefined;
}

/** A stored snapshot if we have one, otherwise the Wayback lookup page for the URL. */
export function archiveLink(s: Source): string | undefined {
  if (s.archive) return s.archive;
  const u = primaryUrl(s);
  if (!u) return undefined;
  return archiveMap[u]?.snapshot ?? `https://web.archive.org/web/2*/${u}`;
}

function prettyHost(u: string): string {
  try {
    return new URL(u).host.replace(/^www\./, '');
  } catch {
    return u;
  }
}
