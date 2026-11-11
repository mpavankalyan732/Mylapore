import { api, Category, MenuItem } from './api';

/** Fetch the live menu from the API; returns null when the API is unreachable. */
export async function loadMenu(): Promise<Category[] | null> {
  try {
    return await api<Category[]>('/menu');
  } catch {
    return null;
  }
}

export function bySlugs(menu: Category[] | null, slugs: string[]): MenuItem[] {
  const all = new Map((menu ?? []).flatMap((c) => c.items).map((i) => [i.slug, i]));
  return slugs.map((s) => all.get(s)).filter((i): i is MenuItem => !!i);
}

export const allItems = (menu: Category[] | null): MenuItem[] => (menu ?? []).flatMap((c) => c.items);
