"use strict";

const crypto = require("crypto");
const cheerio = require("cheerio");
const {
  OFFICIAL_SCHEME_SOURCES,
  SOURCE_SUPPORT
} = require("./schemeSources");

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RATE_LIMIT_MS = 750;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

const CACHE_FIELD_ALIASES = Object.freeze({
  schemeId: ["Scheme_ID"],
  schemeName: ["Scheme_Name"],
  schemeLevel: ["Government", "Scheme_Level"],
  department: ["Department"],
  category: ["Category"],
  subcategory: ["Subcategory"],
  purpose: ["Purpose"],
  benefitSummary: ["Benefit", "Benefit_Summary"],
  eligibilitySummary: ["Eligibility", "Eligibility_Summary"],
  targetBeneficiaries: ["Target_Beneficiaries"],
  cropContext: ["Crop_Context"],
  livestockContext: ["Livestock_Context"],
  landContext: ["Land_Context"],
  districtApplicability: ["District", "District_Applicability"],
  stateApplicability: ["State_Applicability"],
  applicationStart: ["Application_Start", "Valid_From"],
  applicationEnd: ["Last_Date", "Application_End"],
  status: ["Status"],
  officialSource: ["Source", "Official_Source"],
  officialUrl: ["Official_URL"],
  applicationUrl: ["Application_Link", "Application_URL"],
  lastSourceUpdate: ["Last_Source_Update"],
  lastChecked: ["Last_Checked"],
  sourceHash: ["Source_Hash"],
  dataQuality: ["Data_Quality"],
  sourceKey: ["Source_Key"]
});

const PROPOSED_SCHEMA_EXTENSION = Object.freeze([
  "Subcategory",
  "Purpose",
  "Target_Beneficiaries",
  "Crop_Context",
  "Livestock_Context",
  "Land_Context",
  "State_Applicability",
  "Application_Start",
  "Official_URL",
  "Last_Source_Update",
  "Last_Checked",
  "Source_Hash",
  "Data_Quality",
  "Source_Key"
]);

const REQUIRED_WRITE_FIELDS = Object.freeze([
  "schemeId", "schemeName", "schemeLevel", "department", "category", "subcategory",
  "purpose", "benefitSummary", "eligibilitySummary", "targetBeneficiaries",
  "cropContext", "livestockContext", "landContext", "districtApplicability",
  "stateApplicability", "applicationStart", "applicationEnd", "status",
  "officialSource", "officialUrl", "applicationUrl", "lastSourceUpdate",
  "lastChecked", "sourceHash", "dataQuality", "sourceKey"
]);

const FINGERPRINT_FIELDS = Object.freeze([
  "schemeName", "schemeLevel", "department", "category", "subcategory", "purpose",
  "benefitSummary", "eligibilitySummary", "targetBeneficiaries", "cropContext",
  "livestockContext", "landContext", "districtApplicability", "stateApplicability",
  "applicationStart", "applicationEnd", "status", "officialSource", "officialUrl",
  "applicationUrl", "lastSourceUpdate"
]);

