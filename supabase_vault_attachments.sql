-- =========================================================================
-- CNIT Official Website - Vault Credentials File Attachment Support Migration
-- =========================================================================

-- 1. Add file attachment columns to public.credentials table
ALTER TABLE public.credentials ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE public.credentials ADD COLUMN IF NOT EXISTS file_name TEXT;

-- 2. Create private storage bucket for vault attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('vault_attachments', 'vault_attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS Policies for vault_attachments bucket
-- Drop policies if they already exist to prevent duplicate name errors
DROP POLICY IF EXISTS "Allow authenticated users to insert objects into vault_attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to select objects from vault_attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete objects from vault_attachments" ON storage.objects;

-- Policy to allow authenticated users to upload/insert files
CREATE POLICY "Allow authenticated users to insert objects into vault_attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vault_attachments');

-- Policy to allow authenticated users to read/select files
CREATE POLICY "Allow authenticated users to select objects from vault_attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'vault_attachments');

-- Policy to allow authenticated users to delete files
CREATE POLICY "Allow authenticated users to delete objects from vault_attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'vault_attachments');
