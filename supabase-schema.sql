-- Run this in your Supabase SQL Editor to create the save_slots table

create table if not exists save_slots (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  slot_number int not null check (slot_number between 1 and 4),
  label_name text not null default '',
  turn int not null default 0,
  game_state jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, slot_number)
);

-- Row-level security: users can only access their own saves
alter table save_slots enable row level security;

create policy "Users manage own saves" on save_slots
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
