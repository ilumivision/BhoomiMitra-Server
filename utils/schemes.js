"use strict";

const crypto = require("crypto");

const SCHEME_CATALOG_SHEET = "Government_Schemes";
const ADVISORY_SHEET = "Weather_Advisory";
const SCHEME_REQUEST_SHEET = "Service_Request";
const SCHEME_LAND_SHEET = "Land_Parcels";
const SCHEME_ANIMAL_SHEET = "Animal_Registry";

const SCHEME_ACTION_IDS = Object.freeze({
  OPEN: "HOME_SCHEMES",
  CENTRAL: "SCHEME_GOV_CENTRAL",
  KERALA: "SCHEME_GOV_KERALA",
  RELEVANT: "SCHEME_RELEVANT",
  CROP: "SCHEME_CAT_CROP",
  LIVESTOCK: "SCHEME_CAT_LIVESTOCK",
  FISHERIES: "SCHEME_CAT_FISHERIES",
  ENTERPRISE: "SCHEME_CAT_ENTERPRISE",
  MACHINERY: "SCHEME_CAT_MACHINERY",
  FINANCIAL: "SCHEME_CAT_FINANCIAL",
  INSURANCE: "SCHEME_CAT_INSURANCE",
  ADVISORIES: "SCHEME_ADVISORIES",
  SEARCH: "SCHEME_SEARCH",
  MY_INTERESTS: "SCHEME_MY_INTERESTS",
  MORE_CATEGORIES: "SCHEME_MORE_CATEGORIES",
  APPLICATION_GUIDANCE: "SCHEME_APPLICATION_GUIDANCE",
  MAIN_MENU: "SCHEME_HOME"
});

const SCHEME_DYNAMIC_PREFIXES = Object.freeze({
  VIEW: "SCHEME_VIEW:",
  ADVISORY_VIEW: "SCHEME_ADVISORY:",
  INTEREST: "SCHEME_INTEREST:",
  MORE: "SCHEME_MORE:",
  HELP: "SCHEME_HELP:"
});

function clean(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeHeader(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function makeHeaderMap(headers) {
  const map = Object.create(null);
  (headers || []).forEach(function (header, index) {
    const key = normalizeHeader(header);
    if (key && map[key] === undefined) map[key] = index;
  });
  return map;
}

function getValue(row, headerMap, aliases) {
  for (const alias of aliases || []) {
    const index = headerMap[normalizeHeader(alias)];
    if (index !== undefined) return row && row[index] != null ? row[index] : "";
  }
  return "";
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 86400000);
  }

  const text = clean(value);
  if (!text || /ongoing|open|not specified|n\/a/i.test(text)) return null;
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial >= 20000 && serial <= 100000) {
      return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    }
  }
  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
      ? date
      : null;
  }
  const timestamp = Date.parse(text);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

function formatStoredDate(value) {
  const text = clean(value);
  const numericSerial = /^\d+(?:\.\d+)?$/.test(text) && Number(text) >= 20000;
  if (!numericSerial) return text;
  const date = parseDate(value);
  return date && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 10)
    : text;
}

