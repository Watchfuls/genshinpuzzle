export const config = { verifyJWT: false };

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type, apikey, authorization, x-client-info",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return new Response("Missing env", {
      status: 500,
      headers: corsHeaders,
    });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    global: {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  });

  // 1) count
  const { count, error: countErr } = await admin
    .from("dummy_submissions")
    .select("id", { count: "exact", head: true })
    .eq("puzzle_pool", "Endless");
  if (countErr) {
    return new Response("Count failed", {
      status: 500,
      headers: corsHeaders,
    });
  }

  const n = count ?? 0;
  if (n === 0) {
    return new Response("No unused submissions", {
      status: 404,
      headers: corsHeaders,
    });
  }

  // 2) random offset
  const offset = Math.floor(Math.random() * n);

  // 3) fetch one row
  const { data, error } = await admin
    .from("dummy_submissions")
    .select("id, team, elements, strongest_hit, total_dps, image_path, constellations, refinements, genshin_uid, created_at")
    .eq("puzzle_pool", "Endless")
    .order("id", { ascending: true })
    .range(offset, offset)
    .maybeSingle();

  if (error || !data) {
    return new Response("Select failed", {
      status: 500,
      headers: corsHeaders,
    });
  }

  // 4) signed image url
  let image_url: string | null = null;

  if (data.image_path && data.image_path !== "pending") {
    const { data: signed, error: signErr } = await admin.storage
      .from("submission-images")
      .createSignedUrl(data.image_path, 60 * 60);

    if (!signErr) image_url = signed?.signedUrl ?? null;
  }

  return new Response(JSON.stringify({ ...data, image_url }), {
    status: 200,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
