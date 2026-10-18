"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { SOURCE_SUPPORT } = require("../utils/schemeSources");
const {
  PROPOSED_SCHEMA_EXTENSION,
  assessCacheSchema,
  cacheValuesForScheme,
  deduplicateSchemes,
  fetchOfficialSource,
  meaningfulChanges,
  normalizeRawScheme,
  planCacheChanges,
  rowByHeader,
  runSchemeSync,
  sourceFingerprint
} = require("../utils/schemeIngestion");

const NOW = new Date("2026-10-17T06:00:00.000Z");

const FULL_HEADERS = [
  "Scheme_ID", "Scheme_Name", "Government", "Department", "Category", "Subcategory",
  "Purpose", "Benefit", "Eligibility", "Target_Beneficiaries", "Crop_Context",
  "Livestock_Context", "Land_Context", "District", "State_Applicability",
  "Application_Start", "Last_Date", "Status", "Source", "Official_URL",
  "Application_Link", "Last_Source_Update", "Last_Checked", "Last_Updated",
  "Source_Hash", "Data_Quality", "Source_Key"
];

function source(overrides) {
  return Object.assign({
    id: "CENTRAL_TEST",
    name: "Official Agriculture Source",
    schemeName: "Farm Support Scheme",
    level: "Central",
    department: "Department of Agriculture & Farmers Welfare",
    category: "Agriculture",
    url: "https://agrimachinery.nic.in/",
    applicationUrl: "https://agrimachinery.nic.in/",
    allowedHosts: ["agrimachinery.nic.in"],
    support: SOURCE_SUPPORT.HTML_SINGLE,
    parser: {
      expectedText: "Farm Support Scheme",
      contentSelector: "main, body",
      summarySelector: "p"
    }
  }, overrides || {});
}

function normalize(raw, sourceValue) {
  const result = normalizeRawScheme(raw, sourceValue || source(), { now: NOW });
  assert.equal(result.accepted, true);
  return result.scheme;
}

function successfulHttp(html) {
  return {
    async get(url) {
      return {
        status: 200,
        data: html,
        config: { url: url },
        headers: { "content-type": "text/html" }
      };
    }
  };
}

const GOOD_HTML = "<!doctype html><html><body><main><h1>Farm Support Scheme</h1>" +
  "<p>This official programme supports farmers through approved agricultural development activities.</p>" +
  "</main></body></html>";

test("Central-source normalization preserves official facts", function () {
  const scheme = normalize({
    schemeName: "Central Irrigation Support",
    purpose: "Support verified irrigation improvements.",
    benefitSummary: "Assistance described by the official source.",
    eligibilitySummary: "Farmers meeting the published conditions.",
    status: "Active",
    officialUrl: "https://agrimachinery.nic.in/"
  });
  assert.equal(scheme.schemeLevel, "Central");
  assert.equal(scheme.status, "Active");
  assert.match(scheme.schemeId, /^SCH-[A-F0-9]{20}$/);
  assert.equal(scheme.dataQuality, "VerifiedSource");
});

test("Kerala-source normalization preserves Kerala applicability", function () {
  const keralaSource = source({
    id: "KERALA_TEST",
    level: "Kerala",
    department: "State Horticulture Mission Kerala",
    stateApplicability: "Kerala",
    url: "https://shm.kerala.gov.in/scheme-details/",
    applicationUrl: "",
    allowedHosts: ["shm.kerala.gov.in"]
  });
  const scheme = normalize({ schemeName: "Kerala Horticulture Support" }, keralaSource);
  assert.equal(scheme.schemeLevel, "Kerala");
  assert.equal(scheme.stateApplicability, "Kerala");
  assert.equal(scheme.officialUrl, keralaSource.url);
});

test("invalid or unofficial source is rejected", function () {
  const unofficial = source({
    url: "https://commercial-example.test/schemes",
    allowedHosts: ["agrimachinery.nic.in"]
  });
  const result = normalizeRawScheme({ schemeName: "Untrusted" }, unofficial, { now: NOW });
  assert.deepEqual(result, { accepted: false, reason: "UNAPPROVED_SOURCE" });
});

test("missing optional fields are safe and marked for review", function () {
  const scheme = normalize({ schemeName: "Sparse Official Scheme" });
  assert.equal(scheme.benefitSummary, "");
  assert.equal(scheme.eligibilitySummary, "");
  assert.equal(scheme.status, "Unknown");
  assert.equal(scheme.dataQuality, "PartialNeedsReview");
});

