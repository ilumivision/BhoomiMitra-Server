"use strict";

const axios = require("axios");

const SOILGRIDS_API_URL =
  "https://rest.isric.org/soilgrids/v2.0/properties/query";

const SOIL_REQUEST_TIMEOUT_MS = 60000;

const soilCache = new Map();

/*
 * Validate GPS coordinates.
 */
function validateCoordinates(
  latitude,
  longitude
) {
  const lat = Number(latitude);
  const lon = Number(longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    throw new Error(
      "Invalid latitude or longitude"
    );
  }

  if (lat < -90 || lat > 90) {
    throw new Error(
      "Latitude must be between -90 and 90"
    );
  }

  if (lon < -180 || lon > 180) {
    throw new Error(
      "Longitude must be between -180 and 180"
    );
  }

  return {
    latitude: lat,
    longitude: lon
  };
}

/*
 * Create a stable cache key.
 */
function createCacheKey(
  latitude,
  longitude
) {
  return [
    Number(latitude).toFixed(4),
    Number(longitude).toFixed(4)
  ].join(",");
}

/*
 * Return cached SoilGrids response.
 */
function getCachedSoilData(
  latitude,
  longitude
) {
  const key =
    createCacheKey(
      latitude,
      longitude
    );

  return soilCache.get(key) || null;
}

/*
 * Save successful SoilGrids response.
 */
function saveSoilDataToCache(
  latitude,
  longitude,
  soilData
) {
  const key =
    createCacheKey(
      latitude,
      longitude
    );

  soilCache.set(key, {
    savedAt: Date.now(),
    data: soilData
  });
}

/*
 * Fetch location-based soil estimates
 * from SoilGrids.
 */
async function fetchSoilGridsData(
  latitude,
  longitude
) {
  const coordinates =
    validateCoordinates(
      latitude,
      longitude
    );

  const cached =
    getCachedSoilData(
      coordinates.latitude,
      coordinates.longitude
    );

  if (cached) {
    return {
      success: true,
      source: "cache",
      retrievedAt:
        new Date(
          cached.savedAt
        ).toISOString(),
      data: cached.data
    };
  }

  const params = {
    lon: coordinates.longitude,
    lat: coordinates.latitude,

    property: [
      "phh2o",
      "soc",
      "nitrogen",
      "clay",
      "sand",
      "silt",
      "cec",
      "bdod",
      "cfvo"
    ],

    depth: [
      "0-5cm",
      "5-15cm",
      "15-30cm"
    ],

    value: [
      "mean",
      "Q0.05",
      "Q0.5",
      "Q0.95"
    ]
  };

  try {
    const response =
      await axios.get(
        SOILGRIDS_API_URL,
        {
          params,
          timeout:
            SOIL_REQUEST_TIMEOUT_MS,

          paramsSerializer: {
            indexes: null
          }
        }
      );

    const soilData =
      response.data;

    saveSoilDataToCache(
      coordinates.latitude,
      coordinates.longitude,
      soilData
    );

    return {
      success: true,
      source: "SoilGrids",
      retrievedAt:
        new Date().toISOString(),
      data: soilData
    };
  } catch (error) {
    console.error(
      "SoilGrids request failed:",
      error &&
      error.response &&
      error.response.status
        ? error.response.status
        : error.message
    );

    return {
      success: false,
      source: "SoilGrids",
      retrievedAt:
        new Date().toISOString(),

      error:
        error &&
        error.response &&
        error.response.data &&
        error.response.data.detail
          ? error.response.data.detail
          : (
              error.message ||
              "SoilGrids service unavailable"
            )
    };
  }
}

/*
 * Find one property layer.
 *
 * Examples:
 * phh2o, soc, nitrogen,
 * clay, sand, silt, cec,
 * bdod or cfvo.
 */
