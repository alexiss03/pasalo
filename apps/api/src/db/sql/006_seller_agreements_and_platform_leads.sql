create table if not exists listing_seller_agreements (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references listings(id) on delete cascade,
  seller_user_id uuid not null references users(id) on delete cascade,
  agreement_version text not null default 'seller_listing_agreement_v1',
  commission_rate_pct numeric(5,2) not null,
  lead_validity_months int not null,
  payment_due_days int not null,
  lead_definition text not null,
  commission_clause text not null,
  payment_clause text not null,
  signed_name text not null,
  signature_method text not null,
  accepted_at timestamptz not null default now(),
  signer_ip text,
  signer_user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists platform_leads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  buyer_user_id uuid not null references users(id) on delete cascade,
  buyer_name text,
  buyer_phone text,
  buyer_email text not null,
  source text not null default 'platform',
  first_inquiry_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(listing_id, buyer_user_id)
);

create index if not exists idx_platform_leads_listing on platform_leads(listing_id, first_inquiry_at desc);
create index if not exists idx_platform_leads_buyer on platform_leads(buyer_user_id, first_inquiry_at desc);
