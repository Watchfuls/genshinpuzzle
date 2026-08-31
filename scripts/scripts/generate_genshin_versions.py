from pathlib import Path
import json
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from datetime import datetime

LUNA_MAP = {
    "Luna I": "6.0",
    "Luna II": "6.1",
    "Luna III": "6.2",
    "Luna IV": "6.3",
    "Luna V": "6.4",
    "Luna VI": "6.5",
    "Luna VII": "6.6",
    "Luna VIII": "6.7",
}

API_URL = "https://genshin-impact.fandom.com/api.php"

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "src" / "game" / "genshinVersions.ts"


def fetch_rendered_page():
    params = {
        "action": "parse",
        "page": "Version",
        "prop": "text",
        "format": "json",
        "formatversion": "2",
    }

    url = API_URL + "?" + urllib.parse.urlencode(params)

    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "GenshinDummyGuesser/1.0",
            "Accept": "application/json",
        },
    )

    with urllib.request.urlopen(request) as response:
        data = json.load(response)

    return data["parse"]["text"]


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_cell = False
        self.current_cell = ""
        self.current_row = []
        self.rows = []

    def handle_starttag(self, tag, attrs):
        if tag in ("td", "th"):
            self.in_cell = True
            self.current_cell = ""

    def handle_data(self, data):
        if self.in_cell:
            self.current_cell += data

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.in_cell:
            self.current_row.append(self.current_cell.strip())
            self.in_cell = False

        elif tag == "tr":
            if self.current_row:
                self.rows.append(self.current_row)

            self.current_row = []


def extract_versions(html):
    parser = TableParser()
    parser.feed(html)

    versions = []
    seen = set()

    date_pattern = re.compile(
        r"^(January|February|March|April|May|June|July|August|"
        r"September|October|November|December) "
        r"\d{1,2}, \d{4}$"
    )

    version_pattern = re.compile(r"^\d+\.\d+$")

    for row in parser.rows:
        version = None
        release_date = None

        for cell in row:
            cell = " ".join(cell.split())

            if version_pattern.match(cell):
                version = cell
            elif cell in LUNA_MAP:
                version = LUNA_MAP[cell]

            if date_pattern.match(cell):
                release_date = cell

        if not version or not release_date:
            continue

        if version in seen:
            continue

        seen.add(version)

        parsed_date = datetime.strptime(
            release_date,
            "%B %d, %Y",
        )

        versions.append({
            "version": version,
            "startDate": parsed_date.strftime("%Y-%m-%d"),
        })

    return versions


def generate_typescript(versions):
    versions.sort(
        key=lambda x: x["startDate"],
        reverse=True,
    )

    lines = [
        "// AUTO-GENERATED. DO NOT EDIT.",
        "// Generated from the Genshin Impact Wiki Version page.",
        "",
        "export const GENSHIN_VERSIONS = [",
    ]

    for row in versions:
        lines.append(
            f'  {{ version: "{row["version"]}", '
            f'startDate: "{row["startDate"]}" }},'
        )

    lines += [
        "] as const;",
        "",
        "export function getGenshinVersion(date: string): string | null {",
        "  const submissionDate = new Date(date);",
        "",
        "  for (const entry of GENSHIN_VERSIONS) {",
        '    const versionStart = new Date(`${entry.startDate}T00:00:00Z`);',
        "",
        "    if (submissionDate >= versionStart) {",
        "      return entry.version;",
        "    }",
        "  }",
        "",
        "  return null;",
        "}",
        "",
    ]

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(lines), encoding="utf-8")


def main():
    print("Fetching rendered Genshin version history...")

    html = fetch_rendered_page()
    versions = extract_versions(html)

    if not versions:
        raise RuntimeError("No Genshin versions found.")

    generate_typescript(versions)

    print(f"Generated: {OUTPUT}")
    print(f"Found {len(versions)} versions.")
    print()

    for row in versions:
        print(f'{row["version"]}: {row["startDate"]}')


if __name__ == "__main__":
    main()