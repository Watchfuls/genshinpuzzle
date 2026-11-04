import metadata from "./character-clues.json";
export function characterClue(name: string, kind: "weapon" | "region"): string {
  const value = metadata[name as keyof typeof metadata]?.[kind];
  return value === "None" ? "No region" : value || "Unknown";
}
