import type { Metadata } from 'next';
import Lightbox from '@/components/Lightbox';
import SectionTitle from '@/components/SectionTitle';
import T from '@/components/Translated';
import { GALLERY } from '@/lib/site';

export const metadata: Metadata = { title: 'Gallery', description: 'Photos of dosas, idlis, meals, sweets and more from Mylapore Restaurant.' };

export default function Gallery() {
  return (
    <>
      <div className="page-hero"><div className="container"><SectionTitle as="h1" light eyebrow="Feast your eyes" title={<T k="gallery_title" />} sub="Tap a photo to view it larger" /></div></div>
      <div className="container section"><Lightbox images={GALLERY} /></div>
    </>
  );
}
