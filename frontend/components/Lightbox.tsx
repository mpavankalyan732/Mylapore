'use client';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

export default function Lightbox({ images }: { images: { src: string; alt: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + images.length) % images.length)), [images.length]);

  useEffect(() => {
    if (open === null) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', key);
      document.body.style.overflow = '';
    };
  }, [open, close, step]);

  return (
    <>
      <div className="masonry">
        {images.map((g, i) => (
          <button key={g.src} className={`m-item m-${i % 5}`} onClick={() => setOpen(i)} aria-label={`Open photo: ${g.alt}`}>
            <Image src={g.src} alt="" fill sizes="(max-width: 700px) 50vw, 25vw" />
            <span className="m-cap">{g.alt}</span>
          </button>
        ))}
      </div>
      {open !== null && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={images[open].alt} onClick={close}>
          <button className="lb-close" onClick={close} aria-label="Close">✕</button>
          <button className="lb-nav lb-prev" onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous">‹</button>
          <div className="lb-img" onClick={(e) => e.stopPropagation()}>
            <Image src={images[open].src} alt={images[open].alt} fill sizes="90vw" priority />
          </div>
          <button className="lb-nav lb-next" onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next">›</button>
          <p className="lb-cap">{images[open].alt}</p>
        </div>
      )}
    </>
  );
}
