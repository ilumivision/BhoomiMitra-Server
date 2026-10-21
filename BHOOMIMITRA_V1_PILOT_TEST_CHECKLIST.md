# BhoomiMitra Version 1.0.0 — controlled KVK Pathanamthitta pilot checklist

Status values: `PASS`, `FAIL`, `BLOCKED`, `NOT TESTED`.

This document does not claim that a live pilot has occurred. Every item starts as `NOT TESTED` and must be completed by authorised staff against a controlled test farmer account and approved test data. Do not use another farmer’s records.

Overall pilot coordination: **Dr. Sindhu Sadanandan**
Training coordination: **Sri Binu John**
Technology support: **Dr. Alex John**

Suggested authorised participants: Dr. C. P. Robert, Dr. Sindhu Sadanandan, Sri Binu John, Smt. Gayathri, Dr. Vinod Mathew, Dr. Rincy K. Abraham, Dr. Sency Mathew, Dr. Alex John, Dr. Shana Harshan, Smt. Ambily Varughese, and other specifically authorised staff.

## Public About and team profile verification

Institutional attribution and staff profiles require approval and verification before public deployment. The directory is informational and does not replace operational assignments or the `Expert_Directory`.

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

## Preconditions

- [ ] `NOT TESTED` — Preservation branch/commit and deployment candidate are recorded.
- [ ] `NOT TESTED` — Approved test WhatsApp numbers and test Farmer/Land/Animal records are documented.
- [ ] `NOT TESTED` — Production Sheet backup exists and the V1 schema checklist has been reviewed read-only.
- [ ] `NOT TESTED` — Approved policy URL/contact values are configured, or the pilot accepts the explicit “not configured” limitation.
- [ ] `NOT TESTED` — Optional welcome media is an approved HTTPS MP4/GIF; otherwise the URL remains blank.
- [ ] `NOT TESTED` — `KVK_TRAINING_ALERT_WHATSAPP` is blank or contains the specifically approved training-coordinator destination; no production number is used during local verification.
- [ ] `NOT TESTED` — Reminder runners, schedulers, scheme ingestion writes, broadcasts, payments and advertisements remain disabled.

## Farmer journey and safety tests

