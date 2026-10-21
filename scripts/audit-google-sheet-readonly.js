"use strict";

/*
 * BhoomiMitra live Google Spreadsheet audit.
 *
 * This program is intentionally standalone and read-only. It does not import
 * the BhoomiMitra application or any application module. It reports schema and
 * integrity findings without emitting credentials, personal data, free text,
 * or complete worksheet rows.
 */

require("dotenv").config();

const crypto = require("crypto");
const { google } = require("googleapis");

const READONLY_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly";

const MAX_ISSUE_SAMPLES = 10;
const MAX_RANGES_PER_REQUEST = 20;

const SENSITIVE_HEADER_PATTERN =
  /(name|phone|mobile|whatsapp|email|address|query|question|problem|diagnos|remark|advice|response|message|conversation|summary|photo|image)/i;

function fields() {
  return Array.prototype.slice.call(arguments).map(function (item) {
    return Array.isArray(item) ? item : [item];
  });
}

function positions(headers) {
  const result = {};
  (headers || []).forEach(function (header, index) {
    result[index] = [header];
  });
  return result;
}

const TAB_SCHEMAS = {
  Farmers: {
    idAliases: ["Farmer_ID", "Farmer ID", "BM_ID", "Member_ID"],
    idPrefix: "BM-",
    required: fields(
      ["Farmer_ID", "Farmer ID", "BM_ID", "Member_ID"],
      ["Name", "Farmer Name", "Full Name"],
      ["Mobile", "Mobile No", "Mobile_No", "WhatsApp", "WhatsApp No", "WhatsApp_No"]
    )
  },
  Master_Member_Registry: {
    idAliases: ["BM_ID", "Member_ID", "Farmer_ID", "Farmer ID"],
    required: fields(
      ["BM_ID", "Member_ID", "Farmer_ID", "Farmer ID"],
      ["Name", "Farmer Name", "Full Name"]
    )
  },
  Expert_Directory: {
    idAliases: ["Expert_ID", "Expert ID"],
    idPrefix: "BM-EX-",
    required: fields(
      ["Expert_ID", "Expert ID"],
      ["Name", "Expert Name"],
      ["Mobile_No", "Mobile No", "Mobile"],
      ["WhatsApp_No", "WhatsApp No", "WhatsApp"],
      ["Specialization", "Expert_Group", "Expert Group"]
    ),
    expectedPositions: {
      0: ["Expert_ID", "Expert ID"],
      1: ["Name", "Expert Name"],
      3: ["Mobile_No", "Mobile No", "Mobile"],
      4: ["WhatsApp_No", "WhatsApp No", "WhatsApp"],
      9: ["District"],
      10: ["Organization"],
      11: ["Department"],
      12: ["Designation"],
      16: ["Expert_Group", "Expert Group"],
      17: ["Specialization"],
      25: ["Availability"],
      26: ["Auto_Route", "Auto Route"],
      27: ["Status"],
      30: ["Verification_Status", "Verification Status"],
      32: ["Active_Status", "Active Status"],
      34: ["Total_Consultations", "Total Consultations"],
      35: ["Average_Rating", "Average Rating"],
      36: ["Farmers_Assigned", "Farmers Assigned", "Open_Cases", "Open Cases"],
      37: ["AI_Priority", "AI Priority"]
    }
  },
  "Skilled Workers": {
    idAliases: ["Worker_ID", "Worker ID"],
    idPrefix: "BM-SW-",
    required: fields(
      ["Worker_ID", "Worker ID"],
      ["Name", "Worker Name"],
      ["Skill Category", "Skill_Category", "Sub Skill", "Worker Type"]
    )
  },
  "Workforce Providers": {
    idAliases: ["Provider_ID", "Provider ID", "ID"],
    idPrefix: "BM-SP-",
    required: fields(
      ["Provider_ID", "Provider ID", "ID"],
      ["Provider Name", "Contact Person", "Name"],
      ["Service Category", "Service Name", "Service name", "Provider Type"]
    )
  },
  Expert_Cases: {
    idAliases: ["Case_ID", "Case ID", "CaseID"],
    idPrefix: "BM-",
    required: fields(
      ["Case_ID", "Case ID", "CaseID"],
      ["WhatsApp", "Farmer_WhatsApp", "Farmer WhatsApp"],
      ["Status"]
    ),
    expectedPositions: {
      0: ["Case_ID", "Case ID", "CaseID"],
      3: ["WhatsApp", "Farmer_WhatsApp", "Farmer WhatsApp"]
    }
  },
  Weather_Data: {
    required: fields(["District"], ["Date"], ["Temperature", "Max Temperature", "Maximum Temperature"]),
    expectedPositions: {
      2: ["District"],
      3: ["Date", "Observation_Date", "Observation Date"],
      4: ["Time", "Maximum_Temperature", "Maximum Temperature", "Max Temperature"],
      5: ["Temperature", "Minimum_Temperature", "Minimum Temperature", "Min Temperature"]
    }
  },
  Weather_Forecast: {
    required: fields(
      ["District"],
      ["Date", "Forecast_Date", "Forecast Date"],
      ["Maximum_Temperature", "Maximum Temperature", "Max Temperature"],
      ["Minimum_Temperature", "Minimum Temperature", "Min Temperature"]
    )
  },
  Land_Parcels: {
    idAliases: ["Land_ID", "Land ID"],
    idPrefix: "BM-L-",
    required: fields(
      ["Land_ID", "Land ID"],
      ["Farmer_ID", "Farmer ID"],
      ["Farm_Name", "Farm Name", "Land_Name", "Land Name"]
    ),
    expectedPositions: { 0: ["Land_ID", "Land ID"] }
  },
  Land_Boundary_Points: {
    idAliases: ["Boundary_Point_ID", "Boundary Point ID"],
    idPrefix: "BM-BP-",
    required: fields(
      ["Boundary_Point_ID", "Boundary Point ID"],
      ["Land_ID", "Land ID"],
      ["Boundary_Session_ID", "Boundary Session ID"],
      ["Point_No", "Point No"],
      ["Latitude"],
      ["Longitude"]
    )
  },
  Land_Access: {
    idAliases: ["Access_ID", "Access ID"],
    idPrefix: "ACC-",
    expectedPositions: {
      0: ["Access_ID", "Access ID"],
      1: ["Land_ID", "Land ID"],
      2: ["Owner_Farmer_ID", "Owner Farmer ID"],
      3: ["Owner_WhatsApp", "Owner WhatsApp"],
      4: ["Authorized_Name", "Authorized Name"],
      5: ["Authorized_WhatsApp", "Authorized WhatsApp"],
      6: ["Relationship"],
      7: ["Access_Level", "Access Level"],
      8: ["Status"],
      9: ["Granted_At", "Granted At"],
      10: ["Granted_By", "Granted By"],
      11: ["Revoked_At", "Revoked At"],
      12: ["Remarks"]
    }
  },
  Animal_Registry: {
    idAliases: ["Animal_ID", "Animal ID"],
    idPrefix: "BM-A-",
    required: fields(
      ["Animal_ID", "Animal ID"],
      ["Farmer_ID", "Farmer ID"],
      ["Animal_Type", "Animal Type"]
    ),
    expectedPositions: { 0: ["Animal_ID", "Animal ID"] }
  },
  Crop_Registry: {
    idAliases: ["Crop_ID", "Crop ID"],
    idPrefix: "BM-C-",
    required: fields(
      ["Crop_ID", "Crop ID"],
      ["Farmer_ID", "Farmer ID"],
      ["Land_ID", "Land ID"],
      ["Crop_Name", "Crop Name"]
    ),
    expectedPositions: { 0: ["Crop_ID", "Crop ID"] }
  },
  Government_Schemes: {
    idAliases: ["Scheme_ID", "Scheme ID"],
    required: fields(
      ["Scheme_ID", "Scheme ID"],
      ["Scheme_Name", "Scheme Name"],
      ["Government", "Government_Level", "Scheme_Level"],
      ["Category", "Scheme_Category"],
      ["Status", "Active_Status"],
      ["Source", "Official_Source"],
      ["Official_URL", "Official_Link", "Application_Link"],
      ["Last_Checked", "Last_Updated", "Updated_On"]
    )
  },
  Training_Requests: {
    idAliases: ["Request_ID", "Request ID"],
    idPrefix: "BM-TRQ-",
    required: fields(
      ["Request_ID", "Request ID"],
      ["Farmer_ID", "Farmer ID"],
      ["Mobile_No", "Mobile No", "WhatsApp"],
      ["Farmer_Name", "Farmer Name"],
      ["District"],
      ["Training_Category", "Training Category"],
      ["Training_Topic", "Training Topic"],
      ["Preferred_Mode", "Preferred Mode"],
      ["Preferred_Time", "Preferred Time"],
      ["Preferred_Location", "Preferred Location"],
      ["Preferred_Date", "Preferred Date"],
      ["Request_Status", "Request Status"],
      ["Assigned_Coordinator", "Assigned Coordinator"],
      ["Overall_Coordinator", "Overall Coordinator"],
      ["Training_Coordinator", "Training Coordinator"],
      ["Created_At", "Created At"]
    )
  },
  Satellite_Observations: {
    idAliases: ["Observation_ID", "Observation ID"],
    idPrefix: "SAT-",
    expectedPositions: {
      0: ["Observation_ID", "Observation ID"],
      1: ["Land_ID", "Land ID"],
      2: ["Farmer_ID", "Farmer ID"],
      3: ["Farm_Name", "Farm Name"],
      4: ["Observation_Date", "Observation Date"],
      5: ["Satellite_Source", "Satellite Source"],
      6: ["NDVI"],
      7: ["Vegetation_Status", "Vegetation Status"],
      8: ["Moisture_Status", "Moisture Status"],
      9: ["Waterlogging_Status", "Waterlogging Status"],
      10: ["Stress_Status", "Stress Status"],
      11: ["Cloud_Cover", "Cloud Cover"],
      12: ["Area_SqM", "Area SqM"],
      13: ["Area_Cent", "Area Cent"],
      14: ["Area_Acre", "Area Acre"],
      15: ["Perimeter_M", "Perimeter M"],
      16: ["Remarks"],
      17: ["Created_At", "Created At"],
      18: ["Updated_At", "Updated At"]
    }
  },
  User_Consent_Log: {
    idAliases: ["Consent_ID", "Consent ID"],
    idPrefix: "CONSENT-",
    expectedPositions: {
      0: ["Consent_ID", "Consent ID"],
      1: ["WhatsApp", "WhatsApp_No", "WhatsApp No"],
      2: ["Farmer_ID", "Farmer ID"],
      3: ["Agreement_Version", "Agreement Version"],
      4: ["Privacy_Policy_Version", "Privacy Policy Version"],
      5: ["Consent_Status", "Consent Status"],
      6: ["Consent_Date", "Consent Date"],
      7: ["Withdrawal_Date", "Withdrawal Date"],
      8: ["Source"],
      9: ["Policy_Language", "Policy Language"],
      10: ["Remarks"],
      11: ["Created_At", "Created At"],
      12: ["Updated_At", "Updated At"]
    }
  },
  Commodity_Master: {
    idAliases: ["Commodity_ID", "Commodity ID"],
    required: fields(
      ["Commodity_ID", "Commodity ID"],
      ["BhoomiMitra_Name", "BhoomiMitra Name"],
      ["AGMARKNET_Name", "AGMARKNET Name"]
    )
  },
  Commodity_Market: {
    idAliases: ["Commodity_ID", "Commodity ID"],
    required: fields(
      ["Commodity_ID", "Commodity ID"],
      ["Commodity_Name", "Commodity Name", "Commodity"],
      ["Market", "Market_Name", "Market Name"],
      ["Modal_Price", "Modal Price", "Current_Price", "Current Price"],
      ["Source_Name", "Source Name", "Primary_Source", "Primary Source"]
    )
  },
  Soil_Location_Profile: {
    idAliases: ["Soil_Profile_ID", "Profile_ID", "Profile ID"],
    expectedPositions: positions([
      "Soil_Profile_ID", "Date_Time", "Farmer_ID", "Field_ID", "WhatsApp_No",
      "Latitude", "Longitude", "District", "Block", "Panchayat", "Village",
      "Survey_Number", "Elevation_m", "Slope_Percent", "Slope_Class", "Land_Use",
      "Soil_Texture", "Predicted_pH", "pH_Class", "Organic_Carbon_g_kg",
      "Total_Nitrogen_g_kg", "Clay_Percent", "Sand_Percent", "Silt_Percent",
      "CEC_cmol_kg", "Bulk_Density", "Coarse_Fragments", "Drainage_Class",
      "Erosion_Risk", "Data_Source", "Source_Version", "Source_Date",
      "Confidence_Level", "Advisory_Status", "Created_On", "Last_Updated", "Remarks"
    ])
  },
  AI_Conversation_History: {
    expectedPositions: positions([
      "Conversation_ID", "Session_ID", "User_ID", "Farmer_ID", "WhatsApp_No",
      "Date_Time", "Language", "Question", "Intent", "Crop", "Variety",
      "Growth_Stage", "Livestock", "Fishery", "State", "District", "Block",
      "Panchayat", "Village", "Latitude", "Longitude", "Weather_Event",
      "Weather_Condition", "Weather_Source", "Temperature_C", "Humidity_Percent",
      "Rainfall_mm", "Soil_Type", "AI_Response", "Expert_Correction",
      "Final_Response", "Action_Taken", "Source_Institute", "Reference_Document",
      "Reference_Link", "AI_Confidence", "Escalated_To_Expert", "Expert_Name",
      "Response_Time_Seconds", "User_Feedback", "Feedback_Rating",
      "Conversation_Status", "Created_On", "Last_Updated", "Remarks"
    ])
  },
  AI_Response_Log: {
    expectedPositions: positions([
      "Log_ID", "DateTime", "Phone", "Member_ID", "Member_Name", "Language",
      "Farmer_Message", "AI_Reply", "Source", "Knowledge_Source",
      "Confidence_Score", "AI_Model", "Response_Time_ms", "Escalated",
      "Assigned_Expert", "Followup_Needed", "Feedback_Rating", "Conversation_ID",
      "WhatsApp_Message_ID", "Created_On", "Updated_On"
    ])
  },
  Farmer_Queries: {
    expectedPositions: positions([
      "Query_ID", "Date", "Farmer_ID", "Farmer_Name", "Category", "Question",
      "Answer", "Answered_By", "Status", "Remarks"
    ])
  },
  AI_Memory: {},
  Soil_Test_Repository: {},
  Soil_Recommendation_Rules: {},
  Soil_Data_Log: {},
  BM_Setting: {
    idAliases: ["Setting_Key", "Setting Key", "Key", "Name"]
  }
};

