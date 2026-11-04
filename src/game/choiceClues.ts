import type { ChoiceClue, GameState } from "./types";
export const CHOICE_CLUES: { value: ChoiceClue; label: string }[] = [
  { value: "weapons", label: "Weapon types" },
  { value: "regions", label: "Regions" },
  { value: "releasePatch", label: "Release patch" },
];
export function claimChoiceClue(state: GameState, slot: number, clue: ChoiceClue): GameState {
  if (
    (slot !== 0 && slot !== 1) ||
    !CHOICE_CLUES.some((option) => option.value === clue) ||
    state.isOver ||
    state.isWin ||
    state.guessesSoFar.length < slot + 2
  )
    return state;
  const current = state.clueState.choiceClues;
  if (current[slot] || current.includes(clue)) return state;
  const choices: [ChoiceClue | null, ChoiceClue | null] = [...current];
  choices[slot] = clue;
  return {
    ...state,
    clueState: {
      ...state.clueState,
      choiceClues: choices,
      ...(clue === "weapons"
        ? { weaponsUnlocked: true, weaponsRevealed: true }
        : clue === "regions"
          ? { regionsUnlocked: true, regionsRevealed: true }
          : {}),
    },
  };
}
