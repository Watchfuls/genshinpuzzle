import { useState, useEffect, useCallback, useRef } from "react";
import type { GameState, Guess, Element, ChoiceClue } from "../game/types";
import { initialState } from "../game/initialState";
import { makeGuess } from "../game/gameController";
import { CHARACTER_DATA } from "../game/characters";
import TopTabs from "./TopTabs";
import CharacterClueValues from "./CharacterClueValues";
import { CHOICE_CLUES, claimChoiceClue } from "../game/choiceClues";
import { startCharacterDrag, readCharacterDrop } from "../game/characterDrag";
import { characterClue } from "../game/characterClues";
import RosterSort from "./RosterSort";
import RarityFilter from "./RarityFilter";
import AdvancedRosterFilters from "./AdvancedRosterFilters";
import { compareCharacters, characterRarity } from "../game/roster";
import { useSettings } from "../context/SettingsContext";
import { getGenshinVersion } from "../game/genshinVersions";
import { nextDailyPuzzleDate } from "../game/dailyNavigation";

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
    clueChoices?: [ChoiceClue | null, ChoiceClue | null];
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

  const [regionFilter, setRegionFilter] = useState("all");
  const [weaponFilters, setWeaponFilters] = useState<string[]>([]);
  const [rarityFilter, setRarityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

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
  const [clueDrafts, setClueDrafts] = useState<[ChoiceClue | "", ChoiceClue | ""]>(["", ""]);

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
  const isInteractionBlocked = isGameOver || !loadedPuzzleId || isDateLoading || !!loadError;
  const isEndless = mode === "endless";

  const revealAllHintsIfWin = (s: GameState): GameState => {
    if (!s.isWin) return s;
    return {
      ...s,
      clueState: {
        ...s.clueState,
        weaponsUnlocked: true,
        weaponsRevealed: true,
        regionsUnlocked: true,
        regionsRevealed: true,
        strongestHitUnlocked: true,
        elementsUnlocked: true,
        strongestHitRevealed: true,
        elementsRevealed: true,
      },
    };
  };

  const revealAllHintsIfOver = (s: GameState): GameState => {
    if (!s.isOver) return s;
    return {
      ...s,
      clueState: {
        ...s.clueState,
        weaponsUnlocked: true,
        weaponsRevealed: true,
        regionsUnlocked: true,
        regionsRevealed: true,
        strongestHitUnlocked: true,
        elementsUnlocked: true,

        strongestHitRevealed: true,
        elementsRevealed: true,
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
      clueChoices: state.clueState.choiceClues,
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
    state.clueState.choiceClues,
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
    const controller = new AbortController();
    const { signal } = controller;

    const load = async () => {
      // Clear UI state immediately when switching date / puzzle
      setLoadError(null);
      setPuzzleImageUrl(null);
      setPreview([]);
      setState(initialState);
      setClueDrafts(["", ""]);
      setStatusFilter("all");

      const earlier = new Date(selectedDate + "T00:00:00Z");
      earlier.setUTCDate(earlier.getUTCDate() - 1);
      setPrevDate(isEndless ? null : earlier.toISOString().slice(0, 10));
      setNextDate(isEndless ? null : nextDailyPuzzleDate(selectedDate, todayUTC()));

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
            signal,
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
          });
          if (signal.aborted) return;

          if (!res.ok) {
            const text = await res.text();
            if (signal.aborted) return;
            setIsDateLoading(false);

            if (!isEndless && res.status === 404 && text.includes("No unused submissions left")) {
              setLoadError(
                "We are literally out of puzzles without constellations on limited 5-star characters or 5-star weapons... Choose an earlier date to play an older puzzle, or submit one of your own!",
              );
              return;
            }

            if (!isEndless && res.status === 404) {
              setLoadError(
                "No puzzle for this date. Choose an earlier date to play an older puzzle.",
              );
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
          if (signal.aborted) return;

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
          setNextDate(nextDailyPuzzleDate(selectedDate, todayUTC(), row.next_date));
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
            createdAt: row.created_at ?? null,
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

            if (Array.isArray(run.clueChoices))
              run.clueChoices.forEach((clue, slot) => {
                if (clue) rebuilt = claimChoiceClue(rebuilt, slot, clue);
              });
            // Completed runs expose every clue; choices remain recorded in the snapshot.
            if (rebuilt.isOver || rebuilt.isWin) {
              const saved = run.clueChoices;
              rebuilt = {
                ...rebuilt,
                clueState: {
                  ...rebuilt.clueState,
                  choiceClues: [
                    CHOICE_CLUES.some((c) => c.value === saved?.[0]) ? saved![0] : null,
                    CHOICE_CLUES.some((c) => c.value === saved?.[1]) && saved?.[1] !== saved?.[0]
                      ? saved![1]
                      : null,
                  ],
                },
              };
            }
            setState(revealAllHintsIfOver(revealAllHintsIfWin(rebuilt)));
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
        if (signal.aborted) return;
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
    return () => controller.abort();
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
    if (isInteractionBlocked) return;

    // toggle: if already selected, remove it
    if (preview.includes(name)) {
      setPreview((prev) => prev.filter((c) => c !== name));
      return;
    }

    if (preview.length >= 4) return;
    setPreview((prev) => [...prev, name]);
  };

  const dropIntoPreview = (name: string, index?: number) => {
    if (isInteractionBlocked) return;
    setPreview((current) => {
      const next = [...current];
      const existing = next.indexOf(name);
      if (existing !== -1) {
        if (index === undefined || existing === index) return current;
        next.splice(existing, 1);
        next.splice(Math.min(index, next.length), 0, name);
        return next;
      }
      if (index !== undefined && index < next.length) {
        next[index] = name;
        return next;
      }
      return next.length < 4 ? [...next, name] : current;
    });
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
    if (preview.length !== 4 || isInteractionBlocked) return;

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
  }, [preview, isInteractionBlocked, state, recordScoreIfToday]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        isInteractionBlocked ||
        e.defaultPrevented ||
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        document.querySelector('[role="dialog"]')
      )
        return;
      const target = e.target as HTMLElement;
      const isEditing = !!target.closest('input, textarea, select, [contenteditable="true"]');
      if (isEditing) return;

      if (e.key === "Backspace") {
        const target = e.target as HTMLElement;
        const isInput =
          target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

        if (!isInput) {
          e.preventDefault();
          removeLastPreview();
        }
      }

      if (e.key === "Enter" && !target.closest("button, a, summary")) {
        e.preventDefault();
        submitGuess();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isInteractionBlocked, removeLastPreview, submitGuess]);

  // =========================================================
  // 9) HINT REVEAL
  // =========================================================

  const revealHint = (hint: "strongestHit" | "elements" | "weapons" | "regions") => {
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
        weaponsRevealed: cs.weaponsUnlocked || cs.weaponsRevealed,
        regionsRevealed: cs.regionsUnlocked || cs.regionsRevealed,
        strongestHitRevealed: cs.strongestHitUnlocked ? true : cs.strongestHitRevealed,
        elementsRevealed: cs.elementsUnlocked ? true : cs.elementsRevealed,
      };

      // no changes -> no rerender loop
      if (
        next.weaponsRevealed === cs.weaponsRevealed &&
        next.regionsRevealed === cs.regionsRevealed &&
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

  const sortedCharacterNames = Object.keys(CHARACTER_DATA).sort((a, b) => a.localeCompare(b));

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
  const wrongCharacters = new Set<string>(); // fully wrong (GRAY)

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

  const canShare = mode === "daily" && selectedDate === todayUTC() && isGameOver;

  const tileToEmoji = (t: string) => (t === "GREEN" ? "🟩" : t === "YELLOW" ? "🟨" : "⬛");

  const buildShareText = (finalState: GameState) => {
    const isFail = !finalState.isWin && finalState.isOver;
    const scoreText = isFail ? "FAIL" : `${finalState.guessesSoFar.length}/5`;

    const header =
      mode === "endless" ? `Dummle Endless, ${scoreText}` : `Dummle ${selectedDate}, ${scoreText}`;

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

  useEffect(() => {
    if (!showStats && !showShare) return;
    const trigger = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowStats(false);
        setShowShare(false);
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], textarea, input, select, [tabindex="0"]',
        ),
      ];
      const first = items[0],
        last = items[items.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === dialog)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [showStats, showShare]);

  const visibleCharacters = Object.entries(CHARACTER_DATA)
    .filter(([name, data]) => {
      if (filterMode !== "all" && !activeElements[data.element as Element]) return false;
      if (rarityFilter !== "all" && characterRarity(name) !== Number(rarityFilter)) return false;
      if (regionFilter !== "all" && characterClue(name, "region") !== regionFilter) return false;
      if (weaponFilters.length && !weaponFilters.includes(characterClue(name, "weapon")))
        return false;
      const ruledOut = wrongCharacters.has(name) || yellowCharacters.has(name);
      if (statusFilter === "possible") return !ruledOut;
      if (statusFilter === "untried") return !ruledOut && !correctCharacters.has(name);
      if (statusFilter === "correct") return correctCharacters.has(name);
      if (statusFilter === "selected") return preview.includes(name);
      if (statusFilter === "ruled-out") return ruledOut;
      return true;
    })
    .sort(([, a], [, b]) => compareCharacters(a, b, characterOrder));
  const resetRosterFilters = () => {
    setFilterMode("all");
    setRarityFilter("all");
    setRegionFilter("all");
    setWeaponFilters([]);
    setStatusFilter("all");
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopTabs onShowScores={() => setShowStats(true)} />
      {/* ================= STATS MODAL ================= */}
      {showStats && (
        <div
          role="presentation"
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
          className="modal-backdrop"
        >
          <div
            aria-label="Your Daily Results"
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
                aria-label="Close scores"
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
        </div>
      )}

      {/* ================= SHARE MODAL ================= */}

      {showShare && (
        <div
          role="presentation"
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
          className="modal-backdrop"
        >
          <div
            aria-label="Share results"
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
                aria-label="Close share"
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
        </div>
      )}

      <section className="page-intro">
        <div>
          <span className="eyebrow">
            {isEndless ? "Keep the guesses coming" : "Your daily deduction"}
          </span>
          <h1>{isEndless ? "One more mystery." : "Find the hidden team."}</h1>
          <p>Read the damage, choose four characters, and piece it together.</p>
        </div>
        <div className="run-status" role="status">
          {!loadedPuzzleId
            ? isDateLoading
              ? "Loading puzzle..."
              : "No puzzle loaded"
            : state.isWin
              ? "Puzzle solved ✓"
              : state.isOver
                ? "Run complete"
                : state.livesRemaining + " / " + state.maxLives + " guesses left"}
        </div>
      </section>
      <main className="game-shell">
        {/* ================= MAIN LAYOUT ================= */}
        <div className="game-layout">
          {/* ============== LEFT SIDE ============== */}
          <section className="game-panel roster-panel">
            <div className="panel-heading">
              <h2>{isGameOver ? "Revealed team" : "Your team"}</h2>
              <span>{isGameOver ? "Original order" : preview.length + " of 4 selected"}</span>
            </div>
            <p className="panel-note">
              {isGameOver
                ? "The answer in the original puzzle order, numbered 1-4."
                : "Click or drag four characters into the slots. Their order does not matter."}
            </p>
            {/* Preview Row */}
            <div
              className="team-preview"
              aria-label="Drop characters into your team"
              onDragOver={(event) => {
                if (!isInteractionBlocked) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const name = readCharacterDrop(event);
                if (name) dropIntoPreview(name);
              }}
            >
              {[0, 1, 2, 3].map((i) => {
                const char = displaySlots[i];

                return (
                  <button
                    type="button"
                    key={i}
                    disabled={isInteractionBlocked}
                    draggable={!!char && !isInteractionBlocked}
                    onDragStart={(event) => {
                      if (char) startCharacterDrag(event, char);
                    }}
                    onDragOver={(event) => {
                      if (!isInteractionBlocked) event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const name = readCharacterDrop(event);
                      if (name) dropIntoPreview(name, i);
                    }}
                    onClick={() => removePreviewAt(i)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      if (char && !isInteractionBlocked) removePreviewAt(i);
                    }}
                    className="team-slot"
                    aria-label={
                      char
                        ? isGameOver
                          ? "Position " + (i + 1) + ": " + char
                          : "Remove " + char + " from team"
                        : "Empty team slot " + (i + 1)
                    }
                    style={{
                      background: char && correctCharacters.has(char) ? "#2f6f3a" : undefined,
                    }}
                    title={
                      char
                        ? isGameOver
                          ? "Position " + (i + 1) + ": " + char
                          : char + " (click to remove)"
                        : undefined
                    }
                  >
                    {isGameOver && char && (
                      <span className="answer-position" aria-hidden="true">
                        {i + 1}
                      </span>
                    )}
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
                );
              })}
            </div>

            {/* Controls */}
            <div className="guess-actions">
              <button
                className="primary-button"
                onClick={submitGuess}
                disabled={preview.length !== 4 || isInteractionBlocked}
              >
                Submit Guess
              </button>

              <button
                onClick={removeLastPreview}
                disabled={preview.length === 0 || isInteractionBlocked}
              >
                Undo
              </button>

              <button
                type="button"
                onClick={clearPreview}
                disabled={preview.length === 0 || isInteractionBlocked}
              >
                Clear
              </button>
            </div>
            <p className="keyboard-note">Enter to submit · Backspace to undo</p>
            <div className="roster-toolbar">
              <h3>Characters</h3>
              {/* SEARCH */}
              <div className="character-search">
                <input
                  onBlur={() => {
                    setTimeout(() => {
                      setSearchQuery("");
                      setShowSearchResults(false);
                    }, 100);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      setSearchQuery("");
                      setShowSearchResults(false);
                      return;
                    }
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
                  placeholder="Search characters…"
                  aria-label="Search characters"
                  disabled={isInteractionBlocked}
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
                    className="search-results"
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
                          draggable={false}
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

            <div className="roster-controls">
              <RosterSort />

              <label className="roster-control">
                Show
                <select
                  aria-label="Filter by guess status"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All characters</option>
                  <option value="possible">Not ruled out</option>
                  <option value="untried">Not yet guessed</option>
                  <option value="correct">Confirmed correct</option>
                  <option value="selected">Selected team</option>
                  <option value="ruled-out">Ruled out</option>
                </select>
              </label>
            </div>
            <div className="roster-filter-summary">
              <span aria-live="polite">{visibleCharacters.length} characters</span>
              <button
                type="button"
                onClick={resetRosterFilters}
                disabled={
                  filterMode === "all" &&
                  rarityFilter === "all" &&
                  statusFilter === "all" &&
                  regionFilter === "all" &&
                  !weaponFilters.length
                }
              >
                Reset filters
              </button>
            </div>
            {/* Element Filters */}
            <div className="element-filters" role="group" aria-label="Filter by element">
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
              <RarityFilter value={rarityFilter} onChange={setRarityFilter} />
            </div>
            <AdvancedRosterFilters
              weapons={weaponFilters}
              onWeaponsChange={setWeaponFilters}
              region={regionFilter}
              onRegionChange={setRegionFilter}
            />

            {visibleCharacters.length === 0 && (
              <div className="roster-empty">
                No characters match these filters.{" "}
                <button type="button" onClick={resetRosterFilters}>
                  Reset filters
                </button>
              </div>
            )}
            {/* Character Grid */}
            <div className="character-grid">
              {visibleCharacters.map(([name]) => {
                const isFaded = wrongCharacters.has(name) || yellowCharacters.has(name);

                return (
                  <button
                    key={name}
                    className="character-tile"
                    draggable={!isInteractionBlocked}
                    onDragStart={(event) => startCharacterDrag(event, name)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      if (!isInteractionBlocked)
                        setPreview((current) => current.filter((character) => character !== name));
                    }}
                    aria-pressed={preview.includes(name)}
                    onClick={() => addToPreview(name)}
                    disabled={isInteractionBlocked}
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
                      draggable={false}
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
                    <span className="tile-label">{name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ============== RIGHT SIDE ============== */}
          <section className="game-panel puzzle-panel">
            <div className="panel-heading">
              <h2>{isEndless ? "Endless puzzle" : "Daily puzzle"}</h2>
              <span>Inspect the damage</span>
            </div>

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
                Endless mode may show puzzles that have constellations on limited 5 ★ characters,
                underlevelled characters or a variety of other variences.
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
              <div className="puzzle-date">
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

                <input
                  className="puzzle-date-picker"
                  type="date"
                  aria-label="Choose daily puzzle date"
                  value={selectedDate}
                  max={todayUTC()}
                  disabled={isDateLoading}
                  onChange={(event) => {
                    const date = event.target.value;
                    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date <= todayUTC()) goToDate(date);
                  }}
                />

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
              <div className="puzzle-image">
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

            {/* UID + Version */}
            <div
              className="puzzle-metadata"
              style={{
                marginBottom: 12,
                fontSize: 13,
                opacity: 0.85,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                {state.puzzle.genshinUid && (
                  <>
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
                  </>
                )}
              </div>

              {state.puzzle.createdAt && (
                <div>Submitted in Version: {getGenshinVersion(state.puzzle.createdAt)}</div>
              )}
            </div>
          </section>
          {loadedPuzzleId && (
            <section className="game-panel clues-panel">
              <h3>Puzzle information</h3>
              <dl className="puzzle-base-info">
                <div>
                  <dt>Total DPS</dt>
                  <dd>
                    {Number.isFinite(state.puzzle.totalDps)
                      ? state.puzzle.totalDps.toLocaleString()
                      : "Not supplied"}
                  </dd>
                </div>
                <div>
                  <dt>Constellations</dt>
                  <dd>
                    {[0, 1, 2, 3].map((index) => (
                      <span className="info-chip" key={index}>
                        <span
                          className="constellation-rarity"
                          aria-label={
                            characterRarity(state.puzzle.team[index]?.name ?? "") +
                            "-star character"
                          }
                        >
                          {characterRarity(state.puzzle.team[index]?.name ?? "")}
                          {"\u2605"}
                        </span>{" "}
                        {state.puzzle.constellations?.[index] &&
                        state.puzzle.constellations[index] !== "Hidden"
                          ? state.puzzle.constellations[index]
                          : "Not supplied"}
                      </span>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt>Refinements</dt>
                  <dd>
                    {[0, 1, 2, 3].map((index) => (
                      <span className="info-chip" key={index}>
                        {state.puzzle.refinements?.[index] &&
                        state.puzzle.refinements[index] !== "Hidden"
                          ? state.puzzle.refinements[index]
                          : "Not supplied"}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
              {/* Hints */}
              <h3 style={{ marginTop: "1.5rem" }}>Hints</h3>
              <p className="hint-explainer">
                More clues unlock as you use your guesses. Region follows vision casing rather than
                birthplace.
              </p>
              <div className="hint-grid">
                {/* Strongest Hit */}
                <button
                  style={{ width: "100%" }}
                  disabled={
                    !state.clueState.strongestHitUnlocked || state.clueState.strongestHitRevealed
                  }
                  onClick={() => revealHint("strongestHit")}
                >
                  Strongest Hit
                  <small>
                    {state.clueState.strongestHitRevealed
                      ? "Revealed"
                      : state.clueState.strongestHitUnlocked
                        ? "Ready to reveal"
                        : "After 1 guess"}
                  </small>
                </button>

                <div style={{ minHeight: 22, opacity: 0.9 }}>
                  {state.clueState.strongestHitRevealed ? state.puzzle.strongestHit : ""}
                </div>

                {[0, 1].map((slot) => {
                  const chosen = state.clueState.choiceClues[slot];
                  const draft = clueDrafts[slot];
                  const unlocked = state.guessesSoFar.length >= slot + 2;
                  return (
                    <div className="choice-clue-row" key={slot}>
                      <div className="choice-clue-controls">
                        <label>
                          <span className="sr-only">Guess {slot + 2} clue</span>
                          <select
                            aria-label={"Clue for guess " + (slot + 2)}
                            title={
                              chosen
                                ? "Choice locked"
                                : unlocked
                                  ? "Choose a clue, then use the arrow to reveal it. Revealing locks your choice."
                                  : "Available after " + (slot + 2) + " guesses"
                            }
                            value={chosen ?? draft}
                            disabled={!unlocked || !!chosen || isGameOver}
                            onChange={(event) =>
                              setClueDrafts((current) => {
                                const next: [ChoiceClue | "", ChoiceClue | ""] = [...current];
                                next[slot] = event.target.value as ChoiceClue;
                                return next;
                              })
                            }
                          >
                            <option value="">Guess {slot + 2} clue</option>
                            {CHOICE_CLUES.map((option) => (
                              <option
                                value={option.value}
                                key={option.value}
                                disabled={
                                  state.clueState.choiceClues.includes(option.value) ||
                                  clueDrafts[1 - slot] === option.value
                                }
                              >
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          aria-label={"Reveal clue for guess " + (slot + 2)}
                          disabled={
                            !unlocked ||
                            !draft ||
                            !!chosen ||
                            isGameOver ||
                            state.clueState.choiceClues.includes(draft as ChoiceClue)
                          }
                          onClick={() => {
                            if (draft) setState((current) => claimChoiceClue(current, slot, draft));
                          }}
                        >
                          <span aria-hidden="true">{chosen ? "\u2713" : "\u2192"}</span>
                        </button>
                      </div>
                      <div
                        className="clue-chips"
                        aria-label={"Revealed clue for guess " + (slot + 2)}
                      >
                        {chosen && (
                          <CharacterClueValues
                            clue={chosen}
                            names={state.puzzle.team.map((character) => character.name)}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
                {isGameOver &&
                  CHOICE_CLUES.filter(
                    (option) => !state.clueState.choiceClues.includes(option.value),
                  ).map((option) => (
                    <div className="choice-clue-row" key={option.value}>
                      <strong className="choice-clue-note">{option.label}</strong>
                      <div className="clue-chips">
                        <CharacterClueValues
                          clue={option.value}
                          names={state.puzzle.team.map((character) => character.name)}
                        />
                      </div>
                    </div>
                  ))}
                {/* Elements */}
                <button
                  style={{ width: "100%" }}
                  disabled={!state.clueState.elementsUnlocked || state.clueState.elementsRevealed}
                  onClick={() => revealHint("elements")}
                >
                  Elements
                  <small>
                    {state.clueState.elementsRevealed
                      ? "Revealed"
                      : state.clueState.elementsUnlocked
                        ? "Ready to reveal"
                        : "After 4 guesses"}
                  </small>
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
              <h3 style={{ marginTop: 24 }}>
                Your guesses{" "}
                <span className="panel-note">
                  ({state.guessesSoFar.length}/{state.maxLives})
                </span>
              </h3>
              {state.guessesSoFar.length === 0 && (
                <p className="empty-history">
                  Your guesses will appear here. Pick your first team to begin.
                </p>
              )}
              <div
                className="guess-legend"
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
                  className="guess-row"
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
                          draggable={false}
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
                  <div className="answer-order">
                    <h4>Original team order</h4>
                    <ol aria-label="Original team order">
                      {state.puzzle.team.map((character, index) => (
                        <li key={index} title={"Position " + (index + 1) + ": " + character.name}>
                          <span className="answer-position" aria-hidden="true">
                            {index + 1}
                          </span>
                          <img
                            src={CHARACTER_DATA[character.name]?.iconUrl}
                            alt={"Position " + (index + 1) + ": " + character.name}
                            width="48"
                            height="48"
                          />
                        </li>
                      ))}
                    </ol>
                  </div>
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
            </section>
          )}

          {!hideKofi && (
            <details className="support-panel">
              <summary>
                <span>Enjoying the puzzle? Help keep it running.</span>
              </summary>
              <div className="support-content">
                <div className="support-copy">
                  <h3>Support the project</h3>
                  <p>
                    It costs me $25 a month to host the server. Any help towards that is
                    appreciated!
                  </p>
                  <p>
                    <a href="https://ko-fi.com/watchful" target="_blank" rel="noopener noreferrer">
                      Visit Watchful on Ko-fi ↗
                    </a>
                  </p>
                  <button type="button" onClick={() => setHideKofi(true)}>
                    Hide support options
                  </button>
                </div>
                <iframe
                  title="Ko-fi"
                  loading="lazy"
                  src="https://ko-fi.com/watchful/?hidefeed=true&widget=true&embed=true"
                />
              </div>
            </details>
          )}
        </div>
      </main>
    </div>
  );
}
