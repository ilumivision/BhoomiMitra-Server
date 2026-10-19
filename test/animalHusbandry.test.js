"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createBhoomiMitraUI } = require("../utils/bhoomiMitraUI");
const {
  getFarmerAnimals,
  registerAnimal
} = require("../utils/animalRegistration");
const {
  ANIMAL_ACTION_IDS,
  REQUIRED_HEADERS,
  formatAnimalRecords,
  formatDiseaseAlerts,
  formatOwnedAnimals,
  getOwnedAnimals,
  getAnimalRecords,
  getVerifiedDiseaseAlerts,
  isAnimalNaturalLanguageQuery,
  makeHeaderMap,
  parseAnimalAction,
  saveBreedingProductionRecord,
  saveHealthRecord,
  verifyAnimalOwnership
} = require("../utils/animalHusbandry");

const REGISTRY_HEADERS = REQUIRED_HEADERS.Animal_Registry;
const HEALTH_HEADERS = REQUIRED_HEADERS.Animal_Health_Diary;
const PRODUCTION_HEADERS = REQUIRED_HEADERS.Animal_Breeding_Production;
const ALERT_HEADERS = REQUIRED_HEADERS.Animal_Disease_Alerts;

function row(headers, values) {
  return headers.map(function (header) {
    return values[header] || "";
  });
}

function registryRows() {
  return [
    REGISTRY_HEADERS,
    row(REGISTRY_HEADERS, {
      Animal_ID: "BM-A-000001",
      Farmer_ID: "BM-F-100",
      WhatsApp_No: "9999999999",
      Animal_Type: "Dairy cow",
      Breed: "Jersey cross",
      Sex: "Female",
      Age: "4 years",
      Tag_Number: "TAG-1",
      Active_Status: "Active"
    }),
    row(REGISTRY_HEADERS, {
      Animal_ID: "BM-A-000002",
      Farmer_ID: "BM-F-200",
      WhatsApp_No: "9999999999",
      Animal_Type: "Goat",
      Active_Status: "Active"
    }),
    row(REGISTRY_HEADERS, {
      Animal_ID: "BM-A-000003",
      Farmer_ID: "",
      WhatsApp_No: "9999999999",
      Animal_Type: "Chicken",
      Active_Status: "Active"
    })
  ];
}

function reader(extra) {
  const tables = Object.assign({
    Animal_Registry: registryRows(),
    Animal_Health_Diary: [HEALTH_HEADERS],
    Animal_Breeding_Production: [PRODUCTION_HEADERS],
    Animal_Disease_Alerts: [ALERT_HEADERS]
  }, extra || {});
  return async function (sheetName) {
    return tables[sheetName] || [];
  };
}

test("all Animal Husbandry menu IDs parse to connected actions", function () {
  Object.keys(ANIMAL_ACTION_IDS).forEach(function (key) {
    assert.deepEqual(parseAnimalAction(ANIMAL_ACTION_IDS[key]), {
      action: key,
      id: ANIMAL_ACTION_IDS[key]
    });
  });
  assert.equal(parseAnimalAction("ANIMAL_NOT_REAL"), null);
});

test("English and Malayalam main menus expose Animal Husbandry", async function () {
  const payloads = [];
  const ui = createBhoomiMitraUI({
    axios: { post: async function (_url, payload) { payloads.push(payload); } },
    phoneNumberId: "123",
    whatsappToken: "token"
  });
  await ui.sendMainMenu("919999999999", "English");
  await ui.sendMainMenu("919999999999", "Malayalam");
  payloads.forEach(function (payload) {
    const ids = payload.interactive.action.sections[0].rows.map(function (item) { return item.id; });
    assert.ok(ids.includes(ANIMAL_ACTION_IDS.OPEN));
  });
});

