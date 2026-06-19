-- =========================================================================
-- CNIT Notes Module - Nested Folders Schema Migration
-- =========================================================================

-- 1. Update note_folders table to support nested hierarchy
ALTER TABLE public.note_folders 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.note_folders(id) ON DELETE CASCADE;

-- 2. Add index on parent_id to optimize recursive querying
CREATE INDEX IF NOT EXISTS idx_note_folders_parent_id ON public.note_folders(parent_id);

-- 3. Update notes constraints to reference note_folders with ON DELETE SET NULL
ALTER TABLE public.notes
DROP CONSTRAINT IF EXISTS notes_folder_id_fkey,
ADD CONSTRAINT notes_folder_id_fkey 
  FOREIGN KEY (folder_id) 
  REFERENCES public.note_folders(id) 
  ON DELETE SET NULL;

-- 4. Create RPC function for recursive breadcrumb path computation
CREATE OR REPLACE FUNCTION public.get_folder_breadcrumbs(target_folder_id UUID)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    parent_id UUID,
    breadcrumb_path TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE folder_path AS (
        -- Anchor: Select the target folder
        SELECT f.id, f.name, f.parent_id, ARRAY[f.name::text] AS path
        FROM public.note_folders f
        WHERE f.id = target_folder_id
        
        UNION ALL
        
        -- Recursive: Go up the tree to find parents
        SELECT f.id, f.name, f.parent_id, f.name::text || p.path
        FROM public.note_folders f
        INNER JOIN folder_path p ON f.id = p.parent_id
    )
    SELECT p.id, p.name, p.parent_id, p.path
    FROM folder_path p;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
