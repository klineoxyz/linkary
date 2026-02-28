# REP QA checks

Use this checklist after REP logic or breakdown changes.

## 1) Create collab → done → verify REP changes for both

- Create a collab request between two profiles (A and B).
- Mark it as **done**.
- For both A and B: open profile, note REP (and optionally open REP breakdown).
- Trigger REP recompute (e.g. via admin backfill or wait for mutation hook).
- Reload profile: REP (and ProofOfWork / completed collabs in breakdown) should reflect the new done collab.

## 2) Leave reviews → verify REP changes again

- Leave a collab review for a profile.
- That profile’s REP should update: ProofOfWork (review quality, reviews volume) in breakdown should change; total REP may change.
- Recompute (or wait for mutation hook), then reload and confirm.

## 3) Toggle case study public → REP changes

- For a profile with a case study: set case study to **public**.
- REP should update (ProofOfWork / case studies score in breakdown).
- Set it back to **private**: REP should decrease accordingly.

## 4) Add/remove relation → REP changes

- Add an affiliate or ambassador relation for a profile.
- REP (NetworkTrust in breakdown) should increase after recompute.
- Remove the relation: NetworkTrust (and REP) should decrease.

## 5) REP breakdown matches stored rep_score

- On **/profile** and **/[username]**, click the REP pill to open the breakdown modal.
- Modal should show: REP total, SocialBase, ProofOfWork, NetworkTrust and their subcomponents.
- The **REP total** in the modal should match the **stored** rep_score shown on the page (and in DB).
- Breakdown is computed on demand (no write); it should match what `computeRep(..., { write: false })` returns.

## 6) Engagement input (avg_engagement_per_post)

- Profiles with X connected and rollups (e.g. after weekly tweet sync) should have `profiles.avg_engagement_per_post` set.
- REP SocialBase **engagement score** uses logScale100(avg_engagement_per_post, 5000).
- Strong engagement with fewer followers should score higher than weak engagement with many followers (no whale dominance).
