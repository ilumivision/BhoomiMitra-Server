"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isValidLandId,
  isSatelliteExitCommand,
  getSatelliteDiagnosticAccess,
  getSatelliteDiagnosticLandConfig,
  selectSuitableSentinel2Scenes,
  getSentinel2Ndvi,
  getSentinel2NdviForScene,
  saveSatelliteObservation,
  getSatelliteObservationHistory,
  isStaleObservation,
  formatSatelliteFailureMessage,
  formatSatelliteHealthReply,
  formatSatelliteHistoryReply,
  deduplicateSatelliteObservations
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

test("non-production land diagnostics require an exact approved test identity", function () {
  assert.equal(getSatelliteDiagnosticLandConfig({}).ready, false);
  assert.equal(getSatelliteDiagnosticLandConfig({
    SATELLITE_DIAGNOSTIC_LAND_ID: "BM-L-000003",
    SATELLITE_DIAGNOSTIC_FARMER_ID: "BM-F-000001",
    SATELLITE_DIAGNOSTIC_WHATSAPP: "invalid"
  }).ready, false);
  assert.deepEqual(getSatelliteDiagnosticLandConfig({
    SATELLITE_DIAGNOSTIC_LAND_ID: "BM-L-000003",
    SATELLITE_DIAGNOSTIC_FARMER_ID: "BM-F-000001",
    SATELLITE_DIAGNOSTIC_WHATSAPP: "+91 98765 43210"
  }), {
    ready: true,
    landId: "BM-L-000003",
    farmerId: "BM-F-000001",
    whatsapp: "919876543210"
  });
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

test("satellite history collapses repeated legacy mosaic rows without treating them as independent acquisitions", async function () {
  const legacyRows = [
    "2026-08-25T10:00:00.000Z",
    "2026-08-26T10:00:00.000Z",
    "2026-08-27T10:00:00.000Z",
    "2026-08-29T10:00:00.000Z",
    "2026-08-30T10:00:00.000Z"
  ].map(function (date, index) {
    const row = observationRow({
      id: "SAT-LEGACY-" + index,
      sceneId: "",
      date,
      ndvi: 0.517,
      createdAt: date
    });
    row[11] = 0;
    row[16] =
      "Image quality: Moderate | legacy observation";
    return row;
  });
  const fixture = makeSatelliteSheets(legacyRows);
  const history = await getSatelliteObservationHistory({
    sheets: fixture.sheets,
    spreadsheetId: "sheet-id",
    landId: "BM-L-000003",
    farmerId: "",
    limit: 5
  });

  assert.equal(history.rawCount, 5);
  assert.equal(history.uniqueCount, 1);
  assert.equal(history.collapsedCount, 4);
  assert.equal(history.count, 1);
  assert.equal(history.observations[0].duplicateCount, 5);
  assert.equal(
    history.observations[0].observationDate,
    "2026-08-30T10:00:00.000Z"
  );

  const reply = formatSatelliteHistoryReply({
    land: {
      landId: "BM-L-000003",
      farmName: "Manjadi home land"
    },
    history,
    language: "English"
  });

  assert.match(
    reply,
    /Recorded date: 30-08-2026 — 0\.517 — Moderate vegetation/
  );
  assert.match(reply, /stored historical data/i);
  assert.doesNotMatch(reply, /Duplicate-like/);
  assert.doesNotMatch(reply, /Equivalent stored rows/);
  assert.doesNotMatch(reply, /Scene ID/);
});

test("history deduplication uses scene identity for reliable observations and preserves distinct legacy measurements", function () {
  const reliable = {
    observationId: "SAT-NEW-1",
    observationDate: "2026-10-10T05:30:00.000Z",
    sceneId: "S2-SCENE-A",
    ndvi: 0.55
  };
  const rows = deduplicateSatelliteObservations([
    reliable,
    { ...reliable, observationId: "SAT-NEW-2", ndvi: 0.56 },
    {
      observationId: "SAT-LEGACY-1",
      observationDate: "2026-08-30T10:00:00.000Z",
      sceneId: "",
      satelliteSource: "Sentinel-2 L2A",
      ndvi: 0.517,
      cloudCover: 0,
      imageQualityStatus: "Moderate"
    },
    {
      observationId: "SAT-LEGACY-2",
      observationDate: "2026-08-29T10:00:00.000Z",
      sceneId: "",
      satelliteSource: "Sentinel-2 L2A",
      ndvi: 0.518,
      cloudCover: 0,
      imageQualityStatus: "Moderate"
    }
  ]);

  assert.equal(rows.length, 3);
  assert.equal(rows[0].duplicateCount, 2);
  assert.equal(rows[1].duplicateCount, 1);
  assert.equal(rows[2].duplicateCount, 1);
});

test("processing timestamps use a Recorded date label and remain unverified", function () {
  const reply = formatSatelliteHistoryReply({
    land: {
      landId: "BM-L-000003",
      farmName: "Manjadi home land"
    },
    history: {
      observations: [
        {
          observationDate: "",
          createdAt: "2026-08-30T10:00:00.000Z",
          sceneId: "S2-WITHOUT-ACQUISITION-DATE",
          ndvi: 0.517,
          cloudCover: 0,
          imageQualityStatus: "Moderate",
          satelliteSource: "Sentinel-2 L2A"
        }
      ]
    },
    language: "English"
  });

  assert.match(
    reply,
    /Recorded date: 30-08-2026 — 0\.517 — Moderate vegetation/
  );
  assert.match(reply, /stored historical data/i);
  assert.doesNotMatch(reply, /Observation date: 30-08-2026/);
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

test("English and Malayalam health replies show a simple farmer summary and cautious advice", function () {
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

  assert.match(english, /Satellite Crop Status/);
  assert.match(english, /Observation date: 2026-09-01/);
  assert.match(english, /Vegetation status: Good vegetation/);
  assert.match(english, /NDVI: 0\.61/);
  assert.match(english, /Cloud interference: Low \(3%\)/);
  assert.match(english, /Farmer advice:/);
  assert.match(english, /supporting indicator/i);
  assert.doesNotMatch(english, /Scene ID|Valid pixels|Source:/);
  assert.match(malayalam, /സാറ്റലൈറ്റ് വിള നില/);
  assert.match(malayalam, /നിരീക്ഷണ തീയതി: 2026-09-01/);
  assert.match(malayalam, /സസ്യവളർച്ചയുടെ നില: നല്ല സസ്യവളർച്ച/);
  assert.match(malayalam, /കർഷകനുള്ള നിർദേശം:/);
  assert.match(malayalam, /സഹായ സൂചിക/);
});

test("farmer summary uses the cautious NDVI interpretation bands", function () {
  const cases = [
    [0.19, "Very low vegetation / bare or severely stressed"],
    [0.2, "Low vegetation / possible stress"],
    [0.39, "Low vegetation / possible stress"],
    [0.4, "Moderate vegetation"],
    [0.59, "Moderate vegetation"],
    [0.6, "Good vegetation"],
    [0.79, "Good vegetation"],
    [0.8, "Very dense vegetation"]
  ];

  for (const [ndvi, expected] of cases) {
    const reply = formatSatelliteHealthReply({
      land: {
        landId: "BM-L-000003",
        farmName: "Home Farm"
      },
      result: {
        observationDate: "2026-10-10T00:00:00.000Z",
        sceneId: "S2-" + ndvi,
        averageNdvi: ndvi,
        cloudCover: 5
      },
      language: "English",
      now: new Date("2026-10-15T00:00:00.000Z")
    });

    assert.match(
      reply,
      new RegExp("Vegetation status: " + expected.replace("/", "\\/"))
    );
    assert.doesNotMatch(reply, /disease/i);
  }
});

test("blank whitespace and null NDVI values remain unavailable", function () {
  for (const averageNdvi of ["", "   ", null]) {
    const reply = formatSatelliteHealthReply({
      land: {
        landId: "BM-L-000003",
        farmName: "Home Farm"
      },
      result: {
        observationDate: "2026-10-10T00:00:00.000Z",
        sceneId: "S2-MISSING-NDVI",
        averageNdvi,
        vegetationStatus: "Very Low Vegetation",
        cloudCover: 5
      },
      language: "English",
      now: new Date("2026-10-15T00:00:00.000Z")
    });

    assert.match(reply, /NDVI: unavailable/);
    assert.match(reply, /Vegetation status: unavailable/);
    assert.doesNotMatch(
      reply,
      /very low vegetation|possible stress|severe stress/i
    );
  }
});

test("blank and null cloud cover remain unavailable", function () {
  for (const cloudCover of ["", null]) {
    const reply = formatSatelliteHealthReply({
      land: {
        landId: "BM-L-000003",
        farmName: "Home Farm"
      },
      result: {
        observationDate: "2026-10-10T00:00:00.000Z",
        sceneId: "S2-MISSING-CLOUD",
        averageNdvi: 0.5,
        cloudCover
      },
      language: "English",
      now: new Date("2026-10-15T00:00:00.000Z")
    });

    assert.match(reply, /Cloud interference: unavailable/);
    assert.doesNotMatch(reply, /Cloud interference: Low \(0%\)/);
  }
});

test("missing NDVI values cannot create a history trend", function () {
  for (const ndvi of ["", "   ", null]) {
    const reply = formatSatelliteHistoryReply({
      land: {
        landId: "BM-L-000003",
        farmName: "Home Farm"
      },
      history: {
        observations: [
          {
            observationDate: "2026-10-12T00:00:00.000Z",
            sceneId: "S2-MISSING-NDVI",
            ndvi
          },
          {
            observationDate: "2026-10-10T00:00:00.000Z",
            sceneId: "S2-VALID-NDVI",
            ndvi: 0.5
          }
        ]
      },
      language: "English"
    });

    assert.match(reply, /NDVI unavailable — Status unavailable/);
    assert.doesNotMatch(reply, /Trend:/);
  }
});

test("verified history dates use the Observation date label", function () {
  const reply = formatSatelliteHistoryReply({
    land: { landId: "BM-L-000003" },
    history: {
      observations: [
        {
          observationDate: "2026-10-12T00:00:00.000Z",
          createdAt: "2026-10-13T00:00:00.000Z",
          sceneId: "S2-VERIFIED-DATE",
          ndvi: 0.5
        }
      ]
    },
    language: "English"
  });

  assert.match(reply, /Observation date: 12-10-2026/);
  assert.doesNotMatch(reply, /Recorded date:/);
});

test("history falls back to clearly labelled recorded dates", function () {
  const createdReply = formatSatelliteHistoryReply({
    land: { landId: "BM-L-000003" },
    history: {
      observations: [
        {
          observationDate: "",
          createdAt: "2026-10-12T00:00:00.000Z",
          sceneId: "S2-CREATED-DATE",
          ndvi: 0.5
        }
      ]
    },
    language: "English"
  });
  const updatedReply = formatSatelliteHistoryReply({
    land: { landId: "BM-L-000003" },
    history: {
      observations: [
        {
          observationDate: null,
          createdAt: "",
          updatedAt: "2026-10-11T00:00:00.000Z",
          sceneId: "S2-UPDATED-DATE",
          ndvi: 0.5
        }
      ]
    },
    language: "English"
  });

  assert.match(createdReply, /Recorded date: 12-10-2026/);
  assert.match(updatedReply, /Recorded date: 11-10-2026/);
  assert.equal(
    (createdReply.match(/stored historical data/gi) || []).length,
    1
  );
});

test("history reports when no observation or recorded date is available", function () {
  const reply = formatSatelliteHistoryReply({
    land: { landId: "BM-L-000003" },
    history: {
      observations: [
        {
          observationDate: null,
          createdAt: "",
          updatedAt: "",
          sceneId: "S2-NO-DATE",
          ndvi: 0.5
        }
      ]
    },
    language: "English"
  });

  assert.match(reply, /Observation date unavailable/);
  assert.doesNotMatch(reply, /01-01-1970/);
  assert.equal(
    (reply.match(/stored historical data/gi) || []).length,
    1
  );
});

test("history reply shows at most three compact records and a supported trend", function () {
  const reply = formatSatelliteHistoryReply({
    land: { landId: "BM-L-000003", farmName: "Home Farm" },
    history: {
      observations: [
        {
          observationDate: "2026-10-12T00:00:00.000Z",
          sceneId: "S2-NEW",
          ndvi: 0.65
        },
        {
          observationDate: "2026-10-10T00:00:00.000Z",
          sceneId: "S2-MIDDLE",
          ndvi: 0.55
        },
        {
          observationDate: "2026-10-08T00:00:00.000Z",
          sceneId: "S2-OLD",
          ndvi: 0.45
        },
        {
          observationDate: "2026-10-06T00:00:00.000Z",
          sceneId: "S2-OLDER",
          ndvi: 0.35
        }
      ]
    },
    language: "English",
    now: new Date("2026-10-15T00:00:00.000Z")
  });

  assert.match(reply, /Observation date: 12-10-2026 — 0\.65 — Good vegetation/);
  assert.match(reply, /Observation date: 10-10-2026 — 0\.55 — Moderate vegetation/);
  assert.match(reply, /Observation date: 08-10-2026 — 0\.45 — Moderate vegetation/);
  assert.doesNotMatch(reply, /06-10-2026/);
  assert.match(reply, /Trend: Improving/);
  assert.doesNotMatch(reply, /Scene ID|Source:|Image quality/);
});

test("history does not invent a trend for identical NDVI values", function () {
  const reply = formatSatelliteHistoryReply({
    land: {
      landId: "BM-L-000003",
      farmName: "Home Farm"
    },
    history: {
      observations: [
        {
          observationDate: "2026-10-12T00:00:00.000Z",
          sceneId: "S2-A",
          ndvi: 0.52
        },
        {
          observationDate: "2026-10-10T00:00:00.000Z",
          sceneId: "S2-B",
          ndvi: 0.52
        }
      ]
    },
    language: "English"
  });

  assert.doesNotMatch(reply, /Trend:/);
});
