"use strict";
const { safeErrorDetails } = require("./webhookSecurity");

const SHEET_NAME = "Animal_Registry";

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizePhone(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .trim();
}

function getCell(row, index) {
  if (index < 0) {
    return "";
  }

  return String(row[index] || "").trim();
}

function findHeaderIndex(headers, options) {
  for (const option of options) {
    const index = headers.indexOf(option);

    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

function findHeaderIndexes(headers, options) {
  return options
    .map(function (option) {
      return headers.indexOf(option);
    })
    .filter(function (index) {
      return index >= 0;
    });
}

function generateAnimalId(existingRows) {
  let highestNumber = 0;

  existingRows.forEach(function (row) {
    const existingId =
      String((row && row[0]) || "").trim();

    const match =
      existingId.match(/^BM-A-(\d+)$/i);

    if (!match) {
      return;
    }

    const number =
      Number(match[1]);

    if (
      Number.isFinite(number) &&
      number > highestNumber
    ) {
      highestNumber = number;
    }
  });

  return (
    "BM-A-" +
    String(highestNumber + 1)
      .padStart(6, "0")
  );
}

async function getAnimalRows(data) {
  const sheets =
    data && data.sheets;

  const spreadsheetId =
    data && data.spreadsheetId;

  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: SHEET_NAME + "!A:AZ"
    });

  return response.data.values || [];
}

async function registerAnimal(data) {
  try {
    const sheets =
      data && data.sheets;

    const spreadsheetId =
      data && data.spreadsheetId;

    const phone =
      normalizePhone(
        data && data.phone
      );
    const animal =
      (data && data.animal) || {};

    if (!String(animal.farmerId || "").trim()) {
      return {
        success: false,
        code: "FARMER_ID_REQUIRED",
        error: "A verified Farmer_ID is required before animal registration."
      };
    }

    if (!String(animal.animalType || "").trim()) {
      return {
        success: false,
        code: "ANIMAL_TYPE_REQUIRED",
        error: "Animal type is required."
      };
    }

    if (!sheets || !spreadsheetId) {
      throw new Error(
        "Google Sheets configuration is missing."
      );
    }

    const rows =
      await getAnimalRows({
        sheets,
        spreadsheetId
      });

    if (!rows.length) {
      throw new Error(
        "Animal_Registry headers are missing."
      );
    }

    const headers =
      rows[0].map(normalizeHeader);

    const requiredHeaders = [
      "animal_id",
      "farmer_id",
      "animal_type"
    ];
    const missingHeaders =
      requiredHeaders.filter(function (header) {
        return !headers.includes(header);
      });

    if (missingHeaders.length) {
      return {
        success: false,
        code: "HEADERS_MISSING",
        missingHeaders,
        error:
          "Animal_Registry is missing required headers: " +
          missingHeaders.join(", ")
      };
    }

    const requestedTag =
      String(animal.tagNumber || "")
        .trim()
        .toLowerCase();
    const farmerIndex = headers.indexOf("farmer_id");
    const tagIndex = headers.indexOf("tag_number");
    const activeIndex = headers.indexOf("active_status");

    if (
      requestedTag &&
      tagIndex >= 0 &&
      rows.slice(1).some(function (row) {
        const sameFarmer =
          getCell(row, farmerIndex).toLowerCase() ===
          String(animal.farmerId).trim().toLowerCase();
        const sameTag =
          getCell(row, tagIndex).toLowerCase() === requestedTag;
        const status = getCell(row, activeIndex).toLowerCase();
        return sameFarmer && sameTag &&
          (activeIndex < 0 || !status || status === "active");
      })
    ) {
      return {
        success: false,
        code: "DUPLICATE_TAG",
        error: "This tag number is already registered to the farmer."
      };
    }

    const animalId =
      generateAnimalId(
        rows.slice(1)
      );

    const now =
      new Date().toISOString();

    const valuesByHeader = {
      animal_id: animalId,
      farmer_id:
        animal.farmerId || "",
      whatsapp_no: phone,
      mobile_no: phone,
      mobile_number: phone,
      animal_type:
        animal.animalType || "",
      breed:
        animal.breed || "",
      sex:
        animal.sex || "",
      date_of_birth:
        animal.dateOfBirth || "",
      age:
        animal.age || "",
      identification_mark:
        animal.identificationMark || "",
      tag_number:
        animal.tagNumber || "",
      vaccination_status:
        animal.vaccinationStatus || "",
      last_vaccination_date:
        animal.lastVaccinationDate || "",
      health_status:
        animal.healthStatus || "",
      insurance_status:
        animal.insuranceStatus || "",
      active_status:
        "Active",
      created_at: now,
      updated_at: now,
      remarks:
        animal.remarks || ""
    };

    const row =
      headers.map(function (header) {
        return Object.prototype
          .hasOwnProperty.call(
            valuesByHeader,
            header
          )
          ? valuesByHeader[header]
          : "";
      });

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: SHEET_NAME + "!A:AZ",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [row]
      }
    });

    return {
      success: true,
      animalId
    };
  } catch (error) {
    console.error(
      "Animal registration error.",
      { error: safeErrorDetails(error) }
    );

    return {
      success: false,
      error:
        error &&
        error.message
          ? error.message
          : "Unknown error"
    };
  }
}

