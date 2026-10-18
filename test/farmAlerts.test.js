"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createBhoomiMitraUI } = require("../utils/bhoomiMitraUI");
const {
  FARM_ALERT_ACTION_IDS,
  OPERATION_TYPE,
  buildAlertDetail,
  buildCropSelectionRows,
  buildDispatchPlan,
  buildLandSelectionRows,
  buildOperationConfirmation,
  buildReminderMessage,
  createReminderTemplatePayload,
  dueOperations,
  parseFarmAlertAction,
  parseOperationInput,
  readFarmerLands,
  readNotificationRecords,
  readOwnedLands,
  recordAlertDelivery,
  saveFarmOperation,
  selectedOperationDate,
  serializeRecord,
  updateFarmOperation,
  validateOperationDate,
  wasDelivered
} = require("../utils/farmAlerts");

const NOW = new Date("2026-10-17T08:00:00.000Z");
const LAND_HEADERS = [
  "Land_ID", "Farmer_ID", "WhatsApp_Number", "Farm_Name", "District", "Taluk",
  "Revenue_Village", "Local_Body_Type", "Local_Body", "Ward", "Locality",
  "Block_Number", "Survey_Number", "Subdivision_Number", "Thandaper_Number",
  "Farmer_Reported_Area", "Revenue_Record_Area", "GPS_Calculated_Area", "Area_Unit",
  "Ownership_Type", "Possession_Type", "Latitude", "Longitude", "Location_Link",
  "GPS_Source", "GPS_Captured_Date", "Boundary_GeoJSON", "Boundary_Verification_Status",
  "Elevation_M", "Gradient_Slope", "Terrain", "Land_Use", "Main_Crop", "Other_Crops",
  "Crop_Stage", "Irrigation_Available", "Irrigation_Source", "Soil_Test_Available",
  "Soil_Type", "Drainage_Status", "Satellite_Monitoring_Enabled", "Active_Status",
  "Created_At", "Updated_At", "Remarks"
];
const NOTIFICATION_HEADERS = [
  "Notification_ID", "Date", "User_Type", "User_ID", "Mobile_No", "Message",
  "SMS_Status", "WhatsApp Status", "Email_Status", "Remarks"
];

function rowFrom(headers, values) {
  return headers.map(function (header) { return values && values[header] != null ? values[header] : ""; });
}

function landRows() {
  return [
    LAND_HEADERS,
    rowFrom(LAND_HEADERS, {
      Land_ID: "BM-L-1", Farmer_ID: "BM-F-1", Farm_Name: "River Farm", District: "Pathanamthitta",
      Local_Body: "Konni", Main_Crop: "Banana", Other_Crops: "Pepper; Arecanut", Active_Status: "Active"
    }),
    rowFrom(LAND_HEADERS, {
      Land_ID: "BM-L-2", Farmer_ID: "BM-F-1", Farm_Name: "Hill Plot", District: "Pathanamthitta",
      Main_Crop: "Coconut", Active_Status: "Active"
    }),
    rowFrom(LAND_HEADERS, {
      Land_ID: "BM-L-BLANK", Farmer_ID: "", Farm_Name: "Unverified Plot", Main_Crop: "Rice", Active_Status: "Active"
    }),
    rowFrom(LAND_HEADERS, {
      Land_ID: "BM-L-3", Farmer_ID: "BM-F-2", Farm_Name: "Other Farm", Main_Crop: "Rubber", Active_Status: "Active"
    })
  ];
}

function operationRecord(overrides) {
  return Object.assign({
    version: 1,
    kind: "fertilizer-operation",
    notificationId: "FF-ONE",
    farmerId: "BM-F-1",
    landId: "BM-L-1",
    farmName: "River Farm",
    crop: "Banana",
    operationType: OPERATION_TYPE,
    dueDate: "2026-10-19",
    status: "Planned",
    reminderOptIn: true,
    reminderLeadDays: 2,
    mobile: "919111111111",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString()
  }, overrides || {});
}

function notificationRows(records) {
  return [NOTIFICATION_HEADERS].concat((records || []).map(function (record) {
    return rowFrom(NOTIFICATION_HEADERS, {
      Notification_ID: record.notificationId || record.deliveryKey,
      Date: record.updatedAt || record.sentAt,
      User_Type: "Farmer",
      User_ID: record.farmerId,
      Mobile_No: record.mobile || "919111111111",
      Message: "Fertilizer application",
      "WhatsApp Status": record.kind === "fertilizer-reminder-delivery" ? "Accepted" : "Not Sent",
      Remarks: serializeRecord(record)
    });
  }));
}