const EXPECTED_TAB_NAMES = Object.keys(TAB_SCHEMAS);

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeHeader(value) {
  return clean(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeIdentifier(value) {
  return clean(value).toUpperCase();
}

function normalizePhone(value) {
  const digits = clean(value).replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function isBlank(value) {
  return clean(value) === "";
}

function rowHasData(row) {
  return Array.isArray(row) && row.some(function (value) {
    return !isBlank(value);
  });
}

function maskedIdentifier(value) {
  const normalized = normalizeIdentifier(value);
  if (!normalized) return "[blank]";
  return "sha256:" + crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 12);
}

function limitSamples(items) {
  return items.slice(0, MAX_ISSUE_SAMPLES);
}

function columnLetter(columnNumber) {
  let value = Math.max(1, Number(columnNumber) || 1);
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function quoteTabTitle(title) {
  return "'" + String(title).replace(/'/g, "''") + "'";
}

function findHeaderIndex(headers, aliases) {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases || []) {
    const index = normalized.indexOf(normalizeHeader(alias));
    if (index >= 0) return index;
  }
  return -1;
}

function getHeaderMap(headers) {
  const result = {};
  headers.forEach(function (header, index) {
    const key = normalizeHeader(header);
    if (!key) return;
    if (!result[key]) result[key] = [];
    result[key].push(index);
  });
  return result;
}

function describeHeaders(rows) {
  const width = rows.reduce(function (maximum, row) {
    return Math.max(maximum, Array.isArray(row) ? row.length : 0);
  }, 0);
  const source = Array.isArray(rows[0]) ? rows[0] : [];
  const headers = new Array(width).fill("").map(function (_, index) {
    return clean(source[index]);
  });
  const exactMap = {};
  const normalizedMap = {};
  headers.forEach(function (header, index) {
    if (header) {
      if (!exactMap[header]) exactMap[header] = [];
      exactMap[header].push(index + 1);
    }
    const normalized = normalizeHeader(header);
    if (normalized) {
      if (!normalizedMap[normalized]) normalizedMap[normalized] = [];
      normalizedMap[normalized].push(index + 1);
    }
  });
  return {
    headers,
    positions: headers.map(function (header, index) {
      return { column: columnLetter(index + 1), index, header };
    }),
    blankColumns: headers
      .map(function (header, index) { return header ? null : columnLetter(index + 1); })
      .filter(Boolean),
    duplicateExact: Object.keys(exactMap)
      .filter(function (key) { return exactMap[key].length > 1; })
      .map(function (key) { return { header: key, columns: exactMap[key] }; }),
    duplicateNormalized: Object.keys(normalizedMap)
      .filter(function (key) { return normalizedMap[key].length > 1; })
      .map(function (key) { return { normalizedHeader: key, columns: normalizedMap[key] }; }),
    sensitiveColumns: headers
      .map(function (header, index) {
        return SENSITIVE_HEADER_PATTERN.test(header)
          ? { column: columnLetter(index + 1), header }
          : null;
      })
      .filter(Boolean)
  };
}

function describeRows(rows) {
  const dataRows = rows.slice(1);
  const nonblankRows = [];
  const blankRowsInsideUsedRegion = [];
  let lastNonblankRow = rows.length > 0 && rowHasData(rows[0]) ? 1 : 0;
  dataRows.forEach(function (row, index) {
    const rowNumber = index + 2;
    if (rowHasData(row)) {
      nonblankRows.push({ row, rowNumber });
      lastNonblankRow = rowNumber;
    } else {
      blankRowsInsideUsedRegion.push(rowNumber);
    }
  });
  return {
    returnedRows: rows.length,
    dataRows: dataRows.length,
    nonblankDataRows: nonblankRows.length,
    blankRowsInsideUsedRegion: limitSamples(
      blankRowsInsideUsedRegion.filter(function (rowNumber) {
        return rowNumber < lastNonblankRow;
      })
    ),
    lastNonblankRow,
    nonblankRows
  };
}

function auditIdentifier(headers, rowDescription, schema) {
  const aliases = schema.idAliases || [];
  let idIndex = findHeaderIndex(headers, aliases);
  let inferred = false;

  if (idIndex < 0 && aliases.length === 0) {
    idIndex = headers.findIndex(function (header) {
      const normalized = normalizeHeader(header);
      return normalized === "id" || normalized.endsWith("id");
    });
    inferred = idIndex >= 0;
  }

  if (idIndex < 0) {
    return {
      configuredAliases: aliases,
      found: false,
      inferred: false,
      column: null,
      header: null,
      blankCount: null,
      blankRows: [],
      duplicateCount: null,
      duplicates: []
    };
  }

  const blankRows = [];
  const values = new Map();
  const invalidPrefixRows = [];
  rowDescription.nonblankRows.forEach(function (entry) {
    const raw = entry.row[idIndex];
    const key = normalizeIdentifier(raw);
    if (!key) {
      blankRows.push(entry.rowNumber);
      return;
    }
    if (!values.has(key)) values.set(key, []);
    values.get(key).push(entry.rowNumber);
    if (schema.idPrefix && !key.startsWith(schema.idPrefix.toUpperCase())) {
      invalidPrefixRows.push(entry.rowNumber);
    }
  });

  const duplicates = [];
  values.forEach(function (rowNumbers, key) {
    if (rowNumbers.length > 1) {
      duplicates.push({ identifier: maskedIdentifier(key), rows: rowNumbers });
    }
  });

  return {
    configuredAliases: aliases,
    found: true,
    inferred,
    column: columnLetter(idIndex + 1),
    index: idIndex,
    header: headers[idIndex],
    blankCount: blankRows.length,
    blankRows: limitSamples(blankRows),
    duplicateCount: duplicates.length,
    duplicates: limitSamples(duplicates),
    invalidPrefixCount: invalidPrefixRows.length,
    invalidPrefixRows: limitSamples(invalidPrefixRows)
  };
}

function auditRequiredHeaders(headers, schema) {
  return (schema.required || []).map(function (aliases) {
    const index = findHeaderIndex(headers, aliases);
    return {
      aliases,
      found: index >= 0,
      column: index >= 0 ? columnLetter(index + 1) : null,
      actualHeader: index >= 0 ? headers[index] : null
    };
  });
}

function auditExpectedPositions(headers, schema) {
  return Object.keys(schema.expectedPositions || {}).map(function (key) {
    const index = Number(key);
    const aliases = schema.expectedPositions[key];
    const actual = clean(headers[index]);
    const matches = aliases.some(function (alias) {
      return normalizeHeader(actual) === normalizeHeader(alias);
    });
    return {
      column: columnLetter(index + 1),
      index,
      expectedAliases: aliases,
      actualHeader: actual,
      matches
    };
  });
}

function auditTab(tab, rows) {
  const schema = TAB_SCHEMAS[tab.title] || {};
  const headerDescription = describeHeaders(rows);
  const rowDescription = describeRows(rows);
  return {
    title: tab.title,
    sheetId: tab.sheetId,
    index: tab.index,
    hidden: tab.hidden,
    grid: tab.grid,
    rowCounts: {
      returnedRows: rowDescription.returnedRows,
      dataRows: rowDescription.dataRows,
      nonblankDataRows: rowDescription.nonblankDataRows,
      lastNonblankRow: rowDescription.lastNonblankRow,
      blankRowsInsideUsedRegion: rowDescription.blankRowsInsideUsedRegion
    },
    headers: headerDescription.positions,
    blankHeaderColumns: headerDescription.blankColumns,
    duplicateExactHeaders: headerDescription.duplicateExact,
    duplicateNormalizedHeaders: headerDescription.duplicateNormalized,
    sensitiveColumns: headerDescription.sensitiveColumns,
    requiredHeaders: auditRequiredHeaders(headerDescription.headers, schema),
    expectedColumnPositions: auditExpectedPositions(headerDescription.headers, schema),
    identifier: auditIdentifier(headerDescription.headers, rowDescription, schema),
    _headers: headerDescription.headers,
    _nonblankRows: rowDescription.nonblankRows
  };
}

function createLookup(audits) {
  const lookup = {};
  audits.forEach(function (audit) {
    lookup[audit.title] = audit;
  });
  return lookup;
}

function columnValues(audit, aliases, normalizer) {
  if (!audit) return [];
  const index = findHeaderIndex(audit._headers, aliases);
  if (index < 0) return [];
  return audit._nonblankRows
    .map(function (entry) {
      const value = (normalizer || normalizeIdentifier)(entry.row[index]);
      return value ? { value, rowNumber: entry.rowNumber } : null;
    })
    .filter(Boolean);
}

function valueSet(entries) {
  return new Set(entries.map(function (entry) { return entry.value; }));
}

function differenceDetails(sourceEntries, targetSet) {
  const missing = sourceEntries.filter(function (entry) {
    return !targetSet.has(entry.value);
  });
  return {
    count: missing.length,
    samples: limitSamples(missing.map(function (entry) {
      return { identifier: maskedIdentifier(entry.value), row: entry.rowNumber };
    }))
  };
}

function compareMemberTabs(lookup) {
  const master = lookup.Master_Member_Registry;
  const farmers = lookup.Farmers;
  if (!master || !farmers) {
    return {
      comparable: false,
      masterPresent: Boolean(master),
      farmersPresent: Boolean(farmers)
    };
  }

  const masterIds = columnValues(master, TAB_SCHEMAS.Master_Member_Registry.idAliases);
  const farmerIds = columnValues(farmers, TAB_SCHEMAS.Farmers.idAliases);
  const masterPhones = columnValues(
    master,
    ["WhatsApp", "WhatsApp No", "WhatsApp_No", "Mobile", "Mobile No", "Mobile_No"],
    normalizePhone
  );
  const farmerPhones = columnValues(
    farmers,
    ["WhatsApp", "WhatsApp No", "WhatsApp_No", "Mobile", "Mobile No", "Mobile_No"],
    normalizePhone
  );

  const masterIdSet = valueSet(masterIds);
  const farmerIdSet = valueSet(farmerIds);
  const masterPhoneSet = valueSet(masterPhones);
  const farmerPhoneSet = valueSet(farmerPhones);

  return {
    comparable: true,
    masterRows: master.rowCounts.nonblankDataRows,
    farmerRows: farmers.rowCounts.nonblankDataRows,
    sharedIds: Array.from(masterIdSet).filter(function (id) { return farmerIdSet.has(id); }).length,
    masterIdsMissingFromFarmers: differenceDetails(masterIds, farmerIdSet),
    farmerIdsMissingFromMaster: differenceDetails(farmerIds, masterIdSet),
    sharedNormalizedPhones: Array.from(masterPhoneSet).filter(function (phone) {
      return farmerPhoneSet.has(phone);
    }).length,
    masterPhonesMissingFromFarmers: differenceDetails(masterPhones, farmerPhoneSet),
    farmerPhonesMissingFromMaster: differenceDetails(farmerPhones, masterPhoneSet)
  };
}

function auditExpertCases(audit) {
  if (!audit) return { present: false };
  const widths = {};
  const statusIndex = findHeaderIndex(audit._headers, ["Status"]);
  const whatsappIndex = findHeaderIndex(
    audit._headers,
    ["WhatsApp", "Farmer_WhatsApp", "Farmer WhatsApp"]
  );
  const sourceMessageIndex = findHeaderIndex(
    audit._headers,
    ["Source_Message_ID", "Source Message ID"]
  );
  const compatibleStatuses = new Set([
    "pending expert notification", "assigned", "expert replied",
    "farmer follow-up", "closed", "cancelled", "resolved"
  ]);
  const exclusions = {
    missingOrMisalignedWhatsApp: 0,
    missingOrMisalignedSourceMessageId: 0,
    unknownOrMisalignedStatus: 0
  };
  let compatibleCurrentRows = 0;

  audit._nonblankRows.forEach(function (entry) {
    const width = entry.row.length;
    widths[width] = (widths[width] || 0) + 1;

    const hasWhatsApp = whatsappIndex >= 0 && clean(entry.row[whatsappIndex]);
    const hasSourceMessage =
      sourceMessageIndex >= 0 && clean(entry.row[sourceMessageIndex]);
    const hasCompatibleStatus = statusIndex >= 0 && compatibleStatuses.has(
      clean(entry.row[statusIndex]).toLowerCase()
    );

    if (!hasWhatsApp) exclusions.missingOrMisalignedWhatsApp += 1;
    if (!hasSourceMessage) exclusions.missingOrMisalignedSourceMessageId += 1;
    if (!hasCompatibleStatus) exclusions.unknownOrMisalignedStatus += 1;
    if (hasWhatsApp && hasSourceMessage && hasCompatibleStatus) {
      compatibleCurrentRows += 1;
    }
  });
  const headerN = clean(audit._headers[13]);
  return {
    present: true,
    columnNHeader: headerN,
    columnNLooksLikeExpertWhatsApp: /expert.*(whatsapp|phone|mobile)|(whatsapp|phone|mobile).*expert/i.test(headerN),
    columnNLooksLikeExpertRemark: /remark|advice|recommendation/i.test(headerN),
    columnsSthroughU: [18, 19, 20].map(function (index) {
      return { column: columnLetter(index + 1), header: clean(audit._headers[index]) };
    }),
    dataRowWidthDistribution: widths,
    rowsWithAtLeast18Columns: audit._nonblankRows.filter(function (entry) { return entry.row.length >= 18; }).length,
    rowsWithAtLeast21Columns: audit._nonblankRows.filter(function (entry) { return entry.row.length >= 21; }).length,
    compatibleCurrentRows,
    excludedLegacyOrAmbiguousRows:
      audit._nonblankRows.length - compatibleCurrentRows,
    exclusionReasonCounts: exclusions
  };
}

function compositeDuplicateAudit(audit, aliasGroups) {
  if (!audit) return { present: false };
  const indexes = aliasGroups.map(function (aliases) {
    return findHeaderIndex(audit._headers, aliases);
  });
  if (indexes.some(function (index) { return index < 0; })) {
    return { present: true, comparable: false, missingComponent: true };
  }
  const map = new Map();
  audit._nonblankRows.forEach(function (entry) {
    const key = indexes.map(function (index) {
      return normalizeIdentifier(entry.row[index]);
    }).join("|");
    if (!key.replace(/\|/g, "")) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry.rowNumber);
  });
  const duplicates = [];
  map.forEach(function (rows, key) {
    if (rows.length > 1) duplicates.push({ key: maskedIdentifier(key), rows });
  });
  return {
    present: true,
    comparable: true,
    duplicateGroupCount: duplicates.length,
    duplicates: limitSamples(duplicates)
  };
}

function auditWeather(lookup) {
  const current = lookup.Weather_Data;
  const forecast = lookup.Weather_Forecast;
  return {
    weatherDataPresent: Boolean(current),
    weatherForecastPresent: Boolean(forecast),
    weatherDataColumnsCtoP: current
      ? current._headers.slice(2, 16).map(function (header, offset) {
          return { column: columnLetter(offset + 3), header };
        })
      : [],
    weatherForecastColumns: forecast ? forecast.headers : [],
    weatherDataDuplicateDistrictDateTime: compositeDuplicateAudit(current, [
      ["District"],
      ["Date", "Observation_Date", "Observation Date"],
      ["Time", "Observation_Time", "Observation Time"]
    ]),
    weatherForecastDuplicateDistrictDate: compositeDuplicateAudit(forecast, [
      ["District"],
      ["Date", "Forecast_Date", "Forecast Date"]
    ]),
    sourceCodeRisk:
      "Current application forecast logic reads Weather_Data even though Weather_Forecast is declared."
  };
}

function relationAudit(lookup, sourceTab, sourceAliases, targetTab, targetAliases) {
  const source = lookup[sourceTab];
  const target = lookup[targetTab];
  if (!source || !target) {
    return { sourceTab, targetTab, comparable: false, sourcePresent: Boolean(source), targetPresent: Boolean(target) };
  }
  const sourceValues = columnValues(source, sourceAliases);
  const targetValues = valueSet(columnValues(target, targetAliases));
  return Object.assign(
    { sourceTab, targetTab, comparable: true, sourceReferenceCount: sourceValues.length },
    { missingTargets: differenceDetails(sourceValues, targetValues) }
  );
}

function auditCrossTabRelations(lookup) {
  return [
    relationAudit(lookup, "Land_Parcels", ["Farmer_ID", "Farmer ID"], "Farmers", TAB_SCHEMAS.Farmers.idAliases),
    relationAudit(lookup, "Crop_Registry", ["Farmer_ID", "Farmer ID"], "Farmers", TAB_SCHEMAS.Farmers.idAliases),
    relationAudit(lookup, "Animal_Registry", ["Farmer_ID", "Farmer ID"], "Farmers", TAB_SCHEMAS.Farmers.idAliases),
    relationAudit(lookup, "Training_Requests", ["Farmer_ID", "Farmer ID"], "Farmers", TAB_SCHEMAS.Farmers.idAliases),
    relationAudit(lookup, "User_Consent_Log", ["Farmer_ID", "Farmer ID"], "Farmers", TAB_SCHEMAS.Farmers.idAliases),
    relationAudit(lookup, "Land_Boundary_Points", ["Land_ID", "Land ID"], "Land_Parcels", TAB_SCHEMAS.Land_Parcels.idAliases),
    relationAudit(lookup, "Land_Access", ["Land_ID", "Land ID"], "Land_Parcels", TAB_SCHEMAS.Land_Parcels.idAliases),
    relationAudit(lookup, "Satellite_Observations", ["Land_ID", "Land ID"], "Land_Parcels", TAB_SCHEMAS.Land_Parcels.idAliases),
    relationAudit(lookup, "Expert_Cases", ["Assigned_Expert_ID", "Assigned Expert ID", "Expert_ID", "Expert ID"], "Expert_Directory", TAB_SCHEMAS.Expert_Directory.idAliases),
    relationAudit(lookup, "Commodity_Market", ["Commodity_Name", "Commodity Name", "Commodity"], "Commodity_Master", ["BhoomiMitra_Name", "BhoomiMitra Name", "AGMARKNET_Name", "AGMARKNET Name"])
  ];
}

function stripPrivateData(audit) {
  const copy = Object.assign({}, audit);
  delete copy._headers;
  delete copy._nonblankRows;
  return copy;
}

function safeErrorMessage(error, secretValues) {
  let message = clean(error && error.message ? error.message : "Google Sheets audit failed.");
  secretValues.filter(Boolean).forEach(function (secret) {
    message = message.split(secret).join("[REDACTED]");
  });
  message = message.replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g, "[REDACTED PRIVATE KEY]");
  return message.slice(0, 500);
}

function loadConfiguration() {
  const spreadsheetId = clean(process.env.GOOGLE_SHEET_ID);
  const clientEmail = clean(process.env.GOOGLE_CLIENT_EMAIL);
  const privateKey = String(process.env.GOOGLE_PRIVATE_KEY || "")
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n")
    .trim();
  const missing = [];
  if (!spreadsheetId) missing.push("GOOGLE_SHEET_ID");
  if (!clientEmail) missing.push("GOOGLE_CLIENT_EMAIL");
  if (!privateKey) missing.push("GOOGLE_PRIVATE_KEY");
  if (missing.length) {
    throw new Error("Missing required environment variables: " + missing.join(", "));
  }
  return { spreadsheetId, clientEmail, privateKey };
}

async function readWorkbook(sheets, spreadsheetId) {
  const metadataResponse = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
    fields:
      "properties(title),sheets(properties(sheetId,title,index,hidden,gridProperties(rowCount,columnCount,frozenRowCount,frozenColumnCount)))"
  });

  const workbookTitle = clean(metadataResponse.data && metadataResponse.data.properties
    ? metadataResponse.data.properties.title
    : "");
  const tabs = ((metadataResponse.data && metadataResponse.data.sheets) || []).map(function (sheet) {
    const properties = sheet.properties || {};
    const grid = properties.gridProperties || {};
    return {
      title: properties.title,
      sheetId: properties.sheetId,
      index: properties.index,
      hidden: Boolean(properties.hidden),
      grid: {
        rowCapacity: grid.rowCount || 0,
        columnCapacity: grid.columnCount || 0,
        frozenRows: grid.frozenRowCount || 0,
        frozenColumns: grid.frozenColumnCount || 0
      }
    };
  });

  const rowsByTab = {};
  for (let offset = 0; offset < tabs.length; offset += MAX_RANGES_PER_REQUEST) {
    const chunk = tabs.slice(offset, offset + MAX_RANGES_PER_REQUEST);
    const ranges = chunk.map(function (tab) {
      const lastColumn = columnLetter(Math.max(1, tab.grid.columnCapacity));
      return quoteTabTitle(tab.title) + "!A:" + lastColumn;
    });
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges,
      majorDimension: "ROWS",
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING"
    });
    const valueRanges = (response.data && response.data.valueRanges) || [];
    chunk.forEach(function (tab, index) {
      rowsByTab[tab.title] = Array.isArray(valueRanges[index] && valueRanges[index].values)
        ? valueRanges[index].values
        : [];
    });
  }

  return { workbookTitle, tabs, rowsByTab };
}

