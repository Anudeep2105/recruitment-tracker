# Northstar Recruitment Management

A self-hosted recruitment agency workspace for client and job management, candidate pipelines, placements, payment terms, invoices, collections, recruiter results, and role-based access.

## Requirements

- Node.js 22.13 or newer (uses the built-in `node:sqlite` module)
- No third-party npm packages

## Start the app

In PowerShell, from this folder, configure the first founder account and start the server:

```powershell
$env:ADMIN_EMAIL = 'you@example.com'
$env:ADMIN_NAME = 'Your Name'
$env:ADMIN_PASSWORD = 'use-a-unique-password-at-least-12-chars'
npm start
```

Open `http://127.0.0.1:3000`. The initial founder is created the first time the app starts. Later starts do not reset the password. Keep the database file safe; it contains candidate and client records.

To listen on a different interface or port, set `HOST` and `PORT`. Set `DATA_DIR` or `DB_PATH` to store the SQLite database outside the application folder. Back up the database while the server is stopped, or use SQLite's backup API for a live backup.

## Current workflows

- Clients, commercial contacts, notes, and 30 / 45 / 60 / 90-day terms
- Open roles, fee model, priority, assigned recruiter, and candidate count
- Candidate database and job-specific applications
- Pipeline stages and interview scheduling / feedback
- Joined placements, recruiter attribution, fee, payment term, and replacement window
- Invoice generation with a generated invoice number; due date defaults from the client's payment terms
- Partial and full payment recording, invoice aging, overdue receivables, and collections export
- Founder dashboard with live operational counts, client invoice value, recruiter performance, and fixed-fee opportunity value from open jobs
- Role access for founder, admin, recruiter, and finance users
- Activity trail for record creation, edits, deletions, and payments

## Roles

| Role | Access |
| --- | --- |
| Founder / admin | All sections, user creation, record management |
| Recruiter | Jobs, candidates, pipeline, placements, team results; no finance or user administration |
| Finance | Client records, invoices, payment recording, and reports |

The first founder is created from the startup environment variables. A founder/admin can create additional users from **Team & access**. User passwords must be at least 12 characters.

## Data and security

The app stores records in SQLite under `data/northstar.sqlite` by default. The `data/` directory is ignored by Git. Sessions are held in memory, expire after inactivity, and use an HTTP-only, same-site cookie. In production, run behind HTTPS and set `NODE_ENV=production` so the secure cookie flag is enabled. Restrict access to the app host, keep backups encrypted, and configure a strong unique founder password.

## Integrations and deployment

This version runs as a single self-hosted Node.js app. It does not yet send WhatsApp/email messages, connect to an accounting provider, offer a branded custom domain, or provide multi-tenant cloud hosting. Those integrations need the chosen provider accounts, credentials, message templates, consent rules, and deployment target before they can be activated. The app currently uses ₹ and browser locale formatting for reporting; adapt this before using another business currency.

The open-job expected-fee figure includes fixed-fee roles only. Percentage-fee roles need salary/CTC ranges before their potential revenue can be calculated. Forecast collections are based on issued invoices and their due dates; pipeline jobs are not treated as booked cash.

