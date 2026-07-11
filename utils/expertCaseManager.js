"use strict";

/*
 * BhoomiMitra Expert Case Manager
 *
 * Purpose:
 * - Create expert-review cases
 * - Save cases to Google Sheets
 * - Track status, priority and assignment
 * - Support later expert reply and farmer notification
 */

const DEFAULT_SETTINGS = {
  expertCaseSheet: "Expert_Cases",
  expertDirectorySheet: "Expert_Directory",
  settingsSheet: "BM_Setting",
  defaultStatus: "New",
  defaultPriority: "Medium",
  confidenceThreshold: 80
};

function cleanText(value) {
  return String(value || "").trim();
}

function normalisePhone(value) {
  return cleanText(value).replace(/[^\d]/g, "");
}

function normaliseConfidence(value) {
  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return 0;
  }

  if (numberValue < 0) {
    return 0;
  }

  if (numberValue > 100) {
    return 100;
  }

  return Math.round(numberValue);
}

function createExpertCaseId() {
  const timestamp = Date.now();
  const randomPart = Math.floor(1000 + Math.random() * 9000);

  return "BM-EX-" + timestamp + "-" + randomPart;
}

function detectPriority(input) {
  const text = cleanText(input).toLowerCase();

  const emergencyWords = [
    "emergency",
    "urgent",
    "severe",
    "rapid spread",
    "whole field",
    "entire crop",
    "വിള നശിക്കുന്നു",
    "വേഗത്തിൽ പടരുന്നു",
    "അടിയന്തിരം",
    "ഗുരുതരം"
  ];

  const highWords = [
    "spreading",
    "many plants",
    "many trees",
    "yield loss",
    "wilting",
    "rotting",
    "stem damage",
    "root damage",
    "പടരുന്നു",
    "പല ചെടികൾ",
    "വാടുന്നു",
    "ചീഞ്ഞു",
    "വിളനഷ്ടം"
  ];

  if (
    emergencyWords.some(function (word) {
      return text.includes(word);
    })
  ) {
    return "Emergency";
  }

  if (
    highWords.some(function (word) {
      return text.includes(word);
    })
  ) {
    return "High";
  }

  return "Medium";
}

function shouldEscalateToExpert(data) {
  const confidence = normaliseConfidence(
    data && data.aiConfidence
  );

  const farmerUnsatisfied =
    Boolean(data && data.farmerUnsatisfied);

  const expertRequested =
    Boolean(data && data.expertRequested);

  const threshold =
    Number(
      data &&
      data.confidenceThreshold
    ) || DEFAULT_SETTINGS.confidenceThreshold;

  if (expertRequested) {
    return true;
  }

  if (farmerUnsatisfied) {
    return true;
  }

  return confidence < threshold;
}
function buildExpertCase(data) {
  const input = data || {};

  const farmerMessage = cleanText(
    input.farmerMessage ||
    input.userText ||
    input.problem
  );

  const aiDiagnosis = cleanText(
    input.aiDiagnosis ||
    input.diagnosis ||
    input.aiReply
  );

  const aiConfidence = normaliseConfidence(
    input.aiConfidence
  );

  return {
    caseId:
      cleanText(input.caseId) ||
      createExpertCaseId(),

    createdAt:
      cleanText(input.createdAt) ||
      new Date().toISOString(),

    farmerName:
      cleanText(input.farmerName),

    whatsapp:
      normalisePhone(
        input.whatsapp ||
        input.from
      ),

    district:
      cleanText(input.district),

    panchayath:
      cleanText(input.panchayath),

    crop:
      cleanText(input.crop),

    problem:
      farmerMessage,

    aiDiagnosis:
      aiDiagnosis,

    aiConfidence:
      aiConfidence,

    priority:
      cleanText(input.priority) ||
      detectPriority(
        farmerMessage + " " + aiDiagnosis
      ),

    assignedExpert:
      cleanText(input.assignedExpert),

    status:
      cleanText(input.status) ||
      DEFAULT_SETTINGS.defaultStatus,

    expertRemark:
      cleanText(input.expertRemark),

    closedDate:
      cleanText(input.closedDate),

    photoCount:
      Number(input.photoCount) || 0,

    source:
      cleanText(input.source) ||
      "WhatsApp",

    escalationReason:
      cleanText(input.escalationReason),

    farmerUnsatisfied:
      Boolean(input.farmerUnsatisfied),

    expertRequested:
      Boolean(input.expertRequested)
  };
}

