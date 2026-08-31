// src/game/types.ts
export type Element = "Pyro" | "Hydro" | "Electro" | "Cryo" | "Anemo" | "Geo" | "Dendro" | "None";

export interface TeamCharacter {
  name: string;
  element: Element;
  individualDps: number;
  damagePercentage: number;
}

export interface Puzzle {
  id: string;
  version: number;
  damageTime: number;
  strongestHit: number;
  totalDps: number;
  team: TeamCharacter[];
  constellations: ("Hidden" | "C0" | "C1" | "C2" | "C3" | "C4" | "C5" | "C6")[];
  refinements: ("Hidden" | "R0" | "R1" | "R2" | "R3" | "R4" | "R5")[];
  genshinUid?: string | null;
  createdAt: string | null;
}

export interface Guess {
  characters: string[];
}

export type TileState = "GREEN" | "YELLOW" | "GRAY";

export interface ClueState {
  strongestHitUnlocked: boolean;
  totalDpsUnlocked: boolean;
  elementsUnlocked: boolean;
  constellationsRefinementsUnlocked: boolean;

  strongestHitRevealed: boolean;
  totalDpsRevealed: boolean;
  elementsRevealed: boolean;
  constellationsRefinementsRevealed: boolean;
}

export interface GameState {
  puzzle: Puzzle;
  guessesSoFar: Guess[];
  gridTiles: TileState[][];
  livesRemaining: number;
  maxLives: number; // ✅ add this
  clueState: ClueState;
  isWin: boolean;
  isOver: boolean;
}
