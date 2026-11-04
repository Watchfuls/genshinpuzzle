import { useState, useEffect } from "react";
import TopTabs from "./TopTabs";
import CharacterSlotPicker from "./CharacterSlotPicker";
import { Link } from "react-router-dom";
import { WEAPONS } from "../../supabase/functions/_shared/weapon_catalog";
import {
  rememberSubmission,
  submissionRequest,
  type ManagedSubmission,
} from "../game/submissionManagement";
import { startCharacterDrag, readCharacterDrop } from "../game/characterDrag";
import RosterSort from "./RosterSort";
import { characterClue } from "../game/characterClues";
import RarityFilter from "./RarityFilter";
import AdvancedRosterFilters from "./AdvancedRosterFilters";
import { compareCharacters, characterRarity } from "../game/roster";
import type { Element } from "../game/types";
import { CHARACTER_DATA } from "../game/characters";
import { useSettings } from "../context/SettingsContext";

type Constellation = "Hidden" | "C0" | "C1" | "C2" | "C3" | "C4" | "C5" | "C6";
type Refinement = "Hidden" | "R0" | "R1" | "R2" | "R3" | "R4" | "R5";

const CONSTELLATION_OPTIONS: Constellation[] = ["C0", "C1", "C2", "C3", "C4", "C5", "C6"];
const REFINEMENT_OPTIONS: Refinement[] = ["R1", "R2", "R3", "R4", "R5"];

const DEFAULT_C: Constellation = "C0";
const DEFAULT_R: Refinement = "R1";

