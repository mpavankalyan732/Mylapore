import type { Metadata } from 'next';
import SectionTitle from '@/components/SectionTitle';
import credits from '@/public/menu/credits.json';

export const metadata: Metadata = { title: 'Photo credits' };

export default function Credits() {
  return (
    <>
      <div className="page-hero"><div className="container"><SectionTitle as="h1" light title="Photo credits" sub="Some dish photos are used under open licences (Wikimedia Commons). Other photos are from Unsplash." /></div></div>
      <div className="container section narrow">
        <ul className="credits">
          {credits.map((c) => (
            <li key={c.file}>
              <a href={c.source} target="_blank" rel="noopener noreferrer">{c.title}</a> by {c.author}, {c.license}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
