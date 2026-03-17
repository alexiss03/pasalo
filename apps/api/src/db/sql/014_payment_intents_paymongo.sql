alter table payment_intents
  add column if not exists paymongo_checkout_id text,
  add column if not exists paymongo_checkout_url text,
  add column if not exists paymongo_last_status text,
  add column if not exists paymongo_payment_intent_id text,
  add column if not exists paymongo_raw jsonb;

create index if not exists idx_payment_intents_paymongo_checkout_id
  on payment_intents(paymongo_checkout_id);
