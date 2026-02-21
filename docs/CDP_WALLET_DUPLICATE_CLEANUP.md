# CDP Wallet Duplicate Cleanup

If you have **two profiles with the same CDP wallet address** (e.g. one from X login, one from CDP login), use this to consolidate to a single correct user.

## 1. Decide which profile to keep

- **Keeper**: The account you want to use going forward (e.g. the one with `xinthi@gmail.com` or the one you sign in with most).
- **Other**: The duplicate you will remove or detach the wallet from.

From your screenshots:
- `6e82895f-fe48-47a3-a837-5e258881095a` – current app user (e.g. CDP / email).
- `bdd74100-fb07-409a-b235-943a9...` – has X connected (username `muazxinthi`, avatar, etc.).

If **6e82895f** is the keeper and **bdd74100** is the old one:

## 2. Move X connection to the keeper (already supported)

1. Log in as the **keeper** user (6e82895f).
2. Call **POST /api/integrations/x/claim** with that session’s Bearer token.
3. The claim endpoint will:
   - See the X identity on the current user.
   - Find the active social_accounts row for that X on the **other** user (bdd74100).
   - Revoke that row and create a new active row for the keeper (6e82895f).
4. Integrations will then show “Connected” for the keeper.

## 3. Remove the duplicate profile/wallet

**Option A – Clear wallet from the other profile (keep one wallet on keeper only)**

In Supabase SQL:

```sql
-- Replace with the profile id you want to *detach* the wallet from (the "other" one)
UPDATE public.profiles
SET cdp_wallet_address = NULL,
    cdp_wallet_chain = 'base',
    cdp_wallet_type = NULL,
    cdp_wallet_created_at = NULL
WHERE id = 'bdd74100-fb07-409a-b235-943a9...';
```

Then the same wallet can exist only on the keeper profile. The “other” profile stays in the DB but no longer has that CDP wallet.

**Option B – Delete the other profile (and optionally auth user)**

1. Run the UPDATE above to clear the wallet from the other profile (so the unique index doesn’t block you), **or** run it after if you’re deleting the profile.
2. Delete the profile row (cascades may remove related rows):

```sql
DELETE FROM public.profiles WHERE id = 'bdd74100-fb07-409a-b235-943a9...';
```

3. In Supabase Dashboard → Authentication → Users, delete the auth user with id `bdd74100-...` if you want that identity gone.

## 4. Apply migration (one wallet per address)

After there are no two profiles with the same `cdp_wallet_address`, run:

```bash
supabase db push
```

Migration `20260243000000_profiles_one_cdp_wallet_per_address.sql` adds a unique index so the same CDP wallet cannot be linked to two profiles again.

## 5. Going forward

- **CDP get-or-create** now returns **409** if the wallet is already linked to another profile, with message: *"This wallet is already linked to another Linkary account. Sign in with that account to use it, or disconnect the wallet there first."*
- **X claim** (Integrations self-heal or POST /api/integrations/x/claim) moves the X connection onto the current user when it was stored under another user_id.

So: **one CDP wallet → one profile**, and **one X identity → one profile** (after claim). Login with CDP or X should land on the correct single user once duplicates are cleaned and claim has been run for the keeper.
