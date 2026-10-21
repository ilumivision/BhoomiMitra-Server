# BhoomiMitra Version 1.0.0 — Google Sheets readiness checklist

This is a manual provisioning and read-only verification guide. The authorised October 2026 read-only audit confirmed that all 37 required V1 tabs exist in the one Master workbook. This compatibility correction did **not** reconnect to or modify that workbook; it uses the audited header report plus mocked fixtures. Any older per-row “live unverified” wording below records the original provisioning checklist state and does not override the later 37-tab presence result.

## Core identity and access tabs

| Exact tab name | Required headers / contract | Purpose and access | Identifier relationships | Provisioning and verification |
|---|---|---|---|---|
| `Farmers` | Canonical: `Farmer_ID`, `Name`, `Mobile`, `WhatsApp`, `District`, `Panchayath`, `Main_Crop`, `Preferred_Language`, `Registration_Status`, `Verification_Status`, `Active_Status`, `Registration_Date`, `Last_Updated`. Existing documented aliases remain supported. | Registration and profile; read/write. | `Farmer_ID` is the owner key used by land, crop, animal, training, consent and expert flows. | Existing expected; live unverified; manual header/duplicate-ID audit required. Never backfill or rewrite IDs automatically. |
| `Master_Member_Registry` | `BM_ID`, `Name`; existing phone, location, membership and status columns must retain their live positions/aliases. | Cross-category member registry; read/write through guarded synchronization. | Farmer rows reuse the existing `Farmer_ID` as `BM_ID`. | Existing expected; live unverified; manual audit required. |
| `User_Consent_Log` | Exact A:M contract: `Consent_ID`, `WhatsApp`, `Farmer_ID`, `Agreement_Version`, `Privacy_Policy_Version`, `Consent_Status`, `Consent_Date`, `Withdrawal_Date`, `Source`, `Policy_Language`, `Remarks`, `Created_At`, `Updated_At`. | Append-only consent history; read/write. | WhatsApp is usable before registration; `Farmer_ID` may be blank during first-time consent. | Existing expected; locally verified; live unverified. Do not edit prior decisions. |
| `Expert_Directory` | `Expert_ID`, `Name`, `Mobile_No`, `WhatsApp_No`, `District`, `Organization`, `Department`, `Designation`, `Expert_Group`, `Specialization`, `Availability`, `Auto_Route`, `Status`, `Verification_Status`, `Active_Status`, `Total_Consultations`, `Average_Rating`, `Farmers_Assigned`, `AI_Priority`. | Verified expert routing; read/write for approved operational fields. | `Expert_ID` is referenced by `Expert_Cases`. | Existing expected; live unverified; use the read-only audit because several columns are position-sensitive. |
| `Expert_Cases` | Required existing A:AD case contract including `Case_ID`, farmer `WhatsApp`, approved `Status`, assigned expert identity/contact, farmer question, expert reply, timestamps and `Source_Message_ID`. | Expert case creation, assignment, reply and follow-up; read/write. Ambiguous legacy rows are excluded from live routing and are never rewritten automatically. | Preserves `Case_ID`; relates farmer sender to an assigned `Expert_ID`. | New rows are header-mapped. Legacy rows without an aligned WhatsApp, approved status and source message ID require a separately approved offline review. |
| `Skilled Workers` | `Worker_ID`, `Name`, `Skill Category` (or retained aliases), service district, availability and status. District aliases include the existing `Distrct` and `Working Distrct` spellings. | Worker lookup and registration; read/write. | Worker identity is independent of Farmer IDs. | Existing tab is accepted without renaming the audited district column. |
| `Workforce Providers` | `Provider_ID`, `Provider Name`, `Contact Person`, `Service Category`, served districts, availability and status. | Machinery/service lookup and provider registration; read/write. | Provider identity is independent of Farmer IDs. | Existing expected; live unverified. |

## Land, GPS and satellite tabs

| Exact tab name | Required headers / contract | Purpose and access | Identifier relationships | Provisioning and verification |
|---|---|---|---|---|
| `Land_Parcels` | At minimum `Land_ID`, `Farmer_ID`, `Farm_Name`; operational fields include phone/WhatsApp aliases, `District`, `Local_Body_Type`, `Local_Body`, `Farmer_Reported_Area`, `Revenue_Record_Area`, `GPS_Calculated_Area`, `GPS_Calculated_Area_Unit`, `Area_Unit`, `Main_Crop`, boundary GeoJSON/status/verification and timestamps. | Land registration, ownership, summary and satellite context; read/write. | Every usable land must have its existing owner `Farmer_ID`; never infer a missing owner. | Existing expected; local mapping verified; live unverified. Manual check: area value and unit columns must both be populated where known. |
| `Land_Boundary_Points` | `Boundary_Point_ID`, `Land_ID`, `Boundary_Session_ID`, `Point_No`, `Latitude`, `Longitude`, plus existing capture/status/timestamp fields. | GPS boundary capture; read/write. | Each point belongs to one existing `Land_ID`. | Existing expected; locally verified; live unverified. Do not modify coordinates during readiness review. |
| `Land_Access` | Exact A:M contract: `Access_ID`, `Land_ID`, `Owner_Farmer_ID`, `Owner_WhatsApp`, `Authorized_Name`, `Authorized_WhatsApp`, `Relationship`, `Access_Level`, `Status`, `Granted_At`, `Granted_By`, `Revoked_At`, `Remarks`. | Authorised view/farm-management access; read/write. | Owner must match `Land_Parcels.Farmer_ID`; permission creates no land right. | Existing expected; locally verified; live unverified. |
| `Satellite_Observations` | Exact A:S contract: `Observation_ID`, `Land_ID`, `Farmer_ID`, `Farm_Name`, `Observation_Date`, `Satellite_Source`, `NDVI`, `Vegetation_Status`, `Moisture_Status`, `Waterlogging_Status`, `Stress_Status`, `Cloud_Cover`, `Area_SqM`, `Area_Cent`, `Area_Acre`, `Perimeter_M`, `Remarks`, `Created_At`, `Updated_At`. | Satellite observation cache/history; read/write only when the existing on-demand flow succeeds. | `Land_ID` and `Farmer_ID` must match authorised land access. | Existing expected; locally verified; live unverified. Never invent observations. |

## Animal Husbandry tabs

| Exact tab name | Exact required headers | Purpose and access | Identifier relationships | Provisioning and verification |
|---|---|---|---|---|
| `Animal_Registry` | `Animal_ID`, `Farmer_ID`, `WhatsApp_No`, `Animal_Type`, `Breed`, `Sex`, `Date_of_Birth`, `Age`, `Identification_Mark`, `Tag_Number`, `Vaccination_Status`, `Last_Vaccination_Date`, `Health_Status`, `Insurance_Status`, `Active_Status`, `Created_At`, `Updated_At`, `Remarks` | Animal registration and owned-animal list; read/write. | `Animal_ID` must belong to one existing `Farmer_ID`. | Required for Prompt 3; locally verified; live unverified; provision manually if absent. |
| `Animal_Health_Diary` | `Record_ID`, `Animal_ID`, `Farmer_ID`, `WhatsApp_No`, `Record_Date`, `Record_Type`, `Observation_or_Product`, `Dose_or_Result`, `Veterinarian`, `Next_Due_Date`, `Notes`, `Source_Message_ID`, `Created_At` | Health, vaccination and deworming records; read/write. | Both `Animal_ID` and `Farmer_ID` must match `Animal_Registry`. | Required for Prompt 3; locally verified; live unverified; provision manually if absent. No reminder job is enabled. |
| `Animal_Breeding_Production` | `Record_ID`, `Animal_ID`, `Farmer_ID`, `WhatsApp_No`, `Record_Date`, `Record_Type`, `Quantity_or_Result`, `Unit`, `Breeding_or_Production_Details`, `Notes`, `Source_Message_ID`, `Created_At` | Breeding and production records; read/write. | Both IDs must match owned animal records. | Required for Prompt 3; locally verified; live unverified; provision manually if absent. |
| `Animal_Disease_Alerts` | `Alert_ID`, `Disease_Name`, `Animal_Type`, `District`, `Alert_Text_English`, `Alert_Text_Malayalam`, `Source_Authority`, `Source_URL`, `Verification_Status`, `Active_Status`, `Valid_From`, `Valid_Until`, `Updated_At` | Verified official animal alerts; read-only to WhatsApp runtime. | District/type relevance only after verification, active-status and date checks. | Required for Prompt 3; locally verified; live unverified; official staff must provision/maintain. |

