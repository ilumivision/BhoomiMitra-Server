const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PRIMARY_HEADERS,
  normalizePhone,
  upsertMasterMember,
  reconcileFarmersToMaster
} = require("../utils/masterMemberRegistry");
const {
  parseCommandLine
} = require("../scripts/reconcile-master-members");
const {
  FARMER_HEADER_ALIASES,
  normalizeRegistrationHeader,
  findFarmerPreferredLanguageColumn,
  normalizeAiLanguageChoice,
  getFarmerPreferredLanguage,
  resolveFarmerPreferredLanguageWrite,
  setFarmerPreferredLanguage,
  applyNewFarmerStatuses,
  readFarmerStatuses,
  meaningfulFarmerCrop,
  formatRegistrationServiceLine,
  formatFarmerRegistrationConfirmation,
  withPreferredLanguage
} = require("../utils/registrationFields");
const {
  normalizePreferredLanguage,
  parseLanguageSelection,
  getLanguageSelectionMessage
} = require("../utils/language");

const HEADERS = [
  "BM_ID",
  "Name",
  "Member Type",
  "mobile No",
  "WhatsApp No",
  "District",
  "Panchayath",
  "Registration Date",
  "Verification Status",
  "Active Status",
  "Source",
  "Created BY",
  "Member Since",
  "Last Updated",
  "Referral Code",
  "Membership Level",
  "Remarks",
  "Member_Type",
  "Buyer_Type",
  "Verification_Status",
  "Active_Status"
];

function columnLetterToIndex(letters) {
  let result = 0;

  for (const character of letters) {
    result =
      result * 26 +
      character.charCodeAt(0) - 64;
  }

  return result - 1;
}

function createFakeSheets(initialRows) {
  const rows = initialRows.map(function (row) {
    return row.slice();
  });
  const calls = {
    append: 0,
    batchUpdate: 0
  };

  return {
    rows,
    calls,
    client: {
      spreadsheets: {
        values: {
          async get() {
            return {
              data: {
                values: rows.map(function (row) {
                  return row.slice();
                })
              }
            };
          },
          async append(request) {
            calls.append += 1;
            rows.push(request.requestBody.values[0].slice());
          },
          async batchUpdate(request) {
            calls.batchUpdate += 1;

            request.requestBody.data.forEach(function (entry) {
              const match = entry.range.match(/!([A-Z]+)(\d+)$/);
              const columnIndex =
                columnLetterToIndex(match[1]);
              const rowIndex = Number(match[2]) - 1;

              while (rows.length <= rowIndex) {
                rows.push([]);
              }

              rows[rowIndex][columnIndex] =
                entry.values[0][0];
            });
          }
        }
      }
    }
  };
}

function makeRow(values) {
  const row = new Array(HEADERS.length).fill("");

  Object.keys(values).forEach(function (header) {
    row[HEADERS.indexOf(header)] = values[header];
  });

  return row;
}

function makeLiveFarmerLanguageHeaders() {
  const headers =
    new Array(columnLetterToIndex("BG") + 1)
      .fill("");

  headers[columnLetterToIndex("AL")] =
    "Preferred Language";
  headers[columnLetterToIndex("BG")] =
    "Preferred_Language";

  return headers;
}

const FARMER_HEADERS = [
  "Farmer_ID",
  "Name",
  "Mobile",
  "WhatsApp",
  "District",
  "Panchayath",
  "Preferred_Language"
];

function makeFarmerRow(values) {
  const row = new Array(FARMER_HEADERS.length).fill("");

  Object.keys(values).forEach(function (header) {
    row[FARMER_HEADERS.indexOf(header)] = values[header];
  });

  return row;
}

function createReconciliationSheets(farmerRows, masterRows) {
  const calls = {
    farmerReads: 0,
    masterReads: 0,
    append: 0,
    batchUpdate: 0
  };

  return {
    calls,
    client: {
      spreadsheets: {
        values: {
          async get(request) {
            if (request.range.startsWith("'Farmers'!")) {
              calls.farmerReads += 1;
              return {
                data: {
                  values: [FARMER_HEADERS, ...farmerRows]
                }
              };
            }

            calls.masterReads += 1;
            return {
              data: {
                values: masterRows || [HEADERS]
              }
            };
          },
          async append() {
            calls.append += 1;
          },
          async batchUpdate() {
            calls.batchUpdate += 1;
          }
        }
      }
    }
  };
}

