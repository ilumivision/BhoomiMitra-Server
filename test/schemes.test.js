"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createBhoomiMitraUI } = require("../utils/bhoomiMitraUI");
const {
  SCHEME_ACTION_IDS,
  SCHEME_DYNAMIC_PREFIXES,
  activeSchemes,
  buildAdvisoryText,
  buildFarmerSchemeProfile,
  buildSchemeDetails,
  buildSchemeListRows,
  buildSchemeSearchRows,
  currentAdvisories,
  filterSchemesByCategory,
  filterSchemesByGovernment,
  findScheme,
  parseSchemeAction,
  readSchemeInterests,
  relevantSchemes,
  saveSchemeInterest,
  schemeFreshnessText,
  searchAdvisories,
  searchSchemes
} = require("../utils/schemes");

const NOW = new Date("2026-10-17T00:00:00.000Z");

const SCHEME_HEADERS = [
  "Scheme_ID", "Scheme_Name", "Department", "Government", "Category",
  "Eligibility", "Benefit", "Financial_Assistance", "Documents_Required",
  "Application_Mode", "Application_Link", "Contact_Office", "District",
  "Last_Date", "Status", "Source", "Last_Updated", "Remarks"
];

const REQUEST_HEADERS = [
  "Request_ID", "Request_Date", "BM_ID", "Farmer_ID", "Farmer_Name",
  "Mobile_No", "District", "Block", "Panchayath", "Ward", "Village",
  "Request_Category", "Service_Type", "Crop/Enterprise", "Request_Description",
  "Priority", "Preferred_Date", "Assigned_To", "Assigned_To_Name",
  "Assigned_To_Date", "Status", "Completion_Date", "Service Fee", "Platform Fee",
  "Farmer Rating", "Feedback", "Follow_up_Required", "Follow_Up_Date", "Closed_by",
  "Remarks"
];

const ADVISORY_HEADERS = [
  "Advisory_ID", "Date", "District", "Block", "Panchayat", "Village", "Crop",
  "Crop_Stage", "Weather_Type", "Weather_Condition", "Temperature_Min",
  "Temperature_Max", "Rainfall_mm", "Humidity", "Wind_Speed", "Alert_Level",
  "Advisory_Title", "Advisory_Message", "Source", "Generated_By", "Language",
  "Status", "Created_On", "Updated_On"
];

function rowFrom(headers, values) {
  return headers.map(function (header) {
    return values && values[header] != null ? values[header] : "";
  });
}

function value(row, headers, name) {
  return row[headers.indexOf(name)];
}

function sampleSchemes() {
  return [
    SCHEME_HEADERS,
    rowFrom(SCHEME_HEADERS, {
      Scheme_ID: "SCH-001",
      Scheme_Name: "Coconut Replanting Support",
      Department: "Agriculture Department",
      Government: "Kerala",
      Category: "Crop Subsidy",
      Eligibility: "Coconut farmers subject to department verification",
      Benefit: "Replanting support as per current department norms",
      Financial_Assistance: "See official notification",
      Documents_Required: "As listed in the official notification",
      Application_Mode: "Contact Krishi Bhavan",
      Application_Link: "https://example.gov.in/coconut",
      Contact_Office: "Krishi Bhavan",
      District: "Kerala",
      Last_Date: "31-12-2026",
      Status: "Active",
      Source: "Agriculture Department",
      Last_Updated: "01-10-2026"
    }),
    rowFrom(SCHEME_HEADERS, {
      Scheme_ID: "SCH-002",
      Scheme_Name: "Dairy Development Assistance",
      Department: "Dairy Development Department",
      Government: "Kerala",
      Category: "Livestock Financial Support",
      Eligibility: "Eligible dairy farmers after verification",
      Benefit: "Support described in the official programme record",
      Application_Mode: "Contact Dairy Extension Office",
      District: "Pathanamthitta",
      Last_Date: "Ongoing",
      Status: "Open",
      Source: "Dairy Development Department"
    }),
    rowFrom(SCHEME_HEADERS, {
      Scheme_ID: "SCH-003",
      Scheme_Name: "Drip Irrigation Subsidy",
      Department: "Agriculture Department",
      Category: "Farm Machinery and Irrigation Subsidy",
      Eligibility: "Farmers meeting current programme rules",
      Benefit: "Subsidy subject to official approval",
      District: "Kerala",
      Last_Date: "01-09-2026",
      Status: "Active"
    }),
    rowFrom(SCHEME_HEADERS, {
      Scheme_ID: "SCH-004",
      Scheme_Name: "Old Crop Insurance",
      Department: "Agriculture Department",
      Category: "Insurance",
      District: "Kerala",
      Status: "Inactive"
    })
  ];
}

