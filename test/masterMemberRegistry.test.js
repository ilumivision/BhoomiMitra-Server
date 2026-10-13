const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PRIMARY_HEADERS,
  normalizePhone,
  upsertMasterMember
} = require("../utils/masterMemberRegistry");
const {
  FARMER_HEADER_ALIASES,
  normalizeRegistrationHeader,
  withPreferredLanguage
} = require("../utils/registrationFields");

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
