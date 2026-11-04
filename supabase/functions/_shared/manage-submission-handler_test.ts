import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createManagementHandler } from "./manage-submission-handler.ts";
import { hashSecret } from "./submission-data.ts";
function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
const id = "11111111-1111-4111-8111-111111111111";
const secret = "a".repeat(64);
const code = id + "." + secret;
async function fixture({ featured = false, conflict = false } = {}) {
  const hash = await hashSecret(secret);
  const calls: {
    rpc: number;
    uploads: string[];
    removals: string[][];
    payload: Record<string, unknown> | null;
  } = { rpc: 0, uploads: [], removals: [], payload: null };
  const row = {
    id,
    team: ["Amber", "Bennett", "Kaeya", "Lisa"],
    elements: ["Pyro", "Pyro", "Cryo", "Electro"],
    constellations: ["C0", "C0", "C0", "C0"],
    refinements: ["R0", "R0", "R0", "R0"],
    weapons: [null, null, null, null],
    strongest_hit: 5000,
    total_dps: 2000,
    genshin_uid: null,
    image_path: "old.png",
    featured_date: null,
    puzzle_pool: "Daily",
  };
  const client = {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const result = () => ({
        data: table === "submission_management"
          ? (filters.token_hash === hash ? { revision: 1 } : null)
          : table === "dummy_submissions"
          ? row
          : featured
          ? [{ date: "2026-11-03" }]
          : [],
        error: null,
      });
      const query = {
        select() {
          return query;
        },
        eq(field: string, value: unknown) {
          filters[field] = value;
          return query;
        },
        limit() {
          return query;
        },
        maybeSingle() {
          return Promise.resolve(result());
        },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve(result()).then(resolve);
        },
      };
      return query;
    },
    storage: {
      from() {
        return {
          createSignedUrl() {
            return Promise.resolve({
              data: { signedUrl: "https://example.test/old.png" },
              error: null,
            });
          },
          upload(path: string) {
            calls.uploads.push(path);
            return Promise.resolve({ error: null });
          },
          remove(paths: string[]) {
            calls.removals.push(paths);
            return Promise.resolve({ error: null });
          },
        };
      },
    },
    rpc(_name: string, payload: Record<string, unknown>) {
      calls.rpc++;
      calls.payload = payload;
      return Promise.resolve(
        conflict
          ? {
            data: null,
            error: {
              code: "40001",
              message: "Submission changed. Reload it before trying again.",
            },
          }
          : {
            data: {
              revision: 2,
              deleted: payload.p_action === "delete",
              old_image_path: "old.png",
            },
            error: null,
          },
      );
    },
  };
  return {
    calls,
    row,
    handler: createManagementHandler(() => client as unknown as SupabaseClient),
  };
}
function request(action: string, managementCode = code) {
  return new Request("https://example.test/manage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, managementCode, revision: 1 }),
  });
}
function update(image = false) {
  const form = new FormData();
  form.set("action", "update");
  form.set("managementCode", code);
  form.set("revision", "1");
  ["Amber", "Bennett", "Kaeya", "Lisa"].forEach((name, index) => {
    form.set("team" + index, name);
    form.set("c" + index, "C0");
    form.set("r" + index, "R1");
    form.set(
      "weapon" + index,
      [
        "Favonius Warbow",
        "Favonius Sword",
        "Favonius Sword",
        "Thrilling Tales of Dragon Slayers",
      ][index],
    );
  });
  form.set("strongestHit", "5000");
  form.set("totalDps", "2000");
  if (image) {
    form.set(
      "image",
      new File(
        [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])],
        "new.png",
      ),
    );
  }
  return form;
}
Deno.test("public ID and wrong management secrets cannot load or mutate", async () => {
  const { handler, calls } = await fixture();
  for (const action of ["load", "delete"]) {
    assert((await handler(request(action, id))).status === 403);
    assert(
      (await handler(request(action, id + "." + "b".repeat(64)))).status ===
        403,
    );
  }
  assert(calls.rpc === 0);
  assert(calls.removals.length === 0);
});
Deno.test("authorized load returns editable data without exposing ownership hashes or storage paths", async () => {
  const { handler } = await fixture();
  const response = await handler(request("load"));
  assert(response.status === 200);
  assert(response.headers.get("cache-control") === "no-store");
  const body = await response.json();
  assert(body.submission.revision === 1);
  assert(body.submission.readOnly === false);
  assert(!("image_path" in body.submission));
  assert(!JSON.stringify(body).includes(secret));
});
Deno.test("featured Daily submissions cannot be edited or deleted", async () => {
  const { handler, calls } = await fixture({ featured: true });
  assert((await handler(request("delete"))).status === 409);
  assert(
    (await handler(
      new Request("https://example.test/manage", {
        method: "POST",
        body: update(),
      }),
    )).status === 409,
  );
  assert(calls.rpc === 0);
  assert(calls.uploads.length === 0);
});
Deno.test("metadata edits keep the original image and derive the pool server-side", async () => {
  const { handler, calls } = await fixture();
  const response = await handler(
    new Request("https://example.test/manage", {
      method: "POST",
      body: update(),
    }),
  );
  assert(response.status === 200);
  assert(calls.rpc === 1);
  assert(calls.uploads.length === 0);
  assert(calls.removals.length === 0);
  assert(
    (calls.payload?.p_payload as Record<string, unknown>).puzzle_pool ===
      "Daily",
  );
  assert(
    !("image_path" in (calls.payload?.p_payload as Record<string, unknown>)),
  );
});
Deno.test("mismatched named weapons are rejected before changing data", async () => {
  const { handler, calls } = await fixture();
  const form = update();
  form.set("weapon0", "Favonius Sword");
  form.set("r0", "R1");
  assert(
    (await handler(
      new Request("https://example.test/manage", {
        method: "POST",
        body: form,
      }),
    )).status === 400,
  );
  assert(calls.rpc === 0);
});
Deno.test("stale replacement edits clean up the new image and leave the original intact", async () => {
  const { handler, calls } = await fixture({ conflict: true });
  const response = await handler(
    new Request("https://example.test/manage", {
      method: "POST",
      body: update(true),
    }),
  );
  assert(response.status === 409);
  assert(calls.uploads.length === 1);
  assert(calls.removals.length === 1);
  assert(calls.removals[0][0] === calls.uploads[0]);
  assert(!calls.removals.flat().includes("old.png"));
});
Deno.test("authorized delete removes the old image only after the transactional delete", async () => {
  const { handler, calls } = await fixture();
  const response = await handler(request("delete"));
  assert(response.status === 200);
  assert((await response.json()).deleted === true);
  assert(calls.rpc === 1);
  assert(calls.removals[0][0] === "old.png");
});
