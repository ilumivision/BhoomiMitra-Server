"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildWeatherSheetReply } = require("../utils/weatherSheetReply");
const { createSoilModule } = require("../utils/soil");
const { createServiceFinder } = require("../utils/services");

test("weather integration shows fresh observations and future forecasts only", function () {
  const current = new Array(16).fill("");
  current[2] = "Pathanamthitta";
  current[3] = "2026-10-20";
  current[4] = "10:00";
  current[5] = "29";
  current[6] = "78";
  current[7] = "2";
  current[8] = "8";
  current[13] = "Light rain";
  current[15] = "2026-10-20 10:00";
  const past = new Array(13).fill("");
  past[2] = "Pathanamthitta";
  past[3] = "2026-10-19";
  const future = new Array(13).fill("");
  future[2] = "Pathanamthitta";
  future[3] = "2026-10-21";
  future[4] = "30";
  future[5] = "23";
  future[6] = "5";
  future[7] = "60";
  future[8] = "12";
  future[9] = "Rain";
  future[10] = "Protect harvested produce.";

  const reply = buildWeatherSheetReply({
    district: "Pathanamthitta",
    preferredLanguage: "English",
    currentRows: [current],
    forecastRows: [past, future],
    now: new Date("2026-10-20T05:00:00Z")
  });
  assert.match(reply, /Current weather/);
  assert.match(reply, /2026-10-21/);
  assert.doesNotMatch(reply, /2026-10-19/);
  assert.match(reply, /Protect harvested produce/);
});

test("weather integration labels stale observations instead of presenting them as current", function () {
  const current = new Array(16).fill("");
  current[2] = "Pathanamthitta";
  current[15] = "2026-10-19 08:00";
  const reply = buildWeatherSheetReply({
    district: "Pathanamthitta",
    preferredLanguage: "English",
    currentRows: [current],
    forecastRows: [],
    now: new Date("2026-10-20T05:00:00Z")
  });
  assert.match(reply, /unavailable/i);
  assert.match(reply, /stale/i);
});

test("soil integration prefers a nearby saved profile and retains laboratory warning", async function () {
  const soil = createSoilModule({
    sheets: { soilLocationProfile: "Soil_Location_Profile" },
    async readSheetRows() {
      return [
        ["Profile_ID", "Latitude", "Longitude", "District", "Block", "Panchayath", "Village", "Soil_Type", "pH", "OC", "N", "P", "K", "Remarks"],
        ["SOIL-1", "9.3000", "76.7000", "Pathanamthitta", "Ranni", "Ranni", "Test Village", "Loam", "6.2", "Medium", "Medium", "Low", "High", "Saved field profile"]
      ];
    }
  });
  const result = await soil({ latitude: 9.3001, longitude: 76.7001 });
  assert.equal(result.success, true);
  assert.equal(result.source, "BhoomiMitra Soil Database");
  assert.match(result.reply, /laboratory soil test/i);
  assert.match(result.reply, /Loam/);
});

test("soil lookup maps the audited Soil_Location_Profile headers instead of obsolete positions", async function () {
  const headers = [
    "Soil_Profile_ID", "Date_Time", "Farmer_ID", "Field_ID", "WhatsApp_No",
    "Latitude", "Longitude", "District", "Block", "Panchayat", "Village",
    "Survey_Number", "Elevation_m", "Slope_Percent", "Slope_Class", "Land_Use",
    "Soil_Texture", "Predicted_pH", "pH_Class", "Organic_Carbon_g_kg",
    "Total_Nitrogen_g_kg", "Clay_Percent", "Sand_Percent", "Silt_Percent",
    "CEC_cmol_kg", "Bulk_Density", "Coarse_Fragments", "Drainage_Class",
    "Erosion_Risk", "Data_Source", "Source_Version", "Source_Date",
    "Confidence_Level", "Advisory_Status", "Created_On", "Last_Updated", "Remarks"
  ];
  const row = new Array(headers.length).fill("");
  row[0] = "SOIL-PROD-1";
  row[1] = "2026-10-20T00:00:00.000Z";
  row[2] = "BM-200";
  row[5] = "9.3000";
  row[6] = "76.7000";
  row[7] = "Pathanamthitta";
  row[8] = "Ranni";
  row[9] = "Ranni";
  row[10] = "Test Village";
  row[16] = "Clay loam";
  row[17] = "6.4";
  row[19] = "12.5";
  row[20] = "1.1";
  row[36] = "Audited profile";
  let requestedRange = "";

  const soil = createSoilModule({
    async readSheetRows(_sheetName, range) {
      requestedRange = range;
      return [headers, row];
    }
  });
  const profile = await soil.findLocationProfile(9.3001, 76.7001);

  assert.equal(requestedRange, "A:AK");
  assert.equal(profile.profileId, "SOIL-PROD-1");
  assert.equal(profile.latitude, "9.3000");
  assert.equal(profile.longitude, "76.7000");
  assert.equal(profile.soilType, "Clay loam");
  assert.equal(profile.ph, "6.4");
  assert.equal(profile.organicCarbon, "12.5");
  assert.equal(profile.nitrogen, "1.1");
  assert.equal(profile.phosphorus, "");
  assert.equal(profile.potassium, "");
  assert.equal(profile.remarks, "Audited profile");
});

test("verified skilled-worker search excludes inactive records and avoids public fallback", async function () {
  const headers = [
    "Worker_ID", "Name", "Mobile", "WhatsApp", "District", "Panchayath",
    "Skill Category", "Status", "Verification_Status", "Active_Status"
  ];
  const active = [
    "BM-SW-1", "Active Worker", "9876543210", "9876543210",
    "Pathanamthitta", "Ranni", "Coconut climber", "Verified", "Verified", "Active"
  ];
  const inactive = [
    "BM-SW-2", "Inactive Worker", "9876543211", "9876543211",
    "Pathanamthitta", "Ranni", "Coconut climber", "Verified", "Verified", "Inactive"
  ];
  const finder = createServiceFinder({
    async readSheetRows(sheetName) {
      return sheetName === "Skilled Workers"
        ? [headers, active, inactive]
        : [headers];
    }
  });
  const results = await finder.searchServices({
    category: "skilled worker",
    service: "coconut climber",
    district: "Pathanamthitta",
    localBody: "Ranni"
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].name, "Active Worker");
  assert.equal(results[0].directoryType, "Skilled Worker");
});

test("skilled-worker search accepts audited district misspelling aliases", async function () {
  for (const districtHeader of ["Distrct", "Working Distrct"]) {
    const headers = [
      "Worker_ID", "Name", "Mobile", "WhatsApp", districtHeader, "Panchayath",
      "Skill Category", "Status", "Verification_Status", "Active_Status"
    ];
    const worker = [
      "BM-SW-ALIAS", "Alias Worker", "9876543210", "9876543210",
      "Pathanamthitta", "Ranni", "Coconut climber", "Verified", "Verified", "Active"
    ];
    const finder = createServiceFinder({
      async readSheetRows(sheetName) {
        return sheetName === "Skilled Workers" ? [headers, worker] : [headers];
      }
    });
    const results = await finder.searchServices({
      category: "skilled worker",
      service: "coconut climber",
      district: "Pathanamthitta",
      localBody: "Ranni"
    });

    assert.equal(results.length, 1, districtHeader);
    assert.equal(results[0].district, "Pathanamthitta", districtHeader);
  }
});
