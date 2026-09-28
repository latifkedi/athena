import type { APIContext } from 'astro';
import { updatesFeed } from '../lib/rss';
export const GET = (ctx: APIContext) => updatesFeed(ctx, 'tr');
