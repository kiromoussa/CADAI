-- Optional code_body filter for RAG + sheet-scoped violations

alter table public.violations
  add column if not exists sheet_guid text,
  add column if not exists discipline text;

create or replace function public.match_code_sections(
  query_embedding vector(1024),
  jurisdiction_filter text,
  match_count int default 20,
  code_body_filter text[] default null
)
returns table (
  id uuid,
  jurisdiction text,
  code_year int,
  code_body text,
  section text,
  title text,
  full_text text,
  summary text,
  applies_to text[],
  is_local_amendment boolean,
  parent_section text,
  similarity float
)
language sql stable
as $$
  select
    cs.id,
    cs.jurisdiction,
    cs.code_year,
    cs.code_body,
    cs.section,
    cs.title,
    cs.full_text,
    cs.summary,
    cs.applies_to,
    cs.is_local_amendment,
    cs.parent_section,
    1 - (cs.embedding <=> query_embedding) as similarity
  from public.code_sections cs
  where cs.jurisdiction = jurisdiction_filter
    and cs.embedding is not null
    and (
      code_body_filter is null
      or cardinality(code_body_filter) = 0
      or cs.code_body = any(code_body_filter)
    )
  order by cs.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_code_sections(vector, text, int, text[]) to authenticated;
grant execute on function public.match_code_sections(vector, text, int, text[]) to service_role;
