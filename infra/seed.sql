with upsert_user as (
  insert into users (email, password_hash, auth_provider, role)
  values ('seller.demo@pasalo.ph', '$2a$12$Qx3Ec7xWl7BvwX2R3HI9K.wK1dbVx8YWhv14jArlTc95xJ3AdxpvW', 'email', 'seller')
  on conflict (email)
  do update set updated_at = now()
  returning id
), ensured_user as (
  select id from upsert_user
  union all
  select id from users where email = 'seller.demo@pasalo.ph' limit 1
), upsert_profile as (
  insert into profiles (user_id, full_name, phone, city, verification_status, verification_badge_shown)
  select id, 'Demo Seller', '09171234567', 'Makati', 'verified', true from ensured_user
  on conflict (user_id)
  do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    city = excluded.city,
    verification_status = excluded.verification_status,
    verification_badge_shown = excluded.verification_badge_shown,
    updated_at = now()
  returning user_id
), upsert_listing as (
  insert into listings (
    owner_user_id,
    property_type,
    project_name,
    developer_name,
    location_city,
    location_province,
    floor_area_sqm,
    unit_number,
    turnover_date,
    title,
    description,
    status,
    is_featured,
    last_confirmed_at,
    readiness_score
  )
  select
    id,
    'condo',
    'Avida Towers Cloverleaf',
    'Ayala Land',
    'Quezon City',
    'Metro Manila',
    26,
    '12B',
    '2027-06-01',
    'QC Condo Pasalo - Avida Cloverleaf 1BR',
    'Verified pasalo listing with updated SOA and transfer-ready documents.',
    'live',
    true,
    now(),
    88
  from ensured_user
  where not exists (
    select 1 from listings where title = 'QC Condo Pasalo - Avida Cloverleaf 1BR'
  )
  returning id
), ensured_listing as (
  select id from upsert_listing
  union all
  select id from listings where title = 'QC Condo Pasalo - Avida Cloverleaf 1BR' limit 1
)
insert into listing_financials (
  listing_id,
  original_price_php,
  equity_paid_php,
  remaining_balance_php,
  monthly_amortization_php,
  cash_out_price_php,
  est_total_cost_php
)
select
  id,
  3000000,
  350000,
  2650000,
  18000,
  250000,
  2900000
from ensured_listing
on conflict (listing_id)
do update set
  original_price_php = excluded.original_price_php,
  equity_paid_php = excluded.equity_paid_php,
  remaining_balance_php = excluded.remaining_balance_php,
  monthly_amortization_php = excluded.monthly_amortization_php,
  cash_out_price_php = excluded.cash_out_price_php,
  est_total_cost_php = excluded.est_total_cost_php,
  updated_at = now();

insert into listing_media (listing_id, media_type, storage_key, is_primary)
select
  l.id,
  'image',
  m.storage_key,
  m.is_primary
from (
  select id from listings where title = 'QC Condo Pasalo - Avida Cloverleaf 1BR' limit 1
) l
cross join (
  values
    ('https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=1400&q=80', true),
    ('https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1400&q=80', false),
    ('https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1400&q=80', false)
) as m(storage_key, is_primary)
where not exists (
  select 1
  from listing_media lm
  where lm.listing_id = l.id
    and lm.storage_key = m.storage_key
);

insert into users (email, password_hash, auth_provider, role)
values (
  'admin2@pasalo.ph',
  '$2b$12$2hKmRQa/9ojoqlO/GvgMpOcnwCDLaCIE0d/0tTqo3o8JYe3OIzmMK',
  'email',
  'admin'
)
on conflict (email)
do update set
  password_hash = excluded.password_hash,
  auth_provider = excluded.auth_provider,
  role = excluded.role,
  updated_at = now();

insert into profiles (user_id, full_name, phone, city, verification_status, verification_badge_shown)
select
  id,
  'Admin 2',
  '09179990002',
  'Makati',
  'verified',
  true
from users
where email = 'admin2@pasalo.ph'
on conflict (user_id)
do update set
  full_name = excluded.full_name,
  phone = excluded.phone,
  city = excluded.city,
  verification_status = excluded.verification_status,
  verification_badge_shown = excluded.verification_badge_shown,
  updated_at = now();
