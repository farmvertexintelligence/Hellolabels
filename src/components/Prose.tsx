import { Eyebrow } from "./Squares";

export function Prose({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="wrap section prose" style={{ maxWidth: 760 }}>
      <Eyebrow>hellolabels</Eyebrow>
      <h1 style={{ fontSize: "2.2rem" }}>{title}</h1>
      <p className="tiny">Last updated {updated}. Kolathur, Mettur Tk, Salem District, Tamil Nadu 636303.</p>
      <div className="stack">{children}</div>
    </article>
  );
}
