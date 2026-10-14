import type { Metadata } from "next";
import { Prose } from "@/components/Prose";

export const metadata: Metadata = { title: "Refund and cancellation policy" };

export default function Refund() {
  return (
    <Prose title="Refund & cancellation policy" updated="14 October 2026">
      <p>Every order is printed to your own design, so refunds depend on how far the order has gone.</p>
      <h2>Before your design is approved</h2>
      <p>Cancel any time before we mark your design as approved and you get a full refund of what you paid.</p>
      <h2>After design approval, before printing</h2>
      <p>We refund what you paid minus a design and setup charge of up to 10% of the order value.</p>
      <h2>After printing</h2>
      <p>Printed labels and filled bottles cannot be resold, so we cannot cancel or refund printed orders — except as below.</p>
      <h2>Our mistakes and damage</h2>
      <ul>
        <li>If the print does not match the design you approved, or has a printing defect, we reprint the affected cases free or refund them.</li>
        <li>Damaged or leaking bottles on delivery: tell the driver, or WhatsApp us a photo within 48 hours, and we replace or refund them.</li>
        <li>Glass bottles are packed in bubble wrap with extra protection; breakage in transit is replaced free.</li>
      </ul>
      <h2>Failed payments</h2>
      <p>If money left your account but the order shows unpaid, it is refunded automatically by Razorpay/your bank, usually within 5–7 working days.</p>
      <h2>How refunds are paid</h2>
      <p>To the original payment method through Razorpay, normally within 5–7 working days after approval. Cash balances paid on delivery are refunded by UPI or bank transfer.</p>
    </Prose>
  );
}
