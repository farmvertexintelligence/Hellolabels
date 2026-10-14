import { findProduct } from "@/lib/catalog/helpers";
import type { Catalog } from "@/lib/catalog/types";
import { ddmmyyyy } from "@/lib/commerce/logistics";
import { previewRegData } from "./regpanel";
import type { RegPanelData } from "./types";

/** Regulatory panel values for a product. Batch and dates are real at print time, samples before. */
export function regDataFor(catalog: Pick<Catalog, "products" | "regulatory">, productId: string, print?: { batchNo: string; mfg: Date }): RegPanelData | null {
  const product = findProduct(catalog as Catalog, productId);
  if (!product) return null;
  const r = catalog.regulatory;
  const base = {
    packagerName: r.packagerName,
    packagerAddress: r.packagerAddress,
    fssaiLicence: r.fssaiLicence,
    bisLicence: r.bisLicence,
    isStandard: r.isStandard,
    customerCare: r.customerCare,
    volumeMl: product.volumeMl,
    mrpPaise: product.mrpPaise,
  };
  if (!print) return previewRegData(base, r.shelfLifeDays);
  const best = new Date(print.mfg.getTime() + r.shelfLifeDays * 86400_000);
  return { ...base, batchNo: print.batchNo, mfgDate: ddmmyyyy(print.mfg), bestBefore: ddmmyyyy(best) };
}
