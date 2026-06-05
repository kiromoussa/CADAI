-- Add the unique constraint that ingest_embeddings.py relies on for upserts.
-- Without it, `on_conflict="jurisdiction,code_body,section"` raises
-- "no unique or exclusion constraint matching the ON CONFLICT specification".

-- 1. Remove any pre-existing duplicates, keeping the most recently created row.
delete from public.code_sections cs
using public.code_sections dup
where cs.jurisdiction = dup.jurisdiction
  and cs.code_body = dup.code_body
  and cs.section = dup.section
  and cs.created_at < dup.created_at;

-- Fallback for rows with identical created_at: keep the lowest id.
delete from public.code_sections cs
using public.code_sections dup
where cs.jurisdiction = dup.jurisdiction
  and cs.code_body = dup.code_body
  and cs.section = dup.section
  and cs.created_at = dup.created_at
  and cs.id > dup.id;

-- 2. Add the unique constraint.
alter table public.code_sections
  add constraint code_sections_jurisdiction_code_body_section_key
  unique (jurisdiction, code_body, section);
