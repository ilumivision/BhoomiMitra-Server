"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isValidLandId,
  isSatelliteExitCommand,
  getSatelliteDiagnosticAccess,
  selectSuitableSentinel2Scenes,
  getSentinel2Ndvi,
  getSentinel2NdviForScene,
  saveSatelliteObservation,
  getSatelliteObservationHistory,
  isStaleObservation,
  formatSatelliteFailureMessage,
  formatSatelliteHealthReply,
  formatSatelliteHistoryReply
} = require("../utils/satellite");

const HEADERS = [
  "Observation_ID",
  "Land_ID",
  "Farmer_ID",
  "Farm_Name",
  "Observation_Date",
  "Satellite_Source",
  "NDVI",
  "Vegetation_Status",
  "Moisture_Status",
  "Waterlogging_Status",
  "Stress_Status",
  "Cloud_Cover",
  "Area_SqM",
  "Area_Cent",
  "Area_Acre",
  "Perimeter_M",
  "Remarks",
  "Created_At",
  "Updated_At"
];

const GEOMETRY = {
  type: "Polygon",
  coordinates: [[
    [76.787, 9.2648],
    [76.788, 9.2649],
    [76.7875, 9.2655],
    [76.787, 9.2648]
  ]]
};

function observationRow(options = {}) {
  return [
    options.id || "SAT-1",
    options.landId || "BM-L-000003",
    options.farmerId || "BM-F-000001",
    "Home Farm",
    options.date || "2026-10-10T05:30:00.000Z",
    "Sentinel-2 L2A",
    options.ndvi === undefined ? 0.6 : options.ndvi,
    "Healthy / Dense Vegetation",
    "Good Moisture",
    "No Waterlogging Signal",
    "Low Stress",
    5,
    1000,
    24.7,
    0.247,
    150,
    "Scene ID: " + (options.sceneId || "S2-A") +
      " | Valid pixels: 95 | Image quality: Good",
    options.createdAt || "2026-10-15T05:30:00.000Z",
    options.createdAt || "2026-10-15T05:30:00.000Z"
  ];
}

function makeSatelliteSheets(rows = []) {
  const appended = [];
  return {
    appended,
    sheets: {
      spreadsheets: {
        values: {
          async get() {
            return {
              data: { values: [HEADERS, ...rows] }
            };
          },
          async append(request) {
            appended.push(request.requestBody.values[0]);
            return { data: { updates: { updatedRows: 1 } } };
          }
        }
      }
    }
  };
}

function scene(id, date, cloud) {
  return {
    id,
    properties: {
      datetime: date,
      "eo:cloud_cover": cloud
    }
  };
}

test("Land ID validation accepts only the registered six-digit format", function () {
  assert.equal(isValidLandId("BM-L-000003"), true);
  assert.equal(isValidLandId("bm-l-000003"), true);
  assert.equal(isValidLandId("BM-L-3"), false);
  assert.equal(isValidLandId("BM-L-000003-extra"), false);
});

test("satellite flows support both CANCEL and BACK", function () {
  assert.equal(isSatelliteExitCommand("CANCEL"), true);
  assert.equal(isSatelliteExitCommand("back"), true);
  assert.equal(isSatelliteExitCommand("BM-L-000003"), false);
});

test("production diagnostic endpoints are disabled even with a valid token", function () {
  assert.deepEqual(
    getSatelliteDiagnosticAccess({
      nodeEnv: "production",
      enabled: "true",
      expectedToken: "secret",
      providedToken: "secret"
    }),
    { allowed: false, status: 404 }
  );
});

test("non-production diagnostics require explicit enablement and authentication", function () {
  assert.equal(
    getSatelliteDiagnosticAccess({
      nodeEnv: "test",
      enabled: "false",
      expectedToken: "secret",
      providedToken: "secret"
    }).status,
    404
  );
  assert.equal(
    getSatelliteDiagnosticAccess({
      nodeEnv: "test",
      enabled: "true",
      expectedToken: "secret",
      providedToken: "wrong"
    }).status,
    403
  );
});

test("scene selection keeps the latest valid scene under the cloud limit", function () {
  const selected = selectSuitableSentinel2Scenes([
    scene("too-cloudy", "2026-10-14T05:30:00.000Z", 75),
    scene("older", "2026-10-10T05:30:00.000Z", 2),
    scene("latest", "2026-10-13T05:30:00.000Z", 30),
    scene("missing-cloud", "2026-10-15T05:30:00.000Z", undefined),
    scene("bad-date", "not-a-date", 1)
  ], 40);

  assert.deepEqual(
    selected.map(function (item) { return item.id; }),
    ["latest", "older"]
  );
  assert.equal(
    selected[0].observationDate,
    "2026-10-13T05:30:00.000Z"
  );
});

