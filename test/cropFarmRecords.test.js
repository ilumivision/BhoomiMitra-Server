"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createBhoomiMitraUI } = require("../utils/bhoomiMitraUI");
const {
  CROP_FARM_ACTION_IDS,
  CROP_FARM_PREFIXES,
  CROP_HEADERS,
  CROP_HISTORY_HEADERS,
  CROP_HISTORY_SHEET,
  CROP_SHEET,
  OPERATION_HEADERS,
  OPERATION_SHEET,
  VERIFIED_ALERT_HEADERS,
  appendCropStatus,
  buildMyFarmAlerts,
  cropRowsForOperation,
  cropRowsForStatus,
  formatCropSummary,
  formatFarmAlerts,
  formatOperationSummary,
  isCurrentCrop,
  landRowsForAction,
  latestCropStates,
  operationTypeRows,
  parseCropFarmAction,
  parseCropFarmNaturalLanguage,
  parseCropRegistrationDetails,
  parseCropStatusDetails,
  parseOperationDetails,
  readCropHistory,
  readCrops,
  readFarmOperations,
  readVerifiedAlerts,
  recordFarmOperation,
  registerCrop,
  relevantOperations,
  rowFromHeaders
} = require("../utils/cropFarmRecords");
const { readVerifiedAlerts: readAlertsFromExistingModule } = require("../utils/farmAlerts");
const { isExplicitRegistrationExit } = require("../utils/registrationSession");

const NOW = new Date("2026-10-19T08:00:00.000Z");
const FARMER_ID = "BM-F-1";
const LAND = { landId: "BM-L-1", farmerId: FARMER_ID, farmName: "River Farm", district: "Pathanamthitta" };
const OTHER_LAND = { landId: "BM-L-2", farmerId: "BM-F-2", farmName: "Other Farm", district: "Kollam" };

function crop(overrides) {
  return Object.assign({
    cropId: "BM-C-ONE", farmerId: FARMER_ID, landId: LAND.landId,
    cropName: "Coconut", variety: "West Coast Tall", cropType: "Perennial",
    plantingDate: "2020-06-01", cultivatedArea: "1", areaUnit: "acre",
    cropStatus: "Active", harvestDate: "", remarks: "",
    createdAt: NOW.toISOString(), sourceMessageId: "wamid.crop.one"
  }, overrides || {});
}

function cropRow(record) {
  return rowFromHeaders(CROP_HEADERS, {
    Crop_ID: record.cropId, Farmer_ID: record.farmerId, Land_ID: record.landId,
    Crop_Name: record.cropName, Variety: record.variety, Crop_Type: record.cropType,
    Planting_Date: record.plantingDate, Cultivated_Area: record.cultivatedArea,
    Area_Unit: record.areaUnit, Crop_Status: record.cropStatus,
    Harvest_Date: record.harvestDate, Remarks: record.remarks,
    Created_At: record.createdAt, Source_Message_ID: record.sourceMessageId
  });
}

function operation(overrides) {
  return Object.assign({
    operationId: "BM-OP-ONE", farmerId: FARMER_ID, landId: LAND.landId,
    cropId: "BM-C-ONE", operationType: "Irrigation", operationDate: "2026-10-19",
    operationStatus: "Completed", inputOrMaterial: "", quantity: "", unit: "",
    cost: "", remarks: "Morning irrigation", createdAt: NOW.toISOString(),
    sourceMessageId: "wamid.operation.one"
  }, overrides || {});
}

function operationRow(record) {
  return rowFromHeaders(OPERATION_HEADERS, {
    Operation_ID: record.operationId, Farmer_ID: record.farmerId, Land_ID: record.landId,
    Crop_ID: record.cropId, Operation_Type: record.operationType,
    Operation_Date: record.operationDate, Operation_Status: record.operationStatus,
    Input_or_Material: record.inputOrMaterial, Quantity: record.quantity, Unit: record.unit,
    Cost: record.cost, Remarks: record.remarks, Created_At: record.createdAt,
    Source_Message_ID: record.sourceMessageId
  });
}

