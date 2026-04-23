
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Sets (a DJ set / EP project)
create table public.sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled set',
  intention text,
  vision_notes text,
  occasion text,
  cover_image_url text,
  ideal_arc text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sets enable row level security;
create policy "sets_select_own" on public.sets for select using (auth.uid() = user_id);
create policy "sets_insert_own" on public.sets for insert with check (auth.uid() = user_id);
create policy "sets_update_own" on public.sets for update using (auth.uid() = user_id);
create policy "sets_delete_own" on public.sets for delete using (auth.uid() = user_id);

create index sets_user_id_idx on public.sets(user_id);

-- Tracks
create type public.track_source as enum ('spotify', 'drive', 'upload', 'manual');

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets(id) on delete cascade,
  position integer not null default 0,
  source public.track_source not null,
  -- Source references
  spotify_track_id text,
  drive_file_id text,
  upload_url text,
  -- Metadata
  title text not null,
  artist text,
  duration_seconds numeric,
  bpm numeric,
  camelot_key text, -- e.g. "8A", "9B"
  energy numeric, -- 0-1 (Spotify) or 1-10 normalized
  danceability numeric,
  valence numeric,
  -- Cue points (seconds)
  cue_in numeric,
  cue_out numeric,
  -- User notes
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tracks enable row level security;

create policy "tracks_select_own" on public.tracks for select
  using (exists (select 1 from public.sets s where s.id = tracks.set_id and s.user_id = auth.uid()));
create policy "tracks_insert_own" on public.tracks for insert
  with check (exists (select 1 from public.sets s where s.id = tracks.set_id and s.user_id = auth.uid()));
create policy "tracks_update_own" on public.tracks for update
  using (exists (select 1 from public.sets s where s.id = tracks.set_id and s.user_id = auth.uid()));
create policy "tracks_delete_own" on public.tracks for delete
  using (exists (select 1 from public.sets s where s.id = tracks.set_id and s.user_id = auth.uid()));

create index tracks_set_id_idx on public.tracks(set_id);
create index tracks_position_idx on public.tracks(set_id, position);

-- Transition notes (between two consecutive tracks)
create table public.transition_notes (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets(id) on delete cascade,
  from_track_id uuid not null references public.tracks(id) on delete cascade,
  to_track_id uuid not null references public.tracks(id) on delete cascade,
  note text,
  quality text, -- 'smooth' | 'workable' | 'abrupt'
  created_at timestamptz not null default now()
);

alter table public.transition_notes enable row level security;

create policy "transition_notes_select_own" on public.transition_notes for select
  using (exists (select 1 from public.sets s where s.id = transition_notes.set_id and s.user_id = auth.uid()));
create policy "transition_notes_insert_own" on public.transition_notes for insert
  with check (exists (select 1 from public.sets s where s.id = transition_notes.set_id and s.user_id = auth.uid()));
create policy "transition_notes_update_own" on public.transition_notes for update
  using (exists (select 1 from public.sets s where s.id = transition_notes.set_id and s.user_id = auth.uid()));
create policy "transition_notes_delete_own" on public.transition_notes for delete
  using (exists (select 1 from public.sets s where s.id = transition_notes.set_id and s.user_id = auth.uid()));

-- Sound effects placed on transitions
create table public.sound_effects (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets(id) on delete cascade,
  from_track_id uuid not null references public.tracks(id) on delete cascade,
  to_track_id uuid not null references public.tracks(id) on delete cascade,
  label text not null,
  source public.track_source not null,
  drive_file_id text,
  upload_url text,
  created_at timestamptz not null default now()
);

alter table public.sound_effects enable row level security;

create policy "sound_effects_select_own" on public.sound_effects for select
  using (exists (select 1 from public.sets s where s.id = sound_effects.set_id and s.user_id = auth.uid()));
create policy "sound_effects_insert_own" on public.sound_effects for insert
  with check (exists (select 1 from public.sets s where s.id = sound_effects.set_id and s.user_id = auth.uid()));
create policy "sound_effects_update_own" on public.sound_effects for update
  using (exists (select 1 from public.sets s where s.id = sound_effects.set_id and s.user_id = auth.uid()));
create policy "sound_effects_delete_own" on public.sound_effects for delete
  using (exists (select 1 from public.sets s where s.id = sound_effects.set_id and s.user_id = auth.uid()));

-- AI co-pilot chat messages
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "chat_messages_select_own" on public.chat_messages for select
  using (exists (select 1 from public.sets s where s.id = chat_messages.set_id and s.user_id = auth.uid()));
create policy "chat_messages_insert_own" on public.chat_messages for insert
  with check (exists (select 1 from public.sets s where s.id = chat_messages.set_id and s.user_id = auth.uid()));
create policy "chat_messages_delete_own" on public.chat_messages for delete
  using (exists (select 1 from public.sets s where s.id = chat_messages.set_id and s.user_id = auth.uid()));

create index chat_messages_set_id_idx on public.chat_messages(set_id, created_at);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sets_updated_at before update on public.sets
  for each row execute function public.set_updated_at();
create trigger tracks_updated_at before update on public.tracks
  for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
