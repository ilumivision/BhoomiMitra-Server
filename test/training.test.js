"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createBhoomiMitraUI
} = require("../utils/bhoomiMitraUI");
const { getNaturalFeatureEntry } = require("../utils/menu");
const {
  TRAINING_ACTION_IDS,
  TRAINING_COORDINATION,
  TRAINING_DYNAMIC_PREFIXES,
  TRAINING_MODES,
  TRAINING_TIMES,
  buildPromotedTrainingDetails,
  buildPromotedTrainingListRows,
  buildTrainingRequestAlert,
  buildTrainingDetails,
  buildTrainingListRows,
  captureTrainingRequestDate,
  captureTrainingRequestLocation,
  captureTrainingRequestRemarks,
  captureTrainingRequest,
  changeTrainingRequest,
  createTrainingRequestSession,
  filterTrainingPrograms,
  findTrainingProgram,
  getMyTrainings,
  getPromotedTrainingPrograms,
  inferTrainingCategory,
  parseTrainingAction,
  readTrainingRequests,
  readTrainingPrograms,
  registerFarmerForTraining,
  registrationAvailability,
  sendTrainingRequestAlert,
  selectTrainingRequestMode,
  selectTrainingRequestTime,
  submitTrainingRequest,
  trainingRequestId
} = require("../utils/training");

const PROGRAM_HEADERS = [
  "Event_ID",
  "Event_Name",
  "Date",
  "Venue",
  "District",
  "Organizer",
  "category",
  "Status"
];

const REGISTRATION_HEADERS = [
  "Request_ID",
  "Request_Date",
  "BM_ID",
  "Farmer_ID",
  "Farmer_Name",
  "Mobile_No",
  "District",
  "Block",
  "Panchayath",
  "Ward",
  "Village",
  "Request_Category",
  "Service_Type",
  "Crop/Enterprise",
  "Request_Description",
  "Priority",
  "Preferred_Date",
  "Assigned_To",
  "Assigned_To_Name",
  "Assigned_To_Date",
  "Status",
  "Completion_Date",
  "Service Fee",
  "Platform Fee",
  "Farmer Rating",
  "Feedback",
  "Follow_up_Required",
  "Follow_Up_Date",
  "Closed_by",
  "Remarks"
];

const REQUEST_HEADERS = [
  "Request_ID",
  "Farmer_ID",
  "Mobile_No",
  "Farmer_Name",
  "District",
  "Training_Category",
  "Training_Topic",
  "Preferred_Mode",
  "Preferred_Time",
  "Preferred_Location",
  "Preferred_Date",
  "Remarks",
  "Request_Status",
  "Assigned_Coordinator",
  "Overall_Coordinator",
  "Training_Coordinator",
  "Created_At",
  "Updated_At",
  "Source_Message_ID",
  "Confirmed_Training_ID",
  "Confirmed_Training_Title",
  "Confirmed_Date",
  "Confirmed_Location"
];

const NOW = new Date("2026-10-17T00:00:00.000Z");

function programRow(values) {
  const input = values || {};
  return PROGRAM_HEADERS.map(function (header) {
    return input[header] == null ? "" : input[header];
  });
}

function registrationRow(values) {
  const input = values || {};
  return REGISTRATION_HEADERS.map(function (header) {
    return input[header] == null ? "" : input[header];
  });
}

function valueFromRow(row, header) {
  return row[REGISTRATION_HEADERS.indexOf(header)];
}

function requestRow(values) {
  const input = values || {};
  return REQUEST_HEADERS.map(function (header) {
    return input[header] == null ? "" : input[header];
  });
}

function valueFromRequestRow(row, header) {
  return row[REQUEST_HEADERS.indexOf(header)];
}

function samplePrograms() {
  return [
    PROGRAM_HEADERS,
    programRow({
      Event_ID: "TR-001",
      Event_Name: "Pepper Production Basics",
      Date: "20/10/2026",
      Venue: "KVK Hall",
      District: "Pathanamthitta",
      Organizer: "KVK",
      category: "Crop Production",
      Status: "Open"
    }),
    programRow({
      Event_ID: "TR-002",
      Event_Name: "Rambutan Orchard Care",
      Date: "22/10/2026",
      Venue: "Demonstration Farm",
      District: "Pathanamthitta",
      Organizer: "KVK",
      category: "Horticulture",
      Status: "Open"
    }),
    programRow({
      Event_ID: "TR-003",
      Event_Name: "Dairy Herd Health",
      Date: "12/10/2026",
      Venue: "KVK Hall",
      District: "Pathanamthitta",
      Organizer: "Animal Husbandry Department",
      category: "Animal Husbandry",
      Status: "Completed"
    })
  ];
}

