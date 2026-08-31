import { Link, useLocation } from "react-router-dom";

type Props = {
  title?: string;
  statusText?: string;
  statusColor?: string;
  onShowScores?: () => void;
};

export default function TopTabs({
  title = "Genshin Dummy Guesser",
  statusText,
  statusColor,
  onShowScores,
}: Props) {
  const { pathname } = useLocation();

  const isGame = pathname === "/";
  const isEndless = pathname === "/endless";
  const isOptions = pathname === "/options";
  const isSubmit = pathname === "/submit";
  const isRoadmap = pathname === "/roadmap";

  const tabStyle = (active: boolean): React.CSSProperties => ({
    width: 110,
    height: active ? 40 : 35, // active looks lower while still touching top
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: "0.95rem",
    textDecoration: "none",
    color: active ? "#fff" : "#cfcfcf",
    background: active ? "#2a2a2a" : "#1f1f1f",
    borderBottom: "1px solid #444",
    borderLeft: "1px solid #444",
    borderRight: "1px solid #444",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  });

  return (
    <div style={{ marginBottom: 32, marginLeft: 32 }}>
      <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
        <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
        </Link>
        <div style={{ display: "flex", gap: 12 }}>
          <Link to="/" style={tabStyle(isGame)}>
            Daily
          </Link>
          <Link to="/endless" style={tabStyle(isEndless)}>
            Endless
          </Link>
          <Link to="/options" style={tabStyle(isOptions)}>
            Options
          </Link>
          <Link to="/submit" style={tabStyle(isSubmit)}>
            Submit
          </Link>
          <Link to="/roadmap" style={tabStyle(isRoadmap)}>
            Roadmap
          </Link>
          {onShowScores ? (
            <button type="button" onClick={onShowScores} style={tabStyle(false)}>
              Scores
            </button>
          ) : null}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.65 }}>
          Made by{" "}
          <a
            href="https://www.youtube.com/c/Watchful"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "inherit", textDecoration: "underline" }}
          >
            Watchful
          </a>
          <text> | Version 1.0</text>
          <br></br>
          <text>Conceptualised by </text>
          <a
            href="https://www.twitch.tv/zajef77"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "inherit", textDecoration: "underline" }}
          >
            Zajef77
          </a>
          <text> and Virus34</text>
        </div>

        {statusText && (
          <div
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: "1.4rem",
              fontWeight: 700,
              color: statusColor,
            }}
          >
            {statusText}
          </div>
        )}
      </div>
    </div>
  );
}
