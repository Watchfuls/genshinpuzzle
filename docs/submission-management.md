# Submission management and named weapons

## Deploy in this order

1. Review and apply supabase/migrations/20261104010000_submission_management.sql to the intended project. Test on a staging database when one is available. Existing rows receive null weapon names.
2. Deploy manage_dummy_submission, create_dummy_submission, backfill_puzzle_pool, and get_daily_puzzle. The create form checks capabilities on both management and creation endpoints before submitting. Daily assignment now uses an atomic database function so it serializes with edits and deletions.
3. Publish the frontend after the functions are ready. Verify creation, editing and deletion with a deliberately created test submission. Nothing in these instructions creates a test submission automatically.

## Ownership

Management codes contain the public submission UUID plus a random 32-byte secret. Only a SHA-256 hash is stored in the RLS-protected submission_management table; anon and authenticated users have no table grants. Codes are returned at creation and saved in this browser when possible. Users should copy a backup. Requests carry codes in POST bodies, never URL query strings. Management responses use Cache-Control: no-store.

Historical submissions do not have proof of ownership. Never accept a public submission ID as authorization. After independently verifying the original submitter, the site owner can run scripts/issue-management-code.ts with that UUID. This prints a private code and SQL INSERT for manual review, performs no database writes, and does not overwrite existing ownership. Do not commit or publish its output.

## Changes and compatibility

Users can edit team, constellations, refinements, named weapons, damage values, UID, and optionally replace the screenshot. Omitting a new screenshot keeps the existing one. Historical Hidden values are retained until explicitly changed. Weapons are mandatory for every new submission and edit, with R1-R5 refinements beside each weapon. Existing unnamed weapons retain their old classification and can still be viewed, but must be filled in before saving an edit. Selecting a weapon upgrades a legacy R0 placeholder to R1. Dragged characters carry their selected weapon and C/R values; replacement resets them.

Elements and Daily/Endless eligibility are derived server-side. Named five-star weapons enter Endless; three/four-star weapons support refinements in Daily. Existing constellation rules are retained. Backfill shares the same classifier.

Already featured Daily submissions are read-only, protecting published puzzle history. A service-role-only RPC checks the token, row revision, and Daily references under row locks before updates/deletions. Stale changes return 409. Deletion cascades the ownership entry. Images are removed after a successful database change; failures are logged for operator cleanup. Rejected replacements leave the original image intact.

## Metadata

256 named weapons were collected November 4, 2026 from the Sword, Claymore, Polearm, Bow, and Catalyst tables on the Genshin Impact Wiki: https://genshin-impact.fandom.com/wiki/Weapon/List . Character weapon types use the same verified data as the clues. Keep weapon_catalog.ts and character_weapons.ts updated for future releases. The patch updater still generates character_elements.ts. Unknown or mismatched weapon names are rejected rather than guessed.

## Checks

Run `deno test --allow-env --allow-read=supabase/functions supabase/functions/_shared/submission-data_test.ts supabase/functions/_shared/manage-submission-handler_test.ts supabase/functions/submission_upload_test.ts` and `deno check supabase/functions/create_dummy_submission/index.ts supabase/functions/manage_dummy_submission/index.ts supabase/functions/backfill_puzzle_pool/index.ts supabase/functions/get_daily_puzzle/index.ts`. Build the frontend and check the create/edit/delete flows with mocked requests. Test the migration in staging when available.
