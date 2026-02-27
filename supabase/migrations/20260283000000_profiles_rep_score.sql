-- P11.5: REP score (0–100) stored on profiles. Replaces UI display of reputation_index.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rep_score integer;

COMMENT ON COLUMN public.profiles.rep_score IS 'REP 0–100: SocialBase + ProofOfWork + NetworkTrust. Computed on mutations (reviews, collab done, case studies, relations).';
