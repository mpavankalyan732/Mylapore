import { BRAND } from '@/lib/site';

/** Lotus-and-leaf mark. Pure SVG: scales cleanly, no network request, follows the theme accent colour. */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo-mark">
      <circle cx="32" cy="32" r="30" fill="var(--accent)" />
      <g fill="#fff3d6">
        <path d="M32 13c4 5 6 10 0 19-6-9-4-14 0-19z" />
        <path d="M20 20c6 1 10 5 12 12-8-1-12-5-12-12z" opacity=".85" />
        <path d="M44 20c-6 1-10 5-12 12 8-1 12-5 12-12z" opacity=".85" />
      </g>
      <path d="M14 36c6 0 12 2 18 8 6-6 12-8 18-8-2 9-10 15-18 15S16 45 14 36z" fill="#fff3d6" opacity=".95" />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="logo">
      <LogoMark />
      <span className="logo-text">{BRAND.name}</span>
    </span>
  );
}
