import Link from "next/link";
import { Eyebrow } from "@/components/Squares";

export default function NotFound() {
  return (
    <div className="wrap section center stack" style={{ maxWidth: 560 }}>
      <Eyebrow>404</Eyebrow>
      <h1 style={{ fontSize: "2rem" }}>This page is not here.</h1>
      <p>இந்தப் பக்கம் இல்லை.</p>
      <div><Link className="btn btn-coral" href="/">hellolabels home</Link></div>
    </div>
  );
}
