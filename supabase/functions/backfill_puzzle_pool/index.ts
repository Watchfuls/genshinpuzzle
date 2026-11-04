export const config = { verifyJWT: false };

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { determinePool } from "../_shared/submission-data.ts";

serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase environment variables" }), {
      status: 500,
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  let updated = 0;
  let daily = 0;
  let endless = 0;
  const errors: string[] = [];

  while (true) {
    const { data: submissions, error } = await admin
      .from("dummy_submissions")
      .select("id, team, constellations, refinements, weapons")
      .neq("image_path", "pending")
      .not("image_path", "is", null)
      .is("puzzle_pool", null)
      .limit(250);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!submissions || submissions.length === 0) {
      break;
    }

    for (const submission of submissions) {
      const mode = determinePool(
        submission.team ?? [],
        submission.constellations ?? [],
        submission.refinements ?? [],
        submission.weapons ?? [],
      );

      const { error: updateError } = await admin
        .from("dummy_submissions")
        .update({
          puzzle_pool: mode,
        })
        .eq("id", submission.id);

      if (updateError) {
        errors.push(`${submission.id}: ${updateError.message}`);
        continue;
      }

      updated++;

      if (mode === "Daily") {
        daily++;
      } else {
        endless++;
      }
    }

    // Prevent an infinite loop if every row in a batch fails.
    if (errors.length >= submissions.length && updated === 0) {
      break;
    }
  }

  return new Response(
    JSON.stringify(
      {
        updated,
        daily,
        endless,
        errors,
      },
      null,
      2,
    ),
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
});
