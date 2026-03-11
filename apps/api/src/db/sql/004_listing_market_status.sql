create type listing_transaction_status as enum (
  'available',
  'auctioned',
  'in_deal',
  'buying_in_progress',
  'bought',
  'released'
);

create type listing_transfer_status as enum (
  'not_started',
  'document_review',
  'developer_approval',
  'contract_signing',
  'transfer_in_process',
  'transfer_completed',
  'transfer_blocked'
);

alter table listings
  add column if not exists transaction_status listing_transaction_status not null default 'available',
  add column if not exists transfer_status listing_transfer_status not null default 'not_started',
  add column if not exists active_buyer_user_id uuid references users(id);

create index if not exists idx_listings_transaction_status on listings(transaction_status);
