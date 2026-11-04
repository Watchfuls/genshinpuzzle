import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  BUCKET,
  parseManagementCode,
  parseSubmission,
  readImage,
  SubmissionError,
} from "./submission-data.ts";
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers":
    "content-type, apikey, authorization, x-client-info",
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      ...cors,
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
export function createManagementHandler(createAdmin: () => SupabaseClient) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") {
      return json({ message: "Method not allowed" }, 405);
    }
    try {
      const multipart = req.headers.get("content-type")?.includes(
        "multipart/form-data",
      );
      const form = multipart ? await req.formData() : null;
      const body = form ? Object.fromEntries(form.entries()) : await req.json();
      const action = body.action;
      if (action === "capabilities") {
        return json({ management: true, namedWeapons: true });
      }
      if (!["load", "update", "delete"].includes(action)) {
        throw new SubmissionError("Unsupported action.");
      }
      const { id, tokenHash } = await parseManagementCode(body.managementCode);
      const admin = createAdmin();
      const { data: ownership, error: ownerError } = await admin.from(
        "submission_management",
      ).select("revision").eq("submission_id", id).eq("token_hash", tokenHash)
        .maybeSingle();
      if (ownerError) throw new Error("Management lookup failed");
      if (!ownership) {
        throw new SubmissionError(
          "Invalid management code or submission no longer exists.",
          403,
        );
      }
      const { data: row, error: rowError } = await admin.from(
        "dummy_submissions",
      )
        .select(
          "id,team,elements,constellations,refinements,weapons,strongest_hit,total_dps,genshin_uid,image_path,featured_date,puzzle_pool",
        ).eq("id", id).maybeSingle();
      if (rowError || !row) {
        throw new SubmissionError("Submission not found.", 404);
      }
      const { data: daily, error: dailyError } = await admin.from(
        "daily_guesser",
      )
        .select("date").eq("submission_id", id).limit(1);
      if (dailyError) throw new Error("Daily history lookup failed");
      const readOnly = !!row.featured_date || !!daily?.length;
      if (action === "load") {
        const { data: image, error: imageError } =
          row.image_path && row.image_path !== "pending"
            ? await admin.storage.from(BUCKET).createSignedUrl(
              row.image_path,
              3600,
            )
            : { data: null, error: null };
        if (imageError) throw new Error("Image link failed");
        const { image_path: _, ...publicRow } = row;
        return json({
          submission: {
            ...publicRow,
            revision: Number(ownership.revision),
            image_url: image?.signedUrl ?? null,
            readOnly,
          },
        });
      }
      if (readOnly) {
        throw new SubmissionError(
          "This submission has already appeared as a Daily puzzle and cannot be changed.",
          409,
        );
      }
      const revision = Number(body.revision);
      if (!Number.isSafeInteger(revision) || revision < 1) {
        throw new SubmissionError("Reload this submission before changing it.");
      }
      let payload: Record<string, unknown> | null = null;
      let newPath: string | null = null;
      if (action === "update") {
        if (!form) throw new SubmissionError("Expected form data.");
        payload = parseSubmission(form);
        const image = await readImage(form.get("image"), false);
        if (image) {
          newPath = id + "/" + crypto.randomUUID() + "." + image.ext;
          const { error } = await admin.storage.from(BUCKET).upload(
            newPath,
            image.bytes,
            { contentType: image.contentType, upsert: false },
          );
          if (error) throw new Error("Image upload failed");
          payload.image_path = newPath;
        }
      }
      const { data: result, error } = await admin.rpc(
        "manage_dummy_submission",
        {
          p_id: id,
          p_token_hash: tokenHash,
          p_action: action,
          p_expected_revision: revision,
          p_payload: payload,
        },
      );
      if (error) {
        if (newPath) await admin.storage.from(BUCKET).remove([newPath]);
        if (error.code === "28000") {
          throw new SubmissionError("Invalid management code.", 403);
        }
        if (["40001", "55000"].includes(error.code)) {
          throw new SubmissionError(error.message, 409);
        }
        throw new Error("Submission change failed");
      }
      const oldPath = result?.old_image_path;
      if (
        (action === "delete" || newPath) && oldPath && oldPath !== "pending"
      ) {
        const { error: cleanup } = await admin.storage.from(BUCKET).remove([
          oldPath,
        ]);
        if (cleanup) console.error("Submission image cleanup pending", id);
      }
      return json(
        action === "delete" ? { deleted: true } : {
          saved: true,
          revision: Number(result.revision),
          puzzle_pool: payload?.puzzle_pool,
        },
      );
    } catch (error) {
      if (error instanceof SubmissionError) {
        return json({ message: error.message }, error.status);
      }
      console.error(
        "Manage submission failed",
        error instanceof Error ? error.message : "Unknown error",
      );
      return json({
        message: "Could not complete the request. Please try again.",
      }, 500);
    }
  };
}
