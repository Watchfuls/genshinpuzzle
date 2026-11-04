import { regionIcons } from "../game/clueIcons";
export default function RegionFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="region-filters" role="group" aria-label="Filter by region">
      <span className="weapon-filter-label">Region</span>
      {[...Object.keys(regionIcons), "No region"].map((region) => (
        <button
          type="button"
          key={region}
          title={region}
          aria-label={"Filter by region " + region}
          aria-pressed={value === region}
          onClick={() => onChange(value === region ? "all" : region)}
        >
          {regionIcons[region] ? (
            <img src={regionIcons[region]} alt="" width="25" height="25" draggable={false} />
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="23"
              height="23"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M7 12h10" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}
