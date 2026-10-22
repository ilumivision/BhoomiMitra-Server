"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createBhoomiMitraUI } = require("../utils/bhoomiMitraUI");

const {
  FERTILIZERS,
  SOIL_FERTILIZER_ACTION_IDS,
  SOURCE_TYPES,
  buildRecommendations,
  coconutRecommendation,
  fertilizerMass,
  normalizeExtractedSoilReport,
  parseSoilFertilizerAction,
  parseTypedSoilValues,
  rambutanRecommendation,
  readFarmerSoilRecords,
  soilObservationFromMap,
  validateSoilObservation
} = require("../utils/soilFertilizerAdvisory");

const LAB_SOIL = {
  farmerId: "BM-F-1",
  landId: "BM-L-1",
  sourceType: SOURCE_TYPES.LAB_REPORT,
  sourceName: "KAU Soil Testing Laboratory",
  observedAt: "2026-10-01",
  parameters: {
    ph: { value: 5.4, method: "1:2.5 soil-water" },
    nitrogen: { value: 210, unit: "kg/ha", method: "Alkaline KMnO4", interpretation: "Low" },
    phosphorus: { value: 18, unit: "kg/ha", method: "Bray-1", interpretation: "Medium" },
    potassium: { value: 145, unit: "kg/ha", method: "Neutral ammonium acetate", interpretation: "Medium" }
  }
};

function coconut(overrides) {
  return Object.assign({
    crop: "Coconut",
    landId: "BM-L-1",
    plantCount: 10,
    ageYears: 8,
    stage: "Bearing",
    managementLevel: "average",
    waterRegime: "rainfed"
  }, overrides || {});
}

test("coconut-only recommendation uses the explicit KAU adult average-management rule", function () {
  const result = buildRecommendations({
    consent: true,
    preference: "recommend",
    soilObservation: LAB_SOIL,
    crops: [coconut()]
  });
  const item = result.recommendations[0];
  assert.equal(result.status, "PARTIALLY_READY");
  assert.equal(item.status, "READY_WITH_LIMITATIONS");
  assert.deepEqual(item.nutrientRequirementGramsPerPalmYear, { n: 340, p2o5: 170, k2o: 680 });
  assert.equal(item.fertilizers[0].gramsPerPalm, 739.1);
  assert.equal(item.fertilizers[0].totalKg, 7.39);
  assert.equal(item.fertilizers[1].gramsPerPalm, 598.6);
  assert.equal(item.fertilizers[2].gramsPerPalm, 1133.3);
});

test("rambutan-only request fails safely without borrowing coconut doses", function () {
  const result = buildRecommendations({
    consent: true,
    preference: "recommend",
    soilObservation: LAB_SOIL,
    crops: [{ crop: "Rambutan", landId: "BM-L-1", plantCount: 6, ageYears: 5, stage: "Bearing" }]
  });
  assert.equal(result.status, "NO_VERIFIED_DOSE");
  assert.equal(result.recommendations[0].status, "UNSUPPORTED_RULE");
  assert.equal(result.recommendations[0].recommendation, null);
  assert.match(result.recommendations[0].reason, /must not be substituted/i);
});

test("coconut and rambutan remain separate recommendations", function () {
  const result = buildRecommendations({
    consent: true,
    preference: "recommend",
    soilObservation: LAB_SOIL,
    crops: [coconut(), { crop: "Rambutan", landId: "BM-L-1", plantCount: 4, ageYears: 7, stage: "Bearing" }]
  });
  assert.equal(result.recommendations.length, 2);
  assert.deepEqual(result.recommendations.map(function (item) { return item.crop; }), ["Coconut", "Rambutan"]);
  assert.ok(result.recommendations[0].fertilizers);
  assert.equal(result.recommendations[1].fertilizers, undefined);
});

