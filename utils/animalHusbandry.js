"use strict";

const ANIMAL_REGISTRY_SHEET = "Animal_Registry";
const ANIMAL_HEALTH_SHEET = "Animal_Health_Diary";
const ANIMAL_PRODUCTION_SHEET = "Animal_Breeding_Production";
const ANIMAL_DISEASE_ALERT_SHEET = "Animal_Disease_Alerts";

const ANIMAL_ACTION_IDS = Object.freeze({
  OPEN: "ANIMAL_OPEN",
  REGISTER: "ANIMAL_REGISTER",
  MY_ANIMALS: "ANIMAL_MY_ANIMALS",
  HEALTH: "ANIMAL_HEALTH_DIARY",
  PREVENTIVE: "ANIMAL_PREVENTIVE",
  PRODUCTION: "ANIMAL_PRODUCTION",
  HISTORY: "ANIMAL_RECORD_HISTORY",
  ADVISORY: "ANIMAL_VET_ADVISORY",
  EXPERT: "ANIMAL_VET_EXPERT",
  ALERTS: "ANIMAL_DISEASE_ALERTS",
  MAIN_MENU: "ANIMAL_MAIN_MENU"
});

const REQUIRED_HEADERS = Object.freeze({
  Animal_Registry: [
    "Animal_ID", "Farmer_ID", "WhatsApp_No", "Animal_Type", "Breed",
    "Sex", "Date_of_Birth", "Age", "Identification_Mark", "Tag_Number",
    "Vaccination_Status", "Last_Vaccination_Date", "Health_Status",
    "Insurance_Status", "Active_Status", "Created_At", "Updated_At", "Remarks"
  ],
  Animal_Health_Diary: [
    "Record_ID", "Animal_ID", "Farmer_ID", "WhatsApp_No", "Record_Date",
    "Record_Type", "Observation_or_Product", "Dose_or_Result", "Veterinarian",
    "Next_Due_Date", "Notes", "Source_Message_ID", "Created_At"
  ],
  Animal_Breeding_Production: [
    "Record_ID", "Animal_ID", "Farmer_ID", "WhatsApp_No", "Record_Date",
    "Record_Type", "Quantity_or_Result", "Unit", "Breeding_or_Production_Details",
    "Notes", "Source_Message_ID", "Created_At"
  ],
  Animal_Disease_Alerts: [
    "Alert_ID", "Disease_Name", "Animal_Type", "District", "Alert_Text_English",
    "Alert_Text_Malayalam", "Source_Authority", "Source_URL", "Verification_Status",
    "Active_Status", "Valid_From", "Valid_Until", "Updated_At"
  ]
});

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeHeader(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function makeHeaderMap(headers) {
  const map = {};
  (headers || []).forEach(function (header, index) {
    const key = normalizeHeader(header);
    if (key && map[key] === undefined) map[key] = index;
  });
  return map;
}

function valueFromRow(row, map, aliases) {
  for (const alias of aliases || []) {
    const index = map[normalizeHeader(alias)];
    if (index !== undefined && clean(row && row[index])) {
      return clean(row[index]);
    }
  }
  return "";
}

function normalizePhone(value) {
  const digits = clean(value).replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function parseAnimalAction(selectionId) {
  const id = clean(selectionId);
  const action = Object.keys(ANIMAL_ACTION_IDS).find(function (key) {
    return ANIMAL_ACTION_IDS[key] === id;
  });
  return action ? { action: action, id: id } : null;
}

function isActive(value) {
  const status = clean(value).toLowerCase();
  return !status || status === "active" || status === "yes" || status === "true";
}

async function getOwnedAnimals(input) {
  const data = input || {};
  const farmerId = clean(data.farmerId).toUpperCase();
  if (!farmerId) {
    return { success: false, code: "FARMER_ID_REQUIRED", animals: [] };
  }

  const rows = await data.readSheetRows(ANIMAL_REGISTRY_SHEET, "A:AZ");
  if (!rows || !rows[0]) {
    return { success: false, code: "HEADERS_MISSING", animals: [] };
  }

  const map = makeHeaderMap(rows[0]);
  const animals = rows.slice(1).filter(function (row) {
    const rowFarmerId = valueFromRow(row, map, ["Farmer_ID", "Member_ID"]).toUpperCase();
    return rowFarmerId === farmerId && isActive(valueFromRow(row, map, ["Active_Status"]));
  }).map(function (row) {
    return {
      animalId: valueFromRow(row, map, ["Animal_ID"]),
      farmerId: valueFromRow(row, map, ["Farmer_ID", "Member_ID"]),
      animalType: valueFromRow(row, map, ["Animal_Type", "Species", "Livestock_Type"]),
      breed: valueFromRow(row, map, ["Breed"]),
      sex: valueFromRow(row, map, ["Sex", "Gender"]),
      age: valueFromRow(row, map, ["Age", "Date_of_Birth"]),
      tagNumber: valueFromRow(row, map, ["Tag_Number", "Tag_No"]),
      healthStatus: valueFromRow(row, map, ["Health_Status"]),
      vaccinationStatus: valueFromRow(row, map, ["Vaccination_Status"])
    };
  }).filter(function (animal) {
    return Boolean(animal.animalId);
  });

  return { success: true, animals: animals };
}

async function verifyAnimalOwnership(input) {
  const result = await getOwnedAnimals(input);
  if (!result.success) return result;
  const animalId = clean(input && input.animalId).toUpperCase();
  const animal = result.animals.find(function (item) {
    return item.animalId.toUpperCase() === animalId;
  });
  return animal
    ? { success: true, animal: animal }
    : { success: false, code: "ANIMAL_NOT_OWNED" };
}

function generateRecordId(prefix, now, sourceMessageId) {
  const date = now instanceof Date ? now : new Date(now || Date.now());
  const stamp = date.getTime();
  const suffix = clean(sourceMessageId).replace(/[^a-z0-9]/gi, "").slice(-8);
  return prefix + "-" + stamp + (suffix ? "-" + suffix : "");
}

function buildRow(headers, values) {
  const normalizedValues = {};
  Object.keys(values || {}).forEach(function (key) {
    normalizedValues[normalizeHeader(key)] = values[key];
  });
  return (headers || []).map(function (header) {
    const key = normalizeHeader(header);
    return Object.prototype.hasOwnProperty.call(normalizedValues, key)
      ? normalizedValues[key]
      : "";
  });
}

function missingHeaders(headers, required) {
  const available = new Set((headers || []).map(normalizeHeader));
  return (required || []).filter(function (header) {
    return !available.has(normalizeHeader(header));
  });
}

async function appendHeaderMappedRecord(input) {
  const data = input || {};
  const rows = await data.readSheetRows(data.sheetName, "A:AZ");
  const headers = rows && rows[0];
  if (!headers) return { success: false, code: "HEADERS_MISSING" };
  const missing = missingHeaders(headers, data.requiredHeaders);
  if (missing.length) {
    return { success: false, code: "HEADERS_MISSING", missingHeaders: missing };
  }
  const appended = await data.appendRow(data.sheetName, buildRow(headers, data.values));
  return appended
    ? { success: true }
    : { success: false, code: "APPEND_FAILED" };
}

async function saveHealthRecord(input) {
  const data = input || {};
  const ownership = await verifyAnimalOwnership(data);
  if (!ownership.success) return ownership;
  const now = data.now instanceof Date ? data.now : new Date(data.now || Date.now());
  const recordType = clean(data.recordType || "Health observation");
  const recordId = generateRecordId("BM-AH", now, data.sourceMessageId);
  const result = await appendHeaderMappedRecord({
    readSheetRows: data.readSheetRows,
    appendRow: data.appendRow,
    sheetName: ANIMAL_HEALTH_SHEET,
    requiredHeaders: REQUIRED_HEADERS.Animal_Health_Diary,
    values: {
      Record_ID: recordId,
      Animal_ID: ownership.animal.animalId,
      Farmer_ID: clean(data.farmerId),
      WhatsApp_No: normalizePhone(data.phone),
      Record_Date: clean(data.recordDate) || now.toISOString().slice(0, 10),
      Record_Type: recordType,
      Observation_or_Product: clean(data.observation || data.product),
      Dose_or_Result: clean(data.doseOrResult),
      Veterinarian: clean(data.veterinarian),
      Next_Due_Date: clean(data.nextDueDate),
      Notes: clean(data.notes),
      Source_Message_ID: clean(data.sourceMessageId),
      Created_At: now.toISOString()
    }
  });
  return Object.assign(result, { recordId: recordId, animal: ownership.animal });
}

async function saveBreedingProductionRecord(input) {
  const data = input || {};
  const ownership = await verifyAnimalOwnership(data);
  if (!ownership.success) return ownership;
  const now = data.now instanceof Date ? data.now : new Date(data.now || Date.now());
  const recordId = generateRecordId("BM-AP", now, data.sourceMessageId);
  const result = await appendHeaderMappedRecord({
    readSheetRows: data.readSheetRows,
    appendRow: data.appendRow,
    sheetName: ANIMAL_PRODUCTION_SHEET,
    requiredHeaders: REQUIRED_HEADERS.Animal_Breeding_Production,
    values: {
      Record_ID: recordId,
      Animal_ID: ownership.animal.animalId,
      Farmer_ID: clean(data.farmerId),
      WhatsApp_No: normalizePhone(data.phone),
      Record_Date: clean(data.recordDate) || now.toISOString().slice(0, 10),
      Record_Type: clean(data.recordType),
      Quantity_or_Result: clean(data.quantityOrResult),
      Unit: clean(data.unit),
      Breeding_or_Production_Details: clean(data.details),
      Notes: clean(data.notes),
      Source_Message_ID: clean(data.sourceMessageId),
      Created_At: now.toISOString()
    }
  });
  return Object.assign(result, { recordId: recordId, animal: ownership.animal });
}

function parseDate(value) {
  const text = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(text + "T00:00:00Z");
  return Number.isNaN(date.getTime()) ? null : date;
}

async function getVerifiedDiseaseAlerts(input) {
  const data = input || {};
  const rows = await data.readSheetRows(ANIMAL_DISEASE_ALERT_SHEET, "A:AZ");
  if (!rows || !rows[0]) return { success: true, alerts: [] };
  const map = makeHeaderMap(rows[0]);
  const now = data.now instanceof Date ? data.now : new Date(data.now || Date.now());
  const district = clean(data.district).toLowerCase();
  const alerts = rows.slice(1).filter(function (row) {
    const verification = valueFromRow(row, map, ["Verification_Status"]).toLowerCase();
    const active = valueFromRow(row, map, ["Active_Status"]);
    const rowDistrict = valueFromRow(row, map, ["District"]).toLowerCase();
    const validFrom = parseDate(valueFromRow(row, map, ["Valid_From"]));
    const validUntil = parseDate(valueFromRow(row, map, ["Valid_Until"]));
    return verification === "verified" && isActive(active) &&
      (!rowDistrict || rowDistrict === "all kerala" || rowDistrict === "kerala" || !district || rowDistrict === district) &&
      (!validFrom || validFrom.getTime() <= now.getTime()) &&
      (!validUntil || validUntil.getTime() + 86400000 > now.getTime());
  }).map(function (row) {
    return {
      alertId: valueFromRow(row, map, ["Alert_ID"]),
      diseaseName: valueFromRow(row, map, ["Disease_Name"]),
      animalType: valueFromRow(row, map, ["Animal_Type"]),
      district: valueFromRow(row, map, ["District"]),
      english: valueFromRow(row, map, ["Alert_Text_English"]),
      malayalam: valueFromRow(row, map, ["Alert_Text_Malayalam"]),
      sourceAuthority: valueFromRow(row, map, ["Source_Authority"]),
      sourceUrl: valueFromRow(row, map, ["Source_URL"]),
      validUntil: valueFromRow(row, map, ["Valid_Until"])
    };
  });
  return { success: true, alerts: alerts };
}

async function getAnimalRecords(input) {
  const data = input || {};
  const farmerId = clean(data.farmerId).toUpperCase();
  if (!farmerId) return { success: false, code: "FARMER_ID_REQUIRED", records: [] };
  const owned = await getOwnedAnimals(data);
  if (!owned.success) return Object.assign({}, owned, { records: [] });
  const ownedIds = new Set(owned.animals.map(function (animal) {
    return animal.animalId.toUpperCase();
  }));
  const requestedAnimalId = clean(data.animalId).toUpperCase();
  if (requestedAnimalId && !ownedIds.has(requestedAnimalId)) {
    return { success: false, code: "ANIMAL_NOT_OWNED", records: [] };
  }

  const sources = [
    { sheetName: ANIMAL_HEALTH_SHEET, category: "Health" },
    { sheetName: ANIMAL_PRODUCTION_SHEET, category: "Breeding / Production" }
  ];
  const records = [];
  for (const source of sources) {
    const rows = await data.readSheetRows(source.sheetName, "A:AZ");
    if (!rows || !rows[0]) continue;
    const map = makeHeaderMap(rows[0]);
    rows.slice(1).forEach(function (row) {
      const rowFarmerId = valueFromRow(row, map, ["Farmer_ID"]).toUpperCase();
      const animalId = valueFromRow(row, map, ["Animal_ID"]);
      if (rowFarmerId !== farmerId || !ownedIds.has(animalId.toUpperCase())) return;
      if (requestedAnimalId && animalId.toUpperCase() !== requestedAnimalId) return;
      records.push({
        recordId: valueFromRow(row, map, ["Record_ID"]),
        animalId: animalId,
        farmerId: rowFarmerId,
        date: valueFromRow(row, map, ["Record_Date", "Created_At"]),
        type: valueFromRow(row, map, ["Record_Type"]),
        detail: valueFromRow(row, map, [
          "Observation_or_Product", "Breeding_or_Production_Details"
        ]),
        result: valueFromRow(row, map, ["Dose_or_Result", "Quantity_or_Result"]),
        unit: valueFromRow(row, map, ["Unit"]),
        notes: valueFromRow(row, map, ["Notes"]),
        category: source.category
      });
    });
  }
  records.sort(function (left, right) {
    return clean(right.date).localeCompare(clean(left.date)) ||
      clean(right.recordId).localeCompare(clean(left.recordId));
  });
  return { success: true, records: records };
}

function formatOwnedAnimals(animals, language) {
  const ml = clean(language).toLowerCase() === "malayalam";
  if (!animals || !animals.length) {
    return ml
      ? "രജിസ്റ്റർ ചെയ്ത മൃഗങ്ങളെ കണ്ടെത്താനായില്ല. മൃഗസംരക്ഷണ മെനുവിൽ നിന്ന് പുതിയ മൃഗത്തെ രജിസ്റ്റർ ചെയ്യാം."
      : "No registered animals were found. You can register one from the Animal Husbandry menu.";
  }
  const lines = [ml ? "🐄 എന്റെ മൃഗങ്ങൾ" : "🐄 My Animals", ""];
  animals.forEach(function (animal, index) {
    lines.push((index + 1) + ". " + animal.animalId + " — " + (animal.animalType || "Animal"));
    lines.push((ml ? "ഇനം: " : "Breed: ") + (animal.breed || "—") + " | " +
      (ml ? "ടാഗ്: " : "Tag: ") + (animal.tagNumber || "—"));
  });
  return lines.join("\n");
}

function formatDiseaseAlerts(alerts, language) {
  const ml = clean(language).toLowerCase() === "malayalam";
  if (!alerts || !alerts.length) {
    return ml
      ? "നിങ്ങളുടെ ജില്ലയ്ക്കായി ഇപ്പോൾ സാധുവായ സ്ഥിരീകരിച്ച മൃഗരോഗ അലർട്ടുകൾ ലഭ്യമല്ല."
      : "No currently valid verified animal-disease alerts are available for your district.";
  }
  const lines = [ml ? "⚠️ സ്ഥിരീകരിച്ച മൃഗരോഗ അലർട്ടുകൾ" : "⚠️ Verified Animal Disease Alerts", ""];
  alerts.slice(0, 5).forEach(function (alert) {
    lines.push("• " + (alert.diseaseName || (ml ? "മൃഗരോഗ അലർട്ട്" : "Animal disease alert")));
    lines.push((ml ? alert.malayalam || alert.english : alert.english || alert.malayalam) || "");
    lines.push((ml ? "ഉറവിടം: " : "Source: ") + (alert.sourceAuthority || "Verified authority"));
    if (alert.sourceUrl) lines.push(alert.sourceUrl);
    lines.push("");
  });
  return lines.join("\n").trim();
}

function formatAnimalRecords(records, language) {
  const ml = clean(language).toLowerCase() === "malayalam";
  if (!records || !records.length) {
    return ml ? "മൃഗ ആരോഗ്യ/ഉൽപ്പാദന രേഖകളൊന്നും കണ്ടെത്തിയില്ല." : "No animal health or production records were found.";
  }
  const lines = [ml ? "📒 മൃഗ ആരോഗ്യവും ഉൽപ്പാദനവും" : "📒 Animal Health & Production", ""];
  records.slice(0, 10).forEach(function (record) {
    lines.push("• " + record.date + " | " + record.animalId + " | " + (record.type || record.category));
    const details = [record.detail, record.result, record.unit, record.notes].filter(Boolean).join(" — ");
    if (details) lines.push(details);
  });
  return lines.join("\n");
}

function isAnimalNaturalLanguageQuery(text) {
  const value = clean(text).toLowerCase();
  if (!value || value.length < 4) return false;
  if (/\b(price|market|rate|cost|scheme|training)\b/.test(value)) return false;
  return /\b(cow|cattle|calf|buffalo|goat|sheep|pig|poultry|chicken|duck|animal|livestock|dairy|milk|udder|mastitis|vaccine|vaccination|deworm|breeding|heat cycle|veterinary|vet)\b/.test(value) ||
    /(?:പശു|കന്നുകാലി|കിടാവ്|ആട്|കോഴി|താറാവ്|പന്നി|മൃഗം|മൃഗസംരക്ഷണം|പാൽ|അകിട്|വാക്സിൻ|വിരമരുന്ന്|വെറ്ററിനറി)/.test(value);
}

module.exports = {
  ANIMAL_ACTION_IDS,
  ANIMAL_DISEASE_ALERT_SHEET,
  ANIMAL_HEALTH_SHEET,
  ANIMAL_PRODUCTION_SHEET,
  ANIMAL_REGISTRY_SHEET,
  REQUIRED_HEADERS,
  appendHeaderMappedRecord,
  buildRow,
  formatAnimalRecords,
  formatDiseaseAlerts,
  formatOwnedAnimals,
  getOwnedAnimals,
  getAnimalRecords,
  getVerifiedDiseaseAlerts,
  isAnimalNaturalLanguageQuery,
  makeHeaderMap,
  missingHeaders,
  parseAnimalAction,
  saveBreedingProductionRecord,
  saveHealthRecord,
  verifyAnimalOwnership
};
