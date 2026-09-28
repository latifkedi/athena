// Guided walks along the tree (content/journeys.yaml). Steps point to nodes; check-content.mjs
// makes sure every step's node exists.
import * as yaml from 'js-yaml';
import type { L10n } from './data';

export interface Journey {
  id: string;
  title: L10n;
  intro: L10n;
  steps: { node: string; text: L10n }[];
}

const raw = import.meta.glob('/content/journeys.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const text = Object.values(raw)[0] ?? '';
export const journeys: Journey[] = text.trim() ? ((yaml.load(text) as Journey[]) ?? []) : [];

export const getJourney = (id: string): Journey | undefined => journeys.find((j) => j.id === id);

/** Journeys that pass through a node, with the step number (1-based). */
export function journeysThrough(nodeId: string): { journey: Journey; step: number }[] {
  return journeys.flatMap((j) => {
    const i = j.steps.findIndex((s) => s.node === nodeId);
    return i >= 0 ? [{ journey: j, step: i + 1 }] : [];
  });
}
