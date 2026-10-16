"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  EXPERT_CASE_HEADERS,
  assignExpertCase,
  buildExpertNotificationParts,
  buildRowFromHeaders,
  buildSheetCellUpdates,
  consumeRecentExpertProblem,
  createCaseId,
  getRecentExpertProblem,
  makeHeaderMap,
  getHeaderValue,
  parseExpertReplyText,
  rememberRecentExpertProblem,
  resolveExpertProblemContext
} = require("../utils/expertAssignment");

function makeExpertRow(overrides) {
  const row = new Array(39).fill("");
  const values = Object.assign({
    expertId: "BM-EX-100",
    name: "Dr. Maya",
    mobile: "9876543210",
    whatsapp: "9876543210",
    district: "Kottayam",
    group: "Crop production",
    specialization: "paddy, disease",
    availability: "Available",
    autoRoute: "Yes",
    status: "Active",
    rating: 4.8,
    openCases: 0
  }, overrides || {});

  row[0] = values.expertId;
  row[1] = values.name;
  row[3] = values.mobile;
  row[4] = values.whatsapp;
  row[9] = values.district;
  row[16] = values.group;
  row[17] = values.specialization;
  row[25] = values.availability;
  row[26] = values.autoRoute;
  row[27] = values.status;
  row[35] = values.rating;
  row[36] = values.openCases;

  return row;
}

function makeCaseData(overrides) {
  return Object.assign({
    sourceMessageId: "wamid.inbound-1",
    whatsapp: "919876543211",
    farmerId: "BM-200",
    farmerName: "Anu",
    district: "Kottayam",
    panchayath: "Ayarkunnam",
    crop: "Paddy",
    problem: "Brown spots are spreading across the paddy leaves. Please connect an expert.",
    aiDiagnosis: "Possible fungal leaf spot; field verification is advised.",
    aiConfidence: 60,
    mediaAvailable: true,
    imageIds: "media-123"
  }, overrides || {});
}

function makeHarness(overrides) {
  const state = {
    appendedRows: [],
    updates: [],
    sends: []
  };
  const settings = Object.assign({
    expertRows: [makeExpertRow()],
    caseRows: [EXPERT_CASE_HEADERS.slice()],
    appendResult: { success: true, rowNumber: 2 },
    sendResult: { accepted: true, messageId: "wamid.expert-accepted" },
    updateResult: true
  }, overrides || {});

  const dependencies = {
    caseData: makeCaseData(settings.caseData),
    readSheetRows: async function (sheetName) {
      if (sheetName === "Expert_Cases") {
        return settings.caseRows;
      }

      if (sheetName === "Expert_Directory") {
        return settings.expertRows;
      }

      return [];
    },
    appendRow: async function (sheetName, row) {
      state.appendedRows.push({ sheetName: sheetName, row: row });

      if (settings.appendError) {
        throw settings.appendError;
      }

      return settings.appendResult;
    },
    updateCase: async function (input) {
      state.updates.push(input);
      return settings.updateResult;
    },
    sendExpertMessage: async function (to, message, options) {
      state.sends.push({ to: to, message: message, options: options });

      if (settings.sendErrorAt === state.sends.length) {
        throw settings.sendError || new Error("Meta request rejected");
      }

      if (settings.sendError && !settings.sendErrorAt) {
        throw settings.sendError;
      }

      if (typeof settings.sendResultFactory === "function") {
        return settings.sendResultFactory(state.sends.length);
      }

      return settings.sendResult;
    }
  };

  return { dependencies: dependencies, state: state };
}

function recoverProblemFromNotificationParts(parts) {
  return parts
    .filter(function (part) {
      return (
        part.includes("\nProblem:\n") ||
        part.startsWith("📝 Case continuation\n")
      );
    })
    .map(function (part, index) {
      const separator = index === 0
        ? "\nProblem:\n"
        : "\n\n";
      return part.substring(part.indexOf(separator) + separator.length);
    })
    .join("");
}

