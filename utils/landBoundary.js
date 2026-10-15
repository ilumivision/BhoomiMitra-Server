const crypto = require("crypto");
const {
  checkLandAccess
} = require("./landAccess");

const LAND_SHEET = "Land_Parcels";
const BOUNDARY_SHEET = "Land_Boundary_Points";

function normalizeHeader(value) {
  return String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function makeHeaderMap(headers) {
  const map = {};

  (headers || []).forEach(function (header, index) {
    const key = normalizeHeader(header);

    if (key && map[key] === undefined) {
      map[key] = index;
    }
  });

  return map;
}

function findColumn(headerMap, aliases) {
  for (const alias of aliases) {
    const key = normalizeHeader(alias);

    if (
      Object.prototype.hasOwnProperty.call(
        headerMap,
        key
      )
    ) {
      return headerMap[key];
    }
  }

  return -1;
}

function getValue(row, headerMap, aliases) {
  const index =
    findColumn(
      headerMap,
      aliases
    );

  if (index < 0) {
    return "";
  }

  return row[index] || "";
}

function setValue(
  row,
  headerMap,
  aliases,
  value
) {
  const index =
    findColumn(
      headerMap,
      aliases
    );

  if (index < 0) {
    return false;
  }

  while (row.length <= index) {
    row.push("");
  }

  row[index] =
    value == null
      ? ""
      : value;

  return true;
}

function phoneKey(value) {
  const digits =
    String(value || "")
      .replace(/\D/g, "");

  if (digits.length > 10) {
    return digits.slice(-10);
  }

  return digits;
}

function isValidLandId(value) {
  return /^BM-L-\d{6}$/i.test(
    String(value || "").trim()
  );
}

function makeId(prefix) {
  if (
    typeof crypto.randomUUID ===
    "function"
  ) {
    return (
      prefix +
      crypto.randomUUID()
    );
  }

  return (
    prefix +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2, 10)
  );
}

function toFiniteNumber(value) {
  const numberValue =
    Number(value);

  return Number.isFinite(
    numberValue
  )
    ? numberValue
    : null;
}

function makeLocationLink(
  latitude,
  longitude
) {
  return (
    "https://maps.google.com/?q=" +
    encodeURIComponent(
      latitude +
      "," +
      longitude
    )
  );
}

function columnLetter(number) {
  let n =
    Number(number);

  let result = "";

  while (n > 0) {
    const remainder =
      (n - 1) % 26;

    result =
      String.fromCharCode(
        65 + remainder
      ) +
      result;

    n =
      Math.floor(
        (n - 1) / 26
      );
  }

  return result || "A";
}

async function readSheet(
  sheets,
  spreadsheetId,
  sheetName,
  range
) {
  const response =
    await sheets
      .spreadsheets
      .values
      .get({
        spreadsheetId,
        range:
          sheetName +
          "!" +
          (range || "A:AZ")
      });

  return (
    response &&
    response.data &&
    Array.isArray(
      response.data.values
    )
      ? response.data.values
      : []
  );
}

async function appendRow(
  sheets,
  spreadsheetId,
  sheetName,
  row
) {
  await sheets
    .spreadsheets
    .values
    .append({
      spreadsheetId,
      range:
        sheetName +
        "!A:AZ",

      valueInputOption:
        "RAW",

      insertDataOption:
        "INSERT_ROWS",

      requestBody: {
        values: [row]
      }
    });
}

async function writeWholeRow(
  sheets,
  spreadsheetId,
  sheetName,
  rowNumber,
  row,
  width
) {
  const output =
    row.slice();

  while (
    output.length <
    width
  ) {
    output.push("");
  }

  await sheets
    .spreadsheets
    .values
    .update({
      spreadsheetId,

      range:
        sheetName +
        "!A" +
        rowNumber +
        ":" +
        columnLetter(width) +
        rowNumber,

      valueInputOption:
        "RAW",

      requestBody: {
        values: [
          output.slice(
            0,
            width
          )
        ]
      }
    });
}

async function findLand({
  sheets,
  spreadsheetId,
  landId,
  whatsapp,
  farmerId
}) {
  const rows =
    await readSheet(
      sheets,
      spreadsheetId,
      LAND_SHEET,
      "A:AZ"
    );

  if (!rows.length) {
    return {
      success: false,
      error:
        "Land_Parcels header row not found."
    };
  }

  const headers =
    rows[0];

  const headerMap =
    makeHeaderMap(
      headers
    );

  const requestedLandId =
    String(
      landId || ""
    )
      .trim()
      .toLowerCase();

  const requestedPhone =
    phoneKey(
      whatsapp
    );

  const requestedFarmerId =
    String(
      farmerId || ""
    )
      .trim()
      .toLowerCase();

  for (
    let i = 1;
    i < rows.length;
    i += 1
  ) {
    const row =
      rows[i];

    const savedLandId =
      String(
        getValue(
          row,
          headerMap,
          [
            "Land_ID",
            "Land ID"
          ]
        )
      )
        .trim()
        .toLowerCase();

    if (
      !savedLandId ||
      savedLandId !==
        requestedLandId
    ) {
      continue;
    }

    const savedPhone =
      phoneKey(
        getValue(
          row,
          headerMap,
          [
            "WhatsApp_Num",
            "WhatsApp No",
            "WhatsApp",
            "WhatsApp_Number"
          ]
        )
      );

    const savedFarmerId =
      String(
        getValue(
          row,
          headerMap,
          [
            "Farmer_ID",
            "Farmer ID"
          ]
        )
      )
        .trim()
        .toLowerCase();

    const phoneMatches =
      !requestedPhone ||
      !savedPhone ||
      requestedPhone ===
        savedPhone;

    const farmerMatches =
      !requestedFarmerId ||
      !savedFarmerId ||
      requestedFarmerId ===
        savedFarmerId;

    if (
      !phoneMatches ||
      !farmerMatches
    ) {
      return {
        success: false,
        error:
          "This land does not belong to the current farmer."
      };
    }

    return {
      success: true,

      row,
      rowNumber:
        i + 1,

      headers,
      headerMap,

      land: {
        landId:
          getValue(
            row,
            headerMap,
            [
              "Land_ID",
              "Land ID"
            ]
          ),

        farmerId:
          getValue(
            row,
            headerMap,
            [
              "Farmer_ID",
              "Farmer ID"
            ]
          ),

        whatsapp:
          getValue(
            row,
            headerMap,
            [
              "WhatsApp_Num",
              "WhatsApp No",
              "WhatsApp",
              "WhatsApp_Number"
            ]
          ),

        farmName:
          getValue(
            row,
            headerMap,
            [
              "Farm_Name",
              "Farm Name",
              "Land_Name",
              "Land Name"
            ]
          )
      }
    };
  }

  return {
    success: false,
    error:
      "Registered land was not found."
  };
}
// =====================================================
// GET SAVED LAND BOUNDARY MAP DATA
// =====================================================

