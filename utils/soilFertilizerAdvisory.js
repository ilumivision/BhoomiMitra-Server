"use strict";

// This module deliberately keeps agronomic rules deterministic. AI extraction may
// populate an observation, but it never supplies or alters a fertilizer dose.

const SOIL_RECORD_SHEET = "Soil_Test_Repository";

const SOIL_FERTILIZER_ACTION_IDS = Object.freeze({
  OPEN: "SOIL_FERT_OPEN",
  SOURCE_UPLOAD: "SOIL_FERT_SOURCE_UPLOAD",
  SOURCE_EXISTING: "SOIL_FERT_SOURCE_EXISTING",
  SOURCE_MAP: "SOIL_FERT_SOURCE_MAP",
  SOURCE_TYPED: "SOIL_FERT_SOURCE_TYPED",
  RECOMMEND_YES: "SOIL_FERT_RECOMMEND_YES",
  RECOMMEND_NO: "SOIL_FERT_RECOMMEND_NO",
  CROP_COCONUT: "SOIL_FERT_CROP_COCONUT",
  CROP_RAMBUTAN: "SOIL_FERT_CROP_RAMBUTAN",
  CROPS_DONE: "SOIL_FERT_CROPS_DONE",
  PREFERENCE_RECOMMEND: "SOIL_FERT_PREF_RECOMMEND",
  PREFERENCE_SPECIFY: "SOIL_FERT_PREF_SPECIFY",
  SAVE_REMINDERS: "SOIL_FERT_SAVE_REMINDERS",
  SAVE_ONLY: "SOIL_FERT_SAVE_ONLY",
  SAVE_NO: "SOIL_FERT_SAVE_NO",
  EXPERT: "SOIL_FERT_EXPERT",
  CANCEL: "SOIL_FERT_CANCEL"
});

const SOIL_FERTILIZER_PREFIXES = Object.freeze({
  EXISTING_RECORD: "SOIL_FERT_RECORD:",
  LAND: "SOIL_FERT_LAND:"
});

const SOURCE_TYPES = Object.freeze({
  LAB_REPORT: "LAB_REPORT",
  EXISTING_RECORD: "EXISTING_RECORD",
  SOIL_MAP: "SOIL_MAP",
  TYPED: "TYPED"
});

const SCIENTIFIC_SOURCES = Object.freeze({
  KAU_COCONUT: Object.freeze({
    name: "Kerala Agricultural University Package of Practices Recommendations: Crops",
    url: "https://keralaagriculture.gov.in/wp-content/uploads/2021/04/pop2016.pdf",
    edition: "2016, Coconut Table 24"
  }),
  KERALA_FARM_GUIDE: Object.freeze({
    name: "Kerala Department of Agriculture Farm Guide 2024",
    url: "https://keralaagriculture.gov.in/wp-content/uploads/2024/02/Farmguide-2024.pdf",
    edition: "2024"
  }),
  KAU_SOIL_LAB: Object.freeze({
    name: "Kerala Agricultural University Soil, Plant and Water Test and Advisory Service",
    url: "https://kau.in/soil-plant-water-test-and-advisory-service-team",
    edition: "service reference"
  }),
  KAU_RAMBUTAN_ADVISORY: Object.freeze({
    name: "KAU Pineapple Research Station advisory service (includes rambutan)",
    url: "https://prsvkm.kau.in/basic-page/advisory",
    edition: "advisory service reference; no published fertilizer schedule"
  }),
  SOIL_HEALTH_CARD_CYCLE: Object.freeze({
    name: "Government of India Soil Health Card guidance",
    url: "https://soilhealth.dac.gov.in/files/FAQ_Final_English.pdf",
    edition: "three-year soil health card cycle"
  })
});

const FERTILIZERS = Object.freeze({
  UREA: Object.freeze({ name: "Urea", nutrient: "N", fraction: 0.46 }),
  SSP: Object.freeze({ name: "Single super phosphate (SSP 0-16-0)", nutrient: "P2O5", fraction: 0.16 }),
  ROCK_PHOSPHATE: Object.freeze({ name: "Rock phosphate (28.4% P2O5)", nutrient: "P2O5", fraction: 0.284 }),
  MOP: Object.freeze({ name: "Muriate of potash (MOP 0-0-60)", nutrient: "K2O", fraction: 0.60 })
});

