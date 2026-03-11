create type role_application_status as enum ('pending', 'approved', 'rejected');

create table if not exists role_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  from_role user_role not null,
  requested_role user_role not null,
  reason text,
  status role_application_status not null default 'pending',
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requested_role <> from_role)
);

create unique index if not exists idx_role_applications_one_pending_per_role
  on role_applications(user_id, requested_role)
  where status = 'pending';

create index if not exists idx_role_applications_status_created
  on role_applications(status, created_at desc);
