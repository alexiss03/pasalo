create type payment_intent_status as enum ('pending', 'paid', 'canceled');

create table if not exists payment_intents (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  requested_by_user_id uuid not null references users(id),
  payer_user_id uuid not null references users(id),
  payee_user_id uuid not null references users(id),
  amount_php numeric(14, 2) not null check (amount_php > 0),
  note text,
  status payment_intent_status not null default 'pending',
  paid_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (payer_user_id <> payee_user_id)
);

create index if not exists idx_payment_intents_conversation_created
  on payment_intents(conversation_id, created_at desc);

create index if not exists idx_payment_intents_payer_status
  on payment_intents(payer_user_id, status);