type Props = {
  editing?: ManagedSubmission & { managementCode: string };
  onSaved?: () => void | Promise<void>;
  onCancel?: () => void;
  onDelete?: () => void;
};
export default function SubmitDummy({ editing, onSaved, onCancel, onDelete }: Props) {
  const { characterOrder } = useSettings();
  const [regionFilter, setRegionFilter] = useState("all");
  const [weaponFilters, setWeaponFilters] = useState<string[]>([]);
  const [rarityFilter, setRarityFilter] = useState("all");
  const [rosterSearch, setRosterSearch] = useState("");
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const closePicker = (restoreFocus = true) => {
    const slot = pickerSlot;
    setPickerSlot(null);
    if (restoreFocus && slot !== null)
      requestAnimationFrame(() =>
        document
          .querySelectorAll<HTMLButtonElement>(".submission-team-slots .team-slot")
          [slot]?.focus(),
      );
  };
  const ELEMENTS: Element[] = ["Pyro", "Hydro", "Electro", "Cryo", "Dendro", "Anemo", "Geo"];

  /* ================= FILE ================= */

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(editing?.image_url ?? null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [managementCode, setManagementCode] = useState("");
  const [storageSaved, setStorageSaved] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [weapons, setWeapons] = useState<(string | null)[]>(
    editing?.weapons ?? [null, null, null, null],
  );

  /* ================= TEAM SELECTION ================= */

  const [preview, setPreview] = useState<(string | null)[]>(
    editing?.team ?? [null, null, null, null],
  );
  const [constellations, setConstellations] = useState<Constellation[]>(
    (editing?.constellations as Constellation[] | undefined) ?? [
      DEFAULT_C,
      DEFAULT_C,
      DEFAULT_C,
      DEFAULT_C,
    ],
  );
  const [refinements, setRefinements] = useState<Refinement[]>(
    (editing?.refinements as Refinement[] | undefined) ?? [
      DEFAULT_R,
      DEFAULT_R,
      DEFAULT_R,
      DEFAULT_R,
    ],
  );

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

    // Empty slots already use the C0/R1 defaults.
  };

  const removePreviewAt = (index: number) => {
    setWeapons((current) => current.map((weapon, i) => (i === index ? null : weapon)));
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

  const dropIntoPreview = (name: string, index?: number) => {
    if (isSubmitting) return;
    const existing = preview.indexOf(name);
    const target = index ?? preview.findIndex((character) => !character);
    if (target < 0 || target === existing) return;
    if (existing !== -1) {
      setWeapons((current) => {
        const next = [...current];
        [next[target], next[existing]] = [next[existing], next[target]];
        return next;
      });
      setPreview((current) => {
        const next = [...current];
        [next[target], next[existing]] = [next[existing], next[target]];
        return next;
      });
      setConstellations((current) => {
        const next = [...current];
        [next[target], next[existing]] = [next[existing], next[target]];
        return next;
      });
      setRefinements((current) => {
        const next = [...current];
        [next[target], next[existing]] = [next[existing], next[target]];
        return next;
      });
    } else {
      setWeapons((current) => current.map((weapon, i) => (i === target ? null : weapon)));
      setPreview((current) => current.map((character, i) => (i === target ? name : character)));
      setConstellations((current) => current.map((value, i) => (i === target ? DEFAULT_C : value)));
      setRefinements((current) => current.map((value, i) => (i === target ? DEFAULT_R : value)));
    }
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
      if (
        e.defaultPrevented ||
        e.repeat ||
        el?.isContentEditable ||
        tag === "input" ||
        tag === "textarea" ||
        tag === "select"
      )
        return;

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
    if (!isValid || (!file && !editing)) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmissionId(null);

    try {
      const form = new FormData();
      if (file) form.append("image", file);
      weapons.forEach((weapon, index) => {
        if (weapon) form.append("weapon" + index, weapon);
      });

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

      const elements = preview.map((name) =>
        name ? (CHARACTER_DATA[name]?.element ?? "None") : "None",
      );

      form.append("elements", JSON.stringify(elements));

      form.append("strongestHit", String(Number(strongestHit)));
      form.append("totalDps", String(Number(totalDps)));

      if (genshinUid.trim()) {
        form.append("genshinUid", genshinUid.trim());
      }

      if (editing) {
        form.set("action", "update");
        form.set("managementCode", editing.managementCode);
        form.set("revision", String(editing.revision));
        await submissionRequest(form);
        await onSaved?.();
      } else {
        const capability = await submissionRequest({ action: "capabilities" });
        if (!capability.management || !capability.namedWeapons)
          throw new Error(
            "The submission update has not been deployed yet. This local preview is ready for review.",
          );
        const createUrl =
          import.meta.env.VITE_SUPABASE_URL + "/functions/v1/create_dummy_submission";
        const createCapabilityResponse = await fetch(createUrl, {
          method: "POST",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            "content-type": "application/json",
          },
          body: JSON.stringify({ action: "capabilities" }),
        });
        const createCapability = await createCapabilityResponse.json().catch(() => null);
        if (
          !createCapabilityResponse.ok ||
          !createCapability?.management ||
          !createCapability?.namedWeapons
        )
          throw new Error(
            "The submission creation function has not been deployed with management support yet. Your form was not submitted.",
          );
        const res = await fetch(createUrl, {
          method: "POST",
          headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
          body: form,
        });
        const raw = await res.text();
        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          data = { message: raw };
        }
        if (!res.ok) throw new Error(data.message || "Submission failed.");
        if (typeof data.submissionId !== "string" || typeof data.managementCode !== "string")
          throw new Error(
            "The submission may have been saved, but its management code was not returned. Do not resubmit; contact the site owner for help.",
          );
        setSubmissionId(data.submissionId);
        setManagementCode(data.managementCode);
        setStorageSaved(
          rememberSubmission({
            id: data.submissionId,
            managementCode: data.managementCode,
            team: preview as string[],
            savedAt: new Date().toISOString(),
          }),
        );
      }
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

  const [strongestHit, setStrongestHit] = useState(editing ? String(editing.strongest_hit) : "");
  const [totalDps, setTotalDps] = useState(editing ? String(editing.total_dps) : "");
  const [genshinUid, setGenshinUid] = useState(editing?.genshin_uid ?? "");

  const strongest = parseHint(strongestHit);
  const dps = parseHint(totalDps);

  const isValid =
    (!!file || !!editing) &&
    !fileError &&
    preview.every((c) => typeof c === "string" && c.length > 0) &&
    strongest.ok &&
    dps.ok &&
    weapons.length === 4 &&
    weapons.every(
      (weapon, index) =>
        !!weapon &&
        WEAPONS.some(
          (entry) =>
            entry.name === weapon && entry.type === characterClue(preview[index] ?? "", "weapon"),
        ),
    ) &&
    refinements.every((refinement) => /^R[1-5]$/.test(refinement)) &&
    (!genshinUid || /^\d{6,10}$/.test(genshinUid));

  const visibleCharacters = Object.entries(CHARACTER_DATA)
    .filter(
      ([name, data]) =>
        (filterMode === "all" || (data.element !== "None" && activeElements[data.element])) &&
        (rarityFilter === "all" || characterRarity(name) === Number(rarityFilter)) &&
        (regionFilter === "all" || characterClue(name, "region") === regionFilter) &&
        (!weaponFilters.length || weaponFilters.includes(characterClue(name, "weapon"))) &&
        name.toLowerCase().includes(rosterSearch.trim().toLowerCase()),
    )
    .sort(([, a], [, b]) => compareCharacters(a, b, characterOrder));
  const resetRosterFilters = () => {
    setFilterMode("all");
    setRarityFilter("all");
    setRegionFilter("all");
    setWeaponFilters([]);
    setRosterSearch("");
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopTabs />

      <main className="game-shell">
        <section className="page-intro">
          <div>
            <span className="eyebrow">{editing ? "Your submission" : "Add a new mystery"}</span>
            <h1>{editing ? "Edit your puzzle." : "Submit a puzzle."}</h1>
            <p>Build your team, then add your damage screenshot and hints.</p>
          </div>
        </section>
        {editing && (
          <div className="manage-actions">
            <button type="button" disabled={isSubmitting} onClick={onCancel}>
              Back to submissions
            </button>
            <button
              type="button"
              className="danger-button"
              disabled={isSubmitting}
              onClick={onDelete}
            >
              Delete submission
            </button>
          </div>
        )}
        <div className="submit-layout">
          {/* ============== LEFT SIDE ============== */}
          <div className="game-panel submit-panel">
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
              <div className="submission-team-picker">
                <div
                  className="submission-team-slots"
                  style={{ display: "flex", gap: 12, justifyContent: "center" }}
                >
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
                          disabled={isSubmitting}
                          draggable={!!char && !isSubmitting}
                          onDragStart={(event) => {
                            setPickerSlot(null);
                            if (char) startCharacterDrag(event, char);
                          }}
                          onDragOver={(event) => {
                            if (!isSubmitting) event.preventDefault();
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            const name = readCharacterDrop(event);
                            if (name) dropIntoPreview(name, i);
                            setPickerSlot(null);
                          }}
                          onClick={() => setPickerSlot((current) => (current === i ? null : i))}
                          className="team-slot character-picker-trigger"
                          aria-haspopup="listbox"
                          aria-expanded={pickerSlot === i}
                          aria-label={
                            char
                              ? "Change " + char + " in slot " + (i + 1)
                              : "Choose character for slot " + (i + 1)
                          }
                          onContextMenu={(event) => {
                            event.preventDefault();
                            if (char) removePreviewAt(i);
                            setPickerSlot(null);
                          }}
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
                          title={
                            char
                              ? char + " - click to change; right-click to remove"
                              : "Click to choose a character"
                          }
                        >
                          {!char && (
                            <span className="empty-slot" aria-hidden="true">
                              +
                            </span>
                          )}
                          {char && (
                            <img
                              draggable={false}
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
                        <span className="team-value-label">Constellation</span>
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
                          aria-label={"Constellation for " + (char ?? "team slot " + (i + 1))}
                        >
                          {constellations[i] === "Hidden" && (
                            <option value="Hidden" disabled>
                              Not supplied
                            </option>
                          )}
                          {CONSTELLATION_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>

                {pickerSlot !== null && (
                  <CharacterSlotPicker
                    key={pickerSlot}
                    slot={pickerSlot}
                    selected={preview}
                    onClose={closePicker}
                    onRemove={() => {
                      removePreviewAt(pickerSlot);
                      closePicker();
                    }}
                    onSelect={(name) => {
                      dropIntoPreview(name, pickerSlot);
                      closePicker();
                    }}
                  />
                )}
              </div>
              <fieldset className="weapon-selections">
                <legend>Weapons and refinements</legend>
                <p className="panel-note">
                  Choose a matching weapon and refinement for all four characters.
                </p>
                {preview.map((name, index) => (
                  <div className="weapon-selection-row" key={index}>
                    <span className="weapon-character" title={name ?? "Slot " + (index + 1)}>
                      <span className="weapon-character-name">{name ?? "Slot " + (index + 1)}</span>
                      <small>{name ? characterClue(name, "weapon") : "Select a character"}</small>
                    </span>
                    <label className="weapon-name-field">
                      <span className="sr-only">
                        Weapon for {name ?? "team slot " + (index + 1)}
                      </span>
                      <select
                        aria-label={"Weapon for " + (name ?? "team slot " + (index + 1))}
                        required
                        disabled={!name || isSubmitting}
                        value={weapons[index] ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setWeapons((current) =>
                            current.map((weapon, i) => (i === index ? value || null : weapon)),
                          );
                          setRefinements((current) =>
                            current.map((refinement, i) =>
                              i !== index
                                ? refinement
                                : /^R[1-5]$/.test(refinement)
                                  ? refinement
                                  : DEFAULT_R,
                            ),
                          );
                        }}
                      >
                        <option value="">Choose a weapon</option>
                        {[5, 4, 3, 2, 1].map((rarity) => (
                          <optgroup label={rarity + "-star weapons"} key={rarity}>
                            {WEAPONS.filter(
                              (weapon) =>
                                weapon.type === (name ? characterClue(name, "weapon") : "") &&
                                weapon.rarity === rarity,
                            ).map((weapon) => (
                              <option key={weapon.name} value={weapon.name}>
                                {weapon.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    <label className="weapon-refinement-field">
                      <span className="sr-only">
                        Refinement for {name ?? "team slot " + (index + 1)}
                      </span>
                      <select
                        aria-label={"Refinement for " + (name ?? "team slot " + (index + 1))}
                        title="Refinement"
                        disabled={!name || isSubmitting}
                        value={refinements[index] ?? DEFAULT_R}
                        onChange={(event) =>
                          setRefinements((current) =>
                            current.map((value, i) =>
                              i === index ? (event.target.value as Refinement) : value,
                            ),
                          )
                        }
                      >
                        {!/^R[1-5]$/.test(refinements[index] ?? "") && (
                          <option value={refinements[index]} disabled>
                            Choose
                          </option>
                        )}
                        {REFINEMENT_OPTIONS.map((refinement) => (
                          <option key={refinement} value={refinement}>
                            {refinement}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
              </fieldset>
              <p className="panel-note">
                Daily accepts four-star and standard five-star constellations, plus allowed Temper
                C1s. Named five-star weapons go to Endless.
              </p>
              <button
                onClick={removeLastPreview}
                disabled={!preview.some((c) => c)}
                style={{ marginTop: 12 }}
              >
                Undo
              </button>
              <button
                type="button"
                disabled={!preview.some(Boolean)}
                onClick={() => {
                  setPreview([null, null, null, null]);
                  setWeapons([null, null, null, null]);
                  setConstellations([DEFAULT_C, DEFAULT_C, DEFAULT_C, DEFAULT_C]);
                  setRefinements([DEFAULT_R, DEFAULT_R, DEFAULT_R, DEFAULT_R]);
                }}
                style={{ marginTop: 8 }}
              >
                Clear team
              </button>
              <p className="keyboard-note" style={{ margin: "12px 0 0" }}>
                Click a slot to search | Right-click to remove | Drag to move
              </p>
            </div>

            <div className="roster-toolbar">
              <h3>Characters</h3>
              <input
                className="submission-search"
                aria-label="Search characters"
                placeholder="Search characters…"
                value={rosterSearch}
                onChange={(event) => setRosterSearch(event.target.value)}
              />
            </div>
            <div className="roster-controls">
              <RosterSort />
            </div>
            <div className="roster-filter-summary">
              <span aria-live="polite">{visibleCharacters.length} characters</span>
              <button
                type="button"
                onClick={resetRosterFilters}
                disabled={
                  filterMode === "all" &&
                  rarityFilter === "all" &&
                  !rosterSearch &&
                  regionFilter === "all" &&
                  !weaponFilters.length
                }
              >
                Reset filters
              </button>
            </div>
            {visibleCharacters.length === 0 && (
              <p className="roster-empty">No characters match these filters.</p>
            )}
            {/* Element Filters (MATCH DAILY) */}
            <div
              className="element-filters"
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
              <RarityFilter value={rarityFilter} onChange={setRarityFilter} />
            </div>
            <AdvancedRosterFilters
              weapons={weaponFilters}
              onWeaponsChange={setWeaponFilters}
              region={regionFilter}
              onRegionChange={setRegionFilter}
            />

            {/* Character Grid */}
            <div className="character-grid">
              {visibleCharacters.map(([name]) => (
                <button
                  key={name}
                  className="character-tile"
                  draggable={!isSubmitting}
                  onDragStart={(event) => startCharacterDrag(event, name)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    const index = preview.indexOf(name);
                    if (index !== -1) removePreviewAt(index);
                  }}
                  aria-pressed={preview.includes(name)}
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
                    draggable={false}
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
          <div className="game-panel submit-panel">
            <h3 style={{ marginTop: 0 }}>{editing ? "Edit submission" : "Submit a Dummy"}</h3>

            <div style={{ marginBottom: 12, opacity: 0.9 }}>
              Upload a PNG or JPEG screenshot (up to 1MB) with the character names, portraits, and
              strongest hit hidden, as in the example below. Choose the four characters in
              screenshot order by clicking their slots or dragging from the roster.
              <br />
              Set constellations below the portraits (C0 means no constellations). Then choose a
              weapon for each character and its refinement (R1-R5) beside the weapon name. All four
              weapons are required.
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

            {editing && (
              <p className="panel-note">
                Leave the file picker empty to keep your current screenshot.
              </p>
            )}
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
                className="primary-button"
                disabled={!isValid || isSubmitting}
                style={{ width: "100%" }}
                onClick={submitDummy}
              >
                {isSubmitting ? "Saving..." : editing ? "Save changes" : "Submit Dummy"}
              </button>

              {submitError && <div style={{ marginTop: 10, color: "#ff6b6b" }}>{submitError}</div>}

              {submissionId && (
                <div style={{ marginTop: 10 }}>
                  <p>
                    Submission saved. ID: <b>{submissionId}</b>
                  </p>
                  {managementCode && (
                    <div className="management-code-box">
                      <strong>Save your private management code</strong>
                      <p>
                        {storageSaved
                          ? "Saved in this browser. Keep a backup to edit or delete from another device."
                          : "Browser storage is unavailable. Copy this code before leaving."}
                      </p>
                      <code>{managementCode}</code>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(managementCode);
                            setCopyMessage("Copied");
                          } catch {
                            setCopyMessage("Select and copy the code above.");
                          }
                        }}
                      >
                        Copy management code
                      </button>
                      <span role="status">{copyMessage}</span>
                      <Link to="/submissions">Manage submissions</Link>
                    </div>
                  )}
                </div>
              )}

              {!isValid && (
                <div style={{ marginTop: 8, opacity: 0.8, fontSize: 12 }}>
                  Required: PNG ≤ 1MB, select 4 unique characters with weapons and refinements, and
                  enter both numbers.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
