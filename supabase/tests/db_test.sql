-- Database tests: run against a fresh database with the migration + seed applied.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/db_test.sql
-- Every check raises an exception on failure.
begin;

insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-00000000000a', '+919000000001'),
  ('00000000-0000-0000-0000-00000000000b', '+919000000002'),
  ('00000000-0000-0000-0000-00000000000c', '+919000000003');

do $$ begin
  if (select count(*) from public.profiles) <> 3 then raise exception 'profiles not created by trigger'; end if;
  if (select role from public.profiles where phone = '+919000000001') <> 'customer' then raise exception 'default role must be customer'; end if;
end $$;

-- Counters
do $$ begin
  if public.next_pack_batch('SLM', '2026-11-08', 'R2') <> 1 then raise exception 'first batch must be 1'; end if;
  if public.next_pack_batch('SLM', '2026-11-08', 'R2') <> 2 then raise exception 'batch must increment'; end if;
  if public.next_pack_batch('SLM', '2026-11-08', 'R1') <> 1 then raise exception 'batch is per route'; end if;
  if public.next_invoice_seq('2026-27') <> 1 or public.next_invoice_seq('2026-27') <> 2 then raise exception 'invoice sequence'; end if;
end $$;

-- Orders for two customers
insert into public.orders (id, customer_id, segment, taxable_paise, total_paise, delivery_date, ship_name, ship_phone, ship_address, ship_pincode, district_code)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'event', 1000, 1180, '2026-11-08', 'A', '9000000001', 'Address A long enough', '636303', 'SLM'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'shop', 1000, 1180, '2026-11-08', 'B', '9000000002', 'Address B long enough', '636303', 'SLM');

do $$ begin
  if (select order_no from public.orders where id = '10000000-0000-0000-0000-000000000001') !~ '^HL[0-9]{6}-[0-9]{5}$' then raise exception 'order number format'; end if;
end $$;

-- Pack numbers must match HL-[district]-[YYMMDD]-[route]-[batch]
insert into public.order_items (id, order_id, product_id, label_size_id, design, qty, items, unit_price_paise, taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise, hsn, gst_rate_pct)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'water-500-plastic', 'pet-500', '{}', 10, 240, 1300, 1000, 90, 90, 0, 1180, '2201', 18);
insert into public.packs (pack_no, order_id, order_item_id) values ('HL-SLM-261108-R2-B014', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001');
do $$ begin
  begin
    insert into public.packs (pack_no, order_id, order_item_id) values ('SLM-261108-R2-14', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001');
    raise exception 'bad pack number accepted';
  exception when check_violation then null;
  end;
end $$;

-- One approved dealer per district
insert into public.dealers (id, status, full_name, age, address, phone, profession, district_code, aadhaar_last4, consent_version, consent_at)
values ('00000000-0000-0000-0000-00000000000a', 'approved', 'Dealer A', 40, 'Mettur address', '9000000001', 'Trader', 'SLM', '5246', 'v1', now()),
       ('00000000-0000-0000-0000-00000000000b', 'pending', 'Dealer B', 35, 'Mettur address', '9000000002', 'Trader', 'SLM', '1234', 'v1', now());
do $$ begin
  begin
    update public.dealers set status = 'approved' where id = '00000000-0000-0000-0000-00000000000b';
    raise exception 'second dealer approved in the same district';
  exception when unique_violation then null;
  end;
end $$;

-- One ad per district per day
insert into public.advertisers (id, name, phone) values ('30000000-0000-0000-0000-000000000001', 'Adv', '9000000009');
insert into public.ad_bookings (district_code, advertiser_id, start_date, end_date, status, amount_paise) values ('SLM', '30000000-0000-0000-0000-000000000001', '2026-11-01', '2026-11-30', 'approved', 100000);
do $$ begin
  begin
    insert into public.ad_bookings (district_code, advertiser_id, start_date, end_date, status, amount_paise) values ('SLM', '30000000-0000-0000-0000-000000000001', '2026-11-15', '2026-12-15', 'approved', 100000);
    raise exception 'overlapping ad accepted';
  exception when exclusion_violation then null;
  end;
end $$;
-- A pending (not yet approved) overlapping booking is allowed, and another district is independent.
insert into public.ad_bookings (district_code, advertiser_id, start_date, end_date, status, amount_paise) values ('SLM', '30000000-0000-0000-0000-000000000001', '2026-11-15', '2026-12-15', 'pending', 0);
insert into public.ad_bookings (district_code, advertiser_id, start_date, end_date, status, amount_paise) values ('ERD', '30000000-0000-0000-0000-000000000001', '2026-11-15', '2026-12-15', 'approved', 0);

-- Commission is booked once per order
insert into public.dealer_ledger (dealer_id, kind, order_id, amount_paise) values ('00000000-0000-0000-0000-00000000000a', 'commission', '10000000-0000-0000-0000-000000000002', 100);
do $$ begin
  begin
    insert into public.dealer_ledger (dealer_id, kind, order_id, amount_paise) values ('00000000-0000-0000-0000-00000000000a', 'commission', '10000000-0000-0000-0000-000000000002', 100);
    raise exception 'duplicate commission accepted';
  exception when unique_violation then null;
  end;
end $$;

-- ── Row Level Security as a signed-in browser (role authenticated) ──
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  if (select count(*) from public.orders) <> 0 then raise exception 'RLS: customer C sees other orders'; end if;
  if (select count(*) from public.dealers) <> 0 then raise exception 'RLS: customer sees dealer KYC rows'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'RLS: customer sees other profiles'; end if;
  if (select count(*) from public.products) = 0 then raise exception 'RLS: catalogue must be public'; end if;
  if (select count(*) from public.webhook_events) <> 0 then raise exception 'RLS: webhook events visible'; end if;
end $$;
-- A customer cannot make themselves admin.
do $$ begin
  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c';
    raise exception 'RLS: customer changed own role';
  exception when insufficient_privilege then null;
  end;
end $$;
-- A customer cannot change prices.
update public.prices set unit_price_paise = 1 where product_id = 'water-500-plastic';
reset role;
do $$ begin
  if (select min(unit_price_paise) from public.prices where product_id = 'water-500-plastic') = 1 then raise exception 'RLS: customer changed a price'; end if;
end $$;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  if (select count(*) from public.orders) <> 1 then raise exception 'RLS: customer A must see exactly their order'; end if;
  if (select count(*) from public.packs) <> 1 then raise exception 'RLS: customer A must see their packs'; end if;
  if (select count(*) from public.dealer_ledger) <> 1 then raise exception 'RLS: dealer sees own ledger'; end if;
end $$;
reset role;

select 'ALL DATABASE TESTS PASSED' as result;
rollback;
