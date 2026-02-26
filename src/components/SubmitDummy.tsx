import { useState, useEffect } from "react";
import TopTabs from "./TopTabs";
import type { Element } from "../game/types";
import { CHARACTER_DATA } from "../game/characters";

type Constellation = "Hidden" | "C0" | "C1" | "C2" | "C3" | "C4" | "C5" | "C6";
type Refinement = "Hidden" | "R0" | "R1" | "R2" | "R3" | "R4" | "R5";

const CONSTELLATION_OPTIONS: Constellation[] = ["Hidden", "C0", "C1", "C2", "C3", "C4", "C5", "C6"];
const REFINEMENT_OPTIONS: Refinement[] = ["Hidden", "R0", "R1", "R2", "R3", "R4", "R5"];

const DEFAULT_C: Constellation = "Hidden";
const DEFAULT_R: Refinement = "Hidden";

export default function SubmitDummy() {
  const ELEMENTS: Element[] = ["Pyro", "Hydro", "Electro", "Cryo", "Dendro", "Anemo", "Geo"];

  /* ================= FILE ================= */

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  /* ================= TEAM SELECTION ================= */

  const [preview, setPreview] = useState<(string | null)[]>([null, null, null, null]);
  const [constellations, setConstellations] = useState<Constellation[]>([
    DEFAULT_C,
    DEFAULT_C,
    DEFAULT_C,
    DEFAULT_C,
  ]);
  const [refinements, setRefinements] = useState<Refinement[]>([
    DEFAULT_R,
    DEFAULT_R,
    DEFAULT_R,
    DEFAULT_R,
  ]);

  const addToPreview = (name: string) => {
    // if already selected, remove it (grid toggle)
    const existingIndex = preview.findIndex((c) => c === name);
    if (existingIndex !== -1) {
      removePreviewAt(existingIndex);
      return;
    }

    const emptyIndex = preview.findIndex((c) => c == null);
    if (emptyIndex === -1) return; // full

    setPreview((prev) => {
      const next = [...prev];
      next[emptyIndex] = name;
      return next;
    });

    // defaults already Hidden; nothing else needed on add
  };

  const removePreviewAt = (index: number) => {
    setPreview((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });

    setConstellations((prev) => {
      const next = [...prev];
      next[index] = DEFAULT_C;
      return next;
    });
    setRefinements((prev) => {
      const next = [...prev];
      next[index] = DEFAULT_R;
      return next;
    });
  };

  const removeLastPreview = () => {
    const lastIndex = [...preview]
      .map((c, i) => (c ? i : -1))
      .filter((i) => i !== -1)
      .pop();
    if (lastIndex == null) return;
    removePreviewAt(lastIndex);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Backspace") return;

      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      e.preventDefault();

      const lastIndex = [...preview]
        .map((c, i) => (c ? i : -1))
        .filter((i) => i !== -1)
        .pop();

      if (lastIndex == null) return;
      removePreviewAt(lastIndex);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [preview]);

  /* ================= File Picking ================= */

  const onPickFile = (f: File | null) => {
    setFile(null);
    setFileError(null);

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }

    if (!f) return;

    const isPng = f.type === "image/png" || f.name.toLowerCase().endsWith(".png");
    const isJpeg =
      f.type === "image/jpeg" ||
      f.name.toLowerCase().endsWith(".jpg") ||
      f.name.toLowerCase().endsWith(".jpeg");

    if (!isPng && !isJpeg) {
      setFileError("Only PNG and JPEG files are allowed.");
      return;
    }

    if (f.size > 1_048_576) {
      setFileError("File must be 1MB or smaller.");
      return;
    }

    setFile(f);
    setImagePreviewUrl(URL.createObjectURL(f));
  };

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  /* SERVER */
  const submitDummy = async () => {
    if (!isValid || !file) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmissionId(null);

    try {
      const form = new FormData();
      form.append("image", file);

      form.append("team0", preview[0] ?? "");
      form.append("team1", preview[1] ?? "");
      form.append("team2", preview[2] ?? "");
      form.append("team3", preview[3] ?? "");

      form.append("c0", constellations[0] ?? DEFAULT_C);
      form.append("c1", constellations[1] ?? DEFAULT_C);
      form.append("c2", constellations[2] ?? DEFAULT_C);
      form.append("c3", constellations[3] ?? DEFAULT_C);

      form.append("r0", refinements[0] ?? DEFAULT_R);
      form.append("r1", refinements[1] ?? DEFAULT_R);
      form.append("r2", refinements[2] ?? DEFAULT_R);
      form.append("r3", refinements[3] ?? DEFAULT_R);

      const elements = preview.map((name) => (name ? (CHARACTER_DATA[name]?.element ?? "None") : "None"));

      form.append("elements", JSON.stringify(elements));

      form.append("strongestHit", String(Number(strongestHit)));
      form.append("totalDps", String(Number(totalDps)));

      if (genshinUid.trim()) {
        form.append("genshinUid", genshinUid.trim());
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create_dummy_submission`,
        {
          method: "POST",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: form,
        },
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }

      const data = (await res.json()) as { submissionId: string };
      setSubmissionId(data.submissionId);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ================= ELEMENT FILTER (MATCH DAILY) ================= */

  const [filterMode, setFilterMode] = useState<"all" | "elements">("all");

  const [activeElements, setActiveElements] = useState<Record<Element, boolean>>(() =>
    ELEMENTS.reduce(
      (acc, el) => {
        acc[el] = false; // all element buttons off by default; "All" mode shows everything
        return acc;
      },
      {} as Record<Element, boolean>,
    ),
  );

  const clickAll = () => {
    setFilterMode("all");
    setActiveElements(
      ELEMENTS.reduce(
        (acc, el) => {
          acc[el] = false;
          return acc;
        },
        {} as Record<Element, boolean>,
      ),
    );
  };

  const toggleElement = (el: Element) => {
    setFilterMode("elements");
    setActiveElements((prev) => {
      const next = { ...prev, [el]: !prev[el] };

      const anyOn = ELEMENTS.some((e) => next[e]);
      if (!anyOn) {
        setFilterMode("all");
      }

      return next;
    });
  };

  /* ================= INPUTS ================= */

  const HINT_MIN = 1_000;
  const HINT_MAX = 10_000_000; // 100,000 × 100
  const HINT_MAX_DIGITS = 8; // 10,000,000

  const sanitizeDigits = (s: string) => s.replace(/[^\d]/g, "");
  const sanitizeUid = (s: string) => s.replace(/[^\d]/g, "").slice(0, 10);

  const parseHint = (raw: string) => {
    if (!raw) return { ok: false, n: 0, err: "Required" };
    if (!/^\d+$/.test(raw)) return { ok: false, n: 0, err: "Numbers only" };

    const n = Number(raw);
    if (!Number.isSafeInteger(n)) return { ok: false, n: 0, err: "Too large" };

    if (n < HINT_MIN || n > HINT_MAX) {
      return {
        ok: false,
        n,
        err: `Must be ${HINT_MIN.toLocaleString()}–${HINT_MAX.toLocaleString()}`,
      };
    }

    return { ok: true, n, err: null as string | null };
  };

  const [strongestHit, setStrongestHit] = useState("");
  const [totalDps, setTotalDps] = useState("");
  const [genshinUid, setGenshinUid] = useState("");

  const strongest = parseHint(strongestHit);
  const dps = parseHint(totalDps);

  const isValid =
    !!file &&
    !fileError &&
    preview.every((c) => typeof c === "string" && c.length > 0) &&
    strongest.ok &&
    dps.ok;

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopTabs />

      <div style={{ padding: "1rem" }}>
        <div
          style={{
            display: "flex",
            gap: "2rem",
            alignItems: "flex-start",
          }}
        >
          {/* ============== LEFT SIDE ============== */}
          <div style={{ flex: 1, minWidth: 760, maxWidth: 760 }}>
            {/* Preview Row */}

            {/* Team (centered block) */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  marginBottom: 12,
                  textAlign: "center",
                }}
              >
                Team
              </div>

              {/* Slots: portrait + C + R (each column aligned) */}
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                {[0, 1, 2, 3].map((i) => {
                  const char = preview[i];
                  const hasChar = !!char;

                  return (
                    <div
                      key={i}
                      style={{
                        width: 72, // matches portrait box width
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {/* Portrait slot (UNCHANGED styling) */}
                      <button
                        type="button"
                        disabled={!char}
                        onClick={() => removePreviewAt(i)}
                        style={{
                          width: 72,
                          height: 72,
                          border: "2px solid #444",
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#1f1f1f",
                          cursor: char ? "pointer" : "default",
                          opacity: char ? 1 : 0.6,
                          padding: 0,
                        }}
                        title={char ? `${char} (click to remove)` : undefined}
                      >
                        {char && (
                          <img
                            src={CHARACTER_DATA[char].iconUrl}
                            alt={char}
                            style={{
                              width: 56,
                              height: 56,
                              pointerEvents: "none",
                            }}
                          />
                        )}
                      </button>

                      {/* Constellation (directly under portrait) */}
                      <select
                        disabled={!hasChar}
                        value={constellations[i] ?? DEFAULT_C}
                        onChange={(e) => {
                          const v = e.target.value as Constellation;
                          setConstellations((prev) => {
                            const next = [...prev];
                            next[i] = v;
                            return next;
                          });
                        }}
                        style={{ padding: 6, width: 72 }}
                        title="Constellation"
                      >
                        {CONSTELLATION_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>

                      {/* Refinement (directly under constellation) */}
                      <select
                        disabled={!hasChar}
                        value={refinements[i] ?? DEFAULT_R}
                        onChange={(e) => {
                          const v = e.target.value as Refinement;
                          setRefinements((prev) => {
                            const next = [...prev];
                            next[i] = v;
                            return next;
                          });
                        }}
                        style={{ padding: 6, width: 72 }}
                        title="Refinement"
                      >
                        {REFINEMENT_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 10, opacity: 0.8, fontSize: 12, textAlign: "center" }}>
              If your team has constellations on limited 5 ★ characters, or the DPS is way off it's expected amount,<br></br> it will probably get assigned to Endless mode.
              </div>

              <button
                onClick={removeLastPreview}
                disabled={!preview.some((c) => c)}
                style={{ marginTop: 12 }}
              >
                Backspace
              </button>
            </div>

            {/* Element Filters (MATCH DAILY) */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "8px",
                margin: "16px 0",
                flexWrap: "wrap",
              }}
            >
              {/* All button */}
              <button
                onClick={clickAll}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 6,
                  border: "1px solid #444",
                  background: filterMode === "all" ? "#3a3a3a" : "#1a1a1a",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  opacity: filterMode === "all" ? 1 : 0.6,
                }}
                title="All"
                aria-pressed={filterMode === "all"}
              >
                <span style={{ fontSize: 12, fontWeight: 700 }}>ALL</span>
              </button>

              {/* Element buttons */}
              {ELEMENTS.map((el) => {
                const isOn = filterMode === "elements" && activeElements[el];

                return (
                  <button
                    key={el}
                    onClick={() => toggleElement(el)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 6,
                      border: "1px solid #444",
                      background: isOn ? "#3a3a3a" : "#1a1a1a",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                      opacity: filterMode === "all" ? 0.6 : 1,
                    }}
                    title={el}
                    aria-pressed={isOn}
                  >
                    <img
                      src={`${import.meta.env.BASE_URL}icons/elements/${el}_Icon.png`}
                      alt={el}
                      style={{
                        width: 30,
                        height: 30,
                        objectFit: "contain",
                        display: "block",
                        margin: "0 auto",
                        opacity: isOn ? 1 : 0.35,
                        pointerEvents: "none",
                      }}
                    />
                  </button>
                );
              })}
            </div>

            {/* Character Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(10, 1fr)",
                gap: "8px",
                width: "100%",
              }}
            >
              {Object.entries(CHARACTER_DATA)
                .filter((entry) => {
                  const data = entry[1];
                  if (filterMode === "all") return true;
                  if (data.element === "None") return false;
                  return activeElements[data.element];
                })
                .map(([name]) => (
                  <button
                    key={name}
                    onClick={() => addToPreview(name)}
                    title={name}
                    style={{
                      width: 64,
                      height: 64,
                      padding: 4,
                      borderRadius: 6,
                      border: "1px solid #444",
                      background: preview.includes(name) ? "#3a3a3a" : "#2a2a2a",
                      cursor: "pointer",
                    }}
                  >
                    <img
                      src={CHARACTER_DATA[name].iconUrl}
                      alt={name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        pointerEvents: "none",
                      }}
                    />
                  </button>
                ))}
            </div>
          </div>

          {/* ============== RIGHT SIDE (HINTS) ============== */}
          <div style={{ width: 360, flexShrink: 0 }}>
            <h3 style={{ marginTop: 0 }}>Submit a Dummy</h3>

            <div style={{ marginBottom: 12, opacity: 0.9 }}>
              Upload a PNG/JPEG screenshot (≤ 1MB) and select the 4-character team shown. Please edit the
              image to hide the characters, and strongest hit as shown. <br></br>For
              Constellations and Refinements, if the value is "Hidden" it will not be shown to the
              player, only include these if you think these values are abnormal and important for
              the player to guess the team.
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Example</div>
                <img
                  src="example-submission.png"
                  alt="Example submission"
                  style={{
                    width: "100%",
                    border: "1px dashed #444",
                    borderRadius: 8,
                    opacity: 0.85,
                    display: "block",
                  }}
                />
              </div>
            </div>

            {/* File picker */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Screenshot (PNG/JPEG only)</div>
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
              {file && !fileError && (
                <div style={{ marginTop: 6 }}>
                  {file.name} ({Math.round(file.size / 1024)} KB)
                </div>
              )}
              {fileError && <div style={{ marginTop: 6, color: "#ff6b6b" }}>{fileError}</div>}
            </div>

            {imagePreviewUrl && !fileError && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Preview</div>
                <img
                  src={imagePreviewUrl}
                  alt="Upload preview"
                  style={{
                    width: "100%",
                    maxWidth: 520,
                    border: "1px solid #444",
                    borderRadius: 8,
                    display: "block",
                  }}
                />
              </div>
            )}
            <h3 style={{ marginTop: 0 }}>Hints</h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                columnGap: 12,
                rowGap: 12,
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 700 }}>Strongest Hit</div>
              <input
                value={strongestHit}
                onChange={(e) =>
                  setStrongestHit(sanitizeDigits(e.target.value).slice(0, HINT_MAX_DIGITS))
                }
                inputMode="numeric"
                pattern="\d*"
                placeholder="e.g. 100000"
                aria-invalid={!strongest.ok}
                style={{
                  padding: 8,
                  width: "100%",
                  border: strongest.ok ? "1px solid #444" : "1px solid #ff6b6b",
                }}
              />

              <div style={{ fontWeight: 700 }}>Total DPS</div>
              <input
                value={totalDps}
                onChange={(e) =>
                  setTotalDps(sanitizeDigits(e.target.value).slice(0, HINT_MAX_DIGITS))
                }
                inputMode="numeric"
                pattern="\d*"
                placeholder="e.g. 100000"
                aria-invalid={!dps.ok}
                style={{
                  padding: 8,
                  width: "100%",
                  border: dps.ok ? "1px solid #444" : "1px solid #ff6b6b",
                }}
              />

              <div style={{ fontWeight: 700 }}>Genshin UID</div>
              <input
                value={genshinUid}
                onChange={(e) => setGenshinUid(sanitizeUid(e.target.value))}
                inputMode="numeric"
                pattern="\d*"
                placeholder="optional"
                style={{ padding: 8, width: "100%" }}
              />
            </div>

            {(!strongest.ok || !dps.ok) && (
              <div style={{ marginTop: 8, color: "#ff6b6b", fontSize: 12 }}>
                {!strongest.ok && <div>Strongest Hit: {strongest.err}</div>}
                {!dps.ok && <div>Total DPS: {dps.err}</div>}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <button
                disabled={!isValid || isSubmitting}
                style={{ width: "100%" }}
                onClick={submitDummy}
              >
                {isSubmitting ? "Submitting..." : "Submit Dummy"}
              </button>

              {submitError && <div style={{ marginTop: 10, color: "#ff6b6b" }}>{submitError}</div>}

              {submissionId && (
                <div style={{ marginTop: 10 }}>
                  Submission ID: <b>{submissionId}</b>
                </div>
              )}

              {!isValid && (
                <div style={{ marginTop: 8, opacity: 0.8, fontSize: 12 }}>
                  Required: PNG ≤ 1MB, select 4 unique characters, and enter both numbers.
                </div>
              )}
              <div style={{ marginBottom: 12, opacity: 0.9 }}>
                <br></br>
                Currently there is no functionality to remove or edit entries you submit, but in the
                future you will be able to use the code provided after submission to do so.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
