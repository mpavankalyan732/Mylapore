import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container section narrow center">
      <div className="empty-art" aria-hidden="true">🥘</div>
      <h1>We could not find that page</h1>
      <p className="muted">The dish or page you are looking for is not on our menu.</p>
      <Link href="/menu" className="btn btn-accent">Browse the menu</Link>
    </div>
  );
}
