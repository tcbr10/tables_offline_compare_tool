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
- **Templates with a date or title above the column titles.** The *Header row* menu on each list card (and in the Combine add/update dialog) picks the row that holds the titles. It is found automatically: a line above it that fills at most half the table's width and is followed by a fuller line is skipped, and a note shows what was skipped. Choose "No header row" or another row to override (detection then stays off for that list). *Add the date as a column* appends the date found in the skipped lines as a "Report date" column. Blank rows are not counted when numbering rows, and trailing empty columns are dropped.
- **Detection.** The header row and match column are found automatically. Columns are ranked by how many *distinct* phone numbers they hold, so a column repeating one number is never chosen; when both lists are loaded, the column pair sharing the most keys wins. Choosing a column by hand turns detection off for that list. A warning appears when the chosen column has very few distinct values, and when the lists share no keys.
- **Match as** phone (Israeli normalization), Israeli ID (ת״ז: leading zeros restored, 5–9 digits, wrong check digits still match but are counted), text (ignore case) or exact text. Pick the column to match on in each list's card ("Match on").
- **Choose what to see** by clicking areas of the Venn diagram (only in A, in both, only in B) or a quick pick. The selection is the operation: all three = merge, both = matching rows, A + B = unmatched rows, A only = A without B, B only = B without A, A + both = all of A, both + B = all of B.
- **Inspect a row.** Click a row to see the A and B values side by side and pick which value goes in the result for each differing cell.
- **Review near matches.** Phone numbers one digit apart are listed as possible matches. Accepting one links the two rows; ignoring hides it. Nothing is matched automatically.
- **Options** (button in the header): which list wins for shared rows and whether empty cells are filled from the other list, how the match column is written (original, +972…, 0…, 972…), sorting, keeping first/last/all duplicates, and a source column for exports.
- **Export** full rows to Excel or CSV, or copy a tab-separated table with headers. The search box only filters the preview.
- **Choose columns.** The *Columns* button above the results lists every column with the list it comes from (match column, only in A, only in B, in both). Untick the ones you do not want; the table, downloads and copies follow. *Only from* A or B selects that list's columns in one click.
- Swap A and B, or Start over, from the buttons at the top.

`+972559280898`, `0559280898`, `559280898` and `00972559280898` match in Israeli phone mode. Text around a number (`tel: 052-6070482`, `052-6070482 ext 2`) is ignored. A cell holding several numbers (`052-6070482 / 054-1234567`) matches on any of them, and the rows those numbers appear in are treated as one contact across both lists. Invalid or empty keys are excluded and can be listed from the list card. This validates formatting, not active numbers.

## Combine: saved lists, unite and remove

The **Combine** tab (next to Compare in the header) works with lists saved in this browser.

- **Saved lists.** Add lists from a file or pasted cells, or press *Save to library* on a Compare list card; *Use a saved list* loads one into Compare. Each list remembers its match column per match type (phone, Israeli ID, text); change it from the list card. *Update from a new file* replaces a list and shows how many keys are new, gone and unchanged first. Dropping a file on the Saved lists panel opens the add dialog.
- **Build a list from steps.** Start with one list, then *Add* lists (unite), *Remove* lists (take out every row whose number appears in them) and *Keep only rows also in* other lists. Steps can be in any order. When a number is in several added lists the first list supplies the row and later lists fill its empty cells; a cell with several numbers joins rows across lists.
- **Drag and drop.** Drag a list onto a step, onto one of the add-step buttons (new step), reorder lists inside a step, reorder steps by their coloured circle, or drag a list or step onto the Saved lists panel to take it out. Every drag has a button alternative and an Undo.
- **See the effect.** The count funnel shows the total after each step and how many rows each list added or removed. The Removed tab lists the rows taken out and which list removed them. Results can be downloaded, copied, or saved as a new list (a snapshot).
- **Columns.** *Columns* above the result works the same way: each column shows which saved lists have it, *Only from* picks one list's columns, and downloads, copies and Save as list use only the chosen columns. Recipes remember the choice.
- **Same template every month.** A saved list remembers its header row and date-column choice, so *Update from a new file* loads next month's file the same way; the list card shows the report date of the latest file.
- **Recipes** save the steps and match type, not the rows, and run on the current lists when opened.
- **Storage.** Lists and recipes live in the browser's IndexedDB on this device only; nothing is uploaded. If the browser blocks storage the tool says so and keeps them in memory. *Back up* downloads one JSON file; *Restore* merges it back (a list already here is replaced only by a newer copy). Clearing the browser's site data deletes everything saved, so back up first.

## Code layout

No build step: open `index.html` and it loads plain scripts.

- `engine.js` matching, compare and combine rules, no DOM access
- `store.js` saved lists and recipes (IndexedDB, with a memory fallback)
- `i18n.js` English and Hebrew interface strings
- `ui.js` compare view, shared helpers (dialogs, export, file reading)
- `combine.js` the Combine view: library, step builder, funnel, drag and drop
- `style.css` styles, with light and dark themes and right-to-left support
- `tests/` run with `npm test` (needs only Node 20+, no packages)
- `mockups/` the design mockup this layout came from

## Local use and privacy

Open `index.html` directly in a browser. Tables are processed locally and not uploaded. Nothing is kept unless you save a list in Combine; saved lists stay in this browser only. Paste and CSV/TSV work offline. Excel import/export requires downloading SheetJS 0.20.3 from its CDN on first use; do not assume Excel support is available offline.

Exports contain data values only, not original workbook styling, formulas or additional sheets. Excel output stores values as text to preserve leading zeros and prevent formula interpretation. CSV has no column types; spreadsheet apps may reinterpret numbers or formula-like values. Previously rounded identifiers cannot be recovered. Preview filtering does not limit exports.