function startOfDay(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function truncate(value, length) {
  const text = clean(value);
  return text.length <= length
    ? text
    : text.slice(0, Math.max(0, length - 1)).trimEnd() + "…";
}

function readSchemes(sheetRows) {
  const rows = Array.isArray(sheetRows) ? sheetRows : [];
  const headers = rows[0] || [];
  const map = makeHeaderMap(headers);

  return rows.slice(1).map(function (row, index) {
    return {
      rowNumber: index + 2,
      id: clean(getValue(row, map, ["Scheme_ID", "Scheme ID", "ID"])),
      name: clean(getValue(row, map, ["Scheme_Name", "Scheme Name", "Name"])),
      department: clean(getValue(row, map, ["Department", "Implementing_Department"])),
      government: clean(getValue(row, map, ["Government", "Government_Level", "Scheme_Level", "State"])),
      category: clean(getValue(row, map, ["Category", "Scheme_Category"])),
      subcategory: clean(getValue(row, map, ["Subcategory", "Sub_Category"])),
      purpose: clean(getValue(row, map, [
        "Purpose",
        "Objective",
        "Scheme_Purpose",
        "Description",
        "Remarks"
      ])),
      eligibility: clean(getValue(row, map, ["Eligibility", "Eligibility_Summary", "Who_Can_Apply", "Target_Beneficiaries"])),
      benefit: clean(getValue(row, map, ["Benefit", "Benefit_Summary", "Main_Benefit", "Benefits"])),
      financialAssistance: clean(getValue(row, map, ["Financial_Assistance", "Financial Assistance", "Subsidy"])),
      documents: clean(getValue(row, map, ["Documents_Required", "Documents Required", "Documents"])),
      applicationMode: clean(getValue(row, map, ["Application_Mode", "Application Mode", "How_to_Apply"])),
      applicationLink: clean(getValue(row, map, ["Application_Link", "Application_URL", "Official_URL", "Application Link", "Official_Link", "URL"])),
      contact: clean(getValue(row, map, ["Contact_Office", "Contact Office", "Contact"])),
      district: clean(getValue(row, map, ["District", "District_Applicability", "State_Applicability", "Applicability", "Area"])),
      validFrom: clean(getValue(row, map, ["Application_Start", "Valid_From", "Start_Date", "Opening_Date"])),
      lastDate: clean(getValue(row, map, ["Last_Date", "Application_End", "Last Date", "Valid_To", "Closing_Date"])),
      status: clean(getValue(row, map, ["Status", "Active_Status", "Active Status"])),
      source: clean(getValue(row, map, ["Source", "Official_Source", "Source_Department"])),
      officialUrl: clean(getValue(row, map, ["Official_URL", "Official_Link"])),
      lastUpdated: clean(getValue(row, map, ["Last_Source_Update", "Last_Checked", "Last_Updated", "Last Updated", "Updated_On"])),
      lastChecked: clean(getValue(row, map, ["Last_Checked", "Verification_Date", "Verified_On"])),
      dataQuality: clean(getValue(row, map, ["Data_Quality", "Verification_Status"])),
      sourceKey: clean(getValue(row, map, ["Source_Key"])),
      cropContext: clean(getValue(row, map, ["Crop_Context"])),
      livestockContext: clean(getValue(row, map, ["Livestock_Context"])),
      landContext: clean(getValue(row, map, ["Land_Context"])),
      remarks: clean(getValue(row, map, ["Remarks", "Description"])),
      row: row
    };
  }).filter(function (scheme) {
    return Boolean(scheme.id && scheme.name);
  });
}

function isActiveScheme(scheme, now) {
  const status = clean(scheme && scheme.status).toLowerCase();
  if (/inactive|not active|expired|closed|cancelled|canceled/.test(status)) return false;
  if (!/^(?:active|open|current|ongoing)\b/.test(status)) return false;
  const deadlineValue = clean(scheme && scheme.lastDate);
  const deadline = parseDate(scheme && scheme.lastDate);
  if (
    deadlineValue &&
    !/ongoing|open|not specified|n\/a/i.test(deadlineValue) &&
    !deadline
  ) return false;
  return !deadline || startOfDay(deadline).getTime() >= startOfDay(now || new Date()).getTime();
}

function activeSchemes(sheetRows, now) {
  return readSchemes(sheetRows).filter(function (scheme) {
    return isActiveScheme(scheme, now);
  });
}

function schemeVerificationState(scheme, now) {
  if (!scheme || !clean(scheme.id) || !clean(scheme.name)) {
    return "INFORMATION_UNAVAILABLE";
  }
  const status = clean(scheme.status).toLowerCase();
  const deadline = parseDate(scheme.lastDate);
  if (
    /inactive|not active|expired|closed|cancelled|canceled/.test(status) ||
    (deadline && startOfDay(deadline).getTime() < startOfDay(now || new Date()).getTime())
  ) {
    return "EXPIRED";
  }
  if (!isActiveScheme(scheme, now)) return "VERIFICATION_PENDING";
  const quality = clean(scheme.dataQuality).toLowerCase();
  const checkedDate = parseDate(scheme.lastChecked || scheme.lastUpdated);
  const ageDays = checkedDate
    ? (startOfDay(now || new Date()).getTime() - startOfDay(checkedDate).getTime()) / 86400000
    : Number.POSITIVE_INFINITY;
  const hasVerificationEvidence =
    (quality === "verifiedsource" || Boolean(clean(scheme.source))) &&
    ageDays >= -2 &&
    ageDays <= 180;
  return hasVerificationEvidence ? "VERIFIED_ACTIVE" : "VERIFICATION_PENDING";
}

function schemeVerificationText(scheme, language, now) {
  const ml = clean(language).toLowerCase() === "malayalam";
  const labels = ml
    ? {
        VERIFIED_ACTIVE: "സ്ഥിരീകരിച്ചതും സജീവവും",
        VERIFICATION_PENDING: "സ്ഥിരീകരണം ബാക്കി",
        EXPIRED: "കാലാവധി കഴിഞ്ഞു / അവസാനിച്ചു",
        INFORMATION_UNAVAILABLE: "വിവരം ലഭ്യമല്ല"
      }
    : {
        VERIFIED_ACTIVE: "Verified and active",
        VERIFICATION_PENDING: "Verification pending",
        EXPIRED: "Expired",
        INFORMATION_UNAVAILABLE: "Information unavailable"
      };
  return labels[schemeVerificationState(scheme, now)];
}

function findScheme(sheetRows, schemeId) {
  const target = clean(schemeId).toUpperCase();
  return readSchemes(sheetRows).find(function (scheme) {
    return scheme.id.toUpperCase() === target;
  }) || null;
}

function schemeSearchText(scheme) {
  return [
    scheme.name,
    scheme.department,
    scheme.government,
    scheme.category,
    scheme.subcategory,
    scheme.eligibility,
    scheme.benefit,
    scheme.financialAssistance,
    scheme.district,
    scheme.cropContext,
    scheme.livestockContext,
    scheme.landContext,
    scheme.remarks
  ].join(" ").toLowerCase();
}

const CATEGORY_PATTERNS = {
  CROP: /crop|agriculture|horticulture|coconut|fruit|vegetable|spice|plantation|replant/,
  LIVESTOCK: /livestock|animal|dairy|cattle|goat|poultry|veterinary/,
  FISHERIES: /fish|fishery|fisheries|aquaculture|marine|inland fishing|fisherfolk/,
  ENTERPRISE: /enterprise|entrepreneur|business|startup|self employment|value addition|processing|marketing/,
  MACHINERY: /machinery|mechanization|mechanisation|equipment|irrigation|drip|sprinkler|pump/,
  FINANCIAL: /subsid|financial|assistance|grant|credit|loan|income|support/,
  INSURANCE: /insurance|risk|compensation|disaster|damage|relief|claim/
};

function filterSchemesByCategory(schemes, category) {
  const pattern = CATEGORY_PATTERNS[category];
  if (!pattern) return schemes || [];
  return (schemes || []).filter(function (scheme) {
    return pattern.test(schemeSearchText(scheme));
  });
}

function filterSchemesByGovernment(schemes, level) {
  const target = clean(level).toLowerCase();

  return (schemes || []).filter(function (scheme) {
    const government = clean(scheme && scheme.government).toLowerCase();

    if (target === "central") {
      return /central|government of india|union/.test(government);
    }

    if (target === "kerala") {
      return /kerala|state/.test(government);
    }

    return false;
  });
}

function tokenize(value) {
  return clean(value).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(function (token) {
    return token.length > 1;
  });
}

function searchSchemes(schemes, query) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  return (schemes || []).map(function (scheme) {
    const text = schemeSearchText(scheme);
    const name = scheme.name.toLowerCase();
    const score = tokens.reduce(function (total, token) {
      if (name.includes(token)) return total + 4;
      return text.includes(token) ? total + 1 : total;
    }, 0);
    return { scheme: scheme, score: score };
  }).filter(function (entry) {
    return entry.score > 0;
  }).sort(function (left, right) {
    return right.score - left.score;
  }).map(function (entry) {
    return entry.scheme;
  });
}

