const SATELLITE_SHEET =
  "Satellite_Observations";
const DEFAULT_SENTINEL_DAYS_BACK = 30;
const DEFAULT_MAX_CATALOG_CLOUD = 40;
const DEFAULT_MAX_LOCAL_CLOUD = 50;
const DEFAULT_MIN_VALID_PIXELS = 25;
const DEFAULT_STALE_AFTER_DAYS = 14;
let copernicusTokenCache = {
  accessToken: "",
  expiresAt: 0
};

function normalizeText(value) {
  return String(value || "").trim();
}

function isEnglishLanguage(language) {
  return normalizeText(language).toLowerCase() ===
    "english";
}

function isValidLandId(landId) {
  return /^BM-L-\d{6}$/i.test(
    normalizeText(landId)
  );
}

function isSatelliteExitCommand(value) {
  const normalized =
    normalizeText(value).toUpperCase();

  return normalized === "CANCEL" ||
    normalized === "BACK";
}

function getSatelliteDiagnosticAccess({
  nodeEnv,
  enabled,
  expectedToken,
  providedToken
}) {
  if (
    normalizeText(nodeEnv).toLowerCase() ===
    "production"
  ) {
    return {
      allowed: false,
      status: 404
    };
  }

  if (
    normalizeText(enabled).toLowerCase() !==
    "true"
  ) {
    return {
      allowed: false,
      status: 404
    };
  }

  const expected = normalizeText(expectedToken);
  const provided = normalizeText(providedToken);

  if (!expected || !provided || expected !== provided) {
    return {
      allowed: false,
      status: 403
    };
  }

  return {
    allowed: true,
    status: 200
  };
}

function sceneCloudCover(feature) {
  const value =
    feature && feature.properties
      ? Number(
          feature.properties["eo:cloud_cover"]
        )
      : NaN;

  return Number.isFinite(value)
    ? value
    : null;
}

function sceneObservationDate(feature) {
  return normalizeText(
    feature && feature.properties
      ? feature.properties.datetime
      : ""
  );
}

function sceneTime(feature) {
  const time = new Date(
    sceneObservationDate(feature)
  ).getTime();

  return Number.isFinite(time) ? time : 0;
}

