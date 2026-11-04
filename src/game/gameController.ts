// src/game/gameController.ts
import type { GameState, Guess } from "./types";
import { evaluateGuess } from "./evaluateGuess";

export function makeGuess(state: GameState, guess: Guess): GameState {
  const tiles = evaluateGuess(guess, state.puzzle.team);
  const nextGrid = [...state.gridTiles];
  nextGrid[state.guessesSoFar.length] = tiles;

  // gameController.ts
  const newLives = state.livesRemaining - 1;
  const livesLost = state.maxLives - newLives;

  // Update clue unlocks based on lives lost
  const newClueState = { ...state.clueState };
  if (livesLost >= 1) newClueState.strongestHitUnlocked = true;
  if (livesLost >= 4) newClueState.elementsUnlocked = true;

  return {
    ...state,
    guessesSoFar: [...state.guessesSoFar, guess],
    gridTiles: nextGrid,
    livesRemaining: newLives,
    clueState: newClueState,
    isWin: tiles.every((t) => t === "GREEN"),
    isOver: tiles.every((t) => t === "GREEN") || newLives <= 0,
  };
}