function expertCaseToSheetRow(expertCase) {
  const data = expertCase || {};

  return [
    data.caseId || "",
    data.createdAt || "",
    data.farmerName || "",
    data.whatsapp || "",
    data.district || "",
    data.panchayath || "",
    data.crop || "",
    data.problem || "",
    data.aiDiagnosis || "",
    data.aiConfidence || 0,
    data.priority || "Medium",
    data.assignedExpert || "",
    data.status || "New",
    data.expertRemark || "",
    data.closedDate || "",
    data.photoCount || 0,
    data.source || "WhatsApp",
    data.escalationReason || ""
  ];
}
function validateExpertCase(expertCase) {
  const data = expertCase || {};
  const errors = [];

  if (!cleanText(data.caseId)) {
    errors.push("Case ID is missing.");
  }

  if (!normalisePhone(data.whatsapp)) {
    errors.push("Farmer WhatsApp number is missing.");
  }

  if (!cleanText(data.problem)) {
    errors.push("Problem description is missing.");
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

function createExpertCaseManager(dependencies) {
  const deps = dependencies || {};

  const appendSafe =
    typeof deps.appendSafe === "function"
      ? deps.appendSafe
      : null;

  const config = Object.assign(
    {},
    DEFAULT_SETTINGS,
    deps.config || {}
  );

  async function saveExpertCase(input) {
    const expertCase = buildExpertCase(input);
    const validation = validateExpertCase(expertCase);

    if (!validation.valid) {
      return {
        success: false,
        case: expertCase,
        errors: validation.errors
      };
    }

    if (!appendSafe) {
      return {
        success: false,
        case: expertCase,
        errors: [
          "Google Sheets append function is not connected."
        ]
      };
    }

    await appendSafe(
      config.expertCaseSheet,
      expertCaseToSheetRow(expertCase)
    );

    return {
      success: true,
      case: expertCase,
      status: expertCase.status
    };
  }

 return {
    config,

    saveExpertCase,

    assignCaseToExpert,

    registerAndAssignCase,

    recordExpertReply,

    notifyFarmerRecommendation
};
}
async function assignCaseToExpert(expertCase, assignFunction) {

  if (typeof assignFunction !== "function") {
    return {
      success: false,
      error: "expertAssignment function not connected."
    };
  }

  const assignment = await assignFunction(expertCase);

  if (!assignment || assignment.success === false) {
    return {
      success: false,
      error: "No suitable expert found."
    };
  }

  expertCase.assignedExpert =
    assignment.expertName || "";

  expertCase.status = "Assigned";

  expertCase.assignmentId =
    assignment.assignmentId || "";

  return {
    success: true,
    case: expertCase,
    assignment: assignment
  };
}

async function registerAndAssignCase(
  input,
  assignFunction
) {

  const saveResult =
    await saveExpertCase(input);

  if (!saveResult.success) {
    return saveResult;
  }

  const assignmentResult =
    await assignCaseToExpert(
      saveResult.case,
      assignFunction
    );

  if (!assignmentResult.success) {
    return assignmentResult;
  }

  return {
    success: true,
    case: assignmentResult.case,
    assignment: assignmentResult.assignment
  };
}
/*
 * -------------------------------------------------------
 * PART 5
 * Expert Reply Handling
 * -------------------------------------------------------
 */

async function recordExpertReply(
  expertCase,
  replyText,
  updateFunction
) {

  if (!expertCase) {
    return {
      success: false,
      error: "Expert case not found."
    };
  }

  expertCase.expertRemark =
    cleanText(replyText);

  expertCase.status =
    "Recommendation Sent";

  expertCase.updatedAt =
    new Date().toISOString();

  if (typeof updateFunction === "function") {

    await updateFunction(
      expertCase.caseId,
      {
        Expert_Remark:
          expertCase.expertRemark,

        Status:
          expertCase.status
      }
    );

  }

  return {
    success: true,
    case: expertCase
  };
}

/*
 * Send expert recommendation to farmer
 */

async function notifyFarmerRecommendation(
  expertCase,
  sendFunction
) {

  if (
    typeof sendFunction !== "function"
  ) {
    return {
      success: false,
      error:
        "WhatsApp sender not connected."
    };
  }

  const message = [
    "👨‍🌾 BhoomiMitra Expert Recommendation",
    "",
    "Case ID: " + expertCase.caseId,
    "",
    "Crop: " +
      (expertCase.crop || "-"),
    "",
    "Recommendation:",
    expertCase.expertRemark || "-",
    "",
    "Thank you for using BhoomiMitra."
  ].join("\n");

  await sendFunction(
    expertCase.whatsapp,
    message
  );

  return {
    success: true
  };
}
