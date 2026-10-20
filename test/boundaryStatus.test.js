"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createLandMapAccessToken,
  handleBoundaryStatusSelection
} = require("../utils/landBoundary");

const MAP_SECRET = "test-land-map-secret";

const LAND_HEADERS = [
  "Land_ID",
  "Farmer_ID",
  "Farm_Name",
  "WhatsApp_Num",
  "Boundary_GeoJSON",
  "Boundary_Verified",
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

function makeSheets(options = {}) {
  const calls = [];
  const landRows =
    options.landRows || [];
  const boundaryRows =
    options.boundaryRows || [];
  const accessRows =
    options.accessRows || [];

  return {
    calls,
    sheets: {
      spreadsheets: {
        values: {
          async get(request) {
            calls.push(request.range);

            if (
              request.range.startsWith(
                "Land_Parcels!"
              )
            ) {
              return {
                data: {
                  values: [
                    LAND_HEADERS,
                    ...landRows
                  ]
                }
              };
            }

            if (
              request.range.startsWith(
                "Land_Boundary_Points!"
              )
            ) {
              return {
                data: {
                  values: [
                    BOUNDARY_HEADERS,
                    ...boundaryRows
                  ]
                }
              };
            }

            if (
              request.range.startsWith(
                "Land_Access!"
              )
            ) {
              return {
                data: {
                  values: [
                    ACCESS_HEADERS,
                    ...accessRows
                  ]
                }
              };
            }

            throw new Error(
              "Unexpected range: " +
              request.range
            );
          }
        }
      }
    }
  };
}

function landRow(options = {}) {
  return [
    Object.prototype.hasOwnProperty.call(options, "landId")
      ? options.landId
      : "BM-L-000003",
    Object.prototype.hasOwnProperty.call(options, "farmerId")
      ? options.farmerId
      : "BM-F-000001",
    Object.prototype.hasOwnProperty.call(options, "farmName")
      ? options.farmName
      : "Home Farm",
    Object.prototype.hasOwnProperty.call(options, "whatsapp")
      ? options.whatsapp
      : "919876543210",
    options.geoJSON || "",
    options.verified || "",
    options.updatedAt || ""
  ];
}

function boundaryPoint(options = {}) {
  return [
    options.pointId || "BM-BP-1",
    options.landId || "BM-L-000003",
    options.farmerId || "BM-F-000001",
    options.whatsapp || "919876543210",
    options.pointNo || 1,
    options.latitude || 9.2648,
    options.longitude || 76.787,
    "",
    "WhatsApp",
    options.capturedAt ||
      "2026-10-14T10:00:00.000Z",
    options.sessionId || "BM-BND-1",
    options.status || "Captured"
  ];
}

function accessRow(options = {}) {
  return [
    "ACC-1",
    options.landId || "BM-L-000003",
    options.ownerFarmerId || "BM-F-000001",
    "9876543210",
    "Authorized Farmer",
    options.authorizedWhatsapp ||
      "9123456789",
    "Worker",
    options.accessLevel || "VIEW",
    options.status || "ACTIVE",
    "2026-10-14T10:00:00.000Z",
    "9876543210",
    "",
    ""
  ];
}

function requestOptions(sheets, overrides = {}) {
  const input = {
    sheets,
    spreadsheetId: "sheet-id",
    landId: "BM-L-000003",
    farmerId: "BM-F-000001",
    whatsapp: "919876543210",
    language: "English",
    mapBaseUrl:
      "https://bhoomimitra.example",
    ...overrides
  };

  if (!Object.prototype.hasOwnProperty.call(overrides, "mapAccessToken")) {
    input.mapAccessToken = createLandMapAccessToken({
      secret: MAP_SECRET,
      landId: input.landId,
      farmerId: input.farmerId,
      whatsapp: input.whatsapp
    });
  }

  return input;
}

test("valid registered Land ID returns owner boundary status", async function () {
  const fixture = makeSheets({
    landRows: [landRow()]
  });

  const result =
    await handleBoundaryStatusSelection(
      requestOptions(fixture.sheets)
    );

  assert.equal(result.handled, true);
  assert.equal(result.returnToMenu, true);
  assert.equal(result.status.accessType, "OWNER");
  assert.equal(result.status.landId, "BM-L-000003");
});

test("invalid Land ID is rejected without reading Sheets", async function () {
  const fixture = makeSheets();

  const result =
    await handleBoundaryStatusSelection(
      requestOptions(
        fixture.sheets,
        { landId: "not-a-land-id" }
      )
    );

  assert.equal(result.handled, true);
  assert.equal(result.retry, true);
  assert.match(result.reply, /valid Land ID/i);
  assert.deepEqual(fixture.calls, []);
});

test("well-formed unknown Land ID is handled without AI fallback", async function () {
  const fixture = makeSheets();

  const result =
    await handleBoundaryStatusSelection(
      requestOptions(fixture.sheets)
    );

  assert.equal(result.handled, true);
  assert.equal(result.retry, true);
  assert.match(
    result.reply,
    /not found|do not have access/i
  );
});

test("land belonging to another farmer is denied", async function () {
  const fixture = makeSheets({
    landRows: [
      landRow({
        farmerId: "BM-F-OTHER",
        whatsapp: "919999999999"
      })
    ]
  });

  const result =
    await handleBoundaryStatusSelection(
      requestOptions(fixture.sheets)
    );

  assert.equal(result.handled, true);
  assert.equal(result.retry, true);
  assert.equal(result.status, undefined);
});

test("land with a missing Farmer_ID is denied even when WhatsApp matches", async function () {
  const fixture = makeSheets({
    landRows: [landRow({ farmerId: "" })]
  });

  const result = await handleBoundaryStatusSelection(
    requestOptions(fixture.sheets)
  );

  assert.equal(result.handled, true);
  assert.equal(result.retry, true);
  assert.equal(result.status, undefined);
});

test("matching WhatsApp never overrides an incorrect Farmer_ID", async function () {
  const fixture = makeSheets({
    landRows: [landRow({ farmerId: "BM-F-OTHER" })]
  });

  const result = await handleBoundaryStatusSelection(
    requestOptions(fixture.sheets)
  );

  assert.equal(result.handled, true);
  assert.equal(result.retry, true);
  assert.equal(result.status, undefined);
});

test("phone-only boundary ownership attempt is denied", async function () {
  const fixture = makeSheets({
    landRows: [landRow()]
  });

  const result = await handleBoundaryStatusSelection(
    requestOptions(fixture.sheets, { farmerId: "" })
  );

  assert.equal(result.handled, true);
  assert.equal(result.retry, true);
  assert.equal(result.status, undefined);
});

test("authorized farmer can view boundary status", async function () {
  const fixture = makeSheets({
    landRows: [
      landRow({
        farmerId: "BM-F-OTHER",
        whatsapp: "919999999999"
      })
    ],
    accessRows: [
      accessRow({
        ownerFarmerId: "BM-F-OTHER",
        authorizedWhatsapp:
          "9123456789"
      })
    ]
  });

  const result =
    await handleBoundaryStatusSelection(
      requestOptions(
        fixture.sheets,
        {
          farmerId: "BM-F-AUTH",
          whatsapp: "919123456789"
        }
      )
    );

  assert.equal(result.handled, true);
  assert.equal(result.returnToMenu, true);
  assert.equal(
    result.status.accessType,
    "AUTHORIZED"
  );
  assert.equal(result.status.accessLevel, "VIEW");
});

test("land without GPS points reports zero and not started", async function () {
  const fixture = makeSheets({
    landRows: [landRow()]
  });

  const result =
    await handleBoundaryStatusSelection(
      requestOptions(fixture.sheets)
    );

  assert.equal(result.status.pointCount, 0);
  assert.equal(
    result.status.mappingStatus,
    "NOT_STARTED"
  );
  assert.match(
    result.reply,
    /No GPS boundary points/i
  );
});

test("latest incomplete mapping session reports saved GPS points", async function () {
  const fixture = makeSheets({
    landRows: [landRow()],
    boundaryRows: [
      boundaryPoint({
        sessionId: "OLD",
        pointNo: 1
      }),
      boundaryPoint({
        pointId: "BM-BP-2",
        sessionId: "CURRENT",
        pointNo: 1
      }),
      boundaryPoint({
        pointId: "BM-BP-3",
        sessionId: "CURRENT",
        pointNo: 2,
        latitude: 9.265,
        longitude: 76.788
      })
    ]
  });

  const result =
    await handleBoundaryStatusSelection(
      requestOptions(fixture.sheets)
    );

  assert.equal(result.status.pointCount, 2);
  assert.equal(
    result.status.mappingStatus,
    "IN_PROGRESS"
  );
  assert.match(
    result.reply,
    /Saved GPS boundary points: 2/
  );
});

test("completed boundary reports polygon points and existing map link", async function () {
  const geoJSON = JSON.stringify({
    type: "Polygon",
    coordinates: [
      [
        [76.787, 9.2648],
        [76.788, 9.2649],
        [76.7875, 9.2655],
        [76.787, 9.2648]
      ]
    ]
  });
  const fixture = makeSheets({
    landRows: [
      landRow({ geoJSON })
    ]
  });

  const result =
    await handleBoundaryStatusSelection(
      requestOptions(fixture.sheets)
    );

  assert.equal(result.status.pointCount, 3);
  assert.equal(
    result.status.mappingStatus,
    "COMPLETED"
  );
  assert.match(
    result.reply,
    /https:\/\/bhoomimitra\.example\/land-map\/BM-L-000003\?access=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/
  );
});

test("completed boundary status never emits an unauthenticated map link", async function () {
  const fixture = makeSheets({
    landRows: [landRow({
      geoJSON: JSON.stringify({
        type: "Polygon",
        coordinates: [[
          [76.787, 9.2648],
          [76.788, 9.2649],
          [76.7875, 9.2655],
          [76.787, 9.2648]
        ]]
      })
    })]
  });
  const result = await handleBoundaryStatusSelection(
    requestOptions(fixture.sheets, { mapAccessToken: "" })
  );

  assert.equal(result.status.mappingStatus, "COMPLETED");
  assert.doesNotMatch(result.reply, /\/land-map\//);
});

test("Malayalam response uses localized boundary status text", async function () {
  const fixture = makeSheets({
    landRows: [landRow()]
  });

  const result =
    await handleBoundaryStatusSelection(
      requestOptions(
        fixture.sheets,
        { language: "Malayalam" }
      )
    );

  assert.match(
    result.reply,
    /ഭൂമിയുടെ അതിർത്തി നില/
  );
  assert.match(
    result.reply,
    /രേഖപ്പെടുത്തിയ GPS പോയിന്റുകൾ: 0/
  );
});

test("English response uses localized boundary status text", async function () {
  const fixture = makeSheets({
    landRows: [landRow()]
  });

  const result =
    await handleBoundaryStatusSelection(
      requestOptions(fixture.sheets)
    );

  assert.match(
    result.reply,
    /Land Boundary Status/
  );
  assert.match(
    result.reply,
    /Saved GPS boundary points: 0/
  );
});

test("CANCEL and Back return to the Satellite and GPS menu", async function (t) {
  for (const input of [
    "CANCEL",
    "BACK",
    "7",
    "പിന്നോട്ട്"
  ]) {
    await t.test(input, async function () {
      const fixture = makeSheets();
      const result =
        await handleBoundaryStatusSelection(
          requestOptions(
            fixture.sheets,
            { landId: input }
          )
        );

      assert.equal(result.handled, true);
      assert.equal(result.cancelled, true);
      assert.equal(result.returnToMenu, true);
      assert.deepEqual(fixture.calls, []);
    });
  }
});
