// Latest preprints, refreshed monthly by scripts/fetch-latest.mjs (GitHub Actions).
export interface Paper {
  title: string;
  authors: string;
  date: string;
  url: string;
  source: string;
  category: string;
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
