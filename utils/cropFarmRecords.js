"use strict";

const crypto = require("crypto");

const CROP_SHEET = "Crop_Registry";
const CROP_HISTORY_SHEET = "Crop_History";
const OPERATION_SHEET = "Farm_Operations";
const VERIFIED_ALERT_SHEET = "Crop_Disease_Alerts";

const CROP_HEADERS = Object.freeze([
  "Crop_ID", "Farmer_ID", "Land_ID", "Crop_Name", "Variety", "Crop_Type",
  "Planting_Date", "Cultivated_Area", "Area_Unit", "Crop_Status", "Harvest_Date",
  "Remarks", "Created_At", "Source_Message_ID"
]);
const CROP_HISTORY_HEADERS = Object.freeze([
  "History_ID", "Crop_ID", "Farmer_ID", "Land_ID", "Event_Type", "Event_Date",
  "Crop_Status", "Remarks", "Created_At", "Source_Message_ID"
]);
const OPERATION_HEADERS = Object.freeze([
  "Operation_ID", "Farmer_ID", "Land_ID", "Crop_ID", "Operation_Type",
  "Operation_Date", "Operation_Status", "Input_or_Material", "Quantity", "Unit",
  "Cost", "Remarks", "Created_At", "Source_Message_ID"
]);
const VERIFIED_ALERT_HEADERS = Object.freeze([
  "Alert_ID", "Alert_Category", "Alert_Title", "Crop_Name", "District",
  "Alert_Message", "Precautions", "Source_Name", "Source_URL", "Valid_From",
  "Valid_Until", "Verification_Status", "Alert_Status", "Created_At"
]);

const CROP_FARM_ACTION_IDS = Object.freeze({
  OPEN: "CROP_FARM_OPEN",
  REGISTER: "CROP_FARM_REGISTER",
  MY_CROPS: "CROP_FARM_MY_CROPS",
  HISTORY: "CROP_FARM_HISTORY",
  RECORD_OPERATION: "CROP_FARM_RECORD_OPERATION",
  ACTIVITIES: "CROP_FARM_ACTIVITIES",
  PLANNED: "CROP_FARM_PLANNED",
  ALERTS: "CROP_FARM_ALERTS",
  FERTILIZER: "FARM_ALERTS_OPEN",
  FARM_MENU: "CROP_FARM_FARM_MENU",
  MAIN_MENU: "CROP_FARM_MAIN_MENU",
  SAVE_CROP: "CROP_FARM_SAVE_CROP",
  SAVE_STATUS: "CROP_FARM_SAVE_STATUS",
  SAVE_OPERATION: "CROP_FARM_SAVE_OPERATION",
  UPDATE_STATUS: "CROP_FARM_UPDATE_STATUS",
  CHANGE: "CROP_FARM_CHANGE",
  CANCEL: "CROP_FARM_CANCEL"
});

const CROP_FARM_PREFIXES = Object.freeze({
  CROP_LAND: "CROP_FARM_CROP_LAND:",
  OPERATION_LAND: "CROP_FARM_OP_LAND:",
  OPERATION_TYPE: "CROP_FARM_OP_TYPE:",
  OPERATION_CROP: "CROP_FARM_OP_CROP:",
  STATUS_CROP: "CROP_FARM_STATUS_CROP:"
});

const OPERATION_TYPES = Object.freeze([
  "Land Preparation", "Planting", "Irrigation", "Fertilizer Application",
  "Manure Application", "Plant Protection", "Pruning", "Weeding", "Mulching",
  "Harvesting", "Post-Harvest Operation", "Other"
]);

const activeSaves = new Map();

function clean(value) {
  return value == null ? "" : String(value).trim();
}

function normalize(value) {
  return clean(value).toLowerCase().replace(/\s+/g, " ");
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
    if (index !== undefined) return clean(row && row[index]);
  }
  return "";
}

function hasHeaders(headers, required) {
  const map = makeHeaderMap(headers);
  return required.every(function (header) {
    return map[normalizeHeader(header)] !== undefined;
  });
}

function rowFromHeaders(headers, values) {
  const source = Object.create(null);
  Object.keys(values || {}).forEach(function (key) {
    source[normalizeHeader(key)] = values[key];
  });
  return (headers || []).map(function (header) {
    const value = source[normalizeHeader(header)];
    const text = value == null ? "" : String(value);
    return /^[=+\-@]/.test(text) ? "'" + text : text;
  });
}