test("explicit active status remains Active", function () {
  assert.equal(normalize({ schemeName: "Active Scheme", status: "Open" }).status, "Active");
});

test("past official closing date overrides active wording", function () {
  const scheme = normalize({
    schemeName: "Closed Scheme",
    status: "Active",
    applicationEnd: "2026-10-16"
  });
  assert.equal(scheme.status, "Expired");
});

test("unknown-date scheme does not invent active status", function () {
  const scheme = normalize({ schemeName: "Undated Scheme" });
  assert.equal(scheme.status, "Unknown");
  assert.equal(scheme.applicationEnd, "");
});

test("duplicate scheme across official sources is merged defensibly", function () {
  const first = normalize({
    schemeName: "Shared Farm Scheme",
    benefitSummary: "Benefit from source one."
  });
  const secondSource = source({
    id: "CENTRAL_TEST_TWO",
    name: "Second Official Source",
    url: "https://pmfby.gov.in/",
    applicationUrl: "",
    allowedHosts: ["pmfby.gov.in"]
  });
  const second = normalize({
    schemeName: "Shared Farm Scheme",
    eligibilitySummary: "Eligibility from source two."
  }, secondSource);
  const result = deduplicateSchemes([first, second]);
  assert.equal(result.length, 1);
  assert.equal(result[0].benefitSummary, "Benefit from source one.");
  assert.equal(result[0].eligibilitySummary, "Eligibility from source two.");
  assert.deepEqual(result[0].sourceKeys, ["CENTRAL_TEST", "CENTRAL_TEST_TWO"]);
});

test("distinct schemes with similar benefit wording are not merged", function () {
  const first = normalize({ schemeName: "Drip Support", benefitSummary: "Financial assistance for farmers." });
  const second = normalize({ schemeName: "Dairy Support", benefitSummary: "Financial assistance for farmers." });
  assert.equal(deduplicateSchemes([first, second]).length, 2);
});

test("source timeout is contained and reported", async function () {
  const client = {
    async get() {
      const error = new Error("timeout");
      error.code = "ECONNABORTED";
      throw error;
    }
  };
  const result = await fetchOfficialSource(source(), {
    httpClient: client,
    maxRetries: 0,
    rateLimit: async function () {},
    now: NOW
  });
  assert.equal(result.health.success, false);
  assert.equal(result.health.attempts, 1);
  assert.match(result.health.parseWarnings[0], /timeout/i);
});

test("one source failure does not abort the complete sync", async function () {
  const failed = source({ id: "FAILED_SOURCE", url: "https://pmfby.gov.in/", allowedHosts: ["pmfby.gov.in"] });
  const healthy = source({ id: "HEALTHY_SOURCE" });
  const client = {
    async get(url) {
      if (url.includes("pmfby")) {
        const error = new Error("network unavailable");
        error.code = "ECONNRESET";
        throw error;
      }
      return { status: 200, data: GOOD_HTML, config: { url: url } };
    }
  };
  const result = await runSchemeSync({
    sources: [failed, healthy],
    httpClient: client,
    cacheRows: [FULL_HEADERS],
    dryRun: true,
    maxRetries: 0,
    rateLimit: async function () {},
    now: NOW
  });
  assert.equal(result.sourceHealth.length, 2);
  assert.equal(result.counts.fetchedSources, 1);
  assert.equal(result.counts.recordsAfterDeduplication, 1);
});

test("retry limit is enforced", async function () {
  let calls = 0;
  const result = await fetchOfficialSource(source(), {
    httpClient: {
      async get() {
        calls += 1;
        const error = new Error("timeout");
        error.code = "ETIMEDOUT";
        throw error;
      }
    },
    maxRetries: 2,
    rateLimit: async function () {},
    now: NOW
  });
  assert.equal(calls, 3);
  assert.equal(result.health.attempts, 3);
});

test("dry-run performs no cache writes", async function () {
  let writes = 0;
  const result = await runSchemeSync({
    sources: [source()],
    httpClient: successfulHttp(GOOD_HTML),
    cacheRows: [FULL_HEADERS],
    dryRun: true,
    maxRetries: 0,
    rateLimit: async function () {},
    now: NOW,
    async writeCache() { writes += 1; }
  });
  assert.equal(writes, 0);
  assert.equal(result.dryRun, true);
  assert.equal(result.counts.proposedInserts, 1);
});

