"use strict";
const { safeErrorDetails } = require("./webhookSecurity");

const SHEET_NAME = "Land_Parcels";

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
   .replace(/^_+|_+$/g, "");
}

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function safeSheetValue(value) {
  const text = clean(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function columnName(index) {
  let value = Number(index) + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function parseLandUpdateDetails(text) {
  const parts = clean(text).split("|").map(clean);
  if (parts.length !== 3) {
    return { success: false, code: "DETAILS_REQUIRED" };
  }

  const values = parts.map(function (part) {
    return part === "-" ? "" : part;
  });

  if (!values.some(Boolean)) {
    return { success: false, code: "NO_CHANGES" };
  }
  if (values[0] && (values[0].length < 2 || values[0].length > 80)) {
    return { success: false, code: "INVALID_FARM_NAME" };
  }
  if (values[1] && (values[1].length < 2 || values[1].length > 120)) {
    return { success: false, code: "INVALID_MAIN_CROP" };
  }
  if (values[2] && values[2].length > 200) {
    return { success: false, code: "INVALID_OTHER_CROPS" };
  }

  return {
    success: true,
    updates: {
      farmName: values[0] || null,
      mainCrop: values[1] || null,
      otherCrops: values[2] || null
    }
  };
}

function uniqueHeaderIndex(headers, aliases) {
  for (const alias of aliases || []) {
    const wanted = normalizeHeader(alias);
    const matches = [];
    (headers || []).forEach(function (header, index) {
      if (normalizeHeader(header) === wanted) matches.push(index);
    });
    if (matches.length > 1) return -1;
    if (matches.length === 1) return matches[0];
  }
  return -1;
}

async function updateLandDetails(data) {
  try {
    const sheets = data && data.sheets;
    const spreadsheetId = data && data.spreadsheetId;
    const farmerId = clean(data && data.farmerId).toUpperCase();
    const landId = clean(data && data.landId).toUpperCase();
    const updates = (data && data.updates) || {};

    if (!farmerId) return { success: false, code: "FARMER_ID_REQUIRED" };
    if (!landId) return { success: false, code: "LAND_ID_REQUIRED" };
    if (!sheets || !spreadsheetId) {
      return { success: false, code: "SHEETS_CONFIGURATION_MISSING" };
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: SHEET_NAME + "!A:AZ"
    });
    const rows = response && response.data && response.data.values || [];
    if (rows.length < 2) return { success: false, code: "LAND_NOT_FOUND" };

    const headers = rows[0] || [];
    const landIdIndex = uniqueHeaderIndex(headers, ["Land_ID"]);
    const farmerIdIndex = uniqueHeaderIndex(headers, ["Farmer_ID"]);
    if (landIdIndex < 0 || farmerIdIndex < 0) {
      return { success: false, code: "LAND_SCHEMA_UNAVAILABLE" };
    }

    const rowOffset = rows.slice(1).findIndex(function (row) {
      return clean(row[landIdIndex]).toUpperCase() === landId;
    });
    if (rowOffset < 0) return { success: false, code: "LAND_NOT_FOUND" };

    const row = rows[rowOffset + 1] || [];
    if (clean(row[farmerIdIndex]).toUpperCase() !== farmerId) {
      return { success: false, code: "LAND_OWNERSHIP_UNVERIFIED" };
    }

    const statusIndex = uniqueHeaderIndex(headers, ["Active_Status", "Status"]);
    if (statusIndex >= 0 && /inactive|closed|deleted/i.test(clean(row[statusIndex]))) {
      return { success: false, code: "LAND_INACTIVE" };
    }

    const fields = [
      { key: "farmName", aliases: ["Farm_Name", "Land_Name"] },
      { key: "mainCrop", aliases: ["Main_Crop", "Crop"] },
      { key: "otherCrops", aliases: ["Other_Crops", "Intercrops"] }
    ];
    const changes = [];

    for (const field of fields) {
      if (updates[field.key] == null) continue;
      const value = clean(updates[field.key]);
      if (!value) continue;
      const index = uniqueHeaderIndex(headers, field.aliases);
      if (index < 0) {
        return { success: false, code: "LAND_UPDATE_HEADER_MISSING", field: field.key };
      }
      if (clean(row[index]) === value) continue;
      changes.push({ field: field.key, index: index, value: safeSheetValue(value) });
    }

    if (!changes.length) return { success: true, noChanges: true, changedFields: [] };

    const updatedAtIndex = uniqueHeaderIndex(headers, ["Updated_At", "Last_Updated"]);
    if (updatedAtIndex >= 0) {
      changes.push({
        field: "updatedAt",
        index: updatedAtIndex,
        value: new Date(data && data.now || Date.now()).toISOString()
      });
    }

    const rowNumber = rowOffset + 2;
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: changes.map(function (change) {
          return {
            range: SHEET_NAME + "!" + columnName(change.index) + rowNumber,
            values: [[change.value]]
          };
        })
      }
    });

    return {
      success: true,
      noChanges: false,
      changedFields: changes
        .filter(function (change) { return change.field !== "updatedAt"; })
        .map(function (change) { return change.field; })
    };
  } catch (error) {
    console.error("Land update error.", { error: safeErrorDetails(error) });
    return { success: false, code: "LAND_UPDATE_FAILED" };
  }
}
function generateLandId(existingRows) {
  let highestNumber = 0;

  existingRows.forEach(function (row) {
    const existingId =
      String((row && row[0]) || "").trim();

    const match =
      existingId.match(
        /^BM-L-(\d+)$/i
      );

    if (match) {
      highestNumber =
        Math.max(
          highestNumber,
          Number(match[1])
        );
    }
  });

  return (
    "BM-L-" +
    String(highestNumber + 1)
      .padStart(6, "0")
  );
}