test("Animal Husbandry menu is bilingual click-first and has no dead IDs", async function () {
  const payloads = [];
  const ui = createBhoomiMitraUI({
    axios: { post: async function (_url, payload) { payloads.push(payload); } },
    phoneNumberId: "123",
    whatsappToken: "token"
  });
  await ui.sendAnimalHusbandryMenu("919999999999", "English");
  await ui.sendAnimalHusbandryMenu("919999999999", "Malayalam");
  const englishRows = payloads[0].interactive.action.sections[0].rows;
  const malayalamRows = payloads[1].interactive.action.sections[0].rows;
  assert.equal(englishRows.length, 10);
  assert.deepEqual(englishRows.map(function (item) { return item.id; }), malayalamRows.map(function (item) { return item.id; }));
  assert.equal(new Set(englishRows.map(function (item) { return item.id; })).size, 10);
  englishRows.forEach(function (item) { assert.ok(parseAnimalAction(item.id)); });
  englishRows.concat(malayalamRows).forEach(function (item) {
    assert.ok(Array.from(item.title).length <= 24, item.title);
    assert.ok(Array.from(item.description).length <= 72, item.description);
  });
  assert.match(malayalamRows[0].title, /[\u0D00-\u0D7F]/);
});

test("owned animal lookup is fail-closed on Farmer_ID and never trusts phone alone", async function () {
  const result = await getOwnedAnimals({
    readSheetRows: reader(),
    farmerId: "BM-F-100",
    phone: "9999999999"
  });
  assert.equal(result.success, true);
  assert.deepEqual(result.animals.map(function (animal) { return animal.animalId; }), ["BM-A-000001"]);
  const missing = await getOwnedAnimals({ readSheetRows: reader(), phone: "9999999999" });
  assert.equal(missing.code, "FARMER_ID_REQUIRED");
});

test("Animal_ID ownership accepts only the associated farmer", async function () {
  const owned = await verifyAnimalOwnership({
    readSheetRows: reader(), farmerId: "BM-F-100", animalId: "bm-a-000001"
  });
  const denied = await verifyAnimalOwnership({
    readSheetRows: reader(), farmerId: "BM-F-100", animalId: "BM-A-000002"
  });
  assert.equal(owned.success, true);
  assert.equal(denied.code, "ANIMAL_NOT_OWNED");
});

test("health diary writes by header and preserves Animal_ID Farmer_ID association", async function () {
  const appended = [];
  const result = await saveHealthRecord({
    readSheetRows: reader(),
    appendRow: async function (sheetName, values) { appended.push({ sheetName, values }); return true; },
    farmerId: "BM-F-100",
    animalId: "BM-A-000001",
    phone: "+91 99999 99999",
    recordDate: "2026-10-19",
    observation: "Reduced appetite",
    notes: "Called veterinarian",
    sourceMessageId: "wamid-1",
    now: new Date("2026-10-19T10:00:00Z")
  });
  assert.equal(result.success, true);
  assert.equal(appended[0].sheetName, "Animal_Health_Diary");
  const map = makeHeaderMap(HEALTH_HEADERS);
  assert.equal(appended[0].values[map.animal_id], "BM-A-000001");
  assert.equal(appended[0].values[map.farmer_id], "BM-F-100");
  assert.equal(appended[0].values[map.observation_or_product], "Reduced appetite");
});

test("vaccination and deworming use the health diary without activating reminders", async function () {
  const appended = [];
  const result = await saveHealthRecord({
    readSheetRows: reader(),
    appendRow: async function (_sheetName, values) { appended.push(values); return true; },
    farmerId: "BM-F-100",
    animalId: "BM-A-000001",
    recordType: "Vaccination",
    recordDate: "2026-10-19",
    product: "FMD vaccine",
    doseOrResult: "Given by veterinarian",
    nextDueDate: "2027-04-19",
    veterinarian: "Government veterinary surgeon"
  });
  assert.equal(result.success, true);
  const map = makeHeaderMap(HEALTH_HEADERS);
  assert.equal(appended[0][map.record_type], "Vaccination");
  assert.equal(appended[0][map.next_due_date], "2027-04-19");
  assert.equal(Object.prototype.hasOwnProperty.call(map, "reminder_status"), false);
});

test("cross-farmer health diary write is rejected before append", async function () {
  let appendCount = 0;
  const result = await saveHealthRecord({
    readSheetRows: reader(),
    appendRow: async function () { appendCount += 1; return true; },
    farmerId: "BM-F-100",
    animalId: "BM-A-000002",
    observation: "Should not save"
  });
  assert.equal(result.code, "ANIMAL_NOT_OWNED");
  assert.equal(appendCount, 0);
});

