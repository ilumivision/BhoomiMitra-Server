"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  handlePersonalRecords
} = require("../utils/personalRecords");
const {
  createBhoomiMitraUI
} = require("../utils/bhoomiMitraUI");
const registrationModule =
  require("../utils/registration");
const {
  closeRegistrationSessionForNavigation,
  clearCompletedRegistrationSession,
  isExplicitRegistrationExit
} = require("../utils/registrationSession");

const PHONE = "919847298918";

function columnLetterToIndex(letters) {
  let result = 0;

  for (const character of letters) {
    result =
      result * 26 +
      character.charCodeAt(0) - 64;
  }

  return result - 1;
}

function makeFarmerRows() {
  const length = columnLetterToIndex("BG") + 1;
  const headers = new Array(length).fill("");
  const row = new Array(length).fill("");

  headers[columnLetterToIndex("A")] = "Farmer_ID";
  headers[columnLetterToIndex("B")] = "Name";
  headers[columnLetterToIndex("D")] = "Mobile";
  headers[columnLetterToIndex("E")] = "WhatApp";
  headers[columnLetterToIndex("G")] = "Distrct";
  headers[columnLetterToIndex("I")] = "Panchayath";
  headers[columnLetterToIndex("N")] = "Main Crop";
  headers[columnLetterToIndex("X")] = "Status";
  headers[columnLetterToIndex("AO")] = "Verification_Status";
  headers[columnLetterToIndex("AQ")] = "Active_Status";
  headers[columnLetterToIndex("BG")] = "Preferred_Language";

  row[columnLetterToIndex("A")] = "BM-1001";
  row[columnLetterToIndex("B")] = "Anu Farmer";
  row[columnLetterToIndex("D")] = "9847298918";
  row[columnLetterToIndex("E")] = PHONE;
  row[columnLetterToIndex("G")] = "Pathanamthitta";
  row[columnLetterToIndex("I")] = "Thiruvalla";
  row[columnLetterToIndex("N")] = "Rambutan";
  row[columnLetterToIndex("X")] = "Registered";
  row[columnLetterToIndex("AO")] = "Pending";
  row[columnLetterToIndex("AQ")] = "Active";
  row[columnLetterToIndex("BG")] = "English";

  return [headers, row];
}

function makeLandRows() {
  return [
    [
      "Land_ID",
      "Phone",
      "Farm_Name",
      "District",
      "Local_Body",
      "GPS_Calculated_Area",
      "Area_Unit",
      "Main_Crop"
    ],
    [
      "LAND-1",
      PHONE,
      "Home Farm",
      "Pathanamthitta",
      "Thiruvalla",
      "2",
      "Acre",
      "Rambutan"
    ]
  ];
}

function makeAnimalRows() {
  return [
    [
      "Animal_ID",
      "Farmer_ID",
      "WhatsApp_No",
      "Animal_Type",
      "Breed",
      "Sex",
      "Age",
      "Tag_Number",
      "Vaccination_Status",
      "Health_Status",
      "Active_Status"
    ],
    [
      "AN-1",
      "BM-1001",
      PHONE,
      "Cow",
      "Jersey",
      "Female",
      "4",
      "TAG-1",
      "Current",
      "Healthy",
      "Active"
    ]
  ];
}

function makeActiveRegistration(category) {
  return {
    registrationSessions: {
      [PHONE]: {
        step: "name",
        data: {
          whatsapp: PHONE,
          category: category || "farmer"
        }
      }
    },
    menuSessions: {
      [PHONE]: {
        step: "registration_active",
        currentService: null,
        updatedAt: 1
      }
    }
  };
}

function makeSheets() {
  const writes = [];

  return {
    writes,
    client: {
      spreadsheets: {
        values: {
          async get(request) {
            if (request.range.startsWith("Farmers!")) {
              return { data: { values: makeFarmerRows() } };
            }

            if (request.range.startsWith("Land_Parcels!")) {
              return { data: { values: makeLandRows() } };
            }

            if (request.range.startsWith("Animal_Registry!")) {
              return { data: { values: makeAnimalRows() } };
            }

            if (request.range.startsWith("Expert_Directory!")) {
              return { data: { values: [] } };
            }

            throw new Error("Unexpected range: " + request.range);
          },
          async append(request) {
            writes.push({ method: "append", request });
          },
          async update(request) {
            writes.push({ method: "update", request });
          }
        }
      }
    }
  };
}

