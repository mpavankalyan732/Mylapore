'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Category, rupees } from '@/lib/api';
import MenuCard from './MenuCard';
import { useCart, useLang } from './Providers';
import Reveal from './Reveal';
import SectionTitle from './SectionTitle';

export default function MenuBrowser({ categories, initial = 'all' }: { categories: Category[] | null; initial?: string }) {
  const { t, pick } = useLang();
  const { count, subtotalPaise } = useCart();
  const [active, setActive] = useState<string>(initial);

  if (!categories) {
    return (
      <div className="container section">
        <p role="alert" className="alert">Menu is temporarily unavailable. Please try again shortly.</p>
      </div>
    );
  }
  const shown = active === 'all' ? categories : categories.filter((c) => c.slug === active);

  return (
    <>
      <div className="page-hero">
        <div className="container">
          <SectionTitle light eyebrow="100% Pure Vegetarian" title={t('menu_title')} sub={t('demo_prices')} />
        </div>
      </div>
      <div className="container section">
        <div className="tabs" role="tablist" aria-label="Categories">
          <button role="tab" aria-selected={active === 'all'} className={active === 'all' ? 'tab on' : 'tab'} onClick={() => setActive('all')}>
            {t('all')}
          </button>
          {categories.map((c) => (
            <button key={c.id} role="tab" aria-selected={active === c.slug} className={active === c.slug ? 'tab on' : 'tab'} onClick={() => setActive(c.slug)}>
              {pick(c.names)}
            </button>
          ))}
        </div>
        {shown.map((c) => (
          <section key={c.id} aria-labelledby={`cat-${c.slug}`} className="menu-cat">
            <h2 id={`cat-${c.slug}`} className="menu-cat-title"><span>{pick(c.names)}</span></h2>
            <div className="grid">
              {c.items.map((i, n) => (
                <Reveal key={i.id} delay={(n % 4) * 70}><MenuCard item={i} /></Reveal>
              ))}
            </div>
          </section>
        ))}
        {count > 0 && (
          <Link href="/cart" className="floating-cart">
            🛒 {count} · {rupees(subtotalPaise)} → {t('nav_cart')}
          </Link>
        )}
      </div>
    </>
  );
}