function reconciliationOptions(fake, overrides) {
  return {
    sheets: fake.client,
    spreadsheetId: "test-sheet",
    farmerHeaderAliases: FARMER_HEADER_ALIASES,
    farmerId: "BM-1783517586436",
    ...(overrides || {})
  };
}

function member(overrides) {
  return {
    bmId: "BM-1700000000000",
    name: "Registered Farmer",
    memberType: "Farmer",
    mobile: "+919876543210",
    whatsapp: "919876543210",
    district: "Pathanamthitta",
    panchayath: "Example Panchayath",
    registrationDate: "2026-10-13T10:00:00.000Z",
    verificationStatus: "Approved",
    activeStatus: "Active",
    source: "WhatsApp Registration",
    lastUpdated: "2026-10-13T10:00:00.000Z",
    ...(overrides || {})
  };
}

test("normalizes Indian phone formats to the same identity", function () {
  assert.equal(
    normalizePhone("+919876543210"),
    normalizePhone("919876543210")
  );
  assert.equal(
    normalizePhone("919876543210"),
    normalizePhone("9876543210")
  );
});

test("appends one new Master row and reuses Farmer_ID as BM_ID", async function () {
  const fake = createFakeSheets([HEADERS]);
  const farmer = member();

  const result = await upsertMasterMember({
    sheets: fake.client,
    spreadsheetId: "test-sheet",
    member: farmer,
    now: farmer.lastUpdated
  });

  assert.equal(result.success, true);
  assert.equal(result.action, "appended");
  assert.equal(fake.calls.append, 1);
  assert.equal(fake.rows.length, 2);
  assert.equal(
    fake.rows[1][HEADERS.indexOf(PRIMARY_HEADERS.bmId)],
    farmer.bmId
  );
});

test("updates one phone match without creating a duplicate", async function () {
  const existing = makeRow({
    BM_ID: "BM-1700000000000",
    Name: "Old Name",
    "Member Type": "Farmer",
    "mobile No": "9876543210",
    "WhatsApp No": "+91 98765 43210"
  });
  const fake = createFakeSheets([HEADERS, existing]);
  const farmer = member();

  const first = await upsertMasterMember({
    sheets: fake.client,
    spreadsheetId: "test-sheet",
    member: farmer,
    now: farmer.lastUpdated
  });
  const second = await upsertMasterMember({
    sheets: fake.client,
    spreadsheetId: "test-sheet",
    member: farmer,
    now: farmer.lastUpdated
  });

  assert.equal(first.action, "updated");
  assert.equal(second.action, "unchanged");
  assert.equal(fake.calls.append, 0);
  assert.equal(fake.rows.length, 2);
});

test("fills a blank Master BM_ID with the existing Farmer_ID", async function () {
  const existing = makeRow({
    Name: "Existing Farmer",
    "mobile No": "9876543210"
  });
  const fake = createFakeSheets([HEADERS, existing]);
  const farmer = member();

  const result = await upsertMasterMember({
    sheets: fake.client,
    spreadsheetId: "test-sheet",
    member: farmer,
    now: farmer.lastUpdated
  });

  assert.equal(result.success, true);
  assert.equal(result.action, "updated");
  assert.equal(fake.calls.append, 0);
  assert.equal(
    fake.rows[1][HEADERS.indexOf("BM_ID")],
    farmer.bmId
  );
});

test("refuses ambiguous duplicate Master phone matches", async function () {
  const first = makeRow({
    BM_ID: "BM-1",
    "mobile No": "+919876543210"
  });
  const second = makeRow({
    BM_ID: "BM-2",
    "WhatsApp No": "9876543210"
  });
  const fake = createFakeSheets([
    HEADERS,
    first,
    second
  ]);

  const result = await upsertMasterMember({
    sheets: fake.client,
    spreadsheetId: "test-sheet",
    member: member()
  });

  assert.equal(result.success, false);
  assert.equal(result.code, "MASTER_PHONE_AMBIGUITY");
  assert.equal(fake.calls.append, 0);
  assert.equal(fake.calls.batchUpdate, 0);
});

test("refuses to overwrite a conflicting BM_ID", async function () {
  const existing = makeRow({
    BM_ID: "BM-DIFFERENT",
    "mobile No": "9876543210"
  });
  const fake = createFakeSheets([HEADERS, existing]);

  const result = await upsertMasterMember({
    sheets: fake.client,
    spreadsheetId: "test-sheet",
    member: member()
  });

  assert.equal(result.success, false);
  assert.equal(result.code, "MASTER_BM_ID_CONFLICT");
  assert.equal(result.existingBmId, "BM-DIFFERENT");
  assert.equal(result.incomingBmId, member().bmId);
  assert.equal(fake.calls.append, 0);
  assert.equal(fake.calls.batchUpdate, 0);
});

