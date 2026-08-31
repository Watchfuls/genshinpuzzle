// supabase/functions/get_daily_puzzle/index.ts
export const config = { verifyJWT: false }; // (L2)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"; // (L4)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"; // (L5)

const BUCKET = "submission-images"; // (L7)

const corsHeaders = {
  // (L9)
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type, apikey, authorization, x-client-info",
};

function todayUTCDateString(): string {
  // (L16)
  // "YYYY-MM-DD" in UTC
  return new Date().toISOString().slice(0, 10);
}

serve(async (req) => {
  // (L21)
  if (req.method === "OPTIONS") {
    // (L22)
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "GET") {
    // (L25)
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL"); // (L30)
    const serviceKey =
      Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      // (L35)
      return new Response("Missing SUPABASE_URL or SERVICE_ROLE_KEY", {
        status: 500,
        headers: corsHeaders,
      });
    }

    const admin = createClient(supabaseUrl, serviceKey); // (L43)

    const today = todayUTCDateString(); // (L45)

    const url = new URL(req.url); // (new)
    const requestedDate = url.searchParams.get("date")?.slice(0, 10) || null; // (new)
    const dateWanted = requestedDate ?? today; // (new)

    // (1) If today's puzzle already exists, use it (L48)
    const { data: existingDaily, error: existingErr } = await admin
      .from("daily_guesser")
      .select("submission_id")
      .eq("date", dateWanted)
      .maybeSingle();

    if (existingErr) {
      return new Response("daily_guesser lookup failed", {
        status: 500,
        headers: corsHeaders,
      });
    }

    let submissionId: string | null = existingDaily?.submission_id ?? null;

    // (2) If not, pick a random unused submission (featured_date is null) and insert today (REPLACE L62–L119)
    if (!submissionId) {
      if (dateWanted !== today) {
        return new Response("No puzzle for that date", {
          status: 404,
          headers: corsHeaders,
        });
      }

      // 2a) Count/pick pool: prefer 'Daily', fallback to NULL (unassigned)
      const poolsToTry: Array<"Daily" | null> = ["Daily", null];

      let pickedPool: "Daily" | null = null;
      let nUnused = 0;

      for (const pool of poolsToTry) {
        let q = admin
          .from("dummy_submissions")
          .select("id", { count: "exact", head: true })
          .is("featured_date", null);

        q = pool === null ? q.is("puzzle_pool", null) : q.eq("puzzle_pool", pool);

        const { count, error } = await q;

        if (error) {
          return new Response("dummy_submissions unused count failed", {
            status: 500,
            headers: corsHeaders,
          });
        }

        const n = count ?? 0;
        if (n > 0) {
          pickedPool = pool;
          nUnused = n;
          break;
        }
      }

      if (nUnused === 0) {
        return new Response("No unused submissions left", {
          status: 404,
          headers: corsHeaders,
        });
      }

      // 2b) Random offset within chosen pool
      const offset = Math.floor(Math.random() * nUnused);

      // 2c) Fetch one unused row (stable order) from chosen pool
      let pickQuery = admin
        .from("dummy_submissions")
        .select("id")
        .is("featured_date", null);

      pickQuery =
        pickedPool === null
          ? pickQuery.is("puzzle_pool", null)
          : pickQuery.eq("puzzle_pool", pickedPool);

      const { data: pick, error: pickErr } = await pickQuery
        .order("id", { ascending: true })
        .range(offset, offset)
        .maybeSingle();

      if (pickErr || !pick?.id) {
        return new Response("Failed to pick unused submission", {
          status: 500,
          headers: corsHeaders,
        });
      }

      // IMPORTANT: set submissionId to the picked id
      submissionId = String(pick.id);

      // 2d) Insert today's daily row first (race-safe)
      const { error: insErr } = await admin
        .from("daily_guesser")
        .insert({ date: dateWanted, submission_id: submissionId });

      if (insErr) {
        // likely unique conflict on date; re-fetch the winner and use it
        const { data: retryDaily, error: retryErr } = await admin
          .from("daily_guesser")
          .select("submission_id")
          .eq("date", dateWanted)
          .maybeSingle();

        if (retryErr || !retryDaily?.submission_id) {
          return new Response("Failed to lock daily puzzle", {
            status: 500,
            headers: corsHeaders,
          });
        }

        submissionId = String(retryDaily.submission_id);
      } else {
        // 2e) Only the request that "won" the insert sets featured_date
        const { error: featErr } = await admin
          .from("dummy_submissions")
          .update({ featured_date: dateWanted })
          .eq("id", submissionId);

        if (featErr) {
          return new Response("Failed to set featured_date", {
            status: 500,
            headers: corsHeaders,
          });
        }
      }

    }

    const { data: prevRow } = await admin
      .from("daily_guesser")
      .select("date")
      .lt("date", dateWanted)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: nextRow } = await admin
      .from("daily_guesser")
      .select("date")
      .gt("date", dateWanted)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle();

    const prev_date = prevRow?.date ?? null;
    const next_date = nextRow?.date ?? null;

    // (3) Load the puzzle row (L121)
    const { data: row, error: rowErr } = await admin
      .from("dummy_submissions")
      .select(
        "id, team, elements, strongest_hit, total_dps, image_path, constellations, refinements, genshin_uid, created_at",
      )
      .eq("id", submissionId)
      .maybeSingle();

    if (rowErr || !row) {
      return new Response("Failed to load puzzle row", {
        status: 500,
        headers: corsHeaders,
      });
    }

    // (4) Signed image url (L137)
    let image_url: string | null = null;

    if (row.image_path && row.image_path !== "pending") {
      const { data: signed, error: signErr } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(row.image_path, 60 * 60);

      if (!signErr) image_url = signed?.signedUrl ?? null;
    }

    return new Response(
      JSON.stringify({
        ...row,
        image_url,
        date: dateWanted,
        prev_date,
        next_date,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(`Server error: ${String(e)}`, {
      status: 500,
      headers: corsHeaders,
    });
  }
});
