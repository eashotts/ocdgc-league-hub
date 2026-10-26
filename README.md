# OCDGC League Hub
Free GitHub Pages site for OCDGC leagues. Repository: `eashotts/ocdgc-league-hub`.

## Initial deployment
1. Create public GitHub repo `ocdgc-league-hub`.
2. Upload all project files, including `.github/workflows/deploy.yml`.
3. In Settings > Pages choose **GitHub Actions**.
4. In Actions run **Deploy OCDGC League Hub**. Placeholder data is expected until export configured.
5. Website: https://eashotts.github.io/ocdgc-league-hub/

## Connect spreadsheet (later)
1. In the Google Sheet open Extensions > Apps Script. Add `apps-script/Code.gs` as a new file, preserving existing scripts.
2. In Apps Script Project Settings > Script properties add `EXPORT_TOKEN` with a long random value.
3. Deploy > New deployment > Web app, execute as Me, access Anyone. Copy the `/exec` URL.
4. GitHub Settings > Secrets and variables > Actions: create `EXPORT_URL` with `<web-app-url>?token=<EXPORT_TOKEN>`.
5. Run the workflow manually. Never commit tokens, raw registration tabs, or private data.

## Important
- Public export reads only the `PDGA Standings` and `Payouts` tabs.
- Weekly payout winner names and exact amounts are not mapped yet; this MVP displays weekly contributions only.
- The sheet's `In progress` sync label is not a completion signal. Export timestamps are not proof PDGA synchronization finished.
- Apps Script bound to the spreadsheet uses `getActiveSpreadsheet()`; for future sheets, copy the script or update it to open by ID.
- For future events, adapt league name and PDGA event ID in the exporter. A reusable external config can be added in the next iteration.
