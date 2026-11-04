import { weaponIcons as icons } from "../game/clueIcons";
export default function WeaponFilters({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div className="weapon-filters" role="group" aria-label="Filter by weapon type">
      <span className="weapon-filter-label">Weapon</span>
      {Object.entries(icons).map(([name, src]) => (
        <button
          type="button"
          key={name}
          title={name}
          aria-label={"Filter by " + name}
          aria-pressed={value.includes(name)}
          onClick={() =>
            onChange(
              value.includes(name) ? value.filter((weapon) => weapon !== name) : [...value, name],
            )
          }
        >
          <img src={src} alt="" draggable={false} width="25" height="25" />
        </button>
      ))}
    </div>
  );
}
