import type { Metadata } from "next";
import { Eyebrow } from "@/components/Squares";
import { getDict } from "@/lib/i18n/server";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { t } = await getDict();
  const { next } = await searchParams;
  return (
    <div className="wrap section" style={{ maxWidth: 440 }}>
      <Eyebrow>hellolabels</Eyebrow>
      <h1 style={{ fontSize: "2rem" }}>{t.login.title}</h1>
      <div className="card">
        <LoginForm next={next ?? "/account"} />
      </div>
      <p className="tiny" style={{ marginTop: 12 }}>
        By continuing you agree to our <a className="link" href="/terms">terms</a> and <a className="link" href="/privacy">privacy policy</a>.
      </p>
    </div>
  );
}
