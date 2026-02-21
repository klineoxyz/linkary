-- Onboarding: account type (Individual vs Company)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type text CHECK (account_type IN ('individual', 'company'));

COMMENT ON COLUMN public.profiles.account_type IS 'Set during onboarding: individual or company. Company users can create orgs and become owner.';
