'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { rupees } from '@/lib/api';
import { VegMark } from './Header';
import { CloseIcon } from './Icons';
import { useCart, useLang, useShop } from './Providers';
import QtyStepper from './QtyStepper';

/** Quick-view bottom sheet (mobile) / modal (desktop). Keeps the shopper in context; full page is one tap away. */
export default function ItemSheet() {
  const { sheet, closeSheet } = useShop();
  const { pick, t } = useLang();
  const { qtyOf } = useCart();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sheet) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSheet();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),[tabindex="0"]');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [sheet, closeSheet]);

  if (!sheet) return null;
  const name = pick(sheet.names);
  const qty = qtyOf(sheet.id);
  return (
    <div className="sheet-back" onClick={closeSheet}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={name} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={closeSheet} aria-label="Close"><CloseIcon /></button>
        <div className="sheet-photo"><Image src={sheet.imageUrl} alt={name} fill sizes="(max-width: 700px) 100vw, 460px" /></div>
        <div className="sheet-body">
          <h2><VegMark /> {name}</h2>
          <p className="price-lg">{rupees(sheet.pricePaise)}</p>
          <p className="muted">{pick(sheet.descriptions)}</p>
          <div className="chips">
            <span className="chip chip-green">{t('vegetarian')}</span>
            {sheet.isVegan && <span className="chip chip-green">{t('vegan')}</span>}
            {sheet.isJain && <span className="chip chip-green">{t('jain')}</span>}
            {sheet.spiceLevel && <span className="chip">{sheet.spiceLevel}</span>}
          </div>
          {sheet.allergens.length > 0 && <p className="small"><strong>{t('contains')}:</strong> {sheet.allergens.join(', ')}</p>}
          {sheet.ingredients && <p className="small muted"><strong>{t('ingredients')}:</strong> {sheet.ingredients}</p>}
          <p className="small muted">Details are being confirmed by our kitchen. Please ask about allergies.</p>
          <Link href={`/menu/${sheet.slug}`} className="link-btn" onClick={closeSheet}>{t('view_full')} →</Link>
        </div>
        <div className="sheet-foot">
          <QtyStepper item={sheet} name={name} />
          {qty > 0 && <strong className="sheet-total">{rupees(sheet.pricePaise * qty)}</strong>}
        </div>
      </div>
    </div>
  );
}
