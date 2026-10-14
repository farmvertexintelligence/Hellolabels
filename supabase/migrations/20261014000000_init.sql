-- hellolabels — initial schema
-- Money is stored in paise (integer). Dates/times are timestamptz; business dates are Asia/Kolkata.
-- Row Level Security is on for every table. The Next.js server uses the service role for writes
-- after its own role checks; RLS policies below are what a signed-in browser can read directly.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ───────────────────────── Enums ─────────────────────────
create type public.app_role as enum ('customer', 'dealer', 'driver', 'admin');
create type public.segment as enum ('event', 'shop', 'label');
create type public.order_status as enum ('pending_payment', 'placed', 'design_approved', 'printed', 'packed', 'loaded', 'delivered', 'cancelled');
create type public.payment_plan as enum ('full', 'advance');
create type public.payment_status as enum ('created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded');
create type public.dealer_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.ad_status as enum ('pending', 'approved', 'live', 'ended', 'rejected', 'cancelled');

-- ───────────────────────── People ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text unique,
  full_name text,
  role public.app_role not null default 'customer',
  gstin text,
  district_code text,
  default_address jsonb,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create a profile for every new auth user (phone OTP sign-in).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone) values (new.id, new.phone) on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.my_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- ───────────────────────── Catalogue (admin-editable) ─────────────────────────
