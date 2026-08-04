"use strict";

const SHEET_NAME = "Land_Parcels";

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^+|+$/g, "");
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

    const existingRows =
      rows.slice(1);

    const landId =
      generateLandId(existingRows);

    const now =
      new Date().toISOString();

    const valuesByHeader = {
      land_id: landId,
      farmer_id:
        land.farmerId || "",
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
      "Land registration error:",
      error &&
      error.message
        ? error.message
        : error
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

module.exports = {
  registerLand
};
