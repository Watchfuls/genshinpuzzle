type Props = { value: string; onChange: (value: string) => void };
export default function RarityFilter({ value, onChange }: Props) {
  return (
    <div className="rarity-filters" role="group" aria-label="Filter by rarity">
      {["4", "5"].map((rarity) => (
        <button
          key={rarity}
          type="button"
          aria-label={rarity + "-star characters"}
          title={rarity + "-star characters - click again to show all rarities"}
          aria-pressed={value === rarity}
          onClick={() => onChange(value === rarity ? "all" : rarity)}
        >
          <span aria-hidden="true">
            {rarity}
            {"\u2605"}
          </span>
        </button>
      ))}
    </div>
  );
}