async function main() {
  const configuration = loadConfiguration();
  const auth = new google.auth.JWT({
    email: configuration.clientEmail,
    key: configuration.privateKey,
    scopes: [READONLY_SCOPE]
  });
  const sheets = google.sheets({ version: "v4", auth });

  const workbook = await readWorkbook(sheets, configuration.spreadsheetId);
  const audits = workbook.tabs.map(function (tab) {
    return auditTab(tab, workbook.rowsByTab[tab.title] || []);
  });
  const lookup = createLookup(audits);
  const actualTitles = new Set(workbook.tabs.map(function (tab) { return tab.title; }));
  const normalizedTitles = {};
  workbook.tabs.forEach(function (tab) {
    const normalized = normalizeHeader(tab.title);
    if (!normalizedTitles[normalized]) normalizedTitles[normalized] = [];
    normalizedTitles[normalized].push(tab.title);
  });

  const report = {
    auditMode: "READ_ONLY",
    googleScope: READONLY_SCOPE,
    privacy:
      "No credentials, personal field values, free text, or complete rows are included.",
    workbook: {
      title: workbook.workbookTitle,
      tabCount: workbook.tabs.length
    },
    tabInventory: workbook.tabs,
    missingReferencedTabs: EXPECTED_TAB_NAMES.filter(function (title) {
      return !actualTitles.has(title);
    }),
    additionalTabs: workbook.tabs
      .map(function (tab) { return tab.title; })
      .filter(function (title) { return !EXPECTED_TAB_NAMES.includes(title); }),
    normalizedTitleCollisions: Object.keys(normalizedTitles)
      .filter(function (key) { return normalizedTitles[key].length > 1; })
      .map(function (key) { return { normalizedTitle: key, titles: normalizedTitles[key] }; }),
    tabs: audits.map(stripPrivateData),
    memberRegistryComparison: compareMemberTabs(lookup),
    expertCasesSchema: auditExpertCases(lookup.Expert_Cases),
    weatherSchemas: auditWeather(lookup),
    commodityMarketCompositeDuplicates: compositeDuplicateAudit(lookup.Commodity_Market, [
      ["Commodity_Name", "Commodity Name", "Commodity"],
      ["Variety"],
      ["Market", "Market_Name", "Market Name"],
      ["Source_Name", "Source Name", "Primary_Source", "Primary Source"],
      ["Source_Published_Date", "Source Published Date", "Price_Date", "Price Date", "Date"],
      ["Modal_Price", "Modal Price", "Current_Price", "Current Price"]
    ]),
    boundaryPointCompositeDuplicates: compositeDuplicateAudit(lookup.Land_Boundary_Points, [
      ["Boundary_Session_ID", "Boundary Session ID"],
      ["Point_No", "Point No"]
    ]),
    crossTabRelations: auditCrossTabRelations(lookup)
  };

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

main().catch(function (error) {
  const secrets = [
    process.env.GOOGLE_SHEET_ID,
    process.env.GOOGLE_CLIENT_EMAIL,
    process.env.GOOGLE_PRIVATE_KEY
  ];
  process.stderr.write(
    JSON.stringify({
      auditMode: "READ_ONLY",
      success: false,
      error: safeErrorMessage(error, secrets)
    }, null, 2) + "\n"
  );
  process.exitCode = 1;
});