function selectSuitableSentinel2Scenes(
  features,
  maxCloudCover = DEFAULT_MAX_CATALOG_CLOUD
) {
  const cloudLimit = Number(maxCloudCover);
  const safeCloudLimit = Number.isFinite(cloudLimit)
    ? cloudLimit
    : DEFAULT_MAX_CATALOG_CLOUD;

  return (Array.isArray(features) ? features : [])
    .filter(function (feature) {
      const observationDate =
        sceneObservationDate(feature);
      const cloudCover =
        sceneCloudCover(feature);

      return Boolean(
        feature &&
        normalizeText(feature.id) &&
        observationDate &&
        sceneTime(feature) > 0 &&
        cloudCover !== null &&
        cloudCover <= safeCloudLimit
      );
    })
    .sort(function (a, b) {
      return sceneTime(b) - sceneTime(a);
    })
    .map(function (feature) {
      return {
        id: normalizeText(feature.id),
        observationDate:
          sceneObservationDate(feature),
        cloudCover:
          sceneCloudCover(feature),
        source: "Sentinel-2 L2A"
      };
    });
}

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
async function getSuitableSentinel2Scenes({
  geometry,
  daysBack = DEFAULT_SENTINEL_DAYS_BACK,
  maxCloudCover = DEFAULT_MAX_CATALOG_CLOUD,
  limit = 20,
  accessToken = "",
  fetchImpl = fetch
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

  const token = accessToken ||
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
    await fetchImpl(catalogUrl, {
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
        filter: {
          op: "<=",
          args: [
            {
              property: "eo:cloud_cover"
            },
            Number(maxCloudCover)
          ]
        },
        "filter-lang": "cql2-json",
        limit:
          Math.max(
            1,
            Math.min(100, Number(limit) || 20)
          )
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

  const scenes = selectSuitableSentinel2Scenes(
    data.features,
    maxCloudCover
  );

  return {
    success: true,
    found: scenes.length > 0,
    scenes
  };
}

async function getLatestSentinel2Scene(options) {
  const result =
    await getSuitableSentinel2Scenes(options);

  if (!result.found) {
    return {
      success: true,
      found: false,
      scene: null
    };
  }

  return {
    success: true,
    found: true,
    scene: result.scenes[0]
  };
}
async function getSentinel2NdviForScene({
  geometry,
  scene,
  maxLocalCloud = DEFAULT_MAX_LOCAL_CLOUD,
  minValidPixelPercent = DEFAULT_MIN_VALID_PIXELS,
  accessToken = "",
  fetchImpl = fetch,
  rasterReader
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

  if (
    !scene ||
    !normalizeText(scene.id) ||
    !scene.observationDate ||
    !Number.isFinite(
      new Date(scene.observationDate).getTime()
    )
  ) {
    throw new Error(
      "Valid Sentinel-2 scene metadata is required."
    );
  }

  const token = accessToken ||
    await getCopernicusAccessToken();

  const acquisitionTime =
    new Date(scene.observationDate).getTime();
  const startDate =
    new Date(acquisitionTime - 15 * 60 * 1000);
  const endDate =
    new Date(acquisitionTime + 15 * 60 * 1000);

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
    sample.SCL === 1 ||
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
    await fetchImpl(processUrl, {
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
                  "mostRecent",
                maxCloudCoverage:
                  Number(scene.cloudCover)
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

let rasters;

if (typeof rasterReader === "function") {
  rasters = await rasterReader(arrayBuffer);
} else {
  const { fromArrayBuffer } =
    await import("geotiff");

  const tiff =
    await fromArrayBuffer(
      arrayBuffer
    );

  const image =
    await tiff.getImage();

  rasters = await image.readRasters();
}

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
    reason: "NO_VALID_PIXELS",
    sceneId: scene.id,
    observationDate:
      scene.observationDate,
    catalogCloudCover:
      scene.cloudCover,
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

const qualityAccepted =
  cloudCover <= Number(maxLocalCloud) &&
  validPixelPercent >=
    Number(minValidPixelPercent);


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
  qualityAccepted,
  sceneId: scene.id,
  observationDate:
    scene.observationDate,
  catalogCloudCover:
    scene.cloudCover,
  satelliteSource:
    scene.source || "Sentinel-2 L2A",
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

async function getSentinel2Ndvi({
  geometry,
  daysBack = DEFAULT_SENTINEL_DAYS_BACK,
  maxCatalogCloud = DEFAULT_MAX_CATALOG_CLOUD,
  maxLocalCloud = DEFAULT_MAX_LOCAL_CLOUD,
  minValidPixelPercent = DEFAULT_MIN_VALID_PIXELS,
  maxSceneAttempts = 5,
  accessToken = "",
  fetchImpl = fetch,
  rasterReader
}) {
  const token = accessToken ||
    await getCopernicusAccessToken();
  const catalogResult =
    await getSuitableSentinel2Scenes({
      geometry,
      daysBack,
      maxCloudCover: maxCatalogCloud,
      limit: 20,
      accessToken: token,
      fetchImpl
    });

  if (
    !catalogResult ||
    !catalogResult.found ||
    !catalogResult.scenes.length
  ) {
    return {
      success: false,
      reason: "NO_SUITABLE_SCENE",
      error:
        "No recent Sentinel-2 scene met the cloud-cover criteria."
    };
  }

  const attempts = Math.max(
    1,
    Math.min(
      catalogResult.scenes.length,
      Number(maxSceneAttempts) || 5
    )
  );
  let lastRejected = null;

  for (let index = 0; index < attempts; index += 1) {
    let result;

    try {
      result =
        await getSentinel2NdviForScene({
          geometry,
          scene: catalogResult.scenes[index],
          maxLocalCloud,
          minValidPixelPercent,
          accessToken: token,
          fetchImpl,
          rasterReader
        });
    } catch (error) {
      result = {
        success: false,
        reason: "SCENE_PROCESSING_FAILED",
        sceneId:
          catalogResult.scenes[index].id,
        observationDate:
          catalogResult.scenes[index]
            .observationDate,
        catalogCloudCover:
          catalogResult.scenes[index]
            .cloudCover,
        error:
          error && error.message
            ? error.message
            : "Sentinel-2 scene processing failed."
      };
    }

    if (result.success && result.qualityAccepted) {
      return result;
    }

    lastRejected = result;
  }

  const processingFailed =
    lastRejected &&
    lastRejected.reason ===
      "SCENE_PROCESSING_FAILED";

  return {
    ...(lastRejected || {}),
    success: false,
    qualityRejected: !processingFailed,
    reason: processingFailed
      ? "SCENE_PROCESSING_FAILED"
      : "NO_ACCEPTABLE_IMAGE_QUALITY",
    error:
      processingFailed
        ? lastRejected.error
        : "Recent Sentinel-2 imagery did not meet local image-quality criteria."
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

function getRemarkValue(remarks, label) {
  const parts = String(remarks || "")
    .split("|")
    .map(function (part) {
      return part.trim();
    });
  const prefix =
    String(label || "").trim().toLowerCase() +
    ":";
  const match = parts.find(function (part) {
    return part.toLowerCase().startsWith(prefix);
  });

  return match
    ? match.slice(match.indexOf(":") + 1).trim()
    : "";
}

function addRemarkField(parts, label, value) {
  if (
    value === undefined ||
    value === null ||
    normalizeText(value) === ""
  ) {
    return;
  }

  parts.push(label + ": " + value);
}

function buildSatelliteRemarks({
  sceneId = "",
  catalogCloudCover = "",
  validPixelPercent = "",
  averageNdmi = "",
  imageQualityStatus = "",
  healthSummary = "",
  remarks = ""
}) {
  const parts = [];

  addRemarkField(parts, "Scene ID", sceneId);
  addRemarkField(
    parts,
    "Catalog cloud cover",
    catalogCloudCover
  );
  addRemarkField(
    parts,
    "Valid pixels",
    validPixelPercent
  );
  addRemarkField(parts, "NDMI", averageNdmi);
  addRemarkField(
    parts,
    "Image quality",
    imageQualityStatus
  );
  addRemarkField(
    parts,
    "Health summary",
    healthSummary
  );

  if (normalizeText(remarks)) {
    parts.push(normalizeText(remarks));
  }

  return parts.join(" | ");
}

function buildObservation(
  row,
  headerMap
) {
  const remarks =
    getCell(
      row,
      headerMap,
      "Remarks"
    );

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

    remarks,

    sceneId:
      getRemarkValue(
        remarks,
        "Scene ID"
      ),

    imageQualityStatus:
      getRemarkValue(
        remarks,
        "Image quality"
      ),

    validPixelPercent:
      getRemarkValue(
        remarks,
        "Valid pixels"
      ),

    averageNdmi:
      getRemarkValue(
        remarks,
        "NDMI"
      ),

    healthSummary:
      getRemarkValue(
        remarks,
        "Health summary"
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

function numericNdvi(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed) &&
    parsed >= -1 &&
    parsed <= 1
      ? parsed
      : null;
}

function hasReliableAcquisitionDate(
  observation
) {
  return Boolean(
    observation &&
    normalizeText(observation.sceneId) &&
    observationTime(observation) > 0
  );
}

function addNdviComparisons(observations) {
  const rows = Array.isArray(observations)
    ? observations
    : [];

  return rows.map(function (observation, index) {
    const previous = rows[index + 1];
    const currentNdvi = numericNdvi(
      observation && observation.ndvi
    );
    const previousNdvi = numericNdvi(
      previous && previous.ndvi
    );

    if (
      !previous ||
      !hasReliableAcquisitionDate(observation) ||
      !hasReliableAcquisitionDate(previous) ||
      observation.sceneId === previous.sceneId ||
      observationTime(observation) <=
        observationTime(previous) ||
      currentNdvi === null ||
      previousNdvi === null
    ) {
      return {
        ...observation,
        ndviChange: null,
        ndviTrend: ""
      };
    }

    const change = Number(
      (currentNdvi - previousNdvi).toFixed(3)
    );
    const trend =
      change > 0.03
        ? "IMPROVING"
        : change < -0.03
          ? "DECLINING"
          : "STABLE";

    return {
      ...observation,
      ndviChange: change,
      ndviTrend: trend
    };
  });
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
  sceneId = "",
  catalogCloudCover = "",
  validPixelPercent = "",
  averageNdmi = "",
  imageQualityStatus = "",
  healthSummary = "",
  remarks = ""
}) {
  const now =
    new Date().toISOString();
  const normalizedLandId =
    normalizeText(landId).toUpperCase();
  const normalizedSceneId =
    normalizeText(sceneId);

  if (
    normalizedSceneId &&
    !Number.isFinite(
      new Date(observationDate).getTime()
    )
  ) {
    return {
      success: false,
      error:
        "A valid Sentinel-2 acquisition date is required."
    };
  }

  if (normalizedSceneId) {
    const existing =
      await readSatelliteSheet({
        sheets,
        spreadsheetId
      });

    if (!existing.success) {
      return existing;
    }

    const duplicate =
      existing.observations.find(function (
        observation
      ) {
        return (
          normalizeText(observation.landId)
            .toUpperCase() === normalizedLandId &&
          normalizeText(observation.sceneId) ===
            normalizedSceneId
        );
      });

    if (duplicate) {
      return {
        success: true,
        duplicate: true,
        observationId:
          duplicate.observationId || ""
      };
    }
  }

  const storedRemarks =
    buildSatelliteRemarks({
      sceneId: normalizedSceneId,
      catalogCloudCover,
      validPixelPercent,
      averageNdmi,
      imageQualityStatus,
      healthSummary,
      remarks
    });

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
          normalizedLandId || landId,
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
          storedRemarks,
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

  observations =
    addNdviComparisons(observations);

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

function formatObservationDate(value) {
  const time = new Date(value).getTime();

  return Number.isFinite(time)
    ? new Date(time).toISOString().slice(0, 10)
    : "";
}

function getImageryAgeDays(
  observationDate,
  now = new Date()
) {
  const observed =
    new Date(observationDate).getTime();
  const current = new Date(now).getTime();

  if (
    !Number.isFinite(observed) ||
    !Number.isFinite(current) ||
    observed > current
  ) {
    return null;
  }

  return Math.floor(
    (current - observed) /
      (24 * 60 * 60 * 1000)
  );
}

function isStaleObservation(
  observationDate,
  now = new Date(),
  staleAfterDays = DEFAULT_STALE_AFTER_DAYS
) {
  const age = getImageryAgeDays(
    observationDate,
    now
  );

  return age !== null &&
    age > Number(staleAfterDays);
}

const MALAYALAM_STATUS = {
  "Healthy / Dense Vegetation":
    "ആരോഗ്യമുള്ള / സാന്ദ്രമായ സസ്യവളർച്ച",
  "Moderate Vegetation": "മിതമായ സസ്യവളർച്ച",
  "Low Vegetation / Possible Stress":
    "കുറഞ്ഞ സസ്യവളർച്ച / സമ്മർദ്ദ സാധ്യത",
  "Very Low Vegetation": "വളരെ കുറഞ്ഞ സസ്യവളർച്ച",
  "Good Moisture": "നല്ല ഈർപ്പം",
  "Moderate Moisture": "മിതമായ ഈർപ്പം",
  "Low Moisture": "കുറഞ്ഞ ഈർപ്പം",
  "Very Low Moisture / Possible Water Stress":
    "വളരെ കുറഞ്ഞ ഈർപ്പം / ജലസമ്മർദ്ദ സാധ്യത",
  "Low Stress": "കുറഞ്ഞ സമ്മർദ്ദം",
  "Mild Stress": "ലഘു സമ്മർദ്ദം",
  "Moderate Stress": "മിതമായ സമ്മർദ്ദം",
  "High Stress": "ഉയർന്ന സമ്മർദ്ദം",
  "No Waterlogging Signal": "വെള്ളക്കെട്ട് സൂചനയില്ല",
  "Possible Waterlogging / Excess Moisture":
    "വെള്ളക്കെട്ട് / അധിക ഈർപ്പം സാധ്യത",
  "High Moisture - Monitor":
    "ഉയർന്ന ഈർപ്പം — നിരീക്ഷിക്കുക",
  Good: "നല്ലത്",
  Moderate: "മിതം",
  "Limited / Cloud Affected":
    "പരിമിതം / മേഘബാധിതം",
  "Generally Healthy": "പൊതുവെ ആരോഗ്യകരം",
  "Moderate Condition - Monitor":
    "മിതമായ നില — നിരീക്ഷിക്കുക",
  "Attention Needed - High Crop Stress":
    "ശ്രദ്ധ ആവശ്യമാണ് — ഉയർന്ന വിള സമ്മർദ്ദം",
  "Attention Needed - Possible Excess Moisture":
    "ശ്രദ്ധ ആവശ്യമാണ് — അധിക ഈർപ്പം സാധ്യത",
  "Monitor Crop Stress": "വിള സമ്മർദ്ദം നിരീക്ഷിക്കുക",
  "Monitor Possible Water Stress":
    "ജലസമ്മർദ്ദ സാധ്യത നിരീക്ഷിക്കുക",
  "Generally Stable - Mild Stress":
    "പൊതുവെ സ്ഥിരം — ലഘു സമ്മർദ്ദം"
};

function localizeSatelliteStatus(value, language) {
  if (isEnglishLanguage(language)) {
    return normalizeText(value);
  }

  return MALAYALAM_STATUS[value] ||
    normalizeText(value);
}

function formatSatelliteSelectionPrompt(
  language,
  history = false
) {
  if (isEnglishLanguage(language)) {
    return [
      history
        ? "📊 Satellite Monitoring History"
        : "🛰️ Satellite Crop Health",
      "",
      "Please enter the registered Land ID.",
      "",
      "Example:",
      "BM-L-000003",
      "",
      "Type CANCEL or BACK to return."
    ].join("\n");
  }

  return [
    history
      ? "📊 സാറ്റലൈറ്റ് നിരീക്ഷണ ചരിത്രം"
      : "🛰️ സാറ്റലൈറ്റ് വിള ആരോഗ്യ നില",
    "",
    "രജിസ്റ്റർ ചെയ്ത ഭൂമി ID നൽകുക.",
    "",
    "ഉദാഹരണം:",
    "BM-L-000003",
    "",
    "മടങ്ങാൻ CANCEL അല്ലെങ്കിൽ BACK നൽകുക."
  ].join("\n");
}

function formatSatelliteCancelMessage(
  language,
  history = false
) {
  if (isEnglishLanguage(language)) {
    return history
      ? "Satellite monitoring history cancelled."
      : "Satellite crop-health check cancelled.";
  }

  return history
    ? "സാറ്റലൈറ്റ് നിരീക്ഷണ ചരിത്ര പരിശോധന റദ്ദാക്കി."
    : "സാറ്റലൈറ്റ് വിള ആരോഗ്യ പരിശോധന റദ്ദാക്കി.";
}

function formatSatelliteValidationMessage(language) {
  return isEnglishLanguage(language)
    ? "⚠️ Enter a valid Land ID, for example BM-L-000003. Type CANCEL or BACK to return."
    : "⚠️ സാധുവായ ഭൂമി ID നൽകുക. ഉദാഹരണം: BM-L-000003. മടങ്ങാൻ CANCEL അല്ലെങ്കിൽ BACK നൽകുക.";
}

function formatSatelliteAccessMessage(language) {
  return isEnglishLanguage(language)
    ? "⚠️ This land was not found under your ownership, has no completed boundary, or you do not have authorized access."
    : "⚠️ ഈ ഭൂമി നിങ്ങളുടെ ഉടമസ്ഥതയിൽ കണ്ടെത്താനായില്ല, അതിർത്തി പൂർത്തിയായിട്ടില്ല, അല്ലെങ്കിൽ നിങ്ങൾക്ക് അംഗീകൃത പ്രവേശനമില്ല.";
}

function formatSatelliteFailureMessage(
  result,
  language,
  now = new Date()
) {
  const date = formatObservationDate(
    result && result.observationDate
  );
  const age = getImageryAgeDays(
    result && result.observationDate,
    now
  );
  const quality = localizeSatelliteStatus(
    result && result.imageQualityStatus,
    language
  );

  if (isEnglishLanguage(language)) {
    return [
      "⚠️ Current satellite crop health is unavailable.",
      "",
      result && result.reason === "NO_SUITABLE_SCENE"
        ? "No recent Sentinel-2 scene met the cloud-cover criteria."
        : result && result.reason === "SCENE_PROCESSING_FAILED"
          ? "The recent Sentinel-2 scene could not be processed."
          : "Recent imagery did not meet the required local image-quality criteria.",
      date ? "Observation date: " + date : "",
      age !== null ? "Imagery age: " + age + " day(s)" : "",
      quality ? "Image quality: " + quality : "",
      result && result.cloudCover !== undefined
        ? "Cloud cover: " + result.cloudCover + "%"
        : "",
      result && result.validPixelPercent !== undefined
        ? "Valid pixels: " + result.validPixelPercent + "%"
        : "",
      "",
      "No older stored observation has been shown as current. Please try again later."
    ].filter(Boolean).join("\n");
  }

  return [
    "⚠️ നിലവിലെ സാറ്റലൈറ്റ് വിള ആരോഗ്യ വിവരം ലഭ്യമല്ല.",
    "",
    result && result.reason === "NO_SUITABLE_SCENE"
      ? "മേഘാവരണ മാനദണ്ഡം പാലിക്കുന്ന പുതിയ Sentinel-2 ദൃശ്യം ലഭിച്ചില്ല."
      : result && result.reason === "SCENE_PROCESSING_FAILED"
        ? "പുതിയ Sentinel-2 ദൃശ്യം പ്രോസസ്സ് ചെയ്യാനായില്ല."
        : "പുതിയ ദൃശ്യം ആവശ്യമായ പ്രാദേശിക ചിത്രഗുണ നിലവാരം പാലിച്ചില്ല.",
    date ? "നിരീക്ഷണ തീയതി: " + date : "",
    age !== null ? "ചിത്രത്തിന്റെ പ്രായം: " + age + " ദിവസം" : "",
    quality ? "ചിത്ര ഗുണനിലവാരം: " + quality : "",
    result && result.cloudCover !== undefined
      ? "മേഘാവരണം: " + result.cloudCover + "%"
      : "",
    result && result.validPixelPercent !== undefined
      ? "സാധുവായ പിക്സലുകൾ: " + result.validPixelPercent + "%"
      : "",
    "",
    "പഴയ സംഭരിച്ച നിരീക്ഷണം നിലവിലെ വിവരമായി കാണിച്ചിട്ടില്ല. പിന്നീട് വീണ്ടും ശ്രമിക്കുക."
  ].filter(Boolean).join("\n");
}

function formatSatelliteHealthReply({
  land,
  result,
  language,
  duplicate = false,
  now = new Date()
}) {
  const english = isEnglishLanguage(language);
  const date = formatObservationDate(
    result.observationDate
  );
  const age = getImageryAgeDays(
    result.observationDate,
    now
  );
  const stale = isStaleObservation(
    result.observationDate,
    now
  );
  const localized = function (value) {
    return localizeSatelliteStatus(
      value,
      language
    );
  };

  if (english) {
    return [
      "🛰️ Satellite Crop Health",
      "",
      "Land ID: " + land.landId,
      land.farmName ? "Land: " + land.farmName : "",
      "Observation date: " + date,
      age !== null ? "Imagery age: " + age + " day(s)" : "",
      stale
        ? "⚠️ Older imagery: use this result cautiously."
        : "✅ Recent imagery",
      "Source: " + (result.satelliteSource || "Sentinel-2 L2A"),
      result.sceneId ? "Scene ID: " + result.sceneId : "",
      "",
      "NDVI: " + result.averageNdvi,
      "Vegetation: " + localized(result.vegetationStatus),
      "Moisture: " + localized(result.moistureStatus),
      "Waterlogging: " + localized(result.waterloggingStatus),
      "Stress: " + localized(result.stressStatus),
      "Cloud cover: " + result.cloudCover + "%",
      "Valid pixels: " + result.validPixelPercent + "%",
      "Image quality: " + localized(result.imageQualityStatus),
      "Summary: " + localized(result.healthSummary),
      duplicate
        ? "This scene was already stored; no duplicate record was created."
        : "Observation saved to satellite history.",
      "",
      "Advisory only: satellite indices support field monitoring and are not a crop diagnosis."
    ].filter(Boolean).join("\n");
  }

  return [
    "🛰️ സാറ്റലൈറ്റ് വിള ആരോഗ്യ നില",
    "",
    "ഭൂമി ID: " + land.landId,
    land.farmName ? "ഭൂമി: " + land.farmName : "",
    "നിരീക്ഷണ തീയതി: " + date,
    age !== null ? "ചിത്രത്തിന്റെ പ്രായം: " + age + " ദിവസം" : "",
    stale
      ? "⚠️ പഴയ ചിത്രം: ഈ ഫലം ജാഗ്രതയോടെ ഉപയോഗിക്കുക."
      : "✅ പുതിയ ചിത്രം",
    "ഉറവിടം: " + (result.satelliteSource || "Sentinel-2 L2A"),
    result.sceneId ? "സീൻ ID: " + result.sceneId : "",
    "",
    "NDVI: " + result.averageNdvi,
    "സസ്യവളർച്ച: " + localized(result.vegetationStatus),
    "ഈർപ്പം: " + localized(result.moistureStatus),
    "വെള്ളക്കെട്ട്: " + localized(result.waterloggingStatus),
    "സമ്മർദ്ദം: " + localized(result.stressStatus),
    "മേഘാവരണം: " + result.cloudCover + "%",
    "സാധുവായ പിക്സലുകൾ: " + result.validPixelPercent + "%",
    "ചിത്ര ഗുണനിലവാരം: " + localized(result.imageQualityStatus),
    "സംഗ്രഹം: " + localized(result.healthSummary),
    duplicate
      ? "ഈ സീൻ മുമ്പേ സംഭരിച്ചിട്ടുണ്ട്; പകർപ്പ് രേഖ സൃഷ്ടിച്ചില്ല."
      : "നിരീക്ഷണം സാറ്റലൈറ്റ് ചരിത്രത്തിൽ സംഭരിച്ചു.",
    "",
    "ഉപദേശപരമായ വിവരം മാത്രം: സാറ്റലൈറ്റ് സൂചികകൾ കൃഷിയിട നിരീക്ഷണത്തിന് സഹായകരമാണ്; ഇത് വിള രോഗനിർണയം അല്ല."
  ].filter(Boolean).join("\n");
}

function formatNdviTrend(observation, language) {
  if (
    !observation ||
    observation.ndviChange === null ||
    !observation.ndviTrend
  ) {
    return "";
  }

  const sign = observation.ndviChange > 0
    ? "+"
    : "";
  const labels = isEnglishLanguage(language)
    ? {
        IMPROVING: "Improving",
        DECLINING: "Declining",
        STABLE: "Stable"
      }
    : {
        IMPROVING: "മെച്ചപ്പെടുന്നു",
        DECLINING: "കുറയുന്നു",
        STABLE: "സ്ഥിരം"
      };

  return (labels[observation.ndviTrend] ||
    observation.ndviTrend) +
    " (" + sign + observation.ndviChange + ")";
}

function formatSatelliteHistoryReply({
  land,
  history,
  language,
  now = new Date()
}) {
  const english = isEnglishLanguage(language);
  const observations =
    history && Array.isArray(history.observations)
      ? history.observations
      : [];
  const header = english
    ? [
        "📊 Satellite Monitoring History",
        "",
        "Land ID: " + land.landId,
        land.farmName ? "Land: " + land.farmName : "",
        ""
      ]
    : [
        "📊 സാറ്റലൈറ്റ് നിരീക്ഷണ ചരിത്രം",
        "",
        "ഭൂമി ID: " + land.landId,
        land.farmName ? "ഭൂമി: " + land.farmName : "",
        ""
      ];

  if (!observations.length) {
    header.push(
      english
        ? "No satellite observation records are available yet."
        : "സാറ്റലൈറ്റ് നിരീക്ഷണ രേഖകൾ ഇതുവരെ ലഭ്യമല്ല."
    );
    return header.filter(Boolean).join("\n");
  }

  header.push(
    english
      ? "Records found: " + observations.length
      : "ലഭ്യമായ രേഖകൾ: " + observations.length
  );

  const entries = observations.map(function (
    observation,
    index
  ) {
    const reliable =
      hasReliableAcquisitionDate(observation);
    const date = formatObservationDate(
      observation.observationDate
    );
    const age = reliable
      ? getImageryAgeDays(
          observation.observationDate,
          now
        )
      : null;
    const stale = reliable &&
      isStaleObservation(
        observation.observationDate,
        now
      );
    const trend = formatNdviTrend(
      observation,
      language
    );

    if (english) {
      return [
        "",
        "Observation " + (index + 1),
        reliable
          ? "Acquisition date: " + date
          : "Recorded date (legacy/unverified): " + date,
        age !== null ? "Imagery age: " + age + " day(s)" : "",
        stale ? "⚠️ Older imagery" : "",
        observation.ndvi !== ""
          ? "NDVI: " + observation.ndvi
          : "",
        trend ? "NDVI trend: " + trend : "",
        observation.cloudCover !== ""
          ? "Cloud cover: " + observation.cloudCover + "%"
          : "",
        observation.imageQualityStatus
          ? "Image quality: " + observation.imageQualityStatus
          : "",
        observation.satelliteSource
          ? "Source: " + observation.satelliteSource
          : ""
      ].filter(Boolean).join("\n");
    }

    return [
      "",
      "നിരീക്ഷണം " + (index + 1),
      reliable
        ? "ചിത്രീകരണ തീയതി: " + date
        : "രേഖപ്പെടുത്തിയ തീയതി (പഴയത്/സ്ഥിരീകരിക്കാത്തത്): " + date,
      age !== null ? "ചിത്രത്തിന്റെ പ്രായം: " + age + " ദിവസം" : "",
      stale ? "⚠️ പഴയ ചിത്രം" : "",
      observation.ndvi !== ""
        ? "NDVI: " + observation.ndvi
        : "",
      trend ? "NDVI പ്രവണത: " + trend : "",
      observation.cloudCover !== ""
        ? "മേഘാവരണം: " + observation.cloudCover + "%"
        : "",
      observation.imageQualityStatus
        ? "ചിത്ര ഗുണനിലവാരം: " +
          localizeSatelliteStatus(
            observation.imageQualityStatus,
            language
          )
        : "",
      observation.satelliteSource
        ? "ഉറവിടം: " + observation.satelliteSource
        : ""
    ].filter(Boolean).join("\n");
  });

  return header.concat(entries)
    .filter(Boolean)
    .join("\n");
}

module.exports = {
  DEFAULT_MAX_CATALOG_CLOUD,
  DEFAULT_MAX_LOCAL_CLOUD,
  DEFAULT_MIN_VALID_PIXELS,
  DEFAULT_STALE_AFTER_DAYS,
  isValidLandId,
  isSatelliteExitCommand,
  getSatelliteDiagnosticAccess,
  selectSuitableSentinel2Scenes,
  getSuitableSentinel2Scenes,
  getLatestSatelliteObservation,
  getSatelliteObservationHistory,
  getCopernicusAccessToken,
  getLatestSentinel2Scene,
  getSentinel2Ndvi,
  getSentinel2NdviForScene,
  saveSatelliteObservation,
  buildSatelliteRemarks,
  addNdviComparisons,
  getImageryAgeDays,
  isStaleObservation,
  formatSatelliteSelectionPrompt,
  formatSatelliteCancelMessage,
  formatSatelliteValidationMessage,
  formatSatelliteAccessMessage,
  formatSatelliteFailureMessage,
  formatSatelliteHealthReply,
  formatSatelliteHistoryReply
};
