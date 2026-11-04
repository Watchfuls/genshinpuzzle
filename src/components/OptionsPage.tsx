import TopTabs from "./TopTabs";
import { useSettings } from "../context/SettingsContext";

export default function OptionsPage() {
  const { autoRevealHints, hideKofi, setAutoRevealHints, setHideKofi } = useSettings();
  return (
    <>
      <TopTabs />
      <main className="simple-page">
        <span className="eyebrow">Make it yours</span>
        <h1>Options</h1>
        <p className="panel-note">Your preferences are saved in this browser.</p>
        <div className="setting-row">
          <label>
            <span>
              <strong>Automatically reveal hints</strong>
              <p>Show each clue as soon as it becomes available.</p>
            </span>
            <input
              type="checkbox"
              checked={autoRevealHints}
              onChange={(e) => setAutoRevealHints(e.target.checked)}
            />
          </label>
        </div>
        <div className="setting-row">
          <label>
            <span>
              <strong>Hide support options</strong>
              <p>Keep the Ko-fi panel out of your game.</p>
            </span>
            <input
              type="checkbox"
              checked={hideKofi}
              onChange={(e) => setHideKofi(e.target.checked)}
            />
          </label>
        </div>
      </main>
    </>
  );
}
