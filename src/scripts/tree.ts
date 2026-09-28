// Interactive "world tree". A trunk rises from the ground; limbs (groups of related fields,
// see content/tree.yaml) leave it and split into the fields of inquiry, which split further
// into their topics. Roots (traditions of thought and belief) spread below the ground the same way.
// - A branch is as thick as the knowledge it carries (da Vinci's rule: width² adds up).
// - Along every branch the newest topics reach furthest out and sit in the middle; older ones
//   branch off lower down, to the sides.
// - Open questions end in a fork: one prong per position recorded on the node.
import { select, zoom, zoomIdentity, hierarchy, tree, line, curveCatmullRomClosed, easeCubicOut } from 'd3';
import type { ZoomBehavior, HierarchyPointNode } from 'd3';

interface RawNode {
  id: string;
  p: string | null;
  s: 'canopy' | 'roots' | 'center';
  k: string[];
  ty: string;
  t: string;
  sum: string;
  d: string;
  dv: number;
  href: string;
  rel: string[];
  top: string | null;
  pw?: string[];
  y?: number;
}
interface Group {
  id: string;
  t: string;
  f: string[];
}
interface Payload {
  lang: 'tr' | 'en';
  center: string;
  strings: Record<string, string>;
  groups: { canopy: Group[]; roots: Group[] };
  nodes: RawNode[];
}
type Side = 'canopy' | 'roots';
type Pt = { x: number; y: number };
interface Placed {
  id: string; // node id, or "g:<group>" for the point where a limb splits into its fields
  group?: Group;
  depth: number; // layout depth: 1 = limb, 2 = field, 3 = topic …
  x: number;
  y: number;
  r: number;
  side: Side | 'center';
  parent: Placed | null;
  w: number; // width of the branch that ends here
}
interface Geom {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  w0: number;
  w1: number;
  j: number;
}

const TRUNK = 230; // trunk height; the canopy fans out from its top
const RING: Record<Side, [number, number]> = { canopy: [235, 470], roots: [175, 370] }; // limbs, fields
const STEP = 150; // minimum distance between rings further out
const REACH = 115; // how much further the newest topic of a branch reaches than the oldest
const MIN_ARC = 15; // minimum arc length per node on a ring (px)
const PAD = 0.1; // radians kept free next to the ground line
const DUR = 420;
const BLOOM_SINCE = 2020; // twigs for developments from this year on end in a blossom
const INTRO_DELAY = 420; // on first load the trunk rises, then every level of branches grows out
const INTRO_STEP = 230;
const INTRO_DUR = 900;

const origin = (side: Side): Pt => (side === 'canopy' ? { x: 0, y: -TRUNK } : { x: 0, y: 0 });
const unit = (x: number, y: number): Pt => {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
};
/** Direction in which a branch grows at a point: away from the origin of its side. */
function outward(p: Placed): Pt {
  if (p.side === 'center') return { x: 0, y: -1 };
  const o = origin(p.side);
  const r = unit(p.x - o.x, p.y - o.y);
  if (p.depth !== 2 || !p.parent) return r;
  // a field arrives along the line from its limb's fork, so its name can lie along the branch
  const c = unit(p.x - p.parent.x, p.y - p.parent.y);
  return unit(c.x * 0.75 + r.x * 0.25, c.y * 0.75 + r.y * 0.25);
}
/** A stable pseudo-random number in [-1, 1] per id, so every branch bends its own way. */
function jitter(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 2001) / 1000 - 1;
}
/** Newest in the middle, older ones alternating outwards, like the shoots of a real branch. */
function centerOut<T>(oldestFirst: T[]): T[] {
  const out: T[] = [];
  for (let i = oldestFirst.length - 1, right = true; i >= 0; i--, right = !right) {
    if (right) out.push(oldestFirst[i]);
    else out.unshift(oldestFirst[i]);
  }
  return out;
}

const outline = line<[number, number]>().curve(curveCatmullRomClosed.alpha(0.5));

/** A tapered, curved branch: a cubic centre line with its width laid off on both sides. */
function branchPath(g: Geom): string {
  const L = Math.hypot(g.bx - g.ax, g.by - g.ay);
  if (L < 0.5) return `M${g.ax},${g.ay}Z`;
  const a = g.j * 0.2;
  const sx = g.sx * Math.cos(a) - g.sy * Math.sin(a);
  const sy = g.sx * Math.sin(a) + g.sy * Math.cos(a);
  const c1x = g.ax + sx * L * 0.42;
  const c1y = g.ay + sy * L * 0.42;
  const c2x = g.bx - g.ex * L * 0.36;
  const c2y = g.by - g.ey * L * 0.36;
  const N = 16;
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = 1 - t;
    const x = u * u * u * g.ax + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * g.bx;
    const y = u * u * u * g.ay + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * g.by;
    const d = unit(
      3 * u * u * (c1x - g.ax) + 6 * u * t * (c2x - c1x) + 3 * t * t * (g.bx - c2x),
      3 * u * u * (c1y - g.ay) + 6 * u * t * (c2y - c1y) + 3 * t * t * (g.by - c2y),
    );
    const w = (g.w0 + (g.w1 - g.w0) * Math.pow(t, 0.7)) / 2;
    left.push([x - d.y * w, y + d.x * w]);
    right.push([x + d.y * w, y - d.x * w]);
  }
  return outline([...left, ...right.reverse()]) ?? '';
}
function lerpGeom(a: Geom, b: Geom, t: number): Geom {
  const o = {} as Geom;
  for (const k of Object.keys(b) as (keyof Geom)[]) o[k] = a[k] + (b[k] - a[k]) * t;
  const s = unit(o.sx, o.sy);
  const e = unit(o.ex, o.ey);
  return { ...o, sx: s.x, sy: s.y, ex: e.x, ey: e.y };
}

