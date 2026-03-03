import TopTabs from "./TopTabs";
import { useSettings } from "../context/SettingsContext";

export default function OptionsPage() {
  const {
    autoRevealHints,
    characterOrder,
    hideKofi,          // NEW
    setAutoRevealHints,
    setCharacterOrder,
    setHideKofi,       // NEW
  } = useSettings();

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopTabs />
      <div style={{ paddingLeft: 32 }}>
        <h2>Options</h2>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={autoRevealHints}
              onChange={(e) => setAutoRevealHints(e.target.checked)}
            />
            Auto-Reveal Hints
          </label>
        </div>

        {/* NEW: Hide Ko-fi */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={hideKofi}
              onChange={(e) => setHideKofi(e.target.checked)}
            />
            Hide Ko-fi
          </label>
        </div>

        <div>
          <label>
            Character Layout Order
            <br />
            <select
              value={characterOrder}
              onChange={(e) => setCharacterOrder(e.target.value as "name" | "release")}
              style={{ marginTop: 8, height: 32 }}
            >
              <option value="name">By Name</option>
              <option value="release">By Release Date</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}