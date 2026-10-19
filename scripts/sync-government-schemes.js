"use strict";

require("dotenv").config();

const axios = require("axios");
const { google } = require("googleapis");
const {
  OFFICIAL_SCHEME_SOURCES,
  supportedSchemeSources
} = require("../utils/schemeSources");
const {
  DEFAULT_MAX_RETRIES,
  DEFAULT_RATE_LIMIT_MS,
  DEFAULT_TIMEOUT_MS,
  PROPOSED_SCHEMA_EXTENSION,
  runSchemeSync
} = require("../utils/schemeIngestion");

const READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const CACHE_RANGE = "Government_Schemes!A:AZ";

function clean(value) {
  return value == null ? "" : String(value).trim();
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function loadGoogleConfiguration() {
  const spreadsheetId = clean(process.env.GOOGLE_SHEET_ID);
  const clientEmail = clean(process.env.GOOGLE_CLIENT_EMAIL);
  const privateKey = String(process.env.GOOGLE_PRIVATE_KEY || "")
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n")
    .trim();
  const missing = [];
  if (!spreadsheetId) missing.push("GOOGLE_SHEET_ID");
  if (!clientEmail) missing.push("GOOGLE_CLIENT_EMAIL");
  if (!privateKey) missing.push("GOOGLE_PRIVATE_KEY");
  if (missing.length) throw new Error("Missing required environment variables: " + missing.join(", "));
  return { spreadsheetId: spreadsheetId, clientEmail: clientEmail, privateKey: privateKey };
}

function selectedSources() {
  const supported = supportedSchemeSources();
  const requested = clean(process.env.SCHEME_SYNC_SOURCE_IDS)
    .split(",")
    .map(function (value) { return clean(value).toUpperCase(); })
    .filter(Boolean);
  if (requested.length === 0) return supported;
  const requestedSet = new Set(requested);
  return supported.filter(function (source) { return requestedSet.has(source.id.toUpperCase()); });
}

async function readSchemeCache(configuration) {
  const auth = new google.auth.JWT({
    email: configuration.clientEmail,
    key: configuration.privateKey,
    scopes: [READONLY_SCOPE]
  });
  const sheets = google.sheets({ version: "v4", auth: auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: configuration.spreadsheetId,
    range: CACHE_RANGE,
    majorDimension: "ROWS",
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING"
  });
  return Array.isArray(response.data && response.data.values) ? response.data.values : [];
}

function compactProposal(entry) {
  const scheme = entry.scheme || entry.existing || {};
  return {
    action: entry.action,
    schemeId: scheme.schemeId,
    schemeName: scheme.schemeName,
    reason: entry.reason || "",
    changedFields: entry.changedFields || []
  };
}

async function main() {
  const requestedWriteMode = clean(process.env.SCHEME_SYNC_DRY_RUN).toLowerCase() === "false";
  const sources = selectedSources();
  if (sources.length === 0) throw new Error("No supported official sources matched SCHEME_SYNC_SOURCE_IDS.");
  const configuration = loadGoogleConfiguration();
  const cacheRows = await readSchemeCache(configuration);
  const result = await runSchemeSync({
    sources: sources,
    httpClient: axios,
    cacheRows: cacheRows,
    dryRun: true,
    timeoutMs: positiveNumber(process.env.SCHEME_SYNC_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    maxRetries: positiveNumber(process.env.SCHEME_SYNC_MAX_RETRIES, DEFAULT_MAX_RETRIES),
    rateLimitMs: positiveNumber(process.env.SCHEME_SYNC_RATE_LIMIT_MS, DEFAULT_RATE_LIMIT_MS)
  });
  const unsupported = OFFICIAL_SCHEME_SOURCES.filter(function (source) {
    return !sources.some(function (selected) { return selected.id === source.id; });
  }).map(function (source) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      support: source.support,
      reason: source.reason || "Not selected for this run."
    };
  });
  const report = {
    mode: "DRY_RUN_READ_ONLY",
    requestedWriteMode: requestedWriteMode,
    writeModeRefused: requestedWriteMode,
    googleScope: READONLY_SCOPE,
    cacheRange: CACHE_RANGE,
    counts: result.counts,
    sourceHealth: result.sourceHealth,
    unsupportedOrCustomAdapterSources: unsupported,
    schema: result.schema,
    proposedSchemaExtension: PROPOSED_SCHEMA_EXTENSION,
    proposedInserts: result.plan.inserts.map(compactProposal),
    proposedUpdates: result.plan.updates.map(compactProposal),
    unchanged: result.plan.unchanged.map(compactProposal),
    manualReview: result.plan.reviews.map(compactProposal),
    preservedStale: result.plan.stale.map(compactProposal),
    sheetWrites: 0,
    note: requestedWriteMode
      ? "Write mode is disabled until the Government_Schemes schema extension is approved and present."
      : "Dry-run is the default. No Google Sheet writes were attempted."
  };
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (requestedWriteMode) process.exitCode = 2;
}

main().catch(function (error) {
  process.stderr.write(JSON.stringify({
    mode: "DRY_RUN_READ_ONLY",
    success: false,
    sheetWrites: 0,
    error: clean(error && error.message ? error.message : error).slice(0, 500)
  }, null, 2) + "\n");
  process.exitCode = 1;
});
