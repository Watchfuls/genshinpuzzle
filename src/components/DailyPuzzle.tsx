import { useState, useEffect, useCallback, useRef } from "react";
import type { GameState, Guess, Element } from "../game/types";
import { initialState } from "../game/initialState";
import { makeGuess } from "../game/gameController";
import { CHARACTER_DATA } from "../game/characters";
import TopTabs from "./TopTabs";
import { useSettings } from "../context/SettingsContext";

type Props = { mode?: "daily" | "endless" };

export default function DailyPuzzle({ mode = "daily" }: Props) {

  // =========================================================
  // 1) CONSTANTS + TYPES
  // =========================================================

  const ELEMENTS: Element[] = ["Pyro", "Hydro", "Electro", "Cryo", "Dendro", "Anemo", "Geo"];

  type DailyScore = 1 | 2 | 3 | 4 | 5 | "FAIL";

  type TodayRunSnapshot = {
    date: string; // YYYY-MM-DD (UTC)
    puzzleId: string; // submission id (string)
    preview: string[];
    guesses: string[][]; // guessesSoFar as list of 4-char arrays
    isWin: boolean;
    isOver: boolean;
  };

  const STATS_COOKIE = "gdg_daily_scores_v1";
  const TODAY_RUN_COOKIE = "gdg_today_run_v1";

  // =========================================================
  // 2) COOKIE HELPERS (pure I/O)
  // =========================================================

  const getCookie = useCallback((name: string): string | null => {
    const parts = document.cookie.split("; ").map((p) => p.split("="));
    const hit = parts.find(([k]) => k === name);
    return hit ? decodeURIComponent(hit[1] ?? "") : null;
  }, []);

  const setCookie = useCallback((name: string, value: string, days = 365) => {
    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
  }, []);

  const todayUTC = useCallback(() => new Date().toISOString().slice(0, 10), []);

  const loadScores = useCallback((): Record<string, DailyScore> => {
    try {
      const raw = getCookie(STATS_COOKIE);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, DailyScore>;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }, [getCookie]);

  const saveScores = useCallback(
    (scores: Record<string, DailyScore>) => {
      setCookie(STATS_COOKIE, JSON.stringify(scores), 365);
    },
    [setCookie],
  );

  const loadTodayRun = useCallback((): TodayRunSnapshot | null => {
    try {
      const raw = getCookie(TODAY_RUN_COOKIE);
      if (!raw) return null;
      return JSON.parse(raw) as TodayRunSnapshot;
    } catch {
      return null;
    }
  }, [getCookie]);

  const saveTodayRun = useCallback(
    (snap: TodayRunSnapshot) => {
      setCookie(TODAY_RUN_COOKIE, JSON.stringify(snap), 7);
    },
    [setCookie],
  );

  const clearTodayRun = useCallback(() => {
    setCookie(TODAY_RUN_COOKIE, "", 0);
  }, [setCookie]);

  // =========================================================
  // 3) UI + GAME STATE
  // =========================================================

  const { characterOrder, autoRevealHints } = useSettings();

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  const [filterMode, setFilterMode] = useState<"all" | "elements">("all");

  const [activeElements, setActiveElements] = useState<Record<Element, boolean>>(() =>
    ELEMENTS.reduce(
      (acc, el) => {
        acc[el] = false;
        return acc;
      },
      {} as Record<Element, boolean>,
    ),
  );

  const { hideKofi, setHideKofi } = useSettings();

  const [showShare, setShowShare] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const [showStats, setShowStats] = useState(false);
  const [scoresSnapshot, setScoresSnapshot] = useState<Record<string, DailyScore>>(() =>
    loadScores(),
  );

  const [state, setState] = useState<GameState>(initialState);
  const [preview, setPreview] = useState<string[]>([]);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [puzzleImageUrl, setPuzzleImageUrl] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [prevDate, setPrevDate] = useState<string | null>(null);
  const [nextDate, setNextDate] = useState<string | null>(null);
  const [isDateLoading, setIsDateLoading] = useState(false);

  const [endlessNonce, setEndlessNonce] = useState(0);

  // Endless-only: avoid repeats within this session (best-effort)
  const seenEndlessIdsRef = useRef<Set<string>>(new Set());

  // Used to avoid writing placeholder state into cookies mid-load
  const [loadedPuzzleId, setLoadedPuzzleId] = useState<string | null>(null);

  const isTodaySelected = selectedDate === todayUTC();
  const isGameOver = state.isWin || state.isOver;
  const isEndless = mode === "endless";

  const revealAllHintsIfWin = (s: GameState): GameState => {
    if (!s.isWin) return s;
    return {
      ...s,
      clueState: {
        ...s.clueState,
        strongestHitUnlocked: true,
        totalDpsUnlocked: true,
        elementsUnlocked: true,
        strongestHitRevealed: true,
        totalDpsRevealed: true,
        elementsRevealed: true,
        constellationsRefinementsUnlocked: true,
        constellationsRefinementsRevealed: true,
      },
    };
  };

  const revealAllHintsIfOver = (s: GameState): GameState => {
    if (!s.isOver) return s;
    return {
      ...s,
      clueState: {
        ...s.clueState,
        strongestHitUnlocked: true,
        totalDpsUnlocked: true,
        elementsUnlocked: true,
        constellationsRefinementsUnlocked: true,

        strongestHitRevealed: true,
        totalDpsRevealed: true,
        elementsRevealed: true,
        constellationsRefinementsRevealed: true,
      },
    };
  };

  // =========================================================
  // 4) FILTER CONTROLS
  // =========================================================

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
      if (!anyOn) setFilterMode("all");

      return next;
    });
  };

  // =========================================================
  // 5) CANONICAL “TODAY RUN” PERSISTENCE
  //    - one canonical writer + one manual flush
  // =========================================================

  const canPersistToday = useCallback(() => {
    if (isEndless) return false;
    if (!isTodaySelected) return false;
    if (isDateLoading) return false;
    if (!loadedPuzzleId) return false;
    if (String(state.puzzle.id) !== loadedPuzzleId) return false;
    return true;
  }, [isTodaySelected, isDateLoading, loadedPuzzleId, state.puzzle.id]);

  const writeTodayRun = useCallback(() => {
    if (!canPersistToday()) return;

    saveTodayRun({
      date: selectedDate,
      puzzleId: loadedPuzzleId!, // safe after canPersistToday()
      preview,
      guesses: state.guessesSoFar.map((g) => g.characters),
      isWin: state.isWin,
      isOver: state.isOver,
    });
  }, [
    canPersistToday,
    saveTodayRun,
    selectedDate,
    loadedPuzzleId,
    preview,
    state.guessesSoFar,
    state.isWin,
    state.isOver,
  ]);

  // Manual flush used when leaving today via arrows
  const persistTodayNow = useCallback(() => {
    writeTodayRun();
  }, [writeTodayRun]);

  // -----------------------------
  // DATE NAVIGATION HANDLER
  // -----------------------------
  const goToDate = (d: string) => {
    // If we are leaving today's puzzle, persist progress first
    persistTodayNow();

    // Block autosave effects during transition render
    setIsDateLoading(true);
    setPrevDate(null);
    setNextDate(null);

    setSelectedDate(d);
  };

  // Autosave whenever the run changes (today only, loaded puzzle only)
  useEffect(() => {
    writeTodayRun();
  }, [writeTodayRun]);

  // =========================================================
  // 6) DAILY SCORE RECORDING (on game end, today only)
  // =========================================================

  const recordScoreIfToday = useCallback(
    (finalState: GameState) => {
      if (isEndless) return;
      if (selectedDate !== todayUTC()) return;
      if (!finalState.isOver) return;

      const scores = loadScores();
      if (scores[selectedDate]) return; // already recorded for this date

      if (finalState.isWin) {
        const guessesTaken = finalState.guessesSoFar.length; // 1..5
        const clamped = Math.min(5, Math.max(1, guessesTaken)) as 1 | 2 | 3 | 4 | 5;
        scores[selectedDate] = clamped;
      } else {
        scores[selectedDate] = "FAIL";
      }

      saveScores(scores);
      setScoresSnapshot(scores);
      setShowStats(true);
    },
    [selectedDate, todayUTC, loadScores, saveScores],
  );

  // =========================================================
  // 7) LOAD PUZZLE (and restore today run if applicable)
  // =========================================================

  useEffect(() => {
    const load = async () => {
      // Clear UI state immediately when switching date / puzzle
      setLoadError(null);
      setPuzzleImageUrl(null);
      setPreview([]);
      setState(initialState);

      setPrevDate(null);
      setNextDate(null);

      setLoadedPuzzleId(null);
      setIsDateLoading(true);

      try {
        const tryLimit = isEndless ? 6 : 1;
        let row: any = null;

        for (let attempt = 0; attempt < tryLimit; attempt++) {
          const endpoint = isEndless
            ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get_random_puzzle`
            : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get_daily_puzzle?date=${selectedDate}`;

          const res = await fetch(endpoint, {
            method: "GET",
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
          });

          if (!res.ok) {
            const text = await res.text();
            setIsDateLoading(false);

            if (!isEndless && res.status === 404 && text.includes("No unused submissions left")) {
              setLoadError("No daily puzzles available right now. Please check back later.");
              return;
            }

            setLoadError(
              isEndless
                ? "Failed to load endless puzzle. Please try again."
                : "Failed to load daily puzzle. Please refresh and try again.",
            );
            return;
          }

          const candidate = await res.json();

          if (!isEndless) {
            row = candidate;
            break;
          }

          const idStr = String(candidate?.id ?? "");
          if (!idStr) {
            row = candidate;
            break;
          }

          if (!seenEndlessIdsRef.current.has(idStr)) {
            seenEndlessIdsRef.current.add(idStr);
            row = candidate;
            break;
          }

          // duplicate -> try again
        }

        if (!row) {
          setIsDateLoading(false);
          setLoadError("No new endless puzzles found right now. Try again later.");
          return;
        }

        // If server corrected date, update and let effect rerun (daily only)
        if (!isEndless && row.date && row.date !== selectedDate) {
          setSelectedDate(row.date);
          setIsDateLoading(false);
          return;
        }

        setIsDateLoading(false);

        if (!isEndless) {
          setPrevDate(row.prev_date ?? null);
          setNextDate(row.next_date ?? null);
        } else {
          setPrevDate(null);
          setNextDate(null);
        }

        setPuzzleImageUrl(row.image_url ?? null);

        const teamNames: string[] = row.team ?? [];
        const elements: string[] = row.elements ?? [];

        const baseState: GameState = {
          ...initialState,
          puzzle: {
            ...initialState.puzzle,
            id: String(row.id),
            strongestHit: Number(row.strongest_hit),
            totalDps: Number(row.total_dps),
            team: teamNames.map((name: string, i: number) => ({
              name,
              element: (elements[i] ?? "None") as Element,
              individualDps: 0,
              damagePercentage: 0,
            })),
            constellations: row.constellations ?? ["Hidden", "Hidden", "Hidden", "Hidden"],
            refinements: row.refinements ?? ["Hidden", "Hidden", "Hidden", "Hidden"],
            genshinUid: row.genshin_uid ?? null,
          },
        };

        setLoadedPuzzleId(String(row.id));

        // Restore only for TODAY + daily mode, only if puzzleId matches
        if (!isEndless) {
          const isToday = row.date === todayUTC();
          const run = loadTodayRun();

          if (isToday && run && run.date === row.date && run.puzzleId === String(row.id)) {
            let rebuilt = baseState;
            for (const g of run.guesses) rebuilt = makeGuess(rebuilt, { characters: g });

            setState(revealAllHintsIfWin(rebuilt));
            setPreview(run.preview ?? []);
            return;
          }

          // If we're on today but cookie refers to a different puzzle, discard it
          if (isToday && run && run.date === row.date && run.puzzleId !== String(row.id)) {
            clearTodayRun();
          }
        }

        setState(baseState);
      } catch (e) {
        setIsDateLoading(false);
        console.error("Failed to load puzzle:", e);
        setLoadError(
          isEndless
            ? "Failed to load endless puzzle. Please try again."
            : "Failed to load daily puzzle. Please refresh and try again.",
        );
      }
    };

    load();
  }, [selectedDate, endlessNonce, isEndless, todayUTC, loadTodayRun, clearTodayRun]);

  // =========================================================
  // 8) GAMEPLAY CONTROLS
  // =========================================================

  const nextEndlessPuzzle = () => {
    if (!isEndless) return;

    // clear current run UI immediately
    setLoadError(null);
    setPuzzleImageUrl(null);
    setPreview([]);
    setState(initialState);
    setLoadedPuzzleId(null);

    setEndlessNonce((n) => n + 1);
  };

  const removePreviewAt = (index: number) => {
    setPreview((prev) => prev.filter((_, i) => i !== index));
  };

  const addToPreview = (name: string) => {
    if (isGameOver) return;

    // toggle: if already selected, remove it
    if (preview.includes(name)) {
      setPreview((prev) => prev.filter((c) => c !== name));
      return;
    }

    if (preview.length >= 4) return;
    setPreview((prev) => [...prev, name]);
  };

  const removeLastPreview = useCallback(() => {
    setPreview((prev) => prev.slice(0, -1));
  }, []);

  const clearPreview = useCallback(() => {
    setPreview([]);
  }, []);

  const getAllGreensSoFar = (s: GameState): string[] => {
    const set = new Set<string>();

    s.guessesSoFar.forEach((g, i) => {
      g.characters.forEach((char, j) => {
        if (s.gridTiles[i]?.[j] === "GREEN") set.add(char);
      });
    });

    return Array.from(set).slice(0, 4);
  };

  const submitGuess = useCallback(() => {
    if (preview.length !== 4 || isGameOver) return;

    const guess: Guess = { characters: preview };
    const next = makeGuess(state, guess);

    let finalState = next;  

    // If the run is over (win OR fail), reveal everything.
    finalState = revealAllHintsIfOver(finalState);
    
    setState(finalState);
    recordScoreIfToday(finalState);

    if (!finalState.isWin) {
      setPreview(getAllGreensSoFar(finalState));
    } else {
      setPreview([]);
    }

    // No manual today-run write needed; autosave will run
  }, [preview, isGameOver, state, recordScoreIfToday]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isGameOver) return;

      if (e.key === "Backspace") {
        const target = e.target as HTMLElement;
        const isInput =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable;

        if (!isInput) {
          e.preventDefault();
          removeLastPreview();
        }
      }

      if (e.key === "Enter") {
        e.preventDefault();
        submitGuess();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isGameOver, removeLastPreview, submitGuess]);

  // =========================================================
  // 9) HINT REVEAL
  // =========================================================

  const revealHint = (
    hint: "strongestHit" | "totalDps" | "elements" | "constellationsRefinements",
  ) => {
    setState((prev) => ({
      ...prev,
      clueState: { ...prev.clueState, [`${hint}Revealed`]: true },
    }));
  };

  // =========================================================
  // 10) DERIVED RENDER VALUES
  // =========================================================

  useEffect(() => {
    if (!autoRevealHints) return;

    setState((prev) => {
      const cs = prev.clueState;

      const next = {
        ...cs,
        constellationsRefinementsRevealed:
          cs.constellationsRefinementsUnlocked ? true : cs.constellationsRefinementsRevealed,
        totalDpsRevealed: cs.totalDpsUnlocked ? true : cs.totalDpsRevealed,
        strongestHitRevealed: cs.strongestHitUnlocked ? true : cs.strongestHitRevealed,
        elementsRevealed: cs.elementsUnlocked ? true : cs.elementsRevealed,
      };

      // no changes -> no rerender loop
      if (
        next.constellationsRefinementsRevealed === cs.constellationsRefinementsRevealed &&
        next.totalDpsRevealed === cs.totalDpsRevealed &&
        next.strongestHitRevealed === cs.strongestHitRevealed &&
        next.elementsRevealed === cs.elementsRevealed
      ) {
        return prev;
      }

      return { ...prev, clueState: next };
    });
  }, [autoRevealHints, state.clueState]);

  useEffect(() => {
    if (!showSearchResults) return;

    const el = itemRefs.current[highlightedIndex];
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, showSearchResults]);

  const sortedCharacterNames = Object.keys(CHARACTER_DATA).sort((a, b) =>
    a.localeCompare(b),
  );

  const filteredSearchResults =
    searchQuery.trim().length === 0
      ? sortedCharacterNames
      : sortedCharacterNames.filter((name) =>
          name.toLowerCase().includes(searchQuery.toLowerCase()),
        );

  const answerPreview = state.puzzle.team.map((c) => c.name);
  const displaySlots = isGameOver ? answerPreview : preview;

  const correctCharacters = new Set<string>();
  const yellowCharacters = new Set<string>(); // element-correct, wrong character
  const wrongCharacters = new Set<string>();  // fully wrong (GRAY)

  state.guessesSoFar.forEach((guess, i) => {
    guess.characters.forEach((char, j) => {
      const tile = state.gridTiles[i]?.[j];

      if (tile === "GREEN") {
        correctCharacters.add(char);
        yellowCharacters.delete(char);
        wrongCharacters.delete(char);
        return;
      }

      if (tile === "YELLOW") {
        if (!correctCharacters.has(char)) {
          yellowCharacters.add(char);
          wrongCharacters.delete(char); // yellow wins over gray
        }
        return;
      }

      // tile === "GRAY" (or anything else treated as wrong)
      if (!correctCharacters.has(char) && !yellowCharacters.has(char)) {
        wrongCharacters.add(char);
      }
    });
  });

  const getGridBg = (name: string) => {
    if (correctCharacters.has(name)) return "#2f6f3a";
    if (yellowCharacters.has(name)) return "#7a6a2b"; // match your guess tile yellow
    if (wrongCharacters.has(name)) return "#1f1f1f";
    return "#2a2a2a";
  };

  const canShare =
    mode === "daily" &&
    selectedDate === todayUTC() &&
    isGameOver;

  const tileToEmoji = (t: string) => (t === "GREEN" ? "🟩" : t === "YELLOW" ? "🟨" : "⬛");

  const buildShareText = (finalState: GameState) => {
    const isFail = !finalState.isWin && finalState.isOver;
    const scoreText = isFail ? "FAIL" : `${finalState.guessesSoFar.length}/5`;
    
    const header =
    mode === "endless"
    ? `Dummle Endless, ${scoreText}`
    : `Dummle ${selectedDate}, ${scoreText}`;
    
    const lines = finalState.gridTiles
    .slice(0, finalState.guessesSoFar.length)
    .map((row) => row.map(tileToEmoji).join(""));
    
    return [header, ...lines].join("\n");
  };

  const openShare = () => {
    if (!canShare) return;
    setShareCopied(false);
    setShowShare(true);
  };

  const copyShareText = async () => {
    const text = buildShareText(state);
    await navigator.clipboard.writeText(text);
    setShareCopied(true);
  };

  // =========================================================
  // 11) RENDER
  // =========================================================

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopTabs
        onShowScores={() => setShowStats(true)}
      />
      {/* ================= STATS MODAL ================= */}
      {showStats && (
        <button
          type="button"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            border: "none",
            padding: 0,
          }}
          onClick={() => setShowStats(false)}
          aria-label="Close stats"
        >
          <div
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            style={{
              width: 520,
              maxWidth: "92vw",
              border: "1px solid #444",
              borderRadius: 10,
              background: "#1f1f1f",
              padding: 14,
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setShowStats(false);
              }
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 700 }}>Your Daily Results</div>
              <button
                onClick={() => setShowStats(false)}
                style={{
                  width: 32,
                  height: 32,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {(() => {
              const bins = [1, 2, 3, 4, 5, "FAIL"] as const;
              const counts: Record<(typeof bins)[number], number> = {
                1: 0,
                2: 0,
                3: 0,
                4: 0,
                5: 0,
                FAIL: 0,
              };

              for (const v of Object.values(scoresSnapshot)) {
                if (v === "FAIL") counts.FAIL++;
                else counts[v]++;
              }

              const max = Math.max(1, ...Object.values(counts));

              return (
                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  {bins.map((b) => {
                    const n = counts[b];
                    const pct = (n / max) * 100;
                    const label = b === "FAIL" ? "Fail" : String(b);

                    return (
                      <div
                        key={label}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "40px 1fr 40px",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <div style={{ opacity: 0.85 }}>{label}</div>
                        <div
                          style={{
                            height: 14,
                            border: "1px solid #444",
                            borderRadius: 6,
                            overflow: "hidden",
                            background: "#2a2a2a",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              background: "#555",
                            }}
                          />
                        </div>
                        <div style={{ textAlign: "right", opacity: 0.85 }}>{n}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </button>
      )}

      {/* ================= SHARE MODAL ================= */}

      {showShare && (
        <button
          type="button"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            border: "none",
            padding: 0,
          }}
          onClick={() => setShowShare(false)}
          aria-label="Close share"
        >
          <div
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            style={{
              width: 520,
              maxWidth: "92vw",
              border: "1px solid #444",
              borderRadius: 10,
              background: "#1f1f1f",
              padding: 14,
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setShowShare(false);
              }
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <div style={{ fontWeight: 700 }}>Share</div>
              <button
                onClick={() => setShowShare(false)}
                style={{
                  width: 32,
                  height: 32,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                padding: 12,
                border: "1px solid #444",
                borderRadius: 8,
                background: "#151515",
                fontFamily: "monospace",
                fontSize: 14,
                whiteSpace: "pre",
                lineHeight: 1.4,
                overflowX: "auto",
              }}
            >
              {buildShareText(state)}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={copyShareText}>
                {shareCopied ? "Copied" : "Copy to clipboard"}
              </button>
            </div>
          </div>
        </button>
      )}

      <div style={{ padding: "1rem" }}>
        {/* ================= MAIN LAYOUT ================= */}
        <div
          style={{
            display: "flex",
            gap: "2rem",
            minHeight: "100vh",
            justifyContent: "flex-start",
            alignItems: "stretch",
          }}
        >
          {/* ============== LEFT SIDE ============== */}
          <div style={{ flex: 1, minWidth: 760, maxWidth: 760 }}>
            {/* Preview Row */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "center",
                marginBottom: "1rem",
              }}
            >
              {[0, 1, 2, 3].map((i) => {
                const char = displaySlots[i];

                return (
                  <button
                    type="button"
                    key={i}
                    disabled={!char || isGameOver}
                    onClick={() => removePreviewAt(i)}
                    style={{
                      width: 72,
                      height: 72,
                      border: "2px solid #444",
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background:
                        char && correctCharacters.has(char)
                          ? "#2f6f3a"
                          : "#1f1f1f",
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
                );
              })}
            </div>

            {/* Controls */}
            <div
              style={{
                textAlign: "center",
                marginBottom: "1rem",
                display: "flex",
                justifyContent: "center",
                gap: "0.5rem",
                alignItems: "center",
                position: "relative",
              }}
            >
              <button
                onClick={submitGuess}
                disabled={preview.length !== 4 || isGameOver}
              >
                Submit Guess
              </button>

              <button
                onClick={removeLastPreview}
                disabled={preview.length === 0 || isGameOver}
              >
                Backspace
              </button>

              <button
                type="button"
                onClick={clearPreview}
                disabled={preview.length === 0 || isGameOver}
              >
                Clear
              </button>

              {/* SEARCH */}
              <div style={{ position: "relative" }}>
                <input
                  onBlur={() => {
                    setTimeout(() => {
                      setSearchQuery("");
                      setShowSearchResults(false);
                    }, 100);
                  }}
                  onKeyDown={(e) => {
                    if (!showSearchResults) return;

                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlightedIndex((prev) =>
                        prev < filteredSearchResults.length - 1 ? prev + 1 : prev,
                      );
                    }

                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
                    }

                    if (e.key === "Enter") {
                      e.preventDefault();
                      const name = filteredSearchResults[highlightedIndex];
                      if (name) {
                        addToPreview(name);
                        setSearchQuery("");
                        setShowSearchResults(false);
                        setHighlightedIndex(0);
                      }
                    }
                  }}
                  type="text"
                  value={searchQuery}
                  placeholder="Search..."
                  disabled={isGameOver}
                  onFocus={() => {
                    setShowSearchResults(true);
                    setHighlightedIndex(0);
                  }}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchResults(true);
                    setHighlightedIndex(0);
                  }}
                  style={{
                    height: 40,
                    padding: "0 0.75rem",
                    borderRadius: 8,
                    border: "1px solid transparent",
                    fontSize: "1em",
                    fontWeight: 500,
                    fontFamily: "inherit",
                    backgroundColor: "#1a1a1a",
                    color: "inherit",
                    outline: "none",
                    width: 180,
                  }}
                />

                {showSearchResults && filteredSearchResults.length > 0 && (
                  <div
                    ref={dropdownRef}
                    style={{
                      position: "absolute",
                      top: "110%",
                      left: 0,
                      width: 220,
                      maxHeight: 260,
                      overflowY: "auto",
                      border: "1px solid #444",
                      borderRadius: 8,
                      background: "#1a1a1a",
                      zIndex: 50,
                      padding: 6,
                    }}
                  >
                    {filteredSearchResults.map((name, index) => (
                      <button
                        ref={(el) => {
                          itemRefs.current[index] = el;
                        }}
                        key={name}
                        type="button"
                        onMouseEnter={() => setHighlightedIndex(index)}
                        onClick={() => {
                          addToPreview(name);
                          setSearchQuery("");
                          setShowSearchResults(false);
                          setHighlightedIndex(0);
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "4px 6px",
                          borderRadius: 6,
                          border: "none",
                          background: index === highlightedIndex ? "#2a2a2a" : "transparent",
                          color: "inherit",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <img
                          src={CHARACTER_DATA[name].iconUrl}
                          alt={name}
                          style={{ width: 24, height: 24 }}
                        />
                        <span style={{ fontSize: 14 }}>{name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Element Filters */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "8px",
                marginBottom: "1rem",
                flexWrap: "wrap",
              }}
            >
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
                .sort(([, a], [, b]) => {
                  if (characterOrder === "name") {
                    return a.name.localeCompare(b.name);
                  }

                  // release order first, then name
                  if (a.releaseDate !== b.releaseDate) {
                    return a.releaseDate.localeCompare(b.releaseDate);
                  }

                  return a.name.localeCompare(b.name);
                })
                .filter((entry) => {
                  const data = entry[1];
                  if (filterMode === "all") return true;
                  return activeElements[data.element as Element];
                })
                .map(([name]) => {
                  const isFaded = wrongCharacters.has(name) || yellowCharacters.has(name);
                  
                  return (               
                    <button
                      key={name}
                      onClick={() => addToPreview(name)}
                      disabled={isGameOver}
                      title={name}
                      style={{
                        width: 64,
                        height: 64,
                        padding: 4,
                        borderRadius: 6,
                        border: "1px solid #444",
                        background: getGridBg(name),
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
                        opacity: isFaded ? 0.25 : 1,
                        filter: isFaded ? "grayscale(0.6)" : "none",
                      }}
                    />
                    </button>
                  );
                })}
            </div>
          </div>

          {/* ============== RIGHT SIDE ============== */}
          <div style={{ width: "480px", flexShrink: 0 }}>

            {/* ENDLESS */}
            {isEndless && (
              <div
                style={{
                  marginTop: "1rem",
                  marginBottom: "0.75rem",
                  padding: 10,
                  border: "1px solid #444",
                  borderRadius: 8,
                  background: "#1f1f1f",
                  opacity: 0.95,
                  fontSize: 13,
                  lineHeight: 1.4,
                }}
              >
                Endless mode may show puzzles that have constellations on limited 5 ★ characters, underlevelled characters or a variety of other variences.
              </div>
            )}

            {isEndless && (
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.75rem" }}>
                <button type="button" onClick={nextEndlessPuzzle}>
                  Next Puzzle
                </button>
              </div>
            )}

            {/* DATE */}
            {!isEndless && (
              <div
                style={{
                  marginTop: "1rem",
                  marginBottom: "0.75rem",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                {!isDateLoading && prevDate ? (
                  <button
                    onClick={() => {
                      // Flush today progress before leaving today
                      goToDate(prevDate);
                    }}
                    aria-label="Previous day"
                    title="Previous day"
                    style={{
                      width: 28,
                      height: 32,
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      color: "inherit",
                      opacity: 0.9,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      lineHeight: 1,
                      fontSize: 18,
                    }}
                  >
                    ◀
                  </button>
                ) : (
                  <div style={{ width: 28, height: 32 }} />
                )}

                <div
                  style={{
                    border: "1px solid #444",
                    borderRadius: 10,
                    padding: "6px 14px",
                    background: "#1f1f1f",
                    fontSize: 13,
                    opacity: 0.95,
                    userSelect: "none",
                    minWidth: 130,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selectedDate}
                </div>

                {!isDateLoading && nextDate ? (
                  <button
                    onClick={() => {
                      goToDate(nextDate);
                    }}
                    aria-label="Next day"
                    title="Next day"
                    style={{
                      width: 28,
                      height: 32,
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      color: "inherit",
                      opacity: 0.9,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      lineHeight: 1,
                      fontSize: 18,
                    }}
                  >
                    ▶
                  </button>
                ) : (
                  <div style={{ width: 28, height: 32 }} />
                )}
              </div>
            )}

            {/* IMAGE */}
            {loadError && (
              <div
                style={{
                  marginTop: "1rem",
                  marginBottom: "0.75rem",
                  padding: 10,
                  border: "1px solid #444",
                  borderRadius: 8,
                  background: "#1f1f1f",
                  opacity: 0.95,
                  fontSize: 13,
                }}
              >
                {loadError}
              </div>
            )}

            {puzzleImageUrl && (
              <div style={{ marginTop: "1rem", marginBottom: "0.75rem" }}>
                <img
                  src={puzzleImageUrl}
                  alt="Puzzle"
                  style={{
                    width: "100%",
                    border: "1px solid #444",
                    borderRadius: 8,
                    display: "block",
                  }}
                />
              </div>
            )}

            {/* UID */}
            {state.puzzle.genshinUid && (
              <div
                style={{
                  marginBottom: 12,
                  fontSize: 13,
                  opacity: 0.85,
                }}
              >
                UID:{" "}
                <a
                  href={`https://enka.network/u/${state.puzzle.genshinUid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "inherit",
                    textDecoration: "underline",
                    fontWeight: "normal",
                  }}
                >
                  {state.puzzle.genshinUid}
                </a>
              </div>
            )}

            {/* Hints */}
            <h3 style={{ marginTop: "1.5rem" }}>Hints</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 2fr",
                columnGap: 12,
                rowGap: 12,
                alignItems: "center",
              }}
            >
              {/* Constellations + Refinements */}
              <button
                style={{ width: "100%" }}
                disabled={
                  !state.clueState.constellationsRefinementsUnlocked ||
                  state.clueState.constellationsRefinementsRevealed
                }
                onClick={() => revealHint("constellationsRefinements")}
              >
                Constellations & Refinements
              </button>

              <div style={{ minHeight: 22, opacity: 0.9 }}>
                {state.clueState.constellationsRefinementsRevealed
                  ? [0, 1, 2, 3]
                      .map((i) => {
                        const c = state.puzzle.constellations?.[i] ?? "Hidden";
                        const r = state.puzzle.refinements?.[i] ?? "Hidden";

                        const cShown = c !== "Hidden" ? c : "";
                        const rShown = r !== "Hidden" ? r : "";

                        if (!cShown && !rShown) return "Hidden";
                        return `${cShown}${rShown}`;
                      })
                      .join(" | ")
                  : ""}
              </div>

              {/* Total DPS */}
              <button
                style={{ width: "100%" }}
                disabled={!state.clueState.totalDpsUnlocked || state.clueState.totalDpsRevealed}
                onClick={() => revealHint("totalDps")}
              >
                Total DPS
              </button>

              <div style={{ minHeight: 22, opacity: 0.9 }}>
                {state.clueState.totalDpsRevealed ? state.puzzle.totalDps : ""}
              </div>

              {/* Strongest Hit */}
              <button
                style={{ width: "100%" }}
                disabled={
                  !state.clueState.strongestHitUnlocked || state.clueState.strongestHitRevealed
                }
                onClick={() => revealHint("strongestHit")}
              >
                Strongest Hit
              </button>

              <div style={{ minHeight: 22, opacity: 0.9 }}>
                {state.clueState.strongestHitRevealed ? state.puzzle.strongestHit : ""}
              </div>

              {/* Elements */}
              <button
                style={{ width: "100%" }}
                disabled={!state.clueState.elementsUnlocked || state.clueState.elementsRevealed}
                onClick={() => revealHint("elements")}
              >
                Elements
              </button>

              <div
                style={{
                  minHeight: 22,
                  opacity: 0.9,
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                {state.clueState.elementsRevealed
                  ? state.puzzle.team.map((c, idx) => (
                      <img
                        key={`${c.element}-${idx}`}
                        src={`${import.meta.env.BASE_URL}icons/elements/${c.element}_Icon.png`}
                        alt={c.element}
                        title={c.element}
                        style={{
                          width: 22,
                          height: 22,
                          objectFit: "contain",
                          display: "block",
                        }}
                      />
                    ))
                  : ""}
              </div>
            </div>

            {/* Guesses */}
            <h3>Guesses</h3>
            <div
              style={{
                fontSize: 12,
                opacity: 0.8,
                marginBottom: 10,
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: "#2f6f3a", fontWeight: 600 }}>Green</span> = Correct character{" "}
              {" | "}
              <span style={{ color: "#7a6a2b", fontWeight: 600 }}>Yellow</span> = Correct element{" "}
              {" | "}Order does not matter
            </div>

            {state.guessesSoFar.map((guess, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "8px",
                  marginBottom: "0.5rem",
                  flexWrap: "nowrap",
                }}
              >
                {guess.characters.map((char, j) => {
                  const tile = state.gridTiles[i][j];
                  const color =
                    tile === "GREEN" ? "#2f6f3a" : tile === "YELLOW" ? "#7a6a2b" : "#555";

                  return (
                    <div
                      key={j}
                      title={char}
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 6,
                        border: "1px solid #444",
                        background: color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={CHARACTER_DATA[char].iconUrl}
                        alt={char}
                        style={{
                          width: 56,
                          height: 56,
                          objectFit: "contain",
                          display: "block",
                          margin: "0 auto",
                          pointerEvents: "none",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
      
            {isGameOver && (
              <div
                style={{
                  marginTop: "1rem",
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: state.isWin ? "lightgreen" : "#ff6b6b",
                }}
              >
                {state.isWin ? "You solved the puzzle" : "Game Over"}
                {canShare && (
                  <div style={{ marginTop: "1rem", display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => setShowStats(true)}>
                      Scores
                    </button>
                    <button type="button" onClick={openShare}>
                      Share
                    </button>
                  </div>
                )}
              </div>
            )}            
          </div>

          <div style={{ width: 320, flexShrink: 0 }}>
            {/* THIRD COLUMN */}
            <div style={{                   marginTop: "1rem",
                  marginBottom: "0.75rem",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 12,}}>
              <button
                type="button"
                onClick={() => setHideKofi(!hideKofi)}
                style={{

                  border: "1px solid #444",
                  borderRadius: 10,
                  padding: "6px 14px",
                  background: "#1f1f1f",
                  fontSize: 13,
                  opacity: 0.95,
                  userSelect: "none",
                  minWidth: 130,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",





                  //height: 40,
                  //padding: "0 14px",
                  //borderRadius: 6,
                  //border: "1px solid #444",
                  //background: "#1f1f1f",
                  color: !hideKofi ? "rgba(255,255,255,0.8)" : "#fff",
                
                  cursor: "pointer",
                  //minWidth: 120,
                }}
              >
                {hideKofi ? "Show Ko-fi" : "Hide Ko-fi"}
              </button>
            </div>

            {!hideKofi && (
              <div style={{ width: 320, flexShrink: 0 }}>
                <div
                  style={{
                    border: "1px solid #444",
                    borderRadius: 10,
                    background: "#1f1f1f",
                    padding: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700 }}>It costs me $25 a month to host the server, any help towards that is appreciated!</div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <iframe
                      title="Ko-fi"
                      src="https://ko-fi.com/watchful/?hidefeed=true&widget=true&embed=true"
                      style={{ width: "100%", height: 620, border: "none" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
