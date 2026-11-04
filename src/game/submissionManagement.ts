export type ManagedSubmission = {
  id: string;
  team: string[];
  constellations: string[];
  refinements: string[];
  weapons: (string | null)[];
  strongest_hit: number;
  total_dps: number;
  genshin_uid: string | null;
  image_url: string | null;
  revision: number;
  readOnly: boolean;
  puzzle_pool: string;
};
export type SavedSubmission = {
  id: string;
  managementCode: string;
  team: string[];
  savedAt: string;
};
const storageKey = "gdg_managed_submissions_v1";
export function savedSubmissions(): SavedSubmission[] {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(data)
      ? data.filter(
          (row) =>
            typeof row?.id === "string" &&
            typeof row?.managementCode === "string" &&
            Array.isArray(row?.team),
        )
      : [];
  } catch {
    return [];
  }
}
export function rememberSubmission(row: SavedSubmission): boolean {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify([row, ...savedSubmissions().filter((old) => old.id !== row.id)]),
    );
    return true;
  } catch {
    return false;
  }
}
export function forgetSubmission(id: string) {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify(savedSubmissions().filter((row) => row.id !== id)),
    );
  } catch {
    /* Storage may be disabled. */
  }
}
export async function submissionRequest(body: FormData | Record<string, unknown>) {
  const multipart = body instanceof FormData;
  const response = await fetch(
    import.meta.env.VITE_SUPABASE_URL + "/functions/v1/manage_dummy_submission",
    {
      method: "POST",
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        ...(multipart ? {} : { "content-type": "application/json" }),
      },
      body: multipart ? body : JSON.stringify(body),
    },
  );
  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { message: raw };
  }
  if (response.status === 404 && data.code === "NOT_FOUND")
    throw new Error(
      "Submission management is ready in the local preview, but the backend has not been deployed yet.",
    );
  if (!response.ok) throw new Error(data.message || "Could not manage the submission.");
  return data;
}