function makeUiHarness() {
  const calls = [];
  return {
    calls: calls,
    ui: createBhoomiMitraUI({
      axios: { post: async function (url, body) { calls.push({ url: url, body: body }); return { data: {} }; } },
      phoneNumberId: "phone-id",
      whatsappToken: "token"
    })
  };
}

test("ownership is fail-closed when Land_Parcels.Farmer_ID is blank", function () {
  const owned = readOwnedLands(landRows());
  const farmerLands = readFarmerLands(landRows(), "BM-F-1");
  assert.equal(owned.some(function (land) { return land.landId === "BM-L-BLANK"; }), false);
  assert.deepEqual(farmerLands.map(function (land) { return land.landId; }), ["BM-L-1", "BM-L-2"]);
});

test("registered land and crop selection are click-first", function () {
  const lands = readFarmerLands(landRows(), "BM-F-1");
  const landChoices = buildLandSelectionRows(lands);
  const cropChoices = buildCropSelectionRows(lands[0]);
  assert.deepEqual(landChoices.map(function (row) { return row.title; }), ["River Farm", "Hill Plot"]);
  assert.deepEqual(cropChoices.map(function (row) { return row.title; }), ["Banana", "Pepper", "Arecanut"]);
  assert.deepEqual(parseFarmAlertAction(cropChoices[1].id), { action: "CROP", crop: "Pepper" });
});

test("planned fertilizer application persists opt-in in existing Notification_Log schema", async function () {
  const appended = [];
  const result = await saveFarmOperation({
    farmer: { memberId: "BM-F-1", whatsapp: "919111111111" },
    land: readFarmerLands(landRows(), "BM-F-1")[0],
    crop: "Banana",
    status: "Planned",
    operationDate: "2026-10-19",
    reminderOptIn: true,
    notificationRows: [NOTIFICATION_HEADERS],
    now: NOW,
    appendNotification: async function (sheetName, row) { appended.push({ sheetName: sheetName, row: row }); return true; }
  });
  assert.equal(result.success, true);
  assert.equal(result.record.operationType, "Fertilizer Application");
  assert.equal(result.record.reminderLeadDays, 2);
  assert.equal(appended[0].sheetName, "Notification_Log");
  const stored = readNotificationRecords([NOTIFICATION_HEADERS, appended[0].row], "BM-F-1")[0];
  assert.equal(stored.farmerId, "BM-F-1");
  assert.equal(stored.landId, "BM-L-1");
  assert.equal(stored.crop, "Banana");
  assert.equal(stored.dueDate, "2026-10-19");
  assert.equal(stored.status, "Planned");
  assert.equal(stored.reminderOptIn, true);
});

test("completed fertilizer application persists as a diary entry without reminder opt-in", async function () {
  const appended = [];
  const result = await saveFarmOperation({
    farmer: { memberId: "BM-F-1", whatsapp: "919111111111" },
    land: readFarmerLands(landRows(), "BM-F-1")[0], crop: "Pepper", status: "Completed",
    operationDate: "2026-10-16", reminderOptIn: false, notificationRows: [NOTIFICATION_HEADERS], now: NOW,
    appendNotification: async function (sheetName, row) { appended.push(row); return true; }
  });
  assert.equal(result.record.status, "Completed");
  assert.equal(result.record.reminderOptIn, false);
  assert.equal(readNotificationRecords([NOTIFICATION_HEADERS, appended[0]], "BM-F-1")[0].status, "Completed");
});

