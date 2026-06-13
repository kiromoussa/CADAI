-- FirstPass resolution-first schema: readiness on analyses, pathways on violations

alter table public.analyses
  add column if not exists readiness_score integer,
  add column if not exists readiness_recommendation text,
  add column if not exists readiness_data jsonb;

alter table public.violations
  add column if not exists resolution_pathways jsonb,
  add column if not exists recommended_pathway integer,
  add column if not exists recommended_action text,
  add column if not exists accepted_pathway jsonb,
  add column if not exists requires_manual_review boolean not null default false;