async function getFarmerAnimals(data) {
  try {
    const sheets =
      data && data.sheets;

    const spreadsheetId =
      data && data.spreadsheetId;

    const phone =
      normalizePhone(
        data && data.phone
      );
    const farmerId =
      String((data && data.farmerId) || "")
        .trim()
        .toLowerCase();

    const rows =
      await getAnimalRows({
        sheets,
        spreadsheetId
      });

    if (rows.length < 2) {
      return {
        success: true,
        animals: []
      };
    }

    const headers =
      rows[0].map(normalizeHeader);

    const phoneIndexes =
      findHeaderIndexes(
        headers,
        [
          "whatsapp_no",
          "whatsapp_number",
          "mobile_no",
          "mobile_number",
          "registered_mobile",
          "farmer_mobile"
        ]
      );

    const farmerIdIndex =
      findHeaderIndex(
        headers,
        ["farmer_id", "member_id", "bm_id"]
      );

    const animalIdIndex =
      findHeaderIndex(
        headers,
        ["animal_id"]
      );

    const typeIndex =
      findHeaderIndex(
        headers,
        ["animal_type"]
      );

    const breedIndex =
      findHeaderIndex(
        headers,
        ["breed"]
      );

    const sexIndex =
      findHeaderIndex(
        headers,
        ["sex", "gender"]
      );

    const ageIndex =
      findHeaderIndex(
        headers,
        ["age"]
      );

    const tagIndex =
      findHeaderIndex(
        headers,
        ["tag_number"]
      );

    const healthIndex =
      findHeaderIndex(
        headers,
        ["health_status"]
      );

    const vaccinationIndex =
      findHeaderIndex(
        headers,
        ["vaccination_status"]
      );

    const activeStatusIndex =
      findHeaderIndex(
        headers,
        ["active_status"]
      );

    const animals =
      rows
        .slice(1)
        .filter(function (row) {
          if (
            farmerId &&
            (
              farmerIdIndex < 0 ||
              getCell(row, farmerIdIndex).toLowerCase() !== farmerId
            )
          ) {
            return false;
          }

          const matchesPhone =
            phoneIndexes.some(
              function (index) {
                return (
                  normalizePhone(
                    row[index]
                  ) === phone
                );
              }
            );

          if (!matchesPhone) {
            return false;
          }

          if (activeStatusIndex < 0) {
            return true;
          }

          const status =
            getCell(
              row,
              activeStatusIndex
            ).toLowerCase();

          return (
            !status ||
            status === "active"
          );
        })
        .map(function (row) {
          return {
            animalId:
              getCell(
                row,
                animalIdIndex
              ),
            animalType:
              getCell(
                row,
                typeIndex
              ),
            breed:
              getCell(
                row,
                breedIndex
              ),
            sex:
              getCell(
                row,
                sexIndex
              ),
            age:
              getCell(
                row,
                ageIndex
              ),
            tagNumber:
              getCell(
                row,
                tagIndex
              ),
            healthStatus:
              getCell(
                row,
                healthIndex
              ),
            vaccinationStatus:
              getCell(
                row,
                vaccinationIndex
              )
          };
        });

    return {
      success: true,
      animals
    };
  } catch (error) {
    console.error(
      "Animal retrieval error.",
      { error: safeErrorDetails(error) }
    );

    return {
      success: false,
      animals: [],
      error:
        error &&
        error.message
          ? error.message
          : "Unknown error"
    };
  }
}

module.exports = {
  registerAnimal,
  getFarmerAnimals
};