test("crop registration appends a complete ownership-linked record", async function () {
  const appended = [];
  const result = await registerCrop({
    farmerId: FARMER_ID, land: LAND, cropName: "Coconut", variety: "West Coast Tall",
    cropType: "Perennial", plantingDate: "2020-06-01", cultivatedArea: "1",
    areaUnit: "acre", cropStatus: "Active", remarks: "Bearing palms",
    sourceMessageId: "wamid.new", cropRows: [CROP_HEADERS], now: NOW,
    idFactory: function () { return "BM-C-NEW"; },
    appendRow: async function (sheetName, row) { appended.push({ sheetName: sheetName, row: row }); return true; }
  });
  assert.equal(result.success, true);
  assert.equal(result.cropId, "BM-C-NEW");
  assert.equal(appended[0].sheetName, CROP_SHEET);
  const stored = readCrops([CROP_HEADERS, appended[0].row], FARMER_ID)[0];
  assert.deepEqual(Object.assign({}, stored, { rowNumber: undefined }), Object.assign({}, result.crop, { rowNumber: undefined }));
});

test("crop registration fails closed for blank, mismatched or invented land ownership", async function () {
  const base = {
    farmerId: FARMER_ID, cropName: "Banana", cultivatedArea: "20", areaUnit: "cent",
    cropStatus: "Active", cropRows: [CROP_HEADERS], appendRow: async function () { throw new Error("must not append"); }
  };
  assert.equal((await registerCrop(Object.assign({}, base, { land: { landId: "BM-L-X", farmerId: "" } }))).code, "LAND_OWNERSHIP_UNVERIFIED");
  assert.equal((await registerCrop(Object.assign({}, base, { land: OTHER_LAND }))).code, "LAND_OWNERSHIP_UNVERIFIED");
  assert.equal((await registerCrop(Object.assign({}, base, { land: {} }))).code, "LAND_OWNERSHIP_UNVERIFIED");
});

