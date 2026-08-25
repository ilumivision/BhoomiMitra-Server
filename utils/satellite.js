const SATELLITE_SHEET =
  "Satellite_Observations";
let copernicusTokenCache = {
  accessToken: "",
  expiresAt: 0
};

async function getCopernicusAccessToken() {
  const clientId =
    process.env.COPERNICUS_CLIENT_ID;

  const clientSecret =
    process.env.COPERNICUS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Copernicus credentials are missing."
    );
  }

  if (
    copernicusTokenCache.accessToken &&
    Date.now() <
      copernicusTokenCache.expiresAt
  ) {
    return copernicusTokenCache.accessToken;
  }

  const tokenUrl =
    "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";

  const body =
    new URLSearchParams();

  body.append(
    "grant_type",
    "client_credentials"
  );

  body.append(
    "client_id",
    clientId
  );

  body.append(
    "client_secret",
    clientSecret
  );

  const response =
    await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body
    });

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      "Copernicus token request failed: " +
        response.status +
        " " +
        errorText
    );
  }

  const data =
    await response.json();

  const expiresIn =
    Number(data.expires_in || 600);

  copernicusTokenCache = {
    accessToken:
      data.access_token,
    expiresAt:
      Date.now() +
      Math.max(
        expiresIn - 60,
        60
      ) *
        1000
  };

  return data.access_token;
}
async function getLatestSentinel2Scene({
  geometry,
  daysBack = 30
}) {
  if (
    !geometry ||
    !geometry.type ||
    !geometry.coordinates
  ) {
    throw new Error(
      "Valid land boundary geometry is required."
    );
  }

  const token =
    await getCopernicusAccessToken();

  const endDate =
    new Date();

  const startDate =
    new Date(
      endDate.getTime() -
        daysBack *
          24 *
          60 *
          60 *
          1000
    );

  const catalogUrl =
    "https://sh.dataspace.copernicus.eu/catalog/v1/search";

  const response =
    await fetch(catalogUrl, {
      method: "POST",
      headers: {
        Authorization:
          "Bearer " + token,
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        collections: [
          "sentinel-2-l2a"
        ],
        datetime:
          startDate.toISOString() +
          "/" +
          endDate.toISOString(),
        intersects:
          geometry,
        limit: 20
      })
    });

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      "Sentinel-2 catalog request failed: " +
        response.status +
        " " +
        errorText
    );
  }

  const data =
    await response.json();

  const features =
    Array.isArray(data.features)
      ? data.features
      : [];

  if (features.length === 0) {
    return {
      success: true,
      found: false,
      scene: null
    };
  }

  features.sort(function (a, b) {
    const aTime =
      new Date(
        a &&
        a.properties &&
        a.properties.datetime
          ? a.properties.datetime
          : 0
      ).getTime();

    const bTime =
      new Date(
        b &&
        b.properties &&
        b.properties.datetime
          ? b.properties.datetime
          : 0
      ).getTime();

    return bTime - aTime;
  });

  const latest =
    features[0];

  return {
    success: true,
    found: true,
    scene: {
      id:
        latest.id || "",
      observationDate:
        latest.properties &&
        latest.properties.datetime
          ? latest.properties.datetime
          : "",
      cloudCover:
        latest.properties &&
        latest.properties[
          "eo:cloud_cover"
        ] !== undefined
          ? latest.properties[
              "eo:cloud_cover"
            ]
          : "",
      source:
        "Sentinel-2 L2A"
    }
  };
}
async function getSentinel2Ndvi({
  geometry,
  daysBack = 30
}) {
  if (
    !geometry ||
    !geometry.type ||
    !geometry.coordinates
  ) {
    throw new Error(
      "Valid land boundary geometry is required."
    );
  }

  const token =
    await getCopernicusAccessToken();

  const endDate =
    new Date();

  const startDate =
    new Date(
      endDate.getTime() -
        daysBack *
          24 *
          60 *
          60 *
          1000
    );

  const processUrl =
    "https://sh.dataspace.copernicus.eu/process/v1";

 const evalscript = `
  //VERSION=3

 function setup() {
  return {
    input: [
      "B04",
      "B08",
      "B11",
      "SCL",
      "dataMask"
    ],
    output: {
      bands: 4,
      sampleType: "FLOAT32"
    }
  };
}

function evaluatePixel(sample) {
  const badPixel =
    sample.SCL === 0 ||
    sample.SCL === 3 ||
    sample.SCL === 8 ||
    sample.SCL === 9 ||
    sample.SCL === 10 ||
    sample.SCL === 11;

  const valid =
    sample.dataMask &&
    !badPixel;
  const cloudPixel =
  sample.SCL === 8 ||
  sample.SCL === 9 ||
  sample.SCL === 10;
  let ndvi = 0;
  let ndmi = 0;

  if (
    valid &&
    (sample.B08 + sample.B04) !== 0
  ) {
    ndvi =
      (sample.B08 - sample.B04) /
      (sample.B08 + sample.B04);
  }

  if (
    valid &&
    (sample.B08 + sample.B11) !== 0
  ) {
    ndmi =
      (sample.B08 - sample.B11) /
      (sample.B08 + sample.B11);
  }

  return [
  ndvi,
  valid ? 1 : 0,
  ndmi,
  cloudPixel ? 1 : 0
];
}
  `;

  const response =
    await fetch(processUrl, {
      method: "POST",
      headers: {
        Authorization:
          "Bearer " + token,
        "Content-Type":
          "application/json",
        Accept:
          "image/tiff"
      },
      body: JSON.stringify({
        input: {
          bounds: {
            geometry,
            properties: {
              crs:
                "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
            }
          },
          data: [
            {
              type:
                "sentinel-2-l2a",
              dataFilter: {
                timeRange: {
                  from:
                    startDate.toISOString(),
                  to:
                    endDate.toISOString()
                },
                mosaickingOrder:
                  "leastCC"
              }
            }
          ]
        },
        output: {
          width: 64,
          height: 64,
          responses: [
            {
              identifier:
                "default",
              format: {
                type:
                  "image/tiff"
              }
            }
          ]
        },
        evalscript
      })
    });

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      "Sentinel-2 NDVI request failed: " +
        response.status +
        " " +
        errorText
    );
  }

 const arrayBuffer =
  await response.arrayBuffer();