test("does not overwrite unrelated populated Master fields", async function () {
  const existing = makeRow({
    BM_ID: "BM-1700000000000",
    Name: "Old Name",
    "mobile No": "9876543210",
    "Created BY": "Administrator",
    "Member Since": "2020-01-01",
    Remarks: "Manual review note",
    Buyer_Type: "Wholesale"
  });
  const fake = createFakeSheets([HEADERS, existing]);

  const result = await upsertMasterMember({
    sheets: fake.client,
    spreadsheetId: "test-sheet",
    member: member({
      createdBy: "BhoomiMitra",
      memberSince: "2026-10-13",
      remarks: "Synced from Farmers"
    })
  });

  assert.equal(result.success, true);
  assert.equal(
    fake.rows[1][HEADERS.indexOf("Created BY")],
    "Administrator"
  );
  assert.equal(
    fake.rows[1][HEADERS.indexOf("Member Since")],
    "2020-01-01"
  );
  assert.equal(
    fake.rows[1][HEADERS.indexOf("Remarks")],
    "Manual review note"
  );
  assert.equal(
    fake.rows[1][HEADERS.indexOf("Buyer_Type")],
    "Wholesale"
  );
});

test("targets primary central headers instead of later duplicate-style headers", async function () {
  const fake = createFakeSheets([HEADERS]);

  await upsertMasterMember({
    sheets: fake.client,
    spreadsheetId: "test-sheet",
    member: member()
  });

  const row = fake.rows[1];
  assert.equal(row[HEADERS.indexOf("Member Type")], "Farmer");
  assert.equal(row[HEADERS.indexOf("Verification Status")], "Approved");
  assert.equal(row[HEADERS.indexOf("Active Status")], "Active");
  assert.equal(row[HEADERS.indexOf("Member_Type")], "");
  assert.equal(row[HEADERS.indexOf("Verification_Status")], "");
  assert.equal(row[HEADERS.indexOf("Active_Status")], "");
});

test("refuses a partial sync when only later duplicate-style status headers exist", async function () {
  const incompleteHeaders = HEADERS.filter(function (header) {
    return ![
      "Verification Status",
      "Active Status"
    ].includes(header);
  });
  const fake = createFakeSheets([incompleteHeaders]);

  const result = await upsertMasterMember({
    sheets: fake.client,
    spreadsheetId: "test-sheet",
    member: member()
  });

  assert.equal(result.success, false);
  assert.equal(
    result.code,
    "MASTER_PRIMARY_HEADERS_MISSING"
  );
  assert.deepEqual(
    result.missingHeaders,
    ["verificationStatus", "activeStatus"]
  );
  assert.equal(fake.calls.append, 0);
});

test("accepts current live Farmers header aliases", function () {
  const cases = [
    [FARMER_HEADER_ALIASES.whatsappHeaders, "WhatApp"],
    [FARMER_HEADER_ALIASES.districtHeaders, "Distrct"],
    [
      FARMER_HEADER_ALIASES.aiRegistrationHeaders,
      "AI_Registration_Source"
    ],
    [
      FARMER_HEADER_ALIASES.languageHeaders,
      "Prefered Language"
    ]
  ];

  for (const [aliases, header] of cases) {
    const normalizedHeader =
      normalizeRegistrationHeader(header);

    assert.equal(
      aliases.some(function (alias) {
        return (
          normalizeRegistrationHeader(alias) ===
          normalizedHeader
        );
      }),
      true
    );
  }
});

test("preserves the selected WhatsApp language in registration data", function () {
  assert.equal(
    withPreferredLanguage(
      { category: "farmer" },
      "Malayalam"
    ).preferredLanguage,
    "Malayalam"
  );

  assert.equal(
    withPreferredLanguage(
      {
        category: "farmer",
        preferredLanguage: "English"
      },
      "Malayalam"
    ).preferredLanguage,
    "English"
  );
});

test("prioritizes exact Preferred_Language even when it appears later", function () {
  const headers = makeLiveFarmerLanguageHeaders();

  assert.equal(
    findFarmerPreferredLanguageColumn(headers),
    columnLetterToIndex("BG")
  );
});

