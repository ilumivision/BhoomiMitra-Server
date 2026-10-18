"use strict";

require("dotenv").config();

const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { google } = require("googleapis");
const {
  LAND_SHEET,
  NOTIFICATION_SHEET,
  buildDispatchPlan,
  createReminderTemplatePayload,
  readNotificationRecords,
  readOwnedLands,
  recordAlertDelivery
} = require("../utils/farmAlerts");

const activeReminderRuns = new Set();

function isLiveEnabled(env) {
  return String((env || {}).FERTILIZER_REMINDER_DRY_RUN || "true").toLowerCase() === "false";
}

function requireEnvironment(env, live) {
  const input = env || {};
  const required = [
    "GOOGLE_SHEET_ID",
    "GOOGLE_CLIENT_EMAIL",
    "GOOGLE_PRIVATE_KEY"
  ];
  if (live === true) required.push("WHATSAPP_TOKEN", "PHONE_NUMBER_ID");
  const missing = required.filter(function (key) { return !String(input[key] || "").trim(); });
  if (missing.length) throw new Error("Missing required environment variables: " + missing.join(", "));
}

function createSheetsClient(env) {
  const privateKey = String(env.GOOGLE_PRIVATE_KEY || "")
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n")
    .trim();
  const auth = new google.auth.JWT({
    email: env.GOOGLE_CLIENT_EMAIL,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  return google.sheets({ version: "v4", auth: auth });
}

async function readRows(sheets, spreadsheetId, sheetName, columns) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: "'" + sheetName + "'!" + columns
  });
  return response && response.data && Array.isArray(response.data.values) ? response.data.values : [];
}

async function appendRow(sheets, spreadsheetId, sheetName, row) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId,
    range: "'" + sheetName + "'!A:J",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] }
  });
  return true;
}

function reminderRunKey(spreadsheetId) {
  return crypto.createHash("sha256").update(String(spreadsheetId || "")).digest("hex").slice(0, 20);
}

function reminderLockPath(env, spreadsheetId) {
  const configured = String((env || {}).FERTILIZER_REMINDER_LOCK_FILE || "").trim();
  return configured || path.join(os.tmpdir(), "bhoomimitra-fertilizer-reminders-" + reminderRunKey(spreadsheetId) + ".lock");
}

function processIsRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error && error.code === "ESRCH" ? false : true;
  }
}

async function acquireReminderRunLock(options) {
  const input = options || {};
  const lockPath = reminderLockPath(input.env, input.spreadsheetId);
  let handle;
  try {
    handle = await fs.promises.open(lockPath, "wx");
  } catch (error) {
    if (!error || error.code !== "EEXIST") throw error;
    try {
      const owner = JSON.parse(await fs.promises.readFile(lockPath, "utf8"));
      if (processIsRunning(Number(owner.pid)) === false) {
        await fs.promises.unlink(lockPath);
        handle = await fs.promises.open(lockPath, "wx");
      } else {
        return null;
      }
    } catch (staleError) {
      if (staleError && staleError.code === "EEXIST") return null;
      if (!handle) return null;
    }
  }

  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), "utf8");
  } catch (error) {
    try {
      await handle.close();
    } finally {
      await fs.promises.unlink(lockPath).catch(function () {});
    }
    throw error;
  }
  let released = false;
  return {
    path: lockPath,
    release: async function () {
      if (released) return;
      released = true;
      try {
        await handle.close();
      } finally {
        try {
          await fs.promises.unlink(lockPath);
        } catch (error) {
          if (!error || error.code !== "ENOENT") throw error;
        }
      }
    }
  };
}

function overlappingRunSummary() {
  return {
    mode: "LIVE",
    enabled: false,
    reason: "REMINDER_RUN_ALREADY_ACTIVE",
    ownedLands: 0,
    farmersChecked: 0,
    notificationsProposed: 0,
    sent: 0,
    failed: 0,
    skipped: true
  };
}

async function runFertilizerReminders(options) {
  const input = options || {};
  const env = input.env || process.env;
  const live = isLiveEnabled(env);
  requireEnvironment(env, live);
  const spreadsheetId = env.GOOGLE_SHEET_ID;
  const runKey = reminderRunKey(spreadsheetId);
  let runLock = null;
  if (live) {
    if (activeReminderRuns.has(runKey)) return overlappingRunSummary();
    activeReminderRuns.add(runKey);
    try {
      const acquireLock = input.acquireRunLock || acquireReminderRunLock;
      runLock = await acquireLock({ env: env, spreadsheetId: spreadsheetId });
      if (!runLock) {
        activeReminderRuns.delete(runKey);
        return overlappingRunSummary();
      }
    } catch (error) {
      activeReminderRuns.delete(runKey);
      throw error;
    }
  }

  try {
    const sheets = input.sheets || createSheetsClient(env);
    const landRows = await readRows(sheets, spreadsheetId, LAND_SHEET, "A:AS");
    const notificationRows = await readRows(sheets, spreadsheetId, NOTIFICATION_SHEET, "A:J");
    const lands = readOwnedLands(landRows);
    const records = readNotificationRecords(notificationRows);
    const plan = buildDispatchPlan({
      lands: lands,
      records: records,
      now: input.now || new Date(),
      approvedTemplateName: env.FERTILIZER_REMINDER_TEMPLATE_NAME,
      templateStatus: env.FERTILIZER_REMINDER_TEMPLATE_STATUS,
      templateLanguageCode: env.FERTILIZER_REMINDER_TEMPLATE_LANGUAGE || "ml"
    });
    const summary = {
      mode: live ? "LIVE" : "DRY_RUN_READ_ONLY",
      enabled: plan.enabled,
      reason: plan.reason,
      ownedLands: lands.length,
      farmersChecked: plan.farmersChecked,
      notificationsProposed: plan.notificationsProposed,
      sent: 0,
      failed: 0
    };
    if (!live || !plan.enabled) return summary;

    for (const alert of plan.alerts) {
      try {
        const payload = createReminderTemplatePayload(alert);
        if (!payload) throw new Error("Approved template payload could not be created.");
        const response = await (input.axios || axios).post(
          "https://graph.facebook.com/v25.0/" + env.PHONE_NUMBER_ID + "/messages",
          payload,
          { headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN, "Content-Type": "application/json" } }
        );
        const providerMessageId = response && response.data && response.data.messages && response.data.messages[0]
          ? String(response.data.messages[0].id || "").trim()
          : "";
        const logged = await recordAlertDelivery({
          alert: alert,
          accepted: Boolean(providerMessageId),
          providerMessageId: providerMessageId,
          notificationRows: notificationRows,
          now: input.now || new Date(),
          appendNotification: async function (sheetName, row) {
            const saved = await appendRow(sheets, spreadsheetId, sheetName, row);
            if (saved) notificationRows.push(row);
            return saved;
          }
        });
        if (!logged.success) throw new Error("Accepted reminder could not be recorded: " + logged.code);
        summary.sent += 1;
      } catch (error) {
        summary.failed += 1;
        console.error("Fertilizer reminder failed:", error && error.message ? error.message : error);
      }
    }
    return summary;
  } finally {
    try {
      if (runLock && typeof runLock.release === "function") await runLock.release();
    } finally {
      if (live) activeReminderRuns.delete(runKey);
    }
  }
}

if (require.main === module) {
  runFertilizerReminders().then(function (summary) {
    console.log(JSON.stringify(summary, null, 2));
    if (summary.failed > 0) process.exitCode = 1;
  }).catch(function (error) {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = {
  acquireReminderRunLock,
  isLiveEnabled,
  reminderLockPath,
  requireEnvironment,
  runFertilizerReminders
};
