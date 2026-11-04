import { useRef, useState } from "react";

export default function FeedbackDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <button
        className="feedback-trigger"
        type="button"
        onClick={() => {
          setLoaded(true);
          dialog.current?.showModal();
        }}
      >
        Send feedback
      </button>
      <dialog ref={dialog} className="feedback-dialog" aria-labelledby="feedback-title">
        <div className="feedback-dialog-content">
          <div className="feedback-dialog-heading">
            <h2 id="feedback-title">Send Dummy Guesser feedback</h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close feedback"
            >
              Close
            </button>
          </div>
          <p className="feedback-form-fallback">
            Form not loading?{" "}
            <a href="https://tally.so/r/7Xq75a" target="_blank" rel="noopener noreferrer">
              Open it in a new tab
            </a>
          </p>
          <div className="feedback-form-body">
            {loaded && (
              <iframe
                title="Dummy Guesser feedback form"
                src="https://tally.so/embed/7Xq75a?hideTitle=1&alignLeft=1"
              />
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
