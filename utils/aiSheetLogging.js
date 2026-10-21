"use strict";

const crypto = require("crypto");

const REQUIRED_HEADERS = Object.freeze({
  aiResponseLog: Object.freeze([
    "Log_ID",
    "DateTime",
    "Phone",
    "Farmer_Message",
    "AI_Reply"
  ]),
  conversation: Object.freeze([
    "Conversation_ID",
    "WhatsApp_No",
    "Date_Time",
    "Question",
    "AI_Response",
    "Final_Response"
  ]),
  farmerQueries: Object.freeze([
    "Query_ID",
    "Date",
    "Question",
    "Answer",
    "Status"
  ])
});

function clean(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeHeader(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function makeHeaderIndex(headers) {
  const indexes = Object.create(null);

  (headers || []).forEach(function (header, index) {
    const key = normalizeHeader(header);
    if (!key) return;
    if (!indexes[key]) indexes[key] = [];
    indexes[key].push(index);
  });

  return indexes;
}

function buildHeaderMappedRow(headers, valuesByHeader, requiredHeaders) {
  const safeHeaders = Array.isArray(headers) ? headers : [];
  const indexes = makeHeaderIndex(safeHeaders);
  const normalizedValues = Object.create(null);

  Object.keys(valuesByHeader || {}).forEach(function (header) {
    normalizedValues[normalizeHeader(header)] =
      valuesByHeader[header] == null ? "" : valuesByHeader[header];
  });

  (requiredHeaders || []).forEach(function (header) {
    const matches = indexes[normalizeHeader(header)] || [];
    if (matches.length === 0) {
      throw new Error("Required logging header is missing: " + header);
    }
    if (matches.length > 1) {
      throw new Error("Required logging header is duplicated: " + header);
    }
  });

  return safeHeaders.map(function (header) {
    const key = normalizeHeader(header);
    return Object.prototype.hasOwnProperty.call(normalizedValues, key)
      ? normalizedValues[key]
      : "";
  });
}

function createRecordId(prefix, randomUUID) {
  const uuid = typeof randomUUID === "function"
    ? randomUUID()
    : crypto.randomUUID();

  return String(prefix || "BM-LOG-") +
    String(uuid).replace(/-/g, "").toUpperCase();
}

function createAiSheetLogger(options) {
  const input = options || {};
  const readSheetRows = input.readSheetRows;
  const appendSafe = input.appendSafe;
  const sheets = input.sheets || {};
  const now = typeof input.now === "function"
    ? input.now
    : function () { return new Date(); };
  const randomUUID = input.randomUUID;
  const model = clean(input.model);
  const headerCache = new Map();

  if (typeof readSheetRows !== "function") {
    throw new Error("readSheetRows is required for AI Sheet logging.");
  }
  if (typeof appendSafe !== "function") {
    throw new Error("appendSafe is required for AI Sheet logging.");
  }

  async function headersFor(sheetName) {
    if (headerCache.has(sheetName)) {
      return headerCache.get(sheetName);
    }

    const rows = await readSheetRows(sheetName, "1:1");
    const headers = rows && Array.isArray(rows[0]) ? rows[0] : [];
    if (headers.length === 0) {
      throw new Error("Logging header row is unavailable: " + sheetName);
    }

    headerCache.set(sheetName, headers.slice());
    return headerCache.get(sheetName);
  }

  async function appendMapped(sheetName, values, requiredHeaders) {
    const headers = await headersFor(sheetName);
    const row = buildHeaderMappedRow(headers, values, requiredHeaders);
    return appendSafe(sheetName, row);
  }

  async function logAI(from, userText, reply, type) {
    const timestamp = now().toISOString();
    const conversationId = createRecordId("BM-CONV-", randomUUID);

    await appendMapped(
      sheets.aiLog || "AI_Response_Log",
      {
        Log_ID: createRecordId("BM-AIL-", randomUUID),
        DateTime: timestamp,
        Phone: clean(from),
        Farmer_Message: clean(userText),
        AI_Reply: clean(reply),
        Source: "WhatsApp",
        AI_Model: model,
        Conversation_ID: conversationId,
        Created_On: timestamp,
        Updated_On: timestamp
      },
      REQUIRED_HEADERS.aiResponseLog
    );

    await appendMapped(
      sheets.conversation || "AI_Conversation_History",
      {
        Conversation_ID: conversationId,
        Session_ID: conversationId,
        WhatsApp_No: clean(from),
        Date_Time: timestamp,
        Question: clean(userText),
        Intent: clean(type),
        AI_Response: clean(reply),
        Final_Response: clean(reply),
        Conversation_Status: "Answered",
        Created_On: timestamp,
        Last_Updated: timestamp
      },
      REQUIRED_HEADERS.conversation
    );
  }

  async function logFarmerQuery(from, userText, reply, category) {
    const timestamp = now().toISOString();

    return appendMapped(
      sheets.farmerQueries || "Farmer_Queries",
      {
        Query_ID: createRecordId("BM-QRY-", randomUUID),
        Date: timestamp,
        Category: clean(category),
        Question: clean(userText),
        Answer: clean(reply),
        Answered_By: "BhoomiMitra AI",
        Status: "Open"
      },
      REQUIRED_HEADERS.farmerQueries
    );
  }

  return {
    logAI,
    logFarmerQuery,
    clearHeaderCache: function () { headerCache.clear(); }
  };
}

module.exports = {
  REQUIRED_HEADERS,
  buildHeaderMappedRow,
  createAiSheetLogger,
  createRecordId,
  normalizeHeader
};
