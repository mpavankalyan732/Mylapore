'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LANGS, Lang } from '@/lib/i18n';
import { CartIcon, ChevronDown, GlobeIcon, MoonIcon, PinIcon, SunIcon } from './Icons';
import Logo from './Logo';
import SearchBox from './SearchBox';
import { useAuth, useCart, useLang, useShop, useTheme } from './Providers';

export function VegMark({ title = 'Vegetarian' }: { title?: string }) {
  return (
    <span className="veg-mark" role="img" aria-label={title} title={title}>
      <span />
    </span>
  );
}

export default function Header() {
  const { t, lang, setLang } = useLang();
  const { count } = useCart();
  const { user, logout, ready } = useAuth();
  const { theme, toggle } = useTheme();
  const { pincode, serviceable, setLocationOpen, setCartOpen } = useShop();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="Mylapore Restaurant, home"><Logo /></Link>

        <button className="loc-pill" onClick={() => setLocationOpen(true)}>
          <PinIcon width={18} height={18} />
          <span className="loc-text">
            <small>{t('deliver_to')}</small>
            <b>{pincode ? `${pincode}${serviceable === false ? ' (outside area)' : ''}` : t('set_location')}</b>
          </span>
          <ChevronDown width={14} height={14} />
        </button>

        <SearchBox />

        <div className="header-actions">
          <label className="icon-btn lang" title="Language">
            <GlobeIcon />
            <span className="sr-only">Language</span>
            <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label="Language">
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>
          <button className="icon-btn" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Theme">
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button className="icon-btn cart-link" onClick={() => setCartOpen(true)} aria-label={`${t('nav_cart')} (${count})`} aria-haspopup="dialog">
            <CartIcon />
            {count > 0 && <span className="cart-badge" key={count}>{count}</span>}
          </button>
          <Link href="/orders" className="link-btn hide-sm">{t('my_orders')}</Link>
          {ready && user ? (
            <details className="user-menu">
              <summary className="link-btn">{user.firstName} <ChevronDown width={14} height={14} /></summary>
              <div className="menu-pop">
                <Link href="/orders">{t('my_orders')}</Link>
                <button onClick={() => { logout(); router.push('/'); }}>{t('sign_out')}</button>
              </div>
            </details>
          ) : (
            <>
              <Link href="/signin" className="link-btn">{t('sign_in')}</Link>
              <Link href="/signup" className="btn btn-accent btn-sm hide-sm">{t('create_account')}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