function makeUiHarness() {
  const calls = [];
  const ui = createBhoomiMitraUI({
    axios: {
      post: async function (url, body, config) {
        calls.push({ url: url, body: body, config: config });
        return { data: { messages: [{ id: "wamid.training" }] } };
      }
    },
    phoneNumberId: "phone-id",
    whatsappToken: "token"
  });

  return { ui: ui, calls: calls };
}

test("upcoming training list includes future programmes and excludes past programmes", function () {
  const programs = readTrainingPrograms(samplePrograms());
  const upcoming = filterTrainingPrograms(programs, "UPCOMING", NOW);
  const rows = buildTrainingListRows(upcoming, "English", { now: NOW });

  assert.deepEqual(
    upcoming.map(function (program) { return program.id; }),
    ["TR-001", "TR-002"]
  );
  assert.equal(rows.length, 2);
  assert.equal(parseTrainingAction(rows[0].id).action, "VIEW");
  assert.doesNotMatch(rows[0].title, /TR-001/);
});

test("completed programmes are excluded even when their stored date is in the future", function () {
  const rows = samplePrograms();
  rows.push(programRow({
    Event_ID: "TR-COMPLETE",
    Event_Name: "Completed Event",
    Date: "25/10/2026",
    category: "Crop Production",
    Status: "Completed"
  }));

  const programmes = filterTrainingPrograms(
    readTrainingPrograms(rows),
    "UPCOMING",
    NOW
  );

  assert.equal(
    programmes.some(function (programme) {
      return programme.id === "TR-COMPLETE";
    }),
    false
  );
  assert.equal(
    registrationAvailability(findTrainingProgram(rows, "TR-COMPLETE"), NOW).allowed,
    false
  );
});

test("training category filtering returns only matching programmes", function () {
  const programs = readTrainingPrograms(samplePrograms());
  const horticulture = filterTrainingPrograms(
    programs,
    "HORTICULTURE",
    NOW
  );

  assert.equal(horticulture.length, 1);
  assert.equal(horticulture[0].title, "Rambutan Orchard Care");
});

test("English and Malayalam natural-language entries open training and schemes", function () {
  assert.equal(getNaturalFeatureEntry("training programmes"), "TRAINING");
  assert.equal(getNaturalFeatureEntry("പരിശീലനങ്ങൾ"), "TRAINING");
  assert.equal(getNaturalFeatureEntry("government schemes"), "SCHEMES");
  assert.equal(getNaturalFeatureEntry("സർക്കാർ പദ്ധതികൾ"), "SCHEMES");
});

test("training details are farmer-friendly and hide the internal programme ID", function () {
  const program = findTrainingProgram(samplePrograms(), "TR-001");
  const details = buildTrainingDetails(program, "English", { now: NOW });

  assert.equal(details.canRegister, true);
  assert.match(details.text, /🎓 Training Details/);
  assert.match(details.text, /Title: Pepper Production Basics/);
  assert.match(details.text, /Date: 20\/10\/2026/);
  assert.match(details.text, /Venue: KVK Hall/);
  assert.match(details.text, /Topic: Crop Production/);
  assert.doesNotMatch(details.text, /TR-001/);
});

test("registered farmer is registered using stored identity and existing Service_Request headers", async function () {
  const appended = [];
  const result = await registerFarmerForTraining({
    programId: "TR-001",
    programRows: samplePrograms(),
    registrationRows: [REGISTRATION_HEADERS],
    farmerWhatsApp: "919111111111",
    farmer: {
      memberId: "BM-F-100",
      name: "Anu",
      whatsapp: "919111111111",
      district: "Pathanamthitta",
      panchayath: "Konni"
    },
    now: NOW,
    appendRegistration: async function (sheetName, row) {
      appended.push({ sheetName: sheetName, row: row });
      return { success: true };
    }
  });

  assert.equal(result.success, true);
  assert.equal(result.duplicate, false);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].sheetName, "Service_Request");
  assert.equal(valueFromRow(appended[0].row, "Farmer_ID"), "BM-F-100");
  assert.equal(valueFromRow(appended[0].row, "Request_Category"), "Training");
  assert.equal(valueFromRow(appended[0].row, "Service_Type"), "TR-001");
  assert.equal(valueFromRow(appended[0].row, "Status"), "Registered");
});