create table public.app_settings (
  key text primary key check (key in ('business', 'regulatory', 'roll')),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

create table public.label_sizes (
  id text primary key,
  name_en text not null,
  name_ta text not null,
  width_mm numeric(6, 1) not null check (width_mm > 10 and width_mm < 1000),
  height_mm numeric(6, 1) not null check (height_mm > 10 and height_mm < 500),
  wraps boolean not null,
  diameter_mm numeric(6, 1),
  overlap_mm numeric(5, 1) not null default 0 check (overlap_mm >= 0),
  has_reg_panel boolean not null default true,
  reg_panel_mm numeric(5, 1) not null default 40 check (reg_panel_mm >= 0),
  is_placeholder boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.products (
  id text primary key,
  slug text not null unique,
  kind text not null check (kind in ('water_bottle', 'label_only')),
  name_en text not null,
  name_ta text not null,
  volume_ml int,
  bottle_type text check (bottle_type in ('plastic', 'glass')),
  label_size_ids text[] not null,
  unit text not null check (unit in ('case', 'piece')),
  case_size int not null default 24 check (case_size > 0),
  min_qty int not null check (min_qty > 0),
  qty_step int not null default 1 check (qty_step > 0),
  hsn text not null,
  gst_rate_pct numeric(4, 2) not null default 18,
  mrp_paise int check (mrp_paise > 0),
  active boolean not null default true,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.prices (
  product_id text not null references public.products (id) on delete cascade,
  segment public.segment not null,
  unit_price_paise int not null check (unit_price_paise > 0),
  is_placeholder boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  primary key (product_id, segment)
);

-- Delivery routes inside a district, e.g. R2 = Mettur → Kolathur → Kaveripuram.
create table public.routes (
  district_code text not null,
  code text not null check (code ~ '^R[0-9]{1,2}$'),
  name text not null,
  pincodes text[] not null default '{}',
  stops text[] not null default '{}',
  primary key (district_code, code)
);

-- ───────────────────────── Designs & uploads ─────────────────────────
create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  preview_path text,
  owner_id uuid references public.profiles (id) on delete set null,
  px_width int not null,
  px_height int not null,
  bytes int not null,
  mime text not null,
  created_at timestamptz not null default now()
);

create table public.designs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default 'My label',
  label_size_id text not null references public.label_sizes (id),
  product_id text references public.products (id),
  segment public.segment not null,
  doc jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index designs_owner_idx on public.designs (owner_id, updated_at desc);

-- ───────────────────────── Dealers ─────────────────────────
create table public.dealers (
  id uuid primary key references public.profiles (id) on delete cascade,
  status public.dealer_status not null default 'pending',
  full_name text not null,
  age int not null check (age between 18 and 100),
  address text not null,
  phone text not null,
  profession text not null,
  district_code text not null,
  aadhaar_last4 text not null check (aadhaar_last4 ~ '^[0-9]{4}$'),
  kyc_path text,
  kyc_mime text,
  consent_version text not null,
  consent_at timestamptz not null,
  commission_pct numeric(5, 2),
  ad_share_pct numeric(5, 2),
  approved_at timestamptz,
  approved_by uuid references public.profiles (id),
  rejected_reason text,
  -- DPDP: KYC files are deleted after this date (set when rejected or when the dealership ends).
  kyc_purge_after date,
  created_at timestamptz not null default now()
);
-- One active dealer per district.
create unique index dealers_one_per_district on public.dealers (district_code) where status = 'approved';

create table public.dealer_shops (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers (id) on delete cascade,
  name text not null,
  owner_name text,
  phone text not null,
  address text not null,
  pincode text,
  gstin text,
  district_code text not null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Orders ─────────────────────────
create sequence public.order_no_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique default ('HL' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || '-' || lpad(nextval('public.order_no_seq')::text, 5, '0')),
  customer_id uuid not null references public.profiles (id),
  placed_by_dealer_id uuid references public.dealers (id),
  shop_id uuid references public.dealer_shops (id),
  segment public.segment not null,
  status public.order_status not null default 'pending_payment',
  payment_plan public.payment_plan not null default 'full',
  taxable_paise int not null,
  cgst_paise int not null default 0,
  sgst_paise int not null default 0,
  igst_paise int not null default 0,
  total_paise int not null check (total_paise > 0),
  amount_paid_paise int not null default 0,
  amount_refunded_paise int not null default 0,
  delivery_date date not null,
  ship_name text not null,
  ship_phone text not null,
  ship_address text not null,
  ship_pincode text not null,
  district_code text not null,
  route_code text,
  buyer_gstin text,
  buyer_legal_name text,
  buyer_state_code text not null default '33',
  notes text,
  lang text not null default 'en' check (lang in ('en', 'ta')),
  invoice_no text unique,
  invoice_date date,
  design_approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_customer_idx on public.orders (customer_id, created_at desc);
create index orders_dealer_idx on public.orders (placed_by_dealer_id, created_at desc);
create index orders_route_idx on public.orders (district_code, route_code, delivery_date) where status in ('placed', 'design_approved', 'printed', 'packed');

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id text not null references public.products (id),
  label_size_id text not null references public.label_sizes (id),
  design_id uuid references public.designs (id) on delete set null,
  design jsonb not null, -- snapshot printed for this order
  qty int not null check (qty > 0),
  items int not null check (items > 0),
  unit_price_paise int not null,
  taxable_paise int not null,
  cgst_paise int not null,
  sgst_paise int not null,
  igst_paise int not null,
  total_paise int not null,
  hsn text not null,
  gst_rate_pct numeric(4, 2) not null,
  proof_pdf_path text,
  roll_pdf_path text,
  imposition jsonb
);
create index order_items_order_idx on public.order_items (order_id);

create table public.order_events (
  id bigserial primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  note text,
  actor_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

-- ───────────────────────── Payments ─────────────────────────
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  purpose text not null check (purpose in ('full', 'advance', 'balance')),
  provider text not null check (provider in ('razorpay', 'cash', 'upi_offline')),
  provider_order_id text unique,
  provider_payment_id text unique,
  amount_paise int not null check (amount_paise > 0),
  status public.payment_status not null default 'created',
  method text,
  error_code text,
  error_description text,
  refunded_paise int not null default 0,
  collected_by uuid references public.profiles (id),
  raw jsonb,
  created_at timestamptz not null default now(),
  captured_at timestamptz
);
create index payments_order_idx on public.payments (order_id);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id),
  order_id uuid not null references public.orders (id),
  amount_paise int not null check (amount_paise > 0),
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  provider_refund_id text unique,
  reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Every Razorpay webhook, stored once (idempotency by event id).
create table public.webhook_events (
  id text primary key,
  provider text not null default 'razorpay',
  event text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

create table public.invoice_counters (fy text primary key, last int not null default 0);

create or replace function public.next_invoice_seq(p_fy text) returns int
language sql security definer set search_path = public as $$
  insert into public.invoice_counters (fy, last) values (p_fy, 1)
  on conflict (fy) do update set last = public.invoice_counters.last + 1
  returning last
$$;

-- ───────────────────────── Production & logistics ─────────────────────────
create table public.print_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'printing', 'printed')),
  created_at timestamptz not null default now(),
  printed_at timestamptz,
  printed_by uuid references public.profiles (id)
);

create table public.pack_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'packed')),
  created_at timestamptz not null default now(),
  packed_at timestamptz,
  packed_by uuid references public.profiles (id)
);

