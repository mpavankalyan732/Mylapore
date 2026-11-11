'use client';
import Image from 'next/image';
import { MenuItem, rupees } from '@/lib/api';
import { VegMark } from './Header';
import { useLang, useShop } from './Providers';
import QtyStepper from './QtyStepper';

/** Restaurant-menu row (text left, photo right with overlapping ADD), as on Swiggy/Zomato restaurant pages. */
export default function MenuRow({ item, priority = false }: { item: MenuItem; priority?: boolean }) {
  const { t, pick } = useLang();
  const { openSheet } = useShop();
  const name = pick(item.names);
  return (
    <article className={`mrow ${item.isAvailable ? '' : 'card-off'}`}>
      <div className="mrow-info">
        <div className="mrow-tags">
          <VegMark />
          {item.isBestseller && <span className="best-tag">★ {t('bestseller')}</span>}
          {item.isSpicy && <span className="dot-tag">🌶 {t('spicy')}</span>}
          {item.isVegan && <span className="dot-tag">Vegan</span>}
          {item.isJain && <span className="dot-tag">{t('jain')}</span>}
        </div>
        <h3><button className="plain" onClick={() => openSheet(item)}>{name}</button></h3>
        <p className="price">{rupees(item.pricePaise)}</p>
        <p className="muted clamp-2">{pick(item.descriptions)}</p>
        <button className="more" onClick={() => openSheet(item)}>More details</button>
      </div>
      <div className="mrow-media">
        <button className="mrow-img" onClick={() => openSheet(item)} aria-label={`View ${name}`}>
          <Image src={item.imageUrl} alt={name} fill priority={priority} sizes="156px" />
        </button>
        <div className="add-overlay"><QtyStepper item={item} size="sm" name={name} variant="overlay" /></div>
      </div>
    </article>
  );
}
