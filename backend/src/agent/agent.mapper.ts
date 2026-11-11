import { Category, MenuItem } from '@prisma/client';

type Names = Record<string, string>;
export interface CategoryRef { id: string; slug: string; names: unknown }

export const toRupees = (paise: number) => Math.round(paise) / 100;
const names = (v: unknown) => (v ?? {}) as Names;
export const absoluteUrl = (url: string, base: string) => (url.startsWith('/') ? `${base.replace(/\/$/, '')}${url}` : url);

/** One dish, in the shape Salesforce consumes. Money is given both in rupees (number) and paise (integer). */
export function mapItem(i: MenuItem, cat: CategoryRef, base: string) {
  const n = names(i.names);
  const d = names(i.descriptions);
  return {
    id: i.id,
    slug: i.slug,
    name: n.en,
    description: d.en,
    nameTranslations: n,
    descriptionTranslations: d,
    category: { id: cat.id, slug: cat.slug, name: names(cat.names).en },
    subcategory: null as string | null, // the menu has no subcategories today
    price: toRupees(i.pricePaise),
    pricePaise: i.pricePaise,
    currency: 'INR',
    isAvailable: i.isAvailable,
    isBestseller: i.isBestseller,
    imageUrl: absoluteUrl(i.imageUrl, base),
    dietary: { vegetarian: true, vegan: i.isVegan, jain: i.isJain }, // every dish is vegetarian
    spiceLevel: i.spiceLevel,
    cuisine: i.cuisine,
    tags: i.tags,
    ingredients: i.ingredients, // DRAFT until the kitchen confirms
    allergens: i.allergens, // DRAFT until the kitchen confirms
    nutrition: i.nutrition ?? null,
    customizations: [] as unknown[], // no structured options exist; free-text notes are accepted per ordered item
    allowsNotes: true,
  };
}

export function mapCategory(c: Category & { items: MenuItem[] }, base: string) {
  const first = c.items.find((i) => i.isAvailable) ?? c.items[0];
  return {
    id: c.id,
    slug: c.slug,
    name: names(c.names).en,
    nameTranslations: names(c.names),
    description: null as string | null,
    imageUrl: first ? absoluteUrl(first.imageUrl, base) : null, // image of the first dish in the category
    itemCount: c.items.length,
    availableItemCount: c.items.filter((i) => i.isAvailable).length,
    subcategories: [] as unknown[], // none defined in the menu
  };
}

export const STATUS_MESSAGE: Record<string, string> = {
  PENDING_PAYMENT: 'Waiting for online payment. The order is not sent to the kitchen until the payment is confirmed.',
  CONFIRMED: 'Order confirmed and waiting for the kitchen.',
  PREPARING: 'The kitchen is preparing your order.',
  READY: 'Your order is ready.',
  OUT_FOR_DELIVERY: 'Your order is out for delivery.',
  COMPLETED: 'Your order has been completed.',
  CANCELLED: 'This order was cancelled.',
  PAYMENT_FAILED: 'The payment failed, so the order was not placed.',
  EXPIRED: 'The payment was not completed in time, so the order expired.',
};

export const RESERVATION_MESSAGE: Record<string, string> = {
  REQUESTED: 'Reservation request received. The restaurant will confirm it.',
  CONFIRMED: 'Reservation confirmed.',
  CANCELLED: 'This reservation was cancelled.',
};
