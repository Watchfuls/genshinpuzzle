import { useState, useRef, useEffect } from "react";
import TopTabs from "./TopTabs";
import SubmitDummy from "./SubmitDummy";
import {
  savedSubmissions,
  submissionRequest,
  forgetSubmission,
  rememberSubmission,
  type ManagedSubmission,
} from "../game/submissionManagement";
export default function ManageSubmissions() {
  const [code, setCode] = useState("");
  const [row, setRow] = useState<ManagedSubmission | null>(null);
  const [saved, setSaved] = useState(savedSubmissions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (confirmDelete) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [confirmDelete]);
  const load = async (value = code) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await submissionRequest({ action: "load", managementCode: value.trim() });
      setCode(value.trim());
      setRow(result.submission);
      rememberSubmission({
        id: result.submission.id,
        managementCode: value.trim(),
        team: result.submission.team,
        savedAt: new Date().toISOString(),
      });
      setSaved(savedSubmissions());
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load submission.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!row || row.readOnly) return;
    setBusy(true);
    setError("");
    try {
      await submissionRequest({ action: "delete", managementCode: code, revision: row.revision });
      forgetSubmission(row.id);
      setSaved(savedSubmissions());
      setRow(null);
      setCode("");
      setConfirmDelete(false);
      setMessage("Submission deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete submission.");
    } finally {
      setBusy(false);
    }
  };
  if (row && !row.readOnly)
    return (
      <>
        <SubmitDummy
          key={row.id + ":" + row.revision}
          editing={{ ...row, managementCode: code }}
          onCancel={() => {
            setRow(null);
            setMessage("");
          }}
          onDelete={() => setConfirmDelete(true)}
          onSaved={async () => {
            if (await load(code)) setMessage("Changes saved.");
          }}
        />
        <dialog
          ref={dialogRef}
          className="delete-submission-dialog"
          aria-labelledby="delete-submission-title"
          onCancel={(event) => {
            event.preventDefault();
            if (!busy) {
              setConfirmDelete(false);
              setError("");
            }
          }}
        >
          <h2 id="delete-submission-title">Delete this submission?</h2>
          <p>{row.team.join(" / ")}</p>
          <p>This removes your submission and screenshot. It cannot be undone.</p>
          <div className="manage-actions">
            <button
              autoFocus
              disabled={busy}
              onClick={() => {
                setConfirmDelete(false);
                setError("");
              }}
            >
              Keep submission
            </button>
            <button className="danger-button" disabled={busy} onClick={remove}>
              {busy ? "Deleting..." : "Delete permanently"}
            </button>
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </dialog>
        {message && (
          <p className="manage-notice" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="manage-notice form-error" role="alert">
            {error}
          </p>
        )}
      </>
    );
  return (
    <>
      <TopTabs />
      <main className="simple-page manage-page">
        <span className="eyebrow">Your contributions</span>
        <h1>Manage submissions</h1>
        <p className="panel-note">
          Open a submission with its private management code. Your public submission ID alone does
          not grant access.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            load();
          }}
        >
          <label className="management-code-label">
            Management code
            <input
              type="password"
              autoComplete="off"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
              disabled={busy}
              spellCheck={false}
            />
          </label>
          <button className="primary-button" disabled={busy || !code.trim()}>
            {busy ? "Opening..." : "Open submission"}
          </button>
        </form>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {row?.readOnly && (
          <section className="readonly-submission">
            <h2>Already featured</h2>
            <p>
              This submission has appeared as a Daily puzzle. It is read-only so existing puzzles
              and saved games remain intact.
            </p>
            <p>{row.team.join(" / ")}</p>
            {row.image_url && <img src={row.image_url} alt="Your submitted screenshot" />}
            <button onClick={() => setRow(null)}>Close submission</button>
          </section>
        )}
        {!!saved.length && (
          <section className="saved-submissions">
            <h2>Saved in this browser</h2>
            {saved.map((entry) => (
              <button key={entry.id} disabled={busy} onClick={() => load(entry.managementCode)}>
                <span>{entry.team.join(" / ")}</span>
                <small>Open submission</small>
              </button>
            ))}
          </section>
        )}
        <p className="panel-note legacy-management-note">
          For submissions made before management codes were introduced, contact the site owner to
          verify ownership and receive a code. There is no automatic claim by submission ID.
        </p>
      </main>
    </>
  );
}
