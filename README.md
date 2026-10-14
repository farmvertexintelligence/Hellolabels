# hellolabels

**Every label says hello.** Online store and production system for hellolabels, Kolathur, Mettur Tk, Salem District, Tamil Nadu 636303. Customers order packaged drinking water bottles with their own label, plus labels for glass bottles, jars, stickers and packaging.

Next.js 15 (App Router) · Supabase (Postgres, phone OTP login, private storage) · Razorpay · Claude (AI label designer) · English / தமிழ்.

---

## What is in the box

| Area | Where |
| --- | --- |
| Home, products, ready templates, 38 district SEO pages, sitemap | `src/app/page.tsx`, `src/app/products`, `src/app/templates`, `src/app/districts` |
| **AI label designer**: brief in English or Tamil gives 4 designs; editor (text, fonts, colours, photos, ornaments, drag/resize, undo); AI changes in plain words; live 3D bottle preview; five automatic print checks | `src/components/design/*`, `src/lib/design/*`, `src/lib/server/ai-designer.ts` |
| Cart, delivery date, checkout, Razorpay (UPI, cards, net banking, wallets), 50% advance, GST invoice | `src/app/cart`, `src/app/checkout`, `src/lib/server/payments.ts`, `src/lib/server/print-files.ts` |
| Order tracking (timeline, SMS + WhatsApp at every step), saved designs, reorder | `src/app/orders/[id]`, `src/app/track`, `src/app/account`, `src/lib/server/notify.ts` |
| Dealer portal (one per district): apply with encrypted Aadhaar, shops, order for a shop, commission, ad share, ad bookings | `src/app/dealer`, `src/app/api/dealer/apply` |
| Driver view: route, stops, call/map, QR scan to deliver, collect balance | `src/app/driver` |
| Admin: prices, label sizes, regulatory panel, settings, orders, print → pack → stock → load, pack labels with QR, truck planning and load sheets, dealers and KYC, ad bookings, customers and staff, reports, DPDP requests | `src/app/admin`, `src/lib/server/actions/admin.ts` |
| Database schema with row-level security, counters, constraints | `supabase/migrations/20261014000000_init.sql` |

## Label geometry

Every label is a **vertical rectangle**. The customer designs the **square** at the top.

```
┌──────────────────────┐  ← 2 mm bleed all round, 3 mm safe margin inside the cut
│                      │
│   customer design    │  square: (label width − 6 mm) × (label width − 6 mm)
│      (square)        │
│                      │
├──────────────────────┤
│  local ad (20%)      │  Shop labels only: 20% of label height × full width = 20% of the area
├──────────────────────┤
│ 🔒 regulatory panel  │  packager, FSSAI, ISI/BIS, batch, mfg, best before, MRP, volume
│                      │  (Event labels: also gets the space of the ad strip)
└──────────────────────┘
```

* Sizes are fixed per product and set in **Admin → Prices & sizes**. Customers can never change them. Saving a size checks that the square, the ad strip and the regulatory text still fit at the minimum text size, and suggests a height if not.
* The regulatory panel and ad strip are drawn by the renderer **on top of** the design, so nothing (customer, editor or AI) can move or cover them. The batch number (the order number) and the manufacturing and best-before dates are filled in when the print files are made.
* Label-only products (glass bottle, jar, sticker labels) have no regulatory panel or ad, so their design can use the whole safe area.

## Print files (Memjet QM210D)

When an admin approves an order's design, `generatePrintFiles` makes, for each line:

1. **Proof PDF**: one label with 2 mm bleed, crop marks and a slug line.
2. **Roll PDF**: labels laid out across the roll for the Memjet (max print width 215.9 mm, roll-to-roll). `src/lib/print/imposition.ts` tries every stock roll width and both orientations and picks the layout that uses the least label stock. Quantity = bottles + spoilage %.

Text is converted to vector outlines with fontkit, so Tamil conjuncts shape correctly and the printer needs no fonts. The artwork is rasterised at **600 dpi** and converted to **CMYK** with an ICC profile (sharp), then embedded as DeviceCMYK. Crop and cut marks are drawn in registration black.

## Order flow

`pending_payment → placed → design_approved → printed → packed → loaded → delivered` (or `cancelled`). Every step adds an event and sends **SMS (MSG91)** and **WhatsApp (Cloud API)**.

A paid order automatically creates a **Print order → Pack order → Load order**. Packing creates one pack per `casesPerPack` cases, each with a batch pack number `HL-[district]-[YYMMDD]-[route]-[batch]` (e.g. `HL-SLM-261108-R2-B014`) printed as a QR code on a 100 × 75 mm pack label, plus a **stock entry**. Truck planning groups orders by route. The load sheet loads the last stop first, so the first stop's packs are at the door. Drivers scan each pack's QR, and the order is marked Delivered when its last pack is scanned.

## Payments: security rules