function clean(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeHeader(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sanitizeText(value, maximumLength) {
  const limit = Number.isFinite(maximumLength) ? maximumLength : 4000;
  let text = clean(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > limit) text = text.slice(0, limit).trimEnd();
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return text;
}

function safeLogMessage(error) {
  return sanitizeText(error && error.message ? error.message : error, 300)
    .replace(/https?:\/\/[^\s?#]+[^\s]*/gi, "[official URL]");
}

function sourceHosts(sources) {
  const result = new Set();
  (sources || OFFICIAL_SCHEME_SOURCES).forEach(function (source) {
    (source.allowedHosts || []).forEach(function (host) {
      result.add(clean(host).toLowerCase());
    });
  });
  return result;
}

function parseUrl(value) {
  try {
    return new URL(clean(value));
  } catch (_error) {
    return null;
  }
}

function isApprovedOfficialUrl(value, sources, source) {
  const parsed = parseUrl(value);
  if (!parsed || parsed.protocol !== "https:") return false;
  const allowed = source && Array.isArray(source.allowedHosts)
    ? new Set(source.allowedHosts.map(function (host) { return clean(host).toLowerCase(); }))
    : sourceHosts(sources);
  return allowed.has(parsed.hostname.toLowerCase());
}

function preserveApprovedUrl(value, sources) {
  const text = clean(value);
  return isApprovedOfficialUrl(text, sources) ? text : "";
}

function canonicalUrl(value) {
  const parsed = parseUrl(value);
  if (!parsed) return "";
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  if (parsed.pathname !== "/") parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString();
}

function parseReliableDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime());
  }
  const text = clean(value);
  if (!text) return null;
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (match) {
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCFullYear() === Number(match[1]) &&
      date.getUTCMonth() === Number(match[2]) - 1 &&
      date.getUTCDate() === Number(match[3]) ? date : null;
  }
  match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) {
    const date = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
    return date.getUTCFullYear() === Number(match[3]) &&
      date.getUTCMonth() === Number(match[2]) - 1 &&
      date.getUTCDate() === Number(match[1]) ? date : null;
  }
  return null;
}

