-- Allow status 'planned' for manually created spaces (not yet synced from X)
ALTER TABLE public.spaces DROP CONSTRAINT IF EXISTS spaces_status_check;
ALTER TABLE public.spaces ADD CONSTRAINT spaces_status_check
  CHECK (status IN ('planned', 'scheduled', 'live', 'ended', 'cancelled'));
