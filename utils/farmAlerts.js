"use strict";

const crypto = require("crypto");

const LAND_SHEET = "Land_Parcels";
const NOTIFICATION_SHEET = "Notification_Log";
const RECORD_PREFIX = "BM_FERTILIZER_DIARY_V1|";
const OPERATION_TYPE = "Fertilizer Application";
const REMINDER_LEAD_DAYS = 2;
const KERALA_TIME_ZONE = "Asia/Kolkata";
const inFlightOperationSaves = new Map();

const FARM_ALERT_ACTION_IDS = Object.freeze({
  OPEN: "FARM_ALERTS_OPEN",
  ADD: "FARM_ALERT_ADD_COMPLETED",
  PLAN: "FARM_ALERT_PLAN",
  ACTIVE: "FARM_ALERT_ACTIVE",
  HISTORY: "FARM_ALERT_HISTORY",
  DATE_TODAY: "FARM_ALERT_DATE_TODAY",
  DATE_YESTERDAY: "FARM_ALERT_DATE_YESTERDAY",
  DATE_TOMORROW: "FARM_ALERT_DATE_TOMORROW",
  DATE_IN_TWO_DAYS: "FARM_ALERT_DATE_IN_TWO_DAYS",
  DATE_CHOOSE: "FARM_ALERT_DATE_CHOOSE",
  SAVE: "FARM_ALERT_SAVE",
  CHANGE: "FARM_ALERT_CHANGE",
  CANCEL: "FARM_ALERT_CANCEL",
  FARM_MENU: "FARM_ALERT_FARM_MENU",
  MAIN_MENU: "FARM_ALERT_MAIN_MENU"
});

const FARM_ALERT_PREFIXES = Object.freeze({
  LAND: "FARM_ALERT_LAND:",
  CROP: "FARM_ALERT_CROP:",
  VIEW: "FARM_ALERT_VIEW:",
  DONE: "FARM_ALERT_DONE:"
});

function clean(value) {
  return value == null ? "" : String(value).trim();
}

function normalize(value) {
  return clean(value).toLowerCase();
}

function normalizeHeader(value) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function makeHeaderMap(headers) {
  const map = Object.create(null);
  (headers || []).forEach(function (header, index) {
    const key = normalizeHeader(header);
    if (key && map[key] === undefined) map[key] = index;
  });
  return map;
}

function getValue(row, map, aliases) {
  for (const alias of aliases || []) {
    const index = map[normalizeHeader(alias)];
    if (index !== undefined) return row && row[index] != null ? row[index] : "";
  }
  return "";
}

function buildRowFromHeaders(headers, values) {
  const normalized = Object.create(null);
  Object.keys(values || {}).forEach(function (key) {
    normalized[normalizeHeader(key)] = values[key];
  });
  return (headers || []).map(function (header) {
    const key = normalizeHeader(header);
    return Object.prototype.hasOwnProperty.call(normalized, key) ? normalized[key] : "";
  });
}

function sheetSafe(value) {
  const text = clean(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function parseDateKey(value) {
  const text = clean(value);
  const dmy = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  const ymd = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let year;
  let month;
  let day;
  if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
  } else if (ymd) {
    year = Number(ymd[1]);
    month = Number(ymd[2]);
    day = Number(ymd[3]);
  } else {
    return "";
  }
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

function dateKey(value) {
  if (typeof value === "string") return parseDateKey(value);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KERALA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.create(null);
  parts.forEach(function (part) { values[part.type] = part.value; });
  return values.year + "-" + values.month + "-" + values.day;
}

function addDays(key, days) {
  const valid = parseDateKey(key);
  if (!valid) return "";
  const parts = valid.split("-").map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + Number(days || 0)));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}

function daysBetween(fromKey, toKey) {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  if (!from || !to) return null;
  const fromParts = from.split("-").map(Number);
  const toParts = to.split("-").map(Number);
  return Math.round((
    Date.UTC(toParts[0], toParts[1] - 1, toParts[2]) -
    Date.UTC(fromParts[0], fromParts[1] - 1, fromParts[2])
  ) / 86400000);
}