function normalizedDate(value) {
  const date = parseReliableDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

function startOfUtcDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function normalizeStatus(rawStatus, applicationStart, applicationEnd, now) {
  const today = startOfUtcDay(now || new Date());
  const start = parseReliableDate(applicationStart);
  const end = parseReliableDate(applicationEnd);
  if (end && startOfUtcDay(end) < today) return "Expired";
  const status = clean(rawStatus).toLowerCase();
  if (/expired|closed|ended|inactive|cancelled|canceled/.test(status)) return "Expired";
  if (/upcoming|forthcoming|not yet open/.test(status)) return "Upcoming";
  if (/active|open|ongoing|current/.test(status)) {
    if (start && startOfUtcDay(start) > today) return "Upcoming";
    return "Active";
  }
  if (start && startOfUtcDay(start) > today) return "Upcoming";
  return "Unknown";
}

function stableJson(value) {
  const ordered = {};
  Object.keys(value || {}).sort().forEach(function (key) {
    ordered[key] = value[key];
  });
  return JSON.stringify(ordered);
}

function sourceFingerprint(scheme) {
  const values = {};
  FINGERPRINT_FIELDS.forEach(function (field) {
    values[field] = clean(scheme && scheme[field]);
  });
  return crypto.createHash("sha256").update(stableJson(values)).digest("hex");
}

function normalizedIdentityPart(value) {
  return clean(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function internalSchemeId(raw, source) {
  const officialId = normalizedIdentityPart(raw.officialSchemeId);
  const identity = officialId
    ? "official|" + officialId
    : [raw.schemeName, raw.department || source.department, raw.schemeLevel || source.level]
      .map(normalizedIdentityPart).join("|");
  return "SCH-" + crypto.createHash("sha256").update(identity).digest("hex").slice(0, 20).toUpperCase();
}

function normalizeRawScheme(rawValue, source, options) {
  const raw = rawValue || {};
  const sources = options && options.sources ? options.sources : OFFICIAL_SCHEME_SOURCES;
  const now = options && options.now instanceof Date ? options.now : new Date(options && options.now || Date.now());
  if (!source || !isApprovedOfficialUrl(source.url, sources, source)) {
    return { accepted: false, reason: "UNAPPROVED_SOURCE" };
  }
  const schemeName = sanitizeText(raw.schemeName || source.schemeName, 300);
  if (!schemeName) return { accepted: false, reason: "MISSING_SCHEME_NAME" };
  const officialUrl = preserveApprovedUrl(raw.officialUrl || source.url, sources);
  if (!officialUrl) return { accepted: false, reason: "UNAPPROVED_OFFICIAL_URL" };
  const applicationUrl = preserveApprovedUrl(raw.applicationUrl || source.applicationUrl, sources);
  const applicationStart = normalizedDate(raw.applicationStart);
  const applicationEnd = normalizedDate(raw.applicationEnd);
  const scheme = {
    schemeId: internalSchemeId(Object.assign({}, raw, { schemeName: schemeName }), source),
    schemeName: schemeName,
    schemeLevel: sanitizeText(raw.schemeLevel || source.level, 40),
    department: sanitizeText(raw.department || source.department, 250),
    category: sanitizeText(raw.category || source.category, 100),
    subcategory: sanitizeText(raw.subcategory || source.subcategory, 100),
    purpose: sanitizeText(raw.purpose, 1500),
    benefitSummary: sanitizeText(raw.benefitSummary, 1500),
    eligibilitySummary: sanitizeText(raw.eligibilitySummary, 1500),
    targetBeneficiaries: sanitizeText(raw.targetBeneficiaries, 800),
    cropContext: sanitizeText(raw.cropContext, 500),
    livestockContext: sanitizeText(raw.livestockContext, 500),
    landContext: sanitizeText(raw.landContext, 500),
    districtApplicability: sanitizeText(raw.districtApplicability, 500),
    stateApplicability: sanitizeText(raw.stateApplicability || source.stateApplicability, 200),
    applicationStart: applicationStart,
    applicationEnd: applicationEnd,
    status: normalizeStatus(raw.status, applicationStart, applicationEnd, now),
    officialSource: sanitizeText(raw.officialSource || source.name, 250),
    officialUrl: officialUrl,
    applicationUrl: applicationUrl,
    lastSourceUpdate: normalizedDate(raw.lastSourceUpdate),
    lastChecked: now.toISOString(),
    sourceHash: "",
    dataQuality: "",
    sourceKey: source.id,
    officialSchemeId: sanitizeText(raw.officialSchemeId, 150),
    sourceKeys: [source.id]
  };
  const substantiveFields = [scheme.purpose, scheme.benefitSummary, scheme.eligibilitySummary]
    .filter(Boolean).length;
  scheme.dataQuality = substantiveFields >= 2 ? "VerifiedSource" : "PartialNeedsReview";
  scheme.sourceHash = sourceFingerprint(scheme);
  return { accepted: true, scheme: scheme };
}

function firstMatchingContainer(document, selectorText) {
  const selectors = clean(selectorText).split(",").map(clean).filter(Boolean);
  for (const selector of selectors) {
    const match = document(selector).first();
    if (match.length) return match;
  }
  return null;
}

function extractPageDate(text) {
  const match = clean(text).match(/(?:page\s+)?last\s+(?:updated|modified)(?:\s+on)?\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4}|\d{4}-\d{2}-\d{2})/i);
  return match ? normalizedDate(match[1]) : "";
}

function parseOfficialHtml(source, html) {
  const input = clean(html);
  if (!input || input.length < 80 || !/<(?:html|body|main|article|div)\b/i.test(input)) {
    throw new Error("Malformed or empty HTML response.");
  }
  if (/account\s+suspended|captcha|access\s+denied/i.test(input)) {
    throw new Error("The official source returned an unsupported access or suspension page.");
  }
  const document = cheerio.load(input, { xmlMode: false });
  document("script,style,noscript,iframe,form").remove();
  const parser = source.parser || {};
  const container = firstMatchingContainer(document, parser.contentSelector || "main, article, body");
  if (!container) throw new Error("Expected content container was not found.");
  const pageText = sanitizeText(container.text(), 20000);
  if (parser.expectedText && !pageText.toLowerCase().includes(clean(parser.expectedText).toLowerCase())) {
    throw new Error("Expected official scheme content was not found.");
  }
  const paragraphs = [];
  container.find(parser.summarySelector || "p").each(function (_index, element) {
    const value = sanitizeText(document(element).text(), 800);
    if (value.length >= 40 && paragraphs.length < 3) paragraphs.push(value);
  });
  return [{
    schemeName: source.schemeName || source.name,
    schemeLevel: source.level,
    department: source.department,
    category: source.category,
    subcategory: source.subcategory,
    purpose: sanitizeText(paragraphs.join(" "), 1500),
    stateApplicability: source.stateApplicability,
    officialSource: source.name,
    officialUrl: source.url,
    applicationUrl: source.applicationUrl,
    lastSourceUpdate: extractPageDate(pageText),
    status: "Unknown"
  }];
}

function isRetryable(error, status) {
  const code = clean(error && error.code).toUpperCase();
  return code === "ECONNABORTED" || code === "ETIMEDOUT" || code === "ECONNRESET" ||
    status === 408 || status === 429 || status >= 500;
}

function createRateLimiter(minimumIntervalMs, clock, sleeper) {
  const interval = Number.isFinite(minimumIntervalMs) ? minimumIntervalMs : DEFAULT_RATE_LIMIT_MS;
  const now = clock || Date.now;
  const wait = sleeper || function (milliseconds) {
    return new Promise(function (resolve) { setTimeout(resolve, milliseconds); });
  };
  let lastRequestAt = 0;
  return async function rateLimit() {
    const remaining = interval - (now() - lastRequestAt);
    if (lastRequestAt && remaining > 0) await wait(remaining);
    lastRequestAt = now();
  };
}

function responseFinalUrl(response, fallback) {
  return clean(
    response && response.request && response.request.res && response.request.res.responseUrl ||
    response && response.request && response.request.responseURL ||
    response && response.config && response.config.url ||
    fallback
  );
}

async function fetchOfficialSource(source, options) {
  const input = options || {};
  const httpClient = input.httpClient;
  const maxRetries = Number.isFinite(input.maxRetries) ? input.maxRetries : DEFAULT_MAX_RETRIES;
  const timeoutMs = Number.isFinite(input.timeoutMs) ? input.timeoutMs : DEFAULT_TIMEOUT_MS;
  const rateLimit = input.rateLimit || async function () {};
  const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
  const health = {
    sourceId: source.id,
    sourceName: source.name,
    support: source.support,
    success: false,
    httpStatus: null,
    recordsFound: 0,
    recordsAccepted: 0,
    recordsRejected: 0,
    attempts: 0,
    lastSuccessfulCheck: "",
    parseWarnings: []
  };
  if (source.support !== SOURCE_SUPPORT.HTML_SINGLE) {
    health.parseWarnings.push(source.reason || "A custom adapter is required.");
    return { schemes: [], health: health };
  }
  if (!httpClient || typeof httpClient.get !== "function") {
    health.parseWarnings.push("HTTP client is unavailable.");
    return { schemes: [], health: health };
  }
  if (!isApprovedOfficialUrl(source.url, input.sources, source)) {
    health.parseWarnings.push("Source URL is not in the approved official-domain allowlist.");
    return { schemes: [], health: health };
  }

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    health.attempts += 1;
    try {
      await rateLimit(source);
      const response = await httpClient.get(source.url, {
        timeout: timeoutMs,
        maxRedirects: 3,
        maxContentLength: MAX_RESPONSE_BYTES,
        maxBodyLength: MAX_RESPONSE_BYTES,
        responseType: "text",
        validateStatus: function () { return true; },
        headers: {
          "User-Agent": "BhoomiMitra-SchemeSync/1.0 (+official government data pilot)",
          "Accept": "text/html,application/xhtml+xml"
        }
      });
      const status = Number(response && response.status || 0);
      health.httpStatus = status || null;
      if (status < 200 || status >= 300) {
        const error = new Error("Official source returned HTTP " + status + ".");
        if (attempt < maxRetries && isRetryable(error, status)) continue;
        health.parseWarnings.push(error.message);
        return { schemes: [], health: health };
      }
      const finalUrl = responseFinalUrl(response, source.url);
      if (!isApprovedOfficialUrl(finalUrl, input.sources, source)) {
        health.parseWarnings.push("Redirect target is outside the approved source allowlist.");
        return { schemes: [], health: health };
      }
      let rawRecords;
      try {
        rawRecords = parseOfficialHtml(source, response.data);
      } catch (parseError) {
        health.parseWarnings.push(safeLogMessage(parseError));
        return { schemes: [], health: health };
      }
      health.recordsFound = rawRecords.length;
      const schemes = [];
      rawRecords.forEach(function (raw) {
        const normalized = normalizeRawScheme(raw, source, { now: now, sources: input.sources });
        if (normalized.accepted) schemes.push(normalized.scheme);
        else health.parseWarnings.push(normalized.reason);
      });
      health.recordsAccepted = schemes.length;
      health.recordsRejected = rawRecords.length - schemes.length;
      health.success = true;
      health.lastSuccessfulCheck = now.toISOString();
      return { schemes: schemes, health: health };
    } catch (error) {
      const status = Number(error && error.response && error.response.status || 0);
      health.httpStatus = status || health.httpStatus;
      if (attempt < maxRetries && isRetryable(error, status)) continue;
      health.parseWarnings.push(safeLogMessage(error) || "Source fetch failed.");
      return { schemes: [], health: health };
    }
  }
  return { schemes: [], health: health };
}