async function getLandBoundaryMapData({
  sheets,
  spreadsheetId,
  landId,
  farmerId,
  whatsapp
}) {
  const landResult =
    await findLand({
      sheets,
      spreadsheetId,
      landId,
      farmerId,
      whatsapp
    });

  if (
    !landResult ||
    !landResult.success
  ) {
    return landResult || {
      success: false,
      error: "Registered land was not found."
    };
  }

  const boundaryText =
    getValue(
      landResult.row,
      landResult.headerMap,
      [
        "Boundary_GeoJSON",
        "Boundary GeoJSON"
      ]
    );

  if (!boundaryText) {
    return {
      success: false,
      error:
        "Boundary mapping has not yet been completed for this land.",
      land:
        landResult.land
    };
  }

  let geoJSON;

  try {
    geoJSON =
      typeof boundaryText === "string"
        ? JSON.parse(boundaryText)
        : boundaryText;
  } catch (error) {
    return {
      success: false,
      error:
        "Saved boundary data could not be read.",
      land:
        landResult.land
    };
  }

  if (
    !geoJSON ||
    geoJSON.type !== "Polygon" ||
    !Array.isArray(
      geoJSON.coordinates
    ) ||
    !Array.isArray(
      geoJSON.coordinates[0]
    )
  ) {
    return {
      success: false,
      error:
        "A valid land boundary polygon was not found.",
      land:
        landResult.land
    };
  }

  const ring =
    geoJSON.coordinates[0];

  const points =
    ring.map(function (coordinate) {
      return {
        longitude:
          Number(coordinate[0]),
        latitude:
          Number(coordinate[1])
      };
    });
const measurements =
  calculateLandMeasurements(
    points
  );
  const updatedAt =
  getValue(
    landResult.row,
    landResult.headerMap,
    [
      "Updated_At",
      "Updated At",
      "Boundary_Updated_At",
      "Boundary Updated At"
    ]
  );

return {
  success: true,

  landId:
    landResult.land &&
    landResult.land.landId
      ? landResult.land.landId
      : landId,

  farmName:
    landResult.land &&
    landResult.land.farmName
      ? landResult.land.farmName
      : "",

  geoJSON,

  points,

 pointCount:
  Math.max(
    0,
    points.length - 1
  ),

measurements,

boundaryExists: true,

  mappedAt:
    updatedAt || ""
};
}

