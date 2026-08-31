export const config = { verifyJWT: false };

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  getCharacterData,
} from "../_shared/character_elements.ts";

function getLevel(value: string, prefix: "C" | "R"): number {
  if (value === "Hidden") return 0;

  const match = value.match(new RegExp(`^${prefix}(\\d+)$`));
  if (!match) return 0;

  return Number(match[1]);
}

function determineSubmissionMode(
  team: string[],
  constellations: string[],
  refinements: string[],
): "Daily" | "Endless" {
  for (let i = 0; i < team.length; i++) {
    const character = team[i];
    const data = getCharacterData(character);

    if (!data) {
      console.warn(`Unknown character: ${character}`);
      return "Endless";
    }

    const constellation = getLevel(
      constellations[i] ?? "Hidden",
      "C",
    );

    const refinement = getLevel(
      refinements[i] ?? "Hidden",
      "R",
    );

    // Any weapon above R0
    if (refinement > 0) {
      return "Endless";
    }

    // 4-stars can use any constellation
    if (data.rarity === 4) {
      continue;
    }

    // Standard 5-stars can use any constellation
    if (data.rarity === 5 && data.standard) {
      continue;
    }

    // Limited 5-stars
    if (data.rarity === 5) {
      const maxAllowedConstellation = data.temper ? 1 : 0;

      if (constellation > maxAllowedConstellation) {
        return "Endless";
      }
    }
  }

  return "Daily";
}

serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase environment variables" }),
      { status: 500 },
    );
  }

  const admin = createClient(
    supabaseUrl,
    serviceRoleKey,
  );

  let updated = 0;
  let daily = 0;
  let endless = 0;
  const errors: string[] = [];

  while (true) {
    const { data: submissions, error } = await admin
      .from("dummy_submissions")
      .select("id, team, constellations, refinements")
      .is("puzzle_pool", null)
      .limit(250);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500 },
      );
    }

    if (!submissions || submissions.length === 0) {
      break;
    }

    for (const submission of submissions) {
      const mode = determineSubmissionMode(
        submission.team ?? [],
        submission.constellations ?? [],
        submission.refinements ?? [],
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