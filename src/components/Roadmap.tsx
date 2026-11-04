import TopTabs from "./TopTabs";

export default function Roadmap() {
  return (
    <div style={{ minHeight: "100vh" }}>
      <TopTabs />

      <main className="simple-page roadmap-page">
        {/* ================= PLANNED CHANGES ================= */}

        <h3 style={{ marginTop: 0 }}>Planned Changes</h3>

        <div style={{ opacity: 0.9 }}>
          <h4>Ready for review</h4>
          <p>
            Editing and deleting submissions with a private management code, and named weapon
            selection filtered by character type. These features are implemented in the local
            preview; database migration and deployment are pending.
          </p>
          <h4>Future / Explicitly Deferred</h4>

          <p>
            - Rework the damage hints. Currently, the DPS can be calculated from the existing
            information. A possible alternative would be to show damage percentages instead of raw
            damage numbers and reveal the values alongside the DPS hint.
          </p>

          <p>
            - Automatically clean up unused submission images.
            <br />- OCR number extraction from submitted images.
            <br />- Automatic censoring / blurring of answers in submitted images.
          </p>
        </div>

        {/* ================= CHANGELOG ================= */}

        <h3 style={{ marginTop: 40 }}>Changelog</h3>

        <div style={{ opacity: 0.9 }}>
          <h4>Version 1.0 — 31/08/2026</h4>

          <p>
            - Added Version 7.0 characters.
            <br />- Added separate Daily and Endless puzzle pools.
            <br />- Submissions are now automatically assigned to Daily or Endless based on
            character constellations and weapon refinements.
            <br />- Standard 5★ characters can use constellations without being moved to Endless.
            <br />- Characters included in Temper Thyself and Journey Far can use C1 while remaining
            eligible for Daily.
            <br />- Existing submissions have been updated for the new Daily / Endless system.
            <br />- Added Genshin version information to puzzles based on when they were submitted.
            <br />- The Submit page now follows the selected alphabetical or release date character
            sorting preference.
            <br />- Updated the Submit page with clearer information about Daily and Endless
            eligibility.
            <br />- Updated character data and icons.
            <br />- Improved character data generation and backend data handling.
          </p>
        </div>
      </main>
    </div>
  );
}