/** The trunk: widest at the ground, with a small flare where it meets the roots. */
function trunkPath(wBase: number, wTop: number): string {
  const N = 14;
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N; // 0 = ground, 1 = top
    const y = -TRUNK * t;
    const x = Math.sin(t * Math.PI) * 5;
    const flare = Math.pow(1 - t, 6) * wBase * 0.55;
    const w = (wTop + (wBase - wTop) * (1 - t) + flare) / 2;
    left.push([x - w, y]);
    right.push([x + w, y]);
  }
  right.reverse();
  return outline([...left, [0, -TRUNK - wTop * 0.3], ...right, [0, wBase * 0.15]]) ?? '';
}

export function initTree(): void {
  const dataEl = document.getElementById('tree-data');
  const svgEl = document.getElementById('tree') as SVGSVGElement | null;
  if (!dataEl || !svgEl) return;
  const data = JSON.parse(dataEl.textContent || '{}') as Payload;
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const S = data.strings;

  // how much knowledge each branch carries
  const sizes = new Map<string, number>();
  const sizeOf = (id: string): number => {
    if (!sizes.has(id)) sizes.set(id, 1 + byId.get(id)!.k.reduce((s, c) => s + sizeOf(c), 0));
    return sizes.get(id)!;
  };
  const widthOf = (n: number): number => 0.6 + 1.9 * Math.sqrt(n);
  const groupOf = new Map<string, string>();
  for (const side of ['canopy', 'roots'] as Side[])
    for (const g of data.groups[side]) for (const f of g.f) groupOf.set(f, `g:${g.id}`);
  // every limb of the canopy has its own green, from olive on the left to sea green on the right
  const hueOf = new Map<string, number>();
  const nG = data.groups.canopy.length;
  data.groups.canopy.forEach((g, i) => {
    const h = 80 + (nG > 1 ? (i * 112) / (nG - 1) : 70);
    hueOf.set(`g:${g.id}`, h);
    for (const f of g.f) hueOf.set(f, h);
  });
  const hue = (p: Placed): number | undefined => {
    if (p.side !== 'canopy') return undefined;
    if (p.group) return hueOf.get(p.id);
    const n = byId.get(p.id);
    return n ? hueOf.get(n.top ?? n.id) : undefined;
  };
  const limbOf = (p: Placed): Placed | null => {
    let c: Placed | null = p;
    while (c && c.depth > 1) c = c.parent;
    return c && c.depth === 1 ? c : null;
  };
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const expanded = new Set<string>([data.center]);
  for (const id of byId.get(data.center)!.k) expanded.add(id);
  let selected: string | null = null;

  const svg = select(svgEl);
  const defs = svg.append('defs');
  const soil = defs.append('linearGradient').attr('id', 'soil').attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
  soil.append('stop').attr('offset', 0).attr('class', 'soil-top');
  soil.append('stop').attr('offset', 1).attr('class', 'soil-bottom');
  // the soil and the ground line fade out sideways instead of ending in hard edges
  const hfade = defs.append('linearGradient').attr('id', 'hfade');
  for (const [o, a] of [
    [0, 0],
    [0.22, 1],
    [0.78, 1],
    [1, 0],
  ])
    hfade.append('stop').attr('offset', o).attr('stop-color', '#fff').attr('stop-opacity', a);
  defs
    .append('mask')
    .attr('id', 'soil-mask')
    .attr('maskContentUnits', 'objectBoundingBox')
    .append('rect')
    .attr('width', 1)
    .attr('height', 1)
    .attr('fill', 'url(#hfade)');
  const groundFade = defs.append('linearGradient').attr('id', 'ground-fade');
  for (const [o, cls] of [
    [0, 'ground-out'],
    [0.25, 'ground-in'],
    [0.75, 'ground-in'],
    [1, 'ground-out'],
  ] as const)
    groundFade.append('stop').attr('offset', o).attr('class', cls);
  // soft round shading across the trunk
  const barkShade = defs.append('linearGradient').attr('id', 'bark-shade');
  for (const [o, cls] of [
    [0, 'bark-dark'],
    [0.3, 'bark-mid'],
    [0.55, 'bark-light'],
    [0.85, 'bark-mid'],
    [1, 'bark-dark'],
  ] as const)
    barkShade.append('stop').attr('offset', o).attr('class', cls);
  const viewport = svg.append('g');
  const gGround = viewport.append('g');
  const gCrown = viewport.append('g');
  const gTrunk = viewport.append('g');
  const gLinks = viewport.append('g');
  const gGroups = viewport.append('g').attr('class', 't-groups');
  const gRel = viewport.append('g');
  const gNodes = viewport.append('g');

  const zoomer: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.12, 5])
    .on('zoom', (e) => {
      viewport.attr('transform', e.transform.toString());
      svgEl.style.setProperty('--k', String(e.transform.k));
      svgEl.classList.toggle('far', e.transform.k < 0.8);
    });
  svg.call(zoomer).on('dblclick.zoom', null);

  let placed = new Map<string, Placed>();

  function layoutSide(side: Side): Placed[] {
    type D = { id: string; group?: Group; rank?: number; children?: D[] };
    const build = (id: string): D => {
      const n = byId.get(id)!;
      if (!expanded.has(id) || !n.k.length) return { id };
      const kids = n.k.map((c, i) => ({ ...build(c), rank: n.k.length > 1 ? i / (n.k.length - 1) : 0.5 }));
      return { id, children: centerOut(kids) };
    };
    const rootD: D = {
      id: `r:${side}`,
      children: data.groups[side].map((g) => ({ id: `g:${g.id}`, group: g, children: g.f.map(build) })),
    };
    const root = hierarchy<D>(rootD);
    const span = Math.PI - 2 * PAD;
    const laid = tree<D>()
      .size([span, 1])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.5) / Math.max(1, a.depth - 1))(root);
    // each ring gets enough circumference for its labels to breathe
    const perDepth: number[] = [];
    laid.each((d) => (perDepth[d.depth] = (perDepth[d.depth] ?? 0) + 1));
    const rings = [0, ...RING[side]];
    for (let i = 3; i < perDepth.length; i++)
      rings[i] = Math.max(rings[i - 1] + STEP + (i > 3 ? REACH : 0), (perDepth[i] * MIN_ARC) / span);
    const o = origin(side);
    const sign = side === 'canopy' ? -1 : 1;
    const out: Placed[] = [];
    const map = new Map<HierarchyPointNode<D>, Placed>();
    laid.each((d) => {
      const theta = d.x + PAD;
      const r = rings[d.depth] + (d.depth >= 3 ? REACH * (d.data.rank ?? 0.5) : 0);
      const id = d.data.id;
      const w =
        d.depth === 0
          ? widthOf(data.groups[side].reduce((s, g) => g.f.reduce((t, f) => t + sizeOf(f), s), 0))
          : d.data.group
            ? widthOf(d.data.group.f.reduce((s, f) => s + sizeOf(f), 0))
            : widthOf(sizeOf(id));
      const p: Placed = {
        id,
        group: d.data.group,
        depth: d.depth,
        r,
        x: o.x - r * Math.cos(theta),
        y: o.y + sign * r * Math.sin(theta),
        side,
        parent: d.parent ? map.get(d.parent)! : null,
        w,
      };
      map.set(d, p);
      out.push(p);
    });
    return out;
  }

  function computeLayout(): Map<string, Placed> {
    const m = new Map<string, Placed>();
    for (const p of [...layoutSide('canopy'), ...layoutSide('roots')]) m.set(p.id, p);
    m.set(data.center, { id: data.center, depth: 0, x: 0, y: 0, r: 0, side: 'center', parent: null, w: 0 });
    return m;
  }

  const isVirtual = (p: Placed): boolean => p.id.startsWith('r:');
  const visibleKids = (p: Placed): boolean =>
    !!p.group || (byId.get(p.id)!.k.length > 0 && expanded.has(p.id));

  function geomFor(p: Placed): Geom {
    const q = p.parent!;
    const e = outward(p);
    let a: Pt;
    let s: Pt;
    if (q.id.startsWith('r:')) {
      // a limb leaves the trunk: the more it leans sideways, the lower it starts
      const lean = Math.abs(e.x);
      const toward = unit(p.x, p.y - (p.side === 'canopy' ? -TRUNK : 0));
      if (p.side === 'canopy') {
        a = { x: toward.x * 4, y: -TRUNK + 115 * Math.pow(lean, 1.4) };
        s = unit(toward.x * 0.5, -1);
      } else {
        a = { x: toward.x * 5, y: 4 + 16 * lean };
        s = unit(toward.x * 0.7, 1);
      }
    } else {
      a = { x: q.x, y: q.y };
      s = outward(q);
    }
    const leaf = !visibleKids(p);
    return {
      ax: a.x,
      ay: a.y,
      bx: p.x,
      by: p.y,
      sx: s.x,
      sy: s.y,
      ex: e.x,
      ey: e.y,
      w0: p.w,
      w1: p.w * (leaf ? 0.42 : 0.8),
      j: jitter(p.id) * (p.side === 'roots' ? 1.6 : 1),
    };
  }

  function pathToCenter(id: string | null): Set<string> {
    const s = new Set<string>();
    let cur = id ? byId.get(id) : undefined;
    while (cur) {
      s.add(cur.id);
      if (groupOf.has(cur.id)) s.add(groupOf.get(cur.id)!);
      cur = cur.p ? byId.get(cur.p) : undefined;
    }
    return s;
  }

  function labelTransform(p: Placed): { transform: string; anchor: string; dx: number; dy: number } {
    if (p.depth === 0) return { transform: '', anchor: 'end', dx: -22, dy: 16 };
    const e = outward(p);
    const deg = (Math.atan2(e.y, e.x) * 180) / Math.PI;
    const flip = deg > 90 || deg < -90;
    const rot = `rotate(${flip ? deg + 180 : deg})`;
    if (p.depth === 2) return { transform: rot, anchor: flip ? 'start' : 'end', dx: flip ? 13 : -13, dy: -9 };
    const n = byId.get(p.id)!;
    const gap = prongCount(n) ? 30 : !n.k.length && p.side === 'canopy' ? 25 : 10;
    return { transform: rot, anchor: flip ? 'end' : 'start', dx: flip ? -gap : gap, dy: 0 };
  }

  const prongCount = (n: RawNode): number => (!n.k.length && (n.pw?.length ?? 0) >= 2 ? Math.min(n.pw!.length, 4) : 0);

  function render(animate = true, intro = false): void {
    const prev = intro ? new Map<string, Placed>() : placed;
    placed = computeLayout();
    const onPath = pathToCenter(selected);
    const list = [...placed.values()].filter((p) => !isVirtual(p));
    const links = list.filter((p) => p.parent);
    const nodesOnly = list.filter((p) => !p.group);
    const dur = animate ? DUR : 0;
    // on the first load every level waits for the one before it, so the tree grows from the trunk
    const wait = (p: Placed): number => (intro ? INTRO_DELAY + Math.max(0, p.depth - 1) * INTRO_STEP : 0);
    const time = intro ? INTRO_DUR : dur;
    const from = (p: Placed): Pt => {
      // new branches grow out of their nearest previously visible ancestor
      let cur: Placed | null = p.parent;
      while (cur && !prev.has(cur.id) && !isVirtual(cur)) cur = cur.parent;
      const o = cur ? (prev.get(cur.id) ?? cur) : { x: 0, y: 0 };
      return { x: o.x, y: o.y };
    };

    // ground and soil
    const maxX = Math.max(600, ...list.map((p) => Math.abs(p.x))) + 200;
    const maxY = Math.max(300, ...list.filter((p) => p.side === 'roots').map((p) => p.y)) + 160;
    gGround
      .selectAll('rect.t-soil')
      .data([0])
      .join('rect')
      .attr('class', 't-soil')
      .attr('mask', 'url(#soil-mask)')
      .attr('x', -maxX * 1.3)
      .attr('width', maxX * 2.6)
      .attr('y', 0)
      .attr('height', maxY);
    gGround
      .selectAll('rect.t-ground')
      .data([0])
      .join('rect')
      .attr('class', 't-ground')
      .attr('x', -maxX * 1.3)
      .attr('width', maxX * 2.6)
      .attr('y', -0.8)
      .attr('height', 1.6);
    gGround
      .selectAll<SVGTextElement, { t: string; y: number }>('text')
      .data([
        { t: '↑ ' + S.canopy, y: -10 },
        { t: '↓ ' + S.roots, y: 20 },
      ])
      .join('text')
      .attr('class', 't-side-label')
      .attr('x', -maxX + 12)
      .attr('y', (d) => d.y)
      .text((d) => d.t);

    // crown: a flat, cloud-edged silhouette per limb, made of overlapping discs around its twigs
    type Blob = { id: string; x: number; y: number; r: number; fx: number; fy: number };
    const crowns = data.groups.canopy.map((g) => ({ id: `g:${g.id}`, hue: hueOf.get(`g:${g.id}`) ?? 150, blobs: [] as Blob[] }));
    const crownOf = new Map(crowns.map((c) => [c.id, c]));
    for (const p of list) {
      if (p.side !== 'canopy' || p.depth < 2) continue;
      const c = crownOf.get(limbOf(p)?.id ?? '');
      if (!c) continue;
      const f = from(p);
      const j = Math.abs(jitter(p.id + 'c'));
      c.blobs.push({ id: p.id, x: p.x, y: p.y, r: (visibleKids(p) ? 52 : 40) + 12 * j, fx: f.x, fy: f.y });
      // fill the space along the twig as well
      if (p.parent && p.parent.depth >= 2)
        c.blobs.push({
          id: p.id + '~',
          x: (p.x + p.parent.x) / 2,
          y: (p.y + p.parent.y) / 2,
          r: 38 + 10 * j,
          fx: f.x,
          fy: f.y,
        });
    }
    const crownSel = gCrown
      .selectAll<SVGGElement, (typeof crowns)[number]>('g.t-crown')
      .data(crowns, (d) => d.id)
      .join((enter) => {
        const g = enter.append('g').attr('class', 't-crown');
        g.append('g').attr('class', 'halo');
        g.append('g').attr('class', 'core');
        return g;
      })
      .style('--gh', (d) => d.hue);
    for (const layer of ['halo', 'core'] as const) {
      const grow = layer === 'halo' ? 26 : 0;
      crownSel
        .select<SVGGElement>(`g.${layer}`)
        .selectAll<SVGCircleElement, Blob>('circle')
        .data((d) => d.blobs, (b) => b.id)
        .join(
          (enter) =>
            enter
              .append('circle')
              .attr('cx', (b) => b.fx)
              .attr('cy', (b) => b.fy)
              .attr('r', 0),
          (update) => update,
          (exit) => exit.transition().duration(dur).attr('r', 0).remove(),
        )
        .transition()
        .delay(intro ? INTRO_DELAY + 700 : 0)
        .duration(intro ? INTRO_DUR * 1.4 : dur)
        .ease(easeCubicOut)
        .attr('cx', (b) => b.x)
        .attr('cy', (b) => b.y)
        .attr('r', (b) => b.r + grow);
    }

    // trunk
    const wTop = placed.get('r:canopy')?.w ?? 14;
    gTrunk
      .selectAll('path')
      .data([0])
      .join('path')
      .attr('class', `t-trunk${selected === data.center ? ' on' : ''}`)
      .attr('fill', 'url(#bark-shade)')
      .attr('d', trunkPath(wTop * 1.3, wTop))
      .on('click', (e: MouseEvent) => {
        e.stopPropagation();
        onNodeClick(data.center);
      });

    // branches
    type El = SVGPathElement & { __g?: Geom };
    gLinks
      .selectAll<El, Placed>('path')
      .data(links, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append('path')
            .on('click', (e: MouseEvent, d) => {
              e.stopPropagation();
              if (!d.group) onNodeClick(d.id);
            })
            .call((p) => p.append('title').text((d) => (d.group ? d.group.t : byId.get(d.id)!.t)))
            .each(function (d) {
              const o = from(d);
              const g = geomFor(d);
              this.__g = { ...g, ax: o.x, ay: o.y, bx: o.x, by: o.y, w0: 0, w1: 0 };
            }),
        (update) => update,
        (exit) =>
          exit
            .transition()
            .duration(dur)
            .style('opacity', 0)
            .attrTween('d', function () {
              const g0 = this.__g!;
              const g1 = { ...g0, bx: g0.ax, by: g0.ay, w1: 0 };
              return (t) => branchPath(lerpGeom(g0, g1, t));
            })
            .remove(),
      )
      .attr('class', (d) => {
        const lvl = d.group ? 0 : Math.min(3, d.depth - 1);
        return `t-branch ${d.side} l${lvl}${onPath.has(d.id) ? ' on' : ''}${d.group ? ' limb' : ''}`;
      })
      .style('--gh', (d) => hue(d) ?? null)
      .transition()
      .delay(wait)
      .duration(time)
      .ease(easeCubicOut)
      .attrTween('d', function (d) {
        const g0 = this.__g ?? geomFor(d);
        const g1 = geomFor(d);
        return (t) => {
          const g = lerpGeom(g0, g1, t);
          this.__g = g;
          return branchPath(g);
        };
      });

    // limb names, written along the limb
    gGroups
      .selectAll<SVGTextElement, Placed>('text')
      .data(
        list.filter((p) => p.group),
        (d) => d.id,
      )
      .join('text')
      .attr('class', (d) => `t-group ${d.side}${onPath.has(d.id) ? ' on' : ''}`)
      .attr('dy', '0.32em')
      .text((d) => d.group!.t)
      .transition()
      .delay(wait)
      .duration(time)
      .attr('transform', (d) => {
        const g = geomFor(d);
        const mx = g.ax + (g.bx - g.ax) * 0.58;
        const my = g.ay + (g.by - g.ay) * 0.58;
        let deg = (Math.atan2(g.by - g.ay, g.bx - g.ax) * 180) / Math.PI;
        if (deg > 90 || deg < -90) deg += 180;
        const off = d.w / 2 + 9;
        const rad = (deg * Math.PI) / 180;
        return `translate(${mx + Math.sin(rad) * off},${my - Math.cos(rad) * off}) rotate(${deg})`;
      });

    // nodes
    const nodeSel = gNodes
      .selectAll<SVGGElement, Placed>('g.t-node')
      .data(nodesOnly, (d) => d.id)
      .join(
        (enter) => {
          const g = enter
            .append('g')
            .attr('transform', (d) => {
              const o = from(d);
              return `translate(${o.x},${o.y})`;
            })
            .style('opacity', 0)
            .attr('tabindex', 0)
            .attr('role', 'button');
          g.append('circle').attr('class', 'hit').attr('r', 14);
          g.append('g').attr('class', 'shape');
          g.append('circle').attr('class', 'ring');
          g.append('circle').attr('class', 'mark');
          g.append('text').attr('dy', '0.32em');
          g.on('click', (e: MouseEvent, d) => {
            e.stopPropagation();
            onNodeClick(d.id);
          });
          g.on('mouseenter', function () {
            (this as SVGGElement).classList.add('hov');
            (this as SVGGElement).parentNode?.appendChild(this as SVGGElement);
          });
          g.on('mouseleave', function () {
            (this as SVGGElement).classList.remove('hov');
          });
          g.on('keydown', (e: KeyboardEvent, d) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNodeClick(d.id);
            }
          });
          return g;
        },
        (update) => update,
        (exit) => exit.transition().duration(dur).style('opacity', 0).remove(),
      );

    nodeSel
      .attr('class', (d) => {
        const n = byId.get(d.id)!;
        const cls = ['t-node', d.side, `lv${Math.max(0, d.depth - 1)}`];
        if (!n.k.length) cls.push('leaf');
        if (n.k.length && expanded.has(d.id) && d.depth > 0) cls.push('open');
        if (prongCount(n) || (n.pw && n.k.length)) cls.push('fork');
        if (selected === d.id) cls.push('sel');
        if (selected && !onPath.has(d.id) && d.depth > 2) cls.push('dim');
        if (onPath.has(d.id) || (selected && n.p === selected)) cls.push('lbl');
        return cls.join(' ');
      })
      .attr('aria-label', (d) => byId.get(d.id)!.t)
      .attr('aria-expanded', (d) => (byId.get(d.id)!.k.length ? String(expanded.has(d.id)) : null))
      .style('--gh', (d) => hue(d) ?? null);

    // leaves on the canopy's twigs, forks on open questions, knots and buds elsewhere
    nodeSel.select<SVGGElement>('g.shape').each(function (d) {
      const n = byId.get(d.id)!;
      const e = outward(d);
      const deg = (Math.atan2(e.y, e.x) * 180) / Math.PI;
      const g = select(this).attr('transform', `rotate(${deg})`);
      const prongs = prongCount(n);
      const bloom = !n.k.length && d.side === 'canopy' && (n.y ?? 0) >= BLOOM_SINCE;
      const kind = prongs ? `fork${prongs}` : bloom ? 'bloom' : !n.k.length && d.side === 'canopy' ? 'leaf' : 'none';
      if (this.dataset.kind === kind) return;
      this.dataset.kind = kind;
      g.selectAll('*').remove();
      // leaves and blossoms lean a little to either side and sway, each at its own pace
      const sway = (): ReturnType<typeof g.append<SVGGElement>> =>
        g
          .append('g')
          .attr('transform', `rotate(${jitter(d.id + 't') * 20})`)
          .append('g')
          .attr('class', 'sway')
          .style('--sd', `${5 + 3 * Math.abs(jitter(d.id + 's'))}s`)
          .style('--sdl', `${-7 * Math.abs(jitter(d.id + 'd'))}s`);
      if (kind === 'leaf') {
        const len = 15 + 5 * Math.abs(jitter(d.id));
        const w = len * 0.34;
        const sw = sway();
        sw.append('path')
          .attr('class', 'leaf')
          .style('--lv', jitter(d.id + 'l'))
          .attr(
            'd',
            `M0,0C${len * 0.2},${-w} ${len * 0.62},${-w * 1.05} ${len},0C${len * 0.62},${w * 1.05} ${len * 0.2},${w} 0,0Z`,
          );
        sw.append('path').attr('class', 'rib').attr('d', `M1.5,0L${len * 0.8},0`);
      } else if (kind === 'bloom') {
        const sw = sway();
        sw.append('path').attr('class', 'stalk').attr('d', 'M0,0L6.5,0');
        const b = sw.append('g').attr('class', 'bloom').attr('transform', 'translate(11,0)');
        const turn = jitter(d.id + 'b') * 36;
        for (let i = 0; i < 5; i++) {
          const a = ((i * 72 + turn) * Math.PI) / 180;
          b.append('ellipse')
            .attr('class', 'petal')
            .attr('cx', 3.6 * Math.cos(a))
            .attr('cy', 3.6 * Math.sin(a))
            .attr('rx', 3.4)
            .attr('ry', 2.6)
            .attr('transform', `rotate(${i * 72 + turn} ${3.6 * Math.cos(a)} ${3.6 * Math.sin(a)})`);
        }
        b.append('circle').attr('class', 'eye').attr('r', 1.9);
      } else if (prongs) {
        const who = n.pw!;
        for (let i = 0; i < prongs; i++) {
          const a = ((i - (prongs - 1) / 2) * 26 * Math.PI) / 180;
          const L = 19 + 3 * Math.abs(jitter(d.id + i));
          const x = L * Math.cos(a);
          const y = L * Math.sin(a);
          const p = g.append('g').attr('class', 'prong');
          p.append('path').attr('d', `M0,-1.1C${x * 0.45},-1.1 ${x * 0.7},${y - 0.5} ${x},${y}C${x * 0.7},${y + 0.5} ${x * 0.45},1.1 0,1.1Z`);
          p.append('circle').attr('cx', x).attr('cy', y).attr('r', 2.4);
          p.append('title').text(`${S.positions}: ${who[i]}`);
        }
      }
    });
    nodeSel
      .select<SVGCircleElement>('circle.mark')
      .attr('r', (d) => {
        const n = byId.get(d.id)!;
        if (d.depth === 0) return 7;
        if (d.depth === 2) return 5;
        if (!n.k.length) return d.side === 'canopy' || prongCount(n) ? 1.8 : 3.2;
        return 3.6;
      });
    nodeSel
      .select<SVGCircleElement>('circle.ring')
      .attr('r', (d) => (d.depth === 2 ? 9.5 : 7))
      .style('display', (d) => {
        const n = byId.get(d.id)!;
        return n.k.length && !expanded.has(d.id) ? null : 'none';
      });
    nodeSel
      .select<SVGTextElement>('text')
      .each(function (d) {
        const lt = labelTransform(d);
        select(this)
          .attr('transform', lt.transform || null)
          .attr('text-anchor', lt.anchor)
          .attr('x', lt.dx)
          .attr('y', lt.dy);
      })
      .text((d) => byId.get(d.id)!.t);

    nodeSel
      .transition()
      .delay((d) => wait(d) + (intro ? INTRO_DUR * 0.5 : 0))
      .duration(time)
      .ease(easeCubicOut)
      .style('opacity', 1)
      .attr('transform', (d) => `translate(${d.x},${d.y})`);

    renderRelated();
  }

  function renderRelated(): void {
    const pairs: { a: Placed; b: Placed; key: string }[] = [];
    if (selected) {
      const a = placed.get(selected);
      const n = byId.get(selected)!;
      const others = new Set(n.rel);
      for (const m of byId.values()) if (m.rel.includes(selected)) others.add(m.id);
      if (a)
        for (const id of others) {
          const b = placed.get(id);
          if (b) pairs.push({ a, b, key: `${a.id}>${b.id}` });
        }
    }
    gRel
      .selectAll<SVGPathElement, (typeof pairs)[number]>('path')
      .data(pairs, (d) => d.key)
      .join('path')
      .attr('class', 't-rel')
      .attr('d', ({ a, b }) => {
        const cx = (a.x + b.x) * 0.3;
        const cy = (a.y + b.y) * 0.3 - TRUNK * 0.35;
        return `M${a.x},${a.y}Q${cx},${cy} ${b.x},${b.y}`;
      });
  }

  function onNodeClick(id: string): void {
    const n = byId.get(id)!;
    if (selected === id && n.k.length && expanded.has(id) && id !== data.center) {
      collapse(id);
    } else if (n.k.length && !expanded.has(id)) {
      expanded.add(id);
    }
    select_(id);
  }

  function collapse(id: string): void {
    const walk = (x: string) => {
      expanded.delete(x);
      byId.get(x)!.k.forEach(walk);
    };
    walk(id);
  }

  function select_(id: string | null, opts: { zoomTo?: boolean } = {}): void {
    selected = id;
    render();
    showPanel(id);
    try {
      history.replaceState(null, '', id ? `#${id}` : location.pathname + location.search);
    } catch {
      /* ignore */
    }
    if (id && opts.zoomTo) setTimeout(() => zoomToNode(id), DUR + 20);
  }

  function reveal(id: string): void {
    let cur = byId.get(id);
    while (cur && cur.p) {
      expanded.add(cur.p);
      cur = byId.get(cur.p);
    }
    select_(id, { zoomTo: true });
  }

  // ---------- panel ----------
  const panel = document.getElementById('panel')!;
  function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function linkList(title: string, ids: string[]): HTMLElement[] {
    if (!ids.length) return [];
    const h = el('h3', {}, title);
    const ul = el('ul', { class: 'links' });
    for (const id of ids) {
      const m = byId.get(id);
      if (!m) continue;
      const li = el('li');
      const b = el('button', { type: 'button' }, m.t);
      b.addEventListener('click', () => reveal(id));
      li.append(b);
      ul.append(li);
    }
    return [h, ul];
  }
  function showPanel(id: string | null): void {
    panel.replaceChildren();
    if (!id) {
      panel.hidden = true;
      return;
    }
    const n = byId.get(id)!;
    const close = el('button', { class: 'btn close', type: 'button', 'aria-label': S.close }, '✕');
    close.addEventListener('click', () => select_(null));
    const meta = el('div', { class: 'meta' });
    const chip = el('span', { class: 'chip' });
    chip.append(el('span', { class: `dot ${n.s}` }), document.createTextNode(n.ty));
    meta.append(chip);
    if (n.d) meta.append(el('span', { class: 'chip' }, n.d));
    else if (n.dv) meta.append(el('span', { class: 'chip' }, `${S.datings}: ${n.dv}`));
    const h = el('h2', {}, n.t);
    const p = el('p', { class: 'sum' }, n.sum);
    const views: HTMLElement[] = [];
    if (n.pw && n.k.length) views.push(el('p', { class: 'fork-note' }, S.forkNoteKids));
    else if (n.pw?.length) {
      views.push(el('p', { class: 'fork-note' }, S.forkNote));
      const ul = el('ul', { class: 'views' });
      for (const w of n.pw) ul.append(el('li', {}, w));
      views.push(ul);
    }
    const rel = new Set(n.rel);
    for (const m of byId.values()) if (m.rel.includes(id)) rel.add(m.id);
    const go = el('a', { class: 'go', href: n.href }, `${S.openPage} →`);
    panel.append(close, meta, h, p, ...views, go, ...linkList(S.children, n.k), ...linkList(S.related, [...rel]));
    panel.hidden = false;
  }

  // ---------- zoom helpers ----------
  function size(): { w: number; h: number } {
    const r = svgEl!.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }
  function bounds(): { x: number; y: number; width: number; height: number } {
    let x0 = -60,
      x1 = 60,
      y0 = -TRUNK - 30,
      y1 = 30;
    // labels of deeper rings are hidden when zoomed out, so only nodes count
    for (const p of placed.values()) {
      x0 = Math.min(x0, p.x - 40);
      x1 = Math.max(x1, p.x + 40);
      y0 = Math.min(y0, p.y - 40);
      y1 = Math.max(y1, p.y + 30);
    }
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }
  function fit(animate = true): void {
    const bb = bounds();
    const { w, h } = size();
    if (!bb.width || !bb.height) return;
    const pad = 40;
    const k = Math.min((w - pad * 2) / bb.width, (h - pad * 2 - 60) / bb.height, 1.4);
    const tx = w / 2 - k * (bb.x + bb.width / 2);
    const ty = (h + 50) / 2 - k * (bb.y + bb.height / 2);
    const tr = zoomIdentity.translate(tx, ty).scale(k);
    (animate ? svg.transition().duration(500) : svg).call(zoomer.transform as any, tr);
  }
  function zoomToNode(id: string): void {
    const p = placed.get(id);
    if (!p) return;
    const { w, h } = size();
    const mobile = w < 720;
    const k = Math.max(0.9, Math.min(1.3, w / 900));
    const cx = mobile ? w / 2 : (w - 400) / 2;
    const cy = mobile ? h * 0.32 : h / 2;
    const tr = zoomIdentity.translate(cx - k * p.x, cy - k * p.y).scale(k);
    svg.transition().duration(600).call(zoomer.transform as any, tr);
  }

  // ---------- toolbar ----------
  document.getElementById('btn-expand')?.addEventListener('click', () => {
    for (const n of byId.values()) if (n.k.length) expanded.add(n.id);
    render();
    setTimeout(() => fit(), DUR + 20);
  });
  document.getElementById('btn-collapse')?.addEventListener('click', () => {
    expanded.clear();
    expanded.add(data.center);
    select_(null);
    setTimeout(() => fit(), DUR + 20);
  });
  document.getElementById('btn-fit')?.addEventListener('click', () => fit());
  svg.on('click', () => {
    if (selected) select_(null);
  });

  // ---------- search ----------
  const input = document.getElementById('tree-search') as HTMLInputElement;
  const results = document.getElementById('search-results') as HTMLUListElement;
  const norm = (s: string) =>
    s
      .toLocaleLowerCase(data.lang)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ı/g, 'i');
  const index = data.nodes.map((n) => ({ n, key: norm(n.t), body: norm(n.sum) }));
  let hits: RawNode[] = [];
  let active = -1;
  function drawResults(): void {
    results.replaceChildren();
    hits.forEach((n, i) => {
      const li = el('li', { role: 'option', 'aria-selected': String(i === active) });
      li.append(el('span', { class: `dot ${n.s}` }), document.createTextNode(n.t));
      const top = n.top && n.top !== n.id ? byId.get(n.top)?.t : '';
      if (top) li.append(el('span', { class: 'hint' }, top));
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        choose(n.id);
      });
      results.append(li);
    });
    results.hidden = hits.length === 0;
  }
  function choose(id: string): void {
    hits = [];
    drawResults();
    input.blur();
    reveal(id);
  }
  input.addEventListener('input', () => {
    const q = norm(input.value.trim());
    if (!q) {
      hits = [];
    } else {
      // exact title, then title prefix, then word prefix, then anywhere in title, then summary
      const score = (x: (typeof index)[number]): number => {
        if (x.key === q) return 0;
        if (x.key.startsWith(q)) return 1;
        if (x.key.split(/[\s'"(),.-]+/).some((w) => w.startsWith(q))) return 2;
        if (x.key.includes(q)) return 3;
        return x.body.includes(q) ? 4 : 9;
      };
      hits = index
        .map((x) => ({ x, s: score(x) }))
        .filter((h) => h.s < 9)
        .sort((a, b) => a.s - b.s || a.x.key.length - b.x.key.length)
        .slice(0, 10)
        .map((h) => h.x.n);
    }
    active = hits.length ? 0 : -1;
    drawResults();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      active = Math.min(hits.length - 1, active + 1);
      drawResults();
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      active = Math.max(0, active - 1);
      drawResults();
      e.preventDefault();
    } else if (e.key === 'Enter' && hits[active]) {
      choose(hits[active].id);
    } else if (e.key === 'Escape') {
      hits = [];
      drawResults();
    }
  });
  input.addEventListener('blur', () => setTimeout(() => ((results.hidden = true), undefined), 120));

  // ---------- start ----------
  const hash = decodeURIComponent(location.hash.slice(1));
  const grow = !reduceMotion && !(hash && byId.has(hash));
  if (grow) {
    svgEl.classList.add('intro');
    setTimeout(() => svgEl.classList.remove('intro'), INTRO_DELAY + 6 * INTRO_STEP + 2 * INTRO_DUR);
  }
  render(grow, grow);
  fit(false);
  if (hash && byId.has(hash)) reveal(hash);
  let rt: number | undefined;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = window.setTimeout(() => fit(false), 150);
  });
}
