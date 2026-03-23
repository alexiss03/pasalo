alter table listings
  add column if not exists viewing_duration_minutes integer not null default 30,
  add column if not exists viewing_interval_minutes integer not null default 30;

update listings
set
  viewing_duration_minutes = case
    when viewing_duration_minutes between 15 and 240 then viewing_duration_minutes
    else 30
  end,
  viewing_interval_minutes = case
    when viewing_interval_minutes between 5 and 240 then viewing_interval_minutes
    else 30
  end;
