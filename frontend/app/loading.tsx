export default function Loading() {
  return (
    <div className="container section" aria-busy="true" aria-label="Loading">
      <div className="skel-title shimmer" />
      <div className="grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card skel-card">
            <div className="skel-img shimmer" />
            <div className="skel-line shimmer" />
            <div className="skel-line short shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}
