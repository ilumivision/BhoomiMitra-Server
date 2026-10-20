"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createLandMapAccessToken,
  verifyLandMapAccessToken,
  getLandMapDataByAccessToken,
  getLandBoundaryMapData,
  handleGpsDetailsSelection
} = require("../utils/landBoundary");

const MAP_SECRET = "test-land-map-secret";
const TOKEN_NOW = Date.parse("2026-10-20T12:00:00.000Z");

const LAND_HEADERS = [
  "Land_ID",
  "Farmer_ID",
  "Farm_Name",
  "WhatsApp_Num",
  "Latitude",
  "Longitude",
  "Boundary_GeoJSON",
  "Boundary_Verified",
  "GPS_Calculated_Area",
  "GPS_Calculated_Area_Unit",
  "Updated_At"
];

const BOUNDARY_HEADERS = [
  "Boundary_Point_ID",
  "Land_ID",
  "Farmer_ID",
  "WhatsApp_Num",
  "Point_No",
  "Latitude",
  "Longitude",
  "Location_Link",
  "GPS_Source",
  "Captured_At",
  "Boundary_Session_ID",
  "Status"
];

const ACCESS_HEADERS = [
  "Access_ID",
  "Land_ID",
  "Owner_Farmer_ID",
  "Owner_WhatsApp",
  "Authorized_Name",
  "Authorized_WhatsApp",
  "Relationship",
  "Access_Level",
  "Status",
  "Granted_At",
  "Granted_By",
  "Revoked_At",
  "Remarks"
];

function polygon() {
  return JSON.stringify({
    type: "Polygon",
    coordinates: [[
      [76.787, 9.2648],
      [76.788, 9.2649],
      [76.7875, 9.2655],
      [76.787, 9.2648]
    ]]
  });
}

function landRow(options = {}) {
  return [
    options.landId || "BM-L-000003",
    options.farmerId || "BM-F-000001",
    options.farmName || "Home Farm",
    options.whatsapp || "919876543210",
    options.latitude === undefined ? 9.2648 : options.latitude,
    options.longitude === undefined ? 76.787 : options.longitude,
    options.geoJSON === undefined ? polygon() : options.geoJSON,
    options.verified === undefined ? "Yes" : options.verified,
    options.area === undefined ? "24.75" : options.area,
    options.areaUnit === undefined ? "Cent" : options.areaUnit,
    "2026-10-14T10:00:00.000Z"
  ];
}

function boundaryPoint(options = {}) {
  return [
    options.pointId || "BP-1",
    "BM-L-000003",
    "BM-F-000001",
    "919876543210",
    options.pointNo || 1,
    options.latitude || 9.2648,
    options.longitude || 76.787,
    "",
    "WhatsApp",
    "2026-10-14T10:00:00.000Z",
    options.sessionId || "SESSION-1",
    "Captured"
  ];
}

function accessRow() {
  return [
    "ACC-1",
    "BM-L-000003",
    "BM-F-OWNER",
    "9876543210",
    "Authorized Farmer",
    "9123456789",
    "Worker",
    "VIEW",
    "ACTIVE",
    "2026-10-14T10:00:00.000Z",
    "9876543210",
    "",
    ""
  ];
}

function makeSheets(options = {}) {
  const calls = [];
  const landRows = options.landRows || [];
  const boundaryRows = options.boundaryRows || [];
  const accessRows = options.accessRows || [];

  return {
    calls,
    sheets: {
      spreadsheets: {
        values: {
          async get(request) {
            calls.push(request.range);

            if (request.range.startsWith("Land_Parcels!")) {
              return {
                data: { values: [LAND_HEADERS, ...landRows] }
              };
            }

            if (request.range.startsWith("Land_Boundary_Points!")) {
              return {
                data: { values: [BOUNDARY_HEADERS, ...boundaryRows] }
              };
            }

            if (request.range.startsWith("Land_Access!")) {
              return {
                data: { values: [ACCESS_HEADERS, ...accessRows] }
              };
            }

            throw new Error("Unexpected range: " + request.range);
          }
        }
      }
    }
  };
}

function request(sheets, overrides = {}) {
  const input = {
    sheets,
    spreadsheetId: "sheet-id",
    landId: "BM-L-000003",
    farmerId: "BM-F-000001",
    whatsapp: "919876543210",
    language: "English",
    mapBaseUrl: "https://bhoomimitra.example",
    ...overrides
  };

  if (!Object.prototype.hasOwnProperty.call(overrides, "mapAccessToken")) {
    input.mapAccessToken = createLandMapAccessToken({
      secret: MAP_SECRET,
      landId: input.landId,
      farmerId: input.farmerId,
      whatsapp: input.whatsapp,
      now: TOKEN_NOW
    });
  }

  return input;
}

