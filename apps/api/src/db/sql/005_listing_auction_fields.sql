alter table listings
  add column if not exists auction_enabled boolean not null default false,
  add column if not exists auction_start_at timestamptz,
  add column if not exists auction_end_at timestamptz,
  add column if not exists auction_bidding_days int;

create index if not exists idx_listings_auction_end_at on listings(auction_end_at);
