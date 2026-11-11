import type { Metadata } from 'next';
import RestaurantMenu from '@/components/RestaurantMenu';
import { loadMenu } from '@/lib/menu-data';

export const metadata: Metadata = { title: 'Menu', description: 'Pure vegetarian South Indian breakfast, dosas, meals, North Indian, Chinese vegetarian, juices and sweets.' };
export const dynamic = 'force-dynamic';

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ cat?: string; q?: string }> }) {
  const { cat, q } = await searchParams;
  const menu = await loadMenu();
  const initialCat = menu?.some((c) => c.slug === cat) ? (cat as string) : '';
  return <RestaurantMenu key={`${initialCat}|${q ?? ''}`} categories={menu} initialCat={initialCat} initialQ={q ?? ''} />;
}
