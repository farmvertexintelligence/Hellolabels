"use client";
import { Eyebrow } from "@/components/Squares";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="wrap section center stack" style={{ maxWidth: 560 }}>
      <Eyebrow>hellolabels</Eyebrow>
      <h1 style={{ fontSize: "2rem" }}>Something went wrong.</h1>
      <p>ஏதோ தவறு நடந்துவிட்டது. Please try again.</p>
      <div><button className="btn btn-coral" onClick={reset}>Try again</button></div>
    </div>
  );
}
