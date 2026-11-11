'use client';
import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { CATEGORY_IMAGES } from '@/lib/site';
import { ChevronRight, GridIcon } from './Icons';
import { useLang, useShop } from './Providers';

export default function CategoryBar() {
  const { menu, loaded } = useShop();
  const { pick } = useLang();
  const path = usePathname();
  const cat = useSearchParams().get('cat') ?? '';
  const ref = useRef<HTMLDivElement>(null);

  if (!loaded) return <div className="catbar" aria-hidden="true"><div className="container catbar-inner"><div className="chips-scroll">{Array.from({ length: 7 }).map((_, i) => <span key={i} className="chip-skel shimmer" />)}</div></div></div>;
  if (menu.length === 0) return null;
  const onMenu = path === '/menu';
  return (
    <nav className="catbar" aria-label="Categories">
      <div className="container catbar-inner">
        <div className="chips-scroll" ref={ref}>
          <Link href="/menu" className={`chip-link ${onMenu && !cat ? 'on' : ''}`}><GridIcon width={18} height={18} /> All Products</Link>
          {menu.map((c) => (
            <Link key={c.id} href={`/menu?cat=${c.slug}`} className={`chip-link ${onMenu && cat === c.slug ? 'on' : ''}`}>
              <span className="chip-thumb"><Image src={CATEGORY_IMAGES[c.slug] ?? c.items[0]?.imageUrl} alt="" width={28} height={28} /></span>
              {pick(c.names)}
            </Link>
          ))}
        </div>
        <button className="chips-next" aria-label="Scroll categories" onClick={() => ref.current?.scrollBy({ left: 280, behavior: 'smooth' })}>
          <ChevronRight width={18} height={18} />
        </button>
      </div>
    </nav>
  );
}
