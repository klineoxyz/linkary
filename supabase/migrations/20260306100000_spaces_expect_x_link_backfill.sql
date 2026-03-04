-- Harden expect_x_link: backfill NULLs to false, ensure NOT NULL.
UPDATE public.spaces SET expect_x_link = false WHERE expect_x_link IS NULL;
ALTER TABLE public.spaces ALTER COLUMN expect_x_link SET DEFAULT false;
ALTER TABLE public.spaces ALTER COLUMN expect_x_link SET NOT NULL;
