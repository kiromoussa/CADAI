-- Storage policies for floor-plans and analysis-thumbnails buckets
-- Create buckets first in Supabase dashboard (private), then run this SQL.

-- floor-plans: users can manage files in their own folder
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

-- analysis-thumbnails: users can manage files in their own folder
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