async function getLandBoundaryStatus({
  sheets,
  spreadsheetId,
  landId,
  farmerId,
  whatsapp
}) {
  const landResult =
    await findLand({
      sheets,
      spreadsheetId,
      landId,
      farmerId,
      whatsapp
    });

  if (
    !landResult ||
    !landResult.success
  ) {
    return landResult || {
      success: false,
      error:
        "Registered land was not found."
    };
  }

  const requestedPhone =
    phoneKey(whatsapp);
  const requestedFarmerId =
    String(farmerId || "")
      .trim()
      .toLowerCase();
  const savedPhone =
    phoneKey(
      landResult.land.whatsapp
    );
  const savedFarmerId =
    String(
      landResult.land.farmerId ||
      ""
    )
      .trim()
      .toLowerCase();
  const ownershipCheckRequested =
    Boolean(
      requestedPhone ||
      requestedFarmerId
    );
  const ownerMatches =
    Boolean(
      requestedPhone &&
      savedPhone &&
      requestedPhone === savedPhone
    ) ||
    Boolean(
      requestedFarmerId &&
      savedFarmerId &&
      requestedFarmerId === savedFarmerId
    );

  if (
    ownershipCheckRequested &&
    !ownerMatches
  ) {
    return {
      success: false,
      error:
        "This land does not belong to the current farmer."
    };
  }

  const boundaryText =
    getValue(
      landResult.row,
      landResult.headerMap,
      [
        "Boundary_GeoJSON",
        "Boundary GeoJSON"
      ]
    );

  let geoJSON = null;

  if (boundaryText) {
    try {
      geoJSON =
        typeof boundaryText === "string"
          ? JSON.parse(boundaryText)
          : boundaryText;
    } catch (error) {
      geoJSON = null;
    }
  }

  const polygonRing =
    geoJSON &&
    geoJSON.type === "Polygon" &&
    Array.isArray(geoJSON.coordinates) &&
    Array.isArray(geoJSON.coordinates[0])
      ? geoJSON.coordinates[0]
      : [];

  const boundaryExists =
    polygonRing.length >= 4;

  const boundaryRows =
    await readSheet(
      sheets,
      spreadsheetId,
      BOUNDARY_SHEET,
      "A:M"
    );

  const sessionGroups =
    new Map();

  if (boundaryRows.length) {
    const boundaryHeaderMap =
      makeHeaderMap(
        boundaryRows[0]
      );

    const requestedLandId =
      String(
        landResult.land.landId ||
        landId ||
        ""
      )
        .trim()
        .toUpperCase();

    for (
      let i = 1;
      i < boundaryRows.length;
      i += 1
    ) {
      const row = boundaryRows[i];
      const rowLandId =
        String(
          getValue(
            row,
            boundaryHeaderMap,
            [
              "Land_ID",
              "Land ID"
            ]
          )
        )
          .trim()
          .toUpperCase();
      const status =
        String(
          getValue(
            row,
            boundaryHeaderMap,
            ["Status"]
          )
        )
          .trim()
          .toUpperCase();
      const latitudeText =
        String(
          getValue(
            row,
            boundaryHeaderMap,
            ["Latitude"]
          )
        ).trim();
      const longitudeText =
        String(
          getValue(
            row,
            boundaryHeaderMap,
            ["Longitude"]
          )
        ).trim();
      const latitude =
        latitudeText
          ? toFiniteNumber(
              latitudeText
            )
          : null;
      const longitude =
        longitudeText
          ? toFiniteNumber(
              longitudeText
            )
          : null;

      if (
        rowLandId !== requestedLandId ||
        status === "CANCELLED" ||
        latitude === null ||
        longitude === null
      ) {
        continue;
      }

      const sessionId =
        String(
          getValue(
            row,
            boundaryHeaderMap,
            [
              "Boundary_Session_ID",
              "Boundary Session ID"
            ]
          ) ||
          "LEGACY"
        ).trim();
      const group =
        sessionGroups.get(sessionId) || {
          lastRowNumber: 0,
          points: []
        };

      group.lastRowNumber = i + 1;
      group.points.push({
        latitude,
        longitude
      });
      sessionGroups.set(
        sessionId,
        group
      );
    }
  }

  const latestSession =
    Array.from(
      sessionGroups.values()
    ).sort(function (a, b) {
      return (
        b.lastRowNumber -
        a.lastRowNumber
      );
    })[0] || {
      points: []
    };

  const points =
    boundaryExists
      ? polygonRing
          .slice(0, -1)
          .map(function (coordinate) {
            return {
              longitude:
                Number(coordinate[0]),
              latitude:
                Number(coordinate[1])
            };
          })
      : latestSession.points;

  const pointCount =
    points.length;

  const storedGpsCalculatedArea =
    getValue(
      landResult.row,
      landResult.headerMap,
      [
        "GPS_Calculated_Area",
        "GPS Calculated Area"
      ]
    );
  const storedGpsCalculatedAreaUnit =
    getValue(
      landResult.row,
      landResult.headerMap,
      [
        "GPS_Calculated_Area_Unit",
        "GPS Calculated Area Unit"
      ]
    );
  const polygonMeasurements =
    boundaryExists
      ? calculateLandMeasurements(
          polygonRing.map(function (coordinate) {
            return {
              longitude: Number(coordinate[0]),
              latitude: Number(coordinate[1])
            };
          })
        )
      : null;
  const hasStoredGpsArea =
    String(
      storedGpsCalculatedArea === undefined ||
      storedGpsCalculatedArea === null
        ? ""
        : storedGpsCalculatedArea
    ).trim() !== "";

  return {
    success: true,
    landId:
      landResult.land.landId ||
      landId,
    farmName:
      landResult.land.farmName ||
      "",
    boundaryExists,
    mappingStatus:
      boundaryExists
        ? "COMPLETED"
        : pointCount > 0
          ? "IN_PROGRESS"
          : "NOT_STARTED",
    pointCount,
    points,
    verified:
      getValue(
        landResult.row,
        landResult.headerMap,
        [
          "Boundary_Verified",
          "Boundary Verified"
        ]
      ),
    registeredLatitude:
      getValue(
        landResult.row,
        landResult.headerMap,
        ["Latitude", "GPS_Latitude", "GPS Latitude"]
      ),
    registeredLongitude:
      getValue(
        landResult.row,
        landResult.headerMap,
        ["Longitude", "GPS_Longitude", "GPS Longitude"]
      ),
    gpsCalculatedArea:
      polygonMeasurements
        ? polygonMeasurements.cents
        : hasStoredGpsArea
          ? storedGpsCalculatedArea
          : "",
    gpsCalculatedAreaUnit:
      polygonMeasurements
        ? "Cent"
        : hasStoredGpsArea
          ? storedGpsCalculatedAreaUnit
          : "",
    mappedAt:
      getValue(
        landResult.row,
        landResult.headerMap,
        [
          "Updated_At",
          "Updated At",
          "Boundary_Updated_At",
          "Boundary Updated At"
        ]
      )
  };
}

