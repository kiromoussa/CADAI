-- Canvas boards, nodes, code ingest jobs, and viewer annotations

create type public.canvas_node_type as enum (
  'pdf',
  'forge',
  'code_ingest',
  'group',
  'note'
);

create type public.code_ingest_status as enum (
  'queued',
  'processing',
  'complete',
  'error'
);

-- Boards (Excalidraw scenes)
create table public.canvas_boards (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete set null,
  title text not null default 'Untitled board',
  default_city text,
  default_state text,
  default_project_type text default 'residential',
  scene_json jsonb not null default '{"elements":[],"appState":{},"files":{}}'::jsonb,
  thumbnail_path text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.canvas_nodes (
  id uuid default uuid_generate_v4() primary key,
  board_id uuid references public.canvas_boards(id) on delete cascade not null,
  excalidraw_element_id text not null,
  node_type public.canvas_node_type not null,
  x double precision not null default 0,
  y double precision not null default 0,
  width double precision not null default 400,
  height double precision not null default 300,
  project_id uuid references public.projects(id) on delete set null,
  storage_path text,
  aps_urn text,
  analysis_id uuid references public.analyses(id) on delete set null,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (board_id, excalidraw_element_id)
);

create table public.code_ingest_jobs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  board_id uuid references public.canvas_boards(id) on delete set null,
  node_id uuid references public.canvas_nodes(id) on delete set null,
  status public.code_ingest_status not null default 'queued',
  storage_path text not null,
  jurisdiction text,
  city text,
  state text,
  code_year integer,
  sections_count integer default 0,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  completed_at timestamptz
);

create table public.analysis_annotations (
  id uuid default uuid_generate_v4() primary key,
  analysis_id uuid references public.analyses(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  sheet_guid text,
  scene_json jsonb not null default '{"elements":[],"appState":{},"files":{}}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (analysis_id, sheet_guid)
);

alter table public.analyses
  add column if not exists canvas_node_id uuid references public.canvas_nodes(id) on delete set null;

alter table public.projects
  add column if not exists board_id uuid references public.canvas_boards(id) on delete set null;

create index canvas_boards_user_id_idx on public.canvas_boards(user_id);
create index canvas_nodes_board_id_idx on public.canvas_nodes(board_id);
create index code_ingest_jobs_user_id_idx on public.code_ingest_jobs(user_id);
create index analysis_annotations_analysis_id_idx on public.analysis_annotations(analysis_id);

-- RLS
alter table public.canvas_boards enable row level security;
alter table public.canvas_nodes enable row level security;
alter table public.code_ingest_jobs enable row level security;
alter table public.analysis_annotations enable row level security;

create policy "Users can manage own boards" on public.canvas_boards
  for all using (auth.uid() = user_id);

create policy "Users can manage nodes on own boards" on public.canvas_nodes
  for all using (
    board_id in (
      select id from public.canvas_boards where user_id = auth.uid()
    )
  );

create policy "Users can manage own code ingest jobs" on public.code_ingest_jobs
  for all using (auth.uid() = user_id);

create policy "Users can manage own analysis annotations" on public.analysis_annotations
  for all using (auth.uid() = user_id);

-- Storage policies for code-ingest bucket (create bucket in dashboard first)
create policy "Users can upload own code ingest files"
  on storage.objects for insert
  with check (
    bucket_id = 'code-ingest'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can read own code ingest files"
  on storage.objects for select
  using (
    bucket_id = 'code-ingest'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own code ingest files"
  on storage.objects for delete
  using (
    bucket_id = 'code-ingest'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
