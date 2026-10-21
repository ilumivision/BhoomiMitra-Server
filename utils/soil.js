 "use strict";

const {
  fetchSoilGridsData,
  extractSoilProfile,
  formatEstimatedSoilProfile
} = require("../soilModule");
const { safeErrorDetails } = require("./webhookSecurity");

function normalizeHeader(value) {
  return String(value == null ? "" : value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function makeHeaderMap(headers) {
  const map = Object.create(null);

  (headers || []).forEach(function (header, index) {
    const key = normalizeHeader(header);
    if (key && map[key] === undefined) map[key] = index;
  });

  return map;
}

function getHeaderValue(row, headerMap, aliases) {
  for (const alias of aliases || []) {
    const index = headerMap[normalizeHeader(alias)];
    if (index !== undefined) {
      return row && row[index] != null ? row[index] : "";
    }
  }
  return "";
}

function normaliseCoordinate(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return Number(number.toFixed(4));
}

function coordinateDistance(
  firstLatitude,
  firstLongitude,
  secondLatitude,
  secondLongitude
) {
  const latDifference =
    Number(firstLatitude) -
    Number(secondLatitude);

  const lonDifference =
    Number(firstLongitude) -
    Number(secondLongitude);

  return Math.sqrt(
    latDifference * latDifference +
    lonDifference * lonDifference
  );
}

function createSoilModule(options = {}) {
  const readSheetRows =
    typeof options.readSheetRows === "function"
      ? options.readSheetRows
      : null;

  const sheets = options.sheets || {};

  async function findLocationProfile(
    latitude,
    longitude
  ) {
    if (!readSheetRows) {
      return null;
    }

    const sheetName =
      sheets.soilLocationProfile ||
      "Soil_Location_Profile";

    const rows = await readSheetRows(
      sheetName,
      "A:AK"
    );

    if (
      !Array.isArray(rows) ||
      rows.length < 2
    ) {
      return null;
    }

    const targetLatitude =
      normaliseCoordinate(latitude);

    const targetLongitude =
      normaliseCoordinate(longitude);

    if (
      targetLatitude === null ||
      targetLongitude === null
    ) {
      return null;
    }

    const headerMap = makeHeaderMap(rows[0]);
    const latitudeAliases = ["Latitude"];
    const longitudeAliases = ["Longitude"];
    let nearest = null;

    rows.slice(1).forEach(function (row) {
      const savedLatitude =
        normaliseCoordinate(
          getHeaderValue(row, headerMap, latitudeAliases)
        );

      const savedLongitude =
        normaliseCoordinate(
          getHeaderValue(row, headerMap, longitudeAliases)
        );

      if (
        savedLatitude === null ||
        savedLongitude === null
      ) {
        return;
      }

      const distance =
        coordinateDistance(
          targetLatitude,
          targetLongitude,
          savedLatitude,
          savedLongitude
        );

      if (
        !nearest ||
        distance < nearest.distance
      ) {
        nearest = {
          distance,
          row
        };
      }
    });

    if (
      !nearest ||
      nearest.distance > 0.02
    ) {
      return null;
    }

    const row = nearest.row;

    return {
      source:
        "BhoomiMitra Soil Database",
      profileId: getHeaderValue(
        row,
        headerMap,
        ["Soil_Profile_ID", "Profile_ID", "Profile ID"]
      ),
      latitude: getHeaderValue(row, headerMap, latitudeAliases),
      longitude: getHeaderValue(row, headerMap, longitudeAliases),
      district: getHeaderValue(row, headerMap, ["District"]),
      block: getHeaderValue(row, headerMap, ["Block"]),
      panchayath: getHeaderValue(
        row,
        headerMap,
        ["Panchayat", "Panchayath"]
      ),
      village: getHeaderValue(row, headerMap, ["Village"]),
      soilType: getHeaderValue(
        row,
        headerMap,
        ["Soil_Texture", "Soil_Type", "Soil Type", "Texture"]
      ),
      ph: getHeaderValue(
        row,
        headerMap,
        ["Predicted_pH", "pH", "PH"]
      ),
      organicCarbon: getHeaderValue(
        row,
        headerMap,
        ["Organic_Carbon_g_kg", "Organic_Carbon", "Organic Carbon", "OC"]
      ),
      nitrogen: getHeaderValue(
        row,
        headerMap,
        ["Total_Nitrogen_g_kg", "Nitrogen", "N"]
      ),
      phosphorus: getHeaderValue(
        row,
        headerMap,
        ["Phosphorus", "Available_Phosphorus", "P"]
      ),
      potassium: getHeaderValue(
        row,
        headerMap,
        ["Potassium", "Available_Potassium", "K"]
      ),
      remarks: getHeaderValue(row, headerMap, ["Remarks"])
    };
  }

  function formatSavedProfile(profile) {
    return [
      "🌱 BhoomiMitra Soil Profile",
      "",
      "District: " +
        (
          profile.district ||
          "Not available"
        ),
      "Panchayath: " +
        (
          profile.panchayath ||
          "Not available"
        ),
      "Village: " +
        (
          profile.village ||
          "Not available"
        ),
      "Soil type: " +
        (
          profile.soilType ||
          "Not available"
        ),
      "pH: " +
        (
          profile.ph ||
          "Not available"
        ),
      "Organic carbon: " +
        (
          profile.organicCarbon ||
          "Not available"
        ),
      "Nitrogen: " +
        (
          profile.nitrogen ||
          "Not available"
        ),
      "Phosphorus: " +
        (
          profile.phosphorus ||
          "Not available"
        ),
      "Potassium: " +
        (
          profile.potassium ||
          "Not available"
        ),
      "",
      "Remarks: " +
        (
          profile.remarks ||
          "None"
        ),
      "Source: " +
        profile.source,
      "",
      "⚠️ Final fertiliser recommendations should be based on a laboratory soil test."
    ].join("\n");
  }

  async function getLocationSoilAdvice(
    latitude,
    longitude
  ) {
    try {
      const savedProfile =
        await findLocationProfile(
          latitude,
          longitude
        );

      if (savedProfile) {
        return {
          success: true,
          source:
            savedProfile.source,
          profile:
            savedProfile,
          reply:
            formatSavedProfile(
              savedProfile
            )
        };
      }

      const soilGridsResult =
        await fetchSoilGridsData(
          latitude,
          longitude
        );

      if (
        soilGridsResult &&
        soilGridsResult.success
      ) {
        const estimatedProfile =
          extractSoilProfile(
            soilGridsResult.data,
            "0-5cm"
          );

        if (
          estimatedProfile &&
          estimatedProfile.dataAvailable
        ) {
          return {
            success: true,
            source: "SoilGrids",
            profile:
              estimatedProfile,
            reply:
              formatEstimatedSoilProfile(
                estimatedProfile
              )
          };
        }
      }

      return {
        success: false,
        source:
          "No reliable soil value",
        profile: null,
        reply: [
          "🌱 ഈ സ്ഥലത്തിന് വിശ്വസനീയമായ മണ്ണ് വിവരങ്ങൾ ഇപ്പോൾ ലഭ്യമല്ല.",
          "",
          "ദയവായി മണ്ണ് പരിശോധനാ റിപ്പോർട്ട് അയയ്ക്കുക അല്ലെങ്കിൽ സമീപത്തെ മണ്ണ് പരിശോധനാ ലബോറട്ടറിയിൽ സാമ്പിൾ പരിശോധിക്കുക.",
          "",
          "⚠️ പരിശോധന കൂടാതെ കൃത്യമായ വള ശുപാർശ നൽകുന്നത് സുരക്ഷിതമല്ല."
        ].join("\n")
      };
    } catch (error) {
      console.error(
        "Soil advisory error.",
        { error: safeErrorDetails(error) }
      );

      return {
        success: false,
        source: "Soil module error",
        profile: null,
        reply: [
          "ക്ഷമിക്കണം, മണ്ണ് വിവരങ്ങൾ ഇപ്പോൾ പരിശോധിക്കാൻ കഴിഞ്ഞില്ല.",
          "കുറച്ച് കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക."
        ].join("\n")
      };
    }
  }

  async function soilModule(data = {}) {
    const latitude =
      data.latitude ??
      data.lat;

    const longitude =
      data.longitude ??
      data.lon ??
      data.lng;

    if (
      latitude === undefined ||
      longitude === undefined
    ) {
      return {
        success: false,
        module: "SOIL",
        reply: [
          "🌱 മണ്ണ് വിവരങ്ങൾ ലഭിക്കാൻ നിങ്ങളുടെ WhatsApp location അയയ്ക്കുക.",
          "",
          "📎 Attach → Location → Send current location"
        ].join("\n")
      };
    }

    const result =
      await getLocationSoilAdvice(
        latitude,
        longitude
      );

    return {
      ...result,
      module: "SOIL"
    };
  }

  soilModule.findLocationProfile =
    findLocationProfile;

  soilModule.formatSavedProfile =
    formatSavedProfile;

  soilModule.getLocationSoilAdvice =
    getLocationSoilAdvice;

  return soilModule;
}

const defaultSoilModule =
  createSoilModule();

module.exports =
  defaultSoilModule;

module.exports.createSoilModule =
  createSoilModule;

module.exports.normaliseCoordinate =
  normaliseCoordinate;

module.exports.coordinateDistance =
  coordinateDistance;

module.exports.makeHeaderMap =
  makeHeaderMap;

module.exports.getHeaderValue =
  getHeaderValue;
