import assert from "node:assert/strict";
import { nextDailyPuzzleDate } from "../src/game/dailyNavigation.ts";

Deno.test("past dates retain forward navigation when no later puzzle is assigned", () => {
  assert.equal(nextDailyPuzzleDate("2026-11-03", "2026-11-05", null), "2026-11-04");
  assert.equal(nextDailyPuzzleDate("2026-11-04", "2026-11-05", null), "2026-11-05");
  assert.equal(nextDailyPuzzleDate("2026-11-03", "2026-11-05"), "2026-11-04");
});

Deno.test("existing later puzzle assignments remain navigation targets", () => {
  assert.equal(nextDailyPuzzleDate("2026-11-01", "2026-11-05", "2026-11-04"), "2026-11-04");
});

Deno.test("forward navigation stops at today even if a future puzzle is assigned", () => {
  assert.equal(nextDailyPuzzleDate("2026-11-05", "2026-11-05", "2026-11-06"), null);
  assert.equal(nextDailyPuzzleDate("2026-11-06", "2026-11-05"), null);
  assert.equal(nextDailyPuzzleDate("2026-11-04", "2026-11-05", "2026-11-06"), "2026-11-05");
});

Deno.test("stale next-date metadata falls back to the following calendar day", () => {
  for (const next of ["2026-11-03", "2026-11-02"]) {
    assert.equal(nextDailyPuzzleDate("2026-11-03", "2026-11-05", next), "2026-11-04");
  }
});

Deno.test("calendar fallback handles UTC month, year, and leap-day boundaries", () => {
  for (const [date, expected] of [
    ["2026-10-31", "2026-11-01"],
    ["2026-12-31", "2027-01-01"],
    ["2028-02-28", "2028-02-29"],
    ["2028-02-29", "2028-03-01"],
  ]) {
    assert.equal(nextDailyPuzzleDate(date, "2029-01-01"), expected);
  }
});