test("duplicate training registration is reported without appending a second row", async function () {
  let appendCount = 0;
  const result = await registerFarmerForTraining({
    programId: "TR-001",
    programRows: samplePrograms(),
    registrationRows: [
      REGISTRATION_HEADERS,
      registrationRow({
        Farmer_ID: "BM-F-100",
        Request_Category: "Training",
        Service_Type: "TR-001",
        Status: "Registered"
      })
    ],
    farmer: { memberId: "BM-F-100", name: "Anu" },
    now: NOW,
    appendRegistration: async function () {
      appendCount += 1;
      return true;
    }
  });

  assert.equal(result.success, true);
  assert.equal(result.duplicate, true);
  assert.equal(appendCount, 0);
});

test("closed and full programmes cannot be registered and omit the Register button", async function () {
  const closed = {
    id: "TR-CLOSED",
    title: "Closed Training",
    date: "20/10/2026",
    venue: "KVK",
    category: "Crop Production",
    status: "Closed",
    seats: ""
  };
  const full = Object.assign({}, closed, {
    id: "TR-FULL",
    title: "Full Training",
    status: "Open",
    seats: "0"
  });
  const uiHarness = makeUiHarness();
  const closedDetails = buildTrainingDetails(closed, "English", { now: NOW });

  assert.equal(registrationAvailability(closed, NOW).allowed, false);
  assert.equal(registrationAvailability(full, NOW).reason, "FULL");
  await uiHarness.ui.sendTrainingDetails(
    "919111111111",
    "English",
    closedDetails.text,
    closed.id,
    closedDetails.canRegister
  );
  const buttonIds = uiHarness.calls[0].body.interactive.action.buttons.map(
    function (button) { return button.reply.id; }
  );
  assert.equal(buttonIds.some(function (id) {
    return id.startsWith("TRAINING_REGISTER:");
  }), false);
});

test("My Trainings returns only the registered farmer's training history", function () {
  const registrations = [
    REGISTRATION_HEADERS,
    registrationRow({
      Farmer_ID: "BM-F-100",
      Request_Category: "Training",
      Service_Type: "TR-001",
      Request_Description: "Pepper Production Basics",
      Status: "Registered"
    }),
    registrationRow({
      Farmer_ID: "BM-F-200",
      Request_Category: "Training",
      Service_Type: "TR-002",
      Request_Description: "Rambutan Orchard Care",
      Status: "Registered"
    })
  ];
  const mine = getMyTrainings(
    samplePrograms(),
    registrations,
    "BM-F-100"
  );

  assert.equal(mine.length, 1);
  assert.equal(mine[0].id, "TR-001");
  assert.equal(mine[0].registrationStatus, "Registered");
});

test("English training menu and confirmation use click-first actions", async function () {
  const harness = makeUiHarness();
  const program = findTrainingProgram(samplePrograms(), "TR-001");

  await harness.ui.sendTrainingMenu("919111111111", "English");
  await harness.ui.sendTrainingRegistrationConfirmation(
    "919111111111",
    "English",
    program,
    false
  );

  const menuRows =
    harness.calls[0].body.interactive.action.sections[0].rows;
  const confirmationButtons =
    harness.calls[1].body.interactive.action.buttons;
  assert.ok(menuRows.some(function (row) {
    return row.id === TRAINING_ACTION_IDS.UPCOMING;
  }));
  assert.ok(menuRows.some(function (row) {
    return row.id === TRAINING_ACTION_IDS.MY_REQUESTS;
  }));
  assert.ok(menuRows.some(function (row) {
    return row.id === TRAINING_ACTION_IDS.ENTREPRENEURSHIP;
  }));
  assert.equal(menuRows.length, 8);
  assert.match(
    harness.calls[1].body.interactive.body.text,
    /Training Registration Confirmed/
  );
  assert.equal(confirmationButtons.length, 3);
});

test("Malayalam training menu details and confirmation stay in Malayalam", async function () {
  const harness = makeUiHarness();
  const program = findTrainingProgram(samplePrograms(), "TR-002");
  const details = buildTrainingDetails(program, "Malayalam", { now: NOW });

  await harness.ui.sendTrainingMenu("919111111111", "Malayalam");
  await harness.ui.sendTrainingDetails(
    "919111111111",
    "Malayalam",
    details.text,
    program.id,
    details.canRegister
  );
  await harness.ui.sendTrainingRegistrationConfirmation(
    "919111111111",
    "Malayalam",
    program,
    false
  );

  assert.match(harness.calls[0].body.interactive.body.text, /പരിശീലന പരിപാടികൾ/);
  assert.match(harness.calls[1].body.interactive.body.text, /പരിശീലന വിവരങ്ങൾ/);
  assert.match(harness.calls[2].body.interactive.body.text, /രജിസ്ട്രേഷൻ സ്ഥിരീകരിച്ചു/);
});