function formatCoordinate(latitude, longitude) {
  const lat = toFiniteNumber(latitude);
  const lng = toFiniteNumber(longitude);

  if (lat === null || lng === null) {
    return "";
  }

  return lat.toFixed(7) + ", " + lng.toFixed(7);
}

function formatGpsDetailsReply(
  status,
  language,
  mapBaseUrl
) {
  const isEnglish =
    String(language || "")
      .trim()
      .toLowerCase() === "english";
  const completed =
    status.mappingStatus === "COMPLETED";
  const baseUrl = String(mapBaseUrl || "")
    .replace(/\/+$/, "");
  const mapUrl = completed && baseUrl
    ? baseUrl +
      "/land-map/" +
      encodeURIComponent(status.landId)
    : "";
  const area = String(
    status.gpsCalculatedArea || ""
  ).trim();
  const areaUnit = String(
    status.gpsCalculatedAreaUnit || ""
  ).trim();

  if (isEnglish) {
    return [
      "📍 Land GPS Summary",
      "",
      status.farmName ? "Land: " + status.farmName : "",
      "Land ID: " + status.landId,
      area
        ? "Verified area: " + [area, areaUnit].filter(Boolean).join(" ")
        : "Verified area: Not available",
      "Boundary: " +
        (completed
          ? "Completed"
          : status.mappingStatus === "IN_PROGRESS"
            ? "Incomplete"
            : "Not started"),
      "Boundary points saved: " + status.pointCount,
      !completed && status.pointCount > 0
        ? "⚠️ The saved boundary is incomplete."
        : "",
      status.pointCount === 0
        ? "No boundary points have been saved yet."
        : "",
      mapUrl ? "Map: " + mapUrl : ""
    ].filter(Boolean).join("\n");
  }

  return [
    "📍 ഭൂമിയുടെ GPS സംഗ്രഹം",
    "",
    status.farmName ? "ഭൂമി: " + status.farmName : "",
    "ഭൂമി ID: " + status.landId,
    area
      ? "സ്ഥിരീകരിച്ച വിസ്തീർണ്ണം: " + [area, areaUnit].filter(Boolean).join(" ")
      : "സ്ഥിരീകരിച്ച വിസ്തീർണ്ണം: ലഭ്യമല്ല",
    "അതിർത്തി: " +
      (completed
        ? "പൂർത്തിയായി"
        : status.mappingStatus === "IN_PROGRESS"
          ? "പൂർത്തിയായിട്ടില്ല"
          : "ആരംഭിച്ചിട്ടില്ല"),
    "സംഭരിച്ച അതിർത്തി പോയിന്റുകൾ: " + status.pointCount,
    !completed && status.pointCount > 0
      ? "⚠️ സംഭരിച്ച അതിർത്തി അപൂർണ്ണമാണ്."
      : "",
    status.pointCount === 0
      ? "അതിർത്തി പോയിന്റുകൾ ഇതുവരെ സംഭരിച്ചിട്ടില്ല."
      : "",
    mapUrl ? "ഭൂപടം: " + mapUrl : ""
  ].filter(Boolean).join("\n");
}

async function handleGpsDetailsSelection({
  sheets,
  spreadsheetId,
  landId,
  farmerId = "",
  whatsapp = "",
  language,
  mapBaseUrl = ""
}) {
  const normalizedLandId =
    String(landId || "").trim().toUpperCase();
  const isEnglish =
    String(language || "")
      .trim()
      .toLowerCase() === "english";

  if (isBoundaryStatusExit(normalizedLandId)) {
    return {
      handled: true,
      returnToMenu: true,
      cancelled: true,
      reply: isEnglish
        ? "GPS details check cancelled."
        : "GPS വിവര പരിശോധന റദ്ദാക്കി."
    };
  }

  if (!isValidLandId(normalizedLandId)) {
    return {
      handled: true,
      retry: true,
      reply: isEnglish
        ? "⚠️ Enter a valid Land ID, for example BM-L-000003. Type CANCEL or BACK to return."
        : "⚠️ സാധുവായ ഭൂമി ID നൽകുക. ഉദാഹരണം: BM-L-000003. മടങ്ങാൻ CANCEL അല്ലെങ്കിൽ BACK നൽകുക."
    };
  }

  try {
    const status =
      await getAccessibleLandBoundaryStatus({
        sheets,
        spreadsheetId,
        landId: normalizedLandId,
        farmerId,
        whatsapp
      });

    if (!status || !status.success) {
      return {
        handled: true,
        retry: true,
        reply: isEnglish
          ? "⚠️ This registered land was not found or you do not have authorized access. Check the Land ID and try again."
          : "⚠️ ഈ ഭൂമി കണ്ടെത്താനായില്ല അല്ലെങ്കിൽ നിങ്ങൾക്ക് അംഗീകൃത പ്രവേശനമില്ല. ഭൂമി ID പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക."
      };
    }

    return {
      handled: true,
      returnToMenu: true,
      status,
      reply: formatGpsDetailsReply(
        status,
        language,
        mapBaseUrl
      )
    };
  } catch (error) {
    return {
      handled: true,
      retry: true,
      reply: isEnglish
        ? "⚠️ GPS details could not be loaded. Please try again or type CANCEL."
        : "⚠️ GPS വിവരങ്ങൾ ലഭ്യമാക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുക അല്ലെങ്കിൽ CANCEL നൽകുക."
    };
  }
}

