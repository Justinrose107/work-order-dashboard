# Work Order Closure Tracker

Open `index.html` and import the original work order spreadsheet. The dashboard supports region and subregion filtering, search, work order details, and exporting the current filtered results.

The seven regions are DAP, SEA, EUB, EMG, RCIS, ISC, and LATAM. Korea is normalized to KOR and the RCIS subregion is normalized to CIS.

The dashboard uses `Work Order Status` to determine whether an order is closed; `Completed` in the flow status does not mean the work order is closed. Orders completed within 72 hours, including exactly 72 hours, are excluded from pending closure. Orders with no completion time are shown separately and included in pending closure. Future or invalid timestamps and missing work order statuses are listed under Needs review. Timestamps without a timezone use UTC+8 by default; the selector can change this. Duplicate work order numbers are retained and flagged.

## GitHub Pages

Upload all files in this directory to the root of a GitHub repository. In Settings → Pages, choose Deploy from a branch, select the `main` branch and `/ (root)`, then save.

No build step or backend is required. Keep `xlsx.full.min.js` next to `index.html`, or Excel parsing will not work. Do not upload business spreadsheets to GitHub; import them locally after opening the page.

Imported spreadsheet data and filter preferences are saved locally in this browser using IndexedDB; they are not uploaded. Reopen the page to restore the last workbook and filters, or use Clear saved data to remove them. If browser storage is unavailable, the page continues without persistence. Counts refresh every minute, and the Refresh counts button is available for an immediate update.

Excel parsing and export use SheetJS CE 0.20.3 under the Apache 2.0 license. See `vendor/LICENSE` and the [standalone browser documentation](https://docs.sheetjs.com/docs/getting-started/installation/standalone/).