## Crop, diary and notification tabs

| Exact tab name | Exact required headers | Purpose and access | Identifier relationships | Provisioning and verification |
|---|---|---|---|---|
| `Crop_Registry` | `Crop_ID`, `Farmer_ID`, `Land_ID`, `Crop_Name`, `Variety`, `Crop_Type`, `Planting_Date`, `Cultivated_Area`, `Area_Unit`, `Crop_Status`, `Harvest_Date`, `Remarks`, `Created_At`, `Source_Message_ID` | Crop registration/current crops; read/write. | Farmer must own `Land_ID`; `Crop_ID` remains stable. | Required for Prompt 4; locally verified; live unverified; provision manually if absent. |
| `Crop_History` | `History_ID`, `Crop_ID`, `Farmer_ID`, `Land_ID`, `Event_Type`, `Event_Date`, `Crop_Status`, `Remarks`, `Created_At`, `Source_Message_ID` | Append-only crop status/history; read/write. | All three IDs must agree with the owned crop. | Required for Prompt 4; locally verified; live unverified; provision manually if absent. |
| `Farm_Operations` | `Operation_ID`, `Farmer_ID`, `Land_ID`, `Crop_ID`, `Operation_Type`, `Operation_Date`, `Operation_Status`, `Input_or_Material`, `Quantity`, `Unit`, `Cost`, `Remarks`, `Created_At`, `Source_Message_ID` | Farm Operations Diary; read/write. | Farmer/land/crop ownership is checked before write. | Required for Prompt 4; locally verified; live unverified; provision manually if absent. |
| `Crop_Disease_Alerts` | `Alert_ID`, `Alert_Category`, `Alert_Title`, `Crop_Name`, `District`, `Alert_Message`, `Precautions`, `Source_Name`, `Source_URL`, `Valid_From`, `Valid_Until`, `Verification_Status`, `Alert_Status`, `Created_At` | Verified crop-disease alerts; read-only to WhatsApp runtime. | Matched to owned crops/district only after source and validity checks. | Required for Prompt 4; locally verified; live unverified; official staff must maintain. |
| `Notification_Log` | Existing A:J notification contract used by `farmAlerts`; it must retain `Notification_ID`, user/farmer owner, `Land_ID`, notification type/status, scheduled/delivery timestamps and the serialized remarks payload expected by the module. | Fertilizer diary, planned operations and accepted delivery logging; read/write. | Owner and land are rechecked. | Existing expected; locally verified; live unverified. Reminder runner stays dry-run/not activated. |

## Training, schemes, weather and market tabs