test("falls back through legacy preferred-language headers in order", function () {
  assert.equal(
    findFarmerPreferredLanguageColumn([
      "Prefered Language",
      "Preferred Language"
    ]),
    1
  );
  assert.equal(
    findFarmerPreferredLanguageColumn([
      "Name",
      "Prefered Language"
    ]),
    1
  );
});

test("initial Farmer registration writes English only to Preferred_Language", function () {
  const headers = makeLiveFarmerLanguageHeaders();
  const row = new Array(headers.length).fill("");

  assert.equal(
    setFarmerPreferredLanguage(row, headers, "English"),
    true
  );
  assert.equal(
    row[columnLetterToIndex("AL")],
    ""
  );
  assert.equal(
    row[columnLetterToIndex("BG")],
    "English"
  );
});

test("initial Farmer registration writes Malayalam only to Preferred_Language", function () {
  const headers = makeLiveFarmerLanguageHeaders();
  const row = new Array(headers.length).fill("");

  assert.equal(
    setFarmerPreferredLanguage(row, headers, "Malayalam"),
    true
  );
  assert.equal(
    row[columnLetterToIndex("AL")],
    ""
  );
  assert.equal(
    row[columnLetterToIndex("BG")],
    "Malayalam"
  );
});

test("language updates select the canonical Preferred_Language column", function () {
  const headers = makeLiveFarmerLanguageHeaders();

  assert.deepEqual(
    resolveFarmerPreferredLanguageWrite(
      headers,
      "Malayalam"
    ),
    {
      index: columnLetterToIndex("BG"),
      value: "Malayalam"
    }
  );
});

test("WhatsApp AI language choices are limited to English and Malayalam", function () {
  assert.equal(parseLanguageSelection("English"), "English");
  assert.equal(parseLanguageSelection("Malayalam"), "Malayalam");
  assert.equal(parseLanguageSelection("1"), "English");
  assert.equal(parseLanguageSelection("2"), "Malayalam");

  for (const value of [
    "Bilingual",
    "Both",
    "English + Malayalam",
    "3"
  ]) {
    assert.equal(parseLanguageSelection(value), "");
    assert.equal(normalizeAiLanguageChoice(value), "");
  }

  const selectionMessage =
    getLanguageSelectionMessage("English");

  assert.equal(
    selectionMessage.includes("English +"),
    false
  );
  assert.equal(
    selectionMessage.includes("1, 2 or 3"),
    false
  );
});

test("keeps existing Bilingual Sheet values read-compatible without writing them", function () {
  const headers = [
    "Preferred Language",
    "Preferred_Language"
  ];
  const row = ["English", "Bilingual"];

  assert.equal(
    getFarmerPreferredLanguage(row, headers),
    "Bilingual"
  );
  assert.equal(
    normalizePreferredLanguage("Bilingual"),
    "Bilingual"
  );
  assert.equal(
    setFarmerPreferredLanguage(row, headers, "Bilingual"),
    false
  );
  assert.equal(
    resolveFarmerPreferredLanguageWrite(
      headers,
      "Bilingual"
    ),
    null
  );
  assert.equal(
    withPreferredLanguage({
      preferredLanguage: "Bilingual"
    }).preferredLanguage,
    ""
  );
  assert.deepEqual(row, ["English", "Bilingual"]);
});

test("ignores blank headers even when their columns have dropdown validation", function () {
  const headers = makeLiveFarmerLanguageHeaders();
  headers.push("", "", "");

  assert.equal(
    findFarmerPreferredLanguageColumn(headers),
    columnLetterToIndex("BG")
  );
});

test("reconciliation targets an exact Farmer_ID match only", async function () {
  const fake = createReconciliationSheets([
    makeFarmerRow({
      Farmer_ID: "BM-OTHER",
      Mobile: "9000000000"
    }),
    makeFarmerRow({
      Farmer_ID: "BM-1783517586436",
      Name: "Target Farmer",
      Mobile: "9876543210"
    })
  ]);

  const result = await reconcileFarmersToMaster(
    reconciliationOptions(fake)
  );

  assert.equal(result.success, true);
  assert.equal(result.farmerId, "BM-1783517586436");
  assert.equal(result.processed, 1);
  assert.equal(result.appended, 1);
  assert.equal(fake.calls.masterReads, 1);
  assert.equal(fake.calls.append, 0);
});