test("GPS Details accepts an owned registered Land ID and returns all GPS fields", async function () {
  const fixture = makeSheets({
    landRows: [landRow()]
  });
  const result = await handleGpsDetailsSelection(
    request(fixture.sheets)
  );

  assert.equal(result.handled, true);
  assert.equal(result.returnToMenu, true);
  assert.equal(result.status.accessType, "OWNER");
  assert.equal(result.status.points.length, 3);
  assert.match(result.reply, /Land GPS Summary/);
  assert.match(result.reply, /Land ID: BM-L-000003/);
  assert.match(result.reply, /Land: Home Farm/);
  assert.match(result.reply, /Boundary points saved: 3/);
  assert.match(result.reply, /Verified area: [0-9.]+ Cent/);
  assert.match(result.reply, /Boundary: Completed/);
  assert.doesNotMatch(result.reply, /9\.2648000, 76\.7870000/);
  assert.doesNotMatch(result.reply, /Point 1:/);
  assert.match(
    result.reply,
    /https:\/\/bhoomimitra\.example\/land-map\/BM-L-000003\?access=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/
  );
});

test("GPS Details never emits an unauthenticated land-map link", async function () {
  const fixture = makeSheets({ landRows: [landRow()] });
  const result = await handleGpsDetailsSelection(
    request(fixture.sheets, { mapAccessToken: "" })
  );

  assert.equal(result.status.accessType, "OWNER");
  assert.doesNotMatch(result.reply, /\/land-map\//);
});

test("land-map tokens are signed, land-bound, identity-bound and expiring", function () {
  const token = createLandMapAccessToken({
    secret: MAP_SECRET,
    landId: "BM-L-000003",
    farmerId: "BM-F-000001",
    whatsapp: "919876543210",
    now: TOKEN_NOW,
    ttlMs: 60_000
  });

  const valid = verifyLandMapAccessToken({
    secret: MAP_SECRET,
    token,
    landId: "BM-L-000003",
    now: TOKEN_NOW + 30_000
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.claims.farmerId, "BM-F-000001");
  assert.equal(valid.claims.whatsapp, "9876543210");

  assert.equal(verifyLandMapAccessToken({
    secret: MAP_SECRET,
    token,
    landId: "BM-L-000004",
    now: TOKEN_NOW + 30_000
  }).valid, false);
  assert.equal(verifyLandMapAccessToken({
    secret: MAP_SECRET,
    token: token.slice(0, -1) + (token.endsWith("a") ? "b" : "a"),
    landId: "BM-L-000003",
    now: TOKEN_NOW + 30_000
  }).valid, false);
  assert.equal(verifyLandMapAccessToken({
    secret: MAP_SECRET,
    token,
    landId: "BM-L-000003",
    now: TOKEN_NOW + 60_001
  }).valid, false);
});

test("land-map access rejects invalid tokens before Sheets and rechecks current ownership", async function (t) {
  for (const accessToken of ["", "not-a-token", createLandMapAccessToken({
    secret: MAP_SECRET,
    landId: "BM-L-000003",
    farmerId: "BM-F-000001",
    whatsapp: "919876543210",
    now: TOKEN_NOW - 120_000,
    ttlMs: 60_000
  })]) {
    await t.test(accessToken ? "invalid or expired token" : "missing token", async function () {
      const fixture = makeSheets({ landRows: [landRow()] });
      const result = await getLandMapDataByAccessToken({
        sheets: fixture.sheets,
        spreadsheetId: "sheet-id",
        landId: "BM-L-000003",
        accessToken,
        secret: MAP_SECRET,
        now: TOKEN_NOW
      });

      assert.equal(result.success, false);
      assert.equal(result.accessDenied, true);
      assert.deepEqual(fixture.calls, []);
      assert.doesNotMatch(JSON.stringify(result), /Home Farm|9\.2648|76\.787/);
    });
  }

  await t.test("signed token whose ownership is no longer valid", async function () {
    const fixture = makeSheets({
      landRows: [landRow({ farmerId: "BM-F-OTHER", whatsapp: "919999999999" })]
    });
    const accessToken = createLandMapAccessToken({
      secret: MAP_SECRET,
      landId: "BM-L-000003",
      farmerId: "BM-F-000001",
      whatsapp: "919876543210",
      now: TOKEN_NOW
    });
    const result = await getLandMapDataByAccessToken({
      sheets: fixture.sheets,
      spreadsheetId: "sheet-id",
      landId: "BM-L-000003",
      accessToken,
      secret: MAP_SECRET,
      now: TOKEN_NOW
    });

    assert.equal(result.success, false);
    assert.equal(result.accessDenied, true);
    assert.doesNotMatch(JSON.stringify(result), /Home Farm|9\.2648|76\.787/);
  });
});

test("valid owner and shared-access tokens can load only their authorized land map", async function () {
  const ownerFixture = makeSheets({ landRows: [landRow()] });
  const ownerToken = createLandMapAccessToken({
    secret: MAP_SECRET,
    landId: "BM-L-000003",
    farmerId: "BM-F-000001",
    whatsapp: "919876543210",
    now: TOKEN_NOW
  });
  const ownerResult = await getLandMapDataByAccessToken({
    sheets: ownerFixture.sheets,
    spreadsheetId: "sheet-id",
    landId: "BM-L-000003",
    accessToken: ownerToken,
    secret: MAP_SECRET,
    now: TOKEN_NOW
  });
  assert.equal(ownerResult.success, true);
  assert.equal(ownerResult.accessType, "OWNER");

  const sharedFixture = makeSheets({
    landRows: [landRow({ farmerId: "BM-F-OWNER", whatsapp: "919999999999" })],
    accessRows: [accessRow()]
  });
  const sharedToken = createLandMapAccessToken({
    secret: MAP_SECRET,
    landId: "BM-L-000003",
    farmerId: "BM-F-AUTH",
    whatsapp: "919123456789",
    now: TOKEN_NOW
  });
  const sharedResult = await getLandMapDataByAccessToken({
    sheets: sharedFixture.sheets,
    spreadsheetId: "sheet-id",
    landId: "BM-L-000003",
    accessToken: sharedToken,
    secret: MAP_SECRET,
    now: TOKEN_NOW
  });
  assert.equal(sharedResult.success, true);
  assert.equal(sharedResult.accessType, "AUTHORIZED");
  assert.equal(sharedResult.accessLevel, "VIEW");
});

test("GPS Details derives a missing area from the same completed polygon used by Land Map", async function () {
  const fixture = makeSheets({
    landRows: [
      landRow({ area: "", areaUnit: "" })
    ]
  });
  const mapResult =
    await getLandBoundaryMapData({
      sheets: fixture.sheets,
      spreadsheetId: "sheet-id",
      landId: "BM-L-000003",
      farmerId: "BM-F-000001",
      whatsapp: "919876543210"
    });
  const detailsResult =
    await handleGpsDetailsSelection(
      request(fixture.sheets)
    );

  assert.equal(mapResult.success, true);
  assert.equal(detailsResult.status.mappingStatus, "COMPLETED");
  assert.equal(
    detailsResult.status.gpsCalculatedArea,
    mapResult.measurements.cents
  );
  assert.equal(
    detailsResult.status.gpsCalculatedAreaUnit,
    "Cent"
  );
  assert.match(
    detailsResult.reply,
    new RegExp(
      "Verified area: " +
      mapResult.measurements.cents +
      " Cent"
    )
  );
  assert.doesNotMatch(
    detailsResult.reply,
    /Verified area: Not available/
  );
});

test("authorized VIEW user can retrieve GPS details", async function () {
  const fixture = makeSheets({
    landRows: [
      landRow({
        farmerId: "BM-F-OWNER",
        whatsapp: "919999999999"
      })
    ],
    accessRows: [accessRow()]
  });
  const result = await handleGpsDetailsSelection(
    request(fixture.sheets, {
      farmerId: "BM-F-AUTH",
      whatsapp: "919123456789"
    })
  );

  assert.equal(result.status.accessType, "AUTHORIZED");
  assert.equal(result.status.accessLevel, "VIEW");
  assert.match(result.reply, /Land GPS Summary/);
});

test("unauthorized GPS Details access is denied", async function () {
  const fixture = makeSheets({
    landRows: [
      landRow({
        farmerId: "BM-F-OWNER",
        whatsapp: "919999999999"
      })
    ]
  });
  const result = await handleGpsDetailsSelection(
    request(fixture.sheets, {
      farmerId: "BM-F-OTHER",
      whatsapp: "919111111111"
    })
  );

  assert.equal(result.retry, true);
  assert.match(result.reply, /authorized access/i);
});

test("invalid Land IDs are rejected before any Sheets call", async function () {
  const fixture = makeSheets();
  const result = await handleGpsDetailsSelection(
    request(fixture.sheets, { landId: "BM-L-3" })
  );

  assert.equal(result.retry, true);
  assert.match(result.reply, /valid Land ID/i);
  assert.deepEqual(fixture.calls, []);
});

test("incomplete GPS boundary is reported without a map link", async function () {
  const fixture = makeSheets({
    landRows: [landRow({ geoJSON: "", area: "" })],
    boundaryRows: [
      boundaryPoint(),
      boundaryPoint({ pointId: "BP-2", pointNo: 2, latitude: 9.265 })
    ]
  });
  const result = await handleGpsDetailsSelection(
    request(fixture.sheets)
  );

  assert.equal(result.status.mappingStatus, "IN_PROGRESS");
  assert.match(result.reply, /boundary is incomplete/i);
  assert.doesNotMatch(result.reply, /\/land-map\//);
});

test("Malayalam GPS Details response follows the saved language", async function () {
  const fixture = makeSheets({ landRows: [landRow()] });
  const result = await handleGpsDetailsSelection(
    request(fixture.sheets, { language: "Malayalam" })
  );

  assert.match(result.reply, /ഭൂമിയുടെ GPS സംഗ്രഹം/);
  assert.match(result.reply, /സംഭരിച്ച അതിർത്തി പോയിന്റുകൾ/);
});

test("GPS Details handles both CANCEL and BACK without reading Sheets", async function (t) {
  for (const landId of ["CANCEL", "BACK"]) {
    await t.test(landId, async function () {
      const fixture = makeSheets();
      const result = await handleGpsDetailsSelection(
        request(fixture.sheets, { landId })
      );

      assert.equal(result.cancelled, true);
      assert.equal(result.returnToMenu, true);
      assert.deepEqual(fixture.calls, []);
    });
  }
});
