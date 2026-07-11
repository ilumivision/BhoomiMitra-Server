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
  config: config,

  saveExpertCase:
    saveExpertCase,

  assignCaseToExpert:
    assignCaseToExpert,

  registerAndAssignCase:
    function (
      input,
      assignFunction
    ) {
      return registerAndAssignCase(
        input,
        assignFunction,
        saveExpertCase
      );
    },

  recordExpertReply:
    recordExpertReply,

  notifyFarmerRecommendation:
    notifyFarmerRecommendation,

  resolveExpertCase:
    resolveExpertCase,

  recordFarmerFeedback:
    recordFarmerFeedback,

  closeExpertCase:
    closeExpertCase,

  requestFarmerFeedback:
    requestFarmerFeedback,

  calculateResolutionHours:
    calculateResolutionHours,

  calculateExpertStatistics:
    calculateExpertStatistics,

  groupCasesByCrop:
    groupCasesByCrop,

  groupCasesByDistrict:
    groupCasesByDistrict,

  groupCasesByExpert:
    groupCasesByExpert
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

  return {
    success: true,
    case: saveResult.case,
    assignment: null,
    waitingForExpert: true,
    message:
      "Expert case created successfully. Waiting for expert assignment."
  };

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
/*
 * -------------------------------------------------------
 * PART 6
 * Case Closure & Farmer Feedback
 * -------------------------------------------------------
 */

async function closeExpertCase(
  expertCase,
  farmerFeedback,
  updateFunction
) {

  if (!expertCase) {
    return {
      success: false,
      error: "Expert case not found."
    };
  }

  const closedDate =
    new Date().toISOString();

  expertCase.status = "Closed";

  expertCase.closedDate = closedDate;

  expertCase.farmerFeedback =
    cleanText(farmerFeedback);

  const created =
    new Date(
      expertCase.createdAt ||
      expertCase.dateTime
    );

  const closed =
    new Date(closedDate);

  const resolutionHours =
    (
      closed.getTime() -
      created.getTime()
    ) /
    (1000 * 60 * 60);

  expertCase.resolutionHours =
    Number(
      resolutionHours.toFixed(2)
    );

  if (
    typeof updateFunction ===
    "function"
  ) {

    await updateFunction(
      expertCase.caseId,
      {
        Status: "Closed",
        Closed_Date:
          closedDate,
        Farmer_Feedback:
          expertCase.farmerFeedback,
        Resolution_Time_Hours:
          expertCase.resolutionHours
      }
    );

  }

  return {
    success: true,
    case: expertCase
  };
}

/*
 * Ask farmer for feedback
 */

async function requestFarmerFeedback(
  expertCase,
  sendFunction
) {

  if (
    typeof sendFunction !==
    "function"
  ) {

    return {
      success: false,
      error:
        "WhatsApp sender not connected."
    };

  }

  const message = [
    "🙏 BhoomiMitra",
    "",
    "Your expert consultation has been completed.",
    "",
    "Please rate our service:",
    "",
    "1 ⭐ Poor",
    "2 ⭐⭐ Fair",
    "3 ⭐⭐⭐ Good",
    "4 ⭐⭐⭐⭐ Very Good",
    "5 ⭐⭐⭐⭐⭐ Excellent",
    "",
    "Reply with only the number."
  ].join("\n");

  await sendFunction(
    expertCase.whatsapp,
    message
  );

  return {
    success: true
  };
}
/*
 * -------------------------------------------------------
 * PART 7
 * Expert Dashboard & Analytics
 * -------------------------------------------------------
 */

function calculateExpertStatistics(cases) {

  const rows = Array.isArray(cases)
    ? cases
    : [];

  const stats = {
    totalCases: rows.length,
    openCases: 0,
    assignedCases: 0,
    resolvedCases: 0,
    closedCases: 0,
    emergencyCases: 0,
    highPriorityCases: 0,
    averageResolutionHours: 0
  };

  let totalHours = 0;
  let completedCount = 0;

  rows.forEach(function (item) {

    const status =
      String(item.status || "").toLowerCase();

    if (
      status === "new" ||
      status === "assigned" ||
      status === "under review"
    ) {
      stats.openCases++;
    }

    if (status === "assigned") {
      stats.assignedCases++;
    }

    if (status === "resolved") {
      stats.resolvedCases++;
    }

    if (status === "closed") {
      stats.closedCases++;
    }

    if (
      String(item.priority || "")
        .toLowerCase() === "emergency"
    ) {
      stats.emergencyCases++;
    }

    if (
      String(item.priority || "")
        .toLowerCase() === "high"
    ) {
      stats.highPriorityCases++;
    }

    const hours =
      Number(item.resolutionHours || 0);

    if (hours > 0) {
      totalHours += hours;
      completedCount++;
    }

  });

  if (completedCount > 0) {
    stats.averageResolutionHours =
      Number(
        (totalHours / completedCount)
          .toFixed(2)
      );
  }

  return stats;
}

function groupCasesByCrop(cases) {

  const result = {};

  (cases || []).forEach(function (item) {

    const crop =
      item.crop || "Unknown";

    result[crop] =
      (result[crop] || 0) + 1;

  });

  return result;
}

function groupCasesByDistrict(cases) {

  const result = {};

  (cases || []).forEach(function (item) {

    const district =
      item.district || "Unknown";

    result[district] =
      (result[district] || 0) + 1;

  });

  return result;
}
module.exports = {
  createExpertCaseManager,

  DEFAULT_SETTINGS,

  cleanText,
  normalisePhone,
  normaliseConfidence,

  createExpertCaseId,
  detectPriority,
  shouldEscalateToExpert,

  buildExpertCase,
  expertCaseToSheetRow,
  validateExpertCase,

  assignCaseToExpert,
  registerAndAssignCase,

  recordExpertReply,
  notifyFarmerRecommendation,

  calculateResolutionHours,
  resolveExpertCase,
  recordFarmerFeedback,
  closeExpertCase,
  requestFarmerFeedback,

  calculateExpertStatistics,
  groupCasesByCrop,
  groupCasesByDistrict,
  groupCasesByExpert
};
 