async function getAccessibleLandBoundaryStatus({
  sheets,
  spreadsheetId,
  landId,
  farmerId = "",
  whatsapp = ""
}) {
  const ownerStatus =
    await getLandBoundaryStatus({
      sheets,
      spreadsheetId,
      landId,
      farmerId,
      whatsapp
    });

  if (
    ownerStatus &&
    ownerStatus.success
  ) {
    return {
      ...ownerStatus,
      accessType: "OWNER",
      accessLevel: "MANAGE"
    };
  }

  const sharedAccess =
    await checkLandAccess({
      sheets,
      spreadsheetId,
      landId,
      whatsapp,
      requiredLevel: "VIEW"
    });

  if (
    !sharedAccess ||
    !sharedAccess.success ||
    !sharedAccess.allowed
  ) {
    return {
      success: false,
      accessDenied: true,
      error:
        "Registered land was not found or you do not have access to it."
    };
  }

  const sharedStatus =
    await getLandBoundaryStatus({
      sheets,
      spreadsheetId,
      landId,
      farmerId: "",
      whatsapp: ""
    });

  if (
    !sharedStatus ||
    !sharedStatus.success
  ) {
    return sharedStatus || {
      success: false,
      error:
        "Land information could not be loaded."
    };
  }

  return {
    ...sharedStatus,
    accessType: "AUTHORIZED",
    accessLevel:
      sharedAccess.access &&
      sharedAccess.access.accessLevel
        ? sharedAccess.access.accessLevel
        : "VIEW"
  };
}

function isBoundaryStatusExit(value) {
  const normalized =
    String(value || "")
      .trim()
      .toUpperCase();

  return (
    normalized === "CANCEL" ||
    normalized === "BACK" ||
    normalized === "7" ||
    String(value || "").trim() ===
      "പിന്നോട്ട്"
  );
}

