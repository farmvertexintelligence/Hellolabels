import type { Metadata } from "next";
import { Prose } from "@/components/Prose";

export const metadata: Metadata = { title: "Privacy policy", description: "How hellolabels collects, uses and protects personal data under India's Digital Personal Data Protection Act, 2023." };

export default function Privacy() {
  return (
    <Prose title="Privacy policy" updated="14 October 2026">
      <p>
        hellolabels (&ldquo;we&rdquo;) is the Data Fiduciary for the personal data described here, under the Digital Personal Data Protection Act, 2023
        (&ldquo;DPDP Act&rdquo;). This notice is available in English and Tamil (switch language at the top of the page).
      </p>
      <h2>What we collect and why</h2>
      <ul>
        <li><b>Mobile number</b> — to sign you in with a one-time password and to send order updates by SMS and WhatsApp.</li>
        <li><b>Name, delivery address, pincode, district</b> — to deliver your order and plan truck routes.</li>
        <li><b>GSTIN and business name</b> (optional) — only to issue a GST invoice in your business name.</li>
        <li><b>Designs, text, logos and photos you upload</b> — to print your labels. Photo location data (EXIF/GPS) is removed when you upload.</li>
        <li><b>Payment details</b> — handled by Razorpay. We never see or store your card, UPI PIN or bank login; we keep the payment reference and amount.</li>
        <li><b>Dealers only: name, age, address, phone, profession and an Aadhaar copy</b> — to verify the identity of the one dealer we appoint per district.</li>
      </ul>
      <h2>Aadhaar (dealers)</h2>
      <p>
        We ask for Aadhaar only with your explicit consent and only to verify a dealer&rsquo;s identity. We store the last four digits of the number, never the full
        number. The card image is encrypted (AES-256-GCM) before it is stored, kept in a private store that only our administrators can open, and every view is
        logged. If your application is rejected, or when your dealership ends, the copy is deleted within 90 days unless the law requires us to keep it longer.
      </p>
      <h2>Who we share data with</h2>
      <p>
        Only service providers who help us run the service, under contract and only for these purposes: Supabase (database and file storage), Razorpay (payments),
        our SMS and WhatsApp providers (order messages), Anthropic (the AI label designer receives the words of your brief and any image you add to the
        designer, to produce designs), and our hosting provider. Our own drivers see the delivery name, phone and address for orders on their truck. We do not sell
        personal data.
      </p>
      <h2>How long we keep it</h2>
      <p>
        Orders and invoices: 8 years (tax law). Saved designs and uploads: until you delete them or your account. Order messages log: 1 year. Dealer KYC: as above.
      </p>
      <h2>Your rights</h2>
      <p>
        You can ask for a summary of your data, correction, erasure, or withdraw consent at any time from <b>My account → Your data</b>, or by WhatsApp or post to
        the address above. Withdrawing consent does not affect orders already processed. We respond within 30 days. If you are not satisfied, you may complain to
        the Data Protection Board of India.
      </p>
      <h2>Grievance officer</h2>
      <p>The Grievance Officer of hellolabels can be reached at the address above or through My account → Your data → Raise a grievance.</p>
      <h2>Security</h2>
      <p>
        Data is encrypted in transit (HTTPS) and at rest. Access is limited by role (customer, dealer, driver, admin) with database row-level security. Payment
        status is only accepted from Razorpay after signature verification on our server.
      </p>
      <h2>Children</h2>
      <p>The service is for adults. We do not knowingly process the data of children without verifiable parental consent.</p>
    </Prose>
  );
}
