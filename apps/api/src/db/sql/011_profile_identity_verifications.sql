create table if not exists profile_identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  platform_identity_code text unique not null,
  id_file_key text not null,
  selfie_file_key text not null,
  authority_document_file_key text,
  provider text not null default 'pasalo_internal',
  status document_review_status not null default 'pending',
  ai_auth_status ai_doc_auth_status not null default 'review',
  ai_confidence numeric(5,4) not null default 0.5,
  ai_flags text[] not null default '{}'::text[],
  rejection_reason text,
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profile_identity_verifications_user_created
  on profile_identity_verifications(user_id, created_at desc);
