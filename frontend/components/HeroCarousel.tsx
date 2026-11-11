'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, PinIcon } from './Icons';
import { useLang, useShop } from './Providers';

/** Scroll-snap carousel: three cards with a peek of the next, auto-advancing, with dots. */
export default function HeroCarousel({ images }: { images: [string, string] }) {
  const { setLocationOpen, pincode, serviceable } = useShop();
  const { t } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const N = 3;

  const go = (n: number) => {
    const el = ref.current;
    if (!el) return;
    const card = el.children[n] as HTMLElement;
    el.scrollTo({ left: card.offsetLeft - (el.children[0] as HTMLElement).offsetLeft, behavior: 'smooth' });
    setI(n);
  };

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => go((i + 1) % N), 6000);
    return () => clearInterval(id);
  });

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const w = (el.children[0] as HTMLElement).offsetWidth + 16;
    setI(Math.min(N - 1, Math.round(el.scrollLeft / w)));
  };

  return (
    <section className="container hero-wrap" aria-label="Highlights" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <h1 className="sr-only">Mylapore Restaurant: 100% pure vegetarian South Indian food in Tirupati</h1>
      <div className="hero-track" ref={ref} onScroll={onScroll} aria-roledescription="carousel" aria-label="Highlights">
        <div className="hero-card hero-dark">
          <span className="hero-line" />
          <h2>{t('hero_deliver_q')}</h2>
          <p>{pincode ? (serviceable === false ? `${pincode} is outside our delivery area. Dine-in and takeaway are available.` : serviceable ? `Delivering to ${pincode}. You're all set.` : `Checking ${pincode}…`) : 'Set your address to see what we can bring to your door.'}</p>
          <button className="hero-link" onClick={() => setLocationOpen(true)}><PinIcon width={16} height={16} /> {pincode ? 'Change delivery location' : 'Set delivery location'} <ArrowRight width={14} height={14} /></button>
        </div>
        <div className="hero-card hero-photo">
          <Image src={images[0]} alt="Dosa, idli and chutneys on a plate" fill priority sizes="(max-width: 800px) 85vw, 45vw" />
          <div className="hero-glass">
            <h2>{t('hero_fresh')}</h2>
            <p>Authentic South Indian · 100% pure vegetarian</p>
            <Link href="/menu" className="hero-link">{t('browse_the_menu')} <ArrowRight width={14} height={14} /></Link>
          </div>
        </div>
        <div className="hero-card hero-photo">
          <Image src={images[1]} alt="South Indian meals thali" fill sizes="(max-width: 800px) 85vw, 45vw" />
          <div className="hero-glass">
            <h2>{t('hero_choose')}</h2>
            <p>Dine in, take away or get it delivered</p>
            <Link href="/menu" className="hero-link">{t('order_now')} <ArrowRight width={14} height={14} /></Link>
          </div>
        </div>
      </div>
      <div className="dots" role="tablist" aria-label="Choose slide">
        {Array.from({ length: N }).map((_, n) => (
          <button key={n} role="tab" aria-selected={i === n} aria-label={`Slide ${n + 1}`} className={i === n ? 'on' : ''} onClick={() => go(n)} />
        ))}
      </div>
    </section>
  );
}