function makeUiHarness() {
  const calls = [];
  return {
    calls: calls,
    ui: createBhoomiMitraUI({
      axios: {
        post: async function (url, body) {
          calls.push({ url: url, body: body });
          return { data: { messages: [{ id: "wamid.scheme" }] } };
        }
      },
      phoneNumberId: "phone-id",
      whatsappToken: "token"
    })
  };
}

test("view active schemes excludes expired and inactive records", function () {
  const active = activeSchemes(sampleSchemes(), NOW);
  assert.deepEqual(active.map(function (scheme) { return scheme.id; }), ["SCH-001", "SCH-002"]);
  const listRows = buildSchemeListRows(active);
  assert.equal(listRows.length, 2);
  assert.equal(parseSchemeAction(listRows[0].id).action, "VIEW");
  assert.doesNotMatch(listRows[0].title, /SCH-001/);
});

test("Relevant Schemes for Me uses stored crop and district as cautious ranking signals", function () {
  const relevant = relevantSchemes(activeSchemes(sampleSchemes(), NOW), {
    district: "Pathanamthitta",
    mainCrop: "Coconut"
  });
  assert.equal(relevant[0].id, "SCH-001");
  assert.ok(relevant.some(function (scheme) { return scheme.id === "SCH-002"; }));
});

test("crop livestock machinery financial and insurance category filters use record text", function () {
  const schemes = activeSchemes(sampleSchemes(), NOW);
  assert.deepEqual(filterSchemesByCategory(schemes, "CROP").map(function (s) { return s.id; }), ["SCH-001"]);
  assert.deepEqual(filterSchemesByCategory(schemes, "LIVESTOCK").map(function (s) { return s.id; }), ["SCH-002"]);
  assert.deepEqual(filterSchemesByCategory(schemes, "FINANCIAL").map(function (s) { return s.id; }), ["SCH-001", "SCH-002"]);
  assert.deepEqual(filterSchemesByCategory(activeSchemes(sampleSchemes(), new Date("2026-08-01")), "MACHINERY").map(function (s) { return s.id; }), ["SCH-003"]);
});

test("fisheries enterprise and government-level filters use verified record fields", function () {
  const records = [
    { id: "FISH", name: "Aquaculture support", category: "Fisheries", government: "Kerala" },
    { id: "ENT", name: "Farm startup support", category: "Agricultural Enterprise", government: "Central" }
  ];

  assert.deepEqual(filterSchemesByCategory(records, "FISHERIES").map(function (item) { return item.id; }), ["FISH"]);
  assert.deepEqual(filterSchemesByCategory(records, "ENTERPRISE").map(function (item) { return item.id; }), ["ENT"]);
  assert.deepEqual(filterSchemesByGovernment(records, "Kerala").map(function (item) { return item.id; }), ["FISH"]);
  assert.deepEqual(filterSchemesByGovernment(records, "Central").map(function (item) { return item.id; }), ["ENT"]);
});

test("scheme details show only stored facts official link and eligibility warning", function () {
  const scheme = findScheme(sampleSchemes(), "SCH-001");
  const details = buildSchemeDetails(scheme, "English", true);
  assert.match(details, /Scheme Details/);
  assert.match(details, /Agriculture Department/);
  assert.match(details, /Purpose:/);
  assert.match(details, /Last updated: 01-10-2026/);
  assert.match(details, /https:\/\/example\.gov\.in\/coconut/);
  assert.match(details, /Verify current eligibility/);
  assert.doesNotMatch(details, /SCH-001/);
});

test("Interested request stores registered farmer identity by existing Service_Request headers", async function () {
  const appended = [];
  const result = await saveSchemeInterest({
    farmer: {
      memberId: "BM-F-100", name: "Anu", whatsapp: "919111111111",
      district: "Pathanamthitta", panchayath: "Konni"
    },
    scheme: findScheme(sampleSchemes(), "SCH-001"),
    sourceMessageId: "wamid.scheme-interest",
    requestRows: [REQUEST_HEADERS],
    language: "English",
    now: NOW,
    appendRequest: async function (sheetName, row) {
      appended.push({ sheetName: sheetName, row: row });
      return true;
    }
  });
  assert.equal(result.success, true);
  assert.equal(appended[0].sheetName, "Service_Request");
  assert.equal(value(appended[0].row, REQUEST_HEADERS, "Farmer_ID"), "BM-F-100");
  assert.equal(value(appended[0].row, REQUEST_HEADERS, "Request_Category"), "Scheme Interest");
  assert.equal(value(appended[0].row, REQUEST_HEADERS, "Service_Type"), "SCH-001");
  assert.equal(value(appended[0].row, REQUEST_HEADERS, "Status"), "Interested");
  assert.match(value(appended[0].row, REQUEST_HEADERS, "Remarks"), /Request Type: Interested/);
  assert.match(value(appended[0].row, REQUEST_HEADERS, "Remarks"), /Preferred Language: English/);
});