function mergeDuplicateSchemes(primary, duplicate) {
  const merged = Object.assign({}, primary);
  FINGERPRINT_FIELDS.forEach(function (field) {
    if (!clean(merged[field]) && clean(duplicate[field])) merged[field] = duplicate[field];
  });
  merged.sourceKeys = Array.from(new Set(
    (primary.sourceKeys || [primary.sourceKey]).concat(duplicate.sourceKeys || [duplicate.sourceKey])
  )).filter(Boolean).sort();
  merged.sourceKey = merged.sourceKeys.join(",");
  merged.lastChecked = [primary.lastChecked, duplicate.lastChecked].sort().pop() || "";
  merged.dataQuality = [merged.purpose, merged.benefitSummary, merged.eligibilitySummary]
    .filter(Boolean).length >= 2 ? "VerifiedSource" : "PartialNeedsReview";
  merged.sourceHash = sourceFingerprint(merged);
  return merged;
}

function deduplicateSchemes(schemes) {
  const output = [];
  const officialIds = new Map();
  const names = new Map();
  (schemes || []).forEach(function (scheme) {
    const officialId = normalizedIdentityPart(scheme.officialSchemeId);
    const nameKey = [scheme.schemeName, scheme.department, scheme.schemeLevel]
      .map(normalizedIdentityPart).join("|");
    let outputIndex = officialId && officialIds.has(officialId) ? officialIds.get(officialId) : undefined;
    if (outputIndex === undefined && nameKey.replace(/\|/g, "") && names.has(nameKey)) {
      outputIndex = names.get(nameKey);
    }
    if (outputIndex === undefined) {
      outputIndex = output.length;
      output.push(Object.assign({}, scheme));
    } else {
      output[outputIndex] = mergeDuplicateSchemes(output[outputIndex], scheme);
    }
    if (officialId) officialIds.set(officialId, outputIndex);
    if (nameKey.replace(/\|/g, "")) names.set(nameKey, outputIndex);
  });
  return output;
}

