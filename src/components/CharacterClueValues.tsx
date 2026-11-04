import type { ChoiceClue } from "../game/types";
import { characterClue } from "../game/characterClues";
import { weaponIcons, regionIcons } from "../game/clueIcons";
import { CHARACTER_DATA } from "../game/characters";
import { getGenshinVersion } from "../game/genshinVersions";
export default function CharacterClueValues({
  clue,
  names,
}: {
  clue: ChoiceClue;
  names: string[];
}) {
  return (
    <>
      {names.map((name, index) => {
        if (clue === "releasePatch") {
          const date = CHARACTER_DATA[name]?.releaseDate;
          return (
            <span className="info-chip" key={index}>
              {date ? (getGenshinVersion(date) ?? "Unknown") : "Unknown"}
            </span>
          );
        }
        const label = characterClue(name, clue === "weapons" ? "weapon" : "region");
        const src = (clue === "weapons" ? weaponIcons : regionIcons)[label];
        return (
          <span
            className="clue-icon"
            key={index}
            role="img"
            aria-label={label}
            title={label}
            tabIndex={0}
          >
            {src ? (
              <img src={src} alt="" width="22" height="22" draggable={false} />
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M7 12h10" />
              </svg>
            )}
            <span className="clue-icon-name" aria-hidden="true">
              {label}
            </span>
          </span>
        );
      })}
    </>
  );
}