test("not-needed consent produces no dose and never permits reminders", function () {
  const result = buildRecommendations({ consent: false, crops: [coconut()], soilObservation: LAB_SOIL });
  assert.deepEqual(result, { status: "DECLINED", recommendations: [], remindersAllowed: false });
});

test("uploaded lab extraction preserves source, date, units and methods and requires confirmation", function () {
  const extracted = normalizeExtractedSoilReport({
    laboratory: "District Soil Testing Laboratory",
    testDate: "2026-09-20",
    reportReference: "LAB-12",
    parameters: {
      pH: { value: 5.8, method: "1:2.5 water" },
      availableNitrogen: { value: 220, unit: "kg/ha", method: "Alkaline KMnO4" }
    }
  }, { farmerId: "BM-F-1", landId: "BM-L-1" });
  assert.equal(extracted.success, true);
  assert.equal(extracted.code, "EXTRACTED_CONFIRMATION_REQUIRED");
  assert.equal(extracted.observation.sourceType, SOURCE_TYPES.LAB_REPORT);
  assert.equal(extracted.observation.parameters.nitrogen.unit, "kg/ha");
  assert.ok(extracted.warnings.includes("FARMER_CONFIRMATION_REQUIRED"));
});

test("existing soil reader enforces farmer and land ownership", function () {
  const headers = ["Soil_Test_ID", "Farmer_ID", "Land_ID", "Test_Date", "Source_Name", "pH", "pH_Method", "N", "N_Unit", "N_Method"];
  const rows = [
    headers,
    ["S-1", "BM-F-1", "BM-L-1", "2026-09-01", "KAU Lab", "5.5", "water", "200", "kg/ha", "KMnO4"],
    ["S-2", "BM-F-2", "BM-L-2", "2026-09-01", "Other Lab", "7", "water", "500", "kg/ha", "KMnO4"],
    ["S-3", "BM-F-1", "BM-L-X", "2026-09-01", "Other land", "6", "water", "300", "kg/ha", "KMnO4"]
  ];
  const records = readFarmerSoilRecords(rows, "BM-F-1", ["BM-L-1"]);
  assert.equal(records.length, 1);
  assert.equal(records[0].recordId, "S-1");
  assert.equal(records[0].farmerId, "BM-F-1");
});

test("existing soil reader fails closed when ownership headers are absent", function () {
  assert.deepEqual(readFarmerSoilRecords([["Test_Date", "pH"], ["2026-01-01", "6"]], "BM-F-1", ["BM-L-1"]), []);
});

test("map soil is explicitly uncertain and cannot enable reminders", function () {
  const observation = soilObservationFromMap({
    source: "SoilGrids", profileId: "MAP-1", ph: 5.2, organicCarbon: 12, nitrogen: 1.2
  }, { farmerId: "BM-F-1", landId: "BM-L-1", observedAt: "2026-10-20" });
  const validation = validateSoilObservation(observation);
  const result = buildRecommendations({ consent: true, preference: "recommend", soilObservation: observation, crops: [coconut()] });
  assert.ok(validation.warnings.includes("MAP_ESTIMATE_NOT_LAB_TEST"));
  assert.equal(observation.dateMeaning, "retrieval_date_not_measurement_date");
  assert.equal(result.recommendations[0].status, "GENERAL_GUIDANCE_MAP_UNCERTAIN");
  assert.equal(result.remindersAllowed, false);
});

test("missing soil parameters and missing nutrient units fail validation", function () {
  assert.ok(validateSoilObservation({ sourceType: SOURCE_TYPES.LAB_REPORT, sourceName: "Lab", observedAt: "2026-01-01", parameters: {} }).errors.includes("SOIL_PARAMETERS_REQUIRED"));
  const validation = validateSoilObservation({
    sourceType: SOURCE_TYPES.LAB_REPORT,
    sourceName: "Lab",
    observedAt: "2026-01-01",
    parameters: { nitrogen: { value: 10, method: "method" } }
  });
  assert.ok(validation.errors.includes("UNIT_REQUIRED:nitrogen"));
});

