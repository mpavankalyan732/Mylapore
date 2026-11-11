'use client';
import Image from 'next/image';
import Link from 'next/link';
import { MouseEvent } from 'react';
import { MenuItem, rupees } from '@/lib/api';
import { VegMark } from './Header';
import { useLang, useShop } from './Providers';
import QtyStepper from './QtyStepper';

/** Image-first dish card: ADD pill overlaps the photo; tapping the photo/name opens the quick-view sheet. */
export default function MenuCard({ item, priority = false }: { item: MenuItem; priority?: boolean; categorySlug?: string }) {
  const { t, pick } = useLang();
  const { openSheet } = useShop();
  const name = pick(item.names);
  // Plain click opens the sheet; ctrl/cmd/middle-click still follow the real link (SEO + open in new tab).
  const open = (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    openSheet(item);
  };

  return (
    <article className={`card ${item.isAvailable ? '' : 'card-off'}`}>
      <div className="card-media">
        <Link href={`/menu/${item.slug}`} className="card-img" onClick={open}>
          <Image src={item.imageUrl} alt={name} fill priority={priority} sizes="(max-width: 600px) 60vw, (max-width: 1000px) 33vw, 230px" />
          <span className="img-shade" aria-hidden="true" />
          {item.isBestseller && <span className="ribbon">★ {t('bestseller')}</span>}
        </Link>
        <div className="add-overlay"><QtyStepper item={item} size="sm" name={name} variant="overlay" /></div>
      </div>
      <div className="card-body">
        <h3><VegMark /> <Link href={`/menu/${item.slug}`} onClick={open}>{name}</Link></h3>
        <div className="meta"><strong className="price">{rupees(item.pricePaise)}</strong>{item.isSpicy && <span className="dot-tag">🌶 {t('spicy')}</span>}{item.isJain && <span className="dot-tag">{t('jain')}</span>}</div>
        <p className="muted clamp-2">{pick(item.descriptions)}</p>
      </div>
    </article>
  );
}
