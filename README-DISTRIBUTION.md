# Northstar Recruitment OS 1.1.0 — Windows x64

## Install and start

1. Download and extract `NorthstarRecruitment-1.1.0-Windows-x64.zip`.
2. Double-click `NorthstarRecruitment.exe`. Keep its startup window open while using the app.
3. On first launch, create the founder account. Choose a password of at least 12 characters.
4. The app opens in your browser at `http://127.0.0.1:3010`.

The app runs locally on this computer and does not require Node.js. Its database is stored at `%APPDATA%\NorthstarRecruitment\data\northstar.sqlite`. Back up that folder to protect candidate, client, billing, and financial records. Existing SQLite data is migrated automatically when the app starts; do not delete the database when upgrading.

## Billing setup

Sign in as the founder or an administrator and open **Billing settings** to add your company legal name, GSTIN, address, invoice prefix, contact information, accepted payment modes, bank / UPI details, invoice terms, and signatory information. Add each client's GSTIN and billing address in **Clients → Edit**. These details are used on downloaded invoices. GSTIN is printed; this app does not calculate GST tax.

## Upgrade

Close the old app window before launching the new version. Keep the existing `%APPDATA%\NorthstarRecruitment` folder; it contains the database and first-run settings.

## Database connectors

The live app uses SQLite. SQL Server and Microsoft Access are not connected in this build. The database settings page can move the SQLite database to another file path.

## Verify the download

The release folder includes a `.sha256` file. In PowerShell, run:

`Get-FileHash .\NorthstarRecruitment-1.1.0-Windows-x64.zip -Algorithm SHA256`

Compare the displayed hash with the value in the checksum file.
