// src/game/initialState.ts
import type { GameState, TileState } from "./types";

export const initialState: GameState = {
  livesRemaining: 5,
  maxLives: 5,
  puzzle: {
    id: "puzzle1",
    version: 1,
    createdAt: null,
    damageTime: 120,
    strongestHit: 5000,
    totalDps: 20000,
    constellations: ["Hidden", "Hidden", "Hidden", "Hidden"],
    refinements: ["Hidden", "Hidden", "Hidden", "Hidden"],
    team: [
      {
        name: "Aino",
        element: "Hydro",
        individualDps: 5000,
        damagePercentage: 25,
      },
      {
        name: "Amber",
        element: "Pyro",
        individualDps: 4000,
        damagePercentage: 20,
      },
      {
        name: "Barbara",
        element: "Hydro",
        individualDps: 3000,
        damagePercentage: 15,
      },
      {
        name: "Chasca",
        element: "Anemo",
        individualDps: 3000,
        damagePercentage: 15,
      },
    ],
  },
  guessesSoFar: [],
  gridTiles: Array.from({ length: 6 }, () => Array<TileState>(4).fill("GRAY")),
  clueState: {
    strongestHitUnlocked: false,
    totalDpsUnlocked: true,
    elementsUnlocked: false,
    constellationsRefinementsUnlocked: true,

    strongestHitRevealed: false,
    totalDpsRevealed: false,
    elementsRevealed: false,
    constellationsRefinementsRevealed: false,
  },
  isWin: false,
  isOver: false,
};
