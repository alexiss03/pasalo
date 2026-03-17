alter table listings
  add column if not exists document_assistance_requested boolean not null default false,
  add column if not exists document_assistance_status text not null default 'not_requested',
  add column if not exists document_assistance_notes text,
  add column if not exists document_assistance_requested_at timestamptz,
  add column if not exists document_assistance_updated_at timestamptz;

create index if not exists idx_listings_document_assistance_status
  on listings(document_assistance_status);

create index if not exists idx_listings_document_assistance_requested
  on listings(document_assistance_requested);

update listings
set
  document_assistance_status = case
    when document_assistance_requested then coalesce(nullif(document_assistance_status, ''), 'requested')
    else 'not_requested'
  end,
  document_assistance_requested_at = case
    when document_assistance_requested and document_assistance_requested_at is null then now()
    else document_assistance_requested_at
  end,
  document_assistance_updated_at = coalesce(document_assistance_updated_at, now());
