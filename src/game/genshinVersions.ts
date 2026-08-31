// AUTO-GENERATED. DO NOT EDIT.
// Generated from the Genshin Impact Wiki Version page.

export const GENSHIN_VERSIONS = [
  { version: "7.0", startDate: "2026-08-12" },
  { version: "6.7", startDate: "2026-07-01" },
  { version: "6.6", startDate: "2026-05-20" },
  { version: "6.5", startDate: "2026-04-08" },
  { version: "6.4", startDate: "2026-02-25" },
  { version: "6.3", startDate: "2026-01-14" },
  { version: "6.2", startDate: "2025-12-03" },
  { version: "6.1", startDate: "2025-10-22" },
  { version: "6.0", startDate: "2025-09-10" },
  { version: "5.8", startDate: "2025-07-30" },
  { version: "5.7", startDate: "2025-06-18" },
  { version: "5.6", startDate: "2025-05-07" },
  { version: "5.5", startDate: "2025-03-26" },
  { version: "5.4", startDate: "2025-02-12" },
  { version: "5.3", startDate: "2025-01-01" },
  { version: "5.2", startDate: "2024-11-20" },
  { version: "5.1", startDate: "2024-10-09" },
  { version: "5.0", startDate: "2024-08-28" },
  { version: "4.8", startDate: "2024-07-17" },
  { version: "4.7", startDate: "2024-06-05" },
  { version: "4.6", startDate: "2024-04-24" },
  { version: "4.5", startDate: "2024-03-13" },
  { version: "4.4", startDate: "2024-01-31" },
  { version: "4.3", startDate: "2023-12-20" },
  { version: "4.2", startDate: "2023-11-08" },
  { version: "4.1", startDate: "2023-09-27" },
  { version: "4.0", startDate: "2023-08-16" },
  { version: "3.8", startDate: "2023-07-05" },
  { version: "3.7", startDate: "2023-05-24" },
  { version: "3.6", startDate: "2023-04-12" },
  { version: "3.5", startDate: "2023-03-01" },
  { version: "3.4", startDate: "2023-01-18" },
  { version: "3.3", startDate: "2022-12-07" },
  { version: "3.2", startDate: "2022-11-02" },
  { version: "3.1", startDate: "2022-09-28" },
  { version: "3.0", startDate: "2022-08-24" },
  { version: "2.8", startDate: "2022-07-13" },
  { version: "2.7", startDate: "2022-05-31" },
  { version: "2.6", startDate: "2022-03-30" },
  { version: "2.5", startDate: "2022-02-16" },
  { version: "2.4", startDate: "2022-01-05" },
  { version: "2.3", startDate: "2021-11-24" },
  { version: "2.2", startDate: "2021-10-13" },
  { version: "2.1", startDate: "2021-09-01" },
  { version: "2.0", startDate: "2021-07-21" },
  { version: "1.6", startDate: "2021-06-09" },
  { version: "1.5", startDate: "2021-04-28" },
  { version: "1.4", startDate: "2021-03-17" },
  { version: "1.3", startDate: "2021-02-03" },
  { version: "1.2", startDate: "2020-12-23" },
  { version: "1.1", startDate: "2020-11-11" },
  { version: "1.0", startDate: "2020-09-28" },
] as const;

export function getGenshinVersion(date: string): string | null {
  const submissionDate = new Date(date);

  for (const entry of GENSHIN_VERSIONS) {
    const versionStart = new Date(`${entry.startDate}T00:00:00Z`);

    if (submissionDate >= versionStart) {
      return entry.version;
    }
  }

  return null;
}
