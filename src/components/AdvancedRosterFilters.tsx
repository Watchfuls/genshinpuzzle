import WeaponFilters from "./WeaponFilters";
import RegionFilter from "./RegionFilter";
type Props = {
  weapons: string[];
  onWeaponsChange: (value: string[]) => void;
  region: string;
  onRegionChange: (value: string) => void;
};
export default function AdvancedRosterFilters({
  weapons,
  onWeaponsChange,
  region,
  onRegionChange,
}: Props) {
  const active = [...weapons, ...(region === "all" ? [] : [region])];
  return (
    <details className="advanced-roster-filters">
      <summary>
        <span className="advanced-filter-heading">
          More filters{" "}
          <span aria-hidden="true" className="advanced-filter-chevron">
            +
          </span>
        </span>
        <span className="advanced-filter-status" title={active.join(", ")}>
          {active.length ? active.join(" / ") : "Weapon and region"}
        </span>
        {active.length > 0 && (
          <span className="advanced-filter-count" aria-label={active.length + " active selections"}>
            {active.length}
          </span>
        )}
      </summary>
      <div className="advanced-filter-content">
        <WeaponFilters value={weapons} onChange={onWeaponsChange} />
        <RegionFilter value={region} onChange={onRegionChange} />
      </div>
    </details>
  );
}