const { fromArrayBuffer } =
  await import("geotiff");

const tiff =
  await fromArrayBuffer(
    arrayBuffer
  );

const image =
  await tiff.getImage();

const rasters =
  await image.readRasters();

const ndviBand =
  rasters[0];

const maskBand =
  rasters[1];

const ndmiBand =
  rasters[2];
const cloudBand =
  rasters[3];
let sum = 0;
let validPixels = 0;
let minNdvi = 1;
let maxNdvi = -1;

let ndmiSum = 0;
let validNdmiPixels = 0;
let minNdmi = 1;
let maxNdmi = -1;
let cloudPixels = 0;
for (
  let i = 0;
  i < ndviBand.length;
  i++
) {
  const ndvi =
    Number(ndviBand[i]);

  const ndmi =
    ndmiBand
      ? Number(ndmiBand[i])
      : NaN;
  if (
  Number(cloudBand[i]) > 0.5
) {
  cloudPixels++;
}
  const valid =
    maskBand
      ? Number(maskBand[i]) > 0
      : true;

  if (
    valid &&
    Number.isFinite(ndvi) &&
    ndvi >= -1 &&
    ndvi <= 1
  ) {
    sum += ndvi;
    validPixels++;

    if (ndvi < minNdvi) {
      minNdvi = ndvi;
    }

    if (ndvi > maxNdvi) {
      maxNdvi = ndvi;
    }
  }

  if (
    valid &&
    Number.isFinite(ndmi) &&
    ndmi >= -1 &&
    ndmi <= 1
  ) {
    ndmiSum += ndmi;
    validNdmiPixels++;

    if (ndmi < minNdmi) {
      minNdmi = ndmi;
    }

    if (ndmi > maxNdmi) {
      maxNdmi = ndmi;
    }
  }
}

if (validPixels === 0) {
  return {
    success: false,
    received: true,
    bytes:
      arrayBuffer.byteLength,
    error:
      "No valid NDVI pixels were found."
  };
}

const averageNdvi =
  sum / validPixels;

const averageNdmi =
  validNdmiPixels > 0
    ? ndmiSum / validNdmiPixels
    : null;

