"use strict";

const EXPERT_ADVICE_ACTION_IDS = Object.freeze({
  START: "SERVICE_6",
  AI_FIRST: "EXPERT_AI_FIRST",
  DIRECT: "EXPERT_DIRECT",
  CONFIRM_YES: "EXPERT_CONFIRM_YES",
  CONFIRM_NO: "EXPERT_CONFIRM_NO",
  ASK_ANOTHER: "EXPERT_ASK_ANOTHER",
  FOLLOW_UP: "EXPERT_FOLLOW_UP",
  VIEW_CASE: "EXPERT_VIEW_CASE",
  MAIN_MENU: "EXPERT_MAIN_MENU"
});

const EXPERT_CASE_ACTION_PREFIXES = Object.freeze({
  FOLLOW_UP: "EXPERT_FOLLOWUP_CASE:",
  VIEW_CASE: "EXPERT_VIEW_CASE:"
});

const PILOT_CASE_STATUSES = Object.freeze({
  PENDING: "Pending Expert Notification",
  ASSIGNED: "Assigned",
  EXPERT_REPLIED: "Expert Replied",
  FARMER_FOLLOW_UP: "Farmer Follow-up",
  CLOSED: "Closed"
});

function clean(value) {
  return value == null ? "" : String(value).trim();
}

function phoneKey(value) {
  return clean(value).replace(/\D/g, "").slice(-10);
}

function normalizeHeader(value) {
  return clean(value).toLowerCase();
}

function makeHeaderMap(headers) {
  const map = Object.create(null);

  (headers || []).forEach(function (header, index) {
    const key = normalizeHeader(header);

    if (key && map[key] === undefined) {
      map[key] = index;
    }
  });

  return map;
}

function getHeaderValue(row, headerMap, header) {
  const index = headerMap[normalizeHeader(header)];

  if (index === undefined) {
    return "";
  }

  return row && row[index] != null ? row[index] : "";
}

