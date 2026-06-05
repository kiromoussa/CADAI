-- Storage policies for floor-plans and analysis-thumbnails buckets
-- Create buckets first in Supabase dashboard (private), then run this SQL.

create policy "Users can upload own floor plans"
  on storage.objects for insert
  with check (
    bucket_id = 'floor-plans'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can read own floor plans"
  on storage.objects for select
  using (
    bucket_id = 'floor-plans'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update own floor plans"
  on storage.objects for update
  using (
    bucket_id = 'floor-plans'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own floor plans"
  on storage.objects for delete
  using (
    bucket_id = 'floor-plans'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can upload own thumbnails"
  on storage.objects for insert
  with check (
    bucket_id = 'analysis-thumbnails'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can read own thumbnails"
  on storage.objects for select
  using (
    bucket_id = 'analysis-thumbnails'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update own thumbnails"
  on storage.objects for update
  using (
    bucket_id = 'analysis-thumbnails'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own thumbnails"
  on storage.objects for delete
  using (
    bucket_id = 'analysis-thumbnails'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can insert own violations" on public.violations
  for insert with check (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );
