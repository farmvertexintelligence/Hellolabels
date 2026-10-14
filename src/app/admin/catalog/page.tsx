import { ActionForm } from "@/components/ActionForm";
import { findPrice } from "@/lib/catalog/helpers";
import { saveLabelSize, savePrices, saveProduct } from "@/lib/server/actions/admin";
import { getCatalog } from "@/lib/server/catalog";

const rupees = (p?: number) => (p ? (p / 100).toFixed(2) : "");

export default async function CatalogAdmin() {
  const catalog = await getCatalog({ fresh: true });
  const products = [...catalog.products].sort((a, b) => a.sort - b.sort);
  return (
    <div className="stack">
      <h1 style={{ fontSize: "1.8rem", margin: 0 }}>Prices &amp; label sizes</h1>
      <p className="small">Values marked <span className="pill pill-warn">placeholder</span> are samples. Saving a value confirms it. Checkout stays closed while any product on sale has a placeholder.</p>

      <h2 style={{ fontSize: "1.3rem" }}>Fixed prices (₹ per bottle / label, GST {catalog.settings.pricesIncludeGst ? "included" : "extra"})</h2>
      <ActionForm action={savePrices} submit="Save all prices">
        <div className="table-wrap"><table className="table"><thead><tr><th>Product</th><th>Event</th><th>Shop</th></tr></thead><tbody>
          {products.map((p) => {
            const segs = p.kind === "label_only" ? (["label"] as const) : (["event", "shop"] as const);
            return (
              <tr key={p.id}>
                <td>{p.nameEn}</td>
                {segs.map((s) => {
                  const pr = findPrice(catalog, p, s);
                  return (
                    <td key={s} colSpan={p.kind === "label_only" ? 2 : 1}>
                      <input className="input" name={`price:${p.id}:${s}`} defaultValue={rupees(pr?.unitPricePaise)} inputMode="decimal" style={{ maxWidth: 110 }} />
                      {pr?.isPlaceholder && <span className="pill pill-warn" style={{ marginLeft: 6 }}>placeholder</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody></table></div>
      </ActionForm>

      <h2 style={{ fontSize: "1.3rem" }}>Products: minimum order, MRP, HSN, GST</h2>
      <div className="grid grid-2">
        {products.map((p) => (
          <ActionForm key={p.id} action={saveProduct} submit="Save" small className="card stack">
            <b className="ink">{p.nameEn}</b>
            <input type="hidden" name="id" value={p.id} />
            <div className="grid grid-2">
              <label className="field"><span>Minimum ({p.unit === "case" ? "cases of 24" : "labels"})</span><input className="input" name="minQty" defaultValue={p.minQty} inputMode="numeric" /></label>
              <label className="field"><span>Step</span><input className="input" name="qtyStep" defaultValue={p.qtyStep} inputMode="numeric" /></label>
              {p.kind === "water_bottle" && <label className="field"><span>MRP ₹ per bottle (printed)</span><input className="input" name="mrp" defaultValue={rupees(p.mrpPaise ?? undefined)} inputMode="decimal" /></label>}
              <label className="field"><span>HSN</span><input className="input" name="hsn" defaultValue={p.hsn} /></label>
              <label className="field"><span>GST %</span><input className="input" name="gst" defaultValue={p.gstRatePct} inputMode="decimal" /></label>
            </div>
            <label className="check small"><input type="checkbox" name="active" defaultChecked={p.active} /> On sale</label>
          </ActionForm>
        ))}
      </div>

      <h2 style={{ fontSize: "1.3rem" }}>Fixed label sizes (mm)</h2>
      <p className="small">Customers can never change these. Every label is a vertical rectangle: the customer designs the <b>square</b> at the top (label width × label width, inside the 3 mm safe margin). Below it come the 20% ad strip (Shop labels) and the locked regulatory panel down to the bottom edge. Bleed (2 mm) is added automatically. Saving checks that the regulatory text still fits at the minimum size.</p>
      <div className="grid grid-2">
        {catalog.labelSizes.map((s) => (
          <ActionForm key={s.id} action={saveLabelSize} submit="Save size" small className="card stack">
            <div className="row between"><b className="ink">{s.nameEn}</b>{s.isPlaceholder && <span className="pill pill-warn">placeholder</span>}</div>
            <input type="hidden" name="id" value={s.id} />
            <div className="grid grid-3">
              <label className="field"><span>Width</span><input className="input" name="width" defaultValue={s.widthMm} inputMode="decimal" /></label>
              <label className="field"><span>Height</span><input className="input" name="height" defaultValue={s.heightMm} inputMode="decimal" /></label>
              <label className="field"><span>Bottle Ø (3D view)</span><input className="input" name="diameter" defaultValue={s.diameterMm ?? ""} inputMode="decimal" /></label>
            </div>
            <label className="check small"><input type="checkbox" name="hasRegPanel" defaultChecked={s.hasRegPanel} /> Print the regulatory panel (drinking water)</label>
          </ActionForm>
        ))}
      </div>
    </div>
  );
}
