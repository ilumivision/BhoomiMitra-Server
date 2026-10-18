"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { runFertilizerReminders } = require("../scripts/send-fertilizer-reminders");
const { serializeRecord } = require("../utils/farmAlerts");

const LAND_HEADERS = ["Land_ID", "Farmer_ID", "Farm_Name", "Main_Crop", "Active_Status"];
const NOTIFICATION_HEADERS = [
  "Notification_ID", "Date", "User_Type", "User_ID", "Mobile_No", "Message",
  "SMS_Status", "WhatsApp Status", "Email_Status", "Remarks"
];

function rowFrom(headers, values) {
  return headers.map(function (header) { return values[header] || ""; });
}

test("reminder runner is read-only by default and does not require WhatsApp credentials", async function () {
  const operation = {
    version: 1,
    kind: "fertilizer-operation",
    notificationId: "FF-ONE",
    farmerId: "BM-F-1",
    landId: "BM-L-1",
    farmName: "River Farm",
    crop: "Banana",
    operationType: "Fertilizer Application",
    dueDate: "2026-10-19",
    status: "Planned",
    reminderOptIn: true,
    reminderLeadDays: 2,
    mobile: "919111111111"
  };
  const landRows = [LAND_HEADERS, rowFrom(LAND_HEADERS, {
    Land_ID: "BM-L-1", Farmer_ID: "BM-F-1", Farm_Name: "River Farm", Main_Crop: "Banana", Active_Status: "Active"
  })];
  const notificationRows = [NOTIFICATION_HEADERS, rowFrom(NOTIFICATION_HEADERS, {
    Notification_ID: "FF-ONE", User_Type: "Farmer", User_ID: "BM-F-1", Mobile_No: "919111111111",
    Message: "Fertilizer application", "WhatsApp Status": "Not Sent", Remarks: serializeRecord(operation)
  })];
  let readCount = 0;
  const sheets = {
    spreadsheets: {
      values: {
        get: async function (request) {
          readCount += 1;
          return { data: { values: request.range.includes("Land_Parcels") ? landRows : notificationRows } };
        },
        append: async function () { throw new Error("dry run must not append"); }
      }
    }
  };
  const summary = await runFertilizerReminders({
    sheets: sheets,
    now: new Date("2026-10-17T08:00:00Z"),
    env: {
      GOOGLE_SHEET_ID: "sheet-id",
      GOOGLE_CLIENT_EMAIL: "service@example.com",
      GOOGLE_PRIVATE_KEY: "test-key",
      FERTILIZER_REMINDER_DRY_RUN: "true",
      FERTILIZER_REMINDER_TEMPLATE_NAME: "fertilizer_reminder_ml_en",
      FERTILIZER_REMINDER_TEMPLATE_STATUS: "APPROVED"
    },
    axios: { post: async function () { throw new Error("dry run must not send"); } }
  });
  assert.equal(readCount, 2);
  assert.equal(summary.mode, "DRY_RUN_READ_ONLY");
  assert.equal(summary.notificationsProposed, 1);
  assert.equal(summary.sent, 0);
});

test("overlapping live reminder runs send and log a due reminder only once", async function () {
  const operation = {
    version: 1, kind: "fertilizer-operation", notificationId: "FF-OVERLAP", farmerId: "BM-F-1",
    landId: "BM-L-1", farmName: "River Farm", crop: "Banana", operationType: "Fertilizer Application",
    dueDate: "2026-10-19", status: "Planned", reminderOptIn: true, reminderLeadDays: 2,
    mobile: "919111111111"
  };
  const landRows = [LAND_HEADERS, rowFrom(LAND_HEADERS, {
    Land_ID: "BM-L-1", Farmer_ID: "BM-F-1", Farm_Name: "River Farm", Main_Crop: "Banana", Active_Status: "Active"
  })];
  const notificationRows = [NOTIFICATION_HEADERS, rowFrom(NOTIFICATION_HEADERS, {
    Notification_ID: "FF-OVERLAP", User_Type: "Farmer", User_ID: "BM-F-1", Mobile_No: "919111111111",
    Message: "Fertilizer application", "WhatsApp Status": "Not Sent", Remarks: serializeRecord(operation)
  })];
  let appendCount = 0;
  let postCount = 0;
  let signalPostStarted;
  let releasePost;
  const postStarted = new Promise(function (resolve) { signalPostStarted = resolve; });
  const postGate = new Promise(function (resolve) { releasePost = resolve; });
  const sheets = {
    spreadsheets: { values: {
      get: async function (request) {
        return { data: { values: request.range.includes("Land_Parcels") ? landRows : notificationRows } };
      },
      append: async function () { appendCount += 1; return { data: {} }; }
    } }
  };
  const env = {
    GOOGLE_SHEET_ID: "overlap-sheet-id",
    GOOGLE_CLIENT_EMAIL: "service@example.com",
    GOOGLE_PRIVATE_KEY: "test-key",
    WHATSAPP_TOKEN: "test-token",
    PHONE_NUMBER_ID: "phone-id",
    FERTILIZER_REMINDER_DRY_RUN: "false",
    FERTILIZER_REMINDER_TEMPLATE_NAME: "fertilizer_reminder_ml_en",
    FERTILIZER_REMINDER_TEMPLATE_STATUS: "APPROVED"
  };
  const options = {
    sheets: sheets,
    now: new Date("2026-10-17T08:00:00Z"),
    env: env,
    acquireRunLock: async function () { return { release: async function () {} }; },
    axios: { post: async function () {
      postCount += 1;
      signalPostStarted();
      await postGate;
      return { data: { messages: [{ id: "wamid.only-once" }] } };
    } }
  };
  const firstRun = runFertilizerReminders(options);
  await postStarted;
  const overlappingRun = await runFertilizerReminders(options);
  releasePost();
  const completedRun = await firstRun;
  assert.equal(overlappingRun.reason, "REMINDER_RUN_ALREADY_ACTIVE");
  assert.equal(overlappingRun.skipped, true);
  assert.equal(completedRun.sent, 1);
  assert.equal(postCount, 1);
  assert.equal(appendCount, 1);
});

test("a run skipped by an external lock does not block a later retry", async function () {
  const landRows = [LAND_HEADERS];
  const notificationRows = [NOTIFICATION_HEADERS];
  const sheets = {
    spreadsheets: { values: {
      get: async function (request) {
        return { data: { values: request.range.includes("Land_Parcels") ? landRows : notificationRows } };
      }
    } }
  };
  const env = {
    GOOGLE_SHEET_ID: "external-lock-sheet-id",
    GOOGLE_CLIENT_EMAIL: "service@example.com",
    GOOGLE_PRIVATE_KEY: "test-key",
    WHATSAPP_TOKEN: "test-token",
    PHONE_NUMBER_ID: "phone-id",
    FERTILIZER_REMINDER_DRY_RUN: "false",
    FERTILIZER_REMINDER_TEMPLATE_NAME: "fertilizer_reminder_ml_en",
    FERTILIZER_REMINDER_TEMPLATE_STATUS: "APPROVED"
  };
  const skipped = await runFertilizerReminders({
    sheets: sheets,
    env: env,
    acquireRunLock: async function () { return null; }
  });
  const retried = await runFertilizerReminders({
    sheets: sheets,
    env: env,
    acquireRunLock: async function () { return { release: async function () {} }; }
  });
  assert.equal(skipped.reason, "REMINDER_RUN_ALREADY_ACTIVE");
  assert.equal(retried.reason, "");
  assert.equal(retried.skipped, undefined);
});