test("non-bearing or juvenile coconut never receives the adult dose", function () {
  const juvenile = coconutRecommendation(coconut({ ageYears: 3, stage: "Juvenile" }), LAB_SOIL);
  const stageConflict = coconutRecommendation(coconut({ ageYears: 9, stage: "Non-bearing" }), LAB_SOIL);
  assert.equal(juvenile.status, "UNSUPPORTED_STAGE");
  assert.equal(stageConflict.status, "UNSUPPORTED_STAGE");
  assert.equal(juvenile.recommendation, null);
});

test("bearing stage controls the adult rule without inventing a numeric age threshold", function () {
  const result = coconutRecommendation(coconut({ ageYears: 4, stage: "Bearing" }), LAB_SOIL);
  assert.equal(result.status, "READY_WITH_LIMITATIONS");
});

test("fertilizer nutrient composition calculations are deterministic and reject bad grades", function () {
  assert.equal(fertilizerMass(460, FERTILIZERS.UREA), 1000);
  assert.equal(fertilizerMass(160, FERTILIZERS.SSP), 1000);
  assert.equal(fertilizerMass(284, FERTILIZERS.ROCK_PHOSPHATE), 1000);
  assert.equal(fertilizerMass(600, FERTILIZERS.MOP), 1000);
  assert.equal(fertilizerMass(100, { fraction: 0 }), null);
  assert.equal(fertilizerMass(-1, FERTILIZERS.UREA), null);
});

test("missing management or irrigation rule returns missing fields instead of assumptions", function () {
  const result = coconutRecommendation(coconut({ managementLevel: "", waterRegime: "" }), LAB_SOIL);
  assert.equal(result.status, "INCOMPLETE");
  assert.ok(result.missing.some(function (item) { return item.startsWith("managementLevel"); }));
  assert.ok(result.missing.some(function (item) { return item.startsWith("waterRegime"); }));
});

test("farmer-specified products require review and do not calculate doses", function () {
  const result = buildRecommendations({ consent: true, preference: "specify", crops: [coconut()], soilObservation: LAB_SOIL });
  assert.equal(result.status, "FARMER_SPECIFICATION_REQUIRES_EXPERT_REVIEW");
  assert.equal(result.remindersAllowed, false);
  assert.deepEqual(result.recommendations, []);
});

test("typed report requires explicit units and accepts bracketed laboratory methods", function () {
  const valid = parseTypedSoilValues(
    "pH 5.6 [1:2.5 water] | N 210 kg/ha [Alkaline KMnO4] | P 15 kg/ha [Bray-1] | K 140 kg/ha [NH4OAc]",
    { farmerId: "BM-F-1", landId: "BM-L-1", sourceName: "Farmer report LAB-9", observedAt: "2026-10-01" }
  );
  const invalid = parseTypedSoilValues(
    "N 210 [Alkaline KMnO4]",
    { sourceName: "Lab", observedAt: "2026-10-01" }
  );
  assert.equal(valid.success, true);
  assert.equal(valid.observation.parameters.ph.unit, "");
  assert.equal(valid.observation.parameters.ph.method, "1:2.5 water");
  assert.equal(valid.observation.parameters.nitrogen.unit, "kg/ha");
  assert.equal(invalid.success, false);
  assert.ok(invalid.errors.includes("UNIT_REQUIRED:nitrogen"));
});

test("reliable prior nutrient-equivalent application is subtracted without going negative", function () {
  const result = coconutRecommendation(coconut({ previousNutrientsGramsPerPalm: { n: 100, p2o5: 500, k2o: 80 } }), LAB_SOIL);
  assert.deepEqual(result.nutrientRequirementGramsPerPalmYear, { n: 240, p2o5: 0, k2o: 600 });
  assert.equal(result.fertilizers[1].gramsPerPalm, 0);
});

