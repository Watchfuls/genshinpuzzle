import { CHARACTER_DATA as metadata } from "../../supabase/functions/_shared/character_elements";
import type { CharacterOrder } from "../context/SettingsContext";

type RosterCharacter = { name: string; element: string; releaseDate: string };
const elementOrder = ["Geo", "Electro", "Hydro", "Cryo", "Anemo", "Dendro", "Pyro", "None"];
export function characterRarity(name: string): number {
  return metadata[name]?.rarity ?? 5;
}
export function compareCharacters(
  a: RosterCharacter,
  b: RosterCharacter,
  order: CharacterOrder,
): number {
  if (order === "name-desc") return b.name.localeCompare(a.name);
  if (order === "game")
    return (
      characterRarity(b.name) - characterRarity(a.name) ||
      elementOrder.indexOf(a.element) - elementOrder.indexOf(b.element) ||
      b.releaseDate.localeCompare(a.releaseDate) ||
      a.name.localeCompare(b.name)
    );
  if (order === "release-newest")
    return b.releaseDate.localeCompare(a.releaseDate) || a.name.localeCompare(b.name);
  if (order === "release")
    return a.releaseDate.localeCompare(b.releaseDate) || a.name.localeCompare(b.name);
  return a.name.localeCompare(b.name);
}
