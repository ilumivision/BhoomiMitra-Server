const SATELLITE_SHEET =
  "Satellite_Observations";

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
  getSatelliteObservationHistory
};
