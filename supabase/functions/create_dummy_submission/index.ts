export const config = { verifyJWT: false };
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  BUCKET,
  createSecret,
  hashSecret,
  parseSubmission,
  readImage,
  SubmissionError,
} from "../_shared/submission-data.ts";
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, apikey, authorization, x-client-info",
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return json({ message: "Method not allowed" }, 405);
  }
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json();
      if (body?.action === "capabilities") {
        return json({ management: true, namedWeapons: true });
      }
      throw new SubmissionError("Unsupported action.");
    }
    const form = await req.formData();
    const payload = parseSubmission(form);
    const image = (await readImage(form.get("image"), true))!;
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      return json({ message: "Server configuration missing" }, 500);
    }
    const admin = createClient(url, key);
    const { count, error: countError } = await admin
      .from("dummy_submissions")
      .select("id", { count: "exact", head: true });
    if (countError) throw new Error("Submission count failed");
    if ((count ?? 0) >= 1000) {
      return json({ message: "Submissions are closed" }, 403);
    }
    const { data: row, error: insertError } = await admin
      .from("dummy_submissions")
      .insert({ ...payload, image_path: "pending", puzzle_pool: null })
      .select("id")
      .single();
    if (insertError || !row) throw new Error("Submission creation failed");
    const id = String(row.id);
    const secret = createSecret();
    const path = id + "/" + crypto.randomUUID() + "." + image.ext;
    try {
      const { error: tokenError } = await admin
        .from("submission_management")
        .insert({ submission_id: id, token_hash: await hashSecret(secret) });
      if (tokenError) throw new Error("Management code creation failed");
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(path, image.bytes, { contentType: image.contentType, upsert: false });
      if (uploadError) throw new Error("Image upload failed");
      const { error: updateError } = await admin
        .from("dummy_submissions")
        .update({ image_path: path, puzzle_pool: payload.puzzle_pool })
        .eq("id", id);
      if (updateError) throw new Error("Publishing submission failed");
    } catch (error) {
      await admin.storage.from(BUCKET).remove([path]);
      await admin.from("dummy_submissions").delete().eq("id", id);
      throw error;
    }
    return json({ submissionId: id, managementCode: id + "." + secret });
  } catch (error) {
    if (error instanceof SubmissionError) {
      return json({ message: error.message }, error.status);
    }
    console.error(
      "Create submission failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return json({ message: "Could not save the submission. Please try again." }, 500);
  }
});