const totalPixels =
  ndviBand.length;

const validPixelPercent =
  totalPixels > 0
    ? (validPixels / totalPixels) * 100
    : 0;

const cloudCover =
  totalPixels > 0
    ? (cloudPixels / totalPixels) * 100
    : 0;


// MOISTURE STATUS
let moistureStatus =
  "Moisture data unavailable";

if (averageNdmi !== null) {
  if (averageNdmi >= 0.4) {
    moistureStatus =
      "Good Moisture";
  } else if (averageNdmi >= 0.2) {
    moistureStatus =
      "Moderate Moisture";
  } else if (averageNdmi >= 0) {
    moistureStatus =
      "Low Moisture";
  } else {
    moistureStatus =
      "Very Low Moisture / Possible Water Stress";
  }
}


// STRESS STATUS
let stressStatus =
  "Stress data unavailable";

if (
  Number.isFinite(averageNdvi) &&
  averageNdmi !== null
) {
  if (
    averageNdvi >= 0.6 &&
    averageNdmi >= 0.3
  ) {
    stressStatus = "Low Stress";
  } else if (
    averageNdvi >= 0.45 &&
    averageNdmi >= 0.15
  ) {
    stressStatus = "Mild Stress";
  } else if (
    averageNdvi >= 0.3 &&
    averageNdmi >= 0
  ) {
    stressStatus =
      "Moderate Stress";
  } else {
    stressStatus = "High Stress";
  }
}


// VEGETATION STATUS
let vegetationStatus =
  "Very Low Vegetation";

if (averageNdvi >= 0.6) {
  vegetationStatus =
    "Healthy / Dense Vegetation";
} else if (averageNdvi >= 0.4) {
  vegetationStatus =
    "Moderate Vegetation";
} else if (averageNdvi >= 0.2) {
  vegetationStatus =
    "Low Vegetation / Possible Stress";
}


// WATERLOGGING SCREENING
let waterloggingStatus =
  "No Waterlogging Signal";

if (
  averageNdmi !== null &&
  averageNdmi >= 0.45 &&
  averageNdvi < 0.45
) {
  waterloggingStatus =
    "Possible Waterlogging / Excess Moisture";
} else if (
  averageNdmi !== null &&
  averageNdmi >= 0.45
) {
  waterloggingStatus =
    "High Moisture - Monitor";
}


// IMAGE QUALITY
let imageQualityStatus = "Good";

if (
  cloudCover > 50 ||
  validPixelPercent < 25
) {
  imageQualityStatus =
    "Limited / Cloud Affected";
} else if (
  cloudCover > 20 ||
  validPixelPercent < 50
) {
  imageQualityStatus =
    "Moderate";
}


// OVERALL HEALTH SUMMARY
let healthSummary =
  "Moderate Condition - Monitor";

if (stressStatus === "High Stress") {
  healthSummary =
    "Attention Needed - High Crop Stress";
} else if (
  waterloggingStatus ===
  "Possible Waterlogging / Excess Moisture"
) {
  healthSummary =
    "Attention Needed - Possible Excess Moisture";
} else if (
  stressStatus === "Moderate Stress"
) {
  healthSummary =
    "Monitor Crop Stress";
} else if (
  moistureStatus ===
  "Very Low Moisture / Possible Water Stress"
) {
  healthSummary =
    "Monitor Possible Water Stress";
} else if (
  vegetationStatus ===
    "Healthy / Dense Vegetation" &&
  stressStatus === "Low Stress"
) {
  healthSummary =
    "Generally Healthy";
} else if (
  stressStatus === "Mild Stress"
) {
  healthSummary =
    "Generally Stable - Mild Stress";
}


