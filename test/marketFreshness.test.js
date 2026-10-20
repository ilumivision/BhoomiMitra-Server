"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assessMarketFreshness,
  getMarketPrice
} = require("../utils/market");

const HEADERS = [
  "Commodity_Name", "District", "Market", "Unit", "Modal_Price",
  "Minimum_Price", "Maximum_Price", "Source_Name",
  "Source_Published_Date", "Source_Published_Time", "Last_Checked_At"
];
const NOW = new Date("2026-10-20T06:00:00.000Z");

function row(overrides) {
  const values = Object.assign({
    Commodity_Name: "Banana",
    District: "Pathanamthitta",
    Market: "Adoor",
    Unit: "kg",
    Modal_Price: "42",
    Minimum_Price: "40",
    Maximum_Price: "45",
    Source_Name: "AGMARKNET",
    Source_Published_Date: "2026-10-20",
    Source_Published_Time: "05:00:00Z",
    Last_Checked_At: "2026-10-20T05:10:00Z"
  }, overrides || {});
  return HEADERS.map(function (header) { return values[header] || ""; });
}

async function lookup(dataRows, query) {
  return getMarketPrice({
    async readSheetRows() { return [HEADERS].concat(dataRows); },
    query: query || { commodity: "Banana", district: "Pathanamthitta" },
    now: NOW,
    maximumAgeHours: 48
  });
}

test("fresh matching saved market price is eligible as current", async function () {
  const result = await lookup([row()]);
  assert.equal(result.success, true);
  assert.equal(result.usable, true);
  assert.equal(result.isCurrent, true);
  assert.equal(result.freshness.reason, "CURRENT_WITHIN_THRESHOLD");
  assert.doesNotMatch(result.reply, /historical or unverified/i);
});

test("stale saved price remains available only with a historical warning", async function () {
  const result = await lookup([row({
    Source_Published_Date: "2026-10-15",
    Source_Published_Time: "05:00:00Z"
  })]);
  assert.equal(result.success, true);
  assert.equal(result.isCurrent, false);
  assert.equal(result.freshness.reason, "STALE_SOURCE_OBSERVATION");
  assert.match(result.reply, /historical or unverified/i);
  assert.match(result.reply, /2026-10-15/);
  assert.match(result.reply, /AGMARKNET/);
});

test("missing source date is never presented as current", async function () {
  const result = await lookup([row({
    Source_Published_Date: "",
    Source_Published_Time: ""
  })]);
  assert.equal(result.isCurrent, false);
  assert.equal(result.freshness.reason, "SOURCE_OBSERVATION_TIME_UNAVAILABLE");
  assert.match(result.reply, /not being presented as today's price/i);
});

test("unrelated commodity or district is not returned", async function () {
  const result = await lookup([row({ Commodity_Name: "Tomato" })]);
  assert.equal(result.success, false);
  assert.equal(result.isCurrent, false);
});

test("freshness assessment rejects future source timestamps", function () {
  const result = assessMarketFreshness({
    source_published_date: "2026-10-21",
    source_published_time: "05:00:00Z"
  }, { now: NOW });
  assert.equal(result.current, false);
  assert.equal(result.reason, "SOURCE_OBSERVATION_TIME_IN_FUTURE");
});
