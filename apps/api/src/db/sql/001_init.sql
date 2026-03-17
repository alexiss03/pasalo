create extension if not exists pgcrypto;

create type user_role as enum ('buyer', 'seller', 'agent', 'attorney', 'admin');
create type listing_status as enum ('draft', 'pending_review', 'live', 'paused', 'expired', 'rejected', 'archived');
create type property_type as enum ('condo', 'house_lot', 'lot_only');
create type verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
create type verification_doc_type as enum (
  'reservation_agreement',
  'soa',
  'id',
  'government_clearance_optional',
  'transfer_document',
  'title_or_tax_declaration',
  'authority_document'
);
create type ai_doc_auth_status as enum ('pass', 'review', 'fail');
create type document_review_status as enum ('pending', 'approved', 'rejected');
create type inquiry_status as enum ('open', 'qualified', 'closed');
create type viewing_status as enum ('proposed', 'accepted', 'rejected', 'rescheduled', 'completed');
create type deal_stage as enum ('inquiry', 'qualified', 'offer', 'developer_review', 'closed_won', 'closed_lost');

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text,
  auth_provider text not null,
  role user_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  user_id uuid primary key references users(id) on delete cascade,
  full_name text,
  phone text,
  city text,
  verification_status verification_status not null default 'unverified',
  verification_badge_shown boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(id) on delete cascade,
  property_type property_type not null,
  project_name text not null,
  developer_name text not null,
  location_city text not null,
  location_province text not null,
  floor_area_sqm numeric(10,2) not null,
  unit_number text,
  turnover_date date,
  title text not null,
  description text not null,
  status listing_status not null default 'draft',
  is_featured boolean not null default false,
  last_confirmed_at timestamptz,
  readiness_score int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists listing_financials (
  listing_id uuid primary key references listings(id) on delete cascade,
  original_price_php numeric(14,2) not null,
  equity_paid_php numeric(14,2) not null,
  remaining_balance_php numeric(14,2) not null,
  monthly_amortization_php numeric(14,2) not null,
  cash_out_price_php numeric(14,2) not null,
  est_total_cost_php numeric(14,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  media_type text not null,
  storage_key text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists listing_verifications (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  doc_type verification_doc_type not null,
  file_key text not null,
  ai_auth_status ai_doc_auth_status not null default 'review',
  ai_confidence numeric(5,4) not null default 0.5,
  ai_flags text[] not null default '{}'::text[],
  ai_checked_at timestamptz,
  status document_review_status not null default 'pending',
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table if not exists listing_status_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  from_status listing_status,
  to_status listing_status not null,
  changed_by uuid references users(id),
  changed_at timestamptz not null default now()
);

create table if not exists inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  buyer_user_id uuid not null references users(id) on delete cascade,
  message text,
  status inquiry_status not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  buyer_user_id uuid not null references users(id),
  seller_user_id uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_user_id uuid not null references users(id),
  body text not null,
  attachment_key text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists viewing_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  buyer_user_id uuid not null references users(id),
  seller_user_id uuid not null references users(id),
  proposed_at timestamptz not null,
  status viewing_status not null default 'proposed',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists deal_pipelines (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  buyer_user_id uuid not null references users(id),
  owner_user_id uuid not null references users(id),
  current_stage deal_stage not null default 'inquiry',
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists deal_stage_events (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references deal_pipelines(id) on delete cascade,
  from_stage deal_stage,
  to_stage deal_stage not null,
  changed_by uuid references users(id),
  changed_at timestamptz not null default now()
);

create table if not exists watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, listing_id)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  channel text not null,
  event_name text not null,
  payload jsonb not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  context jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_listings_status_city_province on listings(status, location_city, location_province);
create index if not exists idx_listings_owner on listings(owner_user_id);
create index if not exists idx_listings_last_confirmed on listings(last_confirmed_at desc);
create index if not exists idx_listing_financials_cash_out on listing_financials(cash_out_price_php);
create index if not exists idx_listing_financials_monthly on listing_financials(monthly_amortization_php);
create index if not exists idx_listing_verifications_ai_auth_status on listing_verifications(ai_auth_status);
create index if not exists idx_inquiries_listing on inquiries(listing_id);
create index if not exists idx_messages_conversation_created on messages(conversation_id, created_at desc);
create index if not exists idx_deals_current_stage on deal_pipelines(current_stage);