function readOwnedLands(sheetRows) {
  const rows = Array.isArray(sheetRows) ? sheetRows : [];
  const headers = rows[0] || [];
  const map = makeHeaderMap(headers);
  return rows.slice(1).map(function (row, index) {
    return {
      rowNumber: index + 2,
      landId: clean(getValue(row, map, ["Land_ID"])),
      farmerId: clean(getValue(row, map, ["Farmer_ID", "Member_ID"])),
      farmName: clean(getValue(row, map, ["Farm_Name", "Land_Name"])),
      district: clean(getValue(row, map, ["District"])),
      panchayat: clean(getValue(row, map, ["Local_Body", "Panchayat", "Panchayath"])),
      mainCrop: clean(getValue(row, map, ["Main_Crop", "Crop"])),
      otherCrops: clean(getValue(row, map, ["Other_Crops"])),
      activeStatus: clean(getValue(row, map, ["Active_Status", "Status"]))
    };
  }).filter(function (land) {
    return land.landId && land.farmerId && !/inactive|closed|deleted/i.test(land.activeStatus);
  });
}

function readFarmerLands(sheetRows, farmerId) {
  const target = normalize(farmerId);
  if (!target) return [];
  return readOwnedLands(sheetRows).filter(function (land) {
    return normalize(land.farmerId) === target;
  });
}