test("reconciliation trims Farmer_ID input and Sheet values", async function () {
  const fake = createReconciliationSheets([
    makeFarmerRow({
      Farmer_ID: "  BM-1783517586436  ",
      Mobile: "9876543210"
    })
  ]);

  const result = await reconcileFarmersToMaster(
    reconciliationOptions(fake, {
      farmerId: "  BM-1783517586436  "
    })
  );

  assert.equal(result.success, true);
  assert.equal(result.processed, 1);
});

test("reconciliation refuses a missing Farmer_ID before any Master action", async function () {
  const fake = createReconciliationSheets([
    makeFarmerRow({
      Farmer_ID: "BM-OTHER",
      Mobile: "9000000000"
    })
  ]);

  const result = await reconcileFarmersToMaster(
    reconciliationOptions(fake)
  );

  assert.equal(result.success, false);
  assert.equal(result.code, "FARMER_NOT_FOUND");
  assert.equal(fake.calls.masterReads, 0);
  assert.equal(fake.calls.append, 0);
  assert.equal(fake.calls.batchUpdate, 0);
});

test("reconciliation refuses duplicate identical Farmer_ID rows", async function () {
  const fake = createReconciliationSheets([
    makeFarmerRow({
      Farmer_ID: "BM-1783517586436",
      Mobile: "9876543210"
    }),
    makeFarmerRow({
      Farmer_ID: " BM-1783517586436 ",
      Mobile: "9123456780"
    })
  ]);

  const result = await reconcileFarmersToMaster(
    reconciliationOptions(fake)
  );

  assert.equal(result.success, false);
  assert.equal(result.code, "FARMER_ID_AMBIGUITY");
  assert.equal(result.matchCount, 2);
  assert.deepEqual(result.rowNumbers, [2, 3]);
  assert.equal(fake.calls.masterReads, 0);
  assert.equal(fake.calls.append, 0);
  assert.equal(fake.calls.batchUpdate, 0);
});

test("targeted reconciliation has no effect on unrelated Farmer rows", async function () {
  const fake = createReconciliationSheets([
    makeFarmerRow({
      Farmer_ID: "BM-UNRELATED-1",
      Mobile: "9000000001"
    }),
    makeFarmerRow({
      Farmer_ID: "BM-1783517586436",
      Mobile: "9876543210"
    }),
    makeFarmerRow({
      Farmer_ID: "BM-UNRELATED-2",
      Mobile: "9000000002"
    })
  ]);

  const result = await reconcileFarmersToMaster(
    reconciliationOptions(fake)
  );

  assert.equal(result.processed, 1);
  assert.equal(result.skipped, 0);
  assert.equal(fake.calls.masterReads, 1);
});

test("targeted CLI remains dry-run unless --execute is present", async function () {
  const dryRunCli = parseCommandLine([
    "--farmer-id",
    " BM-1783517586436 "
  ]);
  const executeCli = parseCommandLine([
    "--farmer-id",
    "BM-1783517586436",
    "--execute"
  ]);

  assert.deepEqual(dryRunCli, {
    execute: false,
    dryRun: true,
    farmerId: "BM-1783517586436"
  });
  assert.deepEqual(executeCli, {
    execute: true,
    dryRun: false,
    farmerId: "BM-1783517586436"
  });

  const dryRunFake = createReconciliationSheets([
    makeFarmerRow({
      Farmer_ID: "BM-1783517586436",
      Mobile: "9876543210"
    })
  ]);
  const executeFake = createReconciliationSheets([
    makeFarmerRow({
      Farmer_ID: "BM-1783517586436",
      Mobile: "9876543210"
    })
  ]);

  await reconcileFarmersToMaster(
    reconciliationOptions(dryRunFake, dryRunCli)
  );
  await reconcileFarmersToMaster(
    reconciliationOptions(executeFake, executeCli)
  );

  assert.equal(dryRunFake.calls.append, 0);
  assert.equal(executeFake.calls.append, 1);
});

test("targeted CLI refuses a missing Farmer_ID value", function () {
  assert.throws(
    function () {
      parseCommandLine([
        "--farmer-id",
        "--execute"
      ]);
    },
    /requires a Farmer_ID value/
  );
});

function farmerConfirmationResult(overrides) {
  return {
    category: "farmer",
    memberId: "BM-1783517586436",
    name: "Test Farmer",
    mobile: "9876543210",
    whatsapp: "919876543210",
    district: "Kottayam",
    panchayath: "Example Panchayath",
    registrationStatus: "Registered",
    verificationStatus: "Pending",
    activeStatus: "Active",
    ...(overrides || {})
  };
}