create table public.pack_batch_counters (
  district_code text not null,
  pack_date date not null,
  route_code text not null,
  last int not null default 0,
  primary key (district_code, pack_date, route_code)
);

create or replace function public.next_pack_batch(p_district text, p_date date, p_route text) returns int
language sql security definer set search_path = public as $$
  insert into public.pack_batch_counters (district_code, pack_date, route_code, last) values (p_district, p_date, p_route, 1)
  on conflict (district_code, pack_date, route_code) do update set last = public.pack_batch_counters.last + 1
  returning last
$$;

create table public.trucks (
  id uuid primary key default gen_random_uuid(),
  reg_no text not null unique,
  name text,
  capacity_cases int not null default 200,
  active boolean not null default true
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  trip_date date not null,
  district_code text not null,
  route_code text not null,
  truck_id uuid not null references public.trucks (id),
  driver_id uuid not null references public.profiles (id),
  status text not null default 'planned' check (status in ('planned', 'loading', 'out', 'done')),
  created_at timestamptz not null default now()
);
create index trips_driver_idx on public.trips (driver_id, trip_date);

create table public.load_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  stop_seq int,
  load_seq int,
  status text not null default 'unassigned' check (status in ('unassigned', 'assigned', 'loaded', 'delivered')),
  created_at timestamptz not null default now()
);

