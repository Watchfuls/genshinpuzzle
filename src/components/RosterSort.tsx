import { useSettings, type CharacterOrder } from "../context/SettingsContext";
export default function RosterSort() {
  const { characterOrder, setCharacterOrder } = useSettings();
  return (
    <label className="roster-control">
      Sort
      <select
        aria-label="Sort characters"
        value={characterOrder}
        onChange={(event) => setCharacterOrder(event.target.value as CharacterOrder)}
      >
        <option value="name">Name · A–Z</option>
        <option value="name-desc">Name · Z–A</option>
        <option value="release-newest">Release · newest first</option>
        <option value="release">Release · oldest first</option>
        <option value="game">In-game order</option>
      </select>
    </label>
  );
}
