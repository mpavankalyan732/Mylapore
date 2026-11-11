'use client';
import { useEffect, useMemo, useState } from 'react';
import { Category, MenuItem } from '@/lib/api';
import { FilterIcon } from './Icons';
import MenuRow from './MenuRow';
import { useLang } from './Providers';

type Sort = 'recommended' | 'price-asc' | 'price-desc';
const DIETARY = [
  { key: 'vegetarian', label: 'vegetarian' as const, test: () => true }, // every dish at Mylapore is vegetarian
  { key: 'vegan', label: 'vegan' as const, test: (i: MenuItem) => i.isVegan },
  { key: 'jain', label: 'jain' as const, test: (i: MenuItem) => i.isJain },
];
const TAGS = [
  { key: 'south-indian-rice', label: 'South Indian · goes with rice' },
  { key: 'north-indian-roti', label: 'North Indian · goes with roti' },
  { key: 'idli-dosa', label: 'Goes with idli & dosa' },
];

/**
 * Restaurant-page layout: sticky category index (scroll-synced) | dish rows | filters on the right.
 * Choosing a sort order switches to one flat price-ordered list, because grouping would hide the order.
 */
export default function RestaurantMenu({ categories, initialCat = '', initialQ = '' }: { categories: Category[] | null; initialCat?: string; initialQ?: string }) {
  const { pick, t } = useLang();
  const [sort, setSort] = useState<Sort>('recommended');
  const [diet, setDiet] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [activeSec, setActiveSec] = useState(initialCat);
  const q = initialQ.trim().toLowerCase();

  const passes = (i: MenuItem) =>
    (!q || Object.values(i.names).concat(Object.values(i.descriptions)).some((s) => s.toLowerCase().includes(q))) &&
    diet.every((d) => DIETARY.find((x) => x.key === d)!.test(i)) &&
    (!tags.length || tags.some((t) => i.tags.includes(t)));

  const groups = useMemo(() => (categories ?? []).map((c) => ({ c, items: c.items.filter(passes) })).filter((g) => g.items.length), [categories, q, diet, tags]); // eslint-disable-line react-hooks/exhaustive-deps
  const flat = useMemo(() => {
    const all = groups.flatMap((g) => g.items);
    return sort === 'price-asc' ? [...all].sort((a, b) => a.pricePaise - b.pricePaise) : sort === 'price-desc' ? [...all].sort((a, b) => b.pricePaise - a.pricePaise) : all;
  }, [groups, sort]);
  const grouped = sort === 'recommended' && !q;

  // Jump to the requested category on arrival.
  useEffect(() => {
    if (initialCat) document.getElementById(`sec-${initialCat}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [initialCat]);

  // Scroll-spy for the index.
  useEffect(() => {
    if (!grouped) return;
    const els = groups.map((g) => document.getElementById(`sec-${g.c.slug}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActiveSec(vis.target.id.replace('sec-', ''));
    }, { rootMargin: '-140px 0px -65% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [groups, grouped]);

  if (!categories) return <div className="container section"><p role="alert" className="alert">Menu is temporarily unavailable. Please try again shortly.</p></div>;

  const toggle = (arr: string[], set: (a: string[]) => void, k: string) => set(arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);
  const active = diet.length + tags.length + (sort !== 'recommended' ? 1 : 0);
  const clear = () => { setDiet([]); setTags([]); setSort('recommended'); };
  const total = flat.length;
  const title = q ? `Results for “${initialQ}”` : sort !== 'recommended' ? (sort === 'price-asc' ? 'Price: low to high' : 'Price: high to low') : 'Menu';

  return (
    <div className="container section rm-layout">
      <nav className="cat-index" aria-label="Menu categories">
        <h2>{t('nav_menu')}</h2>
        <ul>
          {(categories ?? []).map((c) => {
            const n = groups.find((g) => g.c.id === c.id)?.items.length ?? 0;
            return (
              <li key={c.id}>
                <a href={`#sec-${c.slug}`} className={activeSec === c.slug && grouped ? 'on' : ''} aria-current={activeSec === c.slug && grouped ? 'true' : undefined}
                  onClick={(e) => { if (!grouped) return; e.preventDefault(); document.getElementById(`sec-${c.slug}`)?.scrollIntoView({ behavior: 'smooth' }); setActiveSec(c.slug); }}>
                  <span>{pick(c.names)}</span><small>{n}</small>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="rm-main">
        <div className="menu-head">
          <div><h1>{title}</h1><p className="muted">{total} {total === 1 ? 'dish' : t('dishes')} · {t('pure_veg')}</p></div>
          <button className="btn btn-outline btn-sm filters-toggle" onClick={() => setOpen(true)}><FilterIcon width={16} height={16} /> {t('filters')}{active ? ` (${active})` : ''}</button>
        </div>

        <div className="quick-chips" role="group" aria-label="Quick filters">
          {DIETARY.filter((d) => d.key !== 'vegetarian').map((d) => (
            <button key={d.key} className={`qchip ${diet.includes(d.key) ? 'on' : ''}`} aria-pressed={diet.includes(d.key)} onClick={() => toggle(diet, setDiet, d.key)}>{t(d.label)}</button>
          ))}
          <button className={`qchip ${sort === 'price-asc' ? 'on' : ''}`} aria-pressed={sort === 'price-asc'} onClick={() => setSort(sort === 'price-asc' ? 'recommended' : 'price-asc')}>{t('price_low')}</button>
          <button className={`qchip ${sort === 'price-desc' ? 'on' : ''}`} aria-pressed={sort === 'price-desc'} onClick={() => setSort(sort === 'price-desc' ? 'recommended' : 'price-desc')}>{t('price_high')}</button>
          {active > 0 && <button className="qchip clear" onClick={clear}>Clear ✕</button>}
        </div>

        {total === 0 ? (
          <div className="panel center empty-state"><div className="empty-art" aria-hidden="true">🔍</div><h3>No dishes match</h3><p className="muted">Try removing a filter or searching for something else.</p>{active > 0 && <button className="btn btn-accent btn-sm" onClick={clear}>Clear filters</button>}</div>
        ) : grouped ? (
          groups.map(({ c, items }, gi) => (
            <section key={c.id} id={`sec-${c.slug}`} className="rm-sec" aria-labelledby={`h-${c.slug}`}>
              <h2 id={`h-${c.slug}`}>{pick(c.names)} <span className="muted small">({items.length})</span></h2>
              <div className="rows">{items.map((i, n) => <MenuRow key={i.id} item={i} priority={gi === 0 && n < 3} />)}</div>
            </section>
          ))
        ) : (
          <div className="rows">{flat.map((i, n) => <MenuRow key={i.id} item={i} priority={n < 3} />)}</div>
        )}
      </div>

      <aside className={`filters ${open ? 'open' : ''}`} aria-label="Filters">
        <button className="filters-close btn btn-outline btn-sm" onClick={() => setOpen(false)}>Close</button>
        <div className="filters-body">
          <div className="filters-head"><h2>{t('filters')}</h2>{active > 0 && <button className="link-btn" onClick={clear}>{t('clear_all')}</button>}</div>
          <fieldset>
            <legend>{t('sort_by')}</legend>
            {([['recommended', t('recommended')], ['price-asc', t('price_low')], ['price-desc', t('price_high')]] as [Sort, string][]).map(([k, l]) => (
              <label key={k} className="opt"><input type="radio" name="sort" checked={sort === k} onChange={() => setSort(k)} /> {l}</label>
            ))}
          </fieldset>
          <fieldset>
            <legend>{t('dietary')}</legend>
            {DIETARY.map((d) => <label key={d.key} className="opt"><input type="checkbox" checked={diet.includes(d.key)} onChange={() => toggle(diet, setDiet, d.key)} /> {t(d.label)}</label>)}
          </fieldset>
          <fieldset>
            <legend>{t('tags')}</legend>
            {TAGS.map((tg) => <label key={tg.key} className="opt"><input type="checkbox" checked={tags.includes(tg.key)} onChange={() => toggle(tags, setTags, tg.key)} /> {tg.label}</label>)}
          </fieldset>
          <p className="muted small">Dietary and ingredient details are drafts being confirmed by our kitchen.</p>
        </div>
        <button className="filters-apply btn btn-accent" onClick={() => setOpen(false)}>Show {total} dishes</button>
      </aside>
      {open && <div className="filters-back" onClick={() => setOpen(false)} />}
    </div>
  );
}
