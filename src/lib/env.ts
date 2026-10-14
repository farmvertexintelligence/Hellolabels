/** Environment access. Features switch off cleanly (with a clear message) when keys are missing. */
const v = (k: string) => {
  const s = process.env[k];
  return s && s.trim() ? s.trim() : undefined;
};

export const env = {
  siteUrl: v("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000",
  supabaseUrl: v("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: v("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceKey: v("SUPABASE_SERVICE_ROLE_KEY"),
  razorpayKeyId: v("RAZORPAY_KEY_ID"),
  razorpayKeySecret: v("RAZORPAY_KEY_SECRET"),
  razorpayWebhookSecret: v("RAZORPAY_WEBHOOK_SECRET"),
  anthropicKey: v("ANTHROPIC_API_KEY"),
  aiModel: v("AI_DESIGN_MODEL") ?? "claude-opus-5-5",
  aadhaarKey: v("AADHAAR_ENCRYPTION_KEY"),
  msg91AuthKey: v("MSG91_AUTH_KEY"),
  msg91TemplateId: v("MSG91_ORDER_STATUS_TEMPLATE_ID"),
  whatsappToken: v("WHATSAPP_TOKEN"),
  whatsappPhoneNumberId: v("WHATSAPP_PHONE_NUMBER_ID"),
  whatsappTemplate: v("WHATSAPP_ORDER_STATUS_TEMPLATE") ?? "order_status_update",
  cronSecret: v("CRON_SECRET"),
};

export const features = {
  get supabase() {
    return Boolean(env.supabaseUrl && env.supabaseAnonKey);
  },
  get serviceRole() {
    return Boolean(env.supabaseUrl && env.supabaseServiceKey);
  },
  get payments() {
    return Boolean(env.razorpayKeyId && env.razorpayKeySecret && env.razorpayWebhookSecret);
  },
  get ai() {
    return Boolean(env.anthropicKey);
  },
};
