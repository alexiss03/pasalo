alter table listing_financials
  add column if not exists remaining_amortization_months int not null default 0,
  add column if not exists available_in_pagibig boolean not null default false,
  add column if not exists available_in_house_loan boolean not null default false;