function parseDate(value) {
  const text = clean(value);
  if (!text) return "";
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let year;
  let month;
  let day;
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (!match) return "";
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

function todayKey(now) {
  const date = now instanceof Date ? now : new Date(now || Date.now());
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const values = Object.create(null);
  parts.forEach(function (part) { values[part.type] = part.value; });
  return values.year + "-" + values.month + "-" + values.day;
}

function stableId(prefix, parts) {
  return prefix + crypto.createHash("sha256")
    .update((parts || []).map(clean).join("|"))
    .digest("hex").slice(0, 20).toUpperCase();
}

function randomId(prefix) {
  return prefix + crypto.randomBytes(12).toString("hex").toUpperCase();
}

function encode(value) {
  return encodeURIComponent(clean(value));
}

function decode(value) {
  try { return clean(decodeURIComponent(value)); } catch (error) { return ""; }
}

function parseCropFarmAction(selectionId) {
  const id = clean(selectionId);
  if (id === "LAND_ADD_CROP") return { action: "REGISTER" };
  if (id === "LAND_CROP_HISTORY") return { action: "HISTORY" };
  const fixed = {};
  Object.keys(CROP_FARM_ACTION_IDS).forEach(function (key) {
    fixed[CROP_FARM_ACTION_IDS[key]] = { action: key };
  });
  if (fixed[id]) return fixed[id];
  const dynamic = [
    [CROP_FARM_PREFIXES.CROP_LAND, "CROP_LAND", "landId"],
    [CROP_FARM_PREFIXES.OPERATION_LAND, "OPERATION_LAND", "landId"],
    [CROP_FARM_PREFIXES.OPERATION_TYPE, "OPERATION_TYPE", "operationType"],
    [CROP_FARM_PREFIXES.OPERATION_CROP, "OPERATION_CROP", "cropId"],
    [CROP_FARM_PREFIXES.STATUS_CROP, "STATUS_CROP", "cropId"]
  ];
  for (const entry of dynamic) {
    if (!id.startsWith(entry[0])) continue;
    const value = decode(id.slice(entry[0].length));
    if (!value) return null;
    const result = { action: entry[1] };
    result[entry[2]] = value;
    return result;
  }
  return null;
}

function ownedLand(lands, farmerId, landId) {
  const owner = normalize(farmerId);
  return (lands || []).find(function (land) {
    return owner && normalize(land.farmerId) === owner && normalize(land.landId) === normalize(landId);
  }) || null;
}

function readCrops(rows, farmerId) {
  const all = Array.isArray(rows) ? rows : [];
  const headers = all[0] || [];
  const map = makeHeaderMap(headers);
  const owner = normalize(farmerId);
  return all.slice(1).map(function (row, index) {
    const record = {
      rowNumber: index + 2,
      cropId: getValue(row, map, ["Crop_ID"]),
      farmerId: getValue(row, map, ["Farmer_ID"]),
      landId: getValue(row, map, ["Land_ID"]),
      cropName: getValue(row, map, ["Crop_Name", "Crop"]),
      variety: getValue(row, map, ["Variety"]),
      cropType: getValue(row, map, ["Crop_Type", "Cropping_Type"]),
      plantingDate: parseDate(getValue(row, map, ["Planting_Date"])),
      cultivatedArea: getValue(row, map, ["Cultivated_Area", "Area"]),
      areaUnit: getValue(row, map, ["Area_Unit", "Unit"]),
      cropStatus: getValue(row, map, ["Crop_Status", "Status"]),
      harvestDate: parseDate(getValue(row, map, ["Harvest_Date"])),
      remarks: getValue(row, map, ["Remarks"]),
      createdAt: getValue(row, map, ["Created_At"]),
      sourceMessageId: getValue(row, map, ["Source_Message_ID"])
    };
    return record.cropId && record.farmerId && record.landId && record.cropName ? record : null;
  }).filter(function (record) {
    return record && (!owner || normalize(record.farmerId) === owner);
  });
}

function readCropHistory(rows, farmerId) {
  const all = Array.isArray(rows) ? rows : [];
  const headers = all[0] || [];
  const map = makeHeaderMap(headers);
  const owner = normalize(farmerId);
  return all.slice(1).map(function (row, index) {
    const record = {
      rowNumber: index + 2,
      historyId: getValue(row, map, ["History_ID"]),
      cropId: getValue(row, map, ["Crop_ID"]),
      farmerId: getValue(row, map, ["Farmer_ID"]),
      landId: getValue(row, map, ["Land_ID"]),
      eventType: getValue(row, map, ["Event_Type"]),
      eventDate: parseDate(getValue(row, map, ["Event_Date"])),
      cropStatus: getValue(row, map, ["Crop_Status", "Status"]),
      remarks: getValue(row, map, ["Remarks"]),
      createdAt: getValue(row, map, ["Created_At"]),
      sourceMessageId: getValue(row, map, ["Source_Message_ID"])
    };
    return record.historyId && record.cropId && record.farmerId && record.landId ? record : null;
  }).filter(function (record) {
    return record && (!owner || normalize(record.farmerId) === owner);
  });
}

function latestCropStates(crops, history) {
  const events = history || [];
  return (crops || []).map(function (crop) {
    const cropEvents = events.filter(function (event) {
      return normalize(event.cropId) === normalize(crop.cropId) &&
        normalize(event.farmerId) === normalize(crop.farmerId) &&
        normalize(event.landId) === normalize(crop.landId);
    }).sort(function (left, right) {
      return clean(left.eventDate || left.createdAt).localeCompare(clean(right.eventDate || right.createdAt));
    });
    const last = cropEvents[cropEvents.length - 1];
    return Object.assign({}, crop, {
      cropStatus: clean(last && last.cropStatus) || crop.cropStatus,
      harvestDate: /harvest/i.test(clean(last && last.eventType))
        ? clean(last.eventDate) : crop.harvestDate,
      history: cropEvents
    });
  });
}

function isCurrentCrop(crop) {
  return !/completed|harvested|removed|closed|inactive/i.test(clean(crop && crop.cropStatus));
}

function cropFingerprint(input) {
  return [input.farmerId, input.landId, input.cropName, input.variety, input.cropType,
    input.plantingDate, input.cultivatedArea, input.areaUnit].map(normalize).join("|");
}

async function registerCrop(options) {
  const input = options || {};
  const farmerId = clean(input.farmerId);
  const land = input.land || {};
  const cropName = clean(input.cropName);
  const plantingDate = clean(input.plantingDate) ? parseDate(input.plantingDate) : "";
  if (!farmerId) return { success: false, code: "FARMER_REQUIRED" };
  if (!clean(land.landId) || !clean(land.farmerId) || normalize(land.farmerId) !== normalize(farmerId)) {
    return { success: false, code: "LAND_OWNERSHIP_UNVERIFIED" };
  }
  if (!cropName) return { success: false, code: "CROP_REQUIRED" };
  if (clean(input.plantingDate) && !plantingDate) return { success: false, code: "INVALID_PLANTING_DATE" };
  if (!clean(input.cultivatedArea) || !clean(input.areaUnit)) return { success: false, code: "AREA_REQUIRED" };
  if (!Number.isFinite(Number(input.cultivatedArea)) || Number(input.cultivatedArea) <= 0) return { success: false, code: "INVALID_AREA" };
  if (!clean(input.cropStatus)) return { success: false, code: "STATUS_REQUIRED" };
  const rows = Array.isArray(input.cropRows) ? input.cropRows : [];
  const headers = rows[0] || [];
  if (!hasHeaders(headers, CROP_HEADERS)) return { success: false, code: "CROP_SCHEMA_UNAVAILABLE" };
  const candidate = {
    farmerId: farmerId, landId: clean(land.landId), cropName: cropName,
    variety: clean(input.variety), cropType: clean(input.cropType) || "Annual",
    plantingDate: plantingDate, cultivatedArea: clean(input.cultivatedArea),
    areaUnit: clean(input.areaUnit), cropStatus: clean(input.cropStatus),
    harvestDate: clean(input.harvestDate) ? parseDate(input.harvestDate) : "",
    remarks: clean(input.remarks), sourceMessageId: clean(input.sourceMessageId)
  };
  if (clean(input.harvestDate) && !candidate.harvestDate) return { success: false, code: "INVALID_HARVEST_DATE" };
  const existing = readCrops(rows, farmerId).find(function (crop) {
    return (candidate.sourceMessageId && crop.sourceMessageId === candidate.sourceMessageId) ||
      cropFingerprint(crop) === cropFingerprint(candidate);
  });
  if (existing) return { success: true, duplicate: true, crop: existing, cropId: existing.cropId };
  const saveKey = candidate.sourceMessageId || cropFingerprint(candidate);
  if (activeSaves.has("crop:" + saveKey)) {
    const pending = await activeSaves.get("crop:" + saveKey);
    return pending.success ? Object.assign({}, pending, { duplicate: true }) : pending;
  }
  const promise = (async function () {
    const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
    let cropId = typeof input.idFactory === "function" ? clean(input.idFactory("BM-C-")) : randomId("BM-C-");
    const used = new Set(readCrops(rows).map(function (crop) { return normalize(crop.cropId); }));
    if (!cropId || used.has(normalize(cropId))) return { success: false, code: "CROP_ID_COLLISION" };
    const crop = Object.assign({}, candidate, { cropId: cropId, createdAt: now.toISOString() });
    const row = rowFromHeaders(headers, {
      Crop_ID: crop.cropId, Farmer_ID: crop.farmerId, Land_ID: crop.landId,
      Crop_Name: crop.cropName, Variety: crop.variety, Crop_Type: crop.cropType,
      Planting_Date: crop.plantingDate, Cultivated_Area: crop.cultivatedArea,
      Area_Unit: crop.areaUnit, Crop_Status: crop.cropStatus, Harvest_Date: crop.harvestDate,
      Remarks: crop.remarks, Created_At: crop.createdAt, Source_Message_ID: crop.sourceMessageId
    });
    const saved = await input.appendRow(CROP_SHEET, row);
    return saved === true || Boolean(saved && saved.success)
      ? { success: true, duplicate: false, crop: crop, cropId: cropId, row: row }
      : { success: false, code: "SAVE_FAILED" };
  })();
  activeSaves.set("crop:" + saveKey, promise);
  try { return await promise; } finally { activeSaves.delete("crop:" + saveKey); }
}

async function appendCropStatus(options) {
  const input = options || {};
  const crop = (input.crops || []).find(function (item) {
    return normalize(item.cropId) === normalize(input.cropId) &&
      normalize(item.farmerId) === normalize(input.farmerId);
  });
  if (!crop) return { success: false, code: "CROP_OWNERSHIP_UNVERIFIED" };
  if (!ownedLand(input.lands, input.farmerId, crop.landId)) return { success: false, code: "LAND_OWNERSHIP_UNVERIFIED" };
  const eventDate = parseDate(input.eventDate);
  if (!eventDate) return { success: false, code: "INVALID_EVENT_DATE" };
  if (eventDate > todayKey(input.now)) return { success: false, code: "INVALID_EVENT_DATE" };
  if (!/^(completed|harvested|removed|replanted|status update)$/i.test(clean(input.eventType))) {
    return { success: false, code: "INVALID_EVENT_TYPE" };
  }
  if (!clean(input.cropStatus)) return { success: false, code: "STATUS_REQUIRED" };
  const rows = Array.isArray(input.historyRows) ? input.historyRows : [];
  const headers = rows[0] || [];
  if (!hasHeaders(headers, CROP_HISTORY_HEADERS)) return { success: false, code: "CROP_HISTORY_SCHEMA_UNAVAILABLE" };
  const duplicate = readCropHistory(rows, input.farmerId).find(function (event) {
    return (clean(input.sourceMessageId) && event.sourceMessageId === clean(input.sourceMessageId)) ||
      [event.cropId, event.eventType, event.eventDate, event.cropStatus].map(normalize).join("|") ===
      [crop.cropId, input.eventType, eventDate, input.cropStatus].map(normalize).join("|");
  });
  if (duplicate) return { success: true, duplicate: true, event: duplicate };
  const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
  const event = {
    historyId: stableId("BM-CH-", [crop.cropId, input.eventType, eventDate, input.sourceMessageId]),
    cropId: crop.cropId, farmerId: clean(input.farmerId), landId: crop.landId,
    eventType: clean(input.eventType) || "Status Update", eventDate: eventDate,
    cropStatus: clean(input.cropStatus), remarks: clean(input.remarks),
    createdAt: now.toISOString(), sourceMessageId: clean(input.sourceMessageId)
  };
  const row = rowFromHeaders(headers, {
    History_ID: event.historyId, Crop_ID: event.cropId, Farmer_ID: event.farmerId,
    Land_ID: event.landId, Event_Type: event.eventType, Event_Date: event.eventDate,
    Crop_Status: event.cropStatus, Remarks: event.remarks, Created_At: event.createdAt,
    Source_Message_ID: event.sourceMessageId
  });
  const saved = await input.appendRow(CROP_HISTORY_SHEET, row);
  return saved === true || Boolean(saved && saved.success)
    ? { success: true, duplicate: false, event: event, row: row }
    : { success: false, code: "SAVE_FAILED" };
}

function readFarmOperations(rows, farmerId) {
  const all = Array.isArray(rows) ? rows : [];
  const headers = all[0] || [];
  const map = makeHeaderMap(headers);
  const owner = normalize(farmerId);
  return all.slice(1).map(function (row, index) {
    const record = {
      rowNumber: index + 2,
      operationId: getValue(row, map, ["Operation_ID"]),
      farmerId: getValue(row, map, ["Farmer_ID"]),
      landId: getValue(row, map, ["Land_ID"]),
      cropId: getValue(row, map, ["Crop_ID"]),
      operationType: getValue(row, map, ["Operation_Type"]),
      operationDate: parseDate(getValue(row, map, ["Operation_Date"])),
      operationStatus: getValue(row, map, ["Operation_Status", "Status"]),
      inputOrMaterial: getValue(row, map, ["Input_or_Material", "Input_Material"]),
      quantity: getValue(row, map, ["Quantity"]), unit: getValue(row, map, ["Unit"]),
      cost: getValue(row, map, ["Cost"]), remarks: getValue(row, map, ["Remarks"]),
      createdAt: getValue(row, map, ["Created_At"]),
      sourceMessageId: getValue(row, map, ["Source_Message_ID"])
    };
    return record.operationId && record.farmerId && record.landId && record.operationType ? record : null;
  }).filter(function (record) {
    return record && (!owner || normalize(record.farmerId) === owner);
  });
}

async function recordFarmOperation(options) {
  const input = options || {};
  const farmerId = clean(input.farmerId);
  const land = input.land || {};
  const operationType = clean(input.operationType);
  const operationDate = parseDate(input.operationDate);
  const status = /planned/i.test(clean(input.operationStatus)) ? "Planned" :
    /completed|done/i.test(clean(input.operationStatus)) ? "Completed" : "";
  if (!farmerId) return { success: false, code: "FARMER_REQUIRED" };
  if (!clean(land.farmerId) || normalize(land.farmerId) !== normalize(farmerId)) return { success: false, code: "LAND_OWNERSHIP_UNVERIFIED" };
  if (!operationType) return { success: false, code: "OPERATION_TYPE_REQUIRED" };
  if (/fertili[sz]er/i.test(operationType) && input.viaFertilizerDiary !== true) return { success: false, code: "USE_FERTILIZER_DIARY" };
  if (!operationDate) return { success: false, code: "INVALID_OPERATION_DATE" };
  if (!status) return { success: false, code: "INVALID_OPERATION_STATUS" };
  const currentDate = todayKey(input.now);
  if (status === "Completed" && operationDate > currentDate) return { success: false, code: "INVALID_OPERATION_DATE" };
  if (status === "Planned" && operationDate < currentDate) return { success: false, code: "INVALID_OPERATION_DATE" };
  const cropId = clean(input.cropId);
  if (cropId) {
    const crop = (input.crops || []).find(function (item) {
      return normalize(item.cropId) === normalize(cropId) && normalize(item.farmerId) === normalize(farmerId) &&
        normalize(item.landId) === normalize(land.landId);
    });
    if (!crop) return { success: false, code: "CROP_OWNERSHIP_UNVERIFIED" };
  }
  const rows = Array.isArray(input.operationRows) ? input.operationRows : [];
  const headers = rows[0] || [];
  if (!hasHeaders(headers, OPERATION_HEADERS)) return { success: false, code: "OPERATION_SCHEMA_UNAVAILABLE" };
  const sourceMessageId = clean(input.sourceMessageId);
  const fingerprint = [farmerId, land.landId, cropId, operationType, operationDate, status,
    input.inputOrMaterial, input.quantity, input.unit, input.cost, input.remarks].map(normalize).join("|");
  const duplicate = readFarmOperations(rows, farmerId).find(function (record) {
    const recordFingerprint = [record.farmerId, record.landId, record.cropId, record.operationType,
      record.operationDate, record.operationStatus, record.inputOrMaterial, record.quantity,
      record.unit, record.cost, record.remarks].map(normalize).join("|");
    return (sourceMessageId && record.sourceMessageId === sourceMessageId) || recordFingerprint === fingerprint;
  });
  if (duplicate) return { success: true, duplicate: true, operation: duplicate, operationId: duplicate.operationId };
  const saveKey = sourceMessageId || fingerprint;
  if (activeSaves.has("operation:" + saveKey)) {
    const pending = await activeSaves.get("operation:" + saveKey);
    return pending.success ? Object.assign({}, pending, { duplicate: true }) : pending;
  }
  const promise = (async function () {
    const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
    const operationId = typeof input.idFactory === "function" ? clean(input.idFactory("BM-OP-")) : randomId("BM-OP-");
    if (!operationId || readFarmOperations(rows).some(function (record) { return normalize(record.operationId) === normalize(operationId); })) {
      return { success: false, code: "OPERATION_ID_COLLISION" };
    }
    const operation = {
      operationId: operationId, farmerId: farmerId, landId: clean(land.landId), cropId: cropId,
      operationType: operationType, operationDate: operationDate, operationStatus: status,
      inputOrMaterial: clean(input.inputOrMaterial), quantity: clean(input.quantity),
      unit: clean(input.unit), cost: clean(input.cost), remarks: clean(input.remarks),
      createdAt: now.toISOString(), sourceMessageId: sourceMessageId
    };
    const row = rowFromHeaders(headers, {
      Operation_ID: operation.operationId, Farmer_ID: operation.farmerId, Land_ID: operation.landId,
      Crop_ID: operation.cropId, Operation_Type: operation.operationType,
      Operation_Date: operation.operationDate, Operation_Status: operation.operationStatus,
      Input_or_Material: operation.inputOrMaterial, Quantity: operation.quantity, Unit: operation.unit,
      Cost: operation.cost, Remarks: operation.remarks, Created_At: operation.createdAt,
      Source_Message_ID: operation.sourceMessageId
    });
    const saved = await input.appendRow(OPERATION_SHEET, row);
    return saved === true || Boolean(saved && saved.success)
      ? { success: true, duplicate: false, operation: operation, operationId: operationId, row: row }
      : { success: false, code: "SAVE_FAILED" };
  })();
  activeSaves.set("operation:" + saveKey, promise);
  try { return await promise; } finally { activeSaves.delete("operation:" + saveKey); }
}

function relevantOperations(operations, lands, crops, filters) {
  const input = filters || {};
  const ownedLandIds = new Set((lands || []).filter(function (land) {
    return normalize(land.farmerId) === normalize(input.farmerId) && Boolean(clean(land.farmerId));
  }).map(function (land) { return normalize(land.landId); }));
  const ownedCropIds = new Set((crops || []).filter(function (crop) {
    return normalize(crop.farmerId) === normalize(input.farmerId) && ownedLandIds.has(normalize(crop.landId));
  }).map(function (crop) { return normalize(crop.cropId); }));
  return (operations || []).filter(function (operation) {
    if (normalize(operation.farmerId) !== normalize(input.farmerId) || !ownedLandIds.has(normalize(operation.landId))) return false;
    if (operation.cropId && !ownedCropIds.has(normalize(operation.cropId))) return false;
    if (input.landId && normalize(operation.landId) !== normalize(input.landId)) return false;
    if (input.cropId && normalize(operation.cropId) !== normalize(input.cropId)) return false;
    if (input.status && normalize(operation.operationStatus) !== normalize(input.status)) return false;
    if (input.operationType && normalize(operation.operationType) !== normalize(input.operationType)) return false;
    return true;
  }).sort(function (left, right) {
    return clean(right.operationDate || right.createdAt).localeCompare(clean(left.operationDate || left.createdAt));
  });
}

function readVerifiedAlerts(rows, context) {
  const input = context || {};
  const all = Array.isArray(rows) ? rows : [];
  const headers = all[0] || [];
  const map = makeHeaderMap(headers);
  const today = parseDate(input.today) || todayKey(input.now);
  const crops = new Set((input.cropNames || []).map(normalize).filter(Boolean));
  return all.slice(1).map(function (row) {
    return {
      alertId: getValue(row, map, ["Alert_ID"]),
      category: getValue(row, map, ["Alert_Category", "Category"]),
      title: getValue(row, map, ["Alert_Title", "Title"]),
      cropName: getValue(row, map, ["Crop_Name", "Crop"]),
      district: getValue(row, map, ["District"]),
      message: getValue(row, map, ["Alert_Message", "Message"]),
      precautions: getValue(row, map, ["Precautions"]),
      sourceName: getValue(row, map, ["Source_Name", "Source"]),
      sourceUrl: getValue(row, map, ["Source_URL", "URL"]),
      validFrom: parseDate(getValue(row, map, ["Valid_From", "Start_Date"])),
      validUntil: parseDate(getValue(row, map, ["Valid_Until", "Expiry_Date"])),
      verificationStatus: getValue(row, map, ["Verification_Status"]),
      alertStatus: getValue(row, map, ["Alert_Status", "Status"])
    };
  }).filter(function (alert) {
    if (!alert.alertId || !alert.title || !alert.message || !alert.sourceName) return false;
    if (!/^verified$/i.test(alert.verificationStatus) || !/^(active|current)$/i.test(alert.alertStatus)) return false;
    if (!alert.validFrom || !alert.validUntil || alert.validFrom > today || alert.validUntil < today) return false;
    if (alert.district && !/^(all|kerala|statewide)$/i.test(alert.district) && normalize(alert.district) !== normalize(input.district)) return false;
    if (alert.cropName && !/^(all|all crops|general)$/i.test(alert.cropName) && !crops.has(normalize(alert.cropName))) return false;
    return true;
  }).filter(function (alert, index, values) {
    return values.findIndex(function (candidate) { return normalize(candidate.alertId) === normalize(alert.alertId); }) === index;
  });
}

function buildMyFarmAlerts(options) {
  const input = options || {};
  const planned = relevantOperations(input.operations, input.lands, input.crops, {
    farmerId: input.farmerId, status: "Planned"
  }).filter(function (operation) {
    return operation.operationDate >= (parseDate(input.today) || todayKey(input.now));
  });
  return {
    verified: readVerifiedAlerts(input.alertRows, {
      district: input.district,
      cropNames: (input.crops || []).map(function (crop) { return crop.cropName; }),
      today: input.today,
      now: input.now
    }),
    planned: planned
  };
}

function parseCropRegistrationDetails(text) {
  const parts = clean(text).split("|").map(clean);
  if (parts.length < 6) return { success: false, code: "DETAILS_REQUIRED" };
  const planting = !parts[1] || parts[1] === "-" ? "" : parseDate(parts[1]);
  if (parts[1] && parts[1] !== "-" && !planting) return { success: false, code: "INVALID_PLANTING_DATE" };
  return {
    success: true,
    variety: parts[0] === "-" ? "" : parts[0], plantingDate: planting,
    cultivatedArea: parts[2], areaUnit: parts[3], cropType: parts[4],
    cropStatus: parts[5], remarks: parts.slice(6).join(" | ")
  };
}

function parseOperationDetails(text) {
  const parts = clean(text).split("|").map(clean);
  if (parts.length < 2) return { success: false, code: "DETAILS_REQUIRED" };
  const date = parseDate(parts[0]);
  if (!date) return { success: false, code: "INVALID_OPERATION_DATE" };
  if (!/^(planned|completed|done)$/i.test(parts[1])) return { success: false, code: "INVALID_OPERATION_STATUS" };
  return {
    success: true, operationDate: date,
    operationStatus: /planned/i.test(parts[1]) ? "Planned" : "Completed",
    inputOrMaterial: parts[2] === "-" ? "" : parts[2],
    quantity: parts[3] === "-" ? "" : parts[3], unit: parts[4] === "-" ? "" : parts[4],
    cost: parts[5] === "-" ? "" : parts[5], remarks: parts.slice(6).join(" | ")
  };
}

function parseCropStatusDetails(text) {
  const parts = clean(text).split("|").map(clean);
  if (parts.length < 3) return { success: false, code: "DETAILS_REQUIRED" };
  const eventDate = parseDate(parts[1]);
  if (!eventDate) return { success: false, code: "INVALID_EVENT_DATE" };
  if (!parts[0] || !parts[2]) return { success: false, code: "STATUS_REQUIRED" };
  return { success: true, eventType: parts[0], eventDate: eventDate, cropStatus: parts[2], remarks: parts.slice(3).join(" | ") };
}

function parseCropFarmNaturalLanguage(text) {
  const value = normalize(text);
  if (!value) return null;
  if (/(fertili[sz]er|വളപ്രയോഗം).*(yesterday|today|record|രേഖപ്പെടുത്ത|ഇന്ന്|ഇന്നലെ)|^(i applied fertilizer|വളം)/i.test(value)) {
    return { action: "FERTILIZER" };
  }
  if (/(crop|വിള|കൃഷി).*(alert|warning|മുന്നറിയി)|any crop alerts/i.test(value)) return { action: "ALERTS" };
  if (/(planned).*(farm|operation|activit)|ആസൂത്രണം.*(കൃഷി|പ്രവർത്ത)/i.test(value)) return { action: "PLANNED" };
  if (/(show|view|my).*(farm activit|operation)|കൃഷി.*(പ്രവർത്ത|ചരിത്രം).*(കാണ|വിവര)/i.test(value)) return { action: "ACTIVITIES" };
  if (/(crop history|വിളകളുടെ ചരിത്രം|വിള ചരിത്രം)/i.test(value)) return { action: "HISTORY" };
  if (/(crop).*(harvested|removed|completed|replanted|status)|(?:harvested|removed|completed|replanted).*(crop)|വിള.*(വിളവെടു|നീക്കം|പൂർത്തി|വീണ്ടും നട്ട|നില)/i.test(value)) return { action: "UPDATE_STATUS" };
  if (/(my crops|show.*crops|എന്റെ വിള|വിളകൾ.*കാണ)/i.test(value)) return { action: "MY_CROPS" };
  if (/(record|add).*(irrigation|planting|harvest|pruning|weeding|mulching|manure|farm activit)|^(irrigat|plant|harvest|prun|weed|mulch)|നനച്ച|നനയ്ക്ക|കൃഷിപ്പണി.*രേഖ/i.test(value)) {
    return { action: "RECORD_OPERATION" };
  }
  const register = value.match(/(?:register|add)\s+(.+?)(?:\s+crop)?$/i);
  const mlRegister = value.match(/^(.+?)\s+(?:കൃഷി\s+)?(?:ചേർക്കണം|രജിസ്റ്റർ\s*ചെയ്യണം|രജിസ്റ്റർ)$/i);
  if (register || mlRegister) return { action: "REGISTER", cropName: clean((register || mlRegister)[1]) };
  if (/crop and farm records|crop records|വിളകളും കൃഷിരേഖകളും/i.test(value)) return { action: "OPEN" };
  return null;
}

function landRowsForAction(lands, prefix) {
  return (lands || []).slice(0, 10).map(function (land) {
    return {
      id: prefix + encode(land.landId),
      title: clean(land.farmName || land.landId).slice(0, 24),
      description: [land.landId, land.district].filter(Boolean).join(" • ").slice(0, 72)
    };
  });
}

function operationTypeRows() {
  const nonFertilizer = OPERATION_TYPES.filter(function (type) { return !/fertili[sz]er/i.test(type); });
  return nonFertilizer.slice(0, 9).concat("Other").map(function (type) {
    return { id: CROP_FARM_PREFIXES.OPERATION_TYPE + encode(type), title: type.slice(0, 24), description: "Record or plan this activity" };
  });
}

function cropRowsForStatus(crops) {
  return (crops || []).filter(isCurrentCrop).slice(0, 10).map(function (crop) {
    return {
      id: CROP_FARM_PREFIXES.STATUS_CROP + encode(crop.cropId),
      title: crop.cropName.slice(0, 24),
      description: [crop.cropId, crop.cropStatus].filter(Boolean).join(" • ").slice(0, 72)
    };
  });
}

function cropRowsForOperation(crops, landId) {
  const rows = (crops || []).filter(function (crop) {
    return normalize(crop.landId) === normalize(landId) && isCurrentCrop(crop);
  }).slice(0, 9).map(function (crop) {
    return { id: CROP_FARM_PREFIXES.OPERATION_CROP + encode(crop.cropId), title: crop.cropName.slice(0, 24), description: [crop.cropId, crop.variety].filter(Boolean).join(" • ").slice(0, 72) };
  });
  rows.push({ id: CROP_FARM_PREFIXES.OPERATION_CROP + encode("NONE"), title: "No specific crop", description: "Land-level operation" });
  return rows;
}

function formatCropSummary(crops, lands, history, language) {
  const ml = normalize(language) === "malayalam";
  const states = latestCropStates(crops, history);
  if (!states.length) {
    const lines = [ml
      ? "രജിസ്റ്റർ ചെയ്ത Crop_ID ഉള്ള വിളകളില്ല. ഭൂമി രേഖയിലെ Main_Crop വിവരം മാറ്റമില്ലാതെ സൂക്ഷിച്ചിരിക്കുന്നു."
      : "No crops with a registered Crop_ID exist yet. Existing Main_Crop land information remains unchanged."];
    (lands || []).forEach(function (land) {
      const legacy = [land.mainCrop, land.otherCrops].filter(Boolean).join(", ");
      if (legacy) lines.push("", [land.farmName || land.landId, legacy].join(" • "), ml ? "Crop ID സൃഷ്ടിച്ചിട്ടില്ല" : "No Crop ID has been created");
    });
    return lines.join("\n");
  }
  const landMap = new Map((lands || []).map(function (land) { return [normalize(land.landId), land]; }));
  const lines = [ml ? "🌱 എന്റെ വിളകൾ / വിള ചരിത്രം" : "🌱 My Crops / Crop History"];
  states.sort(function (a, b) { return clean(b.plantingDate || b.createdAt).localeCompare(clean(a.plantingDate || a.createdAt)); }).forEach(function (crop) {
    const land = landMap.get(normalize(crop.landId)) || {};
    lines.push("", crop.cropName + (crop.variety ? " — " + crop.variety : ""),
      (ml ? "Crop ID: " : "Crop ID: ") + crop.cropId,
      (ml ? "ഭൂമി: " : "Land: ") + [land.farmName, crop.landId].filter(Boolean).join(" • "),
      (ml ? "നടീൽ: " : "Planted: ") + (crop.plantingDate || "-"),
      (ml ? "നില: " : "Status: ") + (crop.cropStatus || "-"));
    if (crop.harvestDate) lines.push((ml ? "വിളവെടുപ്പ്: " : "Harvested: ") + crop.harvestDate);
    (crop.history || []).slice(-3).forEach(function (event) {
      lines.push("↳ " + [event.eventDate, event.eventType, event.cropStatus].filter(Boolean).join(" • "));
    });
  });
  return lines.join("\n").slice(0, 4000);
}

function formatOperationSummary(operations, lands, crops, language) {
  const ml = normalize(language) === "malayalam";
  if (!operations.length) return ml ? "കൃഷിപ്പണികളുടെ രേഖകളില്ല." : "No farm activities are recorded for this view.";
  const landMap = new Map((lands || []).map(function (land) { return [normalize(land.landId), land]; }));
  const cropMap = new Map((crops || []).map(function (crop) { return [normalize(crop.cropId), crop]; }));
  const lines = [ml ? "📒 കൃഷിപ്പണി ചരിത്രം" : "📒 Farm Activity History"];
  operations.slice(0, 12).forEach(function (operation) {
    const land = landMap.get(normalize(operation.landId)) || {};
    const crop = cropMap.get(normalize(operation.cropId)) || {};
    lines.push("", operation.operationDate + " • " + operation.operationType,
      [land.farmName || operation.landId, crop.cropName, operation.operationStatus].filter(Boolean).join(" • "),
      [operation.inputOrMaterial, operation.quantity, operation.unit, operation.cost ? "₹" + operation.cost : ""].filter(Boolean).join(" • "));
  });
  return lines.filter(function (line, index, array) { return line || index === 0 || array[index - 1] !== ""; }).join("\n").slice(0, 4000);
}

function formatFarmAlerts(alerts, language) {
  const ml = normalize(language) === "malayalam";
  const verified = (alerts && alerts.verified) || [];
  const planned = (alerts && alerts.planned) || [];
  const lines = [ml ? "🔔 എന്റെ കൃഷി അലർട്ടുകൾ" : "🔔 My Farm and Crop Alerts"];
  if (!verified.length) lines.push("", ml
    ? "നിലവിൽ ലഭ്യമായ ഔദ്യോഗികമായി സ്ഥിരീകരിച്ച കാലാവസ്ഥ/വിള മുന്നറിയിപ്പ് ഡാറ്റയില്ല. ഇതുകൊണ്ട് അപകടസാധ്യതയില്ലെന്ന് അർത്ഥമില്ല."
    : "No currently valid, officially verified weather or crop alert data is available. This does not mean there is no agricultural risk.");
  verified.slice(0, 6).forEach(function (alert) {
    lines.push("", "⚠️ " + alert.title, alert.message,
      alert.precautions ? (ml ? "മുൻകരുതൽ: " : "Precaution: ") + alert.precautions : "",
      (ml ? "ഉറവിടം: " : "Source: ") + alert.sourceName,
      (ml ? "കാലാവധി: " : "Valid: ") + alert.validFrom + " — " + alert.validUntil);
  });
  if (planned.length) {
    lines.push("", ml ? "📅 ആസൂത്രണം ചെയ്ത പണികൾ" : "📅 Planned operations");
    planned.slice(0, 6).forEach(function (operation) {
      lines.push(operation.operationDate + " • " + operation.operationType + " • " + operation.landId);
    });
  } else {
    lines.push("", ml ? "ആസൂത്രണം ചെയ്ത കൃഷിപ്പണികളില്ല." : "No planned farm operations are recorded.");
  }
  return lines.filter(Boolean).join("\n").slice(0, 4000);
}

module.exports = {
  CROP_FARM_ACTION_IDS, CROP_FARM_PREFIXES, CROP_HEADERS, CROP_HISTORY_HEADERS,
  CROP_HISTORY_SHEET, CROP_SHEET, OPERATION_HEADERS, OPERATION_SHEET, OPERATION_TYPES,
  VERIFIED_ALERT_HEADERS, VERIFIED_ALERT_SHEET,
  appendCropStatus, buildMyFarmAlerts, cropRowsForOperation, cropRowsForStatus, formatCropSummary,
  formatFarmAlerts, formatOperationSummary, isCurrentCrop, landRowsForAction,
  latestCropStates, operationTypeRows, ownedLand, parseCropFarmAction,
  parseCropFarmNaturalLanguage, parseCropRegistrationDetails, parseCropStatusDetails, parseDate,
  parseOperationDetails, readCropHistory, readCrops, readFarmOperations,
  readVerifiedAlerts, recordFarmOperation, registerCrop, relevantOperations,
  rowFromHeaders
};
