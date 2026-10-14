import { ActionForm } from "@/components/ActionForm";
import { saveBusiness, saveRegulatory } from "@/lib/server/actions/admin";
import { getCatalog } from "@/lib/server/catalog";

export default async function SettingsAdmin() {
  const { regulatory: r, settings: s } = await getCatalog({ fresh: true });
  return (
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      <section className="stack">
        <h1 style={{ fontSize: "1.6rem", margin: 0 }}>Regulatory panel</h1>
        <p className="small">Printed, locked, on every drinking-water label. Batch number (the order number), manufacturing date, best-before date, MRP and volume are filled in automatically for each order.</p>
        <ActionForm action={saveRegulatory} submit="Save regulatory details" className="card stack">
          <label className="field"><span>Packager / manufacturer name</span><input className="input" name="packagerName" defaultValue={r.packagerName} required /></label>
          <label className="field"><span>Packager address</span><textarea className="textarea" name="packagerAddress" defaultValue={r.packagerAddress} required /></label>
          <label className="field"><span>FSSAI licence number (14 digits)</span><input className="input" name="fssaiLicence" defaultValue={r.fssaiLicence} inputMode="numeric" required /></label>
          <div className="grid grid-2">
            <label className="field"><span>ISI standard</span><input className="input" name="isStandard" defaultValue={r.isStandard} /></label>
            <label className="field"><span>BIS licence (CM/L-…)</span><input className="input" name="bisLicence" defaultValue={r.bisLicence} required /></label>
            <label className="field"><span>Shelf life (days)</span><input className="input" name="shelfLifeDays" defaultValue={r.shelfLifeDays} inputMode="numeric" /></label>
            <label className="field"><span>Customer care</span><input className="input" name="customerCare" defaultValue={r.customerCare} /></label>
          </div>
        </ActionForm>
      </section>
      <section className="stack">
        <h1 style={{ fontSize: "1.6rem", margin: 0 }}>Business settings</h1>
        <ActionForm action={saveBusiness} submit="Save settings" className="card stack">
          <label className="field"><span>Legal name (invoices)</span><input className="input" name="legalName" defaultValue={s.legalName} /></label>
          <label className="field"><span>GSTIN</span><input className="input" name="gstin" defaultValue={s.gstin} /></label>
          <label className="field"><span>Address (invoices)</span><textarea className="textarea" name="address" defaultValue={s.address} /></label>
          <label className="field"><span>WhatsApp number (91…)</span><input className="input" name="whatsappNumber" defaultValue={s.whatsappNumber} /></label>
          <div className="grid grid-2">
            <label className="field"><span>Dealer commission %</span><input className="input" name="dealerCommissionPct" defaultValue={s.dealerCommissionPct} inputMode="decimal" /></label>
            <label className="field"><span>Dealer ad revenue share %</span><input className="input" name="dealerAdSharePct" defaultValue={s.dealerAdSharePct} inputMode="decimal" /></label>
            <label className="field"><span>Advance % (event orders)</span><input className="input" name="advancePct" defaultValue={s.advancePct} inputMode="decimal" /></label>
            <label className="field"><span>Advance allowed from ₹</span><input className="input" name="advanceMinOrder" defaultValue={(s.advanceMinOrderPaise / 100).toFixed(0)} inputMode="decimal" /></label>
            <label className="field"><span>Smallest text (pt)</span><input className="input" name="minTextPt" defaultValue={s.minTextPt} inputMode="decimal" /></label>
            <label className="field"><span>Cases per pack</span><input className="input" name="casesPerPack" defaultValue={s.casesPerPack} inputMode="numeric" /></label>
            <label className="field"><span>Extra labels printed %</span><input className="input" name="spoilagePct" defaultValue={s.spoilagePct} inputMode="decimal" /></label>
          </div>
          <label className="check small"><input type="checkbox" name="pricesIncludeGst" defaultChecked={s.pricesIncludeGst} /> Prices include GST</label>
          <label className="check"><input type="checkbox" name="catalogReady" defaultChecked={s.catalogReady} /> <b>Open online ordering</b> (only after every price, size, MRP and the FSSAI licence are confirmed)</label>
        </ActionForm>
      </section>
    </div>
  );
}
