-- Billing: package_purchases table (one row per successful checkout; purchase_id for attribution).
-- Optional: stripe_subscription_id on subscriptions for future portal/cancel.
CREATE TABLE IF NOT EXISTS public.package_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  stripe_checkout_session_id text UNIQUE NOT NULL,
  stripe_subscription_id text,
  package_type text NOT NULL,
  amount_cents int,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_package_purchases_org ON public.package_purchases (org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_package_purchases_stripe_session ON public.package_purchases (stripe_checkout_session_id);

COMMENT ON TABLE public.package_purchases IS 'One row per successful org package checkout. id is used as purchase_id for invite package attribution.';

-- Allow org owner/admin to read their org purchases (for billing history later).
ALTER TABLE public.package_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "package_purchases_select_org_admin" ON public.package_purchases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = package_purchases.org_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

-- Insert/update only via service role (webhook). No INSERT policy for authenticated; webhook uses service role.

-- Optional: stripe_subscription_id on subscriptions (for future cancel/portal).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN stripe_subscription_id text;
  END IF;
END $$;