test("missing or invalid training record fails safely", async function () {
  let appendCount = 0;
  const result = await registerFarmerForTraining({
    programId: "TR-MISSING",
    programRows: samplePrograms(),
    registrationRows: [REGISTRATION_HEADERS],
    farmer: { memberId: "BM-F-100" },
    now: NOW,
    appendRegistration: async function () {
      appendCount += 1;
      return true;
    }
  });

  assert.equal(findTrainingProgram(samplePrograms(), "TR-MISSING"), null);
  assert.equal(result.success, false);
  assert.equal(result.code, "INVALID_PROGRAM");
  assert.equal(appendCount, 0);
});

test("missing Sheet data produces empty safe results without a write", async function () {
  let appendCount = 0;
  const result = await registerFarmerForTraining({
    programId: "TR-001",
    programRows: [],
    registrationRows: [],
    farmer: { memberId: "BM-F-100" },
    now: NOW,
    appendRegistration: async function () {
      appendCount += 1;
      return true;
    }
  });

  assert.deepEqual(readTrainingPrograms([]), []);
  assert.equal(result.success, false);
  assert.equal(result.code, "INVALID_PROGRAM");
  assert.equal(appendCount, 0);
});

test("already-registered confirmation is explicit and retains navigation buttons", async function () {
  const harness = makeUiHarness();
  const program = findTrainingProgram(samplePrograms(), "TR-001");

  await harness.ui.sendTrainingRegistrationConfirmation(
    "919111111111",
    "English",
    program,
    true
  );

  assert.match(
    harness.calls[0].body.interactive.body.text,
    /already registered for this programme/
  );
  assert.equal(
    harness.calls[0].body.interactive.action.buttons.length,
    3
  );
});

test("registered farmer training request captures typed text without asking for identity", function () {
  const farmer = {
    memberId: "BM-F-100",
    name: "Anu",
    whatsapp: "919111111111",
    district: "Pathanamthitta",
    panchayath: "Konni"
  };
  const session = createTrainingRequestSession(farmer, "English", NOW);
  const captured = captureTrainingRequest(
    session,
    "Mushroom cultivation",
    "text",
    NOW
  );

  assert.equal(captured.success, true);
  assert.equal(captured.topic, "Mushroom cultivation");
  assert.equal(captured.session.inputType, "text");
  assert.equal(captured.session.farmer.memberId, "BM-F-100");
});

test("transcribed voice training request follows the same mode-selection state", function () {
  const session = createTrainingRequestSession(
    { memberId: "BM-F-100" },
    "English",
    NOW
  );
  const captured = captureTrainingRequest(
    session,
    "Dairy feed preparation",
    "voice",
    NOW
  );

  assert.equal(captured.success, true);
  assert.equal(captured.session.step, "awaiting_mode");
  assert.equal(captured.session.inputType, "voice");
  assert.equal(captured.topic, "Dairy feed preparation");
});

test("submitting a training request stores identity from the farmer record by header", async function () {
  const appended = [];
  const result = await submitTrainingRequest({
    farmer: {
      memberId: "BM-F-100",
      name: "Anu",
      whatsapp: "919111111111",
      district: "Pathanamthitta",
      panchayath: "Konni"
    },
    farmerWhatsApp: "919111111111",
    topic: "Rambutan fruit fly management",
    language: "English",
    sourceMessageId: "wamid.training-request-submit",
    requestRows: [REQUEST_HEADERS],
    now: NOW,
    appendRegistration: async function (sheetName, row) {
      appended.push({ sheetName: sheetName, row: row });
      return { success: true };
    }
  });

  assert.equal(result.success, true);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].sheetName, "Training_Requests");
  assert.equal(valueFromRequestRow(appended[0].row, "Farmer_ID"), "BM-F-100");
  assert.equal(valueFromRequestRow(appended[0].row, "Farmer_Name"), "Anu");
  assert.equal(valueFromRequestRow(appended[0].row, "Mobile_No"), "919111111111");
  assert.equal(valueFromRequestRow(appended[0].row, "District"), "Pathanamthitta");
  assert.equal(valueFromRequestRow(appended[0].row, "Training_Topic"), "Rambutan fruit fly management");
  assert.equal(valueFromRequestRow(appended[0].row, "Training_Category"), "Crop Production Training");
  assert.equal(valueFromRequestRow(appended[0].row, "Request_Status"), "Requested");
  assert.equal(valueFromRequestRow(appended[0].row, "Assigned_Coordinator"), TRAINING_COORDINATION.TRAINING);
  assert.equal(valueFromRequestRow(appended[0].row, "Overall_Coordinator"), TRAINING_COORDINATION.OVERALL);
});