async function registerLand(data) {
  try {
    const sheets =
      data && data.sheets;

    const spreadsheetId =
      data && data.spreadsheetId;

    const phone =
      String(
        (data && data.phone) || ""
      ).trim();

    const land =
      (data && data.land) || {};
    const farmerId =
      String(land.farmerId || "").trim();

    if (!farmerId) {
      throw new Error(
        "A verified Farmer_ID is required for land registration."
      );
    }

    if (!sheets || !spreadsheetId) {
      throw new Error(
        "Google Sheets configuration is missing."
      );
    }

    const sheetResponse =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: SHEET_NAME + "!A:AZ"
      });

    const rows =
      sheetResponse.data.values || [];

    if (rows.length === 0) {
      throw new Error(
        "Land_Parcels header row is missing."
      );
    }

    const headers =
      rows[0];
    const normalizedHeaders = headers.map(normalizeHeader);

    if (
      !normalizedHeaders.includes("land_id") ||
      !normalizedHeaders.includes("farmer_id")
    ) {
      throw new Error(
        "Land_Parcels identity headers are missing."
      );
    }

    const existingRows =
      rows.slice(1);

    const landId =
      generateLandId(existingRows);

    const now =
      new Date().toISOString();

    const valuesByHeader = {
      land_id: landId,
      farmer_id:
        farmerId,
      farm_name:
        land.farmName || "",
      district:
        land.district || "",
      taluk:
        land.taluk || "",
      revenue_village:
        land.revenueVillage || "",
      local_body_type:
        land.localBodyType || "",
      local_body:
        land.localBody || "",
      ward:
        land.ward || "",
      locality:
        land.locality || "",
      block_number:
        land.blockNumber || "",
      survey_number:
        land.surveyNumber || "",
      subdivision_number:
        land.subDivisionNumber || "",
      sub_division_number:
        land.subDivisionNumber || "",
      area:
        land.area || "",
      area_unit:
        land.areaUnit || "",
      latitude:
        land.latitude || "",
      longitude:
        land.longitude || "",
      gps_captured:
        land.latitude &&
        land.longitude
          ? "Yes"
          : "No",
      main_crop:
        land.mainCrop || "",
      other_crops:
        land.intercrops || "",
      intercrops:
        land.intercrops || "",
      phone:
        phone,
      mobile_number:
        phone,
      whatsapp_number:
        phone,
      created_at:
        now,
      updated_at:
        now,
      status:
        "Active"
    };

    const newRow =
      headers.map(function (header) {
        const normalized =
          normalizeHeader(header);

        return Object.prototype
          .hasOwnProperty.call(
            valuesByHeader,
            normalized
          )
          ? valuesByHeader[normalized]
          : "";
      });

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: SHEET_NAME + "!A:AZ",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [newRow]
      }
    });

    return {
      success: true,
      landId
    };
  } catch (error) {
    console.error(
      "Land registration error.",
      { error: safeErrorDetails(error) }
    );

    return {
      success: false,
      landId: null,
      error:
        error &&
        error.message
          ? error.message
          : "Unknown land registration error"
    };
  }
}
async function getFarmerLands(data) {
  try {
    const sheets =
      data && data.sheets;

    const spreadsheetId =
      data && data.spreadsheetId;

    const farmerId =
      String(
        (data && data.farmerId) || ""
      ).trim().toUpperCase();

    if (!farmerId) {
      return {
        success: false,
        lands: [],
        code: "FARMER_ID_REQUIRED"
      };
    }

    if (!sheets || !spreadsheetId) {
      throw new Error(
        "Google Sheets configuration is missing."
      );
    }

    const response =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: SHEET_NAME + "!A:AZ"
      });

    const rows =
      response.data.values || [];

    if (rows.length < 2) {
      return {
        success: true,
        lands: []
      };
    }

    const headers =
      rows[0].map(normalizeHeader);

    const farmerIdIndex = headers.indexOf("farmer_id");

    if (farmerIdIndex < 0) {
      return {
        success: false,
        lands: [],
        code: "FARMER_ID_HEADER_MISSING"
      };
    }

    const landIdIndex =
      headers.indexOf("land_id");

    const farmNameIndex =
      headers.indexOf("farm_name");

    const districtIndex =
      headers.indexOf("district");

    const localBodyTypeIndex =
      headers.indexOf("local_body_type");

    const localBodyIndex =
      headers.indexOf("local_body");

   const farmerReportedAreaIndex =
  headers.indexOf("farmer_reported_area");

