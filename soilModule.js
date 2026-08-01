"use strict";
const axios = require("axios");
const SOILGRIDS_API_URL =
  "https://rest.isric.org/soilgrids/v2.0/properties/query";
const SOIL_REQUEST_TIMEOUT_MS = 60000;
const soilCache = new Map();
function validateCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("Invalid latitude or longitude");
  }
  if (lat < -90 || lat > 90) {
    throw new Error("Latitude must be between -90 and 90");
  }
  if (lon < -180 || lon > 180) {
    throw new Error("Longitude must be between -180 and 180");
  }
  return {
    latitude: lat,
    longitude: lon
  };
}
function createCacheKey(latitude, longitude) {
  return [
    Number(latitude).toFixed(4),
    Number(longitude).toFixed(4)
  ].join(",");
}
function getCachedSoilData(latitude, longitude) {
  const key = createCacheKey(latitude, longitude);
  return soilCache.get(key) || null;
}
function saveSoilDataToCache(
  latitude,
  longitude,
  soilData
) {
  const key = createCacheKey(latitude, longitude);
  soilCache.set(key, {
    savedAt: Date.now(),
    data: soilData
  });
}
async function fetchSoilGridsData(latitude, longitude) {
  const coordinates =
    validateCoordinates(latitude, longitude);
  const cached = getCachedSoilData(
    coordinates.latitude,
    coordinates.longitude
  );
  if (cached) {
    return {
      success: true,
      source: "cache",
      retrievedAt:
        new Date(cached.savedAt).toISOString(),
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
    const response = await axios.get(
      SOILGRIDS_API_URL,
      {
        params,
        timeout: SOIL_REQUEST_TIMEOUT_MS,
        paramsSerializer: {
          indexes: null
        }
      }
    );
    const soilData = response.data;
    saveSoilDataToCache(
      coordinates.latitude,
      coordinates.longitude,
      soilData
    );
    return {
      success: true,
      source: "SoilGrids",
      retrievedAt: new Date().toISOString(),
      data: soilData
    };
  } catch (error) {
    console.error(
      "SoilGrids request failed:",
      error.response?.status || error.message
    );
    return {
      success: false,
      source: "SoilGrids",
      retrievedAt: new Date().toISOString(),
      error:
        error.response?.data?.detail ||
        error.message ||
        "SoilGrids service unavailable"
    };
  }
}
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
      return layer.name === propertyName;
    }) || null
  );
}

function getSoilDepthValue(
  soilGridsData,
  propertyName,
  depthLabel,
  valueName = "mean"
) {
  const layer =
    getSoilLayer(
      soilGridsData,
      propertyName
    );

  if (
    !layer ||
    !Array.isArray(layer.depths)
  ) {
    return null;
  }

  const depth =
    layer.depths.find(function (item) {
      return item.label === depthLabel;
    });

  if (
    !depth ||
    !depth.values
  ) {
    return null;
  }

  const value =
    depth.values[valueName];

  const numericValue =
    Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : null;
}

function convertSoilGridsValue(
  propertyName,
  rawValue
) {
  if (
    rawValue === null ||
    rawValue === undefined
  ) {
    return null;
  }

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
    conversionFactors[propertyName] || 1;

  return Number(
    (Number(rawValue) / factor)
      .toFixed(2)
  );
}

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
    return "Not determined";
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

function extractSoilProfile(
  soilGridsData,
  depthLabel = "0-5cm"
) {
  const properties = [
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

  const profile = {};

  properties.forEach(function (
    propertyName
  ) {
    const rawMean =
      getSoilDepthValue(
        soilGridsData,
        propertyName,
        depthLabel,
        "mean"
      );

    const rawLow =
      getSoilDepthValue(
        soilGridsData,
        propertyName,
        depthLabel,
        "Q0.05"
      );

    const rawMedian =
      getSoilDepthValue(
        soilGridsData,
        propertyName,
        depthLabel,
        "Q0.5"
      );

    const rawHigh =
      getSoilDepthValue(
        soilGridsData,
        propertyName,
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
  });

  profile.depth = depthLabel;

  profile.texture =
    determineSoilTexture(
      profile.sand.mean,
      profile.silt.mean,
      profile.clay.mean
    );

  return profile;
}

function formatEstimatedSoilProfile(
  profile
) {
  if (!profile) {
    return (
      "ക്ഷമിക്കണം, മണ്ണിന്റെ വിവരങ്ങൾ " +
      "തയ്യാറാക്കാൻ കഴിഞ്ഞില്ല."
    );
  }

  return (
    "🌱 Estimated Soil Profile\n\n" +

    "Depth: " +
    profile.depth +

    "\npH: " +
    (
      profile.phh2o.mean ??
      "Not available"
    ) +

    "\nOrganic carbon: " +
    (
      profile.soc.mean ??
      "Not available"
    ) +
    " g/kg" +

    "\nTotal nitrogen: " +
    (
      profile.nitrogen.mean ??
      "Not available"
    ) +
    " g/kg" +

    "\nSand: " +
    (
      profile.sand.mean ??
      "Not available"
    ) +
    "%" +

    "\nSilt: " +
    (
      profile.silt.mean ??
      "Not available"
    ) +
    "%" +

    "\nClay: " +
    (
      profile.clay.mean ??
      "Not available"
    ) +
    "%" +

    "\nTexture: " +
    profile.texture +

    "\nCEC: " +
    (
      profile.cec.mean ??
      "Not available"
    ) +
    " cmol(c)/kg" +

    "\nBulk density: " +
    (
      profile.bdod.mean ??
      "Not available"
    ) +
    " kg/dm³" +

    "\nCoarse fragments: " +
    (
      profile.cfvo.mean ??
      "Not available"
    ) +
    "%" +

    "\n\nSource: SoilGrids 250 m prediction" +

    "\n⚠️ This is a location-based estimate, " +
    "not a laboratory soil-test result."
  );
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