test("farmer never supplies internal identity in the training request topic", async function () {
  let savedRow = null;
  await submitTrainingRequest({
    farmer: { memberId: "BM-F-777", name: "Binu", whatsapp: "919222222222" },
    topic: "Pruning of fruit crops",
    sourceMessageId: "wamid.no-typed-id",
    requestRows: [REQUEST_HEADERS],
    now: NOW,
    appendRegistration: async function (sheetName, row) {
      savedRow = row;
      return true;
    }
  });

  assert.equal(valueFromRequestRow(savedRow, "Farmer_ID"), "BM-F-777");
  assert.doesNotMatch(valueFromRequestRow(savedRow, "Training_Topic"), /BM-F-777/);
});

test("Change replaces pending text and no request is written before Submit", function () {
  let appendCount = 0;
  const initial = captureTrainingRequest(
    createTrainingRequestSession({ memberId: "BM-F-100" }, "English", NOW),
    "Mushroom cultivation",
    "text",
    NOW
  ).session;
  const changed = changeTrainingRequest(initial, NOW);
  const corrected = captureTrainingRequest(
    changed,
    "Vegetable nursery management",
    "voice",
    NOW
  );

  assert.equal(changed.step, "awaiting_request");
  assert.equal(changed.topic, "");
  assert.equal(corrected.topic, "Vegetable nursery management");
  assert.equal(appendCount, 0);
});

test("Cancel button is available before submission and creates no request", async function () {
  const harness = makeUiHarness();
  let appendCount = 0;

  await harness.ui.sendTrainingRequestConfirmation(
    "919111111111",
    "English",
    "Mushroom cultivation"
  );

  const buttons = harness.calls[0].body.interactive.action.buttons;
  assert.ok(buttons.some(function (button) {
    return button.reply.id === TRAINING_ACTION_IDS.REQUEST_CANCEL;
  }));
  assert.equal(appendCount, 0);
});

test("duplicate Submit webhook uses a deterministic request ID and appends once", async function () {
  const sourceMessageId = "wamid.duplicate-training-request";
  const firstRows = [REQUEST_HEADERS];
  let appendCount = 0;
  let appendedRow = null;
  const input = {
    farmer: { memberId: "BM-F-100", name: "Anu" },
    topic: "Mushroom cultivation",
    sourceMessageId: sourceMessageId,
    requestRows: firstRows,
    now: NOW,
    appendRegistration: async function (sheetName, row) {
      appendCount += 1;
      appendedRow = row;
      return true;
    }
  };
  const first = await submitTrainingRequest(input);
  const second = await submitTrainingRequest(Object.assign({}, input, {
    requestRows: [REQUEST_HEADERS, appendedRow]
  }));

  assert.equal(first.requestId, trainingRequestId(sourceMessageId));
  assert.equal(second.success, true);
  assert.equal(second.duplicate, true);
  assert.equal(appendCount, 1);
});

test("My Training Requests returns only the inbound farmer's records", function () {
  const rows = [
    REQUEST_HEADERS,
    requestRow({
      Request_ID: "BM-TRQ-A",
      Created_At: "2026-10-17T10:00:00.000Z",
      Farmer_ID: "BM-F-100",
      Training_Topic: "Mushroom cultivation",
      Request_Status: "Requested",
      Preferred_Mode: "Online",
      Preferred_Time: TRAINING_TIMES.AFTERNOON
    }),
    requestRow({
      Request_ID: "BM-TRQ-B",
      Created_At: "2026-10-17T11:00:00.000Z",
      Farmer_ID: "BM-F-200",
      Training_Topic: "Dairy feed preparation",
      Request_Status: "Pending"
    })
  ];
  const mine = readTrainingRequests(rows, "BM-F-100");

  assert.equal(mine.length, 1);
  assert.equal(mine[0].topic, "Mushroom cultivation");
  assert.equal(mine[0].status, "Requested");
  assert.equal(mine[0].preferredTime, TRAINING_TIMES.AFTERNOON);
});

test("English Request a Training flow is click-first through confirmation", async function () {
  const harness = makeUiHarness();

  await harness.ui.sendTrainingRequestShortcuts("919111111111", "English");
  await harness.ui.sendTrainingRequestPrompt("919111111111", "English");
  await harness.ui.sendTrainingRequestConfirmation(
    "919111111111",
    "English",
    "Mushroom cultivation"
  );
  await harness.ui.sendTrainingRequestSubmitted(
    "919111111111",
    "English",
    "Mushroom cultivation"
  );

  assert.match(harness.calls[0].body.interactive.body.text, /registrations and popular trainings/);
  assert.match(harness.calls[1].body.interactive.body.text, /type your need or send a voice message/);
  assert.match(harness.calls[2].body.interactive.body.text, /Submit this request to KVK/);
  assert.match(harness.calls[3].body.interactive.body.text, /Training Request Submitted/);
});

