'use client';
import { ReactNode, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronRight } from './Icons';
import { useLang } from './Providers';

/** Titled horizontal scroller with a next arrow, as in the reference product rows. */
export default function Row({ title, sub, href, children }: { title: ReactNode; sub?: ReactNode; href?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useLang();
  return (
    <section className="container row-section">
      <div className="row-head">
        <div><h2>{title}</h2>{sub && <p className="muted">{sub}</p>}</div>
        {href && <Link href={href} className="view-all">{t('view_all')} <ArrowRight width={16} height={16} /></Link>}
      </div>
      <div className="row-wrap">
        <div className="row-track" ref={ref}>{children}</div>
        <button className="row-next" aria-label="Scroll right" onClick={() => ref.current?.scrollBy({ left: 480, behavior: 'smooth' })}><ChevronRight /></button>
      </div>
    </section>
  );
}
