# Table & Phone Comparison

A browser-only tool for comparing complete tables by a selected column. No server, build step, account or database is required.

## GitHub Pages: one-time setup

1. Open https://github.com/tcbr10/tables_offline_compare_tool/settings/pages
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open the repository's **Actions** tab, select **Deploy GitHub Pages**, and run or re-run the workflow after enabling Pages.
4. After a successful deployment, visit https://tcbr10.github.io/tables_offline_compare_tool/

The workflow deploys on subsequent pushes to `main`. Enabling Pages initially is a repository setting; the standard workflow token cannot enable it automatically.

## Use

- Import Excel, CSV or TSV files, or paste spreadsheet cells.
- Choose a worksheet, header setting and comparison column independently for A and B.
- The header row and comparison column are detected automatically. Columns are ranked by how many *distinct* phone numbers they hold, so a column repeating one number (such as a destination line) is never chosen; when both tables are loaded, the column pair sharing the most keys wins. Choosing a column by hand turns detection off for that table.
- A warning appears when the chosen column has very few distinct values. When A and B share no keys, the summary says so and, in phone mode, lists numbers that differ by a single digit (these are never matched automatically).
- Compare normalized phone numbers, case-insensitive text or case-sensitive text.
- Merge, remove B from A, remove A from B, find matching/unmatched rows, or clean a single table.
- Keep first, last or all duplicate rows. Shared keys in keep-all mode retain the preferred table's rows, not a many-to-many join.
- Align non-key columns by header name. Selected key columns combine even when their names differ.
- Prefer A/B rows, optionally filling empty cells from the other table.
- Export full rows to Excel or CSV, or copy a tab-separated table with headers.

`+972559280898`, `0559280898`, `559280898` and `00972559280898` match in Israeli phone mode. Text around a number (`tel: 052-6070482`, `052-6070482 ext 2`) is ignored. A cell holding several numbers (`052-6070482 / 054-1234567`) matches on any of them, and the rows those numbers appear in are treated as one contact across both tables. Invalid/empty keys are excluded and displayed. This validates formatting, not active numbers.

## Local use and privacy

Open `index.html` directly in a browser. Tables are processed locally and not uploaded or persisted by the app. Paste and CSV/TSV work offline. Excel import/export requires downloading SheetJS 0.20.3 from its CDN on first use; do not assume Excel support is available offline.

Exports contain data values only, not original workbook styling, formulas or additional sheets. Excel output stores values as text to preserve leading zeros and prevent formula interpretation. CSV has no column types; spreadsheet apps may reinterpret numbers or formula-like values. Previously rounded identifiers cannot be recovered. Preview filtering does not limit exports.
