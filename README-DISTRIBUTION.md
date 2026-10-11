# Northstar Recruitment Windows build

## Start

Run `NorthstarRecruitment.exe`. Your browser opens to the local app. On the first launch, create a founder account in the setup screen. The app stores its local database under `%APPDATA%\NorthstarRecruitment\data\northstar.sqlite` and listens only on this computer (`127.0.0.1:3000`). Keep the database folder backed up; it contains candidate, client, and financial information.

To use another port, set the `PORT` environment variable before launching. The app is a Windows x64 executable and does not require Node.js to be installed.

## Database integration status

This build uses its bundled SQLite database. SQL Server and Microsoft Access are **not connected as live databases in this build**. The source currently has no ODBC/database-provider adapter. The executable is not configured to point at either external database.

To complete the requested SQL Server and Access integration, provide:

- SQL Server: server/instance, database name, authentication type (Windows or SQL login), and whether the target is local or remote. Do not send passwords in chat; we can add a secure connection setup screen.
- Access: `.accdb` or `.mdb` file location and confirmation that the target Windows computers have the matching 64-bit Microsoft Access Database Engine / ODBC driver installed.
- Whether the SQL Server or Access database must be the authoritative store, or whether you want imports/exports from the app's SQLite database.

The Access ODBC driver is a separate Windows prerequisite and must match the app's 64-bit architecture. SQL Server connectivity also requires a configured server and credentials. No credentials are bundled in this release.

## Build from source

Requires Node.js 24 on Windows. Run `npm install`, then `npm run build:exe`. The generated executable is written to `dist\NorthstarRecruitment.exe`.

