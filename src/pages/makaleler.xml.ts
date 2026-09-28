import type { APIContext } from 'astro';
import { papersFeed } from '../lib/rss';
export const GET = (ctx: APIContext) => papersFeed(ctx, 'tr');
