'use client';
import Image from 'next/image';
import { MenuItem, rupees } from '@/lib/api';
import { VegMark } from './Header';
import { useLang } from './Providers';
import QtyStepper from './QtyStepper';

/** Large feature card for the Chef's Special / Today's Special. */
export default function ChefFeature({ item, label, flip = false }: { item: MenuItem; label?: string; flip?: boolean }) {
  const { t, pick } = useLang();
  return (
    <div className={`feature-card ${flip ? 'flip' : ''}`}>
      <div className="feature-photo">
        <Image src={item.imageUrl} alt={pick(item.names)} fill sizes="(max-width: 900px) 100vw, 560px" />
      </div>
      <div className="feature-body">
        <span className="eyebrow">{label ?? t('chefs_special')}</span>
        <h2><VegMark /> {pick(item.names)}</h2>
        <p>{pick(item.descriptions)}</p>
        <p className="feature-price">{rupees(item.pricePaise)}</p>
        <div className="card-foot"><QtyStepper item={item} name={pick(item.names)} /></div>
      </div>
    </div>
  );
}
