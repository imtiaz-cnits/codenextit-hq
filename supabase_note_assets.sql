-- Create note_assets bucket in Supabase storage (if not already existing)
insert into storage.buckets (id, name, public)
values ('note_assets', 'note_assets', true)
on conflict (id) do nothing;


-- Policy to allow authenticated users to upload/insert assets
create policy "Allow authenticated users to insert objects into note_assets"
on storage.objects for insert
to authenticated
with check (bucket_id = 'note_assets');

-- Policy to allow authenticated users to select/read assets
create policy "Allow authenticated users to select objects from note_assets"
on storage.objects for select
to authenticated
using (bucket_id = 'note_assets');