function districtApplies(schemeDistrict, farmerDistrict) {
  const schemeValue = clean(schemeDistrict).toLowerCase();
  const farmerValue = clean(farmerDistrict).toLowerCase();
  if (!schemeValue || /all|kerala|statewide|india|national/.test(schemeValue)) return true;
  return Boolean(farmerValue && schemeValue.includes(farmerValue));
}

function uniqueValues(values) {
  const seen = new Set();
  return (values || []).map(clean).filter(function (value) {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildFarmerSchemeProfile(profile, landRows, animalRows) {
  const farmer = Object.assign({}, profile || {});
  const farmerId = clean(farmer.memberId).toUpperCase();
  const landData = Array.isArray(landRows) ? landRows : [];
  const landMap = makeHeaderMap(landData[0] || []);
  const crops = [];
  const irrigation = [];
  const equipment = [];

  landData.slice(1).forEach(function (row) {
    const rowFarmerId = clean(getValue(row, landMap, ["Farmer_ID", "Member_ID"])).toUpperCase();
    const status = clean(getValue(row, landMap, ["Active_Status", "Status"]));
    if (!farmerId || rowFarmerId !== farmerId || /inactive|closed|deleted/i.test(status)) return;
    crops.push(
      getValue(row, landMap, ["Main_Crop", "Crop", "Current_Crop"]),
      getValue(row, landMap, ["Other_Crops", "Registered_Crops", "Crops"])
    );
    irrigation.push(
      getValue(row, landMap, ["Irrigation_Available", "Irrigation_Source", "Irrigation_Method"])
    );
    equipment.push(
      getValue(row, landMap, ["Equipment", "Farm_Equipment", "Machinery", "Mechanization", "Mechanisation"])
    );
  });

  const animalData = Array.isArray(animalRows) ? animalRows : [];
  const animalMap = makeHeaderMap(animalData[0] || []);
  const livestock = [];
  animalData.slice(1).forEach(function (row) {
    const rowFarmerId = clean(getValue(row, animalMap, ["Farmer_ID", "Member_ID"])).toUpperCase();
    const status = clean(getValue(row, animalMap, ["Active_Status", "Status"]));
    if (!farmerId || rowFarmerId !== farmerId || /inactive|closed|deleted/i.test(status)) return;
    livestock.push(getValue(row, animalMap, ["Animal_Type", "Livestock_Type", "Species"]));
  });

  farmer.registeredCrops = uniqueValues(crops).join(" ");
  farmer.livestock = uniqueValues([
    farmer.livestock,
    uniqueValues(livestock).join(" ")
  ]).join(" ");
  farmer.irrigationContext = uniqueValues(irrigation).join(" ");
  farmer.equipmentContext = uniqueValues(equipment).join(" ");
  return farmer;
}

function relevantSchemes(schemes, profile) {
  const farmer = profile || {};
  const cropTokens = tokenize([
    farmer.mainCrop,
    farmer.otherCrops,
    farmer.majorCrops,
    farmer.registeredCrops
  ].filter(Boolean).join(" "));
  const livestockTokens = tokenize(farmer.livestock || "");
  return (schemes || []).filter(function (scheme) {
    return districtApplies(scheme.district, farmer.district) ||
      districtApplies(scheme.district, farmer.panchayath);
  }).map(function (scheme) {
    const text = schemeSearchText(scheme);
    let score = clean(scheme.district) ? 1 : 0;
    cropTokens.forEach(function (token) {
      if (text.includes(token)) score += 4;
    });
    livestockTokens.forEach(function (token) {
      if (text.includes(token)) score += 4;
    });
    if (clean(farmer.insurance) && /insurance|risk/.test(text)) score += 1;
    if (
      clean(farmer.mechanization || farmer.equipmentContext) &&
      /machinery|mechaniz|equipment/.test(text)
    ) score += 1;
    if (clean(farmer.irrigationContext) && /irrigation|drip|sprinkler|pump/.test(text)) score += 1;
    if (clean(farmer.farmerCategory) && text.includes(clean(farmer.farmerCategory).toLowerCase())) score += 2;
    return { scheme: scheme, score: score };
  }).sort(function (left, right) {
    return right.score - left.score;
  }).slice(0, 10).map(function (entry) {
    return entry.scheme;
  });
}

function buildSchemeListRows(schemes, language) {
  const ml = clean(language).toLowerCase() === "malayalam";
  return (schemes || []).slice(0, 10).map(function (scheme) {
    return {
      id: SCHEME_DYNAMIC_PREFIXES.VIEW + scheme.id,
      title: truncate(scheme.name, 24),
      description: truncate([
        scheme.department,
        scheme.category,
        schemeVerificationText(scheme, language),
        scheme.lastDate
          ? (ml ? "അപേക്ഷിക്കുക: " : "Apply by ") + scheme.lastDate
          : ""
      ].filter(Boolean).join(" • "), 72)
    };
  });
}

function safeOfficialLink(value) {
  const link = clean(value);
  return /^https:\/\/[^\s]+$/i.test(link) || /^http:\/\/[^\s]+$/i.test(link)
    ? link
    : "";
}

function schemeFreshnessText(scheme, language, now, maximumAgeDays) {
  const ml = clean(language).toLowerCase() === "malayalam";
  const updated = clean(scheme && scheme.lastUpdated);
  if (!updated) {
    return ml
      ? "പുതുക്കിയ തീയതി ലഭ്യമല്ല; നിലവിലെ നില ഔദ്യോഗിക ഉറവിടത്തിൽ പരിശോധിക്കുക."
      : "Update date is not provided; verify the current status with the official source.";
  }
  const updatedDate = parseDate(scheme && scheme.lastUpdated);
  if (!updatedDate) {
    return ml
      ? "പുതുക്കിയ തീയതി സ്ഥിരീകരിക്കാനായില്ല; നിലവിലെ നില ഔദ്യോഗിക ഉറവിടത്തിൽ പരിശോധിക്കുക."
      : "The update date could not be verified; confirm the current status with the official source.";
  }
  const today = startOfDay(now || new Date());
  const ageDays = (today.getTime() - startOfDay(updatedDate).getTime()) / 86400000;
  const maximumAge = Number.isFinite(maximumAgeDays) ? maximumAgeDays : 180;
  if (ageDays > maximumAge) {
    return ml
      ? "ഈ രേഖ പഴയതായിരിക്കാം; അപേക്ഷിക്കുന്നതിന് മുമ്പ് പുതിയ ഔദ്യോഗിക വിവരങ്ങൾ പരിശോധിക്കുക."
      : "This record may be stale; check the latest official information before applying.";
  }
  if (ageDays < -2) {
    return ml
      ? "പുതുക്കിയ തീയതി അസാധാരണമാണ്; ഔദ്യോഗിക ഉറവിടത്തിൽ പരിശോധിക്കുക."
      : "The update date appears inconsistent; verify it with the official source.";
  }
  return "";
}

function buildSchemeDetails(scheme, language, expanded, options) {
  const ml = clean(language).toLowerCase() === "malayalam";
  const governmentValue = clean(scheme && scheme.government);
  const government = /^central$/i.test(governmentValue)
    ? "Central Government"
    : /^kerala$/i.test(governmentValue)
      ? "Government of Kerala"
      : governmentValue;
  const benefit = [scheme && scheme.benefit, scheme && scheme.financialAssistance]
    .filter(Boolean).join("; ");
  const source = [scheme && scheme.contact, scheme && scheme.source]
    .filter(Boolean).join(" — ");
  const link = safeOfficialLink(scheme && (scheme.applicationLink || scheme.officialUrl));
  const missing = ml ? "വിവരം ലഭ്യമല്ല" : "Not provided";
  const applicationPeriod = [
    formatStoredDate(scheme && scheme.validFrom),
    formatStoredDate(scheme && scheme.lastDate)
  ].filter(Boolean).join(" — ") || missing;
  const freshness = schemeFreshnessText(
    scheme,
    language,
    options && options.now,
    options && options.maximumAgeDays
  );
  const lines = ml
    ? [
        "🏛️ പദ്ധതി വിവരങ്ങൾ",
        "",
        "പദ്ധതി: " + (clean(scheme && scheme.name) || missing),
        "സ്ഥിരീകരണ നില: " + schemeVerificationText(scheme, language, options && options.now),
        "സർക്കാർ: " + (government || missing),
        "വകുപ്പ്: " + (clean(scheme && scheme.department) || missing),
        "ഉദ്ദേശ്യം: " + (clean(scheme && scheme.purpose) || missing),
        "ആർക്കു സഹായകരമാകാം: " + (clean(scheme && scheme.eligibility) || missing),
        "പ്രധാന ആനുകൂല്യം: " + (benefit || missing),
        "യോഗ്യതാ സംഗ്രഹം: " + (clean(scheme && scheme.eligibility) || missing),
        "അപേക്ഷാ കാലയളവ്: " + applicationPeriod,
        "അപേക്ഷിക്കേണ്ട വിധം: " + (clean(scheme && scheme.applicationMode) || missing),
        "ബന്ധപ്പെടുക / ഔദ്യോഗിക ഉറവിടം: " + (source || missing),
        "ബാധകമായ പ്രദേശം: " + (clean(scheme && scheme.district) || clean(scheme && scheme.government) || missing)
      ]
    : [
        "🏛️ Scheme Details",
        "",
        "Scheme: " + (clean(scheme && scheme.name) || missing),
        "Verification status: " + schemeVerificationText(scheme, language, options && options.now),
        "Government: " + (government || missing),
        "Department: " + (clean(scheme && scheme.department) || missing),
        "Purpose: " + (clean(scheme && scheme.purpose) || missing),
        "Who may apply: " + (clean(scheme && scheme.eligibility) || missing),
        "Main benefit: " + (benefit || missing),
        "Eligibility summary: " + (clean(scheme && scheme.eligibility) || missing),
        "Application period: " + applicationPeriod,
        "How to apply: " + (clean(scheme && scheme.applicationMode) || missing),
        "Contact / official source: " + (source || missing),
        "District/state applicability: " + (clean(scheme && scheme.district) || clean(scheme && scheme.government) || missing)
      ];
  if (link) lines.push((ml ? "ഔദ്യോഗിക ലിങ്ക്: " : "Official link: ") + link);
  if (expanded && clean(scheme && scheme.documents)) {
    lines.push((ml ? "ആവശ്യമായ രേഖകൾ: " : "Documents indicated: ") + scheme.documents);
  }
  lines.push(
    (ml ? "അവസാനം പുതുക്കിയത്: " : "Last updated: ") +
      (formatStoredDate(scheme && scheme.lastUpdated) || missing)
  );
  if (freshness) lines.push(freshness);
  lines.push(
    "",
    ml
      ? "ഇത് ലഭ്യമായ ഔദ്യോഗിക രേഖകളുടെ ലളിതമായ വിശദീകരണമാണ്. അപേക്ഷിക്കുന്നതിന് മുമ്പ് യോഗ്യതയും നിലവിലെ നിബന്ധനകളും ഔദ്യോഗിക ഉറവിടത്തിൽ പരിശോധിക്കുക."
      : "This is a plain-language explanation of the available official record. Verify current eligibility and terms with the official source before applying."
  );
  return truncate(lines.join("\n"), 1000);
}

function parseSchemeAction(selectionId) {
  const id = clean(selectionId);
  const fixed = {};
  fixed[SCHEME_ACTION_IDS.OPEN] = { action: "OPEN" };
  fixed[SCHEME_ACTION_IDS.CENTRAL] = { action: "GOVERNMENT", level: "Central" };
  fixed[SCHEME_ACTION_IDS.KERALA] = { action: "GOVERNMENT", level: "Kerala" };
  fixed[SCHEME_ACTION_IDS.RELEVANT] = { action: "RELEVANT" };
  fixed[SCHEME_ACTION_IDS.CROP] = { action: "LIST", category: "CROP" };
  fixed[SCHEME_ACTION_IDS.LIVESTOCK] = { action: "LIST", category: "LIVESTOCK" };
  fixed[SCHEME_ACTION_IDS.FISHERIES] = { action: "LIST", category: "FISHERIES" };
  fixed[SCHEME_ACTION_IDS.ENTERPRISE] = { action: "LIST", category: "ENTERPRISE" };
  fixed[SCHEME_ACTION_IDS.MACHINERY] = { action: "LIST", category: "MACHINERY" };
  fixed[SCHEME_ACTION_IDS.FINANCIAL] = { action: "LIST", category: "FINANCIAL" };
  fixed[SCHEME_ACTION_IDS.INSURANCE] = { action: "LIST", category: "INSURANCE" };
  fixed[SCHEME_ACTION_IDS.ADVISORIES] = { action: "ADVISORIES" };
  fixed[SCHEME_ACTION_IDS.SEARCH] = { action: "SEARCH" };
  fixed[SCHEME_ACTION_IDS.MY_INTERESTS] = { action: "MY_INTERESTS" };
  fixed[SCHEME_ACTION_IDS.MORE_CATEGORIES] = { action: "MORE_CATEGORIES" };
  fixed[SCHEME_ACTION_IDS.APPLICATION_GUIDANCE] = { action: "APPLICATION_GUIDANCE" };
  fixed[SCHEME_ACTION_IDS.MAIN_MENU] = { action: "MAIN_MENU" };
  if (fixed[id]) return fixed[id];
  for (const entry of [
    [SCHEME_DYNAMIC_PREFIXES.ADVISORY_VIEW, "ADVISORY_VIEW"],
    [SCHEME_DYNAMIC_PREFIXES.VIEW, "VIEW"],
    [SCHEME_DYNAMIC_PREFIXES.INTEREST, "INTEREST"],
    [SCHEME_DYNAMIC_PREFIXES.MORE, "MORE"],
    [SCHEME_DYNAMIC_PREFIXES.HELP, "HELP"]
  ]) {
    if (id.startsWith(entry[0])) {
      const schemeId = clean(id.slice(entry[0].length));
      return schemeId ? { action: entry[1], schemeId: schemeId } : null;
    }
  }
  return null;
}

function buildRowFromHeaders(headers, values) {
  const normalized = Object.create(null);
  Object.keys(values || {}).forEach(function (key) {
    normalized[normalizeHeader(key)] = values[key];
  });
  return (headers || []).map(function (header) {
    const key = normalizeHeader(header);
    return Object.prototype.hasOwnProperty.call(normalized, key) ? normalized[key] : "";
  });
}

function requestHeadersPresent(headers) {
  const map = makeHeaderMap(headers);
  return [
    "Request_ID", "Request_Date", "Farmer_ID", "Farmer_Name", "Mobile_No",
    "Request_Category", "Service_Type", "Request_Description", "Status"
  ].every(function (header) {
    return map[normalizeHeader(header)] !== undefined;
  });
}

function schemeRequestId(sourceMessageId) {
  const source = clean(sourceMessageId);
  if (!source) return "BM-SCH-" + crypto.randomUUID().toUpperCase();
  return "BM-SCH-" + crypto.createHash("sha256").update(source).digest("hex").slice(0, 20).toUpperCase();
}

function sheetSafe(value) {
  const text = clean(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function readSchemeInterests(rows, farmerId) {
  const data = Array.isArray(rows) ? rows : [];
  const headers = data[0] || [];
  const map = makeHeaderMap(headers);
  const target = clean(farmerId).toUpperCase();
  return data.slice(1).filter(function (row) {
    return clean(getValue(row, map, ["Farmer_ID"])).toUpperCase() === target &&
      clean(getValue(row, map, ["Request_Category"])).toLowerCase() === "scheme interest";
  }).map(function (row) {
    return {
      requestId: clean(getValue(row, map, ["Request_ID"])),
      requestedAt: clean(getValue(row, map, ["Request_Date"])),
      schemeId: clean(getValue(row, map, ["Service_Type"])),
      schemeName: clean(getValue(row, map, ["Request_Description"])),
      status: clean(getValue(row, map, ["Status"])) || "Interested"
    };
  }).sort(function (left, right) {
    return (Date.parse(right.requestedAt) || 0) - (Date.parse(left.requestedAt) || 0);
  });
}

async function saveSchemeInterest(options) {
  const input = options || {};
  const farmer = input.farmer || {};
  const scheme = input.scheme || {};
  const status = input.helpRequested ? "Help Requested" : "Interested";
  if (!clean(farmer.memberId)) return { success: false, code: "FARMER_REQUIRED" };
  if (!clean(scheme.id) || !clean(scheme.name)) return { success: false, code: "INVALID_SCHEME" };
  const rows = Array.isArray(input.requestRows) ? input.requestRows : [];
  const headers = rows[0] || [];
  if (!requestHeadersPresent(headers)) return { success: false, code: "REQUEST_SCHEMA_UNAVAILABLE" };
  const existing = readSchemeInterests(rows, farmer.memberId).find(function (interest) {
    return interest.schemeId.toUpperCase() === clean(scheme.id).toUpperCase() &&
      interest.status.toLowerCase() === status.toLowerCase();
  });
  if (existing) return { success: true, duplicate: true, scheme: scheme, status: status };
  const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
  const requestId = schemeRequestId(input.sourceMessageId);
  const map = makeHeaderMap(headers);
  const duplicateDelivery = rows.slice(1).some(function (row) {
    return clean(getValue(row, map, ["Request_ID"])).toUpperCase() === requestId;
  });
  if (duplicateDelivery) return { success: true, duplicate: true, scheme: scheme, status: status };
  const row = buildRowFromHeaders(headers, {
    Request_ID: requestId,
    Request_Date: now.toISOString(),
    BM_ID: farmer.memberId,
    Farmer_ID: farmer.memberId,
    Farmer_Name: farmer.name || "",
    Mobile_No: farmer.whatsapp || farmer.mobile || input.farmerWhatsApp || "",
    District: farmer.district || "",
    Panchayath: farmer.panchayath || "",
    Request_Category: "Scheme Interest",
    Service_Type: scheme.id,
    Request_Description: sheetSafe(scheme.name),
    Priority: "Normal",
    Status: status,
    Preferred_Language: input.language || farmer.preferredLanguage || "",
    Language: input.language || farmer.preferredLanguage || "",
    Remarks: [
      "WhatsApp government scheme interest",
      "Request Type: " + status,
      "Preferred Language: " + clean(input.language || farmer.preferredLanguage)
    ].filter(Boolean).join("\n")
  });
  const appendResult = await input.appendRequest(SCHEME_REQUEST_SHEET, row);
  const appended = appendResult === true || Boolean(appendResult && appendResult.success === true);
  return appended
    ? { success: true, duplicate: false, requestId: requestId, scheme: scheme, status: status }
    : { success: false, code: "REQUEST_SAVE_FAILED", scheme: scheme };
}

function readAdvisories(sheetRows) {
  const rows = Array.isArray(sheetRows) ? sheetRows : [];
  const headers = rows[0] || [];
  const map = makeHeaderMap(headers);
  return rows.slice(1).map(function (row) {
    return {
      id: clean(getValue(row, map, ["Advisory_ID", "ID"])),
      date: clean(getValue(row, map, ["Date", "Advisory_Date"])),
      district: clean(getValue(row, map, ["District"])),
      panchayat: clean(getValue(row, map, ["Panchayat", "Panchayath"])),
      crop: clean(getValue(row, map, ["Crop"])),
      title: clean(getValue(row, map, ["Advisory_Title", "Title"])),
      message: clean(getValue(row, map, ["Advisory_Message", "Message", "Advice"])),
      source: clean(getValue(row, map, ["Source"])),
      language: clean(getValue(row, map, ["Language"])),
      status: clean(getValue(row, map, ["Status"])),
      updatedOn: clean(getValue(row, map, ["Updated_On", "Last_Updated"])),
      alertLevel: clean(getValue(row, map, ["Alert_Level"])),
      weatherType: clean(getValue(row, map, ["Weather_Type", "Weather_Condition"]))
    };
  }).filter(function (advisory) {
    return Boolean(advisory.id && advisory.title && advisory.message);
  });
}

function findAdvisory(sheetRows, advisoryId) {
  const target = clean(advisoryId).toUpperCase();
  return readAdvisories(sheetRows).find(function (advisory) {
    return advisory.id.toUpperCase() === target;
  }) || null;
}

function currentAdvisories(sheetRows, profile, now, maximumAgeDays) {
  const farmer = profile || {};
  const today = startOfDay(now || new Date());
  const maximumAge = Number.isFinite(maximumAgeDays) ? maximumAgeDays : 14;
  const applicabilityTokens = tokenize([
    farmer.mainCrop,
    farmer.otherCrops,
    farmer.majorCrops,
    farmer.registeredCrops,
    farmer.livestock
  ].filter(Boolean).join(" "));
  const preferredLanguage = clean(farmer.preferredLanguage).toLowerCase();
  return readAdvisories(sheetRows).filter(function (advisory) {
    const status = advisory.status.toLowerCase();
    if (/inactive|not active|expired|closed/.test(status)) return false;
    if (!/^(?:active|current|open)\b/.test(status)) return false;
    const date = parseDate(advisory.updatedOn || advisory.date);
    if (!date) return false;
    const ageDays = (today.getTime() - startOfDay(date).getTime()) / 86400000;
    if (ageDays < -1 || ageDays > maximumAge) return false;
    if (!districtApplies(advisory.district, farmer.district)) return false;
    if (
      advisory.panchayat &&
      !districtApplies(advisory.panchayat, farmer.panchayath)
    ) return false;
    const advisoryCrop = clean(advisory.crop).toLowerCase();
    return !advisoryCrop || applicabilityTokens.length === 0 || applicabilityTokens.some(function (token) {
      return advisoryCrop.includes(token) || token.includes(advisoryCrop);
    });
  }).sort(function (left, right) {
    if (preferredLanguage) {
      const leftMatches = clean(left.language).toLowerCase() === preferredLanguage;
      const rightMatches = clean(right.language).toLowerCase() === preferredLanguage;
      if (leftMatches !== rightMatches) return rightMatches ? 1 : -1;
    }
    const leftDate = parseDate(left.updatedOn || left.date);
    const rightDate = parseDate(right.updatedOn || right.date);
    return (rightDate ? rightDate.getTime() : 0) - (leftDate ? leftDate.getTime() : 0);
  });
}

function searchAdvisories(advisories, query) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  return (advisories || []).map(function (advisory) {
    const title = clean(advisory.title).toLowerCase();
    const text = [
      advisory.title,
      advisory.message,
      advisory.crop,
      advisory.weatherType,
      advisory.source,
      advisory.district
    ].join(" ").toLowerCase();
    const score = tokens.reduce(function (total, token) {
      if (title.includes(token)) return total + 4;
      return text.includes(token) ? total + 1 : total;
    }, 0);
    return { advisory: advisory, score: score };
  }).filter(function (entry) {
    return entry.score > 0;
  }).sort(function (left, right) {
    return right.score - left.score;
  }).map(function (entry) {
    return entry.advisory;
  });
}

function buildSchemeSearchRows(schemes, advisories, language) {
  const rows = buildSchemeListRows(schemes, language).slice(0, 7);
  const remaining = Math.max(0, 10 - rows.length);
  return rows.concat((advisories || []).slice(0, remaining).map(function (advisory) {
    return {
      id: SCHEME_DYNAMIC_PREFIXES.ADVISORY_VIEW + advisory.id,
      title: truncate(advisory.title, 24),
      description: truncate([
        advisory.crop,
        advisory.district,
        advisory.source
      ].filter(Boolean).join(" • "), 72)
    };
  }));
}

function buildAdvisoryText(advisories, language) {
  const ml = clean(language).toLowerCase() === "malayalam";
  const lines = [ml ? "📢 നിലവിലെ കാർഷിക അറിയിപ്പുകൾ" : "📢 Current Agricultural Advisories"];
  (advisories || []).slice(0, 5).forEach(function (advisory, index) {
    lines.push(
      "",
      String(index + 1) + ". " + advisory.title,
      advisory.message,
      (ml ? "തീയതി: " : "Date: ") + (formatStoredDate(advisory.date) || "-"),
      (ml ? "ഉറവിടം: " : "Source: ") + (advisory.source || (ml ? "ലഭ്യമല്ല" : "Not provided"))
    );
  });
  lines.push(
    "",
    ml
      ? "ഇവ ലഭ്യമായ ഔദ്യോഗിക/അംഗീകൃത രേഖകളിൽ നിന്നുള്ള സംക്ഷിപ്ത വിവരങ്ങളാണ്. പ്രാദേശിക സാഹചര്യങ്ങൾക്കായി KVK അല്ലെങ്കിൽ കൃഷിഭവനുമായി പരിശോധിക്കുക."
      : "These are concise records from the available official/approved source. Confirm locally with KVK or Krishi Bhavan when conditions differ."
  );
  return truncate(lines.join("\n"), 1000);
}

module.exports = {
  ADVISORY_SHEET,
  SCHEME_ACTION_IDS,
  SCHEME_ANIMAL_SHEET,
  SCHEME_CATALOG_SHEET,
  SCHEME_DYNAMIC_PREFIXES,
  SCHEME_LAND_SHEET,
  SCHEME_REQUEST_SHEET,
  activeSchemes,
  buildAdvisoryText,
  buildSchemeDetails,
  buildSchemeListRows,
  buildSchemeSearchRows,
  buildFarmerSchemeProfile,
  currentAdvisories,
  filterSchemesByCategory,
  filterSchemesByGovernment,
  findAdvisory,
  findScheme,
  isActiveScheme,
  parseSchemeAction,
  readAdvisories,
  readSchemeInterests,
  schemeVerificationState,
  schemeVerificationText,
  readSchemes,
  relevantSchemes,
  safeOfficialLink,
  saveSchemeInterest,
  schemeFreshnessText,
  schemeRequestId,
  searchAdvisories,
  searchSchemes
};