return {
  success: true,
  received: true,

  bytes:
    arrayBuffer.byteLength,

  averageNdvi:
    Number(
      averageNdvi.toFixed(3)
    ),

  minimumNdvi:
    Number(
      minNdvi.toFixed(3)
    ),

  maximumNdvi:
    Number(
      maxNdvi.toFixed(3)
    ),

  averageNdmi:
    averageNdmi !== null
      ? Number(
          averageNdmi.toFixed(3)
        )
      : null,

  minimumNdmi:
    validNdmiPixels > 0
      ? Number(
          minNdmi.toFixed(3)
        )
      : null,

  maximumNdmi:
    validNdmiPixels > 0
      ? Number(
          maxNdmi.toFixed(3)
        )
      : null,

  validPixels,

  validNdmiPixels,

  totalPixels,

  validPixelPercent:
    Number(
      validPixelPercent.toFixed(1)
    ),

  cloudCover:
    Number(
      cloudCover.toFixed(1)
    ),

  vegetationStatus,

  moistureStatus,

  stressStatus,

  waterloggingStatus,

  imageQualityStatus,

  healthSummary
};
}
function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function makeHeaderMap(headers) {
  const map = {};

  headers.forEach(function (header, index) {
    map[normalizeHeader(header)] = index;
  });

  return map;
}

function getCell(
  row,
  headerMap,
  headerName
) {
  const index =
    headerMap[
      normalizeHeader(headerName)
    ];

  if (
    index === undefined ||
    index === null
  ) {
    return "";
  }

  return row[index] !== undefined
    ? row[index]
    : "";
}

function buildObservation(
  row,
  headerMap
) {
  return {
    observationId:
      getCell(
        row,
        headerMap,
        "Observation_ID"
      ),

    landId:
      getCell(
        row,
        headerMap,
        "Land_ID"
      ),

    farmerId:
      getCell(
        row,
        headerMap,
        "Farmer_ID"
      ),

    farmName:
      getCell(
        row,
        headerMap,
        "Farm_Name"
      ),

    observationDate:
      getCell(
        row,
        headerMap,
        "Observation_Date"
      ),

    satelliteSource:
      getCell(
        row,
        headerMap,
        "Satellite_Source"
      ),

    ndvi:
      getCell(
        row,
        headerMap,
        "NDVI"
      ),

    vegetationStatus:
      getCell(
        row,
        headerMap,
        "Vegetation_Status"
      ),

    moistureStatus:
      getCell(
        row,
        headerMap,
        "Moisture_Status"
      ),

    waterloggingStatus:
      getCell(
        row,
        headerMap,
        "Waterlogging_Status"
      ),

    stressStatus:
      getCell(
        row,
        headerMap,
        "Stress_Status"
      ),

    cloudCover:
      getCell(
        row,
        headerMap,
        "Cloud_Cover"
      ),

    areaSqM:
      getCell(
        row,
        headerMap,
        "Area_SqM"
      ),

    areaCent:
      getCell(
        row,
        headerMap,
        "Area_Cent"
      ),

    areaAcre:
      getCell(
        row,
        headerMap,
        "Area_Acre"
      ),

    perimeterM:
      getCell(
        row,
        headerMap,
        "Perimeter_M"
      ),

    remarks:
      getCell(
        row,
        headerMap,
        "Remarks"
      ),

    createdAt:
      getCell(
        row,
        headerMap,
        "Created_At"
      ),

    updatedAt:
      getCell(
        row,
        headerMap,
        "Updated_At"
      )
  };
}

function observationTime(
  observation
) {
  const value =
    observation.observationDate ||
    observation.createdAt ||
    observation.updatedAt ||
    "";

  const time =
    new Date(value).getTime();

  return Number.isFinite(time)
    ? time
    : 0;
}

