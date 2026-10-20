"use strict";

const {
  assessCacheSchema,
  cacheValuesForScheme,
  rowByHeader
} = require("./schemeIngestion");

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function managedValueMap(values) {
  const mapped = new Map();
  Object.keys(values || {}).forEach(function (key) {
    mapped.set(normalizeHeader(key), values[key]);
  });
  return mapped;
}

function prepareSchemeCacheUpdates(options) {
  const input = options || {};
  const headers = Array.isArray(input.headers) ? input.headers : [];
  const plan = input.plan || {};
  const schema = assessCacheSchema(headers);

  if (!schema.writeReady) {
    return {
      ready: false,
      code: "SCHEME_CACHE_SCHEMA_NOT_APPROVED",
      schema,
      inserts: [],
      updates: []
    };
  }

  const inserts = (plan.inserts || []).map(function (entry) {
    const scheme = entry.scheme || {};
    return {
      action: "INSERT",
      schemeId: scheme.schemeId,
      values: rowByHeader(headers, cacheValuesForScheme(scheme))
    };
  });
  const updates = [];

  (plan.updates || []).forEach(function (entry) {
    const scheme = entry.scheme || {};
    const existing = entry.existing || {};
    const rowNumber = Number(existing.rowNumber);
    if (!Number.isInteger(rowNumber) || rowNumber < 2) return;
    const values = managedValueMap(cacheValuesForScheme(scheme));
    const cells = [];
    headers.forEach(function (header, columnIndex) {
      const key = normalizeHeader(header);
      if (!values.has(key)) return;
      cells.push({
        columnIndex,
        header,
        value: values.get(key)
      });
    });
    updates.push({
      action: "UPDATE_MANAGED_CELLS",
      schemeId: scheme.schemeId,
      rowNumber,
      changedFields: entry.changedFields || [],
      cells
    });
  });

  return {
    ready: true,
    code: "SCHEME_CACHE_UPDATE_PREPARED",
    schema,
    inserts,
    updates,
    preserved: {
      unchanged: (plan.unchanged || []).length,
      manualReview: (plan.reviews || []).length,
      stale: (plan.stale || []).length
    }
  };
}

module.exports = {
  prepareSchemeCacheUpdates
};
