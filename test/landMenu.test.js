"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createBhoomiMitraUI
} = require("../utils/bhoomiMitraUI");
const {
  getServicePrompt,
  getUnavailableFarmOptionReply
} = require("../utils/menu");
const {
  isExplicitRegistrationExit
} = require("../utils/registrationSession");

const EXPECTED_IDS = [
  "LAND_REGISTER",
  "LAND_VIEW",
  "LAND_UPDATE",
  "LAND_ADD_CROP",
  "LAND_CROP_HISTORY",
  "LAND_USAGE_HISTORY",
  "LAND_SUMMARY",
  "LAND_SOIL",
  "LAND_SATELLITE_GPS",
  "LAND_BACK"
];

const EXPECTED_SATELLITE_GPS_IDS = [
  "SAT_GPS_BOUNDARY_MAP",
  "SAT_GPS_MAP",
  "SAT_GPS_BOUNDARY_STATUS",
  "SAT_GPS_DETAILS",
  "SAT_GPS_CURRENT_STATUS",
  "SAT_GPS_HISTORY",
  "SAT_GPS_ACCESS",
  "SAT_GPS_BACK"
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

test("Malayalam land menu uses interactive selections", async function () {
  const { calls, ui } = makeUi();

  await ui.sendLandManagementMenu(
    "919847298918",
    "Malayalam"
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.type, "interactive");
  assert.equal(calls[0].body.interactive.type, "list");
  assert.match(
    calls[0].body.interactive.body.text,
    /വിള & ഭൂമി മാനേജ്മെന്റ്/
  );
  assert.match(rowsFromCall(calls[0])[0].title, /പുതിയ ഭൂമി/);
  assert.match(rowsFromCall(calls[0])[8].title, /സാറ്റലൈറ്റ്/);
  assert.match(rowsFromCall(calls[0])[9].title, /പിന്നോട്ട്/);
});

test("English land menu uses interactive selections", async function () {
  const { calls, ui } = makeUi();

  await ui.sendLandManagementMenu(
    "919847298918",
    "English"
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.interactive.type, "list");
  assert.match(
    calls[0].body.interactive.body.text,
    /Crop & Land Management/
  );
  assert.deepEqual(
    rowsFromCall(calls[0]).map(function (row) {
      return row.title;
    }),
    [
      "🌱 Register New Land",
      "🌾 My Registered Lands",
      "✏️ Update Land Details",
      "🌱 Add Crop / Activity",
      "📚 Crop History",
      "📋 BhoomiMitra History",
      "📄 Land Summary",
      "🧪 Soil Test / Info",
      "🛰️ Satellite & GPS",
      "↩️ Back"
    ]
  );
});

test("all land interactive IDs are unique", async function () {
  const { calls, ui } = makeUi();

  await ui.sendLandManagementMenu(
    "919847298918",
    "English"
  );

  const ids = rowsFromCall(calls[0]).map(function (row) {
    return row.id;
  });

  assert.deepEqual(ids, EXPECTED_IDS);
  assert.equal(new Set(ids).size, ids.length);
  for (const row of rowsFromCall(calls[0])) {
    assert.ok(row.title.length <= 24);
    assert.ok(row.description.length <= 72);
  }
});

test("final outgoing Land Management payload contains all ten rows", async function () {
  const { calls, ui } = makeUi();

  await ui.sendLandManagementMenu(
    "919847298918",
    "Malayalam"
  );

  const outgoingBody = calls[0].body;
  const sections =
    outgoingBody.interactive.action.sections;
  const rows = rowsFromCall(calls[0]);
  const ids = rows.map(function (row) {
    return row.id;
  });

  assert.equal(outgoingBody.type, "interactive");
  assert.deepEqual(
    sections.map(function (section) {
      return section.rows.length;
    }),
    [8, 2]
  );
  assert.equal(rows.length, 10);
  assert.deepEqual(ids, EXPECTED_IDS);
  assert.equal(new Set(ids).size, 10);
  assert.ok(ids.includes("LAND_SATELLITE_GPS"));
  assert.ok(ids.includes("LAND_BACK"));
  for (const row of rows) {
    assert.ok(row.title.length <= 24);
    assert.ok(row.description.length <= 72);
  }
});

test("Malayalam and English land menus use the same IDs", async function () {
  const { calls, ui } = makeUi();

  await ui.sendLandManagementMenu(
    "919847298918",
    "English"
  );
  await ui.sendLandManagementMenu(
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

test("Register new land click routes to existing option 1", function () {
  assert.equal(
    makeUi().ui.getLandManagementCommand("LAND_REGISTER"),
    "1"
  );
});

test("View lands click routes to existing option 2", function () {
  assert.equal(
    makeUi().ui.getLandManagementCommand("LAND_VIEW"),
    "2"
  );
});

test("Update land click routes to safe option 3 handling", function () {
  const ui = makeUi().ui;

  assert.equal(ui.getLandManagementCommand("LAND_UPDATE"), "3");
  assert.match(
    getUnavailableFarmOptionReply("3", "English"),
    /not yet available/
  );
});

test("Add crop click routes to safe option 4 handling", function () {
  const ui = makeUi().ui;

  assert.equal(ui.getLandManagementCommand("LAND_ADD_CROP"), "4");
  assert.match(
    getUnavailableFarmOptionReply("4", "English"),
    /No land record was changed/
  );
});

test("Crop history click routes to safe option 5 handling", function () {
  assert.equal(
    makeUi().ui.getLandManagementCommand("LAND_CROP_HISTORY"),
    "5"
  );
  assert.notEqual(
    getUnavailableFarmOptionReply("5", "Malayalam"),
    ""
  );
});

test("Usage history click routes to safe option 6 handling", function () {
  assert.equal(
    makeUi().ui.getLandManagementCommand("LAND_USAGE_HISTORY"),
    "6"
  );
  assert.match(
    getUnavailableFarmOptionReply("6", "English"),
    /BhoomiMitra usage history/
  );
});

test("Land summary click routes to safe option 7 handling", function () {
  assert.equal(
    makeUi().ui.getLandManagementCommand("LAND_SUMMARY"),
    "7"
  );
  assert.match(
    getUnavailableFarmOptionReply("7", "English"),
    /Land summary/
  );
});

test("Soil click routes to existing soil option 8", function () {
  assert.equal(
    makeUi().ui.getLandManagementCommand("LAND_SOIL"),
    "8"
  );
  assert.match(
    getServicePrompt("soil"),
    /location-based estimated soil profile/
  );
});

test("Satellite and GPS click directly opens the existing interactive submenu", async function () {
  const { calls, ui } = makeUi();

  const interactiveMessage = {
    type: "interactive",
    interactive: {
      list_reply: {
        id: "LAND_SATELLITE_GPS",
        title: "Satellite & GPS"
      }
    }
  };

  const selection =
    ui.getInteractiveSelection(
      interactiveMessage
    );

  assert.equal(
    ui.getNavigationAction(selection.id),
    "SATELLITE_GPS_MENU"
  );

  assert.equal(
    ui.getLandManagementCommand(
      selection.id
    ),
    "9"
  );

  for (const language of [
    "Malayalam",
    "English"
  ]) {
    await ui.sendSatelliteGpsMenu(
      "919847298918",
      language
    );
  }

  assert.equal(calls.length, 2);

  for (const call of calls) {
    const ids = rowsFromCall(call).map(
      function (row) {
        return row.id;
      }
    );

    assert.equal(call.body.type, "interactive");
    assert.equal(
      call.body.interactive.type,
      "list"
    );
    assert.deepEqual(
      ids,
      EXPECTED_SATELLITE_GPS_IDS
    );
    assert.doesNotMatch(
      call.body.interactive.body.text,
      /reply with|1️⃣|2️⃣|3️⃣|4️⃣|5️⃣|6️⃣|7️⃣/i
    );
  }
});

test("Back click routes to the parent My Farm menu", async function () {
  const { calls, ui } = makeUi();

  assert.equal(
    ui.getLandManagementCommand("LAND_BACK"),
    "back"
  );

  await ui.sendFarmMenu(
    "919847298918",
    "English"
  );

  const parentIds = rowsFromCall(calls[0]).map(
    function (row) {
      return row.id;
    }
  );

  assert.ok(parentIds.includes("SERVICE_9"));
});

test("land-menu clicks cannot enter member registration routing", function () {
  const ui = makeUi().ui;

  for (const id of EXPECTED_IDS) {
    assert.equal(id.startsWith("LAND_"), true);
    assert.equal(isExplicitRegistrationExit(id), true);
    assert.equal(ui.getLegacyServiceCommand(id), "");
    assert.doesNotMatch(
      ui.getLandManagementCommand(id),
      /register|registration/i
    );
  }
});

test("numeric options 1 through 9 remain legacy fallbacks", function () {
  const ui = makeUi().ui;
  const commands = EXPECTED_IDS
    .slice(0, 9)
    .map(function (id) {
      return ui.getLandManagementCommand(id);
    });

  assert.deepEqual(
    commands,
    ["1", "2", "3", "4", "5", "6", "7", "8", "9"]
  );
  assert.match(
    getServicePrompt("farm"),
    /Legacy numeric fallback/
  );
  assert.doesNotMatch(
    getServicePrompt("farm"),
    /Reply with one number/
  );
});

test("only currently unimplemented land options return safe unavailable replies", function () {
  for (const choice of ["3", "4", "5", "6", "7"]) {
    assert.match(
      getUnavailableFarmOptionReply(choice, "English"),
      /No land record was changed/
    );
  }

  for (const choice of ["1", "2", "8", "9"]) {
    assert.equal(
      getUnavailableFarmOptionReply(choice, "English"),
      ""
    );
  }
});