test("Sheet append returning false fails assignment and does not notify expert", async function () {
  const harness = makeHarness({ appendResult: false });
  const result = await assignExpertCase(harness.dependencies);

  assert.equal(result.success, false);
  assert.match(result.error, /append failed/i);
  assert.equal(harness.state.sends.length, 0);
  assert.doesNotMatch(result.farmerMessage, /has been assigned/i);
});

test("Sheet append throwing fails assignment and does not notify expert", async function () {
  const harness = makeHarness({ appendError: new Error("quota exceeded") });
  const result = await assignExpertCase(harness.dependencies);

  assert.equal(result.success, false);
  assert.match(result.error, /quota exceeded/i);
  assert.equal(harness.state.sends.length, 0);
  assert.doesNotMatch(result.farmerMessage, /has been assigned/i);
});

test("expert WhatsApp rejection records failed notification and no false farmer success", async function () {
  const harness = makeHarness({ sendError: new Error("Meta request rejected") });
  const result = await assignExpertCase(harness.dependencies);

  assert.equal(result.success, false);
  assert.doesNotMatch(result.farmerMessage, /has been assigned/i);
  assert.equal(harness.state.updates.length, 1);
  assert.equal(
    harness.state.updates[0].valuesByHeader.Expert_Notification_Status,
    "Failed"
  );
  assert.equal(harness.state.updates[0].valuesByHeader.Notification_Attempts, 1);
  assert.match(
    harness.state.updates[0].valuesByHeader.Last_Notification_Error,
    /Meta request rejected/
  );
  assert.ok(harness.state.updates[0].valuesByHeader.Last_Notification_At);
});

test("send without an accepted Meta message ID is treated as failure", async function () {
  const harness = makeHarness({ sendResult: { accepted: false, messageId: "" } });
  const result = await assignExpertCase(harness.dependencies);

  assert.equal(result.success, false);
  assert.match(result.error, /accepted WhatsApp message ID/i);
  assert.doesNotMatch(result.farmerMessage, /has been assigned/i);
  assert.equal(
    harness.state.updates[0].valuesByHeader.Status,
    "Expert Notification Failed"
  );
});

test("successful save and accepted expert delivery persists assignment before farmer success", async function () {
  const harness = makeHarness();
  const result = await assignExpertCase(harness.dependencies);

  assert.equal(result.success, true);
  assert.equal(result.farmerMessage, "Expert Dr. Maya has been assigned");
  assert.equal(harness.state.updates.length, 1);
  assert.equal(harness.state.updates[0].valuesByHeader.Status, "Assigned");
  assert.equal(
    harness.state.updates[0].valuesByHeader.Expert_Notification_Status,
    "Accepted"
  );
  assert.equal(
    harness.state.updates[0].valuesByHeader.Expert_Notification_Message_ID,
    "wamid.expert-accepted"
  );
  assert.equal(
    harness.state.updates[0].valuesByHeader.Assigned_Expert_ID,
    "BM-EX-100"
  );
  assert.equal(
    harness.state.updates[0].valuesByHeader.Assigned_Expert_WhatsApp,
    "919876543210"
  );
  assert.ok(harness.state.updates[0].valuesByHeader.Assigned_At);
});

test("farmer success is withheld if the post-delivery Sheet update fails", async function () {
  const harness = makeHarness({ updateResult: false });
  const result = await assignExpertCase(harness.dependencies);

  assert.equal(result.success, false);
  assert.equal(harness.state.sends.length, 1);
  assert.doesNotMatch(result.farmerMessage, /has been assigned/i);
  assert.match(result.error, /status update failed/i);
});

test("expert notification contains Case ID, full question, farmer context, and media indication", async function () {
  const fullQuestion =
    "The lower paddy leaves have complete brown rings after three days of rain; please advise what I should inspect next.";
  const harness = makeHarness({ caseData: { problem: fullQuestion } });
  const result = await assignExpertCase(harness.dependencies);
  const notification = harness.state.sends[0].message;

  assert.equal(result.success, true);
  assert.ok(notification.includes("Case ID: " + result.caseId));
  assert.ok(notification.includes(fullQuestion));
  assert.match(notification, /Farmer: Anu \(BM-200\)/);
  assert.match(notification, /District: Kottayam/);
  assert.match(notification, /Crop\/Animal: Paddy/);
  assert.match(notification, /Category:/);
  assert.match(notification, /Photo\/media available: Yes/);
  assert.match(notification, /AI provisional assessment:/);
  assert.equal(harness.state.sends[0].options.skipPreferredLanguageConversion, true);
});