test("Help Requested and duplicate scheme interest behavior are explicit", async function () {
  let appendCount = 0;
  const existing = rowFrom(REQUEST_HEADERS, {
    Request_ID: "BM-SCH-OLD",
    Farmer_ID: "BM-F-100",
    Request_Category: "Scheme Interest",
    Service_Type: "SCH-001",
    Request_Description: "Coconut Replanting Support",
    Status: "Interested"
  });
  const duplicate = await saveSchemeInterest({
    farmer: { memberId: "BM-F-100" },
    scheme: findScheme(sampleSchemes(), "SCH-001"),
    requestRows: [REQUEST_HEADERS, existing],
    sourceMessageId: "wamid.duplicate-interest",
    appendRequest: async function () { appendCount += 1; return true; }
  });
  const help = await saveSchemeInterest({
    farmer: { memberId: "BM-F-100" },
    scheme: findScheme(sampleSchemes(), "SCH-001"),
    helpRequested: true,
    requestRows: [REQUEST_HEADERS, existing],
    sourceMessageId: "wamid.help-request",
    appendRequest: async function () { appendCount += 1; return true; }
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(help.status, "Help Requested");
  assert.equal(appendCount, 1);
});

test("My Scheme Interests returns only the inbound farmer's records", function () {
  const rows = [
    REQUEST_HEADERS,
    rowFrom(REQUEST_HEADERS, {
      Request_ID: "A", Request_Date: "2026-10-17T00:00:00Z", Farmer_ID: "BM-F-100",
      Request_Category: "Scheme Interest", Service_Type: "SCH-001",
      Request_Description: "Coconut Replanting Support", Status: "Interested"
    }),
    rowFrom(REQUEST_HEADERS, {
      Request_ID: "B", Request_Date: "2026-10-17T00:00:00Z", Farmer_ID: "BM-F-200",
      Request_Category: "Scheme Interest", Service_Type: "SCH-002",
      Request_Description: "Dairy Development Assistance", Status: "Help Requested"
    })
  ];
  const mine = readSchemeInterests(rows, "BM-F-100");
  assert.equal(mine.length, 1);
  assert.equal(mine[0].schemeName, "Coconut Replanting Support");
});

test("typed topic search ranks matching active scheme records", function () {
  const matches = searchSchemes(activeSchemes(sampleSchemes(), new Date("2026-08-01")), "drip irrigation subsidy");
  assert.equal(matches[0].id, "SCH-003");
});

test("transcribed voice topic uses the same active-record search", function () {
  const transcribedVoice = "dairy scheme";
  const matches = searchSchemes(activeSchemes(sampleSchemes(), NOW), transcribedVoice);
  assert.equal(matches[0].id, "SCH-002");
});

test("English schemes UI is click-first and carries no typed scheme IDs", async function () {
  const harness = makeUiHarness();
  const scheme = findScheme(sampleSchemes(), "SCH-001");
  await harness.ui.sendMainMenu("919111111111", "English");
  await harness.ui.sendExpertMenu("919111111111", "English");
  await harness.ui.sendSchemesMenu("919111111111", "English");
  await harness.ui.sendSchemeDetails("919111111111", "English", buildSchemeDetails(scheme, "English"), scheme.id, false);
  const mainRows = harness.calls[0].body.interactive.action.sections[0].rows;
  const expertRows = harness.calls[1].body.interactive.action.sections[0].rows;
  const menuRows = harness.calls[2].body.interactive.action.sections[0].rows;
  const detailActions = harness.calls[3].body.interactive.action.sections[0].rows;
  assert.equal(mainRows.length, 5);
  assert.ok(expertRows.some(function (row) { return row.id === SCHEME_ACTION_IDS.OPEN; }));
  assert.equal(menuRows.length, 9);
  assert.ok(menuRows.some(function (row) { return row.id === SCHEME_ACTION_IDS.FISHERIES; }));
  assert.ok(menuRows.some(function (row) { return row.id === SCHEME_ACTION_IDS.ENTERPRISE; }));
  assert.equal(detailActions.length, 4);
  assert.ok(detailActions.some(function (row) {
    return row.id === SCHEME_DYNAMIC_PREFIXES.INTEREST + scheme.id;
  }));
  assert.ok(detailActions.some(function (row) {
    return row.id === SCHEME_DYNAMIC_PREFIXES.HELP + scheme.id;
  }));
  assert.ok(detailActions.some(function (row) {
    return row.id === SCHEME_ACTION_IDS.OPEN;
  }));
});

test("Malayalam schemes menus details and interests use localized labels", async function () {
  const harness = makeUiHarness();
  const scheme = findScheme(sampleSchemes(), "SCH-001");
  await harness.ui.sendSchemesMenu("919111111111", "Malayalam");
  await harness.ui.sendSchemeDetails("919111111111", "Malayalam", buildSchemeDetails(scheme, "Malayalam"), scheme.id, false);
  await harness.ui.sendSchemeInterestConfirmation("919111111111", "Malayalam", scheme, "Interested", false);
  assert.match(harness.calls[0].body.interactive.body.text, /സർക്കാർ പദ്ധതികളും/);
  assert.match(harness.calls[1].body.interactive.body.text, /പദ്ധതി വിവരങ്ങൾ/);
  assert.match(harness.calls[2].body.interactive.body.text, /താൽപര്യം രേഖപ്പെടുത്തി/);
});

test("expired inactive and blank-status schemes are never treated as active", function () {
  const rows = sampleSchemes();
  rows.push(rowFrom(SCHEME_HEADERS, {
    Scheme_ID: "SCH-005", Scheme_Name: "Unknown Status Scheme", Status: ""
  }));
  rows.push(rowFrom(SCHEME_HEADERS, {
    Scheme_ID: "SCH-006", Scheme_Name: "Malformed Deadline Scheme",
    Last_Date: "not-a-date", Status: "Active"
  }));
  const ids = activeSchemes(rows, NOW).map(function (scheme) { return scheme.id; });
  assert.equal(ids.includes("SCH-003"), false);
  assert.equal(ids.includes("SCH-004"), false);
  assert.equal(ids.includes("SCH-005"), false);
  assert.equal(ids.includes("SCH-006"), false);
});

test("missing or invalid scheme record fails safely", async function () {
  let appendCount = 0;
  const result = await saveSchemeInterest({
    farmer: { memberId: "BM-F-100" },
    scheme: {},
    requestRows: [REQUEST_HEADERS],
    appendRequest: async function () { appendCount += 1; return true; }
  });
  assert.equal(findScheme(sampleSchemes(), "SCH-MISSING"), null);
  assert.equal(result.success, false);
  assert.equal(result.code, "INVALID_SCHEME");
  assert.equal(appendCount, 0);
});

test("Sheet-read failure produces empty safe scheme and advisory results", function () {
  assert.deepEqual(activeSchemes([], NOW), []);
  assert.deepEqual(currentAdvisories([], {}, NOW), []);
  assert.deepEqual(searchSchemes([], "crop insurance"), []);
});

test("only recent active advisories are shown and stale records are excluded", function () {
  const rows = [
    ADVISORY_HEADERS,
    rowFrom(ADVISORY_HEADERS, {
      Advisory_ID: "WA-RECENT", Date: "12-10-2026", District: "Pathanamthitta",
      Crop: "Banana", Advisory_Title: "Field sanitation",
      Advisory_Message: "Remove damaged material and monitor the field.",
      Source: "KVK", Language: "English", Status: "Active", Updated_On: "12-10-2026"
    }),
    rowFrom(ADVISORY_HEADERS, {
      Advisory_ID: "WA-STALE", Date: "04-07-2026", District: "Pathanamthitta",
      Crop: "Banana", Advisory_Title: "Old heavy rain alert",
      Advisory_Message: "Old message", Source: "IMD", Status: "Active", Updated_On: "04-07-2026"
    })
  ];
  const current = currentAdvisories(rows, { district: "Pathanamthitta", mainCrop: "Banana" }, NOW, 14);
  assert.equal(current.length, 1);
  assert.equal(current[0].id, "WA-RECENT");
  const text = buildAdvisoryText(current, "English");
  assert.match(text, /Field sanitation/);
  assert.doesNotMatch(text, /Old heavy rain alert/);
});

test("Relevant Schemes uses registered land crop livestock irrigation and equipment context", function () {
  const landHeaders = [
    "Land_ID", "Farmer_ID", "Main_Crop", "Other_Crops",
    "Irrigation_Source", "Farm_Equipment", "Active_Status"
  ];
  const animalHeaders = ["Animal_ID", "Farmer_ID", "Animal_Type", "Active_Status"];
  const profile = buildFarmerSchemeProfile(
    { memberId: "BM-F-100", district: "Pathanamthitta", panchayath: "Konni" },
    [
      landHeaders,
      rowFrom(landHeaders, {
        Land_ID: "BM-L-1",
        Farmer_ID: "BM-F-100",
        Main_Crop: "Coconut",
        Other_Crops: "Vegetable",
        Irrigation_Source: "Drip irrigation",
        Farm_Equipment: "Power tiller",
        Active_Status: "Active"
      }),
      rowFrom(landHeaders, {
        Land_ID: "BM-L-2",
        Farmer_ID: "BM-F-200",
        Main_Crop: "Rubber",
        Active_Status: "Active"
      })
    ],
    [
      animalHeaders,
      rowFrom(animalHeaders, {
        Animal_ID: "BM-A-1",
        Farmer_ID: "BM-F-100",
        Animal_Type: "Dairy cattle",
        Active_Status: "Active"
      })
    ]
  );
  const relevant = relevantSchemes(activeSchemes(sampleSchemes(), NOW), profile);

  assert.match(profile.registeredCrops, /Coconut/);
  assert.match(profile.livestock, /Dairy cattle/);
  assert.match(profile.irrigationContext, /Drip irrigation/);
  assert.match(profile.equipmentContext, /Power tiller/);
  assert.equal(relevant[0].id, "SCH-001");
  assert.ok(relevant.some(function (scheme) { return scheme.id === "SCH-002"; }));
  assert.equal(relevantSchemes([{
    id: "SCH-LOCAL",
    name: "Konni farm support",
    district: "Konni"
  }], profile).length, 1);
});

test("scheme freshness explicitly warns when update date is missing or stale", function () {
  assert.match(
    schemeFreshnessText({}, "English", NOW),
    /Update date is not provided/
  );
  assert.match(
    schemeFreshnessText({ lastUpdated: "01-01-2025" }, "English", NOW),
    /may be stale/
  );
  assert.match(
    schemeFreshnessText({}, "Malayalam", NOW),
    /പുതുക്കിയ തീയതി ലഭ്യമല്ല/
  );
});

test("Excel serial advisory dates are parsed and stale live-style records remain excluded", function () {
  const rows = [
    ADVISORY_HEADERS,
    rowFrom(ADVISORY_HEADERS, {
      Advisory_ID: "WA-SERIAL",
      Date: 46119,
      District: "Pathanamthitta",
      Crop: "Banana",
      Advisory_Title: "Heavy Rain Alert",
      Advisory_Message: "Protect harvested produce.",
      Source: "IMD",
      Language: "Malayalam",
      Status: "Active",
      Updated_On: 46119
    })
  ];

  assert.equal(currentAdvisories(rows, { district: "Pathanamthitta" }, NOW, 14).length, 0);
  assert.equal(
    currentAdvisories(rows, { district: "Pathanamthitta" }, new Date("2026-04-10"), 14).length,
    1
  );
});

test("topic search returns clickable scheme and current-advisory records", function () {
  const advisoryRows = [
    ADVISORY_HEADERS,
    rowFrom(ADVISORY_HEADERS, {
      Advisory_ID: "WA-RAIN",
      Date: "12-10-2026",
      District: "Pathanamthitta",
      Crop: "Banana",
      Advisory_Title: "Banana rain protection",
      Advisory_Message: "Support plants before heavy rain.",
      Source: "KVK",
      Status: "Active",
      Updated_On: "12-10-2026"
    })
  ];
  const advisories = currentAdvisories(
    advisoryRows,
    { district: "Pathanamthitta", mainCrop: "Banana" },
    NOW,
    14
  );
  const advisoryMatches = searchAdvisories(advisories, "banana rain");
  const schemeMatches = searchSchemes(activeSchemes(sampleSchemes(), NOW), "coconut support");
  const rows = buildSchemeSearchRows(schemeMatches, advisoryMatches);

  assert.ok(rows.some(function (row) {
    return row.id === SCHEME_DYNAMIC_PREFIXES.VIEW + "SCH-001";
  }));
  assert.ok(rows.some(function (row) {
    return row.id === SCHEME_DYNAMIC_PREFIXES.ADVISORY_VIEW + "WA-RAIN";
  }));
  assert.deepEqual(
    parseSchemeAction(SCHEME_DYNAMIC_PREFIXES.ADVISORY_VIEW + "WA-RAIN"),
    { action: "ADVISORY_VIEW", schemeId: "WA-RAIN" }
  );
});
