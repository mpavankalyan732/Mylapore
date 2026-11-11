import Image from 'next/image';
import Link from 'next/link';
import CtaBand from '@/components/CtaBand';
import T from '@/components/Translated';
import HeroCarousel from '@/components/HeroCarousel';
import LocalName from '@/components/LocalName';
import MenuCard from '@/components/MenuCard';
import Row from '@/components/Row';
import { allItems, loadMenu } from '@/lib/menu-data';
import { CATEGORY_IMAGES, COLLECTIONS, IMG } from '@/lib/site';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const menu = await loadMenu();
  const favourites = allItems(menu).filter((i) => i.isBestseller && i.isAvailable).slice(0, 10);

  return (
    <>
      <HeroCarousel images={[IMG.idliVada, IMG.thali]} />

      {menu && (
        <section className="container row-section">
          <div className="row-head"><div><h2><T k="whats_on_mind" /></h2></div></div>
          <div className="mind-track">
            {menu.map((c) => (
              <Link key={c.id} href={`/menu?cat=${c.slug}`} className="mind">
                <span className="mind-img"><Image src={CATEGORY_IMAGES[c.slug] ?? IMG.thali} alt="" fill sizes="120px" /></span>
                <span className="mind-name"><LocalName names={c.names} /></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!menu && <div className="container"><p role="alert" className="alert">The menu is loading. Please refresh in a moment.</p></div>}

      {favourites.length > 0 && (
        <Row title={<T k="customer_favs" />} sub="Dishes our guests love" href="/specialities">
          {favourites.map((i, n) => <div className="row-item" key={i.id}><MenuCard item={i} priority={n < 4} /></div>)}
        </Row>
      )}

      {(menu ?? []).map((c) => (
        <Row key={c.id} title={<LocalName names={c.names} />} href={`/menu?cat=${c.slug}`}>
          {c.items.slice(0, 8).map((i) => <div className="row-item" key={i.id}><MenuCard item={i} categorySlug={c.slug} /></div>)}
        </Row>
      ))}

      {menu && (
        <section className="container row-section">
          <div className="row-head"><div><h2><T k="collections" /></h2><p className="muted">Chosen by our kitchen</p></div><Link href="/menu" className="view-all"><T k="view_all" /> →</Link></div>
          <div className="collections">
            {COLLECTIONS.map((col) => {
              const count = menu.filter((c) => col.cats.includes(c.slug)).reduce((n, c) => n + c.items.length, 0);
              return (
                <Link key={col.title} href={`/menu?cat=${col.cats[0]}`} className="collection">
                  <Image src={CATEGORY_IMAGES[col.cats[0]] ?? IMG.thali} alt="" fill sizes="(max-width: 700px) 70vw, 280px" />
                  <span className="collection-shade" />
                  <span className="collection-name">{col.title}<small>{count} {count === 1 ? 'dish' : 'dishes'}</small></span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <CtaBand />
    </>
  );
}
