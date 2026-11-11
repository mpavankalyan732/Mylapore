'use client';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DICT, Key, Lang, LANGS } from '@/lib/i18n';
import { api, AuthUser, Category, MenuItem, Names, PublicConfig, TOKEN_KEY } from '@/lib/api';

// ---------------------------------------------------------------- language
interface LangCtx { lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string; pick: (n: Names) => string }
const LanguageContext = createContext<LangCtx>(null as never);
export const useLang = () => useContext(LanguageContext);

// ---------------------------------------------------------------- cart
export interface CartLine { item: MenuItem; qty: number }
interface CartCtx {
  lines: CartLine[]; count: number; subtotalPaise: number; qtyOf: (id: string) => number;
  add: (i: MenuItem) => void; dec: (id: string) => void; remove: (id: string) => void; clear: () => void;
  markUnavailable: (ids: string[]) => void;
}
const CartContext = createContext<CartCtx>(null as never);
export const useCart = () => useContext(CartContext);

// ---------------------------------------------------------------- auth
interface AuthCtx { user: AuthUser | null; ready: boolean; setSession: (token: string, user: AuthUser) => void; logout: () => void }
const AuthContext = createContext<AuthCtx>(null as never);
export const useAuth = () => useContext(AuthContext);

// ---------------------------------------------------------------- theme
type Theme = 'light' | 'dark';
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>(null as never);
export const useTheme = () => useContext(ThemeContext);

// ---------------------------------------------------------------- shop (public config, menu, delivery location)
interface ShopCtx {
  cfg: PublicConfig | null; menu: Category[]; loaded: boolean; pincode: string; setPincode: (p: string) => void;
  serviceable: boolean | null; locationOpen: boolean; setLocationOpen: (o: boolean) => void;
  cartOpen: boolean; setCartOpen: (o: boolean) => void;
  sheet: MenuItem | null; openSheet: (i: MenuItem) => void; closeSheet: () => void;
}
const ShopContext = createContext<ShopCtx>(null as never);
export const useShop = () => useContext(ShopContext);

// ---------------------------------------------------------------- toasts
export interface ToastAction { label: string; onClick: () => void }
const ToastContext = createContext<{ toast: (msg: string, action?: ToastAction) => void }>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

export default function Providers({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [theme, setTheme] = useState<Theme>('light');
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [menu, setMenu] = useState<Category[]>([]);
  const [pincode, setPincodeState] = useState('');
  const [locationOpen, setLocationOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [sheet, setSheet] = useState<MenuItem | null>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string; action?: ToastAction }[]>([]);

  useEffect(() => {
    try {
      const l = localStorage.getItem('lang') as Lang | null;
      if (l && LANGS.some((x) => x.code === l)) setLangState(l);
      setLines(JSON.parse(localStorage.getItem('cart') ?? '[]'));
      setPincodeState(localStorage.getItem('pincode') ?? '');
      setTheme((document.documentElement.dataset.theme as Theme) === 'dark' ? 'dark' : 'light');
      if (localStorage.getItem(TOKEN_KEY)) {
        api<AuthUser>('/auth/me').then(setUser).catch(() => localStorage.removeItem(TOKEN_KEY));
      }
    } catch {}
    api<PublicConfig>('/menu/config').then(setCfg).catch(() => {});
    api<Category[]>('/menu').then(setMenu).catch(() => {}).finally(() => setLoaded(true));
    setReady(true);
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {
    if (ready) try { localStorage.setItem('cart', JSON.stringify(lines)); } catch {}
  }, [lines, ready]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('lang', l); } catch {}
  }, []);

  const langValue = useMemo<LangCtx>(
    () => ({ lang, setLang, t: (k) => (DICT[lang][k] ?? DICT.en[k]) as string, pick: (n) => n?.[lang] || n?.en || '' }),
    [lang, setLang],
  );

  const cartValue = useMemo<CartCtx>(
    () => ({
      lines,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotalPaise: lines.reduce((s, l) => s + l.item.pricePaise * l.qty, 0),
      qtyOf: (id) => lines.find((l) => l.item.id === id)?.qty ?? 0,
      add: (item) =>
        setLines((cur) => {
          const f = cur.find((l) => l.item.id === item.id);
          return f ? cur.map((l) => (l.item.id === item.id ? { ...l, qty: Math.min(50, l.qty + 1) } : l)) : [...cur, { item, qty: 1 }];
        }),
      dec: (id) => setLines((cur) => cur.flatMap((l) => (l.item.id !== id ? [l] : l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : []))),
      remove: (id) => setLines((cur) => cur.filter((l) => l.item.id !== id)),
      clear: () => setLines([]),
      markUnavailable: (ids) => setLines((cur) => cur.map((l) => (ids.includes(l.item.id) ? { ...l, item: { ...l.item, isAvailable: false } } : l))),
    }),
    [lines],
  );

  const authValue = useMemo<AuthCtx>(
    () => ({
      user, ready,
      setSession: (token, u) => { try { localStorage.setItem(TOKEN_KEY, token); } catch {} setUser(u); },
      logout: () => { try { localStorage.removeItem(TOKEN_KEY); } catch {} setUser(null); },
    }),
    [user, ready],
  );

  const themeValue = useMemo(
    () => ({
      theme,
      toggle: () => {
        const next: Theme = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem('theme', next); } catch {}
      },
    }),
    [theme],
  );

  const shopValue = useMemo<ShopCtx>(
    () => ({
      cfg, menu, loaded, pincode,
      setPincode: (p) => { setPincodeState(p); try { localStorage.setItem('pincode', p); } catch {} },
      serviceable: pincode.length === 6 && cfg ? cfg.servicePincodes.includes(pincode) : null,
      locationOpen, setLocationOpen, cartOpen, setCartOpen,
      sheet, openSheet: setSheet, closeSheet: () => setSheet(null),
    }),
    [cfg, menu, loaded, pincode, locationOpen, cartOpen, sheet],
  );

  const toastValue = useMemo(
    () => ({
      toast: (msg: string, action?: ToastAction) => {
        const id = Date.now() + Math.random();
        setToasts([{ id, msg, action }]); // one toast at a time: a new one replaces the old, never stacks over content
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
      },
    }),
    [],
  );

  return (
    <ThemeContext.Provider value={themeValue}>
      <LanguageContext.Provider value={langValue}>
        <AuthContext.Provider value={authValue}>
          <ShopContext.Provider value={shopValue}>
            <CartContext.Provider value={cartValue}>
              <ToastContext.Provider value={toastValue}>
                {children}
                <div className="toasts" role="status" aria-live="polite">
                  {toasts.map((t) => (
                    <div key={t.id} className="toast">
                      <span>{t.msg}</span>
                      {t.action && <button onClick={t.action.onClick}>{t.action.label}</button>}
                    </div>
                  ))}
                </div>
              </ToastContext.Provider>
            </CartContext.Provider>
          </ShopContext.Provider>
        </AuthContext.Provider>
      </LanguageContext.Provider>
    </ThemeContext.Provider>
  );
}