| # | Status | Test | Expected evidence |
|---:|---|---|---|
| 1 | `NOT TESTED` | New farmer registration | Guest Menu → Register → language → affirmative consent → existing-registration check → preserved Farmer ID → Main Menu. A greeting never starts registration automatically. |
| 2 | `NOT TESTED` | Returning farmer greeting | Saved language and a short Main Menu prompt only; no welcome/welcome-back copy, duplicate registration or unchanged-consent request. |
| 3 | `NOT TESTED` | Language switching | Main Menu → More Options → Change Language saves English/Malayalam through the existing preference field and menus remain navigable. |
| 4 | `NOT TESTED` | Privacy consent | I Agree writes current policy versions; Terms opens policy; Not Now does not start registration. |
| 5 | `NOT TESTED` | Text question | Meaningful agricultural question reaches normal Q&A without forced menu routing. |
| 6 | `NOT TESTED` | Voice question | Approved test voice is transcribed and handled; failure gives a safe retry message. |
| 7 | `NOT TESTED` | Photograph diagnosis | Clear test crop photo reaches existing diagnosis; no unrelated record is exposed; three accepted analyses are allowed per registered farmer per India calendar day and a fourth is declined. |
| 8 | `NOT TESTED` | Crop registration | Only an owned Land ID is selectable; one Crop ID is created; repeated submit is idempotent. |
| 9 | `NOT TESTED` | Crop history | Only the test farmer’s crop states/history appear. |
| 10 | `NOT TESTED` | Farm diary | Completed/planned operation is saved once against owned farmer/land/crop IDs. |
| 11 | `NOT TESTED` | Crop alerts | Only verified, active, current and relevant records appear; missing data is explained. |
| 12 | `NOT TESTED` | Animal registration | Existing Farmer ID is required; Animal ID is preserved; duplicate active tag is rejected. |
| 13 | `NOT TESTED` | Animal health diary | Health/vaccination/deworming record saves only for an owned Animal ID. |
| 14 | `NOT TESTED` | Veterinary expert assistance | Animal expert route uses the existing case workflow without exposing private contacts. |
| 15 | `NOT TESTED` | Animal alerts | Only verified active official records relevant to district/type appear. |
| 16 | `NOT TESTED` | Land registration and update | Existing land flow creates one Land ID. Update Land Details changes only the selected owner’s supported farm-name/main-crop/other-crops cells after confirmation; Farmer ID and Land ID never change. |
| 16A | `NOT TESTED` | Usage history and farm summary | Usage History shows only verified owned farm-operation records; Farm Summary derives counts and latest activity only from the test farmer’s existing land, crop and operation records. |
| 17 | `NOT TESTED` | GPS and boundary access | Owner/authorised user can view; other user fails closed; coordinates remain unchanged. |
| 18 | `NOT TESTED` | Satellite monitoring | Existing summary/history works for authorised land; stale/unavailable data is clearly labelled. |
| 19 | `NOT TESTED` | Weather information | District weather, rainfall and available forecast show source/freshness where present. |
| 20 | `NOT TESTED` | Soil information | Existing soil flow works unchanged and states lab-test limits. |
| 21 | `NOT TESTED` | Market information | Available AGMARKNET-backed data shows source/update; missing data is not invented. |
| 22 | `NOT TESTED` | Expert consultation | Existing case ID, assignment, farmer card, reply and follow-up work end-to-end. |
| 23 | `NOT TESTED` | Skilled workers | Existing worker search returns only intended service data. |
| 24 | `NOT TESTED` | Machinery services | Existing provider search works and offers no payment action. |
| 25 | `NOT TESTED` | Government Schemes | Categories, relevance, source, freshness, deadlines and cautious eligibility wording work. |
| 26 | `NOT TESTED` | Training programmes | Only verified upcoming programme records appear; coordinator/fee/availability are stored facts. |
| 27 | `NOT TESTED` | Training requests | Topic → format → online time when relevant → location → date → remarks → confirm; one request ID and, only after a new save, one alert to the configured authorised training coordinator. |
| 28 | `NOT TESTED` | My Records | Profile, Farmer ID, lands and animals are limited to inbound sender ownership. |
| 29 | `NOT TESTED` | Help | Concise Malayalam and English examples plus Back/Main routes work. |
| 30 | `NOT TESTED` | What’s New | The explicit What’s New action works; Try/Dismiss state survives restart through Redis. No greeting, navigation request, registration completion or ordinary answer produces an unsolicited announcement. |
| 31 | `NOT TESTED` | Back and Main Menu | Every visible menu returns correctly; no dead button, loop or stale registration state. |
| 32 | `NOT TESTED` | Error handling | Missing Sheet/tab/data/API returns cautious messages without false success or record mutation. |
| 33 | `NOT TESTED` | Data ownership and privacy | Cross-farmer land/crop/animal/case access is denied; logs contain no raw sensitive content. |
| 34 | `NOT TESTED` | Malayalam/English consistency | Stable IDs route identically; titles render and stay within WhatsApp limits. |
| 35 | `NOT TESTED` | About BhoomiMitra | My BhoomiMitra opens the bilingual identity page with the approved platform description, project institution, technology provider and Malayalam tagline. |
| 36 | `NOT TESTED` | Our Team directory | About opens a paginated directory containing exactly the 10 approved staff profiles, with no obsolete public names. |
| 37 | `NOT TESTED` | Member profile details | Every approved profile shows the verified name, designation, project role and brief responsibilities. |
| 38 | `NOT TESTED` | About/team navigation | English and Malayalam pages retain working Team, Previous/Next, Back, About and Main Menu controls within WhatsApp limits. |
| 39 | `NOT TESTED` | Institutional and staff approval | Authorised KVK staff approve public attribution and verify all names, designations, roles and responsibilities before deployment. |

## Pilot sign-off

- [ ] All failures include reproducible steps, message IDs (not message contents in general logs), affected module and data-safe remediation.
- [ ] Blocked tests identify missing schema, approved content, credentials or external-service access without claiming success.
- [ ] No live farmer data was copied into tickets, screenshots or this checklist.
- [ ] No reminder, scheduler, ingestion writer or broadcast was enabled during testing.
- [ ] Overall coordinator decision: `NOT TESTED` / `READY FOR CONTROLLED PILOT` / `NOT YET READY`.
- [ ] Date, participants and approved evidence location recorded by authorised pilot staff.
