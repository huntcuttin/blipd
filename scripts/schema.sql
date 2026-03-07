-- ══════════════════════════════════════════════════════════════
-- blippd – Supabase schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ══════════════════════════════════════════════════════════════

-- ── Games ─────────────────────────────────────────────────────
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  publisher text not null,
  franchise text,
  cover_art text not null,
  current_price numeric(10,2) not null,
  original_price numeric(10,2) not null,
  discount integer not null default 0,
  is_on_sale boolean not null default false,
  is_all_time_low boolean not null default false,
  release_date text not null,
  release_status text not null default 'released',
  metacritic_score integer,
  sale_end_date text,
  price_history jsonb not null default '[]'::jsonb,
  nsuid text unique,
  nintendo_url text,
  switch2_nsuid text,
  upgrade_pack_nsuid text,
  upgrade_pack_price numeric(10,2),
  is_suppressed boolean not null default false,
  release_date_source text,
  last_price_check timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_games_nsuid on games (nsuid) where nsuid is not null;
create index if not exists idx_games_last_price_check on games (last_price_check asc nulls first);

alter table games enable row level security;
create policy "Games are publicly readable"
  on games for select using (true);

-- ── Franchises ────────────────────────────────────────────────
create table if not exists franchises (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  game_count integer not null default 0,
  logo text not null,
  created_at timestamptz not null default now()
);

alter table franchises enable row level security;
create policy "Franchises are publicly readable"
  on franchises for select using (true);

-- ── User game follows ─────────────────────────────────────────
create table if not exists user_game_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

alter table user_game_follows enable row level security;
create policy "Users can view own game follows"
  on user_game_follows for select using (auth.uid() = user_id);
create policy "Users can insert own game follows"
  on user_game_follows for insert with check (auth.uid() = user_id);
create policy "Users can delete own game follows"
  on user_game_follows for delete using (auth.uid() = user_id);

-- ── User franchise follows ────────────────────────────────────
create table if not exists user_franchise_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  franchise_id uuid not null references franchises(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, franchise_id)
);

alter table user_franchise_follows enable row level security;
create policy "Users can view own franchise follows"
  on user_franchise_follows for select using (auth.uid() = user_id);
create policy "Users can insert own franchise follows"
  on user_franchise_follows for insert with check (auth.uid() = user_id);
create policy "Users can delete own franchise follows"
  on user_franchise_follows for delete using (auth.uid() = user_id);

-- ── Alerts ────────────────────────────────────────────────────
create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  type text not null,
  headline text not null,
  subtext text not null,
  created_at timestamptz not null default now()
);

alter table alerts enable row level security;
create policy "Alerts are publicly readable"
  on alerts for select using (true);

-- ── User alert status ─────────────────────────────────────────
create table if not exists user_alert_status (
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_id uuid not null references alerts(id) on delete cascade,
  read boolean not null default false,
  dismissed boolean not null default false,
  remind_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, alert_id)
);

alter table user_alert_status enable row level security;
create policy "Users can view own alert status"
  on user_alert_status for select using (auth.uid() = user_id);
create policy "Users can upsert own alert status"
  on user_alert_status for insert with check (auth.uid() = user_id);
create policy "Users can update own alert status"
  on user_alert_status for update using (auth.uid() = user_id);

-- ── User profiles ───────────────────────────────────────────
create table if not exists user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  console_preference text,
  updated_at timestamptz not null default now()
);

alter table user_profiles enable row level security;
create policy "Users can view own profile"
  on user_profiles for select using (auth.uid() = user_id);
create policy "Users can insert own profile"
  on user_profiles for insert with check (auth.uid() = user_id);
create policy "Users can update own profile"
  on user_profiles for update using (auth.uid() = user_id);

-- ── Notification log ────────────────────────────────────────
create table if not exists notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_id uuid references alerts(id) on delete cascade,
  channel text not null default 'email',
  status text not null default 'sent',
  error text,
  created_at timestamptz not null default now()
);