function formatBoundaryStatusReply(
  status,
  language,
  mapBaseUrl
) {
  const isEnglish =
    String(language || "")
      .trim()
      .toLowerCase() ===
    "english";
  const completed =
    status.mappingStatus ===
    "COMPLETED";
  const hasPoints =
    Number(status.pointCount) > 0;
  const baseUrl =
    String(mapBaseUrl || "")
      .replace(/\/+$/, "");
  const mapUrl =
    completed && baseUrl
      ? baseUrl +
        "/land-map/" +
        encodeURIComponent(
          status.landId
        )
      : "";

  if (isEnglish) {
    return [
      "📍 Land Boundary Status",
      "",
      "Land ID: " + status.landId,
      status.farmName
        ? "Land: " + status.farmName
        : "",
      "",
      "Boundary mapping: " +
        (completed
          ? "Completed"
          : "Not completed"),
      "Saved GPS boundary points: " +
        status.pointCount,
      "",
      !hasPoints
        ? "No GPS boundary points have been recorded for this land yet."
        : !completed
          ? "Boundary mapping is still incomplete."
          : "The saved boundary polygon is available.",
      !completed
        ? "Select 🗺️ Map / Boundary to start or continue boundary mapping."
        : "",
      mapUrl
        ? "Map: " + mapUrl
        : ""
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "📍 ഭൂമിയുടെ അതിർത്തി നില",
    "",
    "ഭൂമി ID: " + status.landId,
    status.farmName
      ? "ഭൂമി: " + status.farmName
      : "",
    "",
    "അതിർത്തി മാപ്പിംഗ്: " +
      (completed
        ? "പൂർത്തിയായി"
        : "പൂർത്തിയായിട്ടില്ല"),
    "രേഖപ്പെടുത്തിയ GPS പോയിന്റുകൾ: " +
      status.pointCount,
    "",
    !hasPoints
      ? "ഈ ഭൂമിയുടെ അതിർത്തി വിവരങ്ങൾ ഇതുവരെ രേഖപ്പെടുത്തിയിട്ടില്ല."
      : !completed
        ? "അതിർത്തി മാപ്പിംഗ് ഇപ്പോഴും പൂർത്തിയായിട്ടില്ല."
        : "സംരക്ഷിച്ച അതിർത്തി ഭൂപടം ലഭ്യമാണ്.",
    !completed
      ? "അതിർത്തി മാപ്പിംഗ് ആരംഭിക്കാനോ തുടരാനോ 🗺️ ഭൂപടം / അതിർത്തി തിരഞ്ഞെടുക്കുക."
      : "",
    mapUrl
      ? "ഭൂപടം: " + mapUrl
      : ""
  ]
    .filter(Boolean)
    .join("\n");
}

async function handleBoundaryStatusSelection({
  sheets,
  spreadsheetId,
  landId,
  farmerId = "",
  whatsapp = "",
  language,
  mapBaseUrl = ""
}) {
  const normalizedLandId =
    String(landId || "")
      .trim()
      .toUpperCase();
  const isEnglish =
    String(language || "")
      .trim()
      .toLowerCase() ===
    "english";

  if (
    isBoundaryStatusExit(
      normalizedLandId
    )
  ) {
    return {
      handled: true,
      returnToMenu: true,
      cancelled: true,
      reply: isEnglish
        ? "Boundary status check cancelled."
        : "അതിർത്തി നില പരിശോധന റദ്ദാക്കി."
    };
  }

  if (!isValidLandId(normalizedLandId)) {
    return {
      handled: true,
      retry: true,
      reply: isEnglish
        ? "⚠️ Please enter a valid Land ID, for example BM-L-000003. Type CANCEL or BACK to return."
        : "⚠️ സാധുവായ ഭൂമി ID നൽകുക. ഉദാഹരണം: BM-L-000003. മടങ്ങാൻ CANCEL അല്ലെങ്കിൽ BACK നൽകുക."
    };
  }

  try {
    const status =
      await getAccessibleLandBoundaryStatus({
        sheets,
        spreadsheetId,
        landId:
          normalizedLandId,
        farmerId,
        whatsapp
      });

    if (
      !status ||
      !status.success
    ) {
      return {
        handled: true,
        retry: true,
        reply: isEnglish
          ? "⚠️ This registered land was not found or you do not have access to it. Check the Land ID and try again."
          : "⚠️ ഈ ഭൂമി കണ്ടെത്താനായില്ല അല്ലെങ്കിൽ നിങ്ങൾക്ക് ഇതിലേക്കുള്ള അനുമതിയില്ല. ഭൂമി ID പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക."
      };
    }

    return {
      handled: true,
      returnToMenu: true,
      status,
      reply:
        formatBoundaryStatusReply(
          status,
          language,
          mapBaseUrl
        )
    };
  } catch (error) {
    return {
      handled: true,
      retry: true,
      reply: isEnglish
        ? "⚠️ Boundary status could not be loaded. Please try again or type CANCEL."
        : "⚠️ അതിർത്തി നില ലഭ്യമാക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുക അല്ലെങ്കിൽ CANCEL നൽകുക."
    };
  }
}

async function startBoundarySession({
  sheets,
  spreadsheetId,
  landId,
  farmerId,
  whatsapp
}) {
  if (
    !sheets ||
    !spreadsheetId
  ) {
    return {
      success: false,
      error:
        "Google Sheets configuration is missing."
    };
  }

  const landResult =
    await findLand({
      sheets,
      spreadsheetId,
      landId,
      farmerId,
      whatsapp
    });

  if (
    !landResult.success
  ) {
    return landResult;
  }

  return {
    success: true,

    sessionId:
      makeId(
        "BM-BND-"
      ),

    land:
      landResult.land
  };
}

async function getBoundaryPoints({
  sheets,
  spreadsheetId,
  sessionId
}) {
  const rows =
    await readSheet(
      sheets,
      spreadsheetId,
      BOUNDARY_SHEET,
      "A:M"
    );

  if (!rows.length) {
    return {
      success: false,

      error:
        "Land_Boundary_Points header row not found.",

      points: []
    };
  }

  const headers =
    rows[0];

  const headerMap =
    makeHeaderMap(
      headers
    );

  const requestedSession =
    String(
      sessionId || ""
    ).trim();

  const points = [];

  for (
    let i = 1;
    i < rows.length;
    i += 1
  ) {
    const row =
      rows[i];

    const rowSession =
      String(
        getValue(
          row,
          headerMap,
          [
            "Boundary_Session_ID",
            "Boundary Session ID"
          ]
        )
      ).trim();

    if (
      !rowSession ||
      rowSession !==
        requestedSession
    ) {
      continue;
    }

    const latitude =
      toFiniteNumber(
        getValue(
          row,
          headerMap,
          [
            "Latitude"
          ]
        )
      );

    const longitude =
      toFiniteNumber(
        getValue(
          row,
          headerMap,
          [
            "Longitude"
          ]
        )
      );

    const pointNo =
      Number(
        getValue(
          row,
          headerMap,
          [
            "Point_No",
            "Point No"
          ]
        )
      );

    if (
      latitude === null ||
      longitude === null
    ) {
      continue;
    }

    points.push({
      rowNumber:
        i + 1,

      pointId:
        getValue(
          row,
          headerMap,
          [
            "Boundary_Point_ID",
            "Boundary Point ID"
          ]
        ),

      pointNo:
        Number.isFinite(
          pointNo
        )
          ? pointNo
          : 0,

      latitude,
      longitude,

      status:
        getValue(
          row,
          headerMap,
          [
            "Status"
          ]
        )
    });
  }

  points.sort(
    function (a, b) {
      return (
        a.pointNo -
        b.pointNo
      );
    }
  );

  return {
    success: true,

    headers,
    headerMap,
    rows,
    points
  };
}

async function addBoundaryPoint({
  sheets,
  spreadsheetId,
  landId,
  farmerId,
  whatsapp,
  sessionId,
  latitude,
  longitude,
  gpsSource
}) {
  const lat =
    toFiniteNumber(
      latitude
    );

  const lon =
    toFiniteNumber(
      longitude
    );

  if (
    lat === null ||
    lon === null ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return {
      success: false,
      error:
        "Invalid GPS coordinates."
    };
  }

  if (!sessionId) {
    return {
      success: false,
      error:
        "Boundary session is missing."
    };
  }

  const landResult =
    await findLand({
      sheets,
      spreadsheetId,
      landId,
      farmerId,
      whatsapp
    });

  if (
    !landResult.success
  ) {
    return landResult;
  }

  const pointResult =
    await getBoundaryPoints({
      sheets,
      spreadsheetId,
      sessionId
    });

  if (
    !pointResult.success
  ) {
    return pointResult;
  }

  const duplicate =
    pointResult.points
      .some(
        function (point) {
          return (
            Math.abs(
              point.latitude -
              lat
            ) <
              0.000001 &&
            Math.abs(
              point.longitude -
              lon
            ) <
              0.000001
          );
        }
      );

  if (duplicate) {
    return {
      success: false,
      duplicate: true,

      error:
        "This GPS point is already recorded. Please move to the next boundary point."
    };
  }

  const boundaryRows =
    await readSheet(
      sheets,
      spreadsheetId,
      BOUNDARY_SHEET,
      "A:M"
    );

  if (
    !boundaryRows.length
  ) {
    return {
      success: false,
      error:
        "Land_Boundary_Points header row not found."
    };
  }

  const headers =
    boundaryRows[0];

  const headerMap =
    makeHeaderMap(
      headers
    );

  const newRow =
    new Array(
      headers.length
    ).fill("");

  const pointNo =
    pointResult.points.length +
    1;

  const now =
    new Date()
      .toISOString();

  const pointId =
    makeId(
      "BM-BP-"
    );

  setValue(
    newRow,
    headerMap,
    [
      "Boundary_Point_ID",
      "Boundary Point ID"
    ],
    pointId
  );

  setValue(
    newRow,
    headerMap,
    [
      "Land_ID",
      "Land ID"
    ],
    landResult.land.landId ||
      landId
  );

  setValue(
    newRow,
    headerMap,
    [
      "Farmer_ID",
      "Farmer ID"
    ],
    landResult.land.farmerId ||
      farmerId ||
      ""
  );

  setValue(
    newRow,
    headerMap,
    [
      "WhatsApp_Num",
      "WhatsApp No",
      "WhatsApp"
    ],
    whatsapp ||
      landResult.land.whatsapp ||
      ""
  );

  setValue(
    newRow,
    headerMap,
    [
      "Point_No",
      "Point No"
    ],
    pointNo
  );

  setValue(
    newRow,
    headerMap,
    [
      "Latitude"
    ],
    lat
  );

  setValue(
    newRow,
    headerMap,
    [
      "Longitude"
    ],
    lon
  );

  setValue(
    newRow,
    headerMap,
    [
      "Location_Link",
      "Location Link"
    ],
    makeLocationLink(
      lat,
      lon
    )
  );

  setValue(
    newRow,
    headerMap,
    [
      "GPS_Source",
      "GPS Source"
    ],
    gpsSource ||
      "WhatsApp"
  );

  setValue(
    newRow,
    headerMap,
    [
      "Captured_At",
      "Captured At"
    ],
    now
  );

  setValue(
    newRow,
    headerMap,
    [
      "Boundary_Session_ID",
      "Boundary Session ID"
    ],
    sessionId
  );

  setValue(
    newRow,
    headerMap,
    [
      "Status"
    ],
    "Captured"
  );

  await appendRow(
    sheets,
    spreadsheetId,
    BOUNDARY_SHEET,
    newRow
  );

  return {
    success: true,

    pointId,
    pointNo,

    latitude:
      lat,

    longitude:
      lon,

    totalPoints:
      pointNo,

    land:
      landResult.land
  };
}

function buildPolygonGeoJSON(
  points
) {
  if (
    !Array.isArray(
      points
    ) ||
    points.length < 3
  ) {
    return null;
  }

  const ring =
    points.map(
      function (point) {
        return [
          point.longitude,
          point.latitude
        ];
      }
    );

  const first =
    ring[0];

  const last =
    ring[
      ring.length - 1
    ];

  if (
    first[0] !==
      last[0] ||
    first[1] !==
      last[1]
  ) {
    ring.push([
      first[0],
      first[1]
    ]);
  }

  return {
    type:
      "Polygon",

    coordinates:
      [ring]
  };
}
function calculateLandMeasurements(points) {
  if (!Array.isArray(points) || points.length < 3) {
    return null;
  }

  const earthRadius = 6378137;

  function toRadians(value) {
    return (value * Math.PI) / 180;
  }

  const referenceLatitude =
    points.reduce(
      function (sum, point) {
        return sum + Number(point.latitude || 0);
      },
      0
    ) / points.length;

  const referenceLongitude =
    points.reduce(
      function (sum, point) {
        return sum + Number(point.longitude || 0);
      },
      0
    ) / points.length;

  const refLatRad =
    toRadians(referenceLatitude);

  const projectedPoints =
    points.map(function (point) {
      const latitude =
        Number(point.latitude);

      const longitude =
        Number(point.longitude);

      const x =
        earthRadius *
        toRadians(
          longitude -
          referenceLongitude
        ) *
        Math.cos(refLatRad);

      const y =
        earthRadius *
        toRadians(
          latitude -
          referenceLatitude
        );

      return {
        x,
        y
      };
    });

  let areaSum = 0;
  let perimeterMetres = 0;

  for (
    let i = 0;
    i < projectedPoints.length;
    i += 1
  ) {
    const current =
      projectedPoints[i];

    const next =
      projectedPoints[
        (i + 1) %
        projectedPoints.length
      ];

    areaSum +=
      current.x * next.y -
      next.x * current.y;

    const dx =
      next.x - current.x;

    const dy =
      next.y - current.y;

    perimeterMetres +=
      Math.sqrt(
        dx * dx +
        dy * dy
      );
  }

  const squareMetres =
    Math.abs(areaSum) / 2;

  const cents =
    squareMetres / 40.468564224;

  const acres =
    squareMetres / 4046.8564224;

  const hectares =
    squareMetres / 10000;

  return {
    squareMetres:
      Number(squareMetres.toFixed(2)),

    cents:
      Number(cents.toFixed(3)),

    acres:
      Number(acres.toFixed(4)),

    hectares:
      Number(hectares.toFixed(4)),

    perimeterMetres:
      Number(perimeterMetres.toFixed(2))
  };
}
async function completeBoundary({
  sheets,
  spreadsheetId,
  landId,
  farmerId,
  whatsapp,
  sessionId
}) {
  const landResult =
    await findLand({
      sheets,
      spreadsheetId,
      landId,
      farmerId,
      whatsapp
    });

  if (
    !landResult.success
  ) {
    return landResult;
  }

  const pointResult =
    await getBoundaryPoints({
      sheets,
      spreadsheetId,
      sessionId
    });

  if (
    !pointResult.success
  ) {
    return pointResult;
  }

  if (
    pointResult.points.length <
    3
  ) {
    return {
      success: false,

      error:
        "At least 3 boundary points are required before completing the land boundary.",

      pointCount:
        pointResult.points.length
    };
  }

  const geoJSON =
    buildPolygonGeoJSON(
      pointResult.points
    );
const measurements =
  calculateLandMeasurements(
    pointResult.points
  );
  if (!geoJSON) {
    return {
      success: false,
      error:
        "Boundary polygon could not be created."
    };
  }

  const landRow =
    landResult.row.slice();

  const landHeaderMap =
    landResult.headerMap;

  const now =
    new Date()
      .toISOString();

  const boundarySaved =
    setValue(
      landRow,
      landHeaderMap,
      [
        "Boundary_GeoJSON",
        "Boundary GeoJSON"
      ],
      JSON.stringify(
        geoJSON
      )
    );

  if (!boundarySaved) {
    return {
      success: false,

      error:
        "Boundary_GeoJSON column was not found in Land_Parcels."
    };
  }
if (measurements) {
  setValue(
    landRow,
    landHeaderMap,
    [
      "GPS_Calculated_Area",
      "GPS Calculated Area"
    ],
    measurements.cents
  );

  setValue(
    landRow,
    landHeaderMap,
    [
      "GPS_Calculated_Area_Unit",
      "GPS Calculated Area Unit"
    ],
    "Cent"
  );
}
  setValue(
    landRow,
    landHeaderMap,
    [
      "Updated_At",
      "Updated At"
    ],
    now
  );

  await writeWholeRow(
    sheets,
    spreadsheetId,
    LAND_SHEET,
    landResult.rowNumber,
    landRow,
    landResult.headers.length
  );

  const boundaryHeaders =
    pointResult.headers;

  const boundaryHeaderMap =
    pointResult.headerMap;

  for (
    const point
    of pointResult.points
  ) {
    const sourceRow =
      pointResult.rows[
        point.rowNumber -
        1
      ];

    const updatedRow =
      sourceRow.slice();

    setValue(
      updatedRow,
      boundaryHeaderMap,
      [
        "Status"
      ],
      "Completed"
    );

    await writeWholeRow(
      sheets,
      spreadsheetId,
      BOUNDARY_SHEET,
      point.rowNumber,
      updatedRow,
      boundaryHeaders.length
    );
  }

  return {
    success: true,

    landId:
      landResult.land.landId ||
      landId,

    pointCount:
      pointResult.points.length,

    geoJSON,

    geoJSONString:
      JSON.stringify(
        geoJSON
      ),

    land:
      landResult.land
  };
}

async function verifyBoundary({
  sheets,
  spreadsheetId,
  landId,
  farmerId,
  whatsapp,
  verifiedValue
}) {
  const landResult =
    await findLand({
      sheets,
      spreadsheetId,
      landId,
      farmerId,
      whatsapp
    });

  if (
    !landResult.success
  ) {
    return landResult;
  }

  const landRow =
    landResult.row.slice();

  const saved =
    setValue(
      landRow,
      landResult.headerMap,
      [
        "Boundary_Verified",
        "Boundary Verified"
      ],
      verifiedValue ||
        "Yes"
    );

  if (!saved) {
    return {
      success: false,

      error:
        "Boundary_Verified column was not found in Land_Parcels."
    };
  }

  setValue(
    landRow,
    landResult.headerMap,
    [
      "Updated_At",
      "Updated At"
    ],
    new Date()
      .toISOString()
  );

  await writeWholeRow(
    sheets,
    spreadsheetId,
    LAND_SHEET,
    landResult.rowNumber,
    landRow,
    landResult.headers.length
  );

  return {
    success: true,

    landId:
      landResult.land.landId ||
      landId
  };
}

async function cancelBoundary({
  sheets,
  spreadsheetId,
  sessionId
}) {
  const pointResult =
    await getBoundaryPoints({
      sheets,
      spreadsheetId,
      sessionId
    });

  if (
    !pointResult.success
  ) {
    return pointResult;
  }

  for (
    const point
    of pointResult.points
  ) {
    const sourceRow =
      pointResult.rows[
        point.rowNumber -
        1
      ];

    const updatedRow =
      sourceRow.slice();

    setValue(
      updatedRow,
      pointResult.headerMap,
      [
        "Status"
      ],
      "Cancelled"
    );

    await writeWholeRow(
      sheets,
      spreadsheetId,
      BOUNDARY_SHEET,
      point.rowNumber,
      updatedRow,
      pointResult.headers.length
    );
  }

  return {
    success: true,

    cancelledPoints:
      pointResult.points.length
  };
}

module.exports = {
  startBoundarySession,
  addBoundaryPoint,
  getBoundaryPoints,
  completeBoundary,
  verifyBoundary,
  cancelBoundary,
  getLandBoundaryMapData,
  getLandBoundaryStatus,
  getAccessibleLandBoundaryStatus,
  isValidLandId,
  isBoundaryStatusExit,
  formatBoundaryStatusReply,
  handleBoundaryStatusSelection,
  formatGpsDetailsReply,
  handleGpsDetailsSelection,
  buildPolygonGeoJSON
};