function makeUi() {
  return createBhoomiMitraUI({
    axios: { async post() {} },
    phoneNumberId: "phone-id",
    whatsappToken: "token"
  });
}

function closeForSelection(state, selectionId) {
  return closeRegistrationSessionForNavigation({
    userKey: PHONE,
    selectionId,
    registrationSessions: state.registrationSessions,
    menuSessions: state.menuSessions,
    now: function () { return 1234; }
  });
}

async function routePersonalSelection(selectionId) {
  const state = makeActiveRegistration();
  const sheets = makeSheets();
  const ui = makeUi();

  assert.equal(closeForSelection(state, selectionId), true);

  const result = await handlePersonalRecords({
    from: PHONE,
    phone: PHONE,
    userText: ui.getLegacyServiceCommand(selectionId),
    language: "English",
    sheets: sheets.client,
    spreadsheetId: "sheet-id"
  });

  return { result, sheets, state };
}

test("start registration then enter My Records closes the stale session", function () {
  const state = makeActiveRegistration();

  assert.equal(closeForSelection(state, "SERVICE_10"), true);
  assert.equal(state.registrationSessions[PHONE], undefined);
  assert.equal(state.menuSessions[PHONE].step, null);

  const laterTextWouldBeIntercepted = Boolean(
    state.registrationSessions[PHONE] &&
    state.menuSessions[PHONE].step === "registration_active"
  );
  assert.equal(laterTextWouldBeIntercepted, false);
});

test("start registration then tap My Profile closes registration and shows profile", async function () {
  const { result, state } = await routePersonalSelection(
    "PERSONAL_DETAILS"
  );

  assert.equal(state.registrationSessions[PHONE], undefined);
  assert.equal(result.handled, true);
  assert.match(result.reply, /Farmer ID: BM-1001/);
});

test("start registration then tap My Lands closes registration and shows lands", async function () {
  const { result } = await routePersonalSelection(
    "PERSONAL_LANDS"
  );

  assert.equal(result.handled, true);
  assert.match(result.reply, /Land ID: LAND-1/);
});

test("start registration then tap My Animals closes registration and shows animals", async function () {
  const { result } = await routePersonalSelection(
    "PERSONAL_ANIMALS"
  );

  assert.equal(result.handled, true);
  assert.match(result.reply, /Animal ID: AN-1/);
});

test("start registration then tap My Farmer ID closes registration and shows ID", async function () {
  const { result } = await routePersonalSelection(
    "PERSONAL_FARMER_ID"
  );

  assert.equal(result.handled, true);
  assert.match(result.reply, /Farmer ID: BM-1001/);
});

test("active registration remains active without explicit navigation", function () {
  const state = makeActiveRegistration();

  assert.equal(closeForSelection(state, ""), false);
  assert.equal(state.registrationSessions[PHONE].step, "name");
  assert.equal(
    state.menuSessions[PHONE].step,
    "registration_active"
  );
});

test("ordinary registration answers never cancel the session", function () {
  for (const answer of ["1", "Anu Farmer", "Rambutan"]) {
    const state = makeActiveRegistration();

    assert.equal(closeForSelection(state, answer), false);
    assert.ok(state.registrationSessions[PHONE]);
    assert.equal(
      state.menuSessions[PHONE].step,
      "registration_active"
    );
  }
});

test("completed registration cleanup behavior is not changed", function () {
  const state = {
    registrationSessions: {},
    menuSessions: {
      [PHONE]: {
        step: "completed",
        updatedAt: 1
      }
    }
  };

  assert.equal(closeForSelection(state, "SERVICE_10"), false);
  assert.equal(state.menuSessions[PHONE].step, "completed");
  assert.equal(state.menuSessions[PHONE].updatedAt, 1);
});