create table public.packs (
  id uuid primary key default gen_random_uuid(),
  pack_no text not null unique check (pack_no ~ '^HL-[A-Z]{3}-[0-9]{6}-R[0-9]{1,2}-B[0-9]{3,4}$'),
  order_id uuid not null references public.orders (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  cases int not null default 1,
  status text not null default 'packed' check (status in ('packed', 'loaded', 'delivered', 'returned')),
  created_at timestamptz not null default now(),
  loaded_at timestamptz,
  delivered_at timestamptz,
  delivered_by uuid references public.profiles (id)
);
create index packs_order_idx on public.packs (order_id);

create table public.stock_entries (
  id bigserial primary key,
  pack_id uuid not null references public.packs (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  movement text not null check (movement in ('in', 'out')),
  location text not null default 'Mettur warehouse',
  ref text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id bigserial primary key,
  order_id uuid references public.orders (id) on delete cascade,
  channel text not null check (channel in ('sms', 'whatsapp')),
  recipient text not null,
  template text not null,
  body text,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_ref text,
  error text,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Dealer money & ads ─────────────────────────
create table public.advertisers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business text,
  phone text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.ad_bookings (
  id uuid primary key default gen_random_uuid(),
  district_code text not null,
  advertiser_id uuid not null references public.advertisers (id),
  dealer_id uuid references public.dealers (id),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  creative_path text,
  status public.ad_status not null default 'pending',
  amount_paise int not null check (amount_paise >= 0),
  paid boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  -- Only one approved/live ad per district for any day.
  exclude using gist (district_code with =, daterange(start_date, end_date, '[]') with &&) where (status in ('approved', 'live'))
);

create table public.dealer_ledger (
  id bigserial primary key,
  dealer_id uuid not null references public.dealers (id),
  kind text not null check (kind in ('commission', 'ad_share', 'payout', 'adjustment')),
  order_id uuid references public.orders (id),
  ad_booking_id uuid references public.ad_bookings (id),
  amount_paise int not null,
  note text,
  created_at timestamptz not null default now(),
  -- Commission / ad share is booked once per order or booking (NULLs, e.g. payouts, never clash).
  unique (kind, order_id),
  unique (kind, ad_booking_id)
);

-- ───────────────────────── Compliance ─────────────────────────
create table public.audit_log (
  id bigserial primary key,
  actor_id uuid references public.profiles (id),
  action text not null,
  entity text not null,
  entity_id text,
  meta jsonb,
  at timestamptz not null default now()
);

-- DPDP Act: data-principal requests (access, correction, erasure, grievance).
create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  phone text not null,
  kind text not null check (kind in ('access', 'correction', 'erasure', 'grievance', 'withdraw_consent')),
  details text,
  status text not null default 'open' check (status in ('open', 'done', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ───────────────────────── updated_at ─────────────────────────
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger t_profiles before update on public.profiles for each row execute function public.touch_updated_at();
create trigger t_designs before update on public.designs for each row execute function public.touch_updated_at();
create trigger t_orders before update on public.orders for each row execute function public.touch_updated_at();

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.label_sizes enable row level security;
alter table public.products enable row level security;
alter table public.prices enable row level security;
alter table public.routes enable row level security;
alter table public.uploads enable row level security;
alter table public.designs enable row level security;
alter table public.dealers enable row level security;
alter table public.dealer_shops enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.webhook_events enable row level security;
alter table public.invoice_counters enable row level security;
alter table public.print_orders enable row level security;
alter table public.pack_orders enable row level security;
alter table public.pack_batch_counters enable row level security;
alter table public.trucks enable row level security;
alter table public.trips enable row level security;
alter table public.load_orders enable row level security;
alter table public.packs enable row level security;
alter table public.stock_entries enable row level security;
alter table public.notifications enable row level security;
alter table public.advertisers enable row level security;
alter table public.ad_bookings enable row level security;
alter table public.dealer_ledger enable row level security;
alter table public.audit_log enable row level security;
alter table public.data_requests enable row level security;

-- Profiles: read/update your own (not your role); admins read all.
create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (full_name, gstin, district_code, default_address, marketing_opt_in) on public.profiles to authenticated;

-- Public catalogue: everyone reads, admins write.
create policy catalog_read_settings on public.app_settings for select using (key in ('business', 'regulatory'));
create policy catalog_read_sizes on public.label_sizes for select using (true);
create policy catalog_read_products on public.products for select using (true);
create policy catalog_read_prices on public.prices for select using (true);
create policy catalog_read_routes on public.routes for select using (true);
create policy admin_write_settings on public.app_settings for all using (public.is_admin()) with check (public.is_admin());
create policy admin_write_sizes on public.label_sizes for all using (public.is_admin()) with check (public.is_admin());
create policy admin_write_products on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy admin_write_prices on public.prices for all using (public.is_admin()) with check (public.is_admin());
create policy admin_write_routes on public.routes for all using (public.is_admin()) with check (public.is_admin());

-- Designs: owners only.
create policy designs_owner on public.designs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy uploads_owner_read on public.uploads for select using (owner_id = auth.uid() or public.is_admin());

-- Orders: the customer, the dealer who placed it, the driver carrying it, or an admin.
create or replace function public.can_see_order(p_order uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order and (
      o.customer_id = auth.uid()
      or o.placed_by_dealer_id = auth.uid()
      or public.is_admin()
      or exists (select 1 from public.load_orders l join public.trips t on t.id = l.trip_id where l.order_id = o.id and t.driver_id = auth.uid())
    )
  )
$$;
create policy orders_read on public.orders for select using (public.can_see_order(id));
create policy order_items_read on public.order_items for select using (public.can_see_order(order_id));
create policy order_events_read on public.order_events for select using (public.can_see_order(order_id));
create policy payments_read on public.payments for select using (public.can_see_order(order_id));
create policy refunds_read on public.refunds for select using (public.can_see_order(order_id));
create policy packs_read on public.packs for select using (public.can_see_order(order_id));
create policy load_orders_read on public.load_orders for select using (public.can_see_order(order_id));

-- Dealers: own record and own shops/ledger/ads.
create policy dealers_self on public.dealers for select using (id = auth.uid() or public.is_admin());
create policy dealer_shops_own on public.dealer_shops for all using (dealer_id = auth.uid() or public.is_admin()) with check (dealer_id = auth.uid() or public.is_admin());
create policy dealer_ledger_own on public.dealer_ledger for select using (dealer_id = auth.uid() or public.is_admin());
create policy ad_bookings_own on public.ad_bookings for select using (dealer_id = auth.uid() or public.is_admin());

-- Drivers: their own trips.
create policy trips_driver on public.trips for select using (driver_id = auth.uid() or public.is_admin());
create policy trucks_read on public.trucks for select using (public.my_role() in ('admin', 'driver'));

create policy data_requests_own on public.data_requests for select using (user_id = auth.uid() or public.is_admin());

-- Everything else (webhook_events, counters, notifications, audit_log, print/pack/stock tables,
-- advertisers) has no policy: only the server (service role) can touch it.

-- ───────────────────────── Storage ─────────────────────────
-- All buckets are private. Files are served through short-lived signed URLs from the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('uploads', 'uploads', false, 20971520, array['image/jpeg', 'image/png', 'image/webp']),
  ('print-files', 'print-files', false, 209715200, array['application/pdf']),
  ('invoices', 'invoices', false, 10485760, array['application/pdf']),
  ('ad-creatives', 'ad-creatives', false, 20971520, array['image/jpeg', 'image/png']),
  ('kyc', 'kyc', false, 10485760, array['application/octet-stream'])
on conflict (id) do nothing;
