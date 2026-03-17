create table if not exists developers (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into developers (name, is_active, sort_order)
values
  ('Ayala Land', true, 10),
  ('SM Development Corporation', true, 20),
  ('Megaworld', true, 30),
  ('Robinsons Land', true, 40),
  ('Filinvest Land', true, 50),
  ('DMCI Homes', true, 60),
  ('Vista Land', true, 70),
  ('Camella Homes', true, 80),
  ('Federal Land', true, 90),
  ('Rockwell Land', true, 100),
  ('AboitizLand', true, 110),
  ('Ortigas Land', true, 120)
on conflict (name) do update
set
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

create index if not exists idx_developers_active_sort on developers(is_active, sort_order, name);
