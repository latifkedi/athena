// Newest research per branch, refreshed monthly by scripts/fetch-latest.mjs (GitHub Actions).
export interface Paper {
  title: string;
  authors: string;
  date: string;
  url: string;
  /** journal or preprint server */
  source: string;
  category: string;
  /** 'journal': peer-reviewed article (via OpenAlex); 'preprint': not necessarily reviewed yet */
  kind?: 'journal' | 'preprint';
  via?: string;
  cited?: number;
  /** 'tr': written in Turkish (DergiPark and other Turkish journals, via OpenAlex) */
  lang?: string;
  summary?: string;
}
export interface Feed {
  generated: string | null;
  branches: Record<string, Paper[]>;
}

const raw = import.meta.glob('/content/feed/latest.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const feed: Feed = JSON.parse(Object.values(raw)[0] ?? '{"generated":null,"branches":{}}');

export function latestFor(branchId: string): Paper[] {
  return feed.branches[branchId] ?? [];
}

export const isJournal = (p: Paper): boolean => p.kind === 'journal';
export const isTurkish = (p: Paper): boolean => p.lang === 'tr';

/** The three lists shown for a branch: peer-reviewed journals, Turkish-language papers, preprints. */
export function splitPapers(papers: Paper[]): { journals: Paper[]; turkish: Paper[]; preprints: Paper[] } {
  return {
    journals: papers.filter((p) => isJournal(p) && !isTurkish(p)),
    turkish: papers.filter(isTurkish),
    preprints: papers.filter((p) => !isJournal(p) && !isTurkish(p)),
  };
}
