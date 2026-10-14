import { ActionForm } from "@/components/ActionForm";
import { formatInr } from "@/lib/commerce/pricing";
import { setUserRole } from "@/lib/server/actions/admin";
import { supabaseAdmin } from "@/lib/supabase/server";

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const db = supabaseAdmin();
  let query = db.from("profiles").select("id, phone, full_name, role, gstin, created_at").order("created_at", { ascending: false }).limit(200);
  if (q) query = query.or(`phone.ilike.%${q.replace(/\D/g, "")}%,full_name.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const { data: people } = await query;
  const ids = (people ?? []).map((p) => p.id);
  const { data: orders } = ids.length ? await db.from("orders").select("customer_id, total_paise, status").in("customer_id", ids).neq("status", "cancelled").neq("status", "pending_payment") : { data: [] };
  const stats = (id: string) => {
    const mine = (orders ?? []).filter((o) => o.customer_id === id);
    return { n: mine.length, total: mine.reduce((a, o) => a + o.total_paise, 0) };
  };
  return (
    <div className="stack">
      <h1 style={{ fontSize: "1.8rem", margin: 0 }}>Customers &amp; staff</h1>
      <form className="row"><input className="input" name="q" defaultValue={q} placeholder="Phone or name" style={{ maxWidth: 300 }} /><button className="btn btn-sm">Search</button></form>
      <ActionForm action={setUserRole} submit="Set role" className="card row">
        <input className="input" name="phone" placeholder="Phone of a signed-up user" required style={{ maxWidth: 220 }} />
        <select className="select" name="role" style={{ width: "auto" }}><option value="driver">Driver</option><option value="admin">Admin</option><option value="customer">Customer</option></select>
      </ActionForm>
      <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>GSTIN</th><th className="num">Orders</th><th className="num">Spent</th><th>Since</th></tr></thead><tbody>
        {(people ?? []).map((p) => {
          const s = stats(p.id);
          return (
            <tr key={p.id}>
              <td>{p.full_name ?? "—"}{s.n >= 3 && <span className="pill pill-ok" style={{ marginLeft: 6 }}>regular</span>}</td>
              <td>{p.phone}</td><td>{p.role}</td><td className="tiny">{p.gstin}</td>
              <td className="num">{s.n}</td><td className="num">{formatInr(s.total)}</td>
              <td className="tiny">{new Date(p.created_at).toLocaleDateString("en-IN")}</td>
            </tr>
          );
        })}
      </tbody></table></div>
    </div>
  );
}
