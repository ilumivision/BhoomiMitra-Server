# BhoomiMitra Prompt 5 — manual Google Sheets schema checklist

This checklist is for a manual, read-only comparison with the live workbook. The Prompt 5 implementation and automated tests do not create tabs, add headers, rewrite IDs, or alter live rows.

## `Training_Requests`

Required headers (header order is not significant):

- `Request_ID` — unique `BM-TRQ-...` value; deterministic for a WhatsApp submit message when a source message ID exists.
- `Farmer_ID` — copied from the verified `Farmers` record; never requested from the farmer and never backfilled.
- `Mobile_No` — WhatsApp number from the verified farmer/session record.
- `Farmer_Name` — name from `Farmers` when available.
- `District` — district from `Farmers` when available.
- `Training_Category` — Crop Production, Animal Husbandry, Agricultural Entrepreneurship, Value Addition, or `Other / Farmer requested`.
- `Training_Topic` — farmer-requested programme/topic.
- `Preferred_Mode` — `Online`, `Offline / In-person`, or `Either`.
- `Preferred_Time` — for online requests: `2:00–5:00 PM`, `7:00–10:00 PM`, or `Either`; otherwise `Not applicable`.
- `Preferred_Location` — optional farmer preference.
- `Preferred_Date` — optional farmer preference or date range.
- `Remarks` — optional farmer remarks.
- `Request_Status` — initially `Requested`.
- `Assigned_Coordinator` — programme-specific coordinator when configured, otherwise `Sri Binu John`.
- `Overall_Coordinator` — `Dr. Sindhu Sadanandan`.
- `Training_Coordinator` — `Sri Binu John`.
- `Created_At` — ISO-8601 creation timestamp.

Recommended operational headers:

- `Updated_At`
- `Source_Message_ID`
- `Confirmed_Training_ID`
- `Confirmed_Training_Title`
- `Confirmed_Date`
- `Confirmed_Location`

Safety checks:

- Every nonblank `Farmer_ID` must already exist in `Farmers`.
- Do not auto-fill a missing `Farmer_ID` and do not change an existing one.
- `Request_ID` must be unique.
- Coordinator columns contain names/roles only; no personal phone number is hardcoded.
- Formula-leading farmer text is stored as text.

## `Government_Schemes`

Minimum read-compatible headers:

- `Scheme_ID`
- `Scheme_Name`
- `Government` (or `Government_Level` / `Scheme_Level`)
- `Department`
- `Category`
- `Purpose` (or `Description`)
- `Eligibility`
- `Benefit`
- `Application_Mode`
- `Official_URL` and/or `Application_Link`
- `District` (or district/state applicability equivalent)
- `Last_Date` when applicable
- `Status`
- `Source`
- `Last_Checked` and/or `Last_Updated`

Headers used by the read-only ingestion/cache audit when available:

- `Subcategory`
- `Target_Beneficiaries`
- `Crop_Context`
- `Livestock_Context`
- `Land_Context`
- `State_Applicability`
- `Application_Start`
- `Last_Source_Update`
- `Source_Hash`
- `Data_Quality`
- `Source_Key`

Only records explicitly marked active/open/current/ongoing and not past a valid deadline are shown as active. Missing or malformed status/deadline data fails closed. Official-source synchronization remains dry-run/read-only; external jobs stay disabled.

## Existing-tab compatibility

- `Farmers`: `Farmer_ID`, farmer name, and mobile/WhatsApp aliases used by registration lookup must remain intact.
- `Expert_Directory`: expert identity, contact, specialization/group, availability, verification, and active-status headers must retain their existing aliases/positions.
- `Expert_Cases`: case ID, farmer WhatsApp, status, and assigned expert references must remain intact.
- `Animal_Registry`: `Animal_ID`, `Farmer_ID`, and `Animal_Type` must remain intact.
- `Crop_Registry`: `Crop_ID`, `Farmer_ID`, `Land_ID`, and `Crop_Name` must remain intact.
- `Service_Request`: continues to store listed-programme registrations and scheme interests; Prompt 5 training requests use `Training_Requests` instead.

Use `node scripts/audit-google-sheet-readonly.js` only when an authorized operator intentionally performs a live read-only audit. Review its report manually; do not use it to mutate the workbook.
