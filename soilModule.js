"use strict";

Paste this complete code:

"use strict";
const axios = require("axios");
const SOILGRIDS_API_URL =
  "https://rest.isric.org/soilgrids/v2.0/properties/query";
const SOIL_REQUEST_TIMEOUT_MS = 15000;
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

module.exports = {
  SOILGRIDS_API_URL,
  SOIL_REQUEST_TIMEOUT_MS,
  validateCoordinates,
  createCacheKey,
  getCachedSoilData,
  saveSoilDataToCache,
  fetchSoilGridsData
};