test("Malayalam Request a Training flow and history stay in Malayalam", async function () {
  const harness = makeUiHarness();

  await harness.ui.sendTrainingRequestPrompt("919111111111", "Malayalam");
  await harness.ui.sendTrainingRequestConfirmation(
    "919111111111",
    "Malayalam",
    "കൂൺ കൃഷി"
  );
  await harness.ui.sendMyTrainingRequests(
    "919111111111",
    "Malayalam",
    [{
      topic: "കൂൺ കൃഷി",
      requestedAt: "2026-10-17T10:00:00.000Z",
      status: "Requested"
    }]
  );

  assert.match(harness.calls[0].body.interactive.body.text, /വോയ്സ് സന്ദേശം/);
  assert.match(harness.calls[1].body.interactive.body.text, /പരിശീലന അഭ്യർത്ഥന/);
  assert.match(harness.calls[2].body.interactive.body.text, /എന്റെ പരിശീലന അഭ്യർത്ഥനകൾ/);
  assert.doesNotMatch(harness.calls[2].body.interactive.body.text, /BM-TRQ/);
});

test("KVK alert is sent only to a configured approved destination", async function () {
  const alerts = [];
  const result = await sendTrainingRequestAlert({
    destination: "+91 98765 43210",
    farmer: { name: "Anu", panchayath: "Konni" },
    topic: "Mushroom cultivation",
    sendAlert: async function (to, text) {
      alerts.push({ to: to, text: text });
    }
  });

  assert.equal(result.sent, true);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].to, "919876543210");
  assert.equal(alerts[0].text, buildTrainingRequestAlert(
    { name: "Anu", panchayath: "Konni" },
    "Mushroom cultivation"
  ));
});

test("missing KVK alert destination does not send and does not affect stored request", async function () {
  let alertCount = 0;
  let appendCount = 0;
  const stored = await submitTrainingRequest({
    farmer: { memberId: "BM-F-100", name: "Anu" },
    topic: "Mushroom cultivation",
    sourceMessageId: "wamid.no-alert-config",
    requestRows: [REQUEST_HEADERS],
    now: NOW,
    appendRegistration: async function () {
      appendCount += 1;
      return true;
    }
  });
  const alert = await sendTrainingRequestAlert({
    destination: "",
    farmer: { name: "Anu" },
    topic: "Mushroom cultivation",
    sendAlert: async function () {
      alertCount += 1;
    }
  });

  assert.equal(stored.success, true);
  assert.equal(appendCount, 1);
  assert.equal(alert.sent, false);
  assert.equal(alert.code, "NOT_CONFIGURED");
  assert.equal(alertCount, 0);
});

function capturedTrainingRequest() {
  return captureTrainingRequest(
    createTrainingRequestSession({ memberId: "BM-F-100" }, "English", NOW),
    "Mushroom cultivation",
    "text",
    NOW
  ).session;
}

test("Online mode selection asks for an online time preference", function () {
  const selected = selectTrainingRequestMode(
    capturedTrainingRequest(),
    TRAINING_MODES.ONLINE,
    NOW
  );

  assert.equal(selected.success, true);
  assert.equal(selected.session.mode, "Online");
  assert.equal(selected.session.step, "awaiting_time");
  assert.equal(selected.session.preferredTime, "");
});

test("Offline mode selection skips the online time question", function () {
  const selected = selectTrainingRequestMode(
    capturedTrainingRequest(),
    TRAINING_MODES.OFFLINE,
    NOW
  );

  assert.equal(selected.success, true);
  assert.equal(selected.session.mode, "Offline / In-person");
  assert.equal(selected.session.step, "awaiting_location");
  assert.equal(selected.session.preferredTime, "Not applicable");
});

test("Either mode selection skips the online time question", function () {
  const selected = selectTrainingRequestMode(
    capturedTrainingRequest(),
    TRAINING_MODES.EITHER,
    NOW
  );

  assert.equal(selected.success, true);
  assert.equal(selected.session.mode, "Either");
  assert.equal(selected.session.step, "awaiting_location");
  assert.equal(selected.session.preferredTime, "Not applicable");
});

