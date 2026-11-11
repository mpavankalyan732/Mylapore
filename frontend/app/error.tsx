'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container section narrow center">
      <div className="empty-art" aria-hidden="true">🍲</div>
      <h1>Something went wrong</h1>
      <p className="muted">We could not load this page. Please try again.</p>
      <button className="btn btn-accent" onClick={reset}>Try again</button>
    </div>
  );
}