function cropsForLand(land) {
  const values = [clean(land && land.mainCrop)].concat(
    clean(land && land.otherCrops).split(/[,;|/]/).map(clean)
  ).filter(Boolean);
  const seen = new Set();
  return values.filter(function (crop) {
    const key = normalize(crop.replace(/\s+/g, " "));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function registeredCrop(land, crop) {
  const target = normalize(crop);
  return cropsForLand(land).find(function (candidate) {
    return normalize(candidate) === target;
  }) || "";
}

function serializeRecord(record) {
  return RECORD_PREFIX + JSON.stringify(record || {});
}

function parseRecord(value) {
  const text = clean(value);
  if (!text.startsWith(RECORD_PREFIX)) return null;
  try {
    const record = JSON.parse(text.slice(RECORD_PREFIX.length));
    return record && typeof record === "object" ? record : null;
  } catch (error) {
    return null;
  }
}

function readNotificationRecords(sheetRows, farmerId) {
  const rows = Array.isArray(sheetRows) ? sheetRows : [];
  const headers = rows[0] || [];
  const map = makeHeaderMap(headers);
  const target = normalize(farmerId);
  return rows.slice(1).map(function (row, index) {
    const record = parseRecord(getValue(row, map, ["Remarks"]));
    const rowFarmerId = clean(getValue(row, map, ["User_ID"]));
    if (!record || !rowFarmerId || normalize(record.farmerId) !== normalize(rowFarmerId)) return null;
    if (target && normalize(rowFarmerId) !== target) return null;
    return Object.assign({}, record, {
      notificationId: clean(getValue(row, map, ["Notification_ID"])) || clean(record.notificationId),
      mobile: clean(getValue(row, map, ["Mobile_No"])) || clean(record.mobile),
      whatsappStatus: clean(getValue(row, map, ["WhatsApp Status"])),
      rowNumber: index + 2,
      headers: headers,
      rawRow: row.slice()
    });
  }).filter(Boolean);
}

function stableId(parts, prefix) {
  return clean(prefix) + crypto.createHash("sha256")
    .update((parts || []).map(clean).join("|"))
    .digest("hex").slice(0, 20).toUpperCase();
}

function notificationHeadersPresent(headers) {
  const map = makeHeaderMap(headers);
  return ["Notification_ID", "Date", "User_ID", "Mobile_No", "Message", "WhatsApp Status", "Remarks"]
    .every(function (header) { return map[normalizeHeader(header)] !== undefined; });
}

function bilingualOperationSummary(record) {
  const statusMl = normalize(record.status) === "completed" ? "പൂർത്തിയായി" : "ആസൂത്രണം ചെയ്തു";
  const statusEn = normalize(record.status) === "completed" ? "Completed" : "Planned";
  const details = [record.farmName, record.crop, record.dueDate].filter(Boolean).join(" • ");
  return [
    "വളപ്രയോഗം — " + statusMl,
    details,
    "Fertilizer application — " + statusEn,
    details
  ].filter(Boolean).join("\n");
}

function validateOperationDate(status, operationDate, now) {
  const selected = parseDateKey(operationDate);
  if (!selected) return false;
  const difference = daysBetween(dateKey(now || new Date()), selected);
  if (difference === null) return false;
  return normalize(status) === "completed" ? difference <= 0 : difference >= REMINDER_LEAD_DAYS;
}

async function saveFarmOperation(options) {
  const input = options || {};
  const farmer = input.farmer || {};
  const land = input.land || {};
  const farmerId = clean(farmer.memberId);
  const status = /completed/i.test(clean(input.status)) ? "Completed" : /planned/i.test(clean(input.status)) ? "Planned" : "";
  const operationDate = parseDateKey(input.operationDate || input.dueDate);
  const crop = registeredCrop(land, input.crop);
  if (!farmerId) return { success: false, code: "FARMER_REQUIRED" };
  if (!clean(land.landId) || !clean(land.farmerId) || normalize(land.farmerId) !== normalize(farmerId)) {
    return { success: false, code: "INVALID_LAND_OWNERSHIP" };
  }
  if (!crop) return { success: false, code: "INVALID_REGISTERED_CROP" };
  if (!status) return { success: false, code: "INVALID_STATUS" };
  const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
  if (!validateOperationDate(status, operationDate, now)) return { success: false, code: "INVALID_OPERATION_DATE" };
  if (status === "Planned" && input.reminderOptIn !== true) return { success: false, code: "REMINDER_OPT_IN_REQUIRED" };

  const notificationId = stableId([farmerId, land.landId, crop, OPERATION_TYPE, status, operationDate], "FF-");
  const pendingSave = inFlightOperationSaves.get(notificationId);
  if (pendingSave) {
    const pendingResult = await pendingSave;
    return pendingResult.success
      ? Object.assign({}, pendingResult, { duplicate: true })
      : pendingResult;
  }

  const savePromise = (async function () {
    const currentRows = typeof input.readNotificationRows === "function"
      ? await input.readNotificationRows()
      : input.notificationRows;
    const headers = (currentRows && currentRows[0]) || [];
    if (!notificationHeadersPresent(headers)) return { success: false, code: "NOTIFICATION_SCHEMA_UNAVAILABLE" };

    const existing = readNotificationRecords(currentRows, farmerId).find(function (record) {
      return record.notificationId === notificationId || (
        record.kind === "fertilizer-operation" && normalize(record.landId) === normalize(land.landId) &&
        normalize(record.crop) === normalize(crop) && normalize(record.status) === normalize(status) &&
        clean(record.dueDate) === operationDate
      );
    });
    if (existing) return { success: true, duplicate: true, record: existing };

    const record = {
      version: 1,
      kind: "fertilizer-operation",
      notificationId: notificationId,
      farmerId: farmerId,
      landId: clean(land.landId),
      farmName: clean(land.farmName),
      crop: crop,
      operationType: OPERATION_TYPE,
      dueDate: operationDate,
      status: status,
      reminderOptIn: status === "Planned",
      reminderLeadDays: status === "Planned" ? REMINDER_LEAD_DAYS : 0,
      mobile: clean(farmer.whatsapp || farmer.mobile || input.farmerWhatsApp),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    if (status === "Completed") record.completedAt = now.toISOString();
    const row = buildRowFromHeaders(headers, {
      Notification_ID: notificationId,
      Date: now.toISOString(),
      User_Type: "Farmer",
      User_ID: farmerId,
      Mobile_No: record.mobile,
      Message: sheetSafe(bilingualOperationSummary(record)),
      "WhatsApp Status": status === "Planned" ? "Not Sent" : "Not Required",
      Remarks: serializeRecord(record)
    });
    const appended = await input.appendNotification(NOTIFICATION_SHEET, row);
    return appended === true || Boolean(appended && appended.success === true)
      ? { success: true, duplicate: false, record: record }
      : { success: false, code: "SAVE_FAILED" };
  })();

  inFlightOperationSaves.set(notificationId, savePromise);
  try {
    return await savePromise;
  } finally {
    if (inFlightOperationSaves.get(notificationId) === savePromise) {
      inFlightOperationSaves.delete(notificationId);
    }
  }
}

function activePlannedOperation(record) {
  return record && record.kind === "fertilizer-operation" && normalize(record.status) === "planned";
}

function dueOperations(records, now, windowDays) {
  const today = dateKey(now || new Date());
  const maximum = Number.isFinite(windowDays) ? windowDays : REMINDER_LEAD_DAYS;
  return (records || []).filter(activePlannedOperation).map(function (record) {
    return Object.assign({}, record, { daysUntilDue: daysBetween(today, record.dueDate) });
  }).filter(function (record) {
    return record.daysUntilDue !== null && record.daysUntilDue <= maximum;
  }).sort(function (left, right) { return left.daysUntilDue - right.daysUntilDue; });
}

async function updateFarmOperation(options) {
  const input = options || {};
  const farmerId = clean(input.farmerId);
  const record = (input.records || []).find(function (item) {
    return clean(item.notificationId) === clean(input.notificationId) && item.kind === "fertilizer-operation";
  });
  if (!record) return { success: false, code: "INVALID_ALERT" };
  if (!farmerId || normalize(record.farmerId) !== normalize(farmerId)) return { success: false, code: "WRONG_FARMER" };
  const ownedLand = (input.lands || []).find(function (land) {
    return normalize(land.landId) === normalize(record.landId) && normalize(land.farmerId) === normalize(farmerId);
  });
  if (!ownedLand) return { success: false, code: "LAND_OWNERSHIP_UNVERIFIED" };
  if (normalize(input.action) !== "done") return { success: false, code: "INVALID_ACTION" };
  if (!activePlannedOperation(record)) return { success: false, code: "CLOSED_ALERT" };

  const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
  const updated = Object.assign({}, record, {
    status: "Completed",
    reminderOptIn: false,
    reminderLeadDays: 0,
    completedAt: now.toISOString(),
    updatedAt: now.toISOString()
  });
  delete updated.headers;
  delete updated.rawRow;
  delete updated.rowNumber;
  delete updated.whatsappStatus;
  const map = makeHeaderMap(record.headers || []);
  const row = (record.rawRow || []).slice();
  const values = { Date: now.toISOString(), Message: sheetSafe(bilingualOperationSummary(updated)), Remarks: serializeRecord(updated) };
  Object.keys(values).forEach(function (header) {
    const index = map[normalizeHeader(header)];
    if (index !== undefined) row[index] = values[header];
  });
  const saved = await input.writeNotification(record.rowNumber, row);
  return saved === true || Boolean(saved && saved.success === true)
    ? { success: true, record: updated }
    : { success: false, code: "UPDATE_FAILED" };
}

function buildMyAlerts(records, lands, now) {
  const ownedIds = new Set((lands || []).map(function (land) { return normalize(land.landId); }));
  const operations = (records || []).filter(function (record) {
    return record.kind === "fertilizer-operation" && ownedIds.has(normalize(record.landId));
  });
  const planned = operations.filter(activePlannedOperation).map(function (record) {
    const daysUntilDue = daysBetween(dateKey(now || new Date()), record.dueDate);
    return Object.assign({}, record, {
      type: "operation",
      alertId: record.notificationId,
      title: "വളപ്രയോഗം / Fertilizer",
      message: daysUntilDue < 0
        ? "തീയതി കഴിഞ്ഞു / Overdue by " + Math.abs(daysUntilDue) + " day(s)."
        : daysUntilDue === 0 ? "ഇന്ന് / Due today." : daysUntilDue + " ദിവസത്തിൽ / Due in " + daysUntilDue + " day(s)."
    });
  }).sort(function (left, right) { return clean(left.dueDate).localeCompare(clean(right.dueDate)); });
  return {
    due: planned,
    completed: operations.filter(function (record) { return normalize(record.status) === "completed"; })
  };
}

function encodeActionValue(value) {
  return encodeURIComponent(clean(value));
}

function decodeActionValue(value) {
  try {
    return clean(decodeURIComponent(value));
  } catch (error) {
    return "";
  }
}

function parseFarmAlertAction(selectionId) {
  const id = clean(selectionId);
  const fixed = {};
  Object.keys(FARM_ALERT_ACTION_IDS).forEach(function (key) { fixed[FARM_ALERT_ACTION_IDS[key]] = { action: key }; });
  if (fixed[id]) return fixed[id];
  const dynamic = [
    [FARM_ALERT_PREFIXES.LAND, "LAND", "landId"],
    [FARM_ALERT_PREFIXES.CROP, "CROP", "crop"],
    [FARM_ALERT_PREFIXES.VIEW, "VIEW", "alertId"],
    [FARM_ALERT_PREFIXES.DONE, "DONE", "notificationId"]
  ];
  for (const entry of dynamic) {
    if (!id.startsWith(entry[0])) continue;
    const value = decodeActionValue(id.slice(entry[0].length));
    if (!value) return null;
    const result = { action: entry[1] };
    result[entry[2]] = value;
    return result;
  }
  return null;
}

function buildLandSelectionRows(lands) {
  return (lands || []).slice(0, 10).map(function (land) {
    return {
      id: FARM_ALERT_PREFIXES.LAND + encodeActionValue(land.landId),
      title: clean(land.farmName || land.mainCrop || "Farm").slice(0, 24),
      description: [land.mainCrop, land.district].filter(Boolean).join(" • ").slice(0, 72)
    };
  });
}

function buildCropSelectionRows(land) {
  return cropsForLand(land).slice(0, 10).map(function (crop) {
    return { id: FARM_ALERT_PREFIXES.CROP + encodeActionValue(crop), title: crop.slice(0, 24), description: "ഈ വിള / This registered crop" };
  });
}

function selectedOperationDate(action, now) {
  const today = dateKey(now || new Date());
  const key = clean(action).toUpperCase();
  if (key === "DATE_TODAY") return today;
  if (key === "DATE_YESTERDAY") return addDays(today, -1);
  if (key === "DATE_TOMORROW") return addDays(today, 1);
  if (key === "DATE_IN_TWO_DAYS") return addDays(today, REMINDER_LEAD_DAYS);
  return "";
}

function parseOperationInput(value) {
  const text = clean(value);
  const match = text.match(/(?:^|\s)(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4})(?:\s|$)/);
  if (!match) return { success: false, code: "DATE_REQUIRED" };
  const operationDate = parseDateKey(match[1]);
  return operationDate ? { success: true, operationDate: operationDate, dueDate: operationDate } : { success: false, code: "INVALID_DATE" };
}

function buildOperationConfirmation(session) {
  const input = session || {};
  const planned = normalize(input.status) === "planned";
  return [
    "🌿 വളപ്രയോഗം " + (planned ? "ആസൂത്രണം" : "ഡയറി രേഖ"),
    "കൃഷിയിടം: " + clean(input.land && input.land.farmName),
    "വിള: " + clean(input.crop),
    "തീയതി: " + clean(input.operationDate),
    planned ? "ഓർമ്മപ്പെടുത്തൽ: 2 ദിവസം മുമ്പ് (സമ്മതിച്ചു)" : "നില: പൂർത്തിയായി",
    "",
    "🌿 Fertilizer application " + (planned ? "plan" : "diary entry"),
    "Farm: " + clean(input.land && input.land.farmName),
    "Crop: " + clean(input.crop),
    "Date: " + clean(input.operationDate),
    planned ? "Reminder: 2 days before (opted in)" : "Status: Completed",
    "",
    "സ്ഥിരീകരിക്കണോ? / Confirm?"
  ].join("\n");
}

function buildAlertRows(alerts) {
  return ((alerts && alerts.due) || []).slice(0, 10).map(function (alert) {
    return {
      id: FARM_ALERT_PREFIXES.VIEW + encodeActionValue(alert.alertId),
      title: clean(alert.crop || "Fertilizer").slice(0, 24),
      description: [alert.farmName, alert.dueDate].filter(Boolean).join(" • ").slice(0, 72)
    };
  });
}

function findAlert(alerts, alertId) {
  const target = clean(alertId);
  return [].concat(alerts && alerts.due || [], alerts && alerts.completed || []).find(function (alert) {
    return clean(alert.alertId || alert.notificationId) === target;
  }) || null;
}

function buildAlertDetail(alert) {
  const input = alert || {};
  return [
    "🌿 വളപ്രയോഗ ഓർമ്മപ്പെടുത്തൽ",
    "കൃഷിയിടം: " + clean(input.farmName),
    "വിള: " + clean(input.crop),
    "തീയതി: " + clean(input.dueDate),
    "",
    "🌿 Fertilizer application reminder",
    "Farm: " + clean(input.farmName),
    "Crop: " + clean(input.crop),
    "Date: " + clean(input.dueDate)
  ].join("\n");
}

function buildReminderMessage(record) {
  return [
    "🌿 വളപ്രയോഗ ഓർമ്മപ്പെടുത്തൽ",
    clean(record.farmName) + " കൃഷിയിടത്തിലെ " + clean(record.crop) + " വിളയ്ക്ക് " + clean(record.dueDate) + "-ന് വളപ്രയോഗം ആസൂത്രണം ചെയ്തിട്ടുണ്ട്.",
    "",
    "🌿 Fertilizer application reminder",
    "Fertilizer application for " + clean(record.crop) + " at " + clean(record.farmName) + " is planned for " + clean(record.dueDate) + "."
  ].join("\n");
}

function deliveryKey(alert) {
  return stableId([alert && alert.farmerId, alert && (alert.operationId || alert.notificationId), "two-day"], "FR-");
}

function wasDelivered(records, alert) {
  const key = deliveryKey(alert);
  return (records || []).some(function (record) {
    return record.kind === "fertilizer-reminder-delivery" && clean(record.deliveryKey) === key && /^(sent|accepted)$/i.test(clean(record.status));
  });
}

function approvedTemplate(input) {
  const name = clean(input && input.approvedTemplateName);
  return /^[a-z0-9_]+$/.test(name) && normalize(input && input.templateStatus) === "approved" ? name : "";
}

function buildDispatchPlan(options) {
  const input = options || {};
  const templateName = approvedTemplate(input);
  if (!templateName) {
    return { enabled: false, reason: "APPROVED_TEMPLATE_REQUIRED", farmersChecked: 0, alerts: [], notificationsProposed: 0 };
  }
  const lands = input.lands || [];
  const records = input.records || [];
  const today = dateKey(input.now || new Date());
  const proposedKeys = new Set();
  const candidates = records.filter(activePlannedOperation).filter(function (record) {
    if (record.reminderOptIn !== true || Number(record.reminderLeadDays) !== REMINDER_LEAD_DAYS) return false;
    if (daysBetween(today, record.dueDate) !== REMINDER_LEAD_DAYS) return false;
    return lands.some(function (land) {
      return normalize(land.landId) === normalize(record.landId) && normalize(land.farmerId) === normalize(record.farmerId) && Boolean(clean(land.farmerId));
    });
  }).filter(function (record) {
    return clean(record.mobile) && !wasDelivered(records, record);
  }).filter(function (record) {
    const key = deliveryKey(record);
    if (proposedKeys.has(key)) return false;
    proposedKeys.add(key);
    return true;
  }).map(function (record) {
    return Object.assign({}, record, {
      operationId: record.notificationId,
      deliveryKey: deliveryKey(record),
      templateName: templateName,
      templateLanguageCode: clean(input.templateLanguageCode) || "ml",
      reminderMessage: buildReminderMessage(record)
    });
  });
  return {
    enabled: true,
    reason: "",
    farmersChecked: new Set(records.filter(activePlannedOperation).map(function (record) { return record.farmerId; })).size,
    alerts: candidates,
    notificationsProposed: candidates.length
  };
}

function createReminderTemplatePayload(alert) {
  const input = alert || {};
  if (!clean(input.mobile) || !approvedTemplate({ approvedTemplateName: input.templateName, templateStatus: "APPROVED" })) return null;
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: clean(input.mobile),
    type: "template",
    template: {
      name: clean(input.templateName),
      language: { code: clean(input.templateLanguageCode) || "ml" },
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: clean(input.farmName) },
          { type: "text", text: clean(input.crop) },
          { type: "text", text: clean(input.dueDate) }
        ]
      }]
    }
  };
}