test("save rejects unverified ownership, unregistered crops and planned records without opt-in", async function () {
  const lands = readFarmerLands(landRows(), "BM-F-1");
  const base = {
    farmer: { memberId: "BM-F-1" }, crop: "Banana", status: "Planned", operationDate: "2026-10-19",
    reminderOptIn: true, notificationRows: [NOTIFICATION_HEADERS], now: NOW,
    appendNotification: async function () { throw new Error("must not write"); }
  };
  const wrongOwner = await saveFarmOperation(Object.assign({}, base, { land: Object.assign({}, lands[0], { farmerId: "" }) }));
  const missingFarmer = await saveFarmOperation(Object.assign({}, base, { farmer: { memberId: "" }, land: lands[0] }));
  const mismatchedFarmer = await saveFarmOperation(Object.assign({}, base, { farmer: { memberId: "BM-F-2" }, land: lands[0] }));
  const wrongCrop = await saveFarmOperation(Object.assign({}, base, { land: lands[0], crop: "Rice" }));
  const noOptIn = await saveFarmOperation(Object.assign({}, base, { land: lands[0], reminderOptIn: false }));
  assert.equal(wrongOwner.code, "INVALID_LAND_OWNERSHIP");
  assert.equal(missingFarmer.code, "FARMER_REQUIRED");
  assert.equal(mismatchedFarmer.code, "INVALID_LAND_OWNERSHIP");
  assert.equal(wrongCrop.code, "INVALID_REGISTERED_CROP");
  assert.equal(noOptIn.code, "REMINDER_OPT_IN_REQUIRED");
});

test("planned reminders require at least two full Kerala calendar days of notice", async function () {
  let appendCount = 0;
  const result = await saveFarmOperation({
    farmer: { memberId: "BM-F-1" },
    land: readFarmerLands(landRows(), "BM-F-1")[0],
    crop: "Banana",
    status: "Planned",
    operationDate: "2026-10-18",
    reminderOptIn: true,
    notificationRows: [NOTIFICATION_HEADERS],
    now: NOW,
    appendNotification: async function () { appendCount += 1; return true; }
  });
  assert.equal(result.code, "INVALID_OPERATION_DATE");
  assert.equal(appendCount, 0);
  assert.equal(validateOperationDate("Planned", "2026-10-19", NOW), true);
});

test("operation persistence is idempotent for the same farmer, land, crop, status and date", async function () {
  const lands = readFarmerLands(landRows(), "BM-F-1");
  let savedRow;
  const first = await saveFarmOperation({
    farmer: { memberId: "BM-F-1", whatsapp: "919111111111" }, land: lands[0], crop: "Banana",
    status: "Planned", operationDate: "2026-10-19", reminderOptIn: true,
    notificationRows: [NOTIFICATION_HEADERS], now: NOW,
    appendNotification: async function (sheetName, row) { savedRow = row; return true; }
  });
  const second = await saveFarmOperation({
    farmer: { memberId: "BM-F-1", whatsapp: "919111111111" }, land: lands[0], crop: "Banana",
    status: "Planned", operationDate: "2026-10-19", reminderOptIn: true,
    notificationRows: [NOTIFICATION_HEADERS, savedRow], now: new Date("2026-10-17T09:00:00Z"),
    appendNotification: async function () { throw new Error("duplicate must not append"); }
  });
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(first.record.notificationId, second.record.notificationId);
});

test("concurrent repeated diary saves append exactly one record", async function () {
  const land = readFarmerLands(landRows(), "BM-F-1")[0];
  let appendCount = 0;
  let releaseAppend;
  const appendGate = new Promise(function (resolve) { releaseAppend = resolve; });
  const options = {
    farmer: { memberId: "BM-F-1", whatsapp: "919111111111" },
    land: land,
    crop: "Pepper",
    status: "Completed",
    operationDate: "2026-10-16",
    reminderOptIn: false,
    notificationRows: [NOTIFICATION_HEADERS],
    now: NOW,
    appendNotification: async function () {
      appendCount += 1;
      await appendGate;
      return true;
    }
  };
  const firstSave = saveFarmOperation(options);
  const repeatedSave = saveFarmOperation(options);
  releaseAppend();
  const results = await Promise.all([firstSave, repeatedSave]);
  assert.equal(appendCount, 1);
  assert.deepEqual(results.map(function (result) { return result.duplicate; }).sort(), [false, true]);
  assert.equal(results[0].record.notificationId, results[1].record.notificationId);
});

test("saving a new diary entry preserves every existing fertilizer record", async function () {
  const existing = operationRecord({
    notificationId: "FF-EXISTING",
    status: "Completed",
    reminderOptIn: false,
    reminderLeadDays: 0,
    dueDate: "2026-10-15"
  });
  const rows = notificationRows([existing]);
  const originalRows = rows.map(function (row) { return row.slice(); });
  let appendedRow;
  const result = await saveFarmOperation({
    farmer: { memberId: "BM-F-1", whatsapp: "919111111111" },
    land: readFarmerLands(landRows(), "BM-F-1")[1],
    crop: "Coconut",
    status: "Completed",
    operationDate: "2026-10-16",
    reminderOptIn: false,
    notificationRows: rows,
    now: NOW,
    appendNotification: async function (sheetName, row) { appendedRow = row; return true; }
  });
  assert.equal(result.success, true);
  assert.deepEqual(rows, originalRows);
  assert.notEqual(result.record.notificationId, existing.notificationId);
  const allRecords = readNotificationRecords(rows.concat([appendedRow]), "BM-F-1");
  assert.deepEqual(allRecords.map(function (record) { return record.notificationId; }), ["FF-EXISTING", result.record.notificationId]);
});