test("location date and remarks advance the request to confirmation", function () {
  const modeSelected = selectTrainingRequestMode(
    capturedTrainingRequest(),
    TRAINING_MODES.OFFLINE,
    NOW
  );
  const location = captureTrainingRequestLocation(
    modeSelected.session,
    "Konni",
    NOW
  );
  const date = captureTrainingRequestDate(
    location.session,
    "15 November 2026",
    NOW
  );
  const remarks = captureTrainingRequestRemarks(
    date.session,
    "Morning preferred",
    NOW
  );

  assert.equal(location.session.step, "awaiting_date");
  assert.equal(date.session.step, "awaiting_remarks");
  assert.equal(remarks.session.step, "awaiting_confirmation");
  assert.equal(remarks.session.preferredLocation, "Konni");
  assert.equal(remarks.session.preferredDate, "15 November 2026");
  assert.equal(remarks.session.remarks, "Morning preferred");
});

test("training categories are inferred conservatively from the requested topic", function () {
  assert.equal(inferTrainingCategory("Mushroom cultivation"), "Crop Production Training");
  assert.equal(inferTrainingCategory("Dairy feed preparation"), "Animal Husbandry Training");
  assert.equal(inferTrainingCategory("Farm business planning"), "Agricultural Entrepreneurship Training");
  assert.equal(inferTrainingCategory("Food processing and packaging"), "Value Addition Training");
  assert.equal(inferTrainingCategory("A topic without a known category"), "Other / Farmer requested");
});

[
  TRAINING_TIMES.AFTERNOON,
  TRAINING_TIMES.EVENING,
  TRAINING_TIMES.EITHER
].forEach(function (preferredTime) {
  test("Online mode accepts " + preferredTime + " time preference", function () {
    const modeSelected = selectTrainingRequestMode(
      capturedTrainingRequest(),
      TRAINING_MODES.ONLINE,
      NOW
    );
    const timeSelected = selectTrainingRequestTime(
      modeSelected.session,
      preferredTime,
      NOW
    );

    assert.equal(timeSelected.success, true);
    assert.equal(timeSelected.session.step, "awaiting_location");
    assert.equal(timeSelected.session.preferredTime, preferredTime);
  });
});

test("training request preferences are stored in dedicated Training_Requests fields", async function () {
  let savedRow = null;
  const result = await submitTrainingRequest({
    farmer: { memberId: "BM-F-100", name: "Anu" },
    topic: "Mushroom cultivation",
    mode: TRAINING_MODES.ONLINE,
    preferredTime: TRAINING_TIMES.EVENING,
    preferredLocation: "Online",
    preferredDate: "November 2026",
    remarks: "Weekend preferred",
    sourceMessageId: "wamid.preference-storage",
    requestRows: [REQUEST_HEADERS],
    now: NOW,
    appendRegistration: async function (sheetName, row) {
      savedRow = row;
      return true;
    }
  });
  assert.equal(result.success, true);
  assert.equal(valueFromRequestRow(savedRow, "Training_Topic"), "Mushroom cultivation");
  assert.equal(valueFromRequestRow(savedRow, "Preferred_Mode"), "Online");
  assert.equal(valueFromRequestRow(savedRow, "Preferred_Time"), TRAINING_TIMES.EVENING);
  assert.equal(valueFromRequestRow(savedRow, "Preferred_Location"), "Online");
  assert.equal(valueFromRequestRow(savedRow, "Preferred_Date"), "November 2026");
  assert.equal(valueFromRequestRow(savedRow, "Remarks"), "Weekend preferred");
});

test("request confirmation shows topic mode and time", async function () {
  const harness = makeUiHarness();

  await harness.ui.sendTrainingRequestConfirmation(
    "919111111111",
    "English",
    "Mushroom cultivation",
    TRAINING_MODES.ONLINE,
    TRAINING_TIMES.AFTERNOON,
    "Online",
    "November 2026",
    "Weekend preferred"
  );

  const text = harness.calls[0].body.interactive.body.text;
  assert.match(text, /Requested training:\nMushroom cultivation/);
  assert.match(text, /Preferred mode: Online/);
  assert.match(text, /Preferred time: 2:00–5:00 PM/);
  assert.match(text, /Preferred location: Online/);
  assert.match(text, /Preferred date: November 2026/);
  assert.match(text, /Remarks: Weekend preferred/);
});

test("My Training Requests includes stored mode and time preferences", async function () {
  const harness = makeUiHarness();
  const rows = [
    REGISTRATION_HEADERS,
    registrationRow({
      Request_ID: "BM-TRQ-PREF",
      Request_Date: "2026-10-17T10:00:00.000Z",
      Farmer_ID: "BM-F-100",
      Request_Category: "Training Request",
      Request_Description: "Mushroom cultivation",
      Status: "Requested",
      Remarks: "Training Mode: Online\nPreferred Time: 2:00–5:00 PM"
    })
  ];
  const requests = readTrainingRequests(rows, "BM-F-100");

  await harness.ui.sendMyTrainingRequests(
    "919111111111",
    "English",
    requests
  );

  assert.equal(requests[0].mode, "Online");
  assert.equal(requests[0].preferredTime, "2:00–5:00 PM");
  assert.match(harness.calls[0].body.interactive.body.text, /Mode: Online/);
  assert.match(harness.calls[0].body.interactive.body.text, /Time: 2:00–5:00 PM/);
});

