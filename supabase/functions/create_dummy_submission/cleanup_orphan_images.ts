// Run with: deno run -A scripts/cleanup_orphan_images.ts
// @deno-types="https://esm.sh/@supabase/supabase-js@2"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY =
  Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const BUCKET = "submission-images";

// Set true first to see what would be deleted
const DRY_RUN = false;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY env vars");
  Deno.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// 1) Fetch referenced image paths
const { data: rows, error: dbErr } = await admin
  .from("dummy_submissions")
  .select("image_path")
  .neq("image_path", "pending")
  .not("image_path", "is", null);

if (dbErr) throw dbErr;

const referenced = new Set((rows ?? []).map((r) => r.image_path as string));

// 2) List all objects (paginate)
const toDelete: string[] = [];
let offset = 0;
const limit = 1000;

while (true) {
  const { data: files, error: listErr } = await admin.storage
    .from(BUCKET)
    .list("", { limit, offset });

  if (listErr) throw listErr;
  if (!files || files.length === 0) break;

  for (const f of files) {
    // Only consider top-level pngs like "123.png"
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".png") && !lower.endsWith(".jpg") && !lower.endsWith(".jpeg")) continue;

    if (!referenced.has(f.name)) {
      toDelete.push(f.name);
    }
  }

  if (files.length < limit) break;
  offset += limit;
}

console.log(`Referenced in DB: ${referenced.size}`);
console.log(`Orphan files found: ${toDelete.length}`);

if (DRY_RUN) {
  console.log("DRY RUN - first 50 orphans:");
  console.log(toDelete.slice(0, 50));
  Deno.exit(0);
}

// 3) Delete orphans
if (toDelete.length > 0) {
  const { error: delErr } = await admin.storage.from(BUCKET).remove(toDelete);
  if (delErr) throw delErr;
}

console.log("Deleted orphan files:", toDelete.length);