test("SCL class 1 is excluded by the Sentinel processing request", async function () {
  let requestBody;
  const result = await getSentinel2NdviForScene({
    geometry: GEOMETRY,
    scene: {
      id: "S2-SCENE",
      observationDate: "2026-10-13T05:30:00.000Z",
      cloudCover: 3,
      source: "Sentinel-2 L2A"
    },
    accessToken: "test-token",
    async fetchImpl(url, options) {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        async arrayBuffer() { return new ArrayBuffer(16); }
      };
    },
    async rasterReader() {
      return [
        Float32Array.from([0.6, 0.7]),
        Float32Array.from([1, 1]),
        Float32Array.from([0.3, 0.4]),
        Float32Array.from([0, 0])
      ];
    }
  });

  assert.equal(result.success, true);
  assert.match(
    requestBody.evalscript,
    /sample\.SCL === 1/
  );
  assert.equal(
    requestBody.input.data[0].dataFilter.timeRange.from,
    "2026-10-13T05:15:00.000Z"
  );
});

test("live retrieval tries newer scenes first and skips locally poor imagery", async function () {
  let processCount = 0;
  const catalogFeatures = [
    scene("newer", "2026-10-13T05:30:00.000Z", 5),
    scene("older", "2026-10-12T05:30:00.000Z", 10)
  ];

  const result = await getSentinel2Ndvi({
    geometry: GEOMETRY,
    accessToken: "test-token",
    minValidPixelPercent: 50,
    async fetchImpl(url) {
      if (url.includes("/catalog/")) {
        return {
          ok: true,
          async json() { return { features: catalogFeatures }; }
        };
      }

      processCount += 1;
      return {
        ok: true,
        async arrayBuffer() { return new ArrayBuffer(16); }
      };
    },
    async rasterReader() {
      if (processCount === 1) {
        return [
          Float32Array.from([0.8, 0, 0, 0]),
          Float32Array.from([1, 0, 0, 0]),
          Float32Array.from([0.4, 0, 0, 0]),
          Float32Array.from([0, 1, 1, 1])
        ];
      }

      return [
        Float32Array.from([0.5, 0.6, 0.7, 0.8]),
        Float32Array.from([1, 1, 1, 1]),
        Float32Array.from([0.2, 0.3, 0.4, 0.5]),
        Float32Array.from([0, 0, 0, 0])
      ];
    }
  });

  assert.equal(processCount, 2);
  assert.equal(result.success, true);
  assert.equal(result.sceneId, "older");
  assert.equal(result.observationDate, "2026-10-12T05:30:00.000Z");
  assert.equal(result.qualityAccepted, true);
});

test("scene acquisition date is saved as Observation_Date and processing time as Created_At", async function () {
  const fixture = makeSatelliteSheets();
  const acquisitionDate = "2026-10-13T05:30:00.000Z";
  const result = await saveSatelliteObservation({
    sheets: fixture.sheets,
    spreadsheetId: "sheet-id",
    landId: "BM-L-000003",
    observationDate: acquisitionDate,
    sceneId: "S2-NEW",
    ndvi: 0.61
  });

  assert.equal(result.success, true);
  assert.equal(fixture.appended.length, 1);
  assert.equal(fixture.appended[0][4], acquisitionDate);
  assert.notEqual(fixture.appended[0][17], acquisitionDate);
  assert.ok(Number.isFinite(new Date(fixture.appended[0][17]).getTime()));
});

test("same land and Sentinel scene is not written twice", async function () {
  const fixture = makeSatelliteSheets([
    observationRow({ sceneId: "S2-DUPLICATE" })
  ]);
  const result = await saveSatelliteObservation({
    sheets: fixture.sheets,
    spreadsheetId: "sheet-id",
    landId: "bm-l-000003",
    observationDate: "2026-10-10T05:30:00.000Z",
    sceneId: "S2-DUPLICATE",
    ndvi: 0.6
  });

  assert.equal(result.success, true);
  assert.equal(result.duplicate, true);
  assert.equal(fixture.appended.length, 0);
});

