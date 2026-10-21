"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  FEATURE_CATALOGUE,
  createFeatureDiscovery
} = require("../utils/whatsNew");

test("What's New delivery status is durable and contains no raw farmer identifier", function (t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bhoomimitra-feature-"));
  const filePath = path.join(directory, "whats-new-state.json");
  t.after(function () {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const firstProcess = createFeatureDiscovery({ filePath });
  const feature = firstProcess.claim("919876543210", {
    userCategory: "FARMER",
    date: "2026-10-21"
  });
  assert.equal(feature.id, FEATURE_CATALOGUE[0].id);
  firstProcess.markShown("919876543210", feature.id);
  assert.equal(firstProcess.persistence, "LOCAL_FILE");

  const restartedProcess = createFeatureDiscovery({ filePath });
  assert.equal(restartedProcess.claim("919876543210", {
    userCategory: "FARMER",
    date: "2026-10-21"
  }), null);
  assert.equal(
    restartedProcess.firstAvailable({ userCategory: "FARMER", date: "2026-10-21" }).id,
    feature.id,
    "an explicit menu request can still display the feature"
  );

  const saved = fs.readFileSync(filePath, "utf8");
  assert.doesNotMatch(saved, /919876543210/);
});

test("dismissal remains acknowledged across a restart", function (t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bhoomimitra-dismiss-"));
  const filePath = path.join(directory, "whats-new-state.json");
  t.after(function () {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const firstProcess = createFeatureDiscovery({ filePath });
  const feature = firstProcess.claim("farmer-fixture", {
    userCategory: "FARMER",
    date: "2026-10-21"
  });
  firstProcess.acknowledge("farmer-fixture", feature.id);

  const restartedProcess = createFeatureDiscovery({ filePath });
  assert.equal(restartedProcess.select("farmer-fixture", {
    userCategory: "FARMER",
    date: "2026-10-21"
  }), null);
});