| Exact tab name | Required headers / contract | Purpose and access | Identifier relationships | Provisioning and verification |
|---|---|---|---|---|
| `Training_Events_` | Programme ID/title, category, date, time, venue/location, mode, coordinator, contact, fee, capacity/registration status, active/status and update/source fields used by existing aliases. | Verified programme catalogue; read-only in normal WhatsApp flow. | Listed-programme registrations reference its programme identifier. | Existing source name includes the trailing underscore; locally verified; live unverified. Do not rename without code/data migration approval. |
| `Training_Requests` | `Request_ID`, `Farmer_ID`, `Mobile_No`, `Farmer_Name`, `District`, `Training_Category`, `Training_Topic`, `Preferred_Mode`, `Preferred_Time`, `Preferred_Location`, `Preferred_Date`, `Remarks`, `Request_Status`, `Assigned_Coordinator`, `Overall_Coordinator`, `Training_Coordinator`, `Created_At`. Recommended: `Updated_At`, `Source_Message_ID`, confirmation fields. | Farmer-created training requests; read/write. A newly saved non-duplicate request may trigger one WhatsApp alert to the separately configured authorised KVK training coordinator. | `Farmer_ID` is copied from verified registration, never typed/backfilled. | Required for Prompt 5; locally verified; live unverified; provision manually if absent. `KVK_TRAINING_ALERT_WHATSAPP` must contain only an approved destination and may remain blank. |
| `Government_Schemes` | `Scheme_ID`, `Scheme_Name`, `Government`, `Department`, `Category`, `Purpose`, `Eligibility`, `Benefit`, `Application_Mode`, `Official_URL`, `Application_Link`, `District`, `Last_Date`, `Status`, `Source`, `Last_Checked`, `Last_Updated`; retain optional ingestion-quality fields documented in `PROMPT5_SCHEMA_CHECKLIST.md`. | Verified scheme cache; read-only in WhatsApp. Sync remains dry-run. | Interests reference `Scheme_ID` through `Service_Request`. | Required for Prompt 5; locally verified; live unverified. Supported official adapters only. |
| `Service_Request` | Existing request ID, request type/status, Farmer ID/name/contact, related service/programme/scheme ID/title, coordinator and timestamps used by current header aliases. | Listed training registration and scheme interest/help requests; read/write. | Links verified farmer to programme/scheme. | Existing expected; locally verified; live unverified. |
| `Weather_Data` | Existing A:P layout; required `District`, `Date`, temperature and source/update fields. Current code also reads time, humidity, rainfall, wind, pressure and event positions. | Current weather/rainfall; read-only. | District-based. | Existing expected; live unverified; manual position audit required. |
| `Weather_Forecast` | Existing A:M layout with `District`, forecast date, maximum/minimum temperature and available rainfall/weather/source/update fields. | Available forecast; read-only. | District-based. | Existing expected; live unverified. |
| `Weather_Advisory` | Advisory ID/date, district/crop, English/Malayalam advisory text, source/link, status and update fields accepted by existing aliases. | Current verified advisories and scheme-topic search; read-only. | District/crop relevance. | Existing expected; locally verified; live unverified. |
| `Commodity_Master` | `Commodity_ID`, `BhoomiMitra_Name`, `AGMARKNET_Name` plus supported aliases. | Commodity resolution; read-only. | Maps farmer text to market records. | Existing expected; live unverified. |
| `Commodity_Market` | `Commodity_ID`, `Commodity_Name`, `Market`, `Modal_Price`, `Source_Name` and existing min/max/unit/date/update fields. | Available market prices; read/write by existing updater, read-only in farmer requests. | `Commodity_ID` should match master data. | Existing expected; live unverified. Do not represent stale/missing data as live. |

## Soil, conversation and operational history tabs

Existing required tabs include `Soil_Location_Profile`, `Soil_Test_Repository`, `Soil_Recommendation_Rules`, `Soil_Data_Log`, `AI_Conversation_History`, `AI_Response_Log`, `Farmer_Queries`, and `AI_Memory`. Their audited headers and positions remain unchanged. `Soil_Location_Profile` is now read by header across A:AK, including `Soil_Profile_ID`, coordinates, location, `Soil_Texture`, `Predicted_pH`, carbon, nitrogen and remarks. Phosphorus and potassium remain unavailable when those headers are absent; the application does not fabricate them. The three AI/query writers now map values to the audited production header rows and fail closed on missing or duplicate required headers.

## Feature-announcement persistence

