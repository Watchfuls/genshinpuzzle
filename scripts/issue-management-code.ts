// Generate only after verifying the original submitter. Output is private.
// No database connection or write occurs in this script.
import {
  createSecret,
  hashSecret,
} from "../supabase/functions/_shared/submission-data.ts";
const id = Deno.args[0];
if (
  !id ||
  !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
) {
  throw new Error(
    "Usage: deno run scripts/issue-management-code.ts <verified-submission-uuid>",
  );
}
const secret = createSecret();
console.log("Private management code: " + id + "." + secret);
console.log("Review this SQL before running it as the site owner:");
console.log(
  "insert into public.submission_management(submission_id,token_hash) values ('" +
    id + "','" + await hashSecret(secret) +
    "') on conflict(submission_id) do nothing returning submission_id;",
);
console.log(
  "If no row is returned, ownership already exists. Do not distribute this new code.",
);
