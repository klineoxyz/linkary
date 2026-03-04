-- Banner "Not linked to X yet": show when space was created with Create on X and x_space_id is still NULL.
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS expect_x_link boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.spaces.expect_x_link IS 'True when created with Create on X; used to show link banner until x_space_id is set.';