function makeHeaderMap(headers) {
  const map = Object.create(null);
  (headers || []).forEach(function (header, index) {
    const key = normalizeHeader(header);
    if (key && map[key] === undefined) map[key] = index;
  });
  return map;
}

function fieldHeaderIndex(map, field) {
  const aliases = CACHE_FIELD_ALIASES[field] || [];
  for (const alias of aliases) {
    const index = map[normalizeHeader(alias)];
    if (index !== undefined) return index;
  }
  return -1;
}

function assessCacheSchema(headers) {
  const map = makeHeaderMap(headers);
  const missingFields = REQUIRED_WRITE_FIELDS.filter(function (field) {
    return fieldHeaderIndex(map, field) < 0;
  });
  return {
    writeReady: missingFields.length === 0,
    missingFields: missingFields,
    proposedExtension: PROPOSED_SCHEMA_EXTENSION.filter(function (header) {
      return map[normalizeHeader(header)] === undefined;
    })
  };
}

function getCachedValue(row, map, field) {
  const index = fieldHeaderIndex(map, field);
  return index >= 0 && row && row[index] != null ? clean(row[index]) : "";
}

function readCachedSchemes(sheetRows) {
  const rows = Array.isArray(sheetRows) ? sheetRows : [];
  const headers = rows[0] || [];
  const map = makeHeaderMap(headers);
  return rows.slice(1).map(function (row, index) {
    const scheme = { rowNumber: index + 2, row: row };
    Object.keys(CACHE_FIELD_ALIASES).forEach(function (field) {
      scheme[field] = getCachedValue(row, map, field);
    });
    return scheme;
  }).filter(function (scheme) {
    return Boolean(scheme.schemeId || scheme.schemeName);
  });
}

