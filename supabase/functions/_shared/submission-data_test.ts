import {
  createSecret,
  determinePool,
  hashSecret,
  parseManagementCode,
  parseSubmission,
  readImage,
  SubmissionError,
} from "./submission-data.ts";
function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
function form() {
  const f = new FormData();
  ["Amber", "Bennett", "Kaeya", "Lisa"].forEach((name, i) => {
    f.set("team" + i, name);
    f.set("c" + i, "C0");
    f.set("r" + i, "R1");
    f.set(
      "weapon" + i,
      [
        "Favonius Warbow",
        "Favonius Sword",
        "Favonius Sword",
        "Thrilling Tales of Dragon Slayers",
      ][i],
    );
  });
  f.set("strongestHit", "1234");
  f.set("totalDps", "500");
  return f;
}
function rejects(run: () => unknown) {
  let rejected = false;
  try {
    run();
  } catch (e) {
    rejected = e instanceof SubmissionError;
  }
  assert(rejected);
}
Deno.test("weapon type and rarity are checked server-side", () => {
  const f = form();
  f.set("weapon0", "Thrilling Tales of Dragon Slayers");
  f.set("r0", "R5");
  rejects(() => parseSubmission(f));
  f.set("weapon0", "Favonius Warbow");
  assert(parseSubmission(f).puzzle_pool === "Daily");
  f.set("weapon0", "Amos' Bow");
  assert(parseSubmission(f).puzzle_pool === "Endless");
});
Deno.test("legacy records retain classification, but new saves require all weapon names", () => {
  const team = ["Amber", "Bennett", "Kaeya", "Lisa"];
  assert(
    determinePool(team, ["C0", "C0", "C0", "C0"], ["R0", "R0", "R0", "R0"]) ===
      "Daily",
  );
  assert(
    determinePool(team, ["C0", "C0", "C0", "C0"], ["R1", "R0", "R0", "R0"]) ===
      "Endless",
  );
  const f = form();
  f.delete("weapon2");
  rejects(() => parseSubmission(f));
});

Deno.test("duplicate characters, invalid numbers and invalid equipment are rejected", () => {
  const f = form();
  f.set("team1", "Amber");
  rejects(() => parseSubmission(f));
  f.set("team1", "Bennett");
  f.set("strongestHit", "NaN");
  rejects(() => parseSubmission(f));
  f.set("strongestHit", "100");
  f.set("weapon0", "Not a weapon");
  rejects(() => parseSubmission(f));
  f.set("weapon0", "Favonius Warbow");
  f.set("r0", "R0");
  rejects(() => parseSubmission(f));
});
Deno.test("management codes require an unpredictable secret, not a public ID", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  let rejected = false;
  try {
    await parseManagementCode(id);
  } catch {
    rejected = true;
  }
  assert(rejected);
  const secret = createSecret();
  assert(secret.length === 64);
  assert(secret !== createSecret());
  const parsed = await parseManagementCode(id + "." + secret);
  assert(parsed.id === id);
  assert(parsed.tokenHash === await hashSecret(secret));
  assert(parsed.tokenHash !== secret);
});
Deno.test("images are checked by content and optional edit images may be omitted", async () => {
  assert(await readImage(null, false) === null);
  let rejected = false;
  try {
    await readImage(
      new File(["not a png"], "fake.png", { type: "image/png" }),
      true,
    );
  } catch {
    rejected = true;
  }
  assert(rejected);
  const image = await readImage(
    new File(
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])],
      "real.png",
    ),
    true,
  );
  assert(image?.ext === "png");
});