async function recordAlertDelivery(options) {
  const input = options || {};
  const alert = input.alert || {};
  const headers = (input.notificationRows && input.notificationRows[0]) || [];
  if (input.accepted !== true || !clean(input.providerMessageId)) return { success: false, code: "DELIVERY_NOT_ACCEPTED" };
  if (!notificationHeadersPresent(headers)) return { success: false, code: "NOTIFICATION_SCHEMA_UNAVAILABLE" };
  const records = readNotificationRecords(input.notificationRows, alert.farmerId);
  if (wasDelivered(records, alert)) return { success: true, duplicate: true, deliveryKey: deliveryKey(alert) };
  const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
  const key = deliveryKey(alert);
  const record = {
    version: 1,
    kind: "fertilizer-reminder-delivery",
    notificationId: key,
    deliveryKey: key,
    farmerId: clean(alert.farmerId),
    landId: clean(alert.landId),
    operationId: clean(alert.operationId || alert.notificationId),
    templateName: clean(alert.templateName),
    status: "Accepted",
    providerMessageId: clean(input.providerMessageId),
    sentAt: now.toISOString()
  };
  const row = buildRowFromHeaders(headers, {
    Notification_ID: key,
    Date: now.toISOString(),
    User_Type: "Farmer",
    User_ID: alert.farmerId,
    Mobile_No: alert.mobile,
    Message: sheetSafe(alert.reminderMessage || buildReminderMessage(alert)),
    "WhatsApp Status": "Accepted",
    Remarks: serializeRecord(record)
  });
  const appended = await input.appendNotification(NOTIFICATION_SHEET, row);
  return appended === true || Boolean(appended && appended.success === true)
    ? { success: true, duplicate: false, deliveryKey: key, row: row }
    : { success: false, code: "SAVE_FAILED" };
}

module.exports = {
  FARM_ALERT_ACTION_IDS,
  FARM_ALERT_PREFIXES,
  KERALA_TIME_ZONE,
  LAND_SHEET,
  NOTIFICATION_SHEET,
  OPERATION_TYPE,
  RECORD_PREFIX,
  REMINDER_LEAD_DAYS,
  addDays,
  buildAlertDetail,
  buildAlertRows,
  buildCropSelectionRows,
  buildDispatchPlan,
  buildLandSelectionRows,
  buildMyAlerts,
  buildOperationConfirmation,
  buildReminderMessage,
  createReminderTemplatePayload,
  cropsForLand,
  dateKey,
  deliveryKey,
  dueOperations,
  findAlert,
  parseFarmAlertAction,
  parseOperationInput,
  parseRecord,
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
};