test("a later escalation command uses the latest detailed active-case problem", async function () {
  const detailedProblem =
    "Brown circular patches appeared on the lower paddy leaves after continuous rain.";
  const context = resolveExpertProblemContext({
    currentText: "Talk to expert",
    activeCase: {
      subject: detailedProblem,
      recentMessages: [
        { type: "text", text: detailedProblem },
        { type: "text", text: "Talk to expert" }
      ]
    }
  });
  const harness = makeHarness({
    caseData: {
      problem: context.problem,
      caseSummary: context.caseSummary
    }
  });
  await assignExpertCase(harness.dependencies);

  assert.equal(context.usedPriorProblem, true);
  assert.equal(context.problem, detailedProblem);
  assert.match(harness.state.sends[0].message, /Problem:\nBrown circular patches/);
  assert.doesNotMatch(harness.state.sends[0].message, /Problem:\nTalk to expert/);
});

test("an escalation command with no prior problem uses a safe descriptive fallback", function () {
  const context = resolveExpertProblemContext({
    currentText: "Talk to expert",
    activeCase: {
      subject: "",
      recentMessages: [
        { type: "text", text: "Talk to expert" }
      ]
    }
  });

  assert.equal(
    context.problem,
    "Expert assistance requested; no detailed farmer problem is available."
  );
  assert.equal(context.caseSummary, "");
  assert.equal(context.usedPriorProblem, false);
  assert.equal(context.problemSource, "FALLBACK");
});

