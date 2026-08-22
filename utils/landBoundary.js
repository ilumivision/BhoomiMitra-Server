const crypto = require("crypto");

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

  boundaryExists: true,

  mappedAt:
    updatedAt || ""
};
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
  buildPolygonGeoJSON
};
