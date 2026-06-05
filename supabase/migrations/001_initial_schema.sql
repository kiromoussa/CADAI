-- CodeComply initial schema
-- Run in Supabase SQL editor or via: supabase db push

create extension if not exists "uuid-ossp";

-- Users table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  full_name text,
  firm_name text,
  license_number text,
  aps_access_token text,
  aps_refresh_token text,
  aps_token_expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Projects table
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  city text not null,
  state text not null,
  project_type text not null default 'residential',
  source_type text not null,
  pdf_storage_path text,
  aps_urn text,
  aps_hub_id text,
  aps_project_id text,
  aps_item_id text,
  translation_status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Analyses table
create table public.analyses (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text default 'pending',
  source_type text not null,
  city text not null,
  state text not null,
  project_type text not null,
  extracted_properties jsonb,
  violation_count integer default 0,
  warning_count integer default 0,
  pass_count integer default 0,
  claude_model text,
  tokens_used integer,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Violations table
create table public.violations (
  id uuid default uuid_generate_v4() primary key,
  analysis_id uuid references public.analyses(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete cascade not null,
  severity text not null,
  code_section text not null,
  code_title text not null,
  code_requirement text not null,
  finding text not null,
  recommendation text not null,
  element_id text,
  element_name text,
  element_location text,
  measured_value text,
  required_value text,
  confidence text default 'high',
  created_at timestamptz default now()
);

-- Code database
create table public.code_sections (
  id uuid default uuid_generate_v4() primary key,
  jurisdiction text not null,
  code_year integer not null,
  code_body text not null,
  section text not null,
  title text not null,
  full_text text not null,
  summary text not null,
  applies_to text[] default '{}',
  is_local_amendment boolean default false,
  parent_section text,
  created_at timestamptz default now()
);

-- RLS Policies
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.analyses enable row level security;
alter table public.violations enable row level security;
alter table public.code_sections enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can manage own projects" on public.projects
  for all using (auth.uid() = user_id);

create policy "Users can manage own analyses" on public.analyses
  for all using (auth.uid() = user_id);

create policy "Users can read own violations" on public.violations
  for select using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

create policy "Authenticated users can read codes" on public.code_sections
  for select using (auth.role() = 'authenticated');

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, firm_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'firm_name'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Storage buckets (run separately in dashboard or via storage API):
-- 1. floor-plans — private
-- 2. analysis-thumbnails — private