const revenueRecordAreaIndex =
  headers.indexOf("revenue_record_area");

const gpsCalculatedAreaIndex =
  headers.indexOf("gps_calculated_area");

const areaUnitIndex =
  headers.indexOf("area_unit");

    const mainCropIndex =
      headers.indexOf("main_crop");

    const lands =
      rows
        .slice(1)
        .filter(function (row) {
          return String(row[farmerIdIndex] || "")
            .trim().toUpperCase() === farmerId;
        })
        .map(function (row) {
          return {
            landId:
              row[landIdIndex] || "",
            farmName:
              row[farmNameIndex] || "",
            district:
              row[districtIndex] || "",
            localBodyType:
              row[localBodyTypeIndex] || "",
            localBody:
              row[localBodyIndex] || "",
            area:
  row[farmerReportedAreaIndex] ||
  row[revenueRecordAreaIndex] ||
  row[gpsCalculatedAreaIndex] ||
  "",
areaUnit:
  row[areaUnitIndex] || "",
            mainCrop:
              row[mainCropIndex] || ""
          };
        });

    return {
      success: true,
      lands
    };
  } catch (error) {
    console.error(
      "Get farmer lands error.",
      { error: safeErrorDetails(error) }
    );

    return {
      success: false,
      lands: [],
      error:
        error &&
        error.message
          ? error.message
          : "Unknown error"
    };
  }
}
module.exports = {
  registerLand,
  getFarmerLands,
  parseLandUpdateDetails,
  updateLandDetails
};
