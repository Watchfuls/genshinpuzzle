import { NavLink, Link } from "react-router-dom";

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
  return (
    <header className="site-header">
      <div className="header-top">
        <Link to="/" className="site-brand">
          <span className="brand-mark" aria-hidden="true">
            ✦
          </span>
          <span>
            {title}
            <small>A little damage. A little deduction.</small>
          </span>
        </Link>
        <div className="related-sites" aria-label="More Genshin tools">
          <a href="https://watchfuls.github.io/imaginarium-theater-planner/">Theater Planner ↗</a>
          <a href="https://watchfuls.github.io/GenshinGraph/">Character Graph ↗</a>
        </div>
      </div>
      <div className="header-bottom">
        <nav className="main-nav" aria-label="Main navigation">
          <NavLink to="/" end>
            Daily
          </NavLink>
          <NavLink to="/endless">Endless</NavLink>
          <NavLink to="/submit">Submit a puzzle</NavLink>
          <NavLink to="/submissions">My submissions</NavLink>
          <NavLink to="/options">Options</NavLink>
          <NavLink to="/roadmap">Roadmap</NavLink>
        </nav>
        {onShowScores && (
          <button className="scores-button" type="button" onClick={onShowScores}>
            Your scores ↗
          </button>
        )}
      </div>
      {statusText && (
        <p className="header-status" style={{ color: statusColor }} role="status">
          {statusText}
        </p>
      )}
    </header>
  );
}