No Google Sheet tab or column is required. On Render/production, automatic delivery and dismissal state uses Upstash Redis REST with atomic claims and HMAC-SHA256 opaque keys. `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` and an independent `STATE_HMAC_SECRET` of at least 32 characters are required together. Explicit What's New menu requests remain repeatable.

The same Redis service provides the seven-day completed-message webhook deduplication ledger. Production fails closed when durable storage is absent or unavailable and never silently falls back to Render's ephemeral filesystem. The companion JSON files remain available only for local development and automated tests. Do not add a `Feature_Announcements` tab for V1.

## Manual readiness actions

- Run `node scripts/audit-google-sheet-readonly.js` only with explicit live read-only authorisation; do not use edit scopes for the audit.
- Confirm every required tab/header and review duplicate IDs, blank ownership keys and position-sensitive legacy layouts.
- Confirm `Land_Parcels` has a numeric area value in one supported area column before expecting a unit-bearing display; missing/invalid values now display `-` and are not invented.
- Configure approved policy URL and organisation contact with `BHOOMIMITRA_POLICY_URL` and `BHOOMIMITRA_ORGANISATION_CONTACT`.
- Configure `KVK_TRAINING_ALERT_WHATSAPP` only with the authorised training-coordinator destination. A blank value safely disables the alert without affecting the saved request.
- Do not provision, rename, reorder, backfill or delete production data from this checklist without separate approval and backup.

## V1 About BhoomiMitra and Our Team readiness

These are public informational surfaces only. They do not read or write Google Sheets, change operational coordinator assignments, or replace the `Expert_Directory`.

| Status | Public profile | Designation | Project role |
|---|---|---|---|
| `NOT TESTED` | Dr. C. P. Robert | Senior Scientist & Head | Project Director & Strategic Leadership |
| `NOT TESTED` | Dr. Sindhu Sadanandan | Subject Matter Specialist – Agricultural Extension | Project Coordinator & Farmer Outreach |
| `NOT TESTED` | Sri Binu John | Programme Assistant (Computer) | Digital Operations & Training Coordination |
| `NOT TESTED` | Smt. Gayathri | Programme Assistant (Lab) | Field Coordination & Farmer Engagement |
| `NOT TESTED` | Dr. Vinod Mathew | Subject Matter Specialist – Agronomy | Crop Production & Nutrient Management |
| `NOT TESTED` | Dr. Rincy K. Abraham | Subject Matter Specialist – Horticulture | Horticultural Crops & Orchard Advisory |
| `NOT TESTED` | Dr. Sency Mathew | Subject Matter Specialist – Animal Science | Livestock, Poultry & Veterinary Advisory Coordination |
| `NOT TESTED` | Dr. Alex John | Subject Matter Specialist – Plant Protection | Crop Health & Pest-Disease Management |
| `NOT TESTED` | Dr. Shana Harshan | Subject Matter Specialist – Home Science | Value Addition & Agri-Enterprise Development |
| `NOT TESTED` | Smt. Ambily Varughese | Farm Manager | Farm Operations & Technology Demonstration |

- [ ] `NOT TESTED` — Confirm the approved “A Project of ICAR–Krishi Vigyan Kendra, CARD, Pathanamthitta” wording is rendered correctly in the deployed WhatsApp UI.
- [ ] `NOT TESTED` — Confirm the approved “Powered by IlumiVision” attribution is displayed with capital V and without an added IlumiVision logo.
- [ ] `NOT TESTED` — Verify `My BhoomiMitra → About BhoomiMitra → Our Team` in English and Malayalam, including pagination, every member profile, Back, and Main Menu.
- [ ] `NOT TESTED` — Have authorised KVK staff verify every public name, designation, project role, and responsibility summary against the approved ten-member list.
- [ ] `NOT TESTED` — Confirm the public directory does not change the operational training routing to Dr. Sindhu Sadanandan – KVK Administration and Sri Binu John – Training Coordination.