test("repeated registration is idempotent while multiple crops on one land remain valid", async function () {
  const existing = crop({ cropName: "Coconut" });
  const duplicate = await registerCrop({
    farmerId: FARMER_ID, land: LAND, cropName: "Coconut", variety: existing.variety,
    cropType: existing.cropType, plantingDate: existing.plantingDate,
    cultivatedArea: existing.cultivatedArea, areaUnit: existing.areaUnit,
    cropStatus: "Active", sourceMessageId: "different-message",
    cropRows: [CROP_HEADERS, cropRow(existing)], appendRow: async function () { throw new Error("duplicate must not append"); }
  });
  let appended = 0;
  const secondCrop = await registerCrop({
    farmerId: FARMER_ID, land: LAND, cropName: "Pepper", cropType: "Intercrop",
    cultivatedArea: "25", areaUnit: "cent", cropStatus: "Active",
    cropRows: [CROP_HEADERS, cropRow(existing)], idFactory: function () { return "BM-C-TWO"; },
    appendRow: async function () { appended += 1; return true; }
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.cropId, existing.cropId);
  assert.equal(secondCrop.success, true);
  assert.equal(secondCrop.cropId, "BM-C-TWO");
  assert.equal(appended, 1);
});

test("crop registration validates optional dates, positive area and required status", async function () {
  const base = { farmerId: FARMER_ID, land: LAND, cropName: "Rice", areaUnit: "acre", cropStatus: "Active", cropRows: [CROP_HEADERS] };
  assert.equal((await registerCrop(Object.assign({}, base, { cultivatedArea: "0" }))).code, "INVALID_AREA");
  assert.equal((await registerCrop(Object.assign({}, base, { cultivatedArea: "1", plantingDate: "2026-02-31" }))).code, "INVALID_PLANTING_DATE");
  assert.equal((await registerCrop(Object.assign({}, base, { cultivatedArea: "1", cropStatus: "" }))).code, "STATUS_REQUIRED");
});

test("crop status changes append history and preserve perennial planting records", async function () {
  const original = crop();
  const crops = [original];
  let row;
  const result = await appendCropStatus({
    farmerId: FARMER_ID, cropId: original.cropId, crops: crops, lands: [LAND],
    eventType: "Harvested", eventDate: "2026-10-18", cropStatus: "Harvested",
    remarks: "First harvest", sourceMessageId: "wamid.harvest",
    historyRows: [CROP_HISTORY_HEADERS], now: NOW,
    appendRow: async function (sheetName, savedRow) { assert.equal(sheetName, CROP_HISTORY_SHEET); row = savedRow; return true; }
  });
  const history = readCropHistory([CROP_HISTORY_HEADERS, row], FARMER_ID);
  const state = latestCropStates(crops, history)[0];
  assert.equal(result.success, true);
  assert.equal(state.cropStatus, "Harvested");
  assert.equal(state.harvestDate, "2026-10-18");
  assert.equal(state.plantingDate, "2020-06-01");
  assert.equal(isCurrentCrop(state), false);
  assert.equal(original.cropStatus, "Active");
});

test("crop history rejects another farmer and does not mutate earlier rows", async function () {
  const rows = [CROP_HISTORY_HEADERS];
  const snapshot = rows.map(function (row) { return row.slice(); });
  const result = await appendCropStatus({
    farmerId: "BM-F-2", cropId: "BM-C-ONE", crops: [crop()], lands: [LAND],
    eventType: "Removed", eventDate: "2026-10-19", cropStatus: "Removed",
    historyRows: rows, appendRow: async function () { throw new Error("must not append"); }
  });
  assert.equal(result.code, "CROP_OWNERSHIP_UNVERIFIED");
  assert.deepEqual(rows, snapshot);
});

test("crop readers isolate farmers and reject incomplete records", function () {
  const rows = [CROP_HEADERS, cropRow(crop()), cropRow(crop({ cropId: "BM-C-OTHER", farmerId: "BM-F-2" })), cropRow(crop({ cropId: "" }))];
  assert.deepEqual(readCrops(rows, FARMER_ID).map(function (item) { return item.cropId; }), ["BM-C-ONE"]);
});

test("farm diary appends optional fields without forcing irrelevant material data", async function () {
  let row;
  const result = await recordFarmOperation({
    farmerId: FARMER_ID, land: LAND, cropId: "BM-C-ONE", crops: [crop()],
    operationType: "Irrigation", operationDate: "2026-10-19", operationStatus: "Completed",
    remarks: "Drip line", sourceMessageId: "wamid.irrigation", operationRows: [OPERATION_HEADERS],
    now: NOW, idFactory: function () { return "BM-OP-NEW"; },
    appendRow: async function (sheetName, savedRow) { assert.equal(sheetName, OPERATION_SHEET); row = savedRow; return true; }
  });
  const stored = readFarmOperations([OPERATION_HEADERS, row], FARMER_ID)[0];
  assert.equal(result.success, true);
  assert.equal(stored.operationId, "BM-OP-NEW");
  assert.equal(stored.inputOrMaterial, "");
  assert.equal(stored.remarks, "Drip line");
});

test("farm diary prevents repeated submissions and preserves existing history", async function () {
  const existing = operation();
  const rows = [OPERATION_HEADERS, operationRow(existing)];
  const snapshot = rows.map(function (row) { return row.slice(); });
  const result = await recordFarmOperation({
    farmerId: FARMER_ID, land: LAND, cropId: existing.cropId, crops: [crop()],
    operationType: existing.operationType, operationDate: existing.operationDate,
    operationStatus: existing.operationStatus, remarks: existing.remarks,
    sourceMessageId: "another-id", operationRows: rows,
    appendRow: async function () { throw new Error("duplicate must not append"); }
  });
  assert.equal(result.duplicate, true);
  assert.deepEqual(rows, snapshot);
});

test("concurrent identical farm diary saves append once", async function () {
  let count = 0;
  let release;
  const gate = new Promise(function (resolve) { release = resolve; });
  const options = {
    farmerId: FARMER_ID, land: LAND, cropId: "BM-C-ONE", crops: [crop()],
    operationType: "Weeding", operationDate: "2026-10-19", operationStatus: "Completed",
    sourceMessageId: "wamid.concurrent", operationRows: [OPERATION_HEADERS], now: NOW,
    idFactory: function () { return "BM-OP-CONCURRENT"; },
    appendRow: async function () { count += 1; await gate; return true; }
  };
  const first = recordFarmOperation(options);
  const second = recordFarmOperation(options);
  release();
  const results = await Promise.all([first, second]);
  assert.equal(count, 1);
  assert.deepEqual(results.map(function (item) { return item.duplicate; }).sort(), [false, true]);
});

test("farm diary verifies land and crop ownership for every write", async function () {
  const base = {
    farmerId: FARMER_ID, cropId: "BM-C-ONE", crops: [crop()], operationType: "Pruning",
    operationDate: "2026-10-19", operationStatus: "Completed", operationRows: [OPERATION_HEADERS], now: NOW
  };
  assert.equal((await recordFarmOperation(Object.assign({}, base, { land: OTHER_LAND }))).code, "LAND_OWNERSHIP_UNVERIFIED");
  assert.equal((await recordFarmOperation(Object.assign({}, base, { land: LAND, cropId: "BM-C-NOT-MINE" }))).code, "CROP_OWNERSHIP_UNVERIFIED");
});

test("generic diary redirects fertilizer entries to the existing fertilizer diary", async function () {
  const result = await recordFarmOperation({
    farmerId: FARMER_ID, land: LAND, operationType: "Fertilizer Application",
    operationDate: "2026-10-19", operationStatus: "Completed"
  });
  assert.equal(result.code, "USE_FERTILIZER_DIARY");
});

test("planned and completed operation dates are validated without activating reminders", async function () {
  const base = { farmerId: FARMER_ID, land: LAND, operationType: "Irrigation", operationRows: [OPERATION_HEADERS], now: NOW };
  assert.equal((await recordFarmOperation(Object.assign({}, base, { operationDate: "2026-10-20", operationStatus: "Completed" }))).code, "INVALID_OPERATION_DATE");
  assert.equal((await recordFarmOperation(Object.assign({}, base, { operationDate: "2026-10-18", operationStatus: "Planned" }))).code, "INVALID_OPERATION_DATE");
});

test("farm history supports farmer, land, crop, status and operation filters", function () {
  const records = [
    operation(),
    operation({ operationId: "BM-OP-TWO", operationType: "Harvesting", operationStatus: "Planned", operationDate: "2026-10-20" }),
    operation({ operationId: "BM-OP-OTHER", farmerId: "BM-F-2", landId: "BM-L-2", cropId: "BM-C-OTHER" })
  ];
  const planned = relevantOperations(records, [LAND, OTHER_LAND], [crop(), crop({ cropId: "BM-C-OTHER", farmerId: "BM-F-2", landId: "BM-L-2" })], {
    farmerId: FARMER_ID, landId: LAND.landId, cropId: "BM-C-ONE", status: "Planned", operationType: "Harvesting"
  });
  assert.deepEqual(planned.map(function (item) { return item.operationId; }), ["BM-OP-TWO"]);
});

test("verified alert reader rejects unverified, expired, sourceless and irrelevant alerts", function () {
  const valid = {
    Alert_ID: "ALERT-1", Alert_Category: "Crop Disease", Alert_Title: "Verified warning",
    Crop_Name: "Coconut", District: "Pathanamthitta", Alert_Message: "Inspect palms.",
    Precautions: "Contact the agriculture office before treatment.", Source_Name: "Department of Agriculture",
    Source_URL: "https://example.gov.in/alert", Valid_From: "2026-10-18", Valid_Until: "2026-10-21",
    Verification_Status: "Verified", Alert_Status: "Active", Created_At: NOW.toISOString()
  };
  const rows = [
    VERIFIED_ALERT_HEADERS,
    rowFromHeaders(VERIFIED_ALERT_HEADERS, valid),
    rowFromHeaders(VERIFIED_ALERT_HEADERS, Object.assign({}, valid, { Alert_ID: "ALERT-2", Verification_Status: "Pending" })),
    rowFromHeaders(VERIFIED_ALERT_HEADERS, Object.assign({}, valid, { Alert_ID: "ALERT-3", Valid_Until: "2026-10-18" })),
    rowFromHeaders(VERIFIED_ALERT_HEADERS, Object.assign({}, valid, { Alert_ID: "ALERT-4", Source_Name: "" })),
    rowFromHeaders(VERIFIED_ALERT_HEADERS, Object.assign({}, valid, { Alert_ID: "ALERT-5", District: "Kollam" })),
    rowFromHeaders(VERIFIED_ALERT_HEADERS, Object.assign({}, valid, { Alert_ID: "ALERT-6", Crop_Name: "Rice" }))
  ];
  const alerts = readVerifiedAlerts(rows, { district: "Pathanamthitta", cropNames: ["Coconut"], today: "2026-10-19" });
  assert.deepEqual(alerts.map(function (item) { return item.alertId; }), ["ALERT-1"]);
  assert.deepEqual(readAlertsFromExistingModule(rows, { district: "Pathanamthitta", cropNames: ["Coconut"], today: "2026-10-19" }), alerts);
});

test("duplicate verified alert IDs are returned once and statewide alerts remain relevant", function () {
  const record = {
    Alert_ID: "WEATHER-1", Alert_Category: "Weather", Alert_Title: "Strong winds",
    Crop_Name: "All Crops", District: "Kerala", Alert_Message: "Secure loose farm materials.",
    Source_Name: "IMD", Valid_From: "2026-10-19", Valid_Until: "2026-10-20",
    Verification_Status: "Verified", Alert_Status: "Current"
  };
  const row = rowFromHeaders(VERIFIED_ALERT_HEADERS, record);
  assert.equal(readVerifiedAlerts([VERIFIED_ALERT_HEADERS, row, row], {
    district: "Pathanamthitta", cropNames: ["Coconut"], today: "2026-10-19"
  }).length, 1);
});

test("My Alerts combines verified data with non-expired farmer-planned operations", function () {
  const alertRow = rowFromHeaders(VERIFIED_ALERT_HEADERS, {
    Alert_ID: "ALERT-1", Alert_Category: "Crop", Alert_Title: "Crop caution", Crop_Name: "Coconut",
    District: "Pathanamthitta", Alert_Message: "Observe leaves.", Source_Name: "KAU",
    Valid_From: "2026-10-19", Valid_Until: "2026-10-20", Verification_Status: "Verified", Alert_Status: "Active"
  });
  const result = buildMyFarmAlerts({
    farmerId: FARMER_ID, district: "Pathanamthitta", lands: [LAND], crops: [crop()],
    operations: [operation({ operationStatus: "Planned", operationDate: "2026-10-20" }), operation({ operationId: "OLD", operationStatus: "Planned", operationDate: "2026-10-18" })],
    alertRows: [VERIFIED_ALERT_HEADERS, alertRow], today: "2026-10-19"
  });
  assert.equal(result.verified.length, 1);
  assert.deepEqual(result.planned.map(function (item) { return item.operationId; }), ["BM-OP-ONE"]);
});

test("missing verified data produces a cautious availability message", function () {
  const text = formatFarmAlerts({ verified: [], planned: [] }, "English");
  assert.match(text, /does not mean there is no agricultural risk/i);
  assert.match(formatFarmAlerts({ verified: [], planned: [] }, "Malayalam"), /അപകടസാധ്യതയില്ലെന്ന് അർത്ഥമില്ല/);
});

test("English and Malayalam natural-language requests route to crop and farm actions", function () {
  assert.deepEqual(parseCropFarmNaturalLanguage("Register coconut"), { action: "REGISTER", cropName: "coconut" });
  assert.deepEqual(parseCropFarmNaturalLanguage("Add rambutan crop"), { action: "REGISTER", cropName: "rambutan" });
  assert.deepEqual(parseCropFarmNaturalLanguage("Show my crop history"), { action: "HISTORY" });
  assert.deepEqual(parseCropFarmNaturalLanguage("Mark crop harvested"), { action: "UPDATE_STATUS" });
  assert.deepEqual(parseCropFarmNaturalLanguage("Record irrigation"), { action: "RECORD_OPERATION" });
  assert.deepEqual(parseCropFarmNaturalLanguage("I applied fertilizer yesterday"), { action: "FERTILIZER" });
  assert.deepEqual(parseCropFarmNaturalLanguage("My planned farm operations"), { action: "PLANNED" });
  assert.deepEqual(parseCropFarmNaturalLanguage("തെങ്ങ് രജിസ്റ്റർ ചെയ്യണം"), { action: "REGISTER", cropName: "തെങ്ങ്" });
  assert.deepEqual(parseCropFarmNaturalLanguage("വിളകളുടെ ചരിത്രം കാണിക്കുക"), { action: "HISTORY" });
  assert.deepEqual(parseCropFarmNaturalLanguage("ഇന്ന് നനച്ചു"), { action: "RECORD_OPERATION" });
  assert.deepEqual(parseCropFarmNaturalLanguage("കൃഷി മുന്നറിയിപ്പുകൾ"), { action: "ALERTS" });
});

test("pipe-delimited WhatsApp input accepts optional fields and validates dates", function () {
  const cropDetails = parseCropRegistrationDetails("- | 2020-06-01 | 1 | acre | Perennial | Active | original palms");
  const operationDetails = parseOperationDetails("2026-10-19 | Completed | - | - | - | - | irrigated");
  const statusDetails = parseCropStatusDetails("Harvested | 2026-10-18 | Harvested | first harvest");
  assert.equal(cropDetails.success, true);
  assert.equal(cropDetails.variety, "");
  assert.equal(operationDetails.success, true);
  assert.equal(operationDetails.inputOrMaterial, "");
  assert.equal(statusDetails.eventType, "Harvested");
  assert.equal(parseCropRegistrationDetails("- | 31-02-2026 | 1 | acre | Annual | Active").success, false);
});

test("interactive action parsing supports legacy land entry points and safe dynamic IDs", function () {
  assert.deepEqual(parseCropFarmAction("LAND_ADD_CROP"), { action: "REGISTER" });
  assert.deepEqual(parseCropFarmAction("LAND_CROP_HISTORY"), { action: "HISTORY" });
  assert.deepEqual(parseCropFarmAction(CROP_FARM_PREFIXES.CROP_LAND + encodeURIComponent("BM-L-1")), { action: "CROP_LAND", landId: "BM-L-1" });
  assert.equal(parseCropFarmAction(CROP_FARM_PREFIXES.CROP_LAND + "%E0%A4%A"), null);
});

test("land, crop and operation list builders respect WhatsApp's ten-row limit", function () {
  const lands = Array.from({ length: 12 }, function (_, index) { return Object.assign({}, LAND, { landId: "BM-L-" + index, farmName: "Farm " + index }); });
  const crops = Array.from({ length: 12 }, function (_, index) { return crop({ cropId: "BM-C-" + index, cropName: "Crop " + index }); });
  assert.equal(landRowsForAction(lands, CROP_FARM_PREFIXES.CROP_LAND).length, 10);
  assert.equal(operationTypeRows().length, 10);
  assert.equal(cropRowsForOperation(crops, LAND.landId).length, 10);
  assert.equal(operationTypeRows().some(function (row) { return /fertili/i.test(row.title); }), false);
  assert.equal(operationTypeRows()[9].title, "Other");
  assert.equal(cropRowsForStatus(crops).length, 10);
});

test("English and Malayalam crop/farm menus expose ten connected actions", async function () {
  const calls = [];
  const ui = createBhoomiMitraUI({
    axios: { post: async function (url, body) { calls.push(body); return { data: {} }; } },
    phoneNumberId: "phone-id", whatsappToken: "token"
  });
  await ui.sendCropFarmMenu("919111111111", "English");
  await ui.sendCropFarmMenu("919111111111", "Malayalam");
  const englishRows = calls[0].interactive.action.sections[0].rows;
  const malayalamRows = calls[1].interactive.action.sections[0].rows;
  assert.equal(englishRows.length, 10);
  assert.deepEqual(malayalamRows.map(function (row) { return row.id; }), englishRows.map(function (row) { return row.id; }));
  assert.deepEqual(englishRows.map(function (row) { return row.id; }), [
    CROP_FARM_ACTION_IDS.REGISTER, CROP_FARM_ACTION_IDS.MY_CROPS, CROP_FARM_ACTION_IDS.HISTORY,
    CROP_FARM_ACTION_IDS.RECORD_OPERATION, CROP_FARM_ACTION_IDS.ACTIVITIES, CROP_FARM_ACTION_IDS.PLANNED,
    CROP_FARM_ACTION_IDS.ALERTS, CROP_FARM_ACTION_IDS.FERTILIZER,
    CROP_FARM_ACTION_IDS.SOIL_FERTILIZER, CROP_FARM_ACTION_IDS.MAIN_MENU
  ]);
  englishRows.concat(malayalamRows).forEach(function (row) {
    assert.ok(row.title.length <= 24);
    assert.ok(row.description.length <= 72);
  });
});

test("crop/farm results provide working records, Back and Main Menu navigation", async function () {
  const calls = [];
  const ui = createBhoomiMitraUI({
    axios: { post: async function (url, body) { calls.push(body); return { data: {} }; } },
    phoneNumberId: "phone-id", whatsappToken: "token"
  });
  await ui.sendCropFarmMessage("919111111111", "English", "Saved");
  assert.deepEqual(calls[0].interactive.action.buttons.map(function (button) { return button.reply.id; }), [
    CROP_FARM_ACTION_IDS.OPEN, CROP_FARM_ACTION_IDS.FARM_MENU, CROP_FARM_ACTION_IDS.MAIN_MENU
  ]);
  assert.equal(isExplicitRegistrationExit(CROP_FARM_ACTION_IDS.OPEN), true);
  assert.equal(isExplicitRegistrationExit(CROP_FARM_ACTION_IDS.MAIN_MENU), true);
});

test("history formatters provide readable empty and populated responses", function () {
  const legacyLand = Object.assign({}, LAND, { mainCrop: "Banana", otherCrops: "Pepper" });
  assert.match(formatCropSummary([], [legacyLand], [], "English"), /No Crop ID has been created/);
  assert.match(formatCropSummary([crop()], [LAND], [], "Malayalam"), /Coconut/);
  assert.match(formatOperationSummary([], [LAND], [crop()], "English"), /No farm activities/);
  assert.match(formatOperationSummary([operation()], [LAND], [crop()], "English"), /Irrigation/);
});

test("missing sheet schemas fail safely without calling append functions", async function () {
  let writes = 0;
  const cropResult = await registerCrop({
    farmerId: FARMER_ID, land: LAND, cropName: "Rice", cultivatedArea: "1", areaUnit: "acre",
    cropStatus: "Active", cropRows: [["Crop_ID"]], appendRow: async function () { writes += 1; return true; }
  });
  const operationResult = await recordFarmOperation({
    farmerId: FARMER_ID, land: LAND, operationType: "Irrigation", operationDate: "2026-10-19",
    operationStatus: "Completed", operationRows: [["Operation_ID"]], now: NOW,
    appendRow: async function () { writes += 1; return true; }
  });
  assert.equal(cropResult.code, "CROP_SCHEMA_UNAVAILABLE");
  assert.equal(operationResult.code, "OPERATION_SCHEMA_UNAVAILABLE");
  assert.equal(writes, 0);
});
