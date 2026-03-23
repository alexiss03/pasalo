alter table listings
  add column if not exists viewing_availability_enabled boolean not null default false,
  add column if not exists viewing_availability_slots jsonb not null default '[]'::jsonb;

update listings
set
  viewing_availability_enabled = coalesce(viewing_availability_enabled, false),
  viewing_availability_slots = case
    when jsonb_typeof(viewing_availability_slots) = 'array' then viewing_availability_slots
    else '[]'::jsonb
  end;
