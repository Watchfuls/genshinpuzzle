import {
  getCharacterData,
  getElementForCharacter,
} from "./character_elements.ts";
import { CHARACTER_WEAPONS } from "./character_weapons.ts";
import { WEAPONS } from "./weapon_catalog.ts";

export class SubmissionError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
export const MAX_BYTES = 1_048_576;
export const BUCKET = "submission-images";
const weaponsByName = new Map(WEAPONS.map((weapon) => [weapon.name, weapon]));

export function parseSubmission(form: FormData) {
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const team = [0, 1, 2, 3].map((index) => text("team" + index));
  if (
    team.some((name) =>
      !getCharacterData(name) || getElementForCharacter(name) === "None"
    )
  ) {
    throw new SubmissionError("Select four known characters.");
  }
  if (new Set(team).size !== 4) {
    throw new SubmissionError("Select four different characters.");
  }
  const constellations = team.map((_, i) => text("c" + i) || "C0");
  const refinements = team.map((_, i) => text("r" + i) || "R0");
  if (constellations.some((value) => !/^(Hidden|C[0-6])$/.test(value))) {
    throw new SubmissionError("Invalid constellation.");
  }
  if (refinements.some((value) => !/^(Hidden|R[0-5])$/.test(value))) {
    throw new SubmissionError("Invalid refinement.");
  }
  const weapons = team.map((name, index) => {
    const value = text("weapon" + index);
    if (!value) {
      throw new SubmissionError("Choose a weapon for each character.");
    }
    const weapon = weaponsByName.get(value);
    if (!weapon || weapon.type !== CHARACTER_WEAPONS[name]) {
      throw new SubmissionError("The weapon does not match " + name + ".");
    }
    if (refinements[index] === "R0" || refinements[index] === "Hidden") {
      throw new SubmissionError("Choose R1-R5 for a named weapon.");
    }
    return value;
  });
  const strongest_hit = Number(text("strongestHit"));
  const total_dps = Number(text("totalDps"));
  if (
    ![strongest_hit, total_dps].every((value) =>
      Number.isSafeInteger(value) && value >= 1 && value <= 999_999_999
    )
  ) {
    throw new SubmissionError(
      "Damage values must be whole numbers from 1 to 999,999,999.",
    );
  }
  const uid = text("genshinUid");
  if (uid && !/^\d{6,12}$/.test(uid)) {
    throw new SubmissionError("Invalid Genshin UID.");
  }
  const puzzle_pool = determinePool(team, constellations, refinements, weapons);
  return {
    team,
    elements: team.map(getElementForCharacter),
    constellations,
    refinements,
    weapons,
    strongest_hit,
    total_dps,
    genshin_uid: uid || null,
    puzzle_pool,
  };
}

export function determinePool(
  team: string[],
  constellations: string[],
  refinements: string[],
  weapons: (string | null)[] = [],
): "Daily" | "Endless" {
  return team.some((name, index) => {
      const character = getCharacterData(name);
      if (!character) return true;
      const constellation =
        Number((constellations[index] ?? "Hidden").replace("C", "")) || 0;
      const refinement =
        Number((refinements[index] ?? "Hidden").replace("R", "")) || 0;
      const weapon = weapons[index] ? weaponsByName.get(weapons[index]!) : null;
      if (weapons[index] && !weapon) return true;
      if (weapon ? weapon.rarity === 5 : refinement > 0) return true;
      return character.rarity === 5 && !character.standard &&
        constellation > (character.temper ? 1 : 0);
    })
    ? "Endless"
    : "Daily";
}

export async function readImage(
  value: FormDataEntryValue | null,
  required: boolean,
) {
  if (!(value instanceof File) || value.size === 0) {
    if (required) throw new SubmissionError("Choose a PNG or JPEG image.");
    return null;
  }
  if (value.size > MAX_BYTES) {
    throw new SubmissionError("Image must be 1MB or smaller.");
  }
  const bytes = new Uint8Array(await value.arrayBuffer());
  const png = bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte);
  const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 &&
    bytes[2] === 255;
  if (!png && !jpeg) {
    throw new SubmissionError("Only PNG and JPEG images are supported.");
  }
  return {
    bytes,
    ext: png ? "png" : "jpg",
    contentType: png ? "image/png" : "image/jpeg",
  };
}

export function createSecret() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
}
export async function hashSecret(secret: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)),
    ),
  ].map((value) => value.toString(16).padStart(2, "0")).join("");
}
export async function parseManagementCode(code: unknown) {
  if (
    typeof code !== "string" ||
    !/^[a-f0-9-]{36}\.[a-f0-9]{64}$/i.test(code.trim())
  ) throw new SubmissionError("Invalid management code.", 403);
  const [id, secret] = code.trim().split(".");
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
  ) throw new SubmissionError("Invalid management code.", 403);
  return { id, tokenHash: await hashSecret(secret.toLowerCase()) };
}
