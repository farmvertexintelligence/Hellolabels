/** The brand signature: four small rounded squares in coral, yellow, purple and teal. */
export function Squares() {
  return (
    <span className="squares" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="eyebrow">
      <Squares />
      {children}
    </div>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <a href={href} className="logo" aria-label="hellolabels home">
      hellolabels
      <Squares />
    </a>
  );
}