test("Farmer confirmation hides WhatsApp registration source placeholders", function () {
  const message = formatFarmerRegistrationConfirmation({
    result: farmerConfirmationResult({
      service: "WhatsApp Registration"
    }),
    language: "English",
    existing: true
  });

  assert.equal(message.includes("WhatsApp Registration"), false);
  assert.equal(message.includes("Expertise/Skill/Service"), false);
  assert.equal(message.includes("Main Crop:"), false);
  assert.equal(meaningfulFarmerCrop("WhatsApp"), "");
  assert.equal(
    meaningfulFarmerCrop("Registered via WhatsApp"),
    ""
  );
});

test("Farmer confirmation displays a meaningful Main Crop", function () {
  const message = formatFarmerRegistrationConfirmation({
    result: farmerConfirmationResult({
      service: "Coconut"
    }),
    language: "English",
    existing: true
  });

  assert.equal(message.includes("Main Crop: Coconut"), true);
  assert.equal(message.includes("Expertise/Skill/Service"), false);
});

test("Farmer confirmation omits the crop line when no meaningful value exists", function () {
  const message = formatFarmerRegistrationConfirmation({
    result: farmerConfirmationResult({
      service: ""
    }),
    language: "English",
    existing: false
  });

  assert.equal(message.includes("Main Crop:"), false);
  assert.equal(message.includes("Expertise/Skill/Service"), false);
});

test("new Farmer status fields are Registered, Pending, and Active", function () {
  const headers = [
    "Status",
    "Verification_Status",
    "Active_Status"
  ];
  const row = ["", "", ""];

  applyNewFarmerStatuses(row, headers);

  assert.deepEqual(row, [
    "Registered",
    "Pending",
    "Active"
  ]);
});

test("new Farmer status defaults preserve meaningful verification and activity states", function () {
  const headers = [
    "Status",
    "Verification_Status",
    "Active_Status"
  ];
  const row = ["", "Verified", "Suspended"];

  applyNewFarmerStatuses(row, headers);

  assert.deepEqual(row, [
    "Registered",
    "Verified",
    "Suspended"
  ]);
});

test("explicit Pending registration is not overwritten merely because Farmer_ID exists", function () {
  const headers = [
    "Farmer_ID",
    "Status",
    "Verification_Status",
    "Active_Status"
  ];
  const row = [
    "BM-1783517586436",
    "Pending",
    "Pending",
    "Suspended"
  ];

  assert.deepEqual(
    readFarmerStatuses(
      row,
      headers,
      row[0]
    ),
    {
      registrationStatus: "Pending",
      verificationStatus: "Pending",
      activeStatus: "Suspended"
    }
  );
});

test("English Farmer confirmation separates registration and verification", function () {
  const message = formatFarmerRegistrationConfirmation({
    result: farmerConfirmationResult(),
    language: "English",
    existing: true
  });

  assert.equal(
    message.includes("already registered in BhoomiMitra as a Farmer"),
    true
  );
  assert.equal(
    message.includes("Registration Status: Registered"),
    true
  );
  assert.equal(message.includes("Verification: Pending"), true);
  assert.equal(message.includes("Status: Pending"), false);
});

test("Malayalam Farmer confirmation separates registration and verification", function () {
  const message = formatFarmerRegistrationConfirmation({
    result: farmerConfirmationResult({
      service: "തെങ്ങ്"
    }),
    language: "Malayalam",
    existing: true
  });

  assert.equal(message.includes("കർഷകനായി രജിസ്റ്റർ ചെയ്തിട്ടുണ്ട്"), true);
  assert.equal(message.includes("പ്രധാന വിള: തെങ്ങ്"), true);
  assert.equal(message.includes("രജിസ്ട്രേഷൻ നില: രജിസ്റ്റർ ചെയ്തു"), true);
  assert.equal(message.includes("പരിശോധന: കാത്തിരിക്കുന്നു"), true);
});

test("Expert and other category service display remains unchanged", function () {
  assert.equal(
    formatRegistrationServiceLine(
      "expert",
      "Plant Pathology",
      "English"
    ),
    "\nExpertise/Skill/Service: Plant Pathology"
  );
  assert.equal(
    formatRegistrationServiceLine(
      "service_provider",
      "Tractor Service",
      "English"
    ),
    "\nExpertise/Skill/Service: Tractor Service"
  );
});