test("Notification_Log reader rejects a Remarks owner that conflicts with User_ID", function () {
  const forged = operationRecord({ farmerId: "BM-F-1" });
  const row = rowFrom(NOTIFICATION_HEADERS, {
    Notification_ID: "FF-FORGED", User_ID: "BM-F-2", Mobile_No: "919111111111", Remarks: serializeRecord(forged)
  });
  assert.equal(readNotificationRecords([NOTIFICATION_HEADERS, row]).length, 0);
});

test("only an opted-in operation exactly two days ahead enters an approved-template dispatch plan", function () {
  const lands = readFarmerLands(landRows(), "BM-F-1");
  const due = operationRecord();
  const notOptedIn = operationRecord({ notificationId: "FF-NO-OPT", reminderOptIn: false });
  const tomorrow = operationRecord({ notificationId: "FF-TOMORROW", dueDate: "2026-10-18" });
  const unapproved = buildDispatchPlan({ lands: lands, records: [due], now: NOW, approvedTemplateName: "fertilizer_reminder_ml_en", templateStatus: "PENDING" });
  const duplicateDue = Object.assign({}, due);
  const approved = buildDispatchPlan({ lands: lands, records: [due, duplicateDue, notOptedIn, tomorrow], now: NOW, approvedTemplateName: "fertilizer_reminder_ml_en", templateStatus: "APPROVED" });
  assert.equal(unapproved.enabled, false);
  assert.equal(unapproved.notificationsProposed, 0);
  assert.equal(approved.notificationsProposed, 1);
  assert.equal(approved.alerts[0].notificationId, "FF-ONE");
  assert.equal(dueOperations([due], NOW, 2)[0].daysUntilDue, 2);
});

test("dispatch plan rechecks current land ownership and never infers a blank owner", function () {
  const due = operationRecord();
  const blankOwner = [Object.assign({}, readFarmerLands(landRows(), "BM-F-1")[0], { farmerId: "" })];
  const plan = buildDispatchPlan({
    lands: blankOwner, records: [due], now: NOW,
    approvedTemplateName: "fertilizer_reminder_ml_en", templateStatus: "APPROVED"
  });
  assert.equal(plan.notificationsProposed, 0);
});

test("proactive payload is template-only and contains no free-form text send", function () {
  const alert = Object.assign(operationRecord(), {
    templateName: "fertilizer_reminder_ml_en", templateLanguageCode: "ml"
  });
  const payload = createReminderTemplatePayload(alert);
  assert.equal(payload.type, "template");
  assert.equal(payload.template.name, "fertilizer_reminder_ml_en");
  assert.equal(Object.prototype.hasOwnProperty.call(payload, "text"), false);
  assert.deepEqual(payload.template.components[0].parameters.map(function (item) { return item.text; }), ["River Farm", "Banana", "2026-10-19"]);
});

test("persistent accepted-delivery record prevents duplicate reminders after restart", async function () {
  const alert = Object.assign(operationRecord(), {
    operationId: "FF-ONE", templateName: "fertilizer_reminder_ml_en", reminderMessage: buildReminderMessage(operationRecord())
  });
  let row;
  const first = await recordAlertDelivery({
    alert: alert, accepted: true, providerMessageId: "wamid.accepted", notificationRows: [NOTIFICATION_HEADERS], now: NOW,
    appendNotification: async function (sheetName, appendedRow) { row = appendedRow; return true; }
  });
  const restartedRows = [NOTIFICATION_HEADERS, row];
  const restartedRecords = readNotificationRecords(restartedRows, "BM-F-1");
  const second = await recordAlertDelivery({
    alert: alert, accepted: true, providerMessageId: "wamid.second", notificationRows: restartedRows, now: NOW,
    appendNotification: async function () { throw new Error("duplicate must not append"); }
  });
  assert.equal(first.duplicate, false);
  assert.equal(wasDelivered(restartedRecords, alert), true);
  assert.equal(second.duplicate, true);
});

