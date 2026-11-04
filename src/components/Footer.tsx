import FeedbackDialog from "./FeedbackDialog";

export default function Footer() {
  return (
    <footer className="site-footer">
      <p>
        Made by{" "}
        <a href="https://www.youtube.com/c/Watchful" target="_blank" rel="noopener noreferrer">
          Watchful
        </a>{" "}
        · Concept by{" "}
        <a href="https://www.twitch.tv/zajef77" target="_blank" rel="noopener noreferrer">
          Zajef77
        </a>{" "}
        and Virus34 · Version 1.0
      </p>
      <p>
        Genshin Impact and all related assets are © HoYoverse. An unofficial fan project, not
        affiliated with or endorsed by HoYoverse.
      </p>
      <FeedbackDialog />
    </footer>
  );
}