function getSoilLayer(
  soilGridsData,
  propertyName
) {
  const layers =
    soilGridsData &&
    soilGridsData.properties &&
    Array.isArray(
      soilGridsData.properties.layers
    )
      ? soilGridsData.properties.layers
      : [];

  return (
    layers.find(function (layer) {
      return (
        layer &&
        layer.name === propertyName
      );
    }) || null
  );
}

/*
 * Read one value from one layer
 * for the selected depth.
 */
function getSoilDepthValue(
  layer,
  depthLabel,
  valueName
) {
  if (
    !layer ||
    !Array.isArray(layer.depths)
  ) {
    return null;
  }

  const selectedDepth =
    layer.depths.find(
      function (depth) {
        return (
          depth &&
          depth.label === depthLabel
        );
      }
    );

  if (
    !selectedDepth ||
    !selectedDepth.values
  ) {
    return null;
  }

  const requestedValue =
    valueName || "mean";

  const value =
    selectedDepth.values[
      requestedValue
    ];

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numericValue =
    Number(value);

  return Number.isFinite(
    numericValue
  )
    ? numericValue
    : null;
}

/*
 * Convert SoilGrids mapped units
 * into farmer-readable units.
 */
function convertSoilGridsValue(
  propertyName,
  rawValue
) {
  if (
    rawValue === null ||
    rawValue === undefined ||
    rawValue === ""
  ) {
    return null;
  }

  const numericValue =
    Number(rawValue);

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return null;
  }

  /*
   * SoilGrids conversion factors:
   *
   * phh2o: pH × 10
   * soc: dg/kg
   * nitrogen: cg/kg
   * clay/sand/silt: g/kg
   * cec: mmol(c)/kg
   * bdod: cg/cm³
   * cfvo: cm³/dm³
   */
  const conversionFactors = {
    phh2o: 10,
    soc: 10,
    nitrogen: 100,
    clay: 10,
    sand: 10,
    silt: 10,
    cec: 10,
    bdod: 100,
    cfvo: 10
  };

  const factor =
    conversionFactors[
      propertyName
    ] || 1;

  return Number(
    (
      numericValue / factor
    ).toFixed(2)
  );
}

/*
 * Simple soil-texture interpretation.
 */
function determineSoilTexture(
  sand,
  silt,
  clay
) {
  if (
    !Number.isFinite(sand) ||
    !Number.isFinite(silt) ||
    !Number.isFinite(clay)
  ) {
    return "Not available";
  }

  if (clay >= 40) {
    return "Clay";
  }

  if (
    clay >= 35 &&
    sand >= 45
  ) {
    return "Sandy clay";
  }

  if (
    clay >= 27 &&
    clay < 40 &&
    sand <= 45
  ) {
    return "Clay loam";
  }

  if (
    clay >= 20 &&
    clay < 35 &&
    sand > 45
  ) {
    return "Sandy clay loam";
  }

  if (
    silt >= 50 &&
    clay < 27
  ) {
    return "Silt loam";
  }

  if (
    sand >= 70 &&
    clay < 15
  ) {
    return "Sandy soil";
  }

  if (
    sand >= 52 &&
    clay < 20
  ) {
    return "Sandy loam";
  }

  return "Loam";
}

/*
 * Extract all soil-property values
 * for one selected depth.
 */
