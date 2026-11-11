'use client';
import Image from 'next/image';
import { useState } from 'react';
import { ItemDetail, rupees } from '@/lib/api';
import { VegMark } from './Header';
import { CloseIcon, PinIcon, StarIcon } from './Icons';
import { useLang, useShop } from './Providers';
import QtyStepper from './QtyStepper';

const CUISINE: Record<string, string> = { SOUTH_INDIAN: 'South Indian', NORTH_INDIAN: 'North Indian', CHINESE: 'Chinese Vegetarian' };
const TAG_LABEL: Record<string, string> = { 'south-indian-rice': 'Goes with rice', 'north-indian-roti': 'Goes with roti', 'idli-dosa': 'Goes with idli & dosa' };

/** Item detail: zoomable photo, delivery status, dietary chips, add-to-cart stepper, ingredients, nutrition, reviews. */
export default function ItemPanel({ item }: { item: ItemDetail }) {
  const { pick, t } = useLang();
  const { pincode, serviceable, setLocationOpen } = useShop();
  const [zoom, setZoom] = useState(false);
  const name = pick(item.names);
  const nutrition = item.nutrition && Object.keys(item.nutrition).length ? item.nutrition : null;

  return (
    <div className="item-grid">
      <div>
        <button className="item-photo" onClick={() => setZoom(true)} aria-label={`Click to zoom: ${name}`}>
          <Image src={item.imageUrl} alt={name} fill priority sizes="(max-width: 900px) 100vw, 560px" />
          <span className="zoom-hint">Click to zoom</span>
        </button>
        <blockquote className="item-quote">“Authentic South Indian flavours, cooked fresh and 100% vegetarian.”<cite>Mylapore Restaurant</cite></blockquote>
      </div>

      <div className="item-info">
        <h1><VegMark /> {name}</h1>
        <p className="lead muted">{pick(item.descriptions)}</p>
        <p className="item-price">{rupees(item.pricePaise)}</p>

        <button className="loc-line" onClick={() => setLocationOpen(true)}>
          <PinIcon width={16} height={16} />
          {!pincode ? 'Set delivery location for availability' : serviceable ? `Delivers to ${pincode}` : serviceable === false ? `${pincode} is outside our delivery area (dine-in and takeaway available)` : `Checking ${pincode}…`}
        </button>

        <div className="chips">
          {item.cuisine && CUISINE[item.cuisine] && <span className="chip">{CUISINE[item.cuisine]}</span>}
          <span className="chip chip-green">{t('vegetarian')}</span>
          {item.isVegan && <span className="chip chip-green">{t('vegan')}</span>}
          {item.isJain && <span className="chip chip-green">Jain</span>}
          {item.spiceLevel && <span className="chip">{item.spiceLevel}</span>}
          {item.tags.map((t) => <span key={t} className="chip">{TAG_LABEL[t] ?? t}</span>)}
        </div>

        <div className="item-buy"><QtyStepper item={item} name={name} /></div>

        {item.allergens.length > 0 && (
          <p className="contains"><strong>{t('contains')}</strong> {item.allergens.map((a) => <span key={a} className="chip chip-warn">{a}</span>)}</p>
        )}
        <p className="muted small">Allergen and ingredient details are being confirmed by our kitchen. Please ask our team about any allergies before ordering.</p>

        <details className="acc" open>
          <summary>{t('ingredients')}</summary>
          <p>{item.ingredients ?? 'Ingredient list coming soon.'}</p>
        </details>
        <details className="acc" open>
          <summary>Nutrition{typeof nutrition?.servingSize === 'string' ? ` per serving · ${nutrition.servingSize}` : ''}</summary>
          {nutrition ? (
            <dl className="nutri">{Object.entries(nutrition).filter(([k]) => k !== 'servingSize').map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl>
          ) : (
            <p className="muted">Nutrition information is being prepared and will be added once it has been verified.</p>
          )}
        </details>
        <details className="acc" open>
          <summary>{t('reviews')}</summary>
          <div className="reviews">
            <b>0.0</b>
            <span className="stars" role="img" aria-label="0 out of 5 stars">{[0, 1, 2, 3, 4].map((n) => <StarIcon key={n} width={18} height={18} />)}</span>
            <span className="muted">(0 reviews)</span>
          </div>
        </details>
      </div>

      {zoom && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={name} onClick={() => setZoom(false)}>
          <button className="lb-close" onClick={() => setZoom(false)} aria-label="Close"><CloseIcon /></button>
          <div className="lb-img" onClick={(e) => e.stopPropagation()}><Image src={item.imageUrl} alt={name} fill sizes="90vw" /></div>
        </div>
      )}
    </div>
  );
}