test("live detailed question then later escalation recovers the original farmer problem", async function () {
  const store = {};
  const farmer = "919876543211";
  const problem =
    "My rambutan leaves have brown circular patches and some fruits are dropping.";

  rememberRecentExpertProblem(store, farmer, {
    text: problem,
    timestamp: 1000,
    crop: "Rambutan",
    category: "general_agriculture",
    detectedIntent: "general_agriculture"
  });

  const recent = getRecentExpertProblem(store, farmer, 5000, 2000);
  const context = resolveExpertProblemContext({
    currentText: "Talk to expert",
    activeCase: null,
    recentProblem: recent && recent.text
  });
  const harness = makeHarness({
    caseData: {
      crop: recent.crop,
      problem: context.problem,
      caseSummary: context.caseSummary
    }
  });
  const result = await assignExpertCase(harness.dependencies);

  assert.equal(context.problemSource, "RECENT");
  assert.equal(result.success, true);
  assert.match(harness.state.sends[0].message, new RegExp(problem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(harness.state.sends[0].message, /Problem:\nTalk to expert/);
});

test("live Malayalam problem is recovered for a later Malayalam expert-help command", function () {
  const store = {};
  const farmer = "919876543212";
  const problem =
    "എന്റെ റംബൂട്ടാൻ ഇലകളിൽ തവിട്ടുനിറത്തിലുള്ള വൃത്താകൃതിയിലുള്ള പാടുകൾ കാണുന്നു, ചില പഴങ്ങൾ കൊഴിയുന്നു.";

  rememberRecentExpertProblem(store, farmer, {
    text: problem,
    timestamp: 1000,
    crop: "Rambutan",
    detectedIntent: "general_agriculture"
  });

  const recent = getRecentExpertProblem(store, farmer, 5000, 2000);
  const context = resolveExpertProblemContext({
    currentText: "വിദഗ്ധ സഹായം വേണം",
    activeCase: null,
    recentProblem: recent && recent.text
  });

  assert.equal(context.problem, problem);
  assert.equal(context.problemSource, "RECENT");
});

test("expired recent problem is removed and not reused", function () {
  const store = {};
  const farmer = "919876543213";

  rememberRecentExpertProblem(store, farmer, {
    text: "Rambutan leaves have spreading brown circular patches.",
    timestamp: 1000,
    detectedIntent: "general_agriculture"
  });

  const recent = getRecentExpertProblem(store, farmer, 5000, 7001);
  const context = resolveExpertProblemContext({
    currentText: "Talk to expert",
    recentProblem: recent && recent.text
  });

  assert.equal(recent, null);
  assert.equal(store[farmer], undefined);
  assert.equal(context.problemSource, "FALLBACK");
});

test("one farmer can never receive another farmer's recent problem", function () {
  const store = {};

  rememberRecentExpertProblem(store, "919876543214", {
    text: "Pepper vines have yellow leaves and dark lesions.",
    timestamp: 1000,
    detectedIntent: "general_agriculture"
  });

  const recent = getRecentExpertProblem(
    store,
    "919876543215",
    5000,
    2000
  );
  const context = resolveExpertProblemContext({
    currentText: "Talk to expert",
    recentProblem: recent && recent.text
  });

  assert.equal(recent, null);
  assert.equal(context.problemSource, "FALLBACK");
});

test("menu, weather, market, ID and language messages are not stored as expert problems", function () {
  const messages = [
    ["Please show the main menu options", "general_agriculture"],
    ["What is the weather forecast for tomorrow?", "weather"],
    ["What is today's market price for rambutan?", "market"],
    ["BM-L-000003", "general_agriculture"],
    ["Change my language to Malayalam", "general_agriculture"]
  ];

  messages.forEach(function (item, index) {
    const store = {};
    const entry = rememberRecentExpertProblem(store, "farmer-" + index, {
      text: item[0],
      timestamp: 1000,
      detectedIntent: item[1]
    });

    assert.equal(entry, null, item[0]);
    assert.deepEqual(store, {}, item[0]);
  });
});

test("successful assignment consumes the recovered recent problem", async function () {
  const store = {};
  const farmer = "919876543216";

  rememberRecentExpertProblem(store, farmer, {
    text: "Rambutan leaves have brown circular patches and fruits are dropping.",
    timestamp: 1000,
    detectedIntent: "general_agriculture"
  });

  const recent = getRecentExpertProblem(store, farmer, 5000, 2000);
  const context = resolveExpertProblemContext({
    currentText: "Talk to expert",
    recentProblem: recent.text
  });
  const harness = makeHarness({ caseData: { problem: context.problem } });
  const result = await assignExpertCase(harness.dependencies);

  if (result.success && context.problemSource === "RECENT") {
    consumeRecentExpertProblem(store, farmer, recent.timestamp);
  }

  assert.equal(result.success, true);
  assert.equal(store[farmer], undefined);
});

test("failed expert assignment keeps recent problem available for retry", async function () {
  const store = {};
  const farmer = "919876543217";

  rememberRecentExpertProblem(store, farmer, {
    text: "Rambutan leaves have brown circular patches and fruits are dropping.",
    timestamp: 1000,
    detectedIntent: "general_agriculture"
  });

  const recent = getRecentExpertProblem(store, farmer, 5000, 2000);
  const context = resolveExpertProblemContext({
    currentText: "Talk to expert",
    recentProblem: recent.text
  });
  const harness = makeHarness({
    caseData: { problem: context.problem },
    sendError: new Error("Meta request rejected")
  });
  const result = await assignExpertCase(harness.dependencies);

  if (result.success && context.problemSource === "RECENT") {
    consumeRecentExpertProblem(store, farmer, recent.timestamp);
  }

  assert.equal(result.success, false);
  assert.equal(store[farmer].text, recent.text);
});

test("new unrelated detailed problem replaces an older recent problem", function () {
  const store = {};
  const farmer = "919876543218";
  const older = "Pepper vines have yellow leaves and weak new growth.";
  const newer = "Rambutan fruits are dropping after brown patches appeared on leaves.";

  rememberRecentExpertProblem(store, farmer, {
    text: older,
    timestamp: 1000,
    detectedIntent: "general_agriculture"
  });
  rememberRecentExpertProblem(store, farmer, {
    text: newer,
    timestamp: 2000,
    crop: "Rambutan",
    detectedIntent: "general_agriculture"
  });

  const recent = getRecentExpertProblem(store, farmer, 5000, 2500);

  assert.equal(recent.text, newer);
  assert.equal(recent.crop, "Rambutan");
  assert.equal(recent.timestamp, 2000);
});

test("active-case detailed problem takes precedence over recent problem", function () {
  const context = resolveExpertProblemContext({
    currentText: "Talk to expert",
    activeCase: {
      subject: "Pepper vines have yellow leaves and dark lesions.",
      recentMessages: [
        {
          type: "text",
          text: "Pepper vines have yellow leaves and dark lesions."
        },
        { type: "text", text: "Talk to expert" }
      ]
    },
    recentProblem:
      "Rambutan leaves have brown circular patches and fruits are dropping."
  });

  assert.equal(
    context.problem,
    "Pepper vines have yellow leaves and dark lesions."
  );
  assert.equal(context.problemSource, "ACTIVE_CASE");
});

test("long English problem is preserved exactly across accepted notification parts", async function () {
  const question = (
    "The pepper vines show yellow leaves, weak new growth, and dark lesions after rain. "
  ).repeat(70);
  const harness = makeHarness({
    caseData: { problem: question },
    sendResultFactory: function (partNumber) {
      return {
        accepted: true,
        messageId: "wamid.part-" + partNumber
      };
    }
  });
  const result = await assignExpertCase(harness.dependencies);
  const parts = harness.state.sends.map(function (send) {
    return send.message;
  });

  assert.equal(result.success, true);
  assert.ok(parts.length > 1);
  assert.equal(recoverProblemFromNotificationParts(parts), question.trim());
  parts.forEach(function (part) {
    assert.ok(part.length <= 3200);
    assert.ok(part.includes("Case ID: " + result.caseId));
  });
  assert.deepEqual(
    result.notificationMessageIds,
    parts.map(function (part, index) {
      return "wamid.part-" + (index + 1);
    })
  );
  assert.equal(
    harness.state.updates[0].valuesByHeader.Notification_Attempts,
    parts.length
  );
  assert.equal(
    harness.state.updates[0].valuesByHeader.Expert_Notification_Message_ID,
    "wamid.part-1"
  );
});

test("long Malayalam problem is preserved without broken grapheme clusters", function () {
  const question = (
    "തുടർച്ചയായ മഴയ്ക്ക് ശേഷം നെല്ലിന്റെ ഇലകളിൽ തവിട്ടുനിറത്തിലുള്ള പാടുകൾ വ്യാപിക്കുന്നു. "
  ).repeat(80).trim();
  const preparedCase = makeCaseData({
    caseId: "BM-EXP-MALAYALAM",
    problem: question,
    problemCategory: "Disease",
    priority: "High",
    caseSummary: ""
  });
  const parts = buildExpertNotificationParts(preparedCase);

  assert.ok(parts.length > 1);
  assert.equal(recoverProblemFromNotificationParts(parts), question);
  parts.forEach(function (part) {
    assert.ok(part.length <= 3200);
    assert.ok(part.includes("Case ID: BM-EXP-MALAYALAM"));
    assert.equal(part.includes("�"), false);
  });
});

test("failure of a continuation notification withholds farmer assignment success", async function () {
  const question = "Detailed crop symptom and field condition. ".repeat(100);
  const harness = makeHarness({
    caseData: { problem: question },
    sendErrorAt: 2,
    sendError: new Error("continuation rejected"),
    sendResultFactory: function (partNumber) {
      return {
        accepted: true,
        messageId: "wamid.part-" + partNumber
      };
    }
  });
  const result = await assignExpertCase(harness.dependencies);

  assert.equal(result.success, false);
  assert.equal(harness.state.sends.length, 2);
  assert.doesNotMatch(result.farmerMessage, /has been assigned/i);
  assert.match(result.error, /part 2 .*continuation rejected/i);
  assert.equal(
    harness.state.updates[0].valuesByHeader.Notification_Attempts,
    2
  );
  assert.equal(
    harness.state.updates[0].valuesByHeader.Expert_Notification_Message_ID,
    "wamid.part-1"
  );
});

test("no eligible expert saves a pending case but sends no notification", async function () {
  const harness = makeHarness({
    expertRows: [
      makeExpertRow({
        status: "Inactive",
        availability: "Unavailable",
        autoRoute: "No"
      })
    ]
  });
  const result = await assignExpertCase(harness.dependencies);
  const headerMap = makeHeaderMap(EXPERT_CASE_HEADERS);
  const savedRow = harness.state.appendedRows[0].row;

  assert.equal(result.success, false);
  assert.match(result.error, /No eligible expert/i);
  assert.equal(harness.state.sends.length, 0);
  assert.equal(
    getHeaderValue(savedRow, headerMap, "Status"),
    "Pending Expert Notification"
  );
  assert.equal(
    getHeaderValue(savedRow, headerMap, "Expert_Notification_Status"),
    "Pending - No Eligible Expert"
  );
  assert.doesNotMatch(result.farmerMessage, /has been assigned/i);
});

test("duplicate Source_Message_ID prevents another append or expert notification", async function () {
  const headers = EXPERT_CASE_HEADERS.slice();
  const duplicateRow = buildRowFromHeaders(headers, {
    Case_ID: "BM-EXP-EXISTING",
    Assigned_Expert: "Dr. Maya",
    Status: "Assigned",
    Source_Message_ID: "wamid.inbound-1",
    Expert_Notification_Message_ID: "wamid.original"
  });
  const harness = makeHarness({ caseRows: [headers, duplicateRow] });
  const result = await assignExpertCase(harness.dependencies);

  assert.equal(result.success, true);
  assert.equal(result.duplicate, true);
  assert.equal(result.caseId, "BM-EXP-EXISTING");
  assert.equal(harness.state.appendedRows.length, 0);
  assert.equal(harness.state.sends.length, 0);
  assert.equal(result.farmerMessage, "Expert Dr. Maya has been assigned");
});

test("Case IDs remain unique even when generated in the same millisecond", function () {
  const originalNow = Date.now;
  Date.now = function () {
    return 1800000000000;
  };

  try {
    const ids = new Set();

    for (let index = 0; index < 1000; index += 1) {
      const id = createCaseId();
      assert.match(id, /^BM-EXP-[A-F0-9-]+$/);
      ids.add(id);
    }

    assert.equal(ids.size, 1000);
  } finally {
    Date.now = originalNow;
  }
});

test("header mapping writes correct values when columns are reordered", function () {
  const headers = EXPERT_CASE_HEADERS.slice().reverse();
  const row = buildRowFromHeaders(headers, {
    Case_ID: "BM-EXP-MAPPED",
    Status: "Pending Expert Notification",
    Farmer_ID: "BM-200",
    Assigned_Expert_ID: "BM-EX-100",
    Assigned_Expert_WhatsApp: "919876543210",
    Category: "Disease",
    Source_Message_ID: "wamid.mapped"
  });
  const headerMap = makeHeaderMap(headers);

  assert.equal(getHeaderValue(row, headerMap, "Case_ID"), "BM-EXP-MAPPED");
  assert.equal(
    getHeaderValue(row, headerMap, "Status"),
    "Pending Expert Notification"
  );
  assert.equal(getHeaderValue(row, headerMap, "Farmer_ID"), "BM-200");
  assert.equal(
    getHeaderValue(row, headerMap, "Assigned_Expert_ID"),
    "BM-EX-100"
  );
  assert.equal(
    getHeaderValue(row, headerMap, "Assigned_Expert_WhatsApp"),
    "919876543210"
  );
  assert.equal(getHeaderValue(row, headerMap, "Category"), "Disease");
  assert.equal(
    getHeaderValue(row, headerMap, "Source_Message_ID"),
    "wamid.mapped"
  );
});

test("initial saved row keeps legacy A:S semantics and appends new fields by name", async function () {
  const harness = makeHarness();
  await assignExpertCase(harness.dependencies);
  const row = harness.state.appendedRows[0].row;
  const map = makeHeaderMap(EXPERT_CASE_HEADERS);

  assert.equal(getHeaderValue(row, map, "Assigned_Expert"), "Dr. Maya");
  assert.equal(getHeaderValue(row, map, "Status"), "Pending Expert Notification");
  assert.equal(getHeaderValue(row, map, "Expert_Remark"), "");
  assert.equal(getHeaderValue(row, map, "Closed_Date"), "");
  assert.equal(getHeaderValue(row, map, "Photo_URL"), "");
  assert.equal(getHeaderValue(row, map, "Farmer_Feedback"), "");
  assert.equal(getHeaderValue(row, map, "Farmer_ID"), "BM-200");
  assert.equal(getHeaderValue(row, map, "Category"), "Disease");
  assert.equal(getHeaderValue(row, map, "Source_Message_ID"), "wamid.inbound-1");
});

test("missing required Expert_Cases header fails before append or notification", async function () {
  const headers = EXPERT_CASE_HEADERS.filter(function (header) {
    return header !== "Source_Message_ID";
  });
  const harness = makeHarness({ caseRows: [headers] });
  const result = await assignExpertCase(harness.dependencies);

  assert.equal(result.success, false);
  assert.deepEqual(result.missingHeaders, ["Source_Message_ID"]);
  assert.equal(harness.state.appendedRows.length, 0);
  assert.equal(harness.state.sends.length, 0);
  assert.doesNotMatch(result.farmerMessage, /has been assigned/i);
});

test("concurrent calls with the same Source_Message_ID append and notify only once", async function () {
  let releaseAppend;
  let markAppendStarted;
  const appendStarted = new Promise(function (resolve) {
    markAppendStarted = resolve;
  });
  const appendReleased = new Promise(function (resolve) {
    releaseAppend = resolve;
  });
  let appendCount = 0;
  let sendCount = 0;
  const dependencies = {
    caseData: makeCaseData({ sourceMessageId: "wamid.concurrent" }),
    readSheetRows: async function (sheetName) {
      return sheetName === "Expert_Cases"
        ? [EXPERT_CASE_HEADERS.slice()]
        : [makeExpertRow()];
    },
    appendRow: async function () {
      appendCount += 1;
      markAppendStarted();
      await appendReleased;
      return { success: true, rowNumber: 2 };
    },
    updateCase: async function () {
      return true;
    },
    sendExpertMessage: async function () {
      sendCount += 1;
      return { accepted: true, messageId: "wamid.concurrent-expert" };
    }
  };

  const first = assignExpertCase(dependencies);
  await appendStarted;
  const second = await assignExpertCase(dependencies);
  releaseAppend();
  const firstResult = await first;

  assert.equal(firstResult.success, true);
  assert.equal(second.success, false);
  assert.equal(second.duplicate, true);
  assert.equal(appendCount, 1);
  assert.equal(sendCount, 1);
});

test("header-aware cell updates target the exact T:AD columns", function () {
  const updates = buildSheetCellUpdates(
    EXPERT_CASE_HEADERS,
    42,
    "Expert_Cases",
    {
      Farmer_ID: "BM-200",
      Status: "Assigned",
      Assigned_At: "2026-10-16T00:00:00.000Z",
      Last_Notification_At: "2026-10-16T00:00:01.000Z"
    }
  );

  assert.deepEqual(
    updates.map(function (update) {
      return update.range;
    }),
    [
      "'Expert_Cases'!T42",
      "'Expert_Cases'!M42",
      "'Expert_Cases'!X42",
      "'Expert_Cases'!AD42"
    ]
  );
  assert.deepEqual(updates[0].values, [["BM-200"]]);
});

test("expert reply parser supports UUID-style BM-EXP Case IDs", function () {
  const parsed = parseExpertReplyText(
    "REPLY BM-EXP-123E4567-E89B-12D3-A456-426614174000\nInspect the lower leaves."
  );

  assert.deepEqual(parsed, {
    caseId: "BM-EXP-123E4567-E89B-12D3-A456-426614174000",
    advice: "Inspect the lower leaves."
  });
});
