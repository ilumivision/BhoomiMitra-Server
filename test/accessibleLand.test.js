"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getAccessibleLand } = require("../utils/accessibleLand");

test("satellite land bridge preserves owner identity for both secure reads", async function () {
  const calls = [];
  const result = await getAccessibleLand({
    sheets: { marker: true },
    spreadsheetId: "sheet-id",
    landId: "BM-L-000003",
    farmerId: "BM-F-000001",
    whatsapp: "919876543210",
    async getAccessibleLandBoundaryStatus(request) {
      calls.push({ stage: "status", request });
      return {
        success: true,
        mappingStatus: "COMPLETED",
        accessType: "OWNER",
        accessLevel: "MANAGE"
      };
    },
    async getLandBoundaryMapData(request) {
      calls.push({ stage: "map", request });
      return { success: true, landId: request.landId };
    }
  });

  assert.equal(result.success, true);
  assert.equal(result.accessType, "OWNER");
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.request.farmerId, "BM-F-000001");
    assert.equal(call.request.whatsapp, "919876543210");
    assert.equal(call.request.landId, "BM-L-000003");
  }
});

test("satellite land bridge preserves authorised VIEW identity", async function () {
  let mapRequest;
  const result = await getAccessibleLand({
    landId: "BM-L-000003",
    farmerId: "BM-F-000099",
    whatsapp: "919111111111",
    async getAccessibleLandBoundaryStatus() {
      return {
        success: true,
        mappingStatus: "COMPLETED",
        accessType: "SHARED",
        accessLevel: "VIEW"
      };
    },
    async getLandBoundaryMapData(request) {
      mapRequest = request;
      return { success: true, landId: request.landId };
    }
  });

  assert.equal(result.success, true);
  assert.equal(result.accessLevel, "VIEW");
  assert.equal(mapRequest.farmerId, "BM-F-000099");
  assert.equal(mapRequest.whatsapp, "919111111111");
});

test("satellite land bridge rejects unauthorised access before private map data", async function () {
  let mapReads = 0;
  const result = await getAccessibleLand({
    landId: "BM-L-000003",
    farmerId: "BM-F-000099",
    whatsapp: "919111111111",
    async getAccessibleLandBoundaryStatus() {
      return { success: false, error: "Access denied." };
    },
    async getLandBoundaryMapData() {
      mapReads += 1;
      return { success: true };
    }
  });

  assert.equal(result.success, false);
  assert.equal(result.error, "Access denied.");
  assert.equal(mapReads, 0);
});

test("satellite land bridge requires completed boundary mapping", async function () {
  let mapReads = 0;
  const result = await getAccessibleLand({
    landId: "BM-L-000003",
    farmerId: "BM-F-000001",
    whatsapp: "919876543210",
    async getAccessibleLandBoundaryStatus() {
      return { success: true, mappingStatus: "IN_PROGRESS" };
    },
    async getLandBoundaryMapData() {
      mapReads += 1;
      return { success: true };
    }
  });

  assert.equal(result.success, false);
  assert.equal(mapReads, 0);
});