async function readSatelliteSheet({
  sheets,
  spreadsheetId
}) {
  try {
    const response =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range:
          SATELLITE_SHEET + "!A:S"
      });

    const rows =
      response &&
      response.data &&
      Array.isArray(
        response.data.values
      )
        ? response.data.values
        : [];

    if (!rows.length) {
      return {
        success: true,
        observations: []
      };
    }

    const headers = rows[0];

    const headerMap =
      makeHeaderMap(headers);

    const observations =
      rows
        .slice(1)
        .filter(function (row) {
          return (
            row &&
            row.some(function (value) {
              return String(
                value || ""
              ).trim() !== "";
            })
          );
        })
        .map(function (row) {
          return buildObservation(
            row,
            headerMap
          );
        });

    return {
      success: true,
      observations
    };
  } catch (error) {
    console.error(
      "Satellite sheet read error:",
      error &&
      error.message
        ? error.message
        : error
    );

    return {
      success: false,
      error:
        "Satellite observation data could not be read."
    };
  }
}
async function saveSatelliteObservation({
  sheets,
  spreadsheetId,
  landId,
  farmerId = "",
  farmName = "",
  observationDate = "",
  satelliteSource = "Sentinel-2 L2A",
  ndvi = "",
  vegetationStatus = "",
  moistureStatus = "",
  waterloggingStatus = "",
  stressStatus = "",
  cloudCover = "",
  areaSqM = "",
  areaCent = "",
  areaAcre = "",
  perimeterM = "",
  remarks = ""
}) {
  const now =
    new Date().toISOString();

  const observationId =
    "SAT-" +
    Date.now();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range:
      SATELLITE_SHEET + "!A:S",
    valueInputOption:
      "USER_ENTERED",
    insertDataOption:
      "INSERT_ROWS",
    requestBody: {
      values: [
        [
          observationId,
          landId,
          farmerId,
          farmName,
          observationDate || now,
          satelliteSource,
          ndvi,
          vegetationStatus,
          moistureStatus,
          waterloggingStatus,
          stressStatus,
          cloudCover,
          areaSqM,
          areaCent,
          areaAcre,
          perimeterM,
          remarks,
          now,
          now
        ]
      ]
    }
  });

  return {
    success: true,
    observationId
  };
}
async function getLatestSatelliteObservation({
  sheets,
  spreadsheetId,
  landId,
  farmerId
}) {
  const result =
    await readSatelliteSheet({
      sheets,
      spreadsheetId
    });

  if (!result.success) {
    return result;
  }

  const requestedLandId =
    String(landId || "")
      .trim()
      .toUpperCase();

  const requestedFarmerId =
    String(farmerId || "")
      .trim()
      .toUpperCase();

  const matching =
    result.observations
      .filter(function (
        observation
      ) {
        const savedLandId =
          String(
            observation.landId || ""
          )
            .trim()
            .toUpperCase();

        const savedFarmerId =
          String(
            observation.farmerId || ""
          )
            .trim()
            .toUpperCase();

        const landMatches =
          savedLandId ===
          requestedLandId;

        const farmerMatches =
          !requestedFarmerId ||
          !savedFarmerId ||
          savedFarmerId ===
            requestedFarmerId;

        return (
          landMatches &&
          farmerMatches
        );
      })
      .sort(function (a, b) {
        return (
          observationTime(b) -
          observationTime(a)
        );
      });

  if (!matching.length) {
    return {
      success: true,
      found: false,
      observation: null
    };
  }

  return {
    success: true,
    found: true,
    observation:
      matching[0]
  };
}

async function getSatelliteObservationHistory({
  sheets,
  spreadsheetId,
  landId,
  farmerId,
  limit
}) {
  const result =
    await readSatelliteSheet({
      sheets,
      spreadsheetId
    });

  if (!result.success) {
    return result;
  }

  const requestedLandId =
    String(landId || "")
      .trim()
      .toUpperCase();

  const requestedFarmerId =
    String(farmerId || "")
      .trim()
      .toUpperCase();

  let observations =
    result.observations
      .filter(function (
        observation
      ) {
        const savedLandId =
          String(
            observation.landId || ""
          )
            .trim()
            .toUpperCase();

        const savedFarmerId =
          String(
            observation.farmerId || ""
          )
            .trim()
            .toUpperCase();

        const landMatches =
          savedLandId ===
          requestedLandId;

        const farmerMatches =
          !requestedFarmerId ||
          !savedFarmerId ||
          savedFarmerId ===
            requestedFarmerId;

        return (
          landMatches &&
          farmerMatches
        );
      })
      .sort(function (a, b) {
        return (
          observationTime(b) -
          observationTime(a)
        );
      });

  const safeLimit =
    Number(limit);

  if (
    Number.isFinite(safeLimit) &&
    safeLimit > 0
  ) {
    observations =
      observations.slice(
        0,
        safeLimit
      );
  }

  return {
    success: true,
    found:
      observations.length > 0,
    count:
      observations.length,
    observations
  };
}

module.exports = {
  getLatestSatelliteObservation,
  getSatelliteObservationHistory,
  getCopernicusAccessToken,
  getLatestSentinel2Scene,
  getSentinel2Ndvi,
  saveSatelliteObservation
};
