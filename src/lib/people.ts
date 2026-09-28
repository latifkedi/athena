// People named on nodes (the `people:` list). A name may be written "Turkish / English", e.g.
// "Gazzâlî / al-Ghazālī"; entries whose Turkish part is the same are one person.
import { allNodes } from './data';
import type { L10n, NodeData } from './data';

export interface Person {
  slug: string;
  name: L10n;
  nodes: NodeData[];
}

const TR_MAP: Record<string, string> = { ı: 'i', İ: 'i', ş: 's', ğ: 'g', ç: 'c', ö: 'o', ü: 'u', ʿ: '', ʾ: '', "'": '' };

export function personSlug(name: string): string {
  const tr = name.split(' / ')[0].replace(/\(.*?\)/g, '');
  return tr
    .replace(/[ıİşğçöüʿʾ']/g, (c) => TR_MAP[c] ?? c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function build(): Map<string, Person> {
  const map = new Map<string, Person>();
  for (const n of allNodes) {
    for (const raw of n.people) {
      const slug = personSlug(raw);
      if (!slug) continue;
      const [tr, en] = raw.split(' / ').map((s) => s.trim());
      let p = map.get(slug);
      if (!p) {
        p = { slug, name: { tr: tr.replace(/\s*\(.*?\)\s*/g, ' ').trim(), en: en ?? tr }, nodes: [] };
        map.set(slug, p);
      }
      // keep the fullest English form, e.g. "Ibn Sīnā (Avicenna)" over "Ibn Sīnā"
      if (en && en.length > p.name.en.length) p.name.en = en;
      if (!p.nodes.includes(n)) p.nodes.push(n);
    }
  }
  const year = (n: NodeData) => n.date?.year ?? Number.POSITIVE_INFINITY;
  for (const p of map.values()) p.nodes.sort((a, b) => year(a) - year(b));
  return map;
}

export const people = build();
export const allPeople = [...people.values()].sort((a, b) => a.name.tr.localeCompare(b.name.tr, 'tr'));

/** People who appear on the same nodes as this person, most shared nodes first. */
export function companions(p: Person, max = 12): Person[] {
  const count = new Map<string, number>();
  for (const n of p.nodes)
    for (const raw of n.people) {
      const s = personSlug(raw);
      if (s !== p.slug) count.set(s, (count.get(s) ?? 0) + 1);
    }
  return [...count]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([s]) => people.get(s)!)
    .filter(Boolean);
}