* Amounts always come from the database order, never from the browser.
* The checkout callback is verified with the HMAC signature **and** by fetching the payment from Razorpay. The webhook (`/api/webhooks/razorpay`) is verified with the webhook secret and each event id is processed once. Both paths are idempotent, so they can race safely.
* Refunds (full or partial) are started from the order page in Admin and settled by the `refund.processed` webhook. Failed payments can be retried from the order page.
* GST: prices include GST by default (setting). CGST + SGST inside Tamil Nadu, IGST for other states (taken from the customer's GSTIN). HSN 2201 for water and 4821 for labels (editable per product). Invoice numbers follow the financial year (`HL/26-27/000123`).

## Aadhaar and the DPDP Act 2023

* Explicit consent checkbox; the full Aadhaar number is validated (Verhoeff check) but only the **last 4 digits** are stored.
* The card image or PDF is encrypted in the app with **AES-256-GCM** (key `AADHAAR_ENCRYPTION_KEY`, bound to the dealer id) before upload to a private bucket. Only admins can view it, decrypted in memory with `no-store`, and **every view is audit-logged**.
* Rejected or ended dealerships get a purge date. The daily cron `/api/cron/kyc-purge` deletes those files.
* Customers can request access, correction or erasure, withdraw consent, or raise a grievance from **My account**. Requests appear on the admin dashboard. The privacy policy is at `/privacy`.

---

## Setup

### 1. Supabase

1. Create a project (region **Mumbai**).
2. Run the migration and seed (SQL editor or CLI):
   ```bash
   supabase db push        # or paste supabase/migrations/20261014000000_init.sql
   psql "$DATABASE_URL" -f supabase/seed.sql
   ```
3. **Authentication → Providers → Phone**: enable, and connect an SMS provider for OTPs (MSG91 or Twilio; Indian numbers need a DLT-registered OTP template).
4. Make yourself admin: sign in once on the site with your phone, then run
   ```sql
   update public.profiles set role = 'admin' where phone = '+91XXXXXXXXXX';
   ```

### 2. Environment

Copy `.env.example` to `.env.local` (or set the variables in Vercel). Generate the KYC key with `openssl rand -base64 32` and **keep an offline backup**: encrypted Aadhaar files cannot be read without it.

### 3. Razorpay

* Dashboard → Settings → Payment capture: **automatic**.
* Webhooks → `https://<your-site>/api/webhooks/razorpay` with events `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`. Use the same secret as `RAZORPAY_WEBHOOK_SECRET`.

### 4. SMS and WhatsApp templates

Both use 4 variables: **{1} name, {2} order number, {3} status, {4} tracking link**.
* MSG91: create a DLT-approved Flow template with `var1..var4` and set `MSG91_ORDER_STATUS_TEMPLATE_ID`.
* WhatsApp Cloud API: an approved utility template named `order_status_update` in **en** and **ta**.

Until these are configured, messages are logged as `skipped` (visible on each admin order page).

### 5. Run

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start
```

Without Supabase the public site and the designer still run (placeholder catalogue, template designs). Checkout, accounts and admin need Supabase.

### 6. Deploy (Vercel)

`vercel.json` pins the Mumbai region and the daily KYC purge cron (set `CRON_SECRET`). The print engine runs on the Node runtime and reads fonts from `assets/fonts` (bundled via `outputFileTracingIncludes`).

## ⚠️ Fill in before going live

Everything below is seeded as a **placeholder**. Checkout refuses to take money for any product with a placeholder price or size, a missing MRP, or a placeholder FSSAI number, and online ordering stays closed until **Admin → Regulatory & settings → Open online ordering** is ticked. That switch itself refuses while anything is still a placeholder.

| Item | Where |
| --- | --- |
| Prices per size × plastic/glass × Event/Shop, label prices | Admin → Prices & sizes |
| Minimum cases per size (sold in cases of 24), MRP per bottle | Admin → Prices & sizes → Products |
| Label sizes (mm) for 250/300/500/1000/2000 ml, glass, jars, stickers | Admin → Prices & sizes |
| Packager name and address, FSSAI licence, ISI/BIS licence, shelf life | Admin → Regulatory & settings |
| Dealer commission %, dealer ad revenue share %, advance threshold | Admin → Regulatory & settings |
| GSTIN and legal name for invoices | Admin → Regulatory & settings |
| Delivery routes (pincodes per route), trucks, drivers | Admin → Trucks & routes, Customers & staff |

The sample label sizes keep the regulatory text at 6 pt or larger: small bottles need labels about twice as tall as they are wide (for example 55 × 120 mm for 250 ml) because of the square design, the 20% ad strip and the legal panel.

## Tests

```bash
npm test             # unit tests: pricing, GST, pack numbers, loading order, Razorpay signatures,
                     # Aadhaar crypto, zones, every template × every label size passing all 5 print
                     # checks, sanitiser, brief parser, imposition, CMYK PDF output
npm run typecheck
DATABASE_URL=postgres://…scratch-db… npm run test:db   # migration + seed + constraints + row-level security
PREVIEW_DIR=/tmp/previews npx vitest run tests/preview.test.ts   # renders every template to PNG for review
```

`npm run db:seed-sql` regenerates `supabase/seed.sql` from `src/lib/catalog/defaults.ts`. `npm run fonts` re-downloads the OFL fonts.

## Notes

* **AI designer**: Claude (`claude-opus-5-5`, adaptive thinking, structured output, server-side refusal fallback) reads the brief and any uploaded logo or photo and returns layouts in millimetres. Output is sanitised (fonts, motifs, colours, bounds) and checked like any other design. The "image-capable" part is image understanding: the AI does not paint pictures. Ornaments come from a built-in vector library (thoranam, kolam, gopuram, diya, pongal pot, rings, balloons…) that prints sharp at any size. Without `ANTHROPIC_API_KEY` the designer falls back to the brief parser plus ready templates.
* **Performance on slow networks**: pages are server-rendered, fonts are self-hosted WOFF2 split by unicode range (Tamil files load only when Tamil text is shown), designer-only fonts load only in the designer, and template thumbnails are cached PNGs.
* Rate limits on AI, upload and checkout endpoints are per server instance. Add a WAF or edge rule for stronger limits.
