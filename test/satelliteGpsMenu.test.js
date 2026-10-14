"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createBhoomiMitraUI
} = require("../utils/bhoomiMitraUI");
const {
  isExplicitRegistrationExit
} = require("../utils/registrationSession");

const EXPECTED_IDS = [
  "SAT_GPS_BOUNDARY_MAP",
  "SAT_GPS_MAP",
  "SAT_GPS_BOUNDARY_STATUS",
  "SAT_GPS_DETAILS",
  "SAT_GPS_CURRENT_STATUS",
  "SAT_GPS_HISTORY",
  "SAT_GPS_ACCESS",
  "SAT_GPS_BACK"
];

const EXPECTED_COMMANDS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "A",
  "7"
];

function makeUi() {
  const calls = [];
  const ui = createBhoomiMitraUI({
    axios: {
      async post(url, body) {
        calls.push({ url, body });
        return { data: { ok: true } };
      }
    },
    phoneNumberId: "phone-id",
    whatsappToken: "token"
  });

  return { calls, ui };
}

function rowsFromCall(call) {
  return call.body.interactive.action.sections.flatMap(
    function (section) {
      return section.rows;
    }
  );
}

test("Malayalam Satellite and GPS menu uses interactive selections", async function () {
  const { calls, ui } = makeUi();

  await ui.sendSatelliteGpsMenu(
    "919847298918",
    "Malayalam"
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.type, "interactive");
  assert.equal(calls[0].body.interactive.type, "list");
  assert.match(
    calls[0].body.interactive.body.text,
    /സാറ്റലൈറ്റ് & GPS/
  );
  assert.deepEqual(
    rowsFromCall(calls[0]).map(function (row) {
      return row.title;
    }),
    [
      "🗺️ ഭൂപടം / അതിർത്തി",
      "🗺️ ഭൂമിയുടെ ഭൂപടം",
      "📍 അതിർത്തി നില",
      "📍 GPS വിവരങ്ങൾ",
      "🛰️ സാറ്റലൈറ്റ് നില",
      "📊 സാറ്റലൈറ്റ് ചരിത്രം",
      "👥 ഭൂമി പ്രവേശനം",
      "↩️ പിന്നോട്ട്"
    ]
  );
});

test("English Satellite and GPS menu uses interactive selections", async function () {
  const { calls, ui } = makeUi();

  await ui.sendSatelliteGpsMenu(
    "919847298918",
    "English"
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.interactive.type, "list");
  assert.match(
    calls[0].body.interactive.body.text,
    /Satellite & GPS/
  );
  assert.deepEqual(
    rowsFromCall(calls[0]).map(function (row) {
      return row.title;
    }),
    [
      "🗺️ Map / Boundary",
      "🗺️ View Land Map",
      "📍 Boundary Status",
      "📍 GPS Details",
      "🛰️ Satellite Status",
      "📊 Satellite History",
      "👥 Land Access",
      "↩️ Back"
    ]
  );
});

test("Satellite and GPS interactive IDs are unique and WhatsApp-safe", async function () {
  const { calls, ui } = makeUi();

  await ui.sendSatelliteGpsMenu(
    "919847298918",
    "English"
  );

  const rows = rowsFromCall(calls[0]);
  const ids = rows.map(function (row) {
    return row.id;
  });

  assert.deepEqual(ids, EXPECTED_IDS);
  assert.equal(new Set(ids).size, ids.length);
  for (const row of rows) {
    assert.ok(row.title.length <= 24);
    assert.ok(row.description.length <= 72);
  }
});

test("Malayalam and English Satellite and GPS menus use the same IDs", async function () {
  const { calls, ui } = makeUi();

  await ui.sendSatelliteGpsMenu(
    "919847298918",
    "English"
  );
  await ui.sendSatelliteGpsMenu(
    "919847298918",
    "Malayalam"
  );

  const englishIds = rowsFromCall(calls[0]).map(function (row) {
    return row.id;
  });
  const malayalamIds = rowsFromCall(calls[1]).map(function (row) {
    return row.id;
  });

  assert.deepEqual(malayalamIds, englishIds);
});

test("boundary mapping click routes to existing command 1", function () {
  assert.equal(
    makeUi().ui.getSatelliteGpsCommand("SAT_GPS_BOUNDARY_MAP"),
    "1"
  );
});

test("land map click routes to existing command 2", function () {
  assert.equal(
    makeUi().ui.getSatelliteGpsCommand("SAT_GPS_MAP"),
    "2"
  );
});

test("boundary status click routes to existing command 3", function () {
  assert.equal(
    makeUi().ui.getSatelliteGpsCommand("SAT_GPS_BOUNDARY_STATUS"),
    "3"
  );
});

test("GPS details click routes to existing command 4", function () {
  assert.equal(
    makeUi().ui.getSatelliteGpsCommand("SAT_GPS_DETAILS"),
    "4"
  );
});

test("satellite current status click routes to existing command 5", function () {
  assert.equal(
    makeUi().ui.getSatelliteGpsCommand("SAT_GPS_CURRENT_STATUS"),
    "5"
  );
});

test("satellite monitoring history click routes to existing command 6", async function () {
  const { calls, ui } = makeUi();

  assert.equal(
    ui.getSatelliteGpsCommand("SAT_GPS_HISTORY"),
    "6"
  );

  await ui.sendSatelliteGpsMenu(
    "919847298918",
    "English"
  );

  const historyRow = rowsFromCall(calls[0])[5];
  assert.match(
    historyRow.description,
    /satellite monitoring history/i
  );
  assert.doesNotMatch(
    historyRow.title + " " + historyRow.description,
    /usage history/i
  );
});

test("land access click routes to existing command A", function () {
  assert.equal(
    makeUi().ui.getSatelliteGpsCommand("SAT_GPS_ACCESS"),
    "A"
  );
});

test("Back click returns to interactive Land Management", async function () {
  const { calls, ui } = makeUi();

  assert.equal(
    ui.getSatelliteGpsCommand("SAT_GPS_BACK"),
    "7"
  );

  await ui.sendLandManagementMenu(
    "919847298918",
    "English"
  );

  assert.equal(calls[0].body.type, "interactive");
  assert.equal(
    calls[0].body.interactive.type,
    "list"
  );

  const ids = rowsFromCall(calls[0]).map(
    function (row) {
      return row.id;
    }
  );

  assert.equal(ids.length, 10);
  assert.ok(ids.includes("LAND_SATELLITE_GPS"));
  assert.ok(ids.includes("LAND_BACK"));
});

test("Satellite and GPS clicks cannot enter registration routing", function () {
  const ui = makeUi().ui;

  for (const id of EXPECTED_IDS) {
    assert.equal(isExplicitRegistrationExit(id), true);
    assert.equal(ui.getLegacyServiceCommand(id), "");
    assert.doesNotMatch(
      ui.getSatelliteGpsCommand(id),
      /register|registration/i
    );
  }
});

test("numeric and text commands remain backward-compatible route values", function () {
  const ui = makeUi().ui;
  const commands = EXPECTED_IDS.map(function (id) {
    return ui.getSatelliteGpsCommand(id);
  });

  assert.deepEqual(commands, EXPECTED_COMMANDS);
});
