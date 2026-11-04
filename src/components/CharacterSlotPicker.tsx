import { useState, useRef, useEffect, useId } from "react";
import { CHARACTER_DATA } from "../game/characters";
type Props = {
  slot: number;
  selected: (string | null)[];
  onSelect: (name: string) => void;
  onClose: (restoreFocus?: boolean) => void;
  onRemove: () => void;
};
export default function CharacterSlotPicker({
  slot,
  selected,
  onSelect,
  onClose,
  onRemove,
}: Props) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const results = Object.keys(CHARACTER_DATA)
    .filter((name) => name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!root.current?.contains(target) && !target.closest(".submission-team-slots"))
        onClose(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [onClose]);
  useEffect(() => {
    document.getElementById(id + "-" + highlight)?.scrollIntoView({ block: "nearest" });
  }, [highlight, id]);
  return (
    <div
      className="character-slot-picker"
      ref={root}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node))
          onClose(false);
      }}
    >
      <label htmlFor={id + "-input"}>Choose character for slot {slot + 1}</label>
      <input
        ref={input}
        id={id + "-input"}
        role="combobox"
        aria-label={"Search character for slot " + (slot + 1)}
        aria-controls={id}
        aria-expanded="true"
        aria-autocomplete="list"
        aria-activedescendant={results.length ? id + "-" + highlight : undefined}
        placeholder="Search character name..."
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlight(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlight((current) => Math.min(current + 1, results.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlight((current) => Math.max(0, current - 1));
          } else if (event.key === "Enter") {
            event.preventDefault();
            if (results[highlight]) onSelect(results[highlight]);
          }
        }}
      />
      <div id={id} role="listbox" aria-label="Characters" className="slot-picker-results">
        {results.map((name, index) => (
          <button
            id={id + "-" + index}
            type="button"
            role="option"
            aria-label={name}
            aria-selected={index === highlight}
            tabIndex={-1}
            key={name}
            onMouseEnter={() => setHighlight(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(name)}
          >
            <img src={CHARACTER_DATA[name].iconUrl} alt="" width="28" height="28" />
            <span>{name}</span>
            {selected.includes(name) && <small>Slot {selected.indexOf(name) + 1}</small>}
          </button>
        ))}
        {!results.length && <p className="panel-note">No matching characters.</p>}
      </div>
      <div className="slot-picker-actions">
        {selected[slot] && (
          <button type="button" onClick={onRemove}>
            Remove character
          </button>
        )}
        <button type="button" onClick={() => onClose()}>
          Close
        </button>
      </div>
    </div>
  );
}
