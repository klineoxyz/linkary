-- Lightweight launch telemetry for activation funnel visibility.
-- Best-effort event logging only; no user-facing flow should depend on this table.

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source_app text not null check (source_app in ('web', 'crm')),
  event_name text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_type text null,
  effective_plan text null,
  x_connected boolean null,
  has_profile boolean null,
  properties jsonb not null default '{}'::jsonb
);

create index if not exists idx_product_events_created_at on public.product_events (created_at desc);
create index if not exists idx_product_events_event_name_created_at on public.product_events (event_name, created_at desc);
create index if not exists idx_product_events_user_id_created_at on public.product_events (user_id, created_at desc);
create index if not exists idx_product_events_source_app_created_at on public.product_events (source_app, created_at desc);

alter table public.product_events enable row level security;

-- Authenticated users may only write their own events.
drop policy if exists "product_events_insert_own" on public.product_events;
create policy "product_events_insert_own"
on public.product_events
for insert
to authenticated
with check (auth.uid() = user_id);

