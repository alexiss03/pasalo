alter type verification_doc_type add value if not exists 'transfer_document';
alter type verification_doc_type add value if not exists 'title_or_tax_declaration';
alter type verification_doc_type add value if not exists 'authority_document';

do $$
begin
  create type ai_doc_auth_status as enum ('pass', 'review', 'fail');
exception
  when duplicate_object then null;
end $$;

alter table listing_verifications
  add column if not exists ai_auth_status ai_doc_auth_status not null default 'review',
  add column if not exists ai_confidence numeric(5,4) not null default 0.5,
  add column if not exists ai_flags text[] not null default '{}'::text[],
  add column if not exists ai_checked_at timestamptz;

create index if not exists idx_listing_verifications_ai_auth_status
  on listing_verifications(ai_auth_status);