test("failed registration keeps its collected session data available for retry", function () {
  const state = makeActiveRegistration("farmer");
  state.registrationSessions[PHONE].step = "crop";
  state.registrationSessions[PHONE].data.name = "Anu Farmer";

  const cleared = clearCompletedRegistrationSession({
    registrationSessions: state.registrationSessions,
    userKey: PHONE,
    result: { success: false, code: "SHEET_APPEND_FAILED" }
  });

  assert.equal(cleared, false);
  assert.equal(state.registrationSessions[PHONE].step, "crop");
  assert.equal(
    state.registrationSessions[PHONE].data.name,
    "Anu Farmer"
  );
});

test("successful or recovered registration clears the completed session", function () {
  const state = makeActiveRegistration("farmer");
  const cleared = clearCompletedRegistrationSession({
    registrationSessions: state.registrationSessions,
    userKey: PHONE,
    result: {
      success: true,
      alreadyRegistered: true,
      memberId: "BM-1001"
    }
  });

  assert.equal(cleared, true);
  assert.equal(state.registrationSessions[PHONE], undefined);
});

test("Farmer registration can restart cleanly from Membership", async function () {
  const state = makeActiveRegistration("farmer");

  assert.equal(isExplicitRegistrationExit("SERVICE_11"), true);
  assert.equal(closeForSelection(state, "SERVICE_11"), true);
  assert.equal(state.registrationSessions[PHONE], undefined);

  const result = await registrationModule({ text: "1" });
  assert.equal(result.success, true);
  assert.match(result.reply, /Farmer registration started/);
});

test("Expert Skilled Worker and Service Provider registration routes remain available", async function () {
  const routes = [
    ["2", /Expert registration started/],
    ["3", /Skilled Worker registration started/],
    ["4", /Service Provider registration started/]
  ];

  for (const [answer, expectedReply] of routes) {
    const result = await registrationModule({ text: answer });

    assert.equal(result.success, true);
    assert.match(result.reply, expectedReply);
  }
});

test("session cancellation itself performs no Master or Sheet writes", async function () {
  const { sheets } = await routePersonalSelection(
    "PERSONAL_DETAILS"
  );

  assert.deepEqual(sheets.writes, []);
});

test("all explicit top-level navigation IDs close unfinished registration", function () {
  const navigationIds = [
    "HOME_ASK",
    "HOME_FARM",
    "FARM_WEATHER_ALERTS",
    "HOME_EXPERT",
    "HOME_TRAINING",
    "TRAINING_PROMOTED",
    "HOME_SCHEMES",
    "FARM_ALERTS_OPEN",
    "TRAINING_REQUEST_START",
    "TRAINING_MY_REQUESTS",
    "HOME_MARKET",
    "HOME_PROFILE",
    "PROFILE_HELP",
    "PROFILE_WHATS_NEW",
    "PROFILE_ABOUT",
    "ABOUT_TEAM",
    "ABOUT_TEAM_PAGE_1",
    "ABOUT_TEAM_PAGE_2",
    "ABOUT_MEMBER_robert",
    "PROFILE_TERMS_PRIVACY",
    "PROFILE_SETTINGS",
    "PRIVACY_READ_POLICY",
    "WHATS_NEW_OPEN",
    "WHATS_NEW_TRY",
    "WHATS_NEW_DISMISS",
    "NAV_HOME",
    "CHANGE_LANGUAGE",
    "SERVICE_1",
    "SERVICE_2",
    "SERVICE_3",
    "SERVICE_4",
    "SERVICE_5",
    "SERVICE_6",
    "SERVICE_7",
    "SERVICE_8",
    "SERVICE_9",
    "SERVICE_10",
    "SERVICE_11"
  ];

  for (const selectionId of navigationIds) {
    const state = makeActiveRegistration();

    assert.equal(closeForSelection(state, selectionId), true);
    assert.equal(state.registrationSessions[PHONE], undefined);
    assert.equal(state.menuSessions[PHONE].step, null);
  }
});
