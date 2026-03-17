create table if not exists mobile_capture_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  field_type text not null check (field_type in ('id', 'selfie', 'authority_document')),
  session_token text unique not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'expired', 'canceled')),
  captured_file_key text,
  captured_file_name text,
  expires_at timestamptz not null,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mobile_capture_sessions_user_status_created
  on mobile_capture_sessions(user_id, status, created_at desc);

create index if not exists idx_mobile_capture_sessions_expires
  on mobile_capture_sessions(expires_at);
