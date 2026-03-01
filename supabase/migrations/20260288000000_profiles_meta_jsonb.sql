-- profiles.meta: jsonb for privacy toggles and pricing (no new tables).
-- Keys: public_location, public_pricing, pricing: { post: { price_usd, platforms, notes }, podcast: { ... } }

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}';

COMMENT ON COLUMN public.profiles.meta IS 'Optional: public_location (bool), public_pricing (bool), pricing (post/podcast with price_usd, platforms[], notes).';

COMMIT;