test("marking planned fertilizer complete requires current land ownership", async function () {
  const rows = notificationRows([operationRecord()]);
  const records = readNotificationRecords(rows, "BM-F-1");
  const denied = await updateFarmOperation({
    records: records, lands: [], notificationId: "FF-ONE", farmerId: "BM-F-1", action: "DONE",
    writeNotification: async function () { throw new Error("must not write"); }
  });
  let updatedRow;
  const accepted = await updateFarmOperation({
    records: records, lands: readFarmerLands(landRows(), "BM-F-1"), notificationId: "FF-ONE",
    farmerId: "BM-F-1", action: "DONE", now: NOW,
    writeNotification: async function (rowNumber, row) { updatedRow = row; return true; }
  });
  assert.equal(denied.code, "LAND_OWNERSHIP_UNVERIFIED");
  assert.equal(accepted.record.status, "Completed");
  assert.equal(readNotificationRecords([NOTIFICATION_HEADERS, updatedRow], "BM-F-1")[0].reminderOptIn, false);
});

test("date choices use Kerala calendar dates and enforce planned versus completed", function () {
  assert.equal(selectedOperationDate("DATE_YESTERDAY", NOW), "2026-10-16");
  assert.equal(selectedOperationDate("DATE_IN_TWO_DAYS", NOW), "2026-10-19");
  assert.equal(validateOperationDate("Completed", "2026-10-18", NOW), false);
  assert.equal(validateOperationDate("Planned", "2026-10-16", NOW), false);
  assert.equal(validateOperationDate("Planned", "2026-10-18", NOW), false);
  assert.equal(parseOperationInput("19-10-2026").operationDate, "2026-10-19");
});

test("confirmation, detail and reminder copy are Malayalam-first bilingual", function () {
  const confirmation = buildOperationConfirmation({
    status: "Planned", land: { farmName: "River Farm" }, crop: "Banana", operationDate: "2026-10-19"
  });
  const reminder = buildReminderMessage(operationRecord());
  const detail = buildAlertDetail(operationRecord());
  assert.ok(confirmation.indexOf("വളപ്രയോഗം") < confirmation.indexOf("Fertilizer application"));
  assert.ok(reminder.indexOf("ഓർമ്മപ്പെടുത്തൽ") < reminder.indexOf("Fertilizer application reminder"));
  assert.ok(detail.indexOf("കൃഷിയിടം") < detail.indexOf("Farm:"));
});

test("WhatsApp UI exposes only completed diary and planned reminder fertilizer paths", async function () {
  const harness = makeUiHarness();
  await harness.ui.sendFarmAlertsMenu("919111111111", "Malayalam");
  await harness.ui.sendFarmOperationDateChoices("919111111111", "Malayalam", "Completed");
  await harness.ui.sendFarmOperationDateChoices("919111111111", "Malayalam", "Planned");
  const menuRows = harness.calls[0].body.interactive.action.sections[0].rows;
  const completedButtons = harness.calls[1].body.interactive.action.buttons;
  const plannedButtons = harness.calls[2].body.interactive.action.buttons;
  assert.ok(menuRows.some(function (row) { return row.id === FARM_ALERT_ACTION_IDS.ADD; }));
  assert.ok(menuRows.some(function (row) { return row.id === FARM_ALERT_ACTION_IDS.PLAN; }));
  assert.deepEqual(completedButtons.map(function (button) { return button.reply.id; }), [
    FARM_ALERT_ACTION_IDS.DATE_TODAY, FARM_ALERT_ACTION_IDS.DATE_YESTERDAY, FARM_ALERT_ACTION_IDS.DATE_CHOOSE
  ]);
  assert.deepEqual(plannedButtons.map(function (button) { return button.reply.id; }), [
    FARM_ALERT_ACTION_IDS.DATE_IN_TWO_DAYS, FARM_ALERT_ACTION_IDS.DATE_CHOOSE
  ]);
});

test("V1 fertilizer flow never calculates or prescribes a dose", function () {
  const combined = [
    OPERATION_TYPE,
    buildOperationConfirmation({ status: "Planned", land: { farmName: "River Farm" }, crop: "Banana", operationDate: "2026-10-19" }),
    buildReminderMessage(operationRecord())
  ].join("\n");
  assert.doesNotMatch(combined, /\b(?:kg|gram|dose|dosage|NPK|urea)\b/i);
});
