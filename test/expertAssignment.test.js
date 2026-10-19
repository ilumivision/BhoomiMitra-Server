"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createBhoomiMitraUI
} = require("../utils/bhoomiMitraUI");
const {
  EXPERT_ADVICE_ACTION_IDS,
  PILOT_CASE_STATUSES,
  buildExpertCaseSelectionRows,
  buildFarmerCaseView,
  buildFarmerFollowUpPrompt,
  buildFarmerAssignmentCard,
  createExpertQuestionId,
  findFarmerCases,
  getExpertAdviceAction,
  parseExpertCaseAction,
  processExpertReply,
  processFarmerFollowUp,
  shouldCreateExpertCase
} = require("../utils/expertAdviceFlow");

const {
  EXPERT_CASE_HEADERS,
  assignExpertCase,
  buildExpertNotificationParts,
  buildRowFromHeaders,
  buildSheetCellUpdates,
  chooseBestExpert,
  consumeRecentExpertProblem,
  createCaseId,
  getRecentExpertProblem,
  isEscalationOnlyMessage,
  makeHeaderMap,
  getHeaderValue,
  parseExpertReplyText,
  rememberRecentExpertProblem,
  resolveExpertProblemContext
} = require("../utils/expertAssignment");

function makeExpertRow(overrides) {
  const row = new Array(45).fill("");
  const values = Object.assign({
    expertId: "BM-EX-100",
    name: "Dr. Maya",
    mobile: "9876543210",
    whatsapp: "9876543210",
    district: "Kottayam",
    group: "Crop production",
    specialization: "paddy, disease, rambutan",
    availability: "Available",
    autoRoute: "Yes",
    status: "Active",
    verificationStatus: "Verified",
    activeStatus: "Active",
    rating: 4.8,
    farmersAssigned: 0,
    currentConsultationCount: 0
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
  row[30] = values.verificationStatus;
  row[32] = values.activeStatus;
  row[35] = values.rating;
  row[36] = values.farmersAssigned;
  row[42] = values.currentConsultationCount;

  return row;
}

function makeRobertExpertRow(overrides) {
  return makeExpertRow(Object.assign({
    expertId: "EXP001",
    name: "Dr C P Robert",
    district: "Pathanamthitta",
    group:
      "Plant Pathology, Agricultural Extension, Biocontrol",
    specialization:
      "Plant Disease Diagnosis, Biocontrol Agents, Arbuscular Mycorrhizal Fungi (AMF), Mycorrhiza, Biofertilizers, Soil Microbiology, Rhizosphere Management, Organic Farming",
    rating: 5
  }, overrides || {}));
}

function makeRincyExpertRow(overrides) {
  return makeExpertRow(Object.assign({
    expertId: "EXP004",
    name: "Dr Rincy K Abraham",
    district: "Pathanamthitta",
    group:
      "Horticulture, Fruit Crops, Plantation Crops",
    specialization:
      "Horticulture, Fruit Crops, Plantation Crops, Pomology, Rambutan, Mangosteen, Mango, Banana, Jackfruit, Orchard Management, Flowering, Fruit Set, Fruit Drop, Grafting, Nursery Management",
    rating: 5
  }, overrides || {}));
}

function makeShanaExpertRow(overrides) {
  return makeExpertRow(Object.assign({
    expertId: "EXP007",
    name: "Dr Shana Harshan",
    district: "Pathanamthitta",
    group:
      "Home Science, Community Science, Food and Nutrition",
    specialization:
      "Food Science, Nutrition, Food Processing, Value Addition, Food Preservation, Jackfruit Products, Banana Products, Food Safety, Packaging, Labelling",
    rating: 5
  }, overrides || {}));
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

function makeUiHarness() {
  const calls = [];
  const ui = createBhoomiMitraUI({
    axios: {
      post: async function (url, body, config) {
        calls.push({
          url: url,
          body: body,
          config: config
        });
        return {
          data: {
            messages: [{ id: "wamid.ui" }]
          }
        };
      }
    },
    phoneNumberId: "phone-id",
    whatsappToken: "token"
  });

  return { ui: ui, calls: calls };
}

function makePilotCaseRows(cases) {
  return [EXPERT_CASE_HEADERS].concat(
    (cases || []).map(function (caseValues) {
      return buildRowFromHeaders(
        EXPERT_CASE_HEADERS,
        caseValues
      );
    })
  );
}

function makePilotWorkflowHarness(cases) {
  const state = {
    rows: makePilotCaseRows(cases),
    updates: [],
    farmerSends: [],
    expertSends: []
  };

  return {
    state: state,
    readSheetRows: async function () {
      return state.rows;
    },
    updateCase: async function (update) {
      state.updates.push(update);
      return true;
    },
    sendFarmerMessage: async function (to, record, advice) {
      state.farmerSends.push({
        to: to,
        record: record,
        advice: advice
      });
      return {
        accepted: true,
        messageId: "wamid.farmer"
      };
    },
    sendExpertMessage: async function (to, message) {
      state.expertSends.push({ to: to, message: message });
      return {
        accepted: true,
        messageId: "wamid.expert-follow-up"
      };
    }
  };
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
    "Pending Expert Notification"
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
  assert.ok(
    notification.includes(
      encodeURIComponent("REPLY " + result.caseId + "\n")
    )
  );
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

test("Get Me expert recovers and routes the prior live Mycorrhiza question", async function () {
  const store = {};
  const farmer = "919876543299";
  const problem =
    "I want to use mycorrhizal. Where can I get advice?";

  rememberRecentExpertProblem(store, farmer, {
    text: problem,
    timestamp: 1000,
    crop: "Rambutan",
    category: "general_agriculture",
    detectedIntent: "general_agriculture"
  });

  const recent = getRecentExpertProblem(
    store,
    farmer,
    5000,
    2000
  );
  const context = resolveExpertProblemContext({
    currentText: "Get Me expert",
    activeCase: null,
    recentProblem: recent && recent.text
  });
  const match = chooseBestExpert(
    [makeRincyExpertRow(), makeRobertExpertRow()],
    {
      crop: recent.crop,
      problem: context.problem,
      problemCategory: "General Agriculture",
      district: "Pathanamthitta"
    }
  );
  const harness = makeHarness({
    expertRows: [
      makeRincyExpertRow(),
      makeRobertExpertRow()
    ],
    caseData: {
      crop: recent.crop,
      problem: context.problem,
      problemCategory: "General Agriculture",
      district: "Pathanamthitta"
    }
  });
  const result = await assignExpertCase(
    harness.dependencies
  );

  assert.equal(isEscalationOnlyMessage("Get Me expert"), true);
  assert.equal(context.problem, problem);
  assert.equal(context.problemSource, "RECENT");
  assert.ok(match);
  assert.equal(match.expert.expertName, "Dr C P Robert");
  assert.equal(result.success, true);
  assert.equal(result.expert.expertName, "Dr C P Robert");
  assert.match(
    harness.state.sends[0].message,
    new RegExp(problem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  );
});

test("click-first AI answer then Yes assigns the stored original problem", async function () {
  const problem =
    "I want to use mycorrhizal. Where can I get advice?";
  const session = {
    step: "awaiting_confirmation",
    mode: "ai_first",
    problem: problem,
    crop: "",
    category: "General Agriculture",
    aiReply: "Mycorrhiza can support root nutrient uptake."
  };
  const action = getExpertAdviceAction(
    EXPERT_ADVICE_ACTION_IDS.CONFIRM_YES,
    ""
  );
  const harness = makeHarness({
    expertRows: [
      makeRincyExpertRow(),
      makeRobertExpertRow()
    ],
    caseData: {
      crop: session.crop,
      problem: session.problem,
      problemCategory: session.category,
      aiDiagnosis: session.aiReply,
      district: "Pathanamthitta"
    }
  });

  assert.equal(action, "CONFIRM_YES");
  assert.equal(
    shouldCreateExpertCase(action, session),
    true
  );

  const result = await assignExpertCase(
    harness.dependencies
  );
  const card = buildFarmerAssignmentCard(
    result,
    session
  );

  assert.equal(result.success, true);
  assert.equal(result.expert.expertName, "Dr C P Robert");
  assert.match(harness.state.sends[0].message, /I want to use mycorrhizal/);
  assert.ok(card);
  assert.match(card.text, /Expert: Dr C P Robert/);
});

test("click-first No does not authorize expert-case creation", function () {
  const session = {
    step: "awaiting_confirmation",
    problem: "Rambutan fruits are dropping after flowering."
  };
  const action = getExpertAdviceAction(
    EXPERT_ADVICE_ACTION_IDS.CONFIRM_NO,
    ""
  );
  const harness = makeHarness();

  assert.equal(action, "CONFIRM_NO");
  assert.equal(
    shouldCreateExpertCase(action, session),
    false
  );
  assert.equal(harness.state.appendedRows.length, 0);
  assert.equal(harness.state.sends.length, 0);
});

test("direct expert mode still requires the stored problem and Yes confirmation", function () {
  const directAction = getExpertAdviceAction(
    EXPERT_ADVICE_ACTION_IDS.DIRECT,
    ""
  );
  const sessionBeforeProblem = {
    step: "awaiting_problem",
    mode: "direct",
    problem: ""
  };

  assert.equal(directAction, "DIRECT");
  assert.equal(
    shouldCreateExpertCase(directAction, sessionBeforeProblem),
    false
  );
  assert.equal(
    shouldCreateExpertCase("CONFIRM_YES", sessionBeforeProblem),
    false
  );
});

test("Mycorrhiza-only click-first case omits stale Rambutan context", async function () {
  const problem =
    "Can mycorrhizal inoculants improve nutrient uptake in the roots?";
  const harness = makeHarness({
    expertRows: [
      makeRincyExpertRow(),
      makeRobertExpertRow()
    ],
    caseData: {
      crop: "",
      problem: problem,
      problemCategory: "General Agriculture",
      district: "Pathanamthitta"
    }
  });
  const result = await assignExpertCase(
    harness.dependencies
  );
  const card = buildFarmerAssignmentCard(result, {
    problem: problem,
    crop: "",
    category: "General Agriculture",
    language: "English"
  });

  assert.equal(result.expert.expertName, "Dr C P Robert");
  assert.match(harness.state.sends[0].message, /Topic: Mycorrhiza/);
  assert.match(harness.state.sends[0].message, /Crop\/Animal: Not specified/);
  assert.doesNotMatch(harness.state.sends[0].message, /Rambutan/i);
  assert.match(card.text, /Topic: Mycorrhiza/);
  assert.doesNotMatch(card.text, /Rambutan/i);
});

test("assignment card exists only after successful expert delivery", async function () {
  const failedHarness = makeHarness({
    expertRows: [makeRobertExpertRow()],
    caseData: {
      crop: "",
      problem: "Should I apply Mycorrhiza to improve root growth?",
      district: "Pathanamthitta"
    },
    sendResult: {
      accepted: false,
      messageId: ""
    }
  });
  const failedResult = await assignExpertCase(
    failedHarness.dependencies
  );

  assert.equal(failedResult.success, false);
  assert.equal(
    buildFarmerAssignmentCard(failedResult, {
      problem: "Should I apply Mycorrhiza to improve root growth?"
    }),
    null
  );
});

test("farmer assignment card shows a short Expert Qn ID without exposing the long Case ID", function () {
  const caseId =
    "BM-EXP-1234567890ABCDEF1234567890ABCDEF";
  const card = buildFarmerAssignmentCard({
    success: true,
    caseId: caseId,
    expert: {
      expertName: "Dr C P Robert"
    }
  }, {
    problem: "Is Mycorrhiza suitable for root growth?",
    language: "English"
  });

  assert.equal(
    card.expertQuestionId,
    createExpertQuestionId(caseId)
  );
  assert.match(card.text, /Expert Qn ID: EQ-90ABCDEF/);
  assert.doesNotMatch(card.text, /BM-EXP-/);
});

test("click-first follow-up view-case and main-menu IDs route without typed identifiers", function () {
  [
    [EXPERT_ADVICE_ACTION_IDS.FOLLOW_UP, "FOLLOW_UP"],
    [EXPERT_ADVICE_ACTION_IDS.VIEW_CASE, "VIEW_CASE"],
    [EXPERT_ADVICE_ACTION_IDS.MAIN_MENU, "MAIN_MENU"],
    [EXPERT_ADVICE_ACTION_IDS.ASK_ANOTHER, "ASK_ANOTHER"]
  ].forEach(function (scenario) {
    assert.equal(
      getExpertAdviceAction(scenario[0], ""),
      scenario[1]
    );
  });
});

test("English and Malayalam click-first expert buttons use stable action IDs", async function () {
  const english = makeUiHarness();
  const malayalam = makeUiHarness();

  await english.ui.sendExpertAdviceChoice(
    "919876543211",
    "English"
  );
  await english.ui.sendExpertConfirmation(
    "919876543211",
    "English",
    false
  );
  await english.ui.sendExpertDeclinedMenu(
    "919876543211",
    "English"
  );
  await english.ui.sendExpertAssignmentCard(
    "919876543211",
    "English",
    "👨‍🌾 Expert Consultation"
  );
  await malayalam.ui.sendExpertAdviceChoice(
    "919876543211",
    "Malayalam"
  );
  await malayalam.ui.sendExpertConfirmation(
    "919876543211",
    "Malayalam",
    true
  );

  const englishIds = english.calls.flatMap(function (call) {
    return call.body.interactive.action.buttons.map(
      function (button) {
        return button.reply.id;
      }
    );
  });
  const malayalamIds = malayalam.calls.flatMap(function (call) {
    return call.body.interactive.action.buttons.map(
      function (button) {
        return button.reply.id;
      }
    );
  });

  assert.ok(englishIds.includes(EXPERT_ADVICE_ACTION_IDS.AI_FIRST));
  assert.ok(englishIds.includes(EXPERT_ADVICE_ACTION_IDS.DIRECT));
  assert.ok(englishIds.includes(EXPERT_ADVICE_ACTION_IDS.CONFIRM_YES));
  assert.ok(englishIds.includes(EXPERT_ADVICE_ACTION_IDS.CONFIRM_NO));
  assert.ok(englishIds.includes(EXPERT_ADVICE_ACTION_IDS.FOLLOW_UP));
  assert.ok(englishIds.includes(EXPERT_ADVICE_ACTION_IDS.VIEW_CASE));
  assert.ok(englishIds.includes(EXPERT_ADVICE_ACTION_IDS.MAIN_MENU));
  assert.ok(malayalamIds.includes(EXPERT_ADVICE_ACTION_IDS.AI_FIRST));
  assert.ok(malayalamIds.includes(EXPERT_ADVICE_ACTION_IDS.DIRECT));
  assert.ok(malayalamIds.includes(EXPERT_ADVICE_ACTION_IDS.CONFIRM_YES));
  assert.ok(malayalamIds.includes(EXPERT_ADVICE_ACTION_IDS.CONFIRM_NO));
  assert.match(
    malayalam.calls[0].body.interactive.body.text,
    /വിദഗ്ധ സഹായം/
  );
});

test("persisted expert reply reaches only the farmer stored for its Case ID", async function () {
  const harness = makePilotWorkflowHarness([
    {
      Case_ID: "BM-EXP-CASE-A",
      WhatsApp: "919111111111",
      Problem: "Pepper leaves have yellow spots.",
      Assigned_Expert: "Dr. Maya",
      Assigned_Expert_WhatsApp: "919876543210",
      Status: "Assigned",
      Source_Message_ID: "wamid.case-a"
    },
    {
      Case_ID: "BM-EXP-CASE-B",
      WhatsApp: "919222222222",
      Problem: "Banana leaves are torn.",
      Assigned_Expert: "Dr. Maya",
      Assigned_Expert_WhatsApp: "919876543210",
      Status: "Assigned",
      Source_Message_ID: "wamid.case-b"
    }
  ]);

  const result = await processExpertReply({
    caseId: "BM-EXP-CASE-A",
    advice: "Remove affected leaves and monitor new growth.",
    expertWhatsApp: "9876543210",
    timestamp: "2026-10-17T10:00:00.000Z",
    readSheetRows: harness.readSheetRows,
    updateCase: harness.updateCase,
    sendFarmerMessage: harness.sendFarmerMessage
  });

  assert.equal(result.success, true);
  assert.equal(harness.state.farmerSends.length, 1);
  assert.equal(harness.state.farmerSends[0].to, "919111111111");
  assert.equal(harness.state.updates[0].rowNumber, 2);
  assert.equal(
    harness.state.updates[0].valuesByHeader.Status,
    PILOT_CASE_STATUSES.EXPERT_REPLIED
  );
  assert.match(
    harness.state.updates[0].valuesByHeader.Expert_Remark,
    /Remove affected leaves/
  );
});

test("expert with several cases routes each reply by explicit Case ID", async function () {
  const harness = makePilotWorkflowHarness([
    {
      Case_ID: "BM-EXP-FIRST",
      WhatsApp: "919111111111",
      Assigned_Expert: "Dr. Maya",
      Assigned_Expert_WhatsApp: "919876543210",
      Status: "Assigned"
    },
    {
      Case_ID: "BM-EXP-SECOND",
      WhatsApp: "919222222222",
      Assigned_Expert: "Dr. Maya",
      Assigned_Expert_WhatsApp: "919876543210",
      Status: "Farmer Follow-up"
    }
  ]);

  const result = await processExpertReply({
    caseId: "BM-EXP-SECOND",
    advice: "Use the second-case recommendation.",
    expertWhatsApp: "919876543210",
    readSheetRows: harness.readSheetRows,
    updateCase: harness.updateCase,
    sendFarmerMessage: harness.sendFarmerMessage
  });

  assert.equal(result.success, true);
  assert.equal(harness.state.farmerSends[0].to, "919222222222");
  assert.equal(harness.state.updates[0].rowNumber, 3);
});

test("expert reply routing survives restart and unrelated farmer traffic because it reloads the Sheet", async function () {
  const harness = makePilotWorkflowHarness([
    {
      Case_ID: "BM-EXP-PERSISTED",
      WhatsApp: "919333333333",
      Assigned_Expert: "Dr. Robert",
      Assigned_Expert_WhatsApp: "919999999999",
      Status: "Assigned"
    }
  ]);
  const unrelatedMessages = [
    { from: "919111111111", text: "weather" },
    { from: "919222222222", text: "market price" }
  ];

  assert.equal(unrelatedMessages.length, 2);
  assert.equal(
    findFarmerCases(
      harness.state.rows,
      unrelatedMessages[0].from,
      true
    ).length,
    0
  );

  const result = await processExpertReply({
    caseId: "BM-EXP-PERSISTED",
    advice: "This reply uses only persisted case routing.",
    expertWhatsApp: "919999999999",
    readSheetRows: harness.readSheetRows,
    updateCase: harness.updateCase,
    sendFarmerMessage: harness.sendFarmerMessage
  });

  assert.equal(result.success, true);
  assert.equal(harness.state.farmerSends[0].to, "919333333333");
});

test("invalid closed and wrong-expert replies fail without farmer delivery", async function () {
  const harness = makePilotWorkflowHarness([
    {
      Case_ID: "BM-EXP-CLOSED",
      WhatsApp: "919111111111",
      Assigned_Expert: "Dr. Maya",
      Assigned_Expert_WhatsApp: "919876543210",
      Status: "Closed"
    },
    {
      Case_ID: "BM-EXP-OWNED",
      WhatsApp: "919222222222",
      Assigned_Expert: "Dr. Robert",
      Assigned_Expert_WhatsApp: "919999999999",
      Status: "Assigned"
    }
  ]);
  const common = {
    advice: "Recommendation",
    expertWhatsApp: "919876543210",
    readSheetRows: harness.readSheetRows,
    updateCase: harness.updateCase,
    sendFarmerMessage: harness.sendFarmerMessage
  };

  const invalid = await processExpertReply(
    Object.assign({}, common, { caseId: "BM-EXP-MISSING" })
  );
  const closed = await processExpertReply(
    Object.assign({}, common, { caseId: "BM-EXP-CLOSED" })
  );
  const wrongExpert = await processExpertReply(
    Object.assign({}, common, { caseId: "BM-EXP-OWNED" })
  );

  assert.equal(invalid.code, "INVALID_CASE");
  assert.equal(closed.code, "CLOSED_CASE");
  assert.equal(wrongExpert.code, "WRONG_EXPERT");
  assert.equal(harness.state.farmerSends.length, 0);
  assert.equal(harness.state.updates.length, 0);
});

test("farmer follow-up uses the selected persisted case and reaches its assigned expert", async function () {
  const harness = makePilotWorkflowHarness([
    {
      Case_ID: "BM-EXP-FOLLOW-UP",
      WhatsApp: "919111111111",
      Problem: "My pepper vines are wilting.",
      Assigned_Expert: "Dr. Maya",
      Assigned_Expert_WhatsApp: "919876543210",
      Status: "Expert Replied",
      Source_Message_ID: "wamid.follow-up"
    }
  ]);

  const result = await processFarmerFollowUp({
    caseId: "BM-EXP-FOLLOW-UP",
    farmerWhatsApp: "9111111111",
    followUp: "The wilting continued after watering.",
    timestamp: "2026-10-17T11:00:00.000Z",
    readSheetRows: harness.readSheetRows,
    updateCase: harness.updateCase,
    sendExpertMessage: harness.sendExpertMessage
  });

  assert.equal(result.success, true);
  assert.equal(harness.state.expertSends.length, 1);
  assert.equal(harness.state.expertSends[0].to, "919876543210");
  assert.match(harness.state.expertSends[0].message, /BM-EXP-FOLLOW-UP/);
  assert.match(harness.state.expertSends[0].message, /wilting continued/);
  assert.equal(
    harness.state.updates[0].valuesByHeader.Status,
    PILOT_CASE_STATUSES.FARMER_FOLLOW_UP
  );
  assert.match(
    harness.state.updates[0].valuesByHeader.Farmer_Feedback,
    /wilting continued/
  );
});

test("farmer with multiple open cases receives unambiguous clickable case selections", function () {
  const rows = makePilotCaseRows([
    {
      Case_ID: "BM-EXP-OPEN-A",
      WhatsApp: "919111111111",
      Problem: "Mycorrhiza application question",
      Assigned_Expert: "Dr. Robert",
      Status: "Assigned"
    },
    {
      Case_ID: "BM-EXP-OPEN-B",
      WhatsApp: "919111111111",
      Problem: "Rambutan fruit drop",
      Assigned_Expert: "Dr. Rincy",
      Status: "Expert Replied"
    },
    {
      Case_ID: "BM-EXP-CLOSED-C",
      WhatsApp: "919111111111",
      Problem: "Closed question",
      Assigned_Expert: "Dr. Maya",
      Status: "Closed"
    },
    {
      Case_ID: "BM-EXP-OTHER-FARMER",
      WhatsApp: "919222222222",
      Problem: "Other farmer question",
      Assigned_Expert: "Dr. Maya",
      Status: "Assigned"
    }
  ]);
  const openCases = findFarmerCases(rows, "9111111111", true);
  const selectionRows = buildExpertCaseSelectionRows(
    openCases,
    "FOLLOW_UP"
  );

  assert.equal(openCases.length, 2);
  assert.equal(selectionRows.length, 2);
  assert.deepEqual(
    selectionRows.map(function (row) {
      return parseExpertCaseAction(row.id).caseId;
    }).sort(),
    ["BM-EXP-OPEN-A", "BM-EXP-OPEN-B"]
  );
});

test("English and Malayalam multiple-case choices are sent as clickable lists", async function () {
  const english = makeUiHarness();
  const malayalam = makeUiHarness();
  const rows = [
    {
      id: "EXPERT_FOLLOWUP_CASE:BM-EXP-OPEN-A",
      title: "Mycorrhiza",
      description: "EQ-OPENA • Dr. Robert • Assigned"
    },
    {
      id: "EXPERT_FOLLOWUP_CASE:BM-EXP-OPEN-B",
      title: "Rambutan",
      description: "EQ-OPENB • Dr. Rincy • Expert Replied"
    }
  ];

  await english.ui.sendExpertCaseList(
    "919111111111",
    "English",
    "FOLLOW_UP",
    rows
  );
  await malayalam.ui.sendExpertCaseList(
    "919111111111",
    "Malayalam",
    "FOLLOW_UP",
    rows
  );

  assert.equal(english.calls[0].body.interactive.type, "list");
  assert.equal(
    english.calls[0].body.interactive.action.sections[0].rows.length,
    2
  );
  assert.match(
    malayalam.calls[0].body.interactive.body.text,
    /തുടർ ചോദ്യം/
  );
});

test("farmer follow-up requires no typed Case ID in English or Malayalam", function () {
  const english = buildFarmerFollowUpPrompt("English");
  const malayalam = buildFarmerFollowUpPrompt("Malayalam");

  assert.match(english, /do not need to type/i);
  assert.match(malayalam, /ടൈപ്പ് ചെയ്യേണ്ടതില്ല/);
  assert.doesNotMatch(english, /BM-EXP-/);
  assert.doesNotMatch(malayalam, /BM-EXP-/);
});

test("farmer View Case contains only pilot-safe fields and latest expert reply", function () {
  const view = buildFarmerCaseView({
    caseId: "BM-EXP-1234567890ABCDEF",
    originalQuestion: "Can I apply Mycorrhiza now?",
    category: "General Agriculture",
    crop: "",
    expertName: "Dr. Robert",
    status: "Expert Replied",
    expertRemark:
      "[2026-10-17T09:00:00.000Z] Expert reply\nFirst reply" +
      "\n\n---\n\n" +
      "[2026-10-17T10:00:00.000Z] Expert reply\nLatest reply"
  }, "English");

  assert.match(view, /Expert Qn ID:/);
  assert.match(view, /Topic: Mycorrhiza/);
  assert.match(view, /Expert: Dr\. Robert/);
  assert.match(view, /Status: Expert Replied/);
  assert.match(view, /Original question: Can I apply Mycorrhiza now/);
  assert.match(view, /Latest expert reply: Latest reply/);
  assert.doesNotMatch(view, /BM-EXP-/);
  assert.doesNotMatch(view, /Source_Message_ID|Assigned_Expert_WhatsApp/);
  assert.doesNotMatch(view, /First reply/);
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

[
  ["Mycorrhiza", "Mycorrhiza improves nutrient uptake in crop roots."],
  ["Mycorrhizae", "Can Mycorrhizae improve root growth and nutrient uptake?"],
  ["Mycorrhizal", "Is a Mycorrhizal treatment suitable for these plants?"],
  ["AMF", "Should I apply AMF as a microbial root inoculant?"]
].forEach(function (scenario) {
  test(scenario[0] + " routes to the live Mycorrhiza specialist", function () {
    const problem = scenario[1];
    const match = chooseBestExpert(
      [makeRincyExpertRow(), makeRobertExpertRow()],
      {
        crop: "",
        problem: problem,
        problemCategory: "General Agriculture",
        district: "Pathanamthitta"
      }
    );

    assert.ok(match);
    assert.equal(match.expert.expertName, "Dr C P Robert");
    assert.ok(match.semanticScore >= 60);
  });
});

test("Mycorrhiza subject outranks stale Rambutan crop context", function () {
  const match = chooseBestExpert(
    [makeRincyExpertRow(), makeRobertExpertRow()],
    {
      crop: "Rambutan",
      problem:
        "I need advice about Mycorrhiza and soil microbiology.",
      problemCategory: "General Agriculture",
      district: "Pathanamthitta"
    }
  );

  assert.ok(match);
  assert.equal(match.expert.expertName, "Dr C P Robert");
});

test("genuine Rambutan horticulture problem routes to Dr Rincy", function () {
  const match = chooseBestExpert(
    [makeRobertExpertRow(), makeRincyExpertRow()],
    {
      crop: "Rambutan",
      problem:
        "My Rambutan tree has poor flowering and heavy fruit drop.",
      problemCategory: "General Agriculture",
      district: "Pathanamthitta"
    }
  );

  assert.ok(match);
  assert.equal(match.expert.expertName, "Dr Rincy K Abraham");
});

test("multiple specific food-processing matches outrank a single generic overlap", function () {
  const match = chooseBestExpert(
    [makeRobertExpertRow(), makeShanaExpertRow()],
    {
      crop: "Jackfruit",
      problem:
        "I need food processing and value addition guidance for jackfruit.",
      problemCategory: "General Agriculture",
      district: "Pathanamthitta"
    }
  );

  assert.ok(match);
  assert.equal(match.expert.expertName, "Dr Shana Harshan");
});

test("subject token match always beats multiple exact crop matches", function () {
  const subjectExpert = makeExpertRow({
    expertId: "EXP-SUBJECT-TOKEN",
    name: "Subject Token Expert",
    group: "Unrelated domain",
    specialization: "Plant Microbiology"
  });
  const cropExpert = makeExpertRow({
    expertId: "EXP-CROP-MULTIPLE",
    name: "Multiple Crop Expert",
    group: "Unrelated domain",
    specialization: "Rambutan, Mangosteen, Banana"
  });
  const caseData = {
    crop: "Rambutan Mangosteen Banana",
    problem: "Microbiology testing is needed for this sample.",
    district: "Kottayam"
  };
  const subjectOnly = chooseBestExpert(
    [subjectExpert],
    caseData
  );
  const cropOnly = chooseBestExpert(
    [cropExpert],
    caseData
  );
  const match = chooseBestExpert(
    [cropExpert, subjectExpert],
    caseData
  );

  assert.equal(subjectOnly.semanticScore, 75);
  assert.equal(cropOnly.semanticScore, 80);
  assert.equal(match.expert.expertName, "Subject Token Expert");
});

test("exact subject specialization always beats multiple Expert_Group matches", function () {
  const subjectExpert = makeExpertRow({
    expertId: "EXP-SUBJECT-EXACT",
    name: "Exact Subject Expert",
    group: "Unrelated domain",
    specialization: "Microbial Inoculants"
  });
  const domainExpert = makeExpertRow({
    expertId: "EXP-DOMAIN-MULTIPLE",
    name: "Multiple Domain Expert",
    group: "Root Biology, Soil Ecology, Microbial Ecology",
    specialization: "Unrelated specialty"
  });
  const caseData = {
    crop: "",
    problem:
      "Microbial inoculants need evaluation for root biology, soil ecology, and microbial ecology.",
    district: "Kottayam"
  };
  const subjectOnly = chooseBestExpert(
    [subjectExpert],
    caseData
  );
  const domainOnly = chooseBestExpert(
    [domainExpert],
    caseData
  );
  const match = chooseBestExpert(
    [domainExpert, subjectExpert],
    caseData
  );

  assert.equal(subjectOnly.semanticScore, 100);
  assert.equal(domainOnly.semanticScore, 105);
  assert.equal(match.expert.expertName, "Exact Subject Expert");
});

test("domain match always beats multiple exact crop matches", function () {
  const domainExpert = makeExpertRow({
    expertId: "EXP-DOMAIN",
    name: "Domain Expert",
    group: "Soil Biology",
    specialization: "Unrelated specialty"
  });
  const cropExpert = makeExpertRow({
    expertId: "EXP-CROP",
    name: "Crop Expert",
    group: "Unrelated domain",
    specialization: "Rambutan, Mangosteen, Banana"
  });
  const caseData = {
    crop: "Rambutan Mangosteen Banana",
    problem: "Soil biology guidance is required.",
    district: "Kottayam"
  };
  const domainOnly = chooseBestExpert(
    [domainExpert],
    caseData
  );
  const cropOnly = chooseBestExpert(
    [cropExpert],
    caseData
  );
  const match = chooseBestExpert(
    [cropExpert, domainExpert],
    caseData
  );

  assert.equal(domainOnly.semanticScore, 85);
  assert.equal(cropOnly.semanticScore, 80);
  assert.equal(match.expert.expertName, "Domain Expert");
});

test("district rating and workload cannot overturn semantic tier", function () {
  const subjectExpert = makeExpertRow({
    expertId: "EXP-SUBJECT-POOR-OPS",
    name: "Subject Expert With Poor Operations",
    district: "Idukki",
    group: "Unrelated domain",
    specialization: "Microbial Inoculants",
    rating: 0,
    currentConsultationCount: 100
  });
  const domainExpert = makeExpertRow({
    expertId: "EXP-DOMAIN-BEST-OPS",
    name: "Domain Expert With Best Operations",
    district: "Kottayam",
    group: "Root Biology",
    specialization: "Unrelated specialty",
    rating: 5,
    currentConsultationCount: 0
  });
  const caseData = {
    crop: "",
    problem:
      "Microbial inoculants and root biology need field evaluation.",
    district: "Kottayam"
  };
  const subjectOnly = chooseBestExpert(
    [subjectExpert],
    caseData
  );
  const domainOnly = chooseBestExpert(
    [domainExpert],
    caseData
  );
  const match = chooseBestExpert(
    [domainExpert, subjectExpert],
    caseData
  );

  assert.ok(
    domainOnly.operationalScore > subjectOnly.operationalScore
  );
  assert.equal(
    match.expert.expertName,
    "Subject Expert With Poor Operations"
  );
});

test("multiple lower-tier phrases cannot accumulate across the tier boundary", function () {
  const subjectExpert = makeExpertRow({
    expertId: "EXP-HIGHER-TIER",
    name: "Higher Tier Token Expert",
    group: "Unrelated domain",
    specialization: "Plant Microbiology"
  });
  const domainExpert = makeExpertRow({
    expertId: "EXP-LOWER-TIER",
    name: "Lower Tier Phrase Expert",
    group: "Root Biology, Soil Ecology, Microbial Ecology",
    specialization: "Unrelated specialty"
  });
  const caseData = {
    crop: "",
    problem:
      "Microbiology support is needed for root biology, soil ecology, and microbial ecology.",
    district: "Kottayam"
  };
  const subjectOnly = chooseBestExpert(
    [subjectExpert],
    caseData
  );
  const domainOnly = chooseBestExpert(
    [domainExpert],
    caseData
  );
  const match = chooseBestExpert(
    [domainExpert, subjectExpert],
    caseData
  );

  assert.equal(subjectOnly.semanticScore, 75);
  assert.equal(domainOnly.semanticScore, 105);
  assert.equal(match.expert.expertName, "Higher Tier Token Expert");
});

[
  "Talk to expert\u201d",
  "Want to talk to expert",
  "I need to talk to an expert",
  "Get me expert",
  "Get me an expert",
  "Give me expert",
  "Give me an expert",
  "Find expert",
  "Find me an expert",
  "Connect expert",
  "Connect me to expert",
  "Connect me with an expert",
  "Need expert",
  "Need an expert",
  "I need expert",
  "I want expert",
  "I want an expert",
  "Talk expert",
  "Talk to expert",
  "Speak to expert",
  "Speak with an expert",
  "Expert please",
  "Expert help",
  "GET ME AN EXPERT!!!",
  "FiNd Me An ExPeRt?!",
  "SPEAK TO EXPERT..."
].forEach(function (command) {
  test(command + " recovers the previous detailed problem", function () {
    const priorProblem =
      "Mycorrhiza may help root growth, and I need application guidance.";
    const context = resolveExpertProblemContext({
      currentText: command,
      activeCase: null,
      recentProblem: priorProblem
    });

    assert.equal(isEscalationOnlyMessage(command), true);
    assert.equal(context.problem, priorProblem);
    assert.equal(context.problemSource, "RECENT");
  });
});

[
  "I need expert advice about Mycorrhiza root inoculation.",
  "Please provide an expert recommendation for this Rambutan fruit-drop problem.",
  "I need expert advice on fertilizer application",
  "What is the expert recommendation for Mycorrhiza?",
  "An expert told me to apply this"
].forEach(function (question) {
  test(question + " is not a pure escalation command", function () {
    assert.equal(isEscalationOnlyMessage(question), false);
  });
});

[
  "വിദഗ്ധ സഹായം വേണം!!!",
  "എനിക്ക് ഒരു വിദഗ്ധനെ വേണം???",
  "വിദഗ്ധനോട് സംസാരിക്കണം…",
  "വിദഗ്ധനെ വേണം!",
  "വിദഗ്ധ സഹായം ആവശ്യമാണ്.",
  "എനിക്ക് വിദഗ്ധനുമായി സംസാരിക്കണം???",
  "ഫീൽഡ് വിസിറ്റ് വേണം!"
].forEach(function (command) {
  test(command + " is recognized as a Malayalam escalation command", function () {
    assert.equal(isEscalationOnlyMessage(command), true);
  });
});

test("pure escalation without prior context stays pending instead of selecting by stale crop", async function () {
  const context = resolveExpertProblemContext({
    currentText: "Want to talk to expert",
    activeCase: null,
    recentProblem: ""
  });
  const harness = makeHarness({
    expertRows: [
      makeRincyExpertRow(),
      makeRobertExpertRow()
    ],
    caseData: {
      district: "Pathanamthitta",
      crop: "Rambutan",
      problem: context.problem,
      problemCategory: "General Agriculture"
    }
  });
  const result = await assignExpertCase(
    harness.dependencies
  );
  const headerMap = makeHeaderMap(
    EXPERT_CASE_HEADERS
  );
  const savedRow =
    harness.state.appendedRows[0].row;

  assert.equal(result.success, false);
  assert.equal(harness.state.sends.length, 0);
  assert.equal(
    getHeaderValue(
      savedRow,
      headerMap,
      "Assigned_Expert"
    ),
    ""
  );
  assert.equal(
    getHeaderValue(
      savedRow,
      headerMap,
      "Expert_Notification_Status"
    ),
    "Pending - No Eligible Expert"
  );
  assert.doesNotMatch(
    result.farmerMessage,
    /has been assigned/i
  );
});

test("operational factors alone cannot meet the semantic threshold", function () {
  const match = chooseBestExpert(
    [makeRincyExpertRow({
      district: "Pathanamthitta",
      rating: 5,
      currentConsultationCount: 0
    })],
    {
      crop: "",
      problem:
        "Please provide assistance with this unrelated issue.",
      problemCategory: "General Agriculture",
      district: "Pathanamthitta"
    }
  );

  assert.equal(match, null);
});

test("repeated generic specialization terms do not inflate semantic score", function () {
  const genericExpert = makeExpertRow({
    specialization:
      "Agriculture, Agriculture, Farming, Farming, Crop, Crop, Plant, Plant Management",
    group:
      "General Agriculture, Crop Production, Farm Management",
    district: "Pathanamthitta",
    rating: 5
  });
  const match = chooseBestExpert(
    [genericExpert],
    {
      crop: "",
      problem:
        "I need general agriculture farming crop plant management advice.",
      problemCategory: "General Agriculture",
      district: "Pathanamthitta"
    }
  );

  assert.equal(match, null);
});

test("inactive and non-routable directory states are respected", function () {
  [
    { status: "Inactive" },
    { availability: "Unavailable" },
    { autoRoute: "No" },
    { activeStatus: "Inactive" },
    { verificationStatus: "Unverified" }
  ].forEach(function (override) {
    const match = chooseBestExpert(
      [makeRobertExpertRow(override)],
      {
        problem: "I need advice about Mycorrhiza.",
        district: "Pathanamthitta"
      }
    );

    assert.equal(match, null, JSON.stringify(override));
  });
});

test("Current_Consultation_Count breaks ties while Farmers_Assigned is ignored", function () {
  const lowerCurrentLoad = makeRobertExpertRow({
    expertId: "EXP100",
    name: "Lower Current Load",
    farmersAssigned: 100,
    currentConsultationCount: 1
  });
  const higherCurrentLoad = makeRobertExpertRow({
    expertId: "EXP099",
    name: "Higher Current Load",
    farmersAssigned: 0,
    currentConsultationCount: 5
  });
  const match = chooseBestExpert(
    [higherCurrentLoad, lowerCurrentLoad],
    {
      problem: "I need advice about Mycorrhiza.",
      district: "Pathanamthitta"
    }
  );

  assert.ok(match);
  assert.equal(
    match.expert.expertName,
    "Lower Current Load"
  );
});

test("blank Current_Consultation_Count is unknown rather than zero workload", function () {
  const unknownLoad = makeRobertExpertRow({
    expertId: "EXP001",
    name: "Unknown Current Load",
    currentConsultationCount: ""
  });
  const knownLoad = makeRobertExpertRow({
    expertId: "EXP999",
    name: "Known Current Load",
    currentConsultationCount: 1
  });
  const match = chooseBestExpert(
    [unknownLoad, knownLoad],
    {
      problem: "I need advice about Mycorrhiza.",
      district: "Pathanamthitta"
    }
  );

  assert.ok(match);
  assert.equal(match.expert.expertName, "Known Current Load");
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