const COCONUT_RULES = Object.freeze({
  average: Object.freeze({ n: 340, p2o5: 170, k2o: 680 }),
  good: Object.freeze({ n: 500, p2o5: 320, k2o: 1200 })
});

const PARAMETER_ALIASES = Object.freeze({
  ph: ["ph", "soilph"],
  ec: ["ec", "electricalconductivity"],
  organicCarbon: ["oc", "organiccarbon", "organicc"],
  nitrogen: ["n", "nitrogen", "availablenitrogen"],
  phosphorus: ["p", "phosphorus", "availablephosphorus", "p2o5"],
  potassium: ["k", "potassium", "availablepotassium", "k2o"],
  calcium: ["ca", "calcium"],
  magnesium: ["mg", "magnesium"],
  sulphur: ["s", "sulphur", "sulfur"],
  zinc: ["zn", "zinc"],
  boron: ["b", "boron"],
  iron: ["fe", "iron"],
  manganese: ["mn", "manganese"],
  copper: ["cu", "copper"]
});

function clean(value) {
  return value == null ? "" : String(value).trim();
}

function normalize(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeHeader(value) {
  return normalize(value);
}

function makeHeaderMap(headers) {
  const map = Object.create(null);
  (headers || []).forEach(function (header, index) {
    const key = normalizeHeader(header);
    if (key && map[key] === undefined) map[key] = index;
  });
  return map;
}

function getValue(row, map, aliases) {
  for (const alias of aliases || []) {
    const index = map[normalizeHeader(alias)];
    if (index !== undefined) return clean(row && row[index]);
  }
  return "";
}

function parseDate(value) {
  const text = clean(value);
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    const dmy = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (!dmy) return "";
    match = [dmy[0], dmy[3], dmy[2], dmy[1]];
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

function finiteNumber(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safePositiveInteger(value) {
  const number = finiteNumber(value);
  return Number.isInteger(number) && number > 0 && number <= 1000000 ? number : null;
}

function encode(value) {
  return encodeURIComponent(clean(value));
}

function decode(value) {
  try { return clean(decodeURIComponent(value)); } catch (error) { return ""; }
}

function parseSoilFertilizerAction(selectionId) {
  const id = clean(selectionId);
  const fixed = Object.create(null);
  Object.keys(SOIL_FERTILIZER_ACTION_IDS).forEach(function (key) {
    fixed[SOIL_FERTILIZER_ACTION_IDS[key]] = { action: key };
  });
  if (fixed[id]) return fixed[id];
  if (id.startsWith(SOIL_FERTILIZER_PREFIXES.EXISTING_RECORD)) {
    const recordId = decode(id.slice(SOIL_FERTILIZER_PREFIXES.EXISTING_RECORD.length));
    return recordId ? { action: "EXISTING_RECORD", recordId: recordId } : null;
  }
  if (id.startsWith(SOIL_FERTILIZER_PREFIXES.LAND)) {
    const landId = decode(id.slice(SOIL_FERTILIZER_PREFIXES.LAND.length));
    return landId ? { action: "LAND", landId: landId } : null;
  }
  return null;
}

function findParameterName(value) {
  const candidate = normalize(value);
  return Object.keys(PARAMETER_ALIASES).find(function (name) {
    return PARAMETER_ALIASES[name].some(function (alias) { return normalize(alias) === candidate; });
  }) || "";
}

function normalizeParameter(value, name) {
  const input = value && typeof value === "object" ? value : { value: value };
  const number = finiteNumber(input.value);
  if (number === null) return null;
  return {
    name: name,
    value: number,
    unit: clean(input.unit),
    method: clean(input.method),
    interpretation: clean(input.interpretation || input.rating)
  };
}

function normalizeSoilObservation(value, defaults) {
  const input = value && typeof value === "object" ? value : {};
  const fallback = defaults || {};
  const parameters = Object.create(null);
  const supplied = input.parameters && typeof input.parameters === "object" ? input.parameters : input;
  Object.keys(supplied).forEach(function (key) {
    const name = findParameterName(key);
    if (!name) return;
    const parameter = normalizeParameter(supplied[key], name);
    if (parameter) parameters[name] = parameter;
  });
  return {
    recordId: clean(input.recordId || fallback.recordId),
    farmerId: clean(input.farmerId || fallback.farmerId),
    landId: clean(input.landId || fallback.landId),
    sourceType: clean(input.sourceType || fallback.sourceType).toUpperCase(),
    sourceName: clean(input.sourceName || input.laboratory || fallback.sourceName),
    observedAt: parseDate(input.observedAt || input.testDate || fallback.observedAt),
    dateMeaning: clean(input.dateMeaning || fallback.dateMeaning) || "soil_test_date",
    reportReference: clean(input.reportReference || fallback.reportReference),
    parameters: parameters,
    extractionStatus: clean(input.extractionStatus || fallback.extractionStatus),
    extractionWarnings: Array.isArray(input.extractionWarnings) ? input.extractionWarnings.map(clean).filter(Boolean) : []
  };
}

function validateSoilObservation(value, options) {
  const input = normalizeSoilObservation(value);
  const settings = options || {};
  const errors = [];
  const warnings = input.extractionWarnings.slice();
  if (!Object.values(SOURCE_TYPES).includes(input.sourceType)) errors.push("SOURCE_TYPE_REQUIRED");
  if (!input.sourceName) errors.push("SOURCE_NAME_REQUIRED");
  if (!input.observedAt) errors.push("OBSERVATION_DATE_REQUIRED");
  if (!Object.keys(input.parameters).length) errors.push("SOIL_PARAMETERS_REQUIRED");
  Object.keys(input.parameters).forEach(function (name) {
    const parameter = input.parameters[name];
    if (name !== "ph" && !parameter.unit) errors.push("UNIT_REQUIRED:" + name);
    if (["nitrogen", "phosphorus", "potassium", "organicCarbon"].includes(name) && !parameter.method) {
      warnings.push("METHOD_MISSING:" + name);
    }
  });
  ["ph", "nitrogen", "phosphorus", "potassium"].forEach(function (name) {
    if (!input.parameters[name]) warnings.push("PARAMETER_MISSING:" + name);
  });
  if (input.sourceType === SOURCE_TYPES.SOIL_MAP) {
    warnings.push("MAP_ESTIMATE_NOT_LAB_TEST");
  }
  if (settings.farmerId && input.farmerId && normalize(settings.farmerId) !== normalize(input.farmerId)) {
    errors.push("FARMER_OWNERSHIP_MISMATCH");
  }
  if (settings.landIds && input.landId && !settings.landIds.map(normalize).includes(normalize(input.landId))) {
    errors.push("LAND_OWNERSHIP_MISMATCH");
  }
  const maximumAgeDays = settings.maximumAgeDays === undefined ? 1095 : Number(settings.maximumAgeDays);
  if (input.observedAt && Number.isFinite(maximumAgeDays) && maximumAgeDays > 0) {
    const now = settings.now instanceof Date ? settings.now : new Date(settings.now || Date.now());
    const ageDays = Math.floor((now.getTime() - Date.parse(input.observedAt + "T00:00:00Z")) / 86400000);
    if (ageDays > maximumAgeDays) warnings.push("SOIL_OBSERVATION_OUTDATED");
  }
  return { valid: errors.length === 0, observation: input, errors: errors, warnings: Array.from(new Set(warnings)) };
}

function splitTypedParts(text) {
  return clean(text).split(/[|;,\n]+/).map(clean).filter(Boolean);
}

function parseTypedSoilValues(text, metadata) {
  const parameters = Object.create(null);
  const errors = [];
  splitTypedParts(text).forEach(function (part) {
    const match = part.match(/^([A-Za-z](?:[A-Za-z0-9 _-]{0,29}[A-Za-z0-9])?)(?:\s*[:=]\s*|\s+)(-?\d+(?:\.\d+)?)\s*([^\[]*?)\s*(?:\[([^\]]+)\])?$/);
    if (!match) {
      errors.push("UNREADABLE_VALUE:" + part);
      return;
    }
    const name = findParameterName(match[1]);
    if (!name) {
      errors.push("UNKNOWN_PARAMETER:" + clean(match[1]));
      return;
    }
    parameters[name] = {
      value: Number(match[2]),
      unit: clean(match[3]).replace(/^[-:]\s*/, ""),
      method: clean(match[4]),
      interpretation: ""
    };
  });
  const observation = normalizeSoilObservation({
    farmerId: metadata && metadata.farmerId,
    landId: metadata && metadata.landId,
    sourceType: SOURCE_TYPES.TYPED,
    sourceName: metadata && metadata.sourceName,
    observedAt: metadata && metadata.observedAt,
    parameters: parameters,
    extractionStatus: "FARMER_TYPED"
  });
  const validation = validateSoilObservation(observation, metadata);
  return {
    success: errors.length === 0 && validation.valid,
    observation: validation.observation,
    errors: errors.concat(validation.errors),
    warnings: validation.warnings
  };
}

function parseParametersJson(text) {
  try {
    const parsed = JSON.parse(clean(text));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    return null;
  }
}

function normalizeExtractedSoilReport(payload, metadata) {
  const parsed = typeof payload === "string" ? parseParametersJson(payload) : payload;
  if (!parsed || typeof parsed !== "object") {
    return { success: false, code: "REPORT_EXTRACTION_INVALID", errors: ["REPORT_EXTRACTION_INVALID"] };
  }
  const observation = normalizeSoilObservation({
    farmerId: metadata && metadata.farmerId,
    landId: metadata && metadata.landId,
    sourceType: SOURCE_TYPES.LAB_REPORT,
    sourceName: parsed.laboratory || parsed.sourceName,
    observedAt: parsed.testDate || parsed.observedAt,
    reportReference: parsed.reportReference,
    parameters: parsed.parameters,
    extractionStatus: "AI_EXTRACTED_UNCONFIRMED",
    extractionWarnings: ["FARMER_CONFIRMATION_REQUIRED"]
  });
  const validation = validateSoilObservation(observation, metadata);
  return {
    success: validation.valid,
    code: validation.valid ? "EXTRACTED_CONFIRMATION_REQUIRED" : "REPORT_INCOMPLETE",
    observation: validation.observation,
    errors: validation.errors,
    warnings: validation.warnings
  };
}

function readFarmerSoilRecords(rows, farmerId, allowedLandIds) {
  const all = Array.isArray(rows) ? rows : [];
  if (all.length < 2 || !clean(farmerId)) return [];
  const map = makeHeaderMap(all[0]);
  const required = ["Farmer_ID", "Land_ID", "Test_Date", "Source_Name"];
  if (!required.every(function (header) { return map[normalizeHeader(header)] !== undefined; })) return [];
  const allowed = (allowedLandIds || []).map(normalize);
  return all.slice(1).map(function (row) {
    const owner = getValue(row, map, ["Farmer_ID"]);
    const landId = getValue(row, map, ["Land_ID"]);
    if (normalize(owner) !== normalize(farmerId)) return null;
    if (allowed.length && !allowed.includes(normalize(landId))) return null;
    const parameters = Object.create(null);
    Object.keys(PARAMETER_ALIASES).forEach(function (name) {
      const aliases = PARAMETER_ALIASES[name];
      const value = getValue(row, map, aliases);
      if (finiteNumber(value) === null) return;
      parameters[name] = {
        value: Number(value),
        unit: getValue(row, map, aliases.map(function (alias) { return alias + "_Unit"; })),
        method: getValue(row, map, aliases.map(function (alias) { return alias + "_Method"; })),
        interpretation: getValue(row, map, aliases.map(function (alias) { return alias + "_Interpretation"; }))
      };
    });
    return normalizeSoilObservation({
      recordId: getValue(row, map, ["Soil_Test_ID", "Record_ID", "Test_ID"]),
      farmerId: owner,
      landId: landId,
      sourceType: SOURCE_TYPES.EXISTING_RECORD,
      sourceName: getValue(row, map, ["Source_Name", "Laboratory", "Lab_Name"]),
      observedAt: getValue(row, map, ["Test_Date", "Observed_At", "Sample_Date"]),
      reportReference: getValue(row, map, ["Report_Reference", "Report_No"]),
      parameters: parameters,
      extractionStatus: "SAVED_RECORD"
    });
  }).filter(Boolean);
}

function soilObservationFromMap(profile, metadata) {
  const input = profile || {};
  const parameters = Object.create(null);
  [
    ["ph", "ph", ""],
    ["organicCarbon", "organicCarbon", "g/kg"],
    ["nitrogen", "nitrogen", "g/kg"],
    ["phosphorus", "phosphorus", ""],
    ["potassium", "potassium", ""]
  ].forEach(function (entry) {
    if (finiteNumber(input[entry[1]]) === null) return;
    const unit = clean(input[entry[1] + "Unit"] || entry[2]);
    if (entry[0] !== "ph" && !unit) return;
    parameters[entry[0]] = { value: Number(input[entry[1]]), unit: unit, method: "Soil map model estimate", interpretation: "" };
  });
  return normalizeSoilObservation({
    farmerId: metadata && metadata.farmerId,
    landId: metadata && metadata.landId,
    sourceType: SOURCE_TYPES.SOIL_MAP,
    sourceName: clean(input.source) || "Location-linked soil map estimate",
    observedAt: (metadata && metadata.observedAt) || new Date().toISOString().slice(0, 10),
    dateMeaning: "retrieval_date_not_measurement_date",
    reportReference: clean(input.profileId),
    parameters: parameters,
    extractionStatus: "MAP_ESTIMATE",
    extractionWarnings: ["MAP_ESTIMATE_NOT_LAB_TEST", "DO_NOT_USE_FOR_LAB_BASED_NUTRIENT_ADJUSTMENT"]
  });
}

function fertilizerMass(nutrientGrams, fertilizer) {
  const nutrient = finiteNumber(nutrientGrams);
  if (nutrient === null || nutrient < 0 || !fertilizer || !(fertilizer.fraction > 0 && fertilizer.fraction <= 1)) return null;
  return Number((nutrient / fertilizer.fraction).toFixed(1));
}

function subtractReliablePreviousApplication(requirement, previous) {
  const result = Object.assign({}, requirement);
  const warnings = [];
  ["n", "p2o5", "k2o"].forEach(function (key) {
    const applied = finiteNumber(previous && previous[key]);
    if (applied === null) return;
    if (applied < 0) {
      warnings.push("INVALID_PREVIOUS_APPLICATION:" + key);
      return;
    }
    result[key] = Math.max(0, result[key] - applied);
  });
  return { requirement: result, warnings: warnings };
}

function coconutRecommendation(crop, observation) {
  const input = crop || {};
  const plantCount = safePositiveInteger(input.plantCount);
  const ageYears = finiteNumber(input.ageYears);
  const bearing = ["bearing", "adult", "mature"].includes(clean(input.stage).toLowerCase());
  const management = clean(input.managementLevel).toLowerCase();
  const waterRegime = clean(input.waterRegime).toLowerCase();
  const missing = [];
  if (!plantCount) missing.push("plantCount");
  if (ageYears === null) missing.push("ageYears");
  if (!clean(input.stage)) missing.push("stage");
  if (!COCONUT_RULES[management]) missing.push("managementLevel: average or good");
  if (!["rainfed", "irrigated"].includes(waterRegime)) missing.push("waterRegime: rainfed or irrigated");
  if (missing.length) return { crop: "Coconut", status: "INCOMPLETE", missing: missing, recommendation: null };
  if (!bearing) {
    return {
      crop: "Coconut",
      status: "UNSUPPORTED_STAGE",
      reason: "The integrated rule is only for explicitly identified adult/bearing coconut palms. A stage-specific KAU juvenile schedule has not been encoded.",
      recommendation: null,
      expertRecommended: true
    };
  }
  const soil = validateSoilObservation(observation || {});
  if (!soil.valid) {
    return { crop: "Coconut", status: "SOIL_DATA_INCOMPLETE", errors: soil.errors, warnings: soil.warnings, recommendation: null };
  }
  const baseline = COCONUT_RULES[management];
  const adjusted = subtractReliablePreviousApplication(baseline, input.previousNutrientsGramsPerPalm);
  const requirements = adjusted.requirement;
  const products = [
    { fertilizer: FERTILIZERS.UREA.name, gramsPerPalm: fertilizerMass(requirements.n, FERTILIZERS.UREA), totalKg: Number((fertilizerMass(requirements.n, FERTILIZERS.UREA) * plantCount / 1000).toFixed(2)), supplies: "N" },
    { fertilizer: FERTILIZERS.ROCK_PHOSPHATE.name, gramsPerPalm: fertilizerMass(requirements.p2o5, FERTILIZERS.ROCK_PHOSPHATE), totalKg: Number((fertilizerMass(requirements.p2o5, FERTILIZERS.ROCK_PHOSPHATE) * plantCount / 1000).toFixed(2)), supplies: "P2O5" },
    { fertilizer: FERTILIZERS.MOP.name, gramsPerPalm: fertilizerMass(requirements.k2o, FERTILIZERS.MOP), totalKg: Number((fertilizerMass(requirements.k2o, FERTILIZERS.MOP) * plantCount / 1000).toFixed(2)), supplies: "K2O" }
  ];
  const mapEstimate = soil.observation.sourceType === SOURCE_TYPES.SOIL_MAP;
  return {
    crop: "Coconut",
    status: mapEstimate ? "GENERAL_GUIDANCE_MAP_UNCERTAIN" : "READY_WITH_LIMITATIONS",
    landId: clean(input.landId),
    plantCount: plantCount,
    ageYears: ageYears,
    stage: clean(input.stage),
    managementLevel: management,
    soilAssessment: {
      sourceType: soil.observation.sourceType,
      sourceName: soil.observation.sourceName,
      observedAt: soil.observation.observedAt,
      dateMeaning: soil.observation.dateMeaning,
      parameters: soil.observation.parameters,
      note: "Values are reported as supplied. No independent fertility class or soil-test adjustment is inferred without method-specific, locally validated thresholds."
    },
    nutrientRequirementGramsPerPalmYear: requirements,
    baselineNutrientRequirementGramsPerPalmYear: Object.assign({}, baseline),
    fertilizers: products,
    schedule: waterRegime === "irrigated"
      ? ["One-third in April-May", "One-third in August-September", "One-third in December-January"]
      : ["One-third at the start of the southwest monsoon", "Two-thirds before the northeast monsoon"],
    method: "Apply in a 10 cm deep circular basin of about 2 m radius around an adult palm; avoid direct contact with the trunk and avoid application immediately before heavy rain.",
    assumptions: [
      "KAU adult bearing coconut schedule selected explicitly by the farmer as " + management + " management.",
      "Fertilizer grades are treated as Urea 46% N, rock phosphate 28.4% P2O5 and MOP 60% K2O, following the named KAU forms and Kerala Farm Guide composition table.",
      "No soil-test nutrient reduction was made because no method-specific Kerala adjustment rule is encoded.",
      mapEstimate ? "Map values are estimates and are not treated as a laboratory soil test." : "Laboratory values remain subject to report verification."
    ],
    warnings: Array.from(new Set(soil.warnings.concat(adjusted.warnings))),
    sources: [SCIENTIFIC_SOURCES.KAU_COCONUT, SCIENTIFIC_SOURCES.KERALA_FARM_GUIDE]
  };
}

function rambutanRecommendation(crop, observation) {
  const soil = validateSoilObservation(observation || {});
  return {
    crop: "Rambutan",
    status: "UNSUPPORTED_RULE",
    landId: clean(crop && crop.landId),
    plantCount: safePositiveInteger(crop && crop.plantCount),
    ageYears: finiteNumber(crop && crop.ageYears),
    stage: clean(crop && crop.stage),
    soilAssessment: soil.observation,
    recommendation: null,
    reason: "No locally applicable published KAU or ICAR rambutan fertilizer schedule was verified for integration. Coconut or generic fruit-tree doses must not be substituted.",
    expertRecommended: true,
    warnings: soil.errors.concat(soil.warnings),
    sources: [SCIENTIFIC_SOURCES.KAU_RAMBUTAN_ADVISORY]
  };
}

function buildRecommendations(options) {
  const input = options || {};
  if (input.consent !== true) {
    return { status: "DECLINED", recommendations: [], remindersAllowed: false };
  }
  if (clean(input.preference).toLowerCase() === "specify") {
    return {
      status: "FARMER_SPECIFICATION_REQUIRES_EXPERT_REVIEW",
      recommendations: [],
      remindersAllowed: false,
      reason: "Farmer-specified products cannot be converted into doses until product grades, crop rules and nutrient interactions are validated."
    };
  }
  const observation = input.soilObservation;
  const seen = new Set();
  const uniqueCrops = (input.crops || []).filter(function (crop) {
    const key = normalize(crop && (crop.crop || crop.cropName)) + "|" + normalize(crop && crop.landId);
    if (!key.replace("|", "") || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const recommendations = uniqueCrops.map(function (crop) {
    const name = clean(crop && (crop.crop || crop.cropName)).toLowerCase();
    if (name === "coconut") return coconutRecommendation(crop, observation);
    if (name === "rambutan") return rambutanRecommendation(crop, observation);
    return { crop: clean(crop && (crop.crop || crop.cropName)), status: "UNSUPPORTED_CROP", recommendation: null, expertRecommended: true };
  });
  return {
    status: recommendations.some(function (item) { return item.status === "READY_WITH_LIMITATIONS" || item.status === "GENERAL_GUIDANCE_MAP_UNCERTAIN"; })
      ? "PARTIALLY_READY"
      : "NO_VERIFIED_DOSE",
    recommendations: recommendations,
    remindersAllowed: recommendations.some(function (item) { return item.status === "READY_WITH_LIMITATIONS"; })
  };
}

function formatSoilSummary(observation, language) {
  const ml = clean(language).toLowerCase() === "malayalam";
  const soil = normalizeSoilObservation(observation || {});
  const lines = [ml ? "മണ്ണ് വിവരങ്ങളുടെ സംഗ്രഹം" : "Soil information summary"];
  lines.push((ml ? "ഉറവിടം: " : "Source: ") + (soil.sourceName || "Not available"));
  lines.push((soil.dateMeaning === "retrieval_date_not_measurement_date"
    ? (ml ? "വിവരം എടുത്ത തീയതി (പരിശോധന തീയതിയല്ല): " : "Retrieved (not a test date): ")
    : (ml ? "പരിശോധന തീയതി: " : "Test date: ")) + (soil.observedAt || "Not available"));
  Object.keys(soil.parameters).forEach(function (name) {
    const parameter = soil.parameters[name];
    lines.push(name + ": " + parameter.value + (parameter.unit ? " " + parameter.unit : "") + (parameter.method ? " [" + parameter.method + "]" : ""));
  });
  if (soil.sourceType === SOURCE_TYPES.SOIL_MAP) lines.push(ml ? "⚠️ ഇത് മാപ്പ് അടിസ്ഥാനത്തിലുള്ള ഏകദേശ കണക്കാണ്; ലാബ് പരിശോധനയല്ല." : "⚠️ This is a map estimate, not a laboratory test.");
  const validation = validateSoilObservation(soil);
  if (validation.warnings.includes("SOIL_OBSERVATION_OUTDATED")) {
    lines.push(ml ? "⚠️ ഈ പരിശോധനയ്ക്ക് മൂന്ന് വർഷത്തിൽ കൂടുതൽ പഴക്കമുണ്ട്; പുതുക്കിയ പരിശോധന പരിഗണിക്കുക." : "⚠️ This test is more than three years old; consider a current test.");
  }
  return lines.join("\n");
}

function formatRecommendationSummary(result, language) {
  const ml = clean(language).toLowerCase() === "malayalam";
  if (!result || result.status === "DECLINED") return ml ? "വള ശുപാർശ നൽകിയിട്ടില്ല." : "No fertilizer recommendation was requested.";
  const items = result.recommendations || [];
  const ready = items.filter(function (item) { return Boolean(item.fertilizers); }).map(function (item) { return item.crop; });
  const unsupported = items.filter(function (item) { return !item.fertilizers; }).map(function (item) { return item.crop; });
  const lines = [ml ? "വിള അടിസ്ഥാനത്തിലുള്ള വള നിർദേശം" : "Crop-wise fertilizer advisory"];
  lines.push(ml
    ? "സംഗ്രഹം: അളവ് ലഭ്യം — " + (ready.join(", ") || "ഒന്നുമില്ല") + "; വിദഗ്ധ പരിശോധന — " + (unsupported.join(", ") || "ഒന്നുമില്ല")
    : "Summary: dose available — " + (ready.join(", ") || "none") + "; expert review — " + (unsupported.join(", ") || "none"));
  items.forEach(function (item) {
    lines.push("", "*" + item.crop + "*");
    if (!item.fertilizers) {
      lines.push(ml ? "സ്ഥിരീകരിച്ച അളവ് നൽകാനാവില്ല." : "No verified dose can be provided.", item.reason || "");
      if (item.sources && item.sources[0]) lines.push((ml ? "ഉറവിടം: " : "Source: ") + item.sources[0].name + " — " + item.sources[0].url);
      return;
    }
    lines.push(
      (ml ? "മണ്ണ്: " : "Soil: ") + item.soilAssessment.sourceName + " (" +
        (item.soilAssessment.dateMeaning === "retrieval_date_not_measurement_date" ? "retrieved " : "tested ") +
        item.soilAssessment.observedAt + ")",
      (ml ? "പ്രായം/ഘട്ടം: " : "Age/stage: ") + item.ageYears + " years / " + item.stage,
      (ml ? "തെങ്ങുകളുടെ എണ്ണം: " : "Palms: ") + item.plantCount,
      (ml ? "പോഷക ആവശ്യം (ഗ്രാം/തെങ്ങ്/വർഷം): " : "Nutrient requirement (g/palm/year): ") +
        "N " + item.nutrientRequirementGramsPerPalmYear.n + ", P2O5 " + item.nutrientRequirementGramsPerPalmYear.p2o5 + ", K2O " + item.nutrientRequirementGramsPerPalmYear.k2o
    );
    item.fertilizers.forEach(function (fertilizer) {
      lines.push("• " + fertilizer.fertilizer + ": " + fertilizer.gramsPerPalm + " g/palm/year; total " + fertilizer.totalKg + " kg/year");
    });
    lines.push(
      (ml ? "സമയം: " : "Timing: ") + item.schedule.join("; "),
      (ml ? "രീതി: " : "Method: ") + item.method,
      (ml ? "ഉറവിടം: " : "Source: ") + item.sources[0].name + " — " + item.sources[0].url,
      ml ? "⚠️ ലാബ് രീതിക്ക് അനുസരിച്ച മണ്ണ്-ക്രമീകരണം ചെയ്തിട്ടില്ല. ചുണ്ണാമ്പ്/സൂക്ഷ്മപോഷക അളവുകൾ വിദഗ്ധ പരിശോധനയില്ലാതെ ചേർത്തിട്ടില്ല." : "⚠️ No method-specific soil-test adjustment was made. Lime and micronutrient doses were not added without verified interpretation."
    );
    if (item.status === "GENERAL_GUIDANCE_MAP_UNCERTAIN") {
      lines.push(ml ? "⚠️ ഇത് പൊതുവായ വിള മാർഗ്ഗനിർദേശം മാത്രം; മാപ്പ് കണക്ക് ലാബ് പരിശോധനയല്ല." : "⚠️ General crop guidance only; the map estimate is not a laboratory test.");
    }
  });
  return lines.filter(Boolean).join("\n").slice(0, 4000);
}

module.exports = {
  COCONUT_RULES,
  FERTILIZERS,
  SCIENTIFIC_SOURCES,
  SOIL_FERTILIZER_ACTION_IDS,
  SOIL_FERTILIZER_PREFIXES,
  SOIL_RECORD_SHEET,
  SOURCE_TYPES,
  buildRecommendations,
  coconutRecommendation,
  encode,
  fertilizerMass,
  formatRecommendationSummary,
  formatSoilSummary,
  normalizeExtractedSoilReport,
  normalizeSoilObservation,
  parseSoilFertilizerAction,
  parseTypedSoilValues,
  rambutanRecommendation,
  readFarmerSoilRecords,
  soilObservationFromMap,
  subtractReliablePreviousApplication,
  validateSoilObservation
};
