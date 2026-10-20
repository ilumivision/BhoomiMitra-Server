"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { runMarketCheck } = require("../utils/marketScheduler");
const {
  executionAuthorized,
  main
} = require("../scripts/update-market-prices");

test("market updater command is disabled unless flag and environment gate agree", async function () {
  assert.equal(executionAuthorized([], {}), false);
  assert.equal(executionAuthorized(["--execute"], {}), false);
  assert.equal(executionAuthorized([], { MARKET_UPDATE_ENABLED: "true" }), false);
  assert.equal(executionAuthorized(["--execute"], { MARKET_UPDATE_ENABLED: "true" }), true);

  let output;
  let runs = 0;
  const result = await main({
    argv: [],
    env: {},
    writeOutput(value) { output = value; },
    async runMarketCheck() { runs += 1; }
  });
  assert.equal(result.mode, "DISABLED");
  assert.equal(result.sheetWrites, 0);
  assert.equal(output.schedulerActivated, undefined);
  assert.equal(runs, 0);
});

test("official-source failure causes no cache read or write", async function () {
  let reads = 0;
  let writes = 0;
  const result = await runMarketCheck({
    forceRun: true,
    async fetchAllSources() { return []; },
    async readSheetRows() { reads += 1; return []; },
    async appendRow() { writes += 1; },
    async updateRow() { writes += 1; }
  });
  assert.equal(result.success, false);
  assert.equal(result.reason, "NO_OFFICIAL_MARKET_RECORDS");
  assert.equal(reads, 0);
  assert.equal(writes, 0);
});

test("controlled market command remains manual and passes adapters only after authorization", async function () {
  let called = 0;
  const report = await main({
    argv: ["--execute", "--force"],
    env: {
      MARKET_UPDATE_ENABLED: "true",
      GOOGLE_SHEET_ID: "fixture-sheet",
      GOOGLE_CLIENT_EMAIL: "fixture@example.invalid",
      GOOGLE_PRIVATE_KEY: "fixture-key"
    },
    auth: {},
    sheetsApi: { spreadsheets: { values: {} } },
    writeOutput() {},
    async runMarketCheck(options) {
      called += 1;
      assert.equal(options.forceRun, true);
      assert.equal(typeof options.readSheetRows, "function");
      assert.equal(typeof options.appendRow, "function");
      assert.equal(typeof options.updateRow, "function");
      return { success: true, fetchedCount: 1 };
    }
  });
  assert.equal(called, 1);
  assert.equal(report.mode, "MANUAL_CONTROLLED_EXECUTION");
  assert.equal(report.schedulerActivated, false);
});
