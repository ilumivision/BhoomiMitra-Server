"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PROPOSED_SCHEMA_EXTENSION,
  normalizeRawScheme,
  sourceFingerprint
} = require("../utils/schemeIngestion");
const { prepareSchemeCacheUpdates } = require("../utils/schemeCacheWriter");

const HEADERS = [
  "Scheme_ID", "Scheme_Name", "Government", "Department", "Category",
  "Purpose", "Benefit", "Eligibility", "District", "Last_Date", "Status",
  "Source", "Official_URL", "Application_Link", "Last_Checked", "Last_Updated"
].concat(PROPOSED_SCHEMA_EXTENSION);

function scheme(overrides) {
  const source = {
    id: "CENTRAL_TEST",
    name: "Official Test Department",
    schemeName: "Official Farmer Support",
    level: "Central",
    department: "Department of Agriculture",
    category: "Agriculture",
    url: "https://example.gov.in/scheme",
    applicationUrl: "https://example.gov.in/apply",
    allowedHosts: ["example.gov.in"]
  };
  const result = normalizeRawScheme(Object.assign({
    schemeName: "Official Farmer Support",
    department: "Department of Agriculture",
    category: "Agriculture",
    purpose: "Farmer support",
    benefitSummary: "Stored official benefit",
    eligibilitySummary: "Verify eligibility with the department",
    officialUrl: "https://example.gov.in/scheme",
    applicationUrl: "https://example.gov.in/apply",
    status: "Active"
  }, overrides || {}), source, {
    now: new Date("2026-10-20T06:00:00Z"),
    sources: [source]
  });
  assert.equal(result.accepted, true);
  const normalized = result.scheme;
  normalized.sourceHash = sourceFingerprint(normalized);
  return normalized;
}

test("controlled scheme preparation blocks an unapproved schema and performs no writes", function () {
  const result = prepareSchemeCacheUpdates({
    headers: ["Scheme_ID", "Scheme_Name"],
    plan: { inserts: [{ scheme: scheme() }] }
  });
  assert.equal(result.ready, false);
  assert.equal(result.code, "SCHEME_CACHE_SCHEMA_NOT_APPROVED");
  assert.deepEqual(result.inserts, []);
  assert.deepEqual(result.updates, []);
});

test("fixture insert preserves official source link validity and verification fields", function () {
  const incoming = scheme();
  const result = prepareSchemeCacheUpdates({
    headers: HEADERS,
    plan: { inserts: [{ action: "INSERT", scheme: incoming }] }
  });
  assert.equal(result.ready, true);
  assert.equal(result.inserts.length, 1);
  const row = result.inserts[0].values;
  assert.equal(row[HEADERS.indexOf("Official_URL")], "https://example.gov.in/scheme");
  assert.equal(row[HEADERS.indexOf("Source")], "Official Test Department");
  assert.equal(row[HEADERS.indexOf("Status")], "Active");
  assert.ok(row[HEADERS.indexOf("Last_Checked")]);
  assert.equal(row[HEADERS.indexOf("Source_Hash")], incoming.sourceHash);
});

test("fixture update targets only managed cells and never deletes stale or review rows", function () {
  const incoming = scheme({ benefitSummary: "Updated official benefit" });
  const result = prepareSchemeCacheUpdates({
    headers: HEADERS.concat(["Staff_Notes"]),
    plan: {
      updates: [{
        action: "UPDATE",
        scheme: incoming,
        existing: { rowNumber: 7 },
        changedFields: ["benefitSummary"]
      }],
      stale: [{ action: "PRESERVE_STALE" }],
      reviews: [{ action: "MANUAL_REVIEW" }]
    }
  });
  assert.equal(result.ready, true);
  assert.equal(result.updates.length, 1);
  assert.equal(result.updates[0].rowNumber, 7);
  assert.equal(result.updates[0].cells.some(function (cell) {
    return cell.header === "Staff_Notes";
  }), false);
  assert.equal(result.preserved.stale, 1);
  assert.equal(result.preserved.manualReview, 1);
});