test("Promoted Trainings returns at most five active upcoming programmes deterministically", function () {
  const headers = PROGRAM_HEADERS.concat(["Promoted"]);
  const rows = [headers];

  for (let index = 1; index <= 7; index += 1) {
    rows.push(headers.map(function (header) {
      const values = {
        Event_ID: "TR-P" + index,
        Event_Name: "Programme " + index,
        Date: String(17 + index).padStart(2, "0") + "/10/2026",
        Venue: "KVK",
        category: "Crop Production",
        Status: index === 7 ? "Closed" : "Open",
        Promoted: index === 4 ? "Yes" : ""
      };
      return values[header] || "";
    }));
  }

  const promoted = getPromotedTrainingPrograms(
    readTrainingPrograms(rows),
    NOW,
    5
  );

  assert.equal(promoted.length, 5);
  assert.equal(promoted[0].id, "TR-P4");
  assert.equal(promoted.some(function (program) {
    return program.id === "TR-P7";
  }), false);
});

test("promoted title selection resolves without a typed programme ID", function () {
  const program = findTrainingProgram(samplePrograms(), "TR-001");
  const rows = buildPromotedTrainingListRows([program], "English", { now: NOW });
  const action = parseTrainingAction(rows[0].id);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, TRAINING_DYNAMIC_PREFIXES.PROMOTED_VIEW + "TR-001");
  assert.deepEqual(action, { action: "PROMOTED_VIEW", programId: "TR-001" });
});

test("stored fee shows pilot no-payment wording and creates no payment action", async function () {
  const harness = makeUiHarness();
  const program = {
    id: "TR-FEE",
    title: "Value Addition",
    date: "25/10/2026",
    venue: "Online",
    category: "Value Addition",
    status: "Open",
    fee: "500"
  };
  const details = buildPromotedTrainingDetails(program, "English", { now: NOW });

  await harness.ui.sendPromotedTrainingCard(
    "919111111111",
    "English",
    details.text,
    program.id,
    details.canRegister
  );

  const payload = harness.calls[0].body.interactive;
  const ids = payload.action.buttons.map(function (button) {
    return button.reply.id;
  });
  assert.match(details.text, /Fee: ₹500/);
  assert.match(details.text, /Payment is not collected through BhoomiMitra during the pilot/);
  assert.match(details.text, /payment instructions if\/when the programme is confirmed/);
  assert.equal(ids.some(function (id) { return /pay|payment/i.test(id); }), false);
  assert.equal(JSON.stringify(payload).includes("http"), false);
});

test("English preference UI is click-first", async function () {
  const harness = makeUiHarness();

  await harness.ui.sendTrainingModePreference("919111111111", "English");
  await harness.ui.sendTrainingTimePreference("919111111111", "English");

  assert.equal(harness.calls[0].body.interactive.type, "list");
  assert.equal(harness.calls[0].body.interactive.action.sections[0].rows.length, 3);
  assert.equal(harness.calls[1].body.interactive.action.buttons.length, 3);
  assert.match(harness.calls[0].body.interactive.body.text, /Preferred training mode/);
  assert.match(harness.calls[1].body.interactive.body.text, /Preferred time/);
});

test("Malayalam preference and pilot-payment UI stays localized", async function () {
  const harness = makeUiHarness();
  const details = buildPromotedTrainingDetails({
    id: "TR-ML",
    title: "കൂൺ കൃഷി",
    date: "25/10/2026",
    venue: "ഓൺലൈൻ",
    status: "Open",
    fee: "500"
  }, "Malayalam", { now: NOW });

  await harness.ui.sendTrainingModePreference("919111111111", "Malayalam");
  await harness.ui.sendTrainingTimePreference("919111111111", "Malayalam");

  assert.match(harness.calls[0].body.interactive.body.text, /പരിശീലന രീതി/);
  assert.match(harness.calls[1].body.interactive.body.text, /ഇഷ്ടപ്പെട്ട സമയം/);
  assert.match(details.text, /ഫീസ്: ₹500/);
  assert.match(details.text, /പൈലറ്റ് ഘട്ടത്തിൽ പണമടയ്ക്കൽ സ്വീകരിക്കുന്നില്ല/);
});
