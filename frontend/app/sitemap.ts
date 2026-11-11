import type { MetadataRoute } from 'next';
import { loadMenu } from '@/lib/menu-data';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages = ['', '/menu', '/about', '/specialities', '/gallery', '/contact', '/reservations'].map((p) => ({
    url: `${SITE}${p}`, lastModified: now, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.7,
  }));
  const menu = await loadMenu();
  const items = (menu ?? []).flatMap((c) => c.items).map((i) => ({
    url: `${SITE}/menu/${i.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.6,
  }));
  return [...pages, ...items];
}
