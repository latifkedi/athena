// Interactive "world tree": branches (fields of inquiry) fan out above the ground
// line, roots (traditions of thought and belief) fan out below it.
import { select, zoom, zoomIdentity, hierarchy, tree } from 'd3';
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
}
interface Payload {
  lang: 'tr' | 'en';
  center: string;
  strings: Record<string, string>;
  nodes: RawNode[];
}
interface Placed {
  id: string;
  depth: number;
  x: number;
  y: number;
  theta: number;
  r: number;
  side: RawNode['s'];
  parent: Placed | null;
}

const R1 = 340; // radius of the main branches
const STEP = 170; // minimum distance between rings
const MIN_ARC = 15; // minimum arc length per node on a ring (px)
const PAD = 0.08; // radians kept free next to the ground line
const DUR = 380;

export function initTree(): void {
  const dataEl = document.getElementById('tree-data');
  const svgEl = document.getElementById('tree') as SVGSVGElement | null;
  if (!dataEl || !svgEl) return;
  const data = JSON.parse(dataEl.textContent || '{}') as Payload;
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const S = data.strings;

  const expanded = new Set<string>([data.center]);
  for (const id of byId.get(data.center)!.k) expanded.add(id);
  let selected: string | null = null;

  const svg = select(svgEl);
  const viewport = svg.append('g');
  const gGround = viewport.append('g');
  const gLinks = viewport.append('g');
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

  function layoutSide(side: 'canopy' | 'roots'): Placed[] {
    type D = { id: string; children?: D[] };
    const build = (id: string): D => {
      const n = byId.get(id)!;
      const kids = expanded.has(id) ? n.k.filter((c) => id !== data.center || byId.get(c)!.s === side) : [];
      return kids.length ? { id, children: kids.map(build) } : { id };
    };
    const root = hierarchy<D>(build(data.center));
    const laid = tree<D>()
      .size([Math.PI - 2 * PAD, 1])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.5) / Math.max(1, a.depth))(root);
    const out: Placed[] = [];
    const map = new Map<HierarchyPointNode<D>, Placed>();
    // each ring gets enough circumference for its labels to breathe
    const perDepth: number[] = [];
    laid.each((d) => (perDepth[d.depth] = (perDepth[d.depth] ?? 0) + 1));
    const radii = [0, R1];
    for (let i = 2; i < perDepth.length; i++) {
      radii[i] = Math.max(radii[i - 1] + STEP, (perDepth[i] * MIN_ARC) / (Math.PI - 2 * PAD));
    }
    laid.each((d) => {
      const theta = d.x + PAD;
      const r = radii[d.depth];
      const sign = side === 'canopy' ? -1 : 1;
      const p: Placed = {
        id: d.data.id,
        depth: d.depth,
        theta,
        r,
        x: -r * Math.cos(theta),
        y: sign * r * Math.sin(theta),
        side: d.depth === 0 ? 'center' : side,
        parent: d.parent ? map.get(d.parent)! : null,
      };
      map.set(d, p);
      out.push(p);
    });
    return out;
  }

  function computeLayout(): Map<string, Placed> {
    const m = new Map<string, Placed>();
    const up = layoutSide('canopy');
    const down = layoutSide('roots');
    for (const p of [...up, ...down]) {
      if (p.depth === 0) {
        if (!m.has(p.id)) m.set(p.id, { ...p, x: 0, y: 0 });
      } else m.set(p.id, p);
    }
    // re-point depth-1 parents at the single centre node
    for (const p of m.values()) if (p.parent && p.parent.depth === 0) p.parent = m.get(data.center)!;
    return m;
  }

  function linkPath(s: Placed, t: Placed): string {
    const rm = (s.r + t.r) / 2;
    const sign = t.side === 'canopy' ? -1 : 1;
    const a = s.depth === 0 ? t.theta : s.theta;
    const c1x = -rm * Math.cos(a);
    const c1y = sign * rm * Math.sin(a);
    const c2x = -rm * Math.cos(t.theta);
    const c2y = sign * rm * Math.sin(t.theta);
    return `M${s.x},${s.y}C${c1x},${c1y} ${c2x},${c2y} ${t.x},${t.y}`;
  }

  function pathToCenter(id: string | null): Set<string> {
    const s = new Set<string>();
    let cur = id ? byId.get(id) : undefined;
    while (cur) {
      s.add(cur.id);
      cur = cur.p ? byId.get(cur.p) : undefined;
    }
    return s;
  }

  function labelTransform(p: Placed): { transform: string; anchor: string; dx: number; dy: number } {
    if (p.depth === 0) return { transform: '', anchor: 'end', dx: -16, dy: -12 };
    const deg = (Math.atan2(p.y, p.x) * 180) / Math.PI;
    const flip = deg > 90 || deg < -90;
    if (p.depth === 1)
      return {
        transform: `rotate(${flip ? deg + 180 : deg})`,
        anchor: flip ? 'start' : 'end',
        dx: flip ? 14 : -14,
        dy: 0,
      };
    return {
      transform: `rotate(${flip ? deg + 180 : deg})`,
      anchor: flip ? 'end' : 'start',
      dx: flip ? -11 : 11,
      dy: 0,
    };
  }

  function render(animate = true): void {
    const prev = placed;
    placed = computeLayout();
    const onPath = pathToCenter(selected);
    const list = [...placed.values()];
    const links = list.filter((p) => p.parent);
    const origin = (p: Placed): { x: number; y: number } => {
      // new nodes grow out of their nearest previously visible ancestor
      let cur: Placed | null = p.parent;
      while (cur && !prev.has(cur.id)) cur = cur.parent;
      const o = cur ? prev.get(cur.id)! : { x: 0, y: 0 };
      return { x: o.x, y: o.y };
    };
    const dur = animate ? DUR : 0;

    // ground line + side labels
    const maxR = Math.max(STEP, ...list.map((p) => p.r)) + 220;
    const ground = gGround.selectAll<SVGLineElement, number>('line').data([maxR]);
    ground
      .join('line')
      .attr('class', 't-ground')
      .attr('x1', (d) => -d)
      .attr('x2', (d) => d)
      .attr('y1', 0)
      .attr('y2', 0);
    gGround
      .selectAll<SVGTextElement, { t: string; y: number }>('text')
      .data([
        { t: '↑ ' + S.canopy, y: -10 },
        { t: '↓ ' + S.roots, y: 20 },
      ])
      .join('text')
      .attr('class', 't-side-label')
      .attr('x', -maxR + 8)
      .attr('y', (d) => d.y)
      .text((d) => d.t);

    // links
    gLinks
      .selectAll<SVGPathElement, Placed>('path')
      .data(links, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append('path')
            .attr('d', (d) => {
              const o = origin(d);
              const z = { ...d, x: o.x, y: o.y, r: Math.hypot(o.x, o.y) };
              return linkPath(z, z);
            }),
        (update) => update,
        (exit) => exit.transition().duration(dur).style('opacity', 0).remove(),
      )
      .attr('class', (d) => `t-link ${d.side} d${d.depth}${onPath.has(d.id) ? ' on' : ''}`)
      .transition()
      .duration(dur)
      .attr('d', (d) => linkPath(d.parent!, d));

    // nodes
    const nodeSel = gNodes
      .selectAll<SVGGElement, Placed>('g.t-node')
      .data(list, (d) => d.id)
      .join(
        (enter) => {
          const g = enter
            .append('g')
            .attr('transform', (d) => {
              const o = origin(d);
              return `translate(${o.x},${o.y})`;
            })
            .attr('tabindex', 0)
            .attr('role', 'button');
          g.append('circle').attr('class', 'hit').attr('r', 14);
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
        const hasKids = n.k.length > 0;
        const cls = ['t-node', d.side, `d${d.depth}`];
        if (hasKids && expanded.has(d.id) && d.depth > 0) cls.push('open');
        if (selected === d.id) cls.push('sel');
        if (selected && !onPath.has(d.id) && d.depth > 1) cls.push('dim');
        if (onPath.has(d.id) || (selected && byId.get(d.id)!.p === selected)) cls.push('lbl');
        return cls.join(' ');
      })
      .attr('aria-label', (d) => byId.get(d.id)!.t)
      .attr('aria-expanded', (d) => (byId.get(d.id)!.k.length ? String(expanded.has(d.id)) : null));

    nodeSel.select<SVGCircleElement>('circle.mark').attr('r', (d) => (d.depth === 0 ? 9 : d.depth === 1 ? 6 : 4.2));
    nodeSel
      .select<SVGCircleElement>('circle.ring')
      .attr('r', (d) => (d.depth === 1 ? 10 : 7.5))
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
      .duration(dur)
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
        const cx = (a.x + b.x) * 0.25;
        const cy = (a.y + b.y) * 0.25;
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
    const rel = new Set(n.rel);
    for (const m of byId.values()) if (m.rel.includes(id)) rel.add(m.id);
    const go = el('a', { class: 'go', href: n.href }, `${S.openPage} →`);
    panel.append(close, meta, h, p, go, ...linkList(S.children, n.k), ...linkList(S.related, [...rel]));
    panel.hidden = false;
  }

  // ---------- zoom helpers ----------
  function size(): { w: number; h: number } {
    const r = svgEl!.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }
  function bounds(): { x: number; y: number; width: number; height: number } {
    let x0 = -60, x1 = 60, y0 = -30, y1 = 30;
    // labels of deeper rings are hidden when zoomed out, so only nodes count
    for (const p of placed.values()) {
      x0 = Math.min(x0, p.x - 30);
      x1 = Math.max(x1, p.x + 30);
      y0 = Math.min(y0, p.y - 30);
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
    const cy = mobile ? h * 0.25 : h / 2;
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
  render(false);
  fit(false);
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash && byId.has(hash)) reveal(hash);
  let rt: number | undefined;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = window.setTimeout(() => fit(false), 150);
  });
}

