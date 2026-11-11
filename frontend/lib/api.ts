export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';
export const SITE_NAME = process.env.NEXT_PUBLIC_RESTAURANT_NAME ?? 'Mylapore Restaurant';

export type Names = Record<'en' | 'te' | 'ta' | 'kn' | 'hi', string>;

export interface MenuItem {
  id: string; slug: string; names: Names; descriptions: Names; pricePaise: number; imageUrl: string;
  isAvailable: boolean; isJain: boolean; isVegan: boolean; isSpicy: boolean; isBestseller: boolean;
  cuisine?: string | null; tags: string[]; ingredients?: string | null; allergens: string[];
  nutrition?: Record<string, string | number> | null; spiceLevel?: string | null;
}
export interface ItemDetail extends MenuItem { category: { slug: string; names: Names } }
export interface AuthUser { id: string; firstName: string; lastName: string; email: string | null; phone: string | null }
export interface Category { id: string; slug: string; names: Names; items: MenuItem[] }
export interface PublicConfig { taxPercent: number; deliveryFeePaise: number; codEnabled: boolean; paymentProvider: string; servicePincodes: string[]; googleClientId: string | null }

export class ApiError extends Error {
  constructor(public status: number, public body: any) {
    super(body?.message ?? `HTTP ${status}`);
  }
}

export const TOKEN_KEY = 'authToken';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let auth: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    try {
      const t = localStorage.getItem(TOKEN_KEY);
      if (t) auth = { Authorization: `Bearer ${t}` };
    } catch {}
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...auth, ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const rupees = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100);

/** Only follow checkout URLs that are https (or http on localhost for the demo gateway). The API already validates hosts. */
export function isSafeCheckoutUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    return u.protocol === 'https:' || (local && u.protocol === 'http:');
  } catch {
    return false;
  }
}

// Guest order tokens live in this browser only (needed for tracking / Agentforce handoff).
export function saveOrderToken(orderNumber: string, token: string) {
  try {
    const all = JSON.parse(localStorage.getItem('orderTokens') ?? '{}');
    all[orderNumber] = token;
    localStorage.setItem('orderTokens', JSON.stringify(all));
  } catch {}
}
export function getOrderToken(orderNumber: string): string | null {
  try {
    return JSON.parse(localStorage.getItem('orderTokens') ?? '{}')[orderNumber] ?? null;
  } catch {
    return null;
  }
}