function meaningfulChanges(existing, incoming) {
  return FINGERPRINT_FIELDS.filter(function (field) {
    return clean(existing && existing[field]) !== clean(incoming && incoming[field]);
  });
}

function schemeMatchKey(scheme) {
  return [scheme.schemeName, scheme.department, scheme.schemeLevel]
    .map(normalizedIdentityPart).join("|");
}

function planCacheChanges(incomingSchemes, cachedSchemes, sourceHealth) {
  const cached = cachedSchemes || [];
  const byId = new Map();
  const byName = new Map();
  cached.forEach(function (scheme) {
    if (clean(scheme.schemeId)) byId.set(clean(scheme.schemeId).toUpperCase(), scheme);
    const nameKey = schemeMatchKey(scheme);
    if (nameKey.replace(/\|/g, "")) byName.set(nameKey, scheme);
  });
  const matchedRows = new Set();
  const inserts = [];
  const updates = [];
  const unchanged = [];
  const reviews = [];
  (incomingSchemes || []).forEach(function (scheme) {
    const existing = byId.get(clean(scheme.schemeId).toUpperCase()) ||
      byName.get(schemeMatchKey(scheme));
    if (!existing) {
      inserts.push({ action: "INSERT", scheme: scheme });
      return;
    }
    matchedRows.add(existing.rowNumber);
    if (!clean(existing.sourceHash) || !clean(existing.sourceKey)) {
      reviews.push({ action: "REVIEW", reason: "MANUAL_OR_UNMANAGED_ROW", existing: existing, scheme: scheme });
      return;
    }
    const changes = meaningfulChanges(existing, scheme);
    if (clean(existing.sourceHash) === clean(scheme.sourceHash) || changes.length === 0) {
      unchanged.push({ action: "SKIP", reason: "UNCHANGED", existing: existing, scheme: scheme });
      return;
    }
    updates.push({ action: "UPDATE", existing: existing, scheme: scheme, changedFields: changes });
  });
  const healthMap = new Map((sourceHealth || []).map(function (health) {
    return [health.sourceId, health];
  }));
  const stale = cached.filter(function (scheme) {
    return clean(scheme.sourceHash) && clean(scheme.sourceKey) && !matchedRows.has(scheme.rowNumber);
  }).map(function (scheme) {
    const keys = clean(scheme.sourceKey).split(",").map(clean).filter(Boolean);
    const unavailable = keys.some(function (key) {
      const health = healthMap.get(key);
      return !health || !health.success;
    });
    return {
      action: "PRESERVE_STALE",
      reason: unavailable ? "SOURCE_UNAVAILABLE" : "RECORD_NOT_RETURNED",
      existing: scheme
    };
  });
  return { inserts: inserts, updates: updates, unchanged: unchanged, reviews: reviews, stale: stale };
}

function cacheValuesForScheme(scheme) {
  return {
    Scheme_ID: scheme.schemeId,
    Scheme_Name: scheme.schemeName,
    Government: scheme.schemeLevel,
    Department: scheme.department,
    Category: scheme.category,
    Subcategory: scheme.subcategory,
    Purpose: scheme.purpose,
    Benefit: scheme.benefitSummary,
    Eligibility: scheme.eligibilitySummary,
    Target_Beneficiaries: scheme.targetBeneficiaries,
    Crop_Context: scheme.cropContext,
    Livestock_Context: scheme.livestockContext,
    Land_Context: scheme.landContext,
    District: scheme.districtApplicability,
    State_Applicability: scheme.stateApplicability,
    Application_Start: scheme.applicationStart,
    Last_Date: scheme.applicationEnd,
    Status: scheme.status,
    Source: scheme.officialSource,
    Official_URL: scheme.officialUrl,
    Application_Link: scheme.applicationUrl,
    Last_Source_Update: scheme.lastSourceUpdate,
    Last_Checked: scheme.lastChecked,
    Last_Updated: scheme.lastSourceUpdate || scheme.lastChecked.slice(0, 10),
    Source_Hash: scheme.sourceHash,
    Data_Quality: scheme.dataQuality,
    Source_Key: scheme.sourceKey
  };
}

