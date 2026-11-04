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

    // (2) Assign atomically with edits/deletes and concurrent requests for this date.
    if (!submissionId) {
      if (dateWanted !== today) {
        return new Response("No puzzle for that date", {
          status: 404,
          headers: corsHeaders,
        });
      }

      const { data: assignedId, error: assignError } = await admin.rpc("assign_daily_puzzle", {
        p_date: dateWanted,
      });
      if (assignError) {
        return new Response("Daily puzzle assignment failed", {
          status: 500,
          headers: corsHeaders,
        });
      }
      if (!assignedId) {
        return new Response("No unused submissions left", {
          status: 404,
          headers: corsHeaders,
        });
      }
      submissionId = String(assignedId);
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
