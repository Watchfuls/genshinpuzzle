export const config = { verifyJWT: false };
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createManagementHandler } from "../_shared/manage-submission-handler.ts";
serve(
  createManagementHandler(() => {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("Server configuration missing");
    return createClient(url, key);
  }),
);
