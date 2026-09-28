// When each content file was first added and last changed, read once from git at build time.
// The deploy workflow checks out the full history (fetch-depth: 0) so these dates are real;
// without history (a shallow clone) every file simply gets the date of the latest commit.
import { execFileSync } from 'node:child_process';

export interface FileDates {
  created: string; // YYYY-MM-DD
  changed: string; // YYYY-MM-DD
}

let cache: Map<string, FileDates> | null = null;

function load(): Map<string, FileDates> {
  const map = new Map<string, FileDates>();
  let out = '';
  try {
    out = execFileSync('git', ['log', '--format=%x00%cs', '--name-only', '--', 'content/nodes'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return map;
  }
  // newest commit first: the first date seen for a file is its last change, the last one its creation
  for (const block of out.split('\0').slice(1)) {
    const [date, ...files] = block.trim().split('\n');
    for (const f of files.map((x) => x.trim()).filter(Boolean)) {
      const d = map.get(f);
      if (d) d.created = date;
      else map.set(f, { created: date, changed: date });
    }
  }
  return map;
}

/** Dates for a repository-relative path such as "content/nodes/fizik/fizik.yaml". */
export function datesOf(file: string): FileDates | undefined {
  cache ??= load();
  return cache.get(file.replace(/^\//, ''));
}
