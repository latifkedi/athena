// RSS feeds: recently added or changed nodes, and the monthly list of new papers.
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { allNodes, type Lang } from './data';
import { feed } from './feed';
import { datesOf } from './history';
import { t, url, nodePath, ui } from './i18n';

const site = (ctx: APIContext) => ctx.site!.toString().replace(/\/$/, '');

export function updatesFeed(ctx: APIContext, lang: Lang) {
  const items = allNodes
    .map((n) => ({ n, d: datesOf(n.file) }))
    .filter((x) => x.d)
    .sort((a, b) => b.d!.changed.localeCompare(a.d!.changed) || a.n.id.localeCompare(b.n.id))
    .slice(0, 40)
    .map(({ n, d }) => ({
      title: t(n.title, lang),
      link: site(ctx) + url(nodePath(n.id, lang)),
      pubDate: new Date(d!.changed),
      description: t(n.summary, lang),
    }));
  return rss({
    title: lang === 'tr' ? 'Athena: güncellemeler' : 'Athena: updates',
    description: t(ui.siteTagline, lang),
    site: site(ctx) + url(lang === 'tr' ? '/' : '/en/'),
    items,
    customData: `<language>${lang === 'tr' ? 'tr-TR' : 'en-US'}</language>`,
  });
}

export function papersFeed(ctx: APIContext, lang: Lang) {
  const items = Object.entries(feed.branches)
    .flatMap(([id, papers]) => {
      const n = allNodes.find((x) => x.id === id);
      return papers.map((p) => ({ p, branch: n ? t(n.title, lang) : id }));
    })
    .filter(({ p }) => p.date)
    .sort((a, b) => b.p.date.localeCompare(a.p.date))
    .slice(0, 80)
    .map(({ p, branch }) => ({
      title: p.title,
      link: p.url,
      pubDate: new Date(p.date),
      description: [p.authors, p.source, branch].filter(Boolean).join(' · '),
      categories: [branch, p.kind === 'journal' ? (lang === 'tr' ? 'hakemli' : 'peer-reviewed') : lang === 'tr' ? 'ön baskı' : 'preprint'],
    }));
  return rss({
    title: lang === 'tr' ? 'Athena: yeni makaleler' : 'Athena: new papers',
    description:
      lang === 'tr'
        ? 'Her dal için hakemli dergilerden ve ön baskı sunucularından aylık derlenen yeni araştırmalar.'
        : 'New research for every branch, collected monthly from peer-reviewed journals and preprint servers.',
    site: site(ctx) + url(lang === 'tr' ? '/yeni/' : '/en/latest/'),
    items,
    customData: `<language>${lang === 'tr' ? 'tr-TR' : 'en-US'}</language>`,
  });
}