function extractSoilProfile(
  soilGridsData,
  depthLabel = "0-5cm"
) {
  const propertyNames = [
    "phh2o",
    "soc",
    "nitrogen",
    "clay",
    "sand",
    "silt",
    "cec",
    "bdod",
    "cfvo"
  ];

  const profile = {
    depth: depthLabel
  };

  propertyNames.forEach(
    function (propertyName) {
      /*
       * Important correction:
       * first find the individual
       * property layer.
       */
      const layer =
        getSoilLayer(
          soilGridsData,
          propertyName
        );

      const rawMean =
        getSoilDepthValue(
          layer,
          depthLabel,
          "mean"
        );

      const rawLow =
        getSoilDepthValue(
          layer,
          depthLabel,
          "Q0.05"
        );

      const rawMedian =
        getSoilDepthValue(
          layer,
          depthLabel,
          "Q0.5"
        );

      const rawHigh =
        getSoilDepthValue(
          layer,
          depthLabel,
          "Q0.95"
        );

      profile[propertyName] = {
        mean:
          convertSoilGridsValue(
            propertyName,
            rawMean
          ),

        low:
          convertSoilGridsValue(
            propertyName,
            rawLow
          ),

        median:
          convertSoilGridsValue(
            propertyName,
            rawMedian
          ),

        high:
          convertSoilGridsValue(
            propertyName,
            rawHigh
          )
      };
    }
  );

  const textureValuesAvailable =
    profile.sand &&
    profile.silt &&
    profile.clay &&
    profile.sand.mean !== null &&
    profile.silt.mean !== null &&
    profile.clay.mean !== null;

  profile.texture =
    textureValuesAvailable
      ? determineSoilTexture(
          profile.sand.mean,
          profile.silt.mean,
          profile.clay.mean
        )
      : "Not available";

  profile.dataAvailable =
    propertyNames.some(
      function (propertyName) {
        return (
          profile[propertyName] &&
          profile[propertyName]
            .mean !== null
        );
      }
    );

  return profile;
}

/*
 * Format soil values for testing
 * and later WhatsApp use.
 */
function formatEstimatedSoilProfile(
  profile
) {
  if (!profile) {
    return (
      "ക്ഷമിക്കണം, മണ്ണിന്റെ വിവരങ്ങൾ " +
      "തയ്യാറാക്കാൻ കഴിഞ്ഞില്ല."
    );
  }

  if (!profile.dataAvailable) {
    return [
      "🌱 Estimated Soil Profile",
      "",
      "Depth: " +
        (
          profile.depth ||
          "0-5cm"
        ),
      "",
      "SoilGrids did not provide soil-property values for this location.",
      "Please try again later or use a laboratory soil-test result.",
      "",
      "Source: SoilGrids 250 m prediction",
      "⚠️ This is a location-based estimate, not a laboratory soil-test result."
    ].join("\n");
  }

  function displayValue(
    property,
    unit
  ) {
    if (
      !property ||
      property.mean === null ||
      property.mean === undefined
    ) {
      return "Not available";
    }

    return (
      property.mean +
      (unit ? " " + unit : "")
    );
  }

  return [
    "🌱 Estimated Soil Profile",
    "",
    "Depth: " +
      (
        profile.depth ||
        "0-5cm"
      ),

    "pH: " +
      displayValue(
        profile.phh2o,
        ""
      ),

    "Organic carbon: " +
      displayValue(
        profile.soc,
        "g/kg"
      ),

    "Total nitrogen: " +
      displayValue(
        profile.nitrogen,
        "g/kg"
      ),

    "Sand: " +
      displayValue(
        profile.sand,
        "%"
      ),

    "Silt: " +
      displayValue(
        profile.silt,
        "%"
      ),

    "Clay: " +
      displayValue(
        profile.clay,
        "%"
      ),

    "Texture: " +
      (
        profile.texture ||
        "Not available"
      ),

    "CEC: " +
      displayValue(
        profile.cec,
        "cmol(c)/kg"
      ),

    "Bulk density: " +
      displayValue(
        profile.bdod,
        "kg/dm³"
      ),

    "Coarse fragments: " +
      displayValue(
        profile.cfvo,
        "%"
      ),

    "",
    "Source: SoilGrids 250 m prediction",
    "⚠️ This is a location-based estimate, not a laboratory soil-test result."
  ].join("\n");
}

module.exports = {
  SOILGRIDS_API_URL,
  SOIL_REQUEST_TIMEOUT_MS,
  validateCoordinates,
  createCacheKey,
  getCachedSoilData,
  saveSoilDataToCache,
  fetchSoilGridsData,
  getSoilLayer,
  getSoilDepthValue,
  convertSoilGridsValue,
  determineSoilTexture,
  extractSoilProfile,
  formatEstimatedSoilProfile
};
