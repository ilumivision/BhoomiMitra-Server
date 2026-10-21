"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseLandUpdateDetails,
  updateLandDetails
} = require("../utils/landRegistration");
const {
  formatFarmSummary,
  formatOperationSummary,
  relevantOperations
} = require("../utils/cropFarmRecords");

const LAND_HEADERS = [
  "Land_ID", "Farmer_ID", "Farm_Name", "District", "Local_Body",
  "Main_Crop", "Other_Crops", "Active_Status", "Updated_At"
];

function makeSheets(rows) {
  const batchCalls = [];
  return {
    batchCalls,
    sheets: {
      spreadsheets: {
        values: {
          async get() { return { data: { values: rows } }; },
          async batchUpdate(request) {
            batchCalls.push(request);
            return { data: { totalUpdatedCells: request.requestBody.data.length } };
          }
        }
      }
    }
  };
}

test("land detail parser permits only the three approved existing fields", function () {
  assert.deepEqual(parseLandUpdateDetails("Home Farm | Coconut | Banana, Pepper"), {
    success: true,
    updates: {
      farmName: "Home Farm",
      mainCrop: "Coconut",
      otherCrops: "Banana, Pepper"
    }
  });
  assert.equal(parseLandUpdateDetails("- | - | -").code, "NO_CHANGES");
  assert.equal(parseLandUpdateDetails("Name | Crop").code, "DETAILS_REQUIRED");
  assert.equal(parseLandUpdateDetails("X | Crop | -").code, "INVALID_FARM_NAME");
});

test("land update changes only supported cells for the verified owner", async function () {
  const fixture = makeSheets([
    LAND_HEADERS,
    ["BM-L-000001", "BM-F-1", "Old Farm", "Kollam", "Anchal", "Pepper", "", "Active", "old"],
    ["BM-L-000002", "BM-F-2", "Other Farm", "Kollam", "Anchal", "Rubber", "", "Active", "old"]
  ]);
  const result = await updateLandDetails({
    sheets: fixture.sheets,
    spreadsheetId: "sheet",
    farmerId: "BM-F-1",
    landId: "BM-L-000001",
    updates: { farmName: "Home Farm", mainCrop: "Coconut", otherCrops: null },
    now: new Date("2026-10-21T10:00:00.000Z")
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.changedFields, ["farmName", "mainCrop"]);
  assert.equal(fixture.batchCalls.length, 1);
  assert.deepEqual(
    fixture.batchCalls[0].requestBody.data.map(function (entry) { return entry.range; }),
    ["Land_Parcels!C2", "Land_Parcels!F2", "Land_Parcels!I2"]
  );
  assert.deepEqual(fixture.batchCalls[0].requestBody.data[0].values, [["Home Farm"]]);
});

test("land update rejects another farmer, missing land, inactive land and missing headers", async function () {
  const rows = [
    LAND_HEADERS,
    ["BM-L-000001", "BM-F-1", "Home", "Kollam", "Anchal", "Pepper", "", "Inactive", "old"]
  ];
  const fixture = makeSheets(rows);

  assert.equal((await updateLandDetails({
    sheets: fixture.sheets, spreadsheetId: "sheet", farmerId: "BM-F-2",
    landId: "BM-L-000001", updates: { farmName: "Wrong Owner" }
  })).code, "LAND_OWNERSHIP_UNVERIFIED");
  assert.equal((await updateLandDetails({
    sheets: fixture.sheets, spreadsheetId: "sheet", farmerId: "BM-F-1",
    landId: "BM-L-999999", updates: { farmName: "Missing" }
  })).code, "LAND_NOT_FOUND");
  assert.equal((await updateLandDetails({
    sheets: fixture.sheets, spreadsheetId: "sheet", farmerId: "BM-F-1",
    landId: "BM-L-000001", updates: { farmName: "Inactive" }
  })).code, "LAND_INACTIVE");
  assert.equal(fixture.batchCalls.length, 0);

  const missingHeader = makeSheets([
    ["Land_ID", "Farmer_ID", "Farm_Name", "Active_Status"],
    ["BM-L-000001", "BM-F-1", "Home", "Active"]
  ]);
  assert.equal((await updateLandDetails({
    sheets: missingHeader.sheets, spreadsheetId: "sheet", farmerId: "BM-F-1",
    landId: "BM-L-000001", updates: { mainCrop: "Coconut" }
  })).code, "LAND_UPDATE_HEADER_MISSING");
});

test("a repeated identical land update is a safe no-op", async function () {
  const fixture = makeSheets([
    LAND_HEADERS,
    ["BM-L-000001", "BM-F-1", "Home Farm", "Kollam", "Anchal", "Coconut", "", "Active", "old"]
  ]);
  const result = await updateLandDetails({
    sheets: fixture.sheets, spreadsheetId: "sheet", farmerId: "BM-F-1",
    landId: "BM-L-000001", updates: { farmName: "Home Farm", mainCrop: "Coconut" }
  });
  assert.deepEqual(result, { success: true, noChanges: true, changedFields: [] });
  assert.equal(fixture.batchCalls.length, 0);
});

test("usage history and farm summary include only records for owned lands", function () {
  const lands = [{
    landId: "BM-L-1", farmerId: "BM-F-1", farmName: "Home Farm",
    district: "Kollam", panchayat: "Anchal", mainCrop: "Coconut"
  }];
  const crops = [
    { cropId: "BM-C-1", farmerId: "BM-F-1", landId: "BM-L-1", cropName: "Coconut", cropStatus: "Active" },
    { cropId: "BM-C-2", farmerId: "BM-F-2", landId: "BM-L-2", cropName: "Rubber", cropStatus: "Active" }
  ];
  const operations = [
    { operationId: "OP-1", farmerId: "BM-F-1", landId: "BM-L-1", cropId: "BM-C-1", operationType: "Irrigation", operationDate: "2026-10-20", operationStatus: "Completed" },
    { operationId: "OP-2", farmerId: "BM-F-2", landId: "BM-L-2", cropId: "BM-C-2", operationType: "Harvesting", operationDate: "2026-10-20", operationStatus: "Completed" }
  ];
  const ownedOperations = relevantOperations(operations, lands, crops, { farmerId: "BM-F-1" });
  const history = formatOperationSummary(ownedOperations, lands, crops, "English");
  const summary = formatFarmSummary(lands, crops, [], operations, "English");

  assert.match(history, /Irrigation/);
  assert.doesNotMatch(history, /Harvesting|Rubber/);
  assert.match(summary, /Registered lands: 1/);
  assert.match(summary, /Current crops: 1/);
  assert.match(summary, /Irrigation/);
  assert.doesNotMatch(summary, /Harvesting|Rubber/);
});

test("farm summary handles missing records without inventing data", function () {
  assert.match(formatFarmSummary([], [], [], [], "English"), /No farm linked/);
  const summary = formatFarmSummary([
    { landId: "BM-L-1", farmerId: "BM-F-1", farmName: "Home Farm" }
  ], [], [], [], "English");
  assert.match(summary, /Registered crops: 0/);
  assert.match(summary, /Recorded operations: 0/);
  assert.doesNotMatch(summary, /undefined|null/i);
});
