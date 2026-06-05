-- Track translation timing and DWG retry state for stall recovery
alter table public.projects
  add column if not exists translation_started_at timestamptz,
  add column if not exists original_file_name text,
  add column if not exists translation_force_retried boolean not null default false,
  add column if not exists translation_force_retried_at timestamptz;
