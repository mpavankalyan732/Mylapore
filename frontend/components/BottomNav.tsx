'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CartIcon, GridIcon, SearchIcon, UserIcon, HomeIcon } from './Icons';
import { useAuth, useCart, useLang, useShop } from './Providers';

const HIDE = ['/kitchen', '/pay'];

/** App-style bottom navigation, mobile only. */
export default function BottomNav() {
  const path = usePathname();
  const { count } = useCart();
  const { user } = useAuth();
  const { setCartOpen } = useShop();
  const { t } = useLang();
  if (HIDE.some((h) => path.startsWith(h))) return null;
  const on = (p: string) => (p === '/' ? path === '/' : path.startsWith(p));
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <Link href="/" className={on('/') ? 'on' : ''}><HomeIcon /><span>{t('nav_home')}</span></Link>
      <Link href="/menu" className={on('/menu') ? 'on' : ''}><GridIcon /><span>{t('nav_menu')}</span></Link>
      <button onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); document.getElementById('q')?.focus(); }}><SearchIcon /><span>{t('search')}</span></button>
      <button onClick={() => setCartOpen(true)} className="bn-cart"><CartIcon />{count > 0 && <b>{count}</b>}<span>{t('nav_cart')}</span></button>
      <Link href={user ? '/orders' : '/signin'} className={on('/orders') || on('/signin') ? 'on' : ''}><UserIcon /><span>{user ? t('my_orders') : t('sign_in')}</span></Link>
    </nav>
  );
}
