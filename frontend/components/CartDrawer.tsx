'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { rupees } from '@/lib/api';
import { VegMark } from './Header';
import { CloseIcon } from './Icons';
import { useCart, useLang, useShop } from './Providers';
import QtyStepper from './QtyStepper';

/** Slide-over cart: edit quantities without leaving the page, then continue to checkout. */
export default function CartDrawer() {
  const { cartOpen, setCartOpen, cfg } = useShop();
  const { lines, count, subtotalPaise, clear } = useCart();
  const { pick, t } = useLang();
  const router = useRouter();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!cartOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCartOpen(false);
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [cartOpen, setCartOpen]);

  if (!cartOpen) return null;
  const tax = Math.round((subtotalPaise * (cfg?.taxPercent ?? 0)) / 100);
  const go = () => { setCartOpen(false); router.push('/cart'); };

  return (
    <div className="drawer-back" onClick={() => setCartOpen(false)}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Your cart" tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <h2>{t('your_cart')} {count > 0 && <span className="muted small">({count} {count === 1 ? 'item' : 'items'})</span>}</h2>
          <button className="icon-btn" onClick={() => setCartOpen(false)} aria-label="Close cart"><CloseIcon /></button>
        </header>

        {lines.length === 0 ? (
          <div className="drawer-empty">
            <div className="empty-art" aria-hidden="true">🍽️</div>
            <h3>{t('empty_cart_t')}</h3>
            <p className="muted">{t('empty_cart_d')}</p>
            <Link href="/menu" className="btn btn-accent" onClick={() => setCartOpen(false)}>{t('browse_menu')}</Link>
          </div>
        ) : (
          <>
            <ul className="drawer-lines">
              {lines.map(({ item, qty }) => (
                <li key={item.id} className={item.isAvailable ? '' : 'line-off'}>
                  <div><VegMark /> <b>{pick(item.names)}</b>{!item.isAvailable && <em className="small"> (unavailable)</em>}<p className="muted small">{rupees(item.pricePaise)} each</p></div>
                  <QtyStepper item={item} size="sm" name={pick(item.names)} />
                  <strong>{rupees(item.pricePaise * qty)}</strong>
                </li>
              ))}
            </ul>
            <div className="drawer-foot">
              <dl className="bill">
                <div><dt>{t('item_total')}</dt><dd>{rupees(subtotalPaise)}</dd></div>
                {tax > 0 && <div><dt>Taxes</dt><dd>{rupees(tax)}</dd></div>}
                <div className="muted small"><dt>Delivery fee &amp; final total</dt><dd>at checkout</dd></div>
              </dl>
              <button className="btn btn-accent btn-lg btn-block" onClick={go}>{t('checkout_btn')} · {rupees(subtotalPaise + tax)}</button>
              <button className="link-btn" onClick={clear}>{t('clear_cart')}</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
