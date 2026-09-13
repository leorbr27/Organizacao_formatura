-- Cole este SQL em Supabase > SQL Editor e clique em RUN.
create extension if not exists pgcrypto;

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  type text not null default 'decision',
  statement text not null,
  status text not null default 'voting',
  priority text not null default 'medium',
  created_at timestamptz not null default now()
);

create table if not exists public.topic_versions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  version integer not null,
  statement text not null,
  created_at timestamptz not null default now(),
  unique(topic_id,version)
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  voter_name text not null,
  vote text not null check(vote in ('yes','no')),
  created_at timestamptz not null default now(),
  unique(topic_id,voter_name)
);

alter table public.topics enable row level security;
alter table public.topic_versions enable row level security;
alter table public.votes enable row level security;

drop policy if exists "topics public read" on public.topics;
drop policy if exists "topics public insert" on public.topics;
drop policy if exists "topics public update" on public.topics;
drop policy if exists "versions public all" on public.topic_versions;
drop policy if exists "votes public read" on public.votes;
drop policy if exists "votes public insert" on public.votes;
drop policy if exists "votes public update" on public.votes;

create policy "topics public read" on public.topics for select using (true);
create policy "topics public insert" on public.topics for insert with check (true);
create policy "topics public update" on public.topics for update using (true) with check (true);

create policy "versions public all" on public.topic_versions for all using (true) with check (true);

create policy "votes public read" on public.votes for select using (true);
create policy "votes public insert" on public.votes for insert with check (true);
create policy "votes public update" on public.votes for update using (true) with check (true);

-- Exemplos iniciais (opcionais):
insert into public.topics(title,category,type,statement,status,priority)
values
('Professores convidados','Professores','decision','Serão convidados 6 professores para a festa.','voting','high'),
('Acompanhantes dos professores','Professores','decision','Caso um professor queira levar familiares ou acompanhantes, esses acompanhantes deverão pagar o valor definido para o convite.','voting','high');
