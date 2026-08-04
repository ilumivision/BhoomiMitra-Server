"use strict";

const SHEET_NAME = "Land_Parcels";

function createLandId(rowCount) {
  const nextNumber = Math.max(1, rowCount);

  return (
    "BM-L-" +
    String(nextNumber).padStart(6, "0")
  );
}

async function registerLand(data) {
  try {
    const sheets = data && data.sheets;
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

    const existingResponse =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: SHEET_NAME + "!A:A"
      });

    const existingRows =
      existingResponse.data.values || [];

    const landId =
      createLandId(existingRows.length);

    const timestamp =
      new Date().toISOString();

    const row = [
      landId,
      land.farmerId || "",
      land.farmName || "",
      land.district || "",
      land.taluk || "",
      land.revenueVillage || "",
      land.localBodyType || "",
      land.localBody || "",
      land.ward || "",
      land.locality || "",
      land.blockNumber || "",
      land.surveyNumber || "",
      land.subDivisionNumber || "",
      land.area || "",
      land.areaUnit || "",
      land.mainCrop || "",
      land.intercrops || "",
      land.latitude || "",
      land.longitude || "",
      phone,
      timestamp,
      "Active"
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: SHEET_NAME + "!A:V",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [row]
      }
    });

    return {
      success: true,
      landId
    };
  } catch (error) {
    console.error(
      "Land registration error:",
      error && error.message
        ? error.message
        : error
    );

    return {
      success: false,
      landId: null,
      error:
        error && error.message
          ? error.message
          : "Unknown land registration error"
    };
  }
}

module.exports = {
  registerLand
};