test("satellite history compares NDVI only for reliable acquisition dates", async function () {
  const fixture = makeSatelliteSheets([
    observationRow({
      id: "SAT-OLD",
      sceneId: "S2-OLD",
      date: "2026-10-01T05:30:00.000Z",
      ndvi: 0.4
    }),
    observationRow({
      id: "SAT-NEW",
      sceneId: "S2-NEW",
      date: "2026-10-10T05:30:00.000Z",
      ndvi: 0.55
    }),
    observationRow({
      id: "SAT-LEGACY",
      sceneId: "",
      date: "2026-09-01T05:30:00.000Z",
      ndvi: 0.8
    })
  ]);
  fixture.sheets.spreadsheets.values.get = async function () {
    const rows = [
      observationRow({
        id: "SAT-OLD",
        sceneId: "S2-OLD",
        date: "2026-10-01T05:30:00.000Z",
        ndvi: 0.4
      }),
      observationRow({
        id: "SAT-NEW",
        sceneId: "S2-NEW",
        date: "2026-10-10T05:30:00.000Z",
        ndvi: 0.55
      })
    ];
    rows.push([
      "SAT-LEGACY", "BM-L-000003", "", "Home Farm",
      "2026-09-01T05:30:00.000Z", "Sentinel-2 L2A", 0.8,
      "", "", "", "", "", "", "", "", "",
      "legacy record", "2026-09-01T06:00:00.000Z", ""
    ]);
    return { data: { values: [HEADERS, ...rows] } };
  };

  const history = await getSatelliteObservationHistory({
    sheets: fixture.sheets,
    spreadsheetId: "sheet-id",
    landId: "BM-L-000003",
    farmerId: "",
    limit: 5
  });

  assert.equal(history.observations[0].sceneId, "S2-NEW");
  assert.equal(history.observations[0].ndviChange, 0.15);
  assert.equal(history.observations[0].ndviTrend, "IMPROVING");
  assert.equal(history.observations[2].ndviChange, null);
});

test("stale imagery and live failures are disclosed without presenting stored data as current", function () {
  assert.equal(
    isStaleObservation(
      "2026-09-01T00:00:00.000Z",
      new Date("2026-10-15T00:00:00.000Z")
    ),
    true
  );

  const failure = formatSatelliteFailureMessage(
    { reason: "NO_SUITABLE_SCENE" },
    "English",
    new Date("2026-10-15T00:00:00.000Z")
  );
  assert.match(failure, /unavailable/i);
  assert.match(failure, /No older stored observation has been shown as current/i);
});

test("English and Malayalam health replies show acquisition age, quality and advisory wording", function () {
  const input = {
    land: { landId: "BM-L-000003", farmName: "Home Farm" },
    result: {
      observationDate: "2026-09-01T00:00:00.000Z",
      satelliteSource: "Sentinel-2 L2A",
      sceneId: "S2-A",
      averageNdvi: 0.61,
      vegetationStatus: "Healthy / Dense Vegetation",
      moistureStatus: "Good Moisture",
      waterloggingStatus: "No Waterlogging Signal",
      stressStatus: "Low Stress",
      cloudCover: 3,
      validPixelPercent: 95,
      imageQualityStatus: "Good",
      healthSummary: "Generally Healthy"
    },
    now: new Date("2026-10-15T00:00:00.000Z")
  };
  const english = formatSatelliteHealthReply({
    ...input,
    language: "English"
  });
  const malayalam = formatSatelliteHealthReply({
    ...input,
    language: "Malayalam"
  });

  assert.match(english, /Observation date: 2026-09-01/);
  assert.match(english, /Imagery age: 44 day/);
  assert.match(english, /Older imagery/);
  assert.match(english, /Image quality: Good/);
  assert.match(english, /not a crop diagnosis/i);
  assert.match(malayalam, /നിരീക്ഷണ തീയതി: 2026-09-01/);
  assert.match(malayalam, /ചിത്രത്തിന്റെ പ്രായം: 44 ദിവസം/);
  assert.match(malayalam, /ഉപദേശപരമായ വിവരം മാത്രം/);
});

test("history reply labels legacy dates as unverified and includes reliable NDVI trend", function () {
  const reply = formatSatelliteHistoryReply({
    land: { landId: "BM-L-000003", farmName: "Home Farm" },
    history: {
      observations: [
        {
          observationDate: "2026-10-10T00:00:00.000Z",
          sceneId: "S2-NEW",
          ndvi: 0.55,
          ndviChange: 0.15,
          ndviTrend: "IMPROVING",
          cloudCover: 5,
          imageQualityStatus: "Good",
          satelliteSource: "Sentinel-2 L2A"
        },
        {
          observationDate: "2026-09-01T00:00:00.000Z",
          sceneId: "",
          ndvi: 0.8,
          ndviChange: null,
          ndviTrend: ""
        }
      ]
    },
    language: "English",
    now: new Date("2026-10-15T00:00:00.000Z")
  });

  assert.match(reply, /NDVI trend: Improving \(\+0\.15\)/);
  assert.match(reply, /legacy\/unverified/);
});
