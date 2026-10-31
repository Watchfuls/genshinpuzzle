// @deno-types="../../node_modules/typescript/lib/typescript.d.ts"
import ts from "../../node_modules/typescript/lib/typescript.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function runSubmission(failure?: "upload" | "publish") {
  const events: string[] = [];
  let row: Record<string, unknown> | null = null;
  let handler!: (request: Request) => Promise<Response>;
  const admin = {
    from: () => ({
      select: () => Promise.resolve({ count: 0, error: null }),
      insert: (values: Record<string, unknown>) => {
        row = values;
        events.push("insert");
        return { select: () => ({ single: () => Promise.resolve({ data: { id: "123" }, error: null }) }) };
      },
      update: (values: Record<string, unknown>) => ({ eq: () => {
        assert(row?.image_path === "pending" && row?.puzzle_pool === null, "Submission was published before upload finished");
        assert(events.includes("upload"), "Publication must follow upload");
        events.push("publish");
        if (failure === "publish") return Promise.resolve({ error: "publish failed" });
        row = { ...row, ...values };
        return Promise.resolve({ error: null });
      } }),
      delete: () => ({ eq: () => {
        events.push("delete");
        row = null;
        return Promise.resolve({ error: null });
      } }),
    }),
    storage: { from: () => ({
      upload: () => {
        assert(row?.image_path === "pending" && row?.puzzle_pool === null, "Uploading submission must remain unpublished");
        events.push("upload");
        return Promise.resolve({ error: failure === "upload" ? "upload failed" : null });
      },
      remove: () => {
        events.push("remove-image");
        return Promise.resolve({ error: null });
      },
    }) },
  };
  const source = await Deno.readTextFile(new URL("./create_dummy_submission/index.ts", import.meta.url));
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const dependencies = {
    serve: (callback: typeof handler) => { handler = callback; },
    createClient: () => admin,
    getElementForCharacter: () => "Pyro",
    getCharacterData: () => ({ rarity: 4 }),
  };
  // Execute the real handler with isolated dependencies; no network or database access.
  new Function("require", "exports", "Deno", compiled)(
    () => dependencies, {}, { env: { get: () => "test-value" } },
  );
  const form = new FormData();
  form.set("image", new File(["image"], "test.png", { type: "image/png" }));
  for (let i = 0; i < 4; i++) form.set(`team${i}`, `Character ${i}`);
  form.set("strongestHit", "100");
  form.set("totalDps", "100");
  const response = await handler(new Request("https://example.invalid", { method: "POST", body: form }));
  return { response, row: row as Record<string, unknown> | null, events };
}

Deno.test("successful upload publishes the image path and pool together", async () => {
  const { response, row } = await runSubmission();
  assert(response.status === 200, "Submission should succeed");
  assert(row?.image_path === "123.png" && row?.puzzle_pool === "Daily", "Completed submission must have its image and pool");
});

Deno.test("upload failure removes the unpublished row", async () => {
  const { response, row, events } = await runSubmission("upload");
  assert(response.status === 500 && row === null, "Failed upload should be removed");
  assert(!events.includes("publish"), "Failed upload must not be published");
});

Deno.test("publication failure removes the uploaded image and unpublished row", async () => {
  const { response, row, events } = await runSubmission("publish");
  assert(response.status === 500 && row === null, "Failed publication should be removed");
  assert(events.includes("remove-image"), "Uploaded image should be cleaned up");
});
