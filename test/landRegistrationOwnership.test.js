"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  registerLand,
  getFarmerLands
} = require("../utils/landRegistration");

function fakeSheets(initialRows) {
  const rows = initialRows.map(function (row) { return row.slice(); });
  const calls = { get: 0, append: 0 };
  return {
    rows,
    calls,
    client: {
      spreadsheets: {
        values: {
          async get() {
            calls.get += 1;
            return { data: { values: rows.map(function (row) { return row.slice(); }) } };
          },
          async append(request) {
            calls.append += 1;
            rows.push(request.requestBody.values[0].slice());
          }
        }
      }
    }
  };
}

const HEADERS = [
  "Land_ID",
  "Farmer_ID",
  "Phone",
  "Farm_Name",
  "District",
  "Local_Body_Type",
  "Local_Body",
  "Farmer_Reported_Area",
  "Area_Unit",
  "Main_Crop",
  "Status"
];

test("land listing is isolated by Farmer_ID even when phone values are shared", async function () {
  const fake = fakeSheets([
    HEADERS,
    ["BM-L-000001", "BM-1001", "9847298918", "Owner Farm", "Kottayam", "Panchayat", "A", "1", "Acre", "Pepper", "Active"],
    ["BM-L-000002", "BM-2002", "9847298918", "Other Farm", "Kottayam", "Panchayat", "B", "2", "Acre", "Rubber", "Active"]
  ]);

  const result = await getFarmerLands({
    sheets: fake.client,
    spreadsheetId: "test-sheet",
    farmerId: "BM-1001",
    phone: "9847298918"
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.lands.map(function (land) { return land.landId; }), ["BM-L-000001"]);
  assert.doesNotMatch(JSON.stringify(result), /Other Farm|BM-L-000002/);
});

test("land listing fails before Sheets access when verified Farmer_ID is missing", async function () {
  const fake = fakeSheets([HEADERS]);
  const result = await getFarmerLands({
    sheets: fake.client,
    spreadsheetId: "test-sheet",
    phone: "9847298918"
  });

  assert.equal(result.success, false);
  assert.equal(result.code, "FARMER_ID_REQUIRED");
  assert.equal(fake.calls.get, 0);
});

test("land registration persists the verified Farmer_ID and never infers it from phone", async function () {
  const fake = fakeSheets([HEADERS]);
  const result = await registerLand({
    sheets: fake.client,
    spreadsheetId: "test-sheet",
    phone: "9847298918",
    land: {
      farmerId: "BM-1001",
      farmName: "Verified Farm",
      district: "Kottayam",
      localBodyType: "Panchayat",
      localBody: "Example",
      area: "1",
      areaUnit: "Acre",
      mainCrop: "Pepper"
    }
  });

  assert.equal(result.success, true);
  assert.equal(fake.calls.append, 1);
  assert.equal(fake.rows[1][HEADERS.indexOf("Farmer_ID")], "BM-1001");
  assert.equal(fake.rows[1][HEADERS.indexOf("Phone")], "9847298918");
});
