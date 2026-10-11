# Northstar Recruitment OS

A local recruitment business management app for candidate pipelines, placements, invoicing, receivables, cash flow, and client reporting.

## Version 1.1.0

Billing settings now support company and client GSTINs, billing addresses and contacts, invoice numbering prefix, payment modes, bank / UPI instructions, terms and conditions, and signatory information. The Windows distribution is in `release/NorthstarRecruitment-1.1.0-Windows-x64.zip`.

See [README-DISTRIBUTION.md](README-DISTRIBUTION.md) for installation and backup instructions.

## Run from source

Requires Node.js 24 on Windows. Run `npm install`, then `npm start`. The app listens on `http://127.0.0.1:3000` for source mode. Build the standalone Windows executable with `npm run build:exe`.

The executable listens on `http://127.0.0.1:3010` and stores its database in `%APPDATA%\NorthstarRecruitment\data\northstar.sqlite`.

## Data and connectors

The current live database is SQLite. The database location can be selected during first-run setup or changed later in Database settings. SQL Server and Microsoft Access are not live connectors in this version.

## Security and backup

The app binds to the local computer only. Create the first founder login on first launch. Back up `%APPDATA%\NorthstarRecruitment` to protect workspace data and settings.
