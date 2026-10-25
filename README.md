# Table & Phone Comparison

A browser-only tool for comparing complete tables by a selected column. No server, build step, account or database is required.

## GitHub Pages: one-time setup

1. Open https://github.com/tcbr10/tables_offline_compare_tool/settings/pages
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open the repository's **Actions** tab, select **Deploy GitHub Pages**, and run or re-run the workflow after enabling Pages.
4. After a successful deployment, visit https://tcbr10.github.io/tables_offline_compare_tool/

The workflow deploys on subsequent pushes to `main`. Enabling Pages initially is a repository setting; the standard workflow token cannot enable it automatically.

## Use

The page is one workspace: your lists and match settings on the left, the answer on the right.

- **Add lists.** Drop Excel, CSV or TSV files onto a list, press Import file, or paste spreadsheet cells (Ctrl+V works anywhere on the page and fills the first empty list). Try sample lists shows the tool with example data.
- **Detection.** The header row and match column are found automatically. Columns are ranked by how many *distinct* phone numbers they hold, so a column repeating one number is never chosen; when both lists are loaded, the column pair sharing the most keys wins. Choosing a column by hand turns detection off for that list. A warning appears when the chosen column has very few distinct values, and when the lists share no keys.
- **Match as** phone (Israeli normalization), Israeli ID (ת״ז: leading zeros restored, 5–9 digits, wrong check digits still match but are counted), text (ignore case) or exact text. Pick the column to match on in each list's card ("Match on").
- **Choose what to see** by clicking areas of the Venn diagram (only in A, in both, only in B) or a quick pick. The selection is the operation: all three = merge, both = matching rows, A + B = unmatched rows, A only = A without B, B only = B without A, A + both = all of A, both + B = all of B.
- **Inspect a row.** Click a row to see the A and B values side by side and pick which value goes in the result for each differing cell.
- **Review near matches.** Phone numbers one digit apart are listed as possible matches. Accepting one links the two rows; ignoring hides it. Nothing is matched automatically.
- **Options** (button in the header): which list wins for shared rows and whether empty cells are filled from the other list, how the match column is written (original, +972…, 0…, 972…), sorting, keeping first/last/all duplicates, and a source column for exports.
- **Export** full rows to Excel or CSV, or copy a tab-separated table with headers. The search box only filters the preview.
- Swap A and B, or Start over, from the buttons at the top.

`+972559280898`, `0559280898`, `559280898` and `00972559280898` match in Israeli phone mode. Text around a number (`tel: 052-6070482`, `052-6070482 ext 2`) is ignored. A cell holding several numbers (`052-6070482 / 054-1234567`) matches on any of them, and the rows those numbers appear in are treated as one contact across both lists. Invalid or empty keys are excluded and can be listed from the list card. This validates formatting, not active numbers.

## Code layout

No build step: open `index.html` and it loads plain scripts.

- `engine.js` matching and join rules, no DOM access
- `i18n.js` English and Hebrew interface strings
- `ui.js` state, rendering, file import and export
- `style.css` styles, with light and dark themes and right-to-left support
- `tests/` run with `npm test` (needs only Node 20+, no packages)
- `mockups/` the design mockup this layout came from

## Local use and privacy

Open `index.html` directly in a browser. Tables are processed locally and not uploaded or persisted by the app. Paste and CSV/TSV work offline. Excel import/export requires downloading SheetJS 0.20.3 from its CDN on first use; do not assume Excel support is available offline.

Exports contain data values only, not original workbook styling, formulas or additional sheets. Excel output stores values as text to preserve leading zeros and prevent formula interpretation. CSV has no column types; spreadsheet apps may reinterpret numbers or formula-like values. Previously rounded identifiers cannot be recovered. Preview filtering does not limit exports.