test("breeding and production record writes to its dedicated header-mapped sheet", async function () {
  const appended = [];
  const result = await saveBreedingProductionRecord({
    readSheetRows: reader(),
    appendRow: async function (sheetName, values) { appended.push({ sheetName, values }); return true; },
    farmerId: "BM-F-100",
    animalId: "BM-A-000001",
    recordType: "Milk",
    recordDate: "2026-10-19",
    quantityOrResult: "12",
    unit: "litres",
    details: "Morning yield",
    sourceMessageId: "wamid-2"
  });
  assert.equal(result.success, true);
  assert.equal(appended[0].sheetName, "Animal_Breeding_Production");
  const map = makeHeaderMap(PRODUCTION_HEADERS);
  assert.equal(appended[0].values[map.animal_id], "BM-A-000001");
  assert.equal(appended[0].values[map.quantity_or_result], "12");
});

test("animal record history combines only the farmer's owned health and production rows", async function () {
  const healthRows = [
    HEALTH_HEADERS,
    row(HEALTH_HEADERS, {
      Record_ID: "H1", Animal_ID: "BM-A-000001", Farmer_ID: "BM-F-100",
      Record_Date: "2026-10-18", Record_Type: "Vaccination", Observation_or_Product: "FMD vaccine"
    }),
    row(HEALTH_HEADERS, {
      Record_ID: "H2", Animal_ID: "BM-A-000002", Farmer_ID: "BM-F-200",
      Record_Date: "2026-10-19", Record_Type: "Private"
    })
  ];
  const productionRows = [
    PRODUCTION_HEADERS,
    row(PRODUCTION_HEADERS, {
      Record_ID: "P1", Animal_ID: "BM-A-000001", Farmer_ID: "BM-F-100",
      Record_Date: "2026-10-19", Record_Type: "Milk", Quantity_or_Result: "12", Unit: "litres"
    })
  ];
  const result = await getAnimalRecords({
    readSheetRows: reader({
      Animal_Health_Diary: healthRows,
      Animal_Breeding_Production: productionRows
    }),
    farmerId: "BM-F-100"
  });
  assert.equal(result.success, true);
  assert.deepEqual(result.records.map(function (record) { return record.recordId; }), ["P1", "H1"]);
  assert.doesNotMatch(formatAnimalRecords(result.records, "English"), /Private/);
  assert.match(formatAnimalRecords(result.records, "Malayalam"), /മൃഗ ആരോഗ്യവും/);
});

test("record writes fail safely when required Sheet headers do not exist", async function () {
  let appended = false;
  const result = await saveHealthRecord({
    readSheetRows: reader({ Animal_Health_Diary: [["Record_ID", "Animal_ID"]] }),
    appendRow: async function () { appended = true; return true; },
    farmerId: "BM-F-100",
    animalId: "BM-A-000001",
    observation: "Test"
  });
  assert.equal(result.code, "HEADERS_MISSING");
  assert.ok(result.missingHeaders.includes("Farmer_ID"));
  assert.equal(appended, false);
});

test("disease alerts include only verified active current district-relevant records", async function () {
  const alertRows = [
    ALERT_HEADERS,
    row(ALERT_HEADERS, {
      Alert_ID: "A1", Disease_Name: "FMD", District: "Pathanamthitta",
      Alert_Text_English: "Official precautions", Alert_Text_Malayalam: "ഔദ്യോഗിക മുൻകരുതൽ",
      Source_Authority: "Kerala Animal Husbandry Department", Source_URL: "https://example.gov.in/a1",
      Verification_Status: "Verified", Active_Status: "Active", Valid_From: "2026-10-01", Valid_Until: "2026-10-31"
    }),
    row(ALERT_HEADERS, {
      Alert_ID: "A2", Disease_Name: "Rumour", District: "Pathanamthitta",
      Verification_Status: "Pending", Active_Status: "Active"
    }),
    row(ALERT_HEADERS, {
      Alert_ID: "A3", Disease_Name: "Expired", District: "Pathanamthitta",
      Verification_Status: "Verified", Active_Status: "Active", Valid_Until: "2026-09-30"
    }),
    row(ALERT_HEADERS, {
      Alert_ID: "A4", Disease_Name: "Other district", District: "Kollam",
      Verification_Status: "Verified", Active_Status: "Active"
    })
  ];
  const result = await getVerifiedDiseaseAlerts({
    readSheetRows: reader({ Animal_Disease_Alerts: alertRows }),
    district: "Pathanamthitta",
    now: new Date("2026-10-19T00:00:00Z")
  });
  assert.deepEqual(result.alerts.map(function (alert) { return alert.alertId; }), ["A1"]);
  assert.match(formatDiseaseAlerts(result.alerts, "English"), /Kerala Animal Husbandry Department/);
  assert.match(formatDiseaseAlerts(result.alerts, "Malayalam"), /ഔദ്യോഗിക മുൻകരുതൽ/);
});

