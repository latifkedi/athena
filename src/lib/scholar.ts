// Links that search a node's topic in scholarly indexes. Google Scholar has no API, so it is
// linked rather than harvested; the monthly feed uses OpenAlex and the preprint servers instead.
import type { Lang, NodeData } from './data';
import { topLevel } from './data';

export interface SearchLink {
  label: string;
  href: string;
}

const ARXIV = ['fizik', 'matematik', 'astronomi', 'uzay-kesfi', 'bilisim', 'enerji', 'yer-bilimleri', 'kimya'];
const PUBMED = ['tip', 'biyoloji', 'psikoloji', 'parapsikoloji'];
const PHILPAPERS = ['felsefe', 'kelam', 'tasavvuf', 'psikoloji'];
const JSTOR = ['toplum', 'hukuk', 'dilbilim', 'sanat', 'dinler', 'mitoloji', 'ezoterik', 'ilk-bilgiler', 'kelam', 'tasavvuf', 'felsefe'];

/** "Quantum gravity (open question)" → "Quantum gravity" */
const topic = (s: string): string => s.replace(/\s*\([^)]*\)/g, '').replace(/["“”]/g, '').trim();

export function literatureLinks(node: NodeData, lang: Lang): SearchLink[] {
  if (node.side === 'center') return [];
  const en = encodeURIComponent(topic(node.title.en));
  const tr = encodeURIComponent(topic(node.title.tr));
  const field = topLevel(node.id)?.id ?? '';
  const links: SearchLink[] = [
    { label: 'Google Scholar', href: `https://scholar.google.com/scholar?q=${en}` },
    { label: 'Semantic Scholar', href: `https://www.semanticscholar.org/search?q=${en}` },
    { label: 'BASE', href: `https://www.base-search.net/Search/Results?lookfor=${en}` },
    { label: 'CORE', href: `https://core.ac.uk/search?q=${en}` },
  ];
  if (PUBMED.includes(field)) links.push({ label: 'PubMed', href: `https://pubmed.ncbi.nlm.nih.gov/?term=${en}` });
  if (ARXIV.includes(field)) links.push({ label: 'arXiv', href: `https://arxiv.org/search/?query=${en}&searchtype=all` });
  if (PHILPAPERS.includes(field)) links.push({ label: 'PhilPapers', href: `https://philpapers.org/s/${en}` });
  if (JSTOR.includes(field)) links.push({ label: 'JSTOR', href: `https://www.jstor.org/action/doBasicSearch?Query=${en}` });
  links.push({ label: 'DergiPark', href: `https://dergipark.org.tr/${lang}/search?q=${tr}` });
  return links;
}