test("new normalized record is proposed as an insert", function () {
  const scheme = normalize({ schemeName: "New Scheme" });
  const plan = planCacheChanges([scheme], [], []);
  assert.equal(plan.inserts.length, 1);
  assert.equal(plan.updates.length, 0);
});

test("changed managed record is proposed as an update", function () {
  const previous = normalize({ schemeName: "Managed Scheme", benefitSummary: "Old benefit." });
  const incoming = Object.assign({}, previous, { benefitSummary: "New official benefit." });
  incoming.sourceHash = sourceFingerprint(incoming);
  const cached = Object.assign({ rowNumber: 2 }, previous);
  const plan = planCacheChanges([incoming], [cached], []);
  assert.equal(plan.updates.length, 1);
  assert.deepEqual(plan.updates[0].changedFields, ["benefitSummary"]);
});

test("unchanged managed record is skipped", function () {
  const scheme = normalize({ schemeName: "Unchanged Scheme", purpose: "Stable purpose." });
  const plan = planCacheChanges([scheme], [Object.assign({ rowNumber: 2 }, scheme)], []);
  assert.equal(plan.unchanged.length, 1);
  assert.equal(plan.updates.length, 0);
});

test("meaningful change detection covers deadline URL status and department", function () {
  const original = normalize({ schemeName: "Change Scheme", status: "Active" });
  const changed = Object.assign({}, original, {
    benefitSummary: "Changed benefit",
    eligibilitySummary: "Changed eligibility",
    applicationEnd: "2026-12-31",
    applicationUrl: "https://agrimachinery.nic.in/apply",
    status: "Upcoming",
    department: "Updated Official Department"
  });
  const fields = meaningfulChanges(original, changed);
  ["benefitSummary", "eligibilitySummary", "applicationEnd", "applicationUrl", "status", "department"]
    .forEach(function (field) { assert.ok(fields.includes(field)); });
});

test("official URL is preserved exactly", function () {
  const url = "https://agrimachinery.nic.in/Files/Guidelines/Guidelines_SMAM2024.pdf";
  const scheme = normalize({ schemeName: "SMAM", officialUrl: url });
  assert.equal(scheme.officialUrl, url);
});

test("stale cached scheme is preserved when its source is unavailable", function () {
  const cached = Object.assign({ rowNumber: 2 }, normalize({ schemeName: "Cached Scheme" }));
  const plan = planCacheChanges([], [cached], [{ sourceId: cached.sourceKey, success: false }]);
  assert.equal(plan.stale.length, 1);
  assert.equal(plan.stale[0].action, "PRESERVE_STALE");
  assert.equal(plan.stale[0].reason, "SOURCE_UNAVAILABLE");
});

test("malformed HTML or JSON-like response fails safely", async function () {
  for (const body of ["<html><body></body></html>", '{"unexpected":true}']) {
    const result = await fetchOfficialSource(source(), {
      httpClient: successfulHttp(body),
      maxRetries: 0,
      rateLimit: async function () {},
      now: NOW
    });
    assert.equal(result.health.success, false);
    assert.equal(result.schemes.length, 0);
    assert.ok(result.health.parseWarnings.length > 0);
  }
});

test("cache rows are built by header name and schema gate reports exact extension", function () {
  const scheme = normalize({ schemeName: "Header Safe Scheme", purpose: "Purpose" });
  const reordered = FULL_HEADERS.slice().reverse();
  const row = rowByHeader(reordered, cacheValuesForScheme(scheme));
  assert.equal(row[reordered.indexOf("Scheme_Name")], "Header Safe Scheme");
  assert.equal(row[reordered.indexOf("Source_Hash")], scheme.sourceHash);
  const currentHeaders = [
    "Scheme_ID", "Scheme_Name", "Department", "Government", "Category", "Eligibility",
    "Benefit", "Financial_Assistance", "Documents_Required", "Application_Mode",
    "Application_Link", "Contact_Office", "District", "Last_Date", "Status", "Source",
    "Last_Updated", "Remarks"
  ];
  const assessment = assessCacheSchema(currentHeaders);
  assert.equal(assessment.writeReady, false);
  assert.deepEqual(assessment.proposedExtension, PROPOSED_SCHEMA_EXTENSION);
});