test("direct natural-language animal questions work in English and Malayalam without stealing market queries", function () {
  assert.equal(isAnimalNaturalLanguageQuery("My cow has stopped eating since yesterday, what should I do?"), true);
  assert.equal(isAnimalNaturalLanguageQuery("എന്റെ പശു തീറ്റ കഴിക്കുന്നില്ല, എന്തു ചെയ്യണം?"), true);
  assert.equal(isAnimalNaturalLanguageQuery("What is today's milk market price?"), false);
  assert.equal(isAnimalNaturalLanguageQuery("weather in Kollam"), false);
});

test("animal summaries are localized and retain stable Animal IDs", function () {
  const animals = [{ animalId: "BM-A-000001", animalType: "Cow", breed: "Jersey", tagNumber: "TAG-1" }];
  assert.match(formatOwnedAnimals(animals, "English"), /BM-A-000001/);
  assert.match(formatOwnedAnimals(animals, "Malayalam"), /എന്റെ മൃഗങ്ങൾ/);
});

test("registration requires Farmer_ID before reading or writing Animal_Registry", async function () {
  let calls = 0;
  const result = await registerAnimal({
    sheets: { spreadsheets: { values: {
      get: async function () { calls += 1; return { data: { values: [] } }; },
      append: async function () { calls += 1; }
    } } },
    spreadsheetId: "sheet",
    phone: "9999999999",
    animal: { animalType: "Cow" }
  });
  assert.equal(result.code, "FARMER_ID_REQUIRED");
  assert.equal(calls, 0);
});

test("registration stores both Animal_ID and verified Farmer_ID", async function () {
  let savedRow;
  const result = await registerAnimal({
    sheets: { spreadsheets: { values: {
      get: async function () { return { data: { values: [REGISTRY_HEADERS] } }; },
      append: async function (request) { savedRow = request.requestBody.values[0]; }
    } } },
    spreadsheetId: "sheet",
    phone: "+91 99999 99999",
    animal: { farmerId: "BM-F-100", animalType: "Cow", breed: "Jersey", tagNumber: "TAG-9" }
  });
  const map = makeHeaderMap(REGISTRY_HEADERS);
  assert.equal(result.success, true);
  assert.equal(savedRow[map.animal_id], "BM-A-000001");
  assert.equal(savedRow[map.farmer_id], "BM-F-100");
});

test("registration refuses duplicate active tag numbers for the same farmer", async function () {
  let appendCount = 0;
  const result = await registerAnimal({
    sheets: { spreadsheets: { values: {
      get: async function () { return { data: { values: registryRows() } }; },
      append: async function () { appendCount += 1; }
    } } },
    spreadsheetId: "sheet",
    phone: "9999999999",
    animal: { farmerId: "BM-F-100", animalType: "Cow", tagNumber: "tag-1" }
  });
  assert.equal(result.code, "DUPLICATE_TAG");
  assert.equal(appendCount, 0);
});

test("legacy My Animals retrieval also enforces Farmer_ID when supplied", async function () {
  const result = await getFarmerAnimals({
    sheets: { spreadsheets: { values: {
      get: async function () { return { data: { values: registryRows() } }; }
    } } },
    spreadsheetId: "sheet",
    phone: "9999999999",
    farmerId: "BM-F-100"
  });
  assert.equal(result.success, true);
  assert.deepEqual(result.animals.map(function (animal) { return animal.animalId; }), ["BM-A-000001"]);
});
