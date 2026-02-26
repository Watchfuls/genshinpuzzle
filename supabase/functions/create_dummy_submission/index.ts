export const config = {
  verifyJWT: false,
};

// supabase/functions/create_dummy_submission/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getElementForCharacter } from "../_shared/character_elements.ts";
import type { Element } from "../_shared/character_elements.ts";

const MAX_BYTES = 1_048_576; // 1MB
const MAX_SUBMISSIONS = 1000;
const BUCKET = "submission-images";

const corsHeaders = {
  "access-control-allow-origin": "*", // or your exact site origin
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, apikey, authorization, x-client-info",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return new Response("Expected multipart/form-data", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Expect multipart/form-data:
    // - image: PNG file
    // - team0/team1/team2/team3: character names (strings)
    // - strongestHit: number (string)
    // - totalDps: number (string)
    // - genshinUid: optional string
    const form = await req.formData();

    const file = form.get("image");

    if (!(file instanceof File)) {
      return new Response("Missing image", {
        status: 400,
        headers: corsHeaders,
      });
    }
    if (file.size > MAX_BYTES) {
      return new Response("File too large", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Allow PNG or JPEG
    const nameLower = file.name?.toLowerCase?.() ?? "";
    const isPng = file.type === "image/png" || nameLower.endsWith(".png");
    const isJpeg =
      file.type === "image/jpeg" ||
      nameLower.endsWith(".jpg") ||
      nameLower.endsWith(".jpeg");

    // Some clients may send file.type as "" — extension fallback covers that.
    if (!isPng && !isJpeg) {
      return new Response("Only PNG and JPEG allowed", {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (file.size > MAX_BYTES) {
      return new Response("File too large", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Determine canonical upload type + extension
    const uploadContentType = isPng ? "image/png" : "image/jpeg";
    const ext = isPng ? "png" : "jpg";

    const team0 = form.get("team0");
    const team1 = form.get("team1");
    const team2 = form.get("team2");
    const team3 = form.get("team3");

    const c0 = form.get("c0");
    const c1 = form.get("c1");
    const c2 = form.get("c2");
    const c3 = form.get("c3");

    const r0 = form.get("r0");
    const r1 = form.get("r1");
    const r2 = form.get("r2");
    const r3 = form.get("r3");

    const strongestHitRaw = form.get("strongestHit");
    const totalDpsRaw = form.get("totalDps");
    const uidRaw = form.get("genshinUid");

    if (
      typeof team0 !== "string" ||
      typeof team1 !== "string" ||
      typeof team2 !== "string" ||
      typeof team3 !== "string"
    ) {
      return new Response("Missing team fields", {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (typeof strongestHitRaw !== "string") {
      return new Response("Missing strongestHit", {
        status: 400,
        headers: corsHeaders,
      });
    }
    if (typeof totalDpsRaw !== "string") {
      return new Response("Missing totalDps", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const team = [team0, team1, team2, team3].map((s) => s.trim());

    if (team.some((s) => !s)) {
      return new Response("Team fields must be non-empty", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Derive elements server-side (do not trust client)
    const derivedElements = team.map((name) => getElementForCharacter(name));
    const unknown = team.filter((name, i) => derivedElements[i] === "None");

    // Validate: all characters must be known and have a real element
    if (unknown.length > 0) {
      return new Response(`Unknown character(s): ${unknown.join(", ")}`, {
        status: 400,
        headers: corsHeaders,
      });
    }

    // If you want strict typing, cast after validation
    const elementsTyped = derivedElements as Element[];

    if (new Set(team).size !== 4) {
      return new Response("Team must not contain duplicates", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const C_ALLOWED = new Set(["Hidden", "C0", "C1", "C2", "C3", "C4", "C5", "C6"]);
    const R_ALLOWED = new Set(["Hidden", "R0", "R1", "R2", "R3", "R4", "R5"]);

    const constellations = [c0, c1, c2, c3].map((v) =>
      typeof v === "string" && C_ALLOWED.has(v) ? v : "Hidden",
    );

    const refinements = [r0, r1, r2, r3].map((v) =>
      typeof v === "string" && R_ALLOWED.has(v) ? v : "Hidden",
    );

    const strongest_hit = Number(strongestHitRaw);
    const total_dps = Number(totalDpsRaw);
    if (!Number.isFinite(strongest_hit) || strongest_hit <= 0) {
      return new Response("Invalid strongestHit", {
        status: 400,
        headers: corsHeaders,
      });
    }
    if (!Number.isFinite(total_dps) || total_dps <= 0) {
      return new Response("Invalid totalDps", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const genshin_uid =
      typeof uidRaw === "string" && uidRaw.trim().length > 0 ? uidRaw.trim() : null;

    // SUPABASE_URL is available in the Functions runtime
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) {
      return new Response("Missing SUPABASE_URL", {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Put your service role key in Function env vars as: SERVICE_ROLE_KEY
    // (avoid SUPABASE_* secret names)
    const serviceKey =
      Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) {
      return new Response("Missing SERVICE_ROLE_KEY", {
        status: 500,
        headers: corsHeaders,
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Enforce cap
    const { count, error: countErr } = await admin
      .from("dummy_submissions")
      .select("id", { count: "exact", head: true });

    if (countErr) {
      return new Response("Count failed", {
        status: 500,
        headers: corsHeaders,
      });
    }
    if ((count ?? 0) >= MAX_SUBMISSIONS) {
      return new Response("Submissions are closed", {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Insert row first to get ID
    const { data: inserted, error: insertErr } = await admin
      .from("dummy_submissions")
      .insert({
        image_path: "pending",
        team,
        strongest_hit,
        total_dps,
        genshin_uid,
        elements: elementsTyped,
        constellations,
        refinements,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      return new Response(
        JSON.stringify({
          message: "Insert failed",
          error: insertErr,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    const submissionId = String(inserted.id);
    const path = `${submissionId}.${ext}`;

    const arrayBuf = await file.arrayBuffer();
    const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, arrayBuf, {
      contentType: uploadContentType,
      upsert: false,
    });

    if (uploadErr) {
      await admin.from("dummy_submissions").delete().eq("id", submissionId);
      return new Response("Upload failed", {
        status: 500,
        headers: corsHeaders,
      });
    }

    const { error: updateErr } = await admin
      .from("dummy_submissions")
      .update({ image_path: path })
      .eq("id", submissionId);

    if (updateErr) {
      return new Response("Update failed", {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ submissionId }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(`Server error: ${String(e)}`, {
      status: 500,
      headers: corsHeaders,
    });
  }
});
