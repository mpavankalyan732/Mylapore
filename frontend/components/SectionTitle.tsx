import { ReactNode } from 'react';

/** Section heading with a gold lotus-diamond divider. */
export default function SectionTitle({ eyebrow, title, sub, light = false, as: H = 'h2' }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; light?: boolean; as?: 'h1' | 'h2' }) {
  return (
    <header className={`section-title ${light ? 'on-dark' : ''}`}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <H>{title}</H>
      <span className="divider" aria-hidden="true"><i /><b /><i /></span>
      {sub && <p className="muted">{sub}</p>}
    </header>
  );
}