test("ownership mismatch invalidates a soil observation", function () {
  const validation = validateSoilObservation(LAB_SOIL, { farmerId: "BM-F-2", landIds: ["BM-L-2"] });
  assert.ok(validation.errors.includes("FARMER_OWNERSHIP_MISMATCH"));
  assert.ok(validation.errors.includes("LAND_OWNERSHIP_MISMATCH"));
});

test("soil observations older than the government three-year card cycle are flagged", function () {
  const validation = validateSoilObservation(Object.assign({}, LAB_SOIL, { observedAt: "2020-01-01" }), {
    now: new Date("2026-10-22T00:00:00Z")
  });
  assert.equal(validation.valid, true);
  assert.ok(validation.warnings.includes("SOIL_OBSERVATION_OUTDATED"));
});

test("duplicate crop requests do not create duplicate application recommendations", function () {
  const result = buildRecommendations({
    consent: true,
    preference: "recommend",
    soilObservation: LAB_SOIL,
    crops: [coconut(), coconut()]
  });
  assert.equal(result.recommendations.length, 1);
});

test("good-management coconut uses its distinct published adult schedule", function () {
  const result = coconutRecommendation(coconut({ managementLevel: "good", plantCount: 2 }), LAB_SOIL);
  assert.deepEqual(result.nutrientRequirementGramsPerPalmYear, { n: 500, p2o5: 320, k2o: 1200 });
  assert.equal(result.fertilizers[0].totalKg, 2.17);
  assert.equal(result.fertilizers[1].totalKg, 2.25);
  assert.equal(result.fertilizers[2].totalKg, 4);
});

test("rambutan helper remains explicitly unsupported even with complete crop and soil data", function () {
  const result = rambutanRecommendation({ crop: "Rambutan", plantCount: 20, ageYears: 8, stage: "Bearing" }, LAB_SOIL);
  assert.equal(result.status, "UNSUPPORTED_RULE");
  assert.equal(result.expertRecommended, true);
  assert.equal(result.recommendation, null);
});

test("soil advisory WhatsApp workflow is click-first, bilingual and within Meta limits", async function () {
  const calls = [];
  const ui = createBhoomiMitraUI({
    axios: { post: async function (url, body) { calls.push(body); return { data: {} }; } },
    phoneNumberId: "phone-id",
    whatsappToken: "token"
  });
  await ui.sendSoilFertilizerSourceMenu("919111111111", "English");
  await ui.sendSoilFertilizerSourceMenu("919111111111", "Malayalam");
  await ui.sendSoilFertilizerConsent("919111111111", "English", "Soil summary");
  await ui.sendSoilFertilizerCropSelection("919111111111", "English", ["Coconut", "Rambutan"]);
  await ui.sendSoilFertilizerPreference("919111111111", "English");
  await ui.sendSoilFertilizerSaveOptions("919111111111", "English", true);
  const rows = calls.slice(0, 2).flatMap(function (call) { return call.interactive.action.sections[0].rows; });
  const buttons = calls.slice(2).flatMap(function (call) { return call.interactive.action.buttons || []; });
  rows.forEach(function (row) {
    assert.ok(Array.from(row.title).length <= 24);
    assert.ok(Array.from(row.description).length <= 72);
    assert.ok(parseSoilFertilizerAction(row.id));
  });
  buttons.forEach(function (button) {
    assert.ok(Array.from(button.reply.title).length <= 20);
    assert.ok(parseSoilFertilizerAction(button.reply.id));
  });
  assert.deepEqual(calls[3].interactive.action.buttons.map(function (button) { return button.reply.id; }), [
    SOIL_FERTILIZER_ACTION_IDS.CROP_COCONUT,
    SOIL_FERTILIZER_ACTION_IDS.CROP_RAMBUTAN,
    SOIL_FERTILIZER_ACTION_IDS.CROPS_DONE
  ]);
});
