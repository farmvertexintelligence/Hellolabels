import type { Metadata } from "next";
import { Prose } from "@/components/Prose";

export const metadata: Metadata = { title: "Terms of service" };

export default function Terms() {
  return (
    <Prose title="Terms of service" updated="14 October 2026">
      <h2>Orders and prices</h2>
      <p>
        Prices are fixed per bottle size, bottle type and segment (Event or Shop) and include GST unless shown otherwise. Bottles are sold in cases of 24 with a
        minimum number of cases per size. Your order is confirmed when payment (or the 50% advance, where offered) is received and verified.
      </p>
      <h2>Your design</h2>
      <p>
        You confirm you have the right to use every name, logo, photo and text you put on a label, and that it is not unlawful or offensive. We may refuse designs that
        are. The label size is fixed for each product. Every water label carries a locked regulatory panel (packager, FSSAI licence, ISI mark, batch, dates, MRP and
        volume) which you cannot change or cover.
      </p>
      <h2>Shop labels and the ad space</h2>
      <p>
        On Shop segment labels, 20% of the label area is reserved for a local advertisement placed by hellolabels for your district. You cannot edit that area. We
        do not place ads for competing water brands or unlawful products.
      </p>
      <h2>AI designs</h2>
      <p>AI suggestions are a starting point. Please check spelling, names and dates before you order — the printed label follows the design you approve.</p>
      <h2>Delivery</h2>
      <p>
        We deliver with our own trucks on the chosen date or the nearest possible date. Please be available to receive the order; re-delivery may be charged. For
        advance orders the balance is due on delivery.
      </p>
      <h2>Dealers</h2>
      <p>Dealers are independent. Commission and ad revenue shares are paid as set out in the dealer agreement and shown in the dealer portal.</p>
      <h2>Law</h2>
      <p>These terms are governed by the laws of India. Courts at Salem, Tamil Nadu have jurisdiction.</p>
    </Prose>
  );
}