function rowByHeader(headers, values) {
  const normalizedValues = Object.create(null);
  Object.keys(values || {}).forEach(function (key) {
    normalizedValues[normalizeHeader(key)] = values[key];
  });
  return (headers || []).map(function (header) {
    const key = normalizeHeader(header);
    return Object.prototype.hasOwnProperty.call(normalizedValues, key) ? normalizedValues[key] : "";
  });
}

async function runSchemeSync(options) {
  const input = options || {};
  const sources = input.sources || OFFICIAL_SCHEME_SOURCES;
  const dryRun = input.dryRun !== false;
  const rateLimit = input.rateLimit || createRateLimiter(
    Number.isFinite(input.rateLimitMs) ? input.rateLimitMs : DEFAULT_RATE_LIMIT_MS
  );
  const sourceResults = [];
  for (const source of sources) {
    sourceResults.push(await fetchOfficialSource(source, {
      httpClient: input.httpClient,
      maxRetries: input.maxRetries,
      timeoutMs: input.timeoutMs,
      rateLimit: rateLimit,
      now: input.now,
      sources: sources
    }));
  }
  const normalized = sourceResults.flatMap(function (result) { return result.schemes; });
  const health = sourceResults.map(function (result) { return result.health; });
  const schemes = deduplicateSchemes(normalized);
  const cacheRows = Array.isArray(input.cacheRows) ? input.cacheRows : [];
  const schema = assessCacheSchema(cacheRows[0] || []);
  const cached = readCachedSchemes(cacheRows);
  const plan = planCacheChanges(schemes, cached, health);
  let writeResult = null;
  let writeBlocked = false;
  if (!dryRun) {
    if (!schema.writeReady) {
      writeBlocked = true;
    } else if (typeof input.writeCache !== "function") {
      writeBlocked = true;
    } else {
      writeResult = await input.writeCache({
        headers: cacheRows[0] || [],
        plan: plan,
        rowByHeader: rowByHeader,
        cacheValuesForScheme: cacheValuesForScheme
      });
    }
  }
  return {
    dryRun: dryRun,
    writeBlocked: writeBlocked,
    schema: schema,
    sourceHealth: health,
    counts: {
      configuredSources: sources.length,
      fetchedSources: health.filter(function (entry) { return entry.success; }).length,
      recordsFound: health.reduce(function (sum, entry) { return sum + entry.recordsFound; }, 0),
      recordsAccepted: normalized.length,
      recordsAfterDeduplication: schemes.length,
      proposedInserts: plan.inserts.length,
      proposedUpdates: plan.updates.length,
      unchanged: plan.unchanged.length,
      manualReview: plan.reviews.length,
      preservedStale: plan.stale.length
    },
    schemes: schemes,
    plan: plan,
    writeResult: writeResult
  };
}

module.exports = {
  CACHE_FIELD_ALIASES,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RATE_LIMIT_MS,
  DEFAULT_TIMEOUT_MS,
  FINGERPRINT_FIELDS,
  PROPOSED_SCHEMA_EXTENSION,
  assessCacheSchema,
  cacheValuesForScheme,
  canonicalUrl,
  createRateLimiter,
  deduplicateSchemes,
  fetchOfficialSource,
  internalSchemeId,
  isApprovedOfficialUrl,
  meaningfulChanges,
  normalizeRawScheme,
  normalizeStatus,
  parseOfficialHtml,
  planCacheChanges,
  readCachedSchemes,
  rowByHeader,
  runSchemeSync,
  sanitizeText,
  sourceFingerprint
};
