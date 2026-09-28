// Social preview images (1200×630), drawn at build time: one per node and language, plus one for the site.
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { allNodes, ancestors, type Lang } from '../../../lib/data';
import { t, typeLabels, formatDate, ui } from '../../../lib/i18n';

const require = createRequire(import.meta.url);
const font = (pkg: string, file: string) => readFileSync(require.resolve(`${pkg}/files/${file}`));
const fonts = [
  { name: 'Inter', weight: 400 as const, data: font('@fontsource/inter', 'inter-latin-400-normal.woff') },
  { name: 'Inter Ext', weight: 400 as const, data: font('@fontsource/inter', 'inter-latin-ext-400-normal.woff') },
  { name: 'Inter', weight: 600 as const, data: font('@fontsource/inter', 'inter-latin-600-normal.woff') },
  { name: 'Inter Ext', weight: 600 as const, data: font('@fontsource/inter', 'inter-latin-ext-600-normal.woff') },
  { name: 'Fraunces', weight: 600 as const, data: font('@fontsource/fraunces', 'fraunces-latin-600-normal.woff') },
  { name: 'Fraunces Ext', weight: 600 as const, data: font('@fontsource/fraunces', 'fraunces-latin-ext-600-normal.woff') },
];

// the latin-ext files carry ş, ğ, ı, İ and friends; they are listed as fallbacks
const SANS = 'Inter, "Inter Ext"';
const SERIF = 'Fraunces, "Fraunces Ext"';

const C = {
  paper: '#f8f6f1',
  ink: '#1d1b17',
  ink2: '#55514a',
  ink3: '#837d72',
  border: '#e2dccf',
  canopy: '#1f9e70',
  roots: '#e2672f',
  bark: '#6e6157',
};

type El = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: unknown[]): El => ({
  type,
  props: { style, children: children.length === 1 ? children[0] : children },
});

const mark = (size: number): El => ({
  type: 'svg',
  props: {
    width: size,
    height: size,
    viewBox: '0 0 32 32',
    children: [
      {
        type: 'path',
        props: {
          d: 'M16 17.5c-.9-3.6-3.1-6.2-6.6-7.5M16 17.5c.9-3.6 3.1-6.2 6.6-7.5M16 17.5V4.5M16 11c-1.6-1.9-3.6-3-5.8-3.3M16 11c1.6-1.9 3.6-3 5.8-3.3',
          fill: 'none',
          stroke: C.canopy,
          strokeWidth: 2.2,
          strokeLinecap: 'round',
        },
      },
      {
        type: 'path',
        props: {
          d: 'M16 17.5v3.2M16 20.7c-1.2 2.5-3.3 4.2-6 5M16 20.7c1.2 2.5 3.3 4.2 6 5M16 20.7v7',
          fill: 'none',
          stroke: C.roots,
          strokeWidth: 2,
          strokeLinecap: 'round',
        },
      },
      { type: 'path', props: { d: 'M5 19h22', stroke: C.bark, strokeWidth: 1.4, strokeLinecap: 'round' } },
    ],
  },
});

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);

function card(o: { title: string; kicker: string; text: string; accent: string; footer: string }): El {
  const size = o.title.length > 60 ? 58 : o.title.length > 34 ? 70 : 84;
  return h(
    'div',
    {
      width: 1200,
      height: 630,
      display: 'flex',
      flexDirection: 'column',
      background: C.paper,
      padding: '64px 72px',
      fontFamily: SANS,
      color: C.ink,
      borderTop: `14px solid ${o.accent}`,
    },
    h(
      'div',
      { display: 'flex', alignItems: 'center', gap: 14 },
      mark(44),
      h('div', { fontFamily: SERIF, fontWeight: 600, fontSize: 36 }, 'Athena'),
      h('div', { marginLeft: 'auto', fontSize: 24, color: o.accent, fontWeight: 600 }, o.kicker),
    ),
    h(
      'div',
      {
        display: 'flex',
        marginTop: 54,
        fontFamily: SERIF,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: -1,
      },
      o.title,
    ),
    h('div', { display: 'flex', marginTop: 26, fontSize: 28, lineHeight: 1.45, color: C.ink2 }, o.text),
    h(
      'div',
      { display: 'flex', marginTop: 'auto', fontSize: 22, color: C.ink3, borderTop: `1px solid ${C.border}`, paddingTop: 20 },
      o.footer,
    ),
  );
}

async function png(el: El): Promise<Uint8Array> {
  const svg = await satori(el as never, { width: 1200, height: 630, fonts });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}

export function getStaticPaths() {
  const langs: Lang[] = ['tr', 'en'];
  return langs.flatMap((lang) => [
    { params: { lang, id: 'athena' } },
    ...allNodes.map((n) => ({ params: { lang, id: n.id } })),
  ]);
}

export const GET: APIRoute = async ({ params }) => {
  const lang = params.lang as Lang;
  const footer = 'latifkedi.github.io/athena';
  let el: El;
  if (params.id === 'athena') {
    el = card({
      title: lang === 'tr' ? 'İnsanlığın bilgi ağacı' : 'The tree of human knowledge',
      kicker: lang === 'tr' ? 'İddialar · kanıtlar · kaynaklar' : 'Claims · evidence · sources',
      text: clip(t(ui.principle, lang), 190),
      accent: C.canopy,
      footer,
    });
  } else {
    const n = allNodes.find((x) => x.id === params.id)!;
    const chain = ancestors(n.id)
      .filter((a) => a.depth >= 1)
      .map((a) => t(a.title, lang));
    const bits = [t(typeLabels[n.type], lang), n.date ? formatDate(n.date, lang) : ''].filter(Boolean);
    el = card({
      title: t(n.title, lang),
      kicker: bits.join(' · '),
      text: clip(t(n.summary, lang), 200),
      accent: n.side === 'roots' ? C.roots : C.canopy,
      footer: [footer, ...chain].join('  ›  '),
    });
  }
  return new Response(await png(el), { headers: { 'Content-Type': 'image/png' } });
};
