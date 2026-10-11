# Northstar Recruitment Management

A self-hosted recruitment business workspace for clients, jobs, candidate pipelines, placements, invoicing, collections, recruiter performance, and client hiring updates.

## Requirements

- Node.js 22.13 or newer for the source app (`node:sqlite`)
- Node.js 24 and Windows to build the single-file executable

## Start from source

Set credentials for the first founder account, then run the server:

```powershell
$env:ADMIN_EMAIL = 'you@example.com'
$env:ADMIN_NAME = 'Your Name'
$env:ADMIN_PASSWORD = 'use-a-unique-password-at-least-12-chars'
npm start
```

Open `http://127.0.0.1:3000`. The first founder can create other users from **Team & access**. Passwords must be at least 12 characters.

## Windows executable

Run `npm install` and `npm run build:exe`. The build output is `dist\NorthstarRecruitment.exe`. The packaged app uses port 3010 and stores its SQLite data in `%APPDATA%\NorthstarRecruitment\data\northstar.sqlite`. Keep its startup window open while the app is running.

## Business workflows

- Client contacts and 30 / 45 / 60 / 90-day terms
- Jobs, recruiter ownership, candidate database, applications, and interview feedback
- Joined placements, replacement windows, and automatic invoices for fee-bearing joined hires
- Batch invoice generation for older uninvoiced placements, invoice downloads, payment records, and overdue tracking
- Daily, weekly, monthly, quarterly, half-yearly, yearly, and custom-date client hiring updates
- Shortlist, rejection feedback, delay reasons, suggestions, and budget request sections in client reports
- Save and download client-ready HTML reports; open email or WhatsApp drafts for manual review
- Database file path selection during initial setup or later from **Database settings**; changing paths copies the current SQLite database and switches to the copy
- Founder/admin, recruiter, and finance roles

## Database support

SQLite is the active database backend. SQL Server and Microsoft Access are not connected in this version. Their drivers and provider-specific migrations must be implemented before those databases can safely be selected.

## Data and security

The source app stores data under `data/northstar.sqlite` by default. Configure `DATA_DIR` or `DB_PATH` to override the source-app location. The packaged app keeps its database under the current Windows user's AppData folder. Keep encrypted backups because the database contains candidate, client, and financial records. Sessions are held in memory and expire after inactivity.

WhatsApp and email actions open drafts for a human to review; the app does not send them automatically. Currency defaults to ₹. Expected job fee revenue currently estimates fixed-fee roles only.

