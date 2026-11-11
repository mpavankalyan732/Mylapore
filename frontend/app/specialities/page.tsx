import type { Metadata } from 'next';
import ChefFeature from '@/components/ChefFeature';
import MenuCard from '@/components/MenuCard';
import Reveal from '@/components/Reveal';
import SectionTitle from '@/components/SectionTitle';
import T from '@/components/Translated';
import { allItems, bySlugs, loadMenu } from '@/lib/menu-data';
import { CHEFS_SPECIAL_SLUG, COMBO_SLUGS, TODAYS_SPECIAL_SLUG } from '@/lib/site';

export const metadata: Metadata = { title: 'Specialities', description: "Chef's special, today's special, customer favourites and combos at Mylapore Restaurant." };
export const dynamic = 'force-dynamic';

export default async function Specialities() {
  const menu = await loadMenu();
  const chef = bySlugs(menu, [CHEFS_SPECIAL_SLUG])[0];
  const today = bySlugs(menu, [TODAYS_SPECIAL_SLUG])[0];
  const favs = allItems(menu).filter((i) => i.isBestseller && i.isAvailable).slice(0, 8);
  const combos = bySlugs(menu, COMBO_SLUGS);

  if (!menu) return <div className="container section"><p role="alert" className="alert">Specialities are temporarily unavailable. Please try again shortly.</p></div>;

  return (
    <>
      <div className="page-hero"><div className="container"><SectionTitle as="h1" light eyebrow="Mylapore" title={<T k="nav_specialities" />} sub="Our most loved plates, straight from the kitchen" /></div></div>

      <section className="container section">
        {chef && <Reveal><ChefFeature item={chef} /></Reveal>}
      </section>

      {today && (
        <section className="band band-cream">
          <div className="container section">
            <Reveal><ChefFeature item={today} label="Today's Special" flip /></Reveal>
          </div>
        </section>
      )}

      <section className="container section">
        <Reveal><SectionTitle eyebrow="Loved by guests" title={<T k="bestsellers" />} /></Reveal>
        <div className="grid grid-4">{favs.map((i, n) => <Reveal key={i.id} delay={(n % 4) * 70}><MenuCard item={i} /></Reveal>)}</div>
      </section>

      <section className="band band-maroon">
        <div className="container section">
          <Reveal><SectionTitle light eyebrow="Share & save time" title={<T k="combos" />} sub="Complete plates and tasting platters. Prices are demo values until confirmed." /></Reveal>
          <div className="grid grid-4">{combos.map((i, n) => <Reveal key={i.id} delay={(n % 4) * 70}><MenuCard item={i} /></Reveal>)}</div>
        </div>
      </section>
    </>
  );
}
