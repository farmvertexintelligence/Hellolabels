"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteDesign({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        if (!confirm("Delete this design?")) return;
        await fetch(`/api/designs/${id}`, { method: "DELETE" });
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}

export function ProfileForm({ name, gstin }: { name: string; gstin: string }) {
  const [f, setF] = useState({ name, gstin });
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await fetch("/api/account", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
        const j = await r.json();
        setMsg(r.ok ? "Saved" : j.error);
      }}
    >
      <label className="field"><span>Name</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} /></label>
      <label className="field"><span>GSTIN</span><input className="input" value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} maxLength={15} /></label>
      <button className="btn btn-sm">Save</button>
      {msg && <span className="small">{msg}</span>}
    </form>
  );
}

export function DataRequest() {
  const [kind, setKind] = useState("access");
  const [details, setDetails] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await fetch("/api/account/data-request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, details }) });
        const j = await r.json();
        setMsg(r.ok ? "Request received. We will respond within 30 days." : j.error);
      }}
    >
      <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="access">Get a copy of my data</option>
        <option value="correction">Correct my data</option>
        <option value="erasure">Delete my account and data</option>
        <option value="withdraw_consent">Withdraw consent</option>
        <option value="grievance">Raise a grievance</option>
      </select>
      <textarea className="textarea" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} placeholder="Details (optional)" />
      <button className="btn btn-ghost btn-sm">Send request</button>
      {msg && <span className="small">{msg}</span>}
    </form>
  );
}
