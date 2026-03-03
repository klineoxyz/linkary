-- Enforce at most one spaces row per X Space ID (prevents duplicate synced spaces)
DROP INDEX IF EXISTS public.idx_spaces_x_space_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_x_space_id_unique
  ON public.spaces (x_space_id) WHERE x_space_id IS NOT NULL;

COMMENT ON COLUMN public.spaces.x_space_id IS 'X (Twitter) Space ID when synced from X; unique across DB.';