function normalizeActionText(value) {
  return clean(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.!?,;:…()[\]{}<>/\\|_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getExpertAdviceAction(selectionId, text) {
  const id = clean(selectionId).toUpperCase();
  const actionById = {};

  actionById[EXPERT_ADVICE_ACTION_IDS.START] = "START";
  actionById[EXPERT_ADVICE_ACTION_IDS.AI_FIRST] = "AI_FIRST";
  actionById[EXPERT_ADVICE_ACTION_IDS.DIRECT] = "DIRECT";
  actionById[EXPERT_ADVICE_ACTION_IDS.CONFIRM_YES] = "CONFIRM_YES";
  actionById[EXPERT_ADVICE_ACTION_IDS.CONFIRM_NO] = "CONFIRM_NO";
  actionById[EXPERT_ADVICE_ACTION_IDS.ASK_ANOTHER] = "ASK_ANOTHER";
  actionById[EXPERT_ADVICE_ACTION_IDS.FOLLOW_UP] = "FOLLOW_UP";
  actionById[EXPERT_ADVICE_ACTION_IDS.VIEW_CASE] = "VIEW_CASE";
  actionById[EXPERT_ADVICE_ACTION_IDS.MAIN_MENU] = "MAIN_MENU";

  if (actionById[id]) {
    return actionById[id];
  }

  const normalized = normalizeActionText(text);

  if (/^(?:yes|yes ask expert|ask expert|send to expert|send it to expert)$/.test(normalized) ||
      /^(?:അതെ|വിദഗ്ധനോട് ചോദിക്കൂ|വിദഗ്ധന് അയയ്ക്കുക)$/.test(normalized)) {
    return "CONFIRM_YES";
  }

  if (/^(?:no|no ai answer is enough|ai answer is enough|do not send)$/.test(normalized) ||
      /^(?:വേണ്ട|ഇല്ല|ai മറുപടി മതി)$/.test(normalized)) {
    return "CONFIRM_NO";
  }

  if (/^(?:ai answer first|answer first)$/.test(normalized) ||
      /^(?:ആദ്യം ai മറുപടി|ai മറുപടി ആദ്യം)$/.test(normalized)) {
    return "AI_FIRST";
  }

  if (/^(?:send directly to expert|direct to expert)$/.test(normalized) ||
      /^നേരിട്ട് വിദഗ്ധന് അയയ്ക്കുക$/.test(normalized)) {
    return "DIRECT";
  }

  if (/^(?:send follow up|follow up)$/.test(normalized) ||
      /^തുടർ ചോദ്യം$/.test(normalized)) {
    return "FOLLOW_UP";
  }

  if (/^(?:view case|show case)$/.test(normalized) ||
      /^കേസ് കാണുക$/.test(normalized)) {
    return "VIEW_CASE";
  }

  if (/^(?:main menu|menu|home)$/.test(normalized) ||
      /^(?:പ്രധാന മെനു|മെനു)$/.test(normalized)) {
    return "MAIN_MENU";
  }

  return "";
}

function createExpertQuestionId(caseId) {
  const normalized = clean(caseId)
    .toUpperCase()
    .replace(/^BM-EXP-/, "")
    .replace(/[^A-Z0-9]/g, "");

  if (!normalized) {
    return "";
  }

  return "EQ-" + normalized.slice(-8);
}

function parseExpertCaseAction(selectionId) {
  const id = clean(selectionId);
  const prefixes = [
    [EXPERT_CASE_ACTION_PREFIXES.FOLLOW_UP, "FOLLOW_UP_CASE"],
    [EXPERT_CASE_ACTION_PREFIXES.VIEW_CASE, "VIEW_CASE"]
  ];

  for (const entry of prefixes) {
    if (id.startsWith(entry[0])) {
      const caseId = clean(id.slice(entry[0].length));

      return caseId
        ? { action: entry[1], caseId: caseId }
        : null;
    }
  }

  return null;
}

function shouldCreateExpertCase(action, session) {
  const current = session || {};

  return (
    action === "CONFIRM_YES" &&
    current.step === "awaiting_confirmation" &&
    Boolean(clean(current.problem))
  );
}

function deriveExpertTopic(problem, category, crop) {
  const text = [problem, category, crop]
    .map(clean)
    .join(" ")
    .toLowerCase();
  const topicPatterns = [
    [/\b(?:mycorrhiza|mycorrhizae|mycorrhizal|amf)\b/i, "Mycorrhiza"],
    [/\b(?:biofertilizer|biofertiliser|microbial inoculant)\b/i, "Biofertilizer"],
    [/\bsoil microbiolog(?:y|ical)\b/i, "Soil Microbiology"],
    [/\bfruit drop\b/i, "Fruit Drop"],
    [/\brambutan\b/i, "Rambutan"],
    [/\b(?:pest|insect|borer|mite)\b/i, "Pest Management"],
    [/\b(?:disease|spot|rot|wilt|fungal|fungus)\b/i, "Crop Disease"],
    [/\b(?:fertilizer|fertiliser|nutrient|deficiency)\b/i, "Nutrient Management"],
    [/\b(?:soil|ph|drainage)\b/i, "Soil Health"]
  ];

  for (const topicPattern of topicPatterns) {
    if (topicPattern[0].test(text)) {
      return topicPattern[1];
    }
  }

  const safeCategory = clean(category);
  if (safeCategory && !/^general agriculture$/i.test(safeCategory)) {
    return safeCategory;
  }

  return clean(crop) || "Agricultural Question";
}

function readExpertCaseRows(sheetRows) {
  const rows = Array.isArray(sheetRows) ? sheetRows : [];
  const headers = rows[0] || [];
  const headerMap = makeHeaderMap(headers);

  return rows.slice(1).map(function (row, index) {
    return {
      headers: headers,
      row: row,
      rowNumber: index + 2,
      caseId: clean(getHeaderValue(row, headerMap, "Case_ID")),
      sourceMessageId: clean(
        getHeaderValue(row, headerMap, "Source_Message_ID")
      ),
      farmerWhatsApp: clean(getHeaderValue(row, headerMap, "WhatsApp")),
      assignedExpertWhatsApp: clean(
        getHeaderValue(row, headerMap, "Assigned_Expert_WhatsApp")
      ),
      expertName: clean(getHeaderValue(row, headerMap, "Assigned_Expert")),
      status: clean(getHeaderValue(row, headerMap, "Status")),
      originalQuestion: clean(getHeaderValue(row, headerMap, "Problem")),
      expertRemark: clean(getHeaderValue(row, headerMap, "Expert_Remark")),
      farmerFeedback: clean(getHeaderValue(row, headerMap, "Farmer_Feedback")),
      category: clean(getHeaderValue(row, headerMap, "Category")),
      crop: clean(getHeaderValue(row, headerMap, "Crop")),
      dateTime: clean(getHeaderValue(row, headerMap, "Date_Time"))
    };
  }).filter(function (record) {
    return Boolean(record.caseId);
  });
}

function findExpertCaseById(sheetRows, caseId) {
  const target = clean(caseId).toUpperCase();

  return readExpertCaseRows(sheetRows).find(function (record) {
    return record.caseId.toUpperCase() === target;
  }) || null;
}

function findFarmerCases(sheetRows, farmerWhatsApp, openOnly) {
  const farmerKey = phoneKey(farmerWhatsApp);

  if (!farmerKey) {
    return [];
  }

  return readExpertCaseRows(sheetRows)
    .filter(function (record) {
      const belongsToFarmer =
        phoneKey(record.farmerWhatsApp) === farmerKey;
      const isClosed =
        record.status.toLowerCase() ===
        PILOT_CASE_STATUSES.CLOSED.toLowerCase();

      return belongsToFarmer && (!openOnly || !isClosed);
    })
    .sort(function (left, right) {
      return right.rowNumber - left.rowNumber;
    });
}

function truncate(value, maximumLength) {
  const text = clean(value);

  return text.length <= maximumLength
    ? text
    : text.slice(0, Math.max(0, maximumLength - 1)).trimEnd() + "…";
}

function buildExpertCaseSelectionRows(cases, action) {
  const prefix = action === "VIEW_CASE"
    ? EXPERT_CASE_ACTION_PREFIXES.VIEW_CASE
    : EXPERT_CASE_ACTION_PREFIXES.FOLLOW_UP;

  return (cases || []).slice(0, 10).map(function (record) {
    const topic = deriveExpertTopic(
      record.originalQuestion,
      record.category,
      record.crop
    );
    const description = [
      createExpertQuestionId(record.caseId),
      record.expertName || "Expert pending",
      record.status || PILOT_CASE_STATUSES.PENDING
    ].join(" • ");

    return {
      id: prefix + record.caseId,
      title: truncate(topic, 24) || "Expert case",
      description: truncate(description, 72)
    };
  });
}

function buildFarmerFollowUpPrompt(language) {
  return clean(language).toLowerCase() === "malayalam"
    ? "നിങ്ങളുടെ തുടർ ചോദ്യം അയയ്ക്കുക. Expert Qn ID അല്ലെങ്കിൽ Case ID ടൈപ്പ് ചെയ്യേണ്ടതില്ല."
    : "Please send your follow-up. You do not need to type the Expert Qn ID or Case ID.";
}

function appendCaseHistory(existingValue, actorLabel, message, timestamp) {
  const existing = clean(existingValue);
  const entry = [
    "[" + clean(timestamp || new Date().toISOString()) + "] " + clean(actorLabel),
    clean(message)
  ].join("\n");

  return existing
    ? existing + "\n\n---\n\n" + entry
    : entry;
}

function latestCaseHistoryMessage(value) {
  const blocks = clean(value).split(/\n\n---\n\n/);
  const latest = clean(blocks[blocks.length - 1]);
  const lines = latest.split("\n");

  if (/^\[[^\]]+\]\s+(?:Expert reply|Farmer follow-up)$/i.test(lines[0])) {
    return clean(lines.slice(1).join("\n"));
  }

  return latest;
}

function buildFarmerCaseView(record, language) {
  const input = record || {};
  const isMalayalam = clean(language).toLowerCase() === "malayalam";
  const topic = deriveExpertTopic(
    input.originalQuestion,
    input.category,
    input.crop
  );
  const originalQuestion = truncate(
    input.originalQuestion || (isMalayalam ? "ലഭ്യമല്ല" : "Not available"),
    360
  );
  const latestReply = truncate(
    latestCaseHistoryMessage(input.expertRemark),
    360
  );
  const lines = isMalayalam
    ? [
        "Expert Qn ID: " + createExpertQuestionId(input.caseId),
        "വിഷയം: " + topic,
        "വിദഗ്ധൻ: " + (input.expertName || "നിയമനം കാത്തിരിക്കുന്നു"),
        "നില: " + (input.status || PILOT_CASE_STATUSES.PENDING),
        "ആദ്യ ചോദ്യം: " + originalQuestion
      ]
    : [
        "Expert Qn ID: " + createExpertQuestionId(input.caseId),
        "Topic: " + topic,
        "Expert: " + (input.expertName || "Assignment pending"),
        "Status: " + (input.status || PILOT_CASE_STATUSES.PENDING),
        "Original question: " + originalQuestion
      ];

  if (latestReply) {
    lines.push(
      (isMalayalam ? "ഏറ്റവും പുതിയ വിദഗ്ധ മറുപടി: " : "Latest expert reply: ") +
      latestReply
    );
  }

  return lines.join("\n\n");
}

function acceptedSendResult(result) {
  return result === true ||
    Boolean(result && result.accepted === true) ||
    Boolean(
      result &&
      result.data &&
      result.data.messages &&
      result.data.messages[0] &&
      result.data.messages[0].id
    );
}

async function processExpertReply(options) {
  const input = options || {};
  const rows = await input.readSheetRows("Expert_Cases", "A:AD");
  const record = findExpertCaseById(rows, input.caseId);

  if (!record) {
    return { success: false, code: "INVALID_CASE" };
  }

  if (record.status.toLowerCase() === PILOT_CASE_STATUSES.CLOSED.toLowerCase()) {
    return { success: false, code: "CLOSED_CASE", record: record };
  }

  if (
    !phoneKey(record.assignedExpertWhatsApp) ||
    phoneKey(record.assignedExpertWhatsApp) !== phoneKey(input.expertWhatsApp)
  ) {
    return { success: false, code: "WRONG_EXPERT", record: record };
  }

  if (!phoneKey(record.farmerWhatsApp)) {
    return { success: false, code: "MISSING_FARMER", record: record };
  }

  const advice = clean(input.advice);

  if (!advice) {
    return { success: false, code: "EMPTY_REPLY", record: record };
  }

  const expertRemark = appendCaseHistory(
    record.expertRemark,
    "Expert reply",
    advice,
    input.timestamp
  );
  const updated = await input.updateCase({
    sheetName: "Expert_Cases",
    headers: record.headers,
    rowNumber: record.rowNumber,
    caseId: record.caseId,
    sourceMessageId: record.sourceMessageId,
    valuesByHeader: {
      Status: PILOT_CASE_STATUSES.EXPERT_REPLIED,
      Expert_Remark: expertRemark
    }
  });

  if (!updated) {
    return { success: false, code: "UPDATE_FAILED", record: record };
  }

  const updatedRecord = Object.assign({}, record, {
    status: PILOT_CASE_STATUSES.EXPERT_REPLIED,
    expertRemark: expertRemark
  });
  let sendResult;

  try {
    sendResult = await input.sendFarmerMessage(
      record.farmerWhatsApp,
      updatedRecord,
      advice
    );
  } catch (error) {
    return {
      success: false,
      code: "DELIVERY_FAILED",
      record: updatedRecord,
      error: error
    };
  }

  if (!acceptedSendResult(sendResult)) {
    return { success: false, code: "DELIVERY_FAILED", record: updatedRecord };
  }

  return { success: true, record: updatedRecord };
}

async function processFarmerFollowUp(options) {
  const input = options || {};
  const rows = await input.readSheetRows("Expert_Cases", "A:AD");
  const record = findExpertCaseById(rows, input.caseId);

  if (!record) {
    return { success: false, code: "INVALID_CASE" };
  }

  if (phoneKey(record.farmerWhatsApp) !== phoneKey(input.farmerWhatsApp)) {
    return { success: false, code: "WRONG_FARMER", record: record };
  }

  if (record.status.toLowerCase() === PILOT_CASE_STATUSES.CLOSED.toLowerCase()) {
    return { success: false, code: "CLOSED_CASE", record: record };
  }

  if (!phoneKey(record.assignedExpertWhatsApp)) {
    return { success: false, code: "MISSING_EXPERT", record: record };
  }

  const followUp = clean(input.followUp);

  if (!followUp) {
    return { success: false, code: "EMPTY_FOLLOW_UP", record: record };
  }

  const farmerFeedback = appendCaseHistory(
    record.farmerFeedback,
    "Farmer follow-up",
    followUp,
    input.timestamp
  );
  const updated = await input.updateCase({
    sheetName: "Expert_Cases",
    headers: record.headers,
    rowNumber: record.rowNumber,
    caseId: record.caseId,
    sourceMessageId: record.sourceMessageId,
    valuesByHeader: {
      Status: PILOT_CASE_STATUSES.FARMER_FOLLOW_UP,
      Farmer_Feedback: farmerFeedback
    }
  });

  if (!updated) {
    return { success: false, code: "UPDATE_FAILED", record: record };
  }

  const expertMessage = [
    "🌾 Farmer follow-up",
    "",
    "Case ID: " + record.caseId,
    "",
    followUp,
    "",
    "Reply using the existing case reply link or:",
    "REPLY " + record.caseId
  ].join("\n");
  let sendResult;

  try {
    sendResult = await input.sendExpertMessage(
      record.assignedExpertWhatsApp,
      expertMessage
    );
  } catch (error) {
    return {
      success: false,
      code: "DELIVERY_FAILED",
      record: record,
      error: error
    };
  }

  if (!acceptedSendResult(sendResult)) {
    return { success: false, code: "DELIVERY_FAILED", record: record };
  }

  return {
    success: true,
    record: Object.assign({}, record, {
      status: PILOT_CASE_STATUSES.FARMER_FOLLOW_UP,
      farmerFeedback: farmerFeedback
    })
  };
}

function buildFarmerAssignmentCard(assignmentResult, context) {
  const result = assignmentResult || {};
  const expert = result.expert || {};

  if (!result.success || !result.caseId || !expert.expertName) {
    return null;
  }

  const input = context || {};
  const language = clean(input.language).toLowerCase();
  const expertQuestionId = createExpertQuestionId(result.caseId);
  const topic = deriveExpertTopic(
    input.problem,
    input.category,
    input.crop
  );
  const text = language === "malayalam"
    ? [
        "👨‍🌾 വിദഗ്ധ ഉപദേശം",
        "",
        "വിദഗ്ധൻ: " + expert.expertName,
        "വിഷയം: " + topic,
        "Expert Qn ID: " + expertQuestionId,
        "നില: " + PILOT_CASE_STATUSES.ASSIGNED,
        "",
        "നിങ്ങളുടെ ചോദ്യം " + expert.expertName + "-ന് അയച്ചു."
      ].join("\n")
    : [
        "👨‍🌾 Expert Consultation",
        "",
        "Expert: " + expert.expertName,
        "Topic: " + topic,
        "Expert Qn ID: " + expertQuestionId,
        "Status: " + PILOT_CASE_STATUSES.ASSIGNED,
        "",
        "Your question has been sent to " + expert.expertName + "."
      ].join("\n");

  return {
    text: text,
    expertQuestionId: expertQuestionId,
    topic: topic
  };
}

module.exports = {
  EXPERT_ADVICE_ACTION_IDS,
  EXPERT_CASE_ACTION_PREFIXES,
  PILOT_CASE_STATUSES,
  appendCaseHistory,
  buildExpertCaseSelectionRows,
  buildFarmerCaseView,
  buildFarmerFollowUpPrompt,
  buildFarmerAssignmentCard,
  createExpertQuestionId,
  deriveExpertTopic,
  findExpertCaseById,
  findFarmerCases,
  getExpertAdviceAction,
  latestCaseHistoryMessage,
  normalizeActionText,
  parseExpertCaseAction,
  processExpertReply,
  processFarmerFollowUp,
  readExpertCaseRows,
  shouldCreateExpertCase
};
