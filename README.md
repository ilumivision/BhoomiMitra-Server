## Current Architecture

Farmer
↓
WhatsApp
↓
Meta Cloud API
↓
BhoomiMitra AI Server (Render)
↓
OpenAI GPT-5.5
↓
Google Sheets Database (Google Drive)
↓
WhatsApp Reply

## Planned Features

- Farmer Registration
- Expert Registration
- Service Provider Registration
- AI Agricultural Advisory
- Malayalam & English Support
- Image-based Disease Diagnosis
- Voice Message Support
- Conversation History
- Google Sheets Database
- Analytics Dashboard
- Future Migration to PostgreSQL/Firebase if required

## Start

npm install
npm start

## Verification

```text
npm test
node --check index.js
git diff --check
```

## Controlled maintenance commands

- `npm run reminders:fertilizer` is dry-run/read-only unless its separate delivery gates are approved and enabled.
- `npm run sync:schemes` remains read-only and prepares proposed cache changes only.
- `npm run market:update` is disabled by default. A manual update requires both `MARKET_UPDATE_ENABLED=true` and `--execute`; this does not install or activate a scheduler.

Use only an approved test workbook during pilot validation. Production Sheet access, schema changes, scheduled jobs, broadcasts and deployment require separate authorization.

## Environment Variables

VERIFY_TOKEN
OPENAI_API_KEY
WHATSAPP_TOKEN
PHONE_NUMBER_ID
GOOGLE_SHEET_ID
GOOGLE_CLIENT_EMAIL
GOOGLE_PRIVATE_KEY
LAND_MAP_ACCESS_SECRET
COPERNICUS_CLIENT_ID
COPERNICUS_CLIENT_SECRET
OPENAI_MODEL
PORT
