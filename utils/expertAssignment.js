"use strict";
/*
 * BhoomiMitra Expert Assignment Module
 *
 * Purpose:
 * - Select a suitable expert from Expert_Directory
 * - Create a case row in Expert_Cases
 * - Return farmer and expert notification messages
 *
 * This module does not directly access WhatsApp.
 * Google Sheets functions are supplied from index.js.
 */
function clean(value) {
  return String(value || "").trim();
}
function formatWhatsAppNumber(number) {
    let mobile = String(number || "").trim();

    mobile = mobile.replace(/[^\d]/g, "");

    if (mobile.length === 10) {
        mobile = "91" + mobile;
    }

    return mobile;
}
function lower(value) {
  return clean(value).toLowerCase();
}
function splitSkills(value) {
  return lower(value)
    .split(/[,;/|]+/)
    .map(function (item) {
      return item.trim();
    })
    .filter(Boolean);
}
function containsAny(text, keywords) {
  const source = lower(text);
  return keywords.some(function (keyword) {
    return source.includes(lower(keyword));
  });
}
function calculatePriority(problemText, aiConfidence) {
  const confidence = Number(aiConfidence || 0);
  const problem = lower(problemText);
  const emergencyWords = [
    "rapidly spreading",
    "entire field",
    "all plants",
    "sudden death",
    "wilting rapidly",
    "severe",
    "emergency",
    "വിള മുഴുവൻ",
    "വേഗത്തിൽ പടരുന്നു",
    "പെട്ടെന്ന് ഉണങ്ങുന്നു",
    "ഗുരുതരം"
  ];
  if (
    containsAny(problem, emergencyWords) ||
    (confidence > 0 && confidence < 50)
  ) {
    return "Emergency";
  }
  if (
    confidence < 80 ||
    problem.includes("disease") ||
    problem.includes("pest") ||
    problem.includes("രോഗ") ||
    problem.includes("കീട")
  ) {
    return "High";
  }
  return "Medium";
}
function getProblemCategory(problemText) {
  const problem = lower(problemText);
  if (
    problem.includes("disease") ||
    problem.includes("spot") ||
    problem.includes("rot") ||
    problem.includes("wilt") ||
    problem.includes("fung") ||
    problem.includes("രോഗ") ||
    problem.includes("പാട്") ||
    problem.includes("ചീയൽ")
  ) {
    return "Disease";
  }
  if (
    problem.includes("pest") ||
    problem.includes("insect") ||
    problem.includes("borer") ||
    problem.includes("mite") ||
    problem.includes("കീട")
  ) {
    return "Pest";
  }
  if (
    problem.includes("nutrient") ||
    problem.includes("deficiency") ||
    problem.includes("fertilizer") ||
    problem.includes("yellowing") ||
    problem.includes("വള") ||
    problem.includes("പോഷക")
  ) {
    return "Nutrient";
  }
  if (
    problem.includes("soil") ||
    problem.includes("ph") ||
    problem.includes("drainage") ||
    problem.includes("മണ്ണ്")
  ) {
    return "Soil";
  }
  if (
    problem.includes("irrigation") ||
    problem.includes("water") ||
    problem.includes("drought") ||
    problem.includes("വെള്ള")
  ) {
    return "Water Management";
  }
  return "General Agriculture";
}
function scoreExpert(expert, caseData) {
  let score = 0;
  const expertDistrict = lower(expert.district);
  const farmerDistrict = lower(caseData.district);
  const skills = splitSkills(
    [
      expert.specialisation,
      expert.cropExpertise,
      expert.problemExpertise,
      expert.expertise,
      expert.subject
    ].join(",")
  );
  const crop = lower(caseData.crop);
  const category = lower(caseData.problemCategory);
  if (
    expertDistrict &&
    farmerDistrict &&
    expertDistrict === farmerDistrict
  ) {
    score += 30;
  }
  if (
    crop &&
    skills.some(function (skill) {
      return skill.includes(crop) || crop.includes(skill);
    })
  ) {
    score += 40;
  }
  if (
    category &&
    skills.some(function (skill) {
      return skill.includes(category) || category.includes(skill);
    })
  ) {
    score += 25;
  }
  if (
    lower(expert.status) === "approved" ||
    lower(expert.approvalStatus) === "approved"
  ) {
    score += 20;
  }
  if (
    lower(expert.availability) === "available" ||
    lower(expert.availability) === "yes" ||
    lower(expert.availability) === "active"
  ) {
    score += 20;
  }
  const openCases = Number(expert.openCases || 0);
  if (openCases === 0) {
    score += 15;
  } else if (openCases <= 3) {
    score += 10;
  } else if (openCases <= 5) {
    score += 5;
  } else {
    score -= 10;
  }
  return score;
}
function mapExpertRow(row) {
  return {
    expertId: clean(row[0]),          // A  Expert_ID
    expertName: clean(row[1]),        // B  Name
    name: clean(row[1]),

    mobileNumber: formatWhatsAppNumber(row[3]),   // D Mobile_No
    whatsappNumber: formatWhatsAppNumber(row[4]), // E WhatsApp_No
    phone: formatWhatsAppNumber(row[4] || row[3]),

    district: clean(row[9]),          // J District
    organization: clean(row[10]),     // K Organization
    department: clean(row[11]),       // L Department
    designation: clean(row[12]),      // M Designation

    expertGroup: clean(row[16]),      // Q Expert_Group
    specialisation: clean(row[17]),   // R Specialization
    cropExpertise: clean(row[16]) + " " + clean(row[17]),
    problemExpertise: clean(row[16]) + " " + clean(row[17]),

    availability: clean(row[25]),     // Z Availability
    autoRoute: clean(row[26]),        // AA Auto_Route
    status: clean(row[27]),           // AB Status
    approvalStatus: clean(row[30]),   // AE Verification_Status
    activeStatus: clean(row[32]),     // AG Active_Status

    totalConsultations: Number(row[34]) || 0, // AI
    averageRating: Number(row[35]) || 0,      // AJ
    openCases: Number(row[36]) || 0,          // AK Farmers_Assigned
    aiPriority: clean(row[37]),                // AL

    raw: row
  };
}
function chooseBestExpert(expertRows, caseData) {
  const experts = (expertRows || [])
    .map(mapExpertRow)
    .filter(function (expert) {
      const status = lower(expert.status);
      const availability = lower(expert.availability);
      const autoRoute = lower(expert.autoRoute);

      const isActive =
        status === "active" ||
        status === "";

      const isAvailable =
        availability === "available" ||
        availability === "yes" ||
        availability === "active" ||
        availability === "";

      const canAutoRoute =
        autoRoute === "yes" ||
        autoRoute === "active" ||
        autoRoute === "";

      return (
        isActive &&
        isAvailable &&
        canAutoRoute &&
        expert.expertId &&
        expert.expertName &&
        expert.phone
      );
    });

  if (experts.length === 0) {
    return null;
  }

  const scored = experts.map(function (expert) {
    return {
      expert: expert,
      score: scoreExpert(expert, caseData)
    };
  });

  scored.sort(function (a, b) {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return (
      Number(a.expert.openCases || 0) -
      Number(b.expert.openCases || 0)
    );
  });

  return scored[0];
}
function createCaseId() {
  return "BM-EXP-" + Date.now();
}
async function assignExpertCase(options) {
  const {
    caseData,
    readSheetRows,
    appendRow,
    settings
  } = options || {};
  if (!caseData) {
    throw new Error("caseData is required.");
  }
  if (typeof readSheetRows !== "function") {
    throw new Error("readSheetRows function is required.");
  }
  if (typeof appendRow !== "function") {
    throw new Error("appendRow function is required.");
  }
  const expertRows = await readSheetRows(
  "Expert_Directory",
  "A2:AS"
   );
    const problemCategory =
    caseData.problemCategory ||
    getProblemCategory(caseData.problem);
  const priority =
    caseData.priority ||
    calculatePriority(
      caseData.problem,
      caseData.aiConfidence
    );
  const preparedCase = {
    caseId: caseData.caseId || createCaseId(),
    dateTime:
      caseData.dateTime ||
      new Date().toISOString(),
    farmerName: clean(caseData.farmerName),
    whatsapp: clean(caseData.whatsapp),
    district: clean(caseData.district),
    panchayath: clean(caseData.panchayath),
    crop: clean(caseData.crop),
    problem: clean(caseData.problem),
    aiDiagnosis: clean(caseData.aiDiagnosis),
    aiConfidence: clean(caseData.aiConfidence),
    priority: priority,
    problemCategory: problemCategory,
    imageIds: clean(caseData.imageIds),
    caseSummary: clean(caseData.caseSummary)
  };
  const match = chooseBestExpert(
    expertRows,
    preparedCase
  );
  console.log("Experts loaded:", expertRows.length);

console.log("Best Match:", match);

if (match) {
  console.log("Assigned Expert:", match.expert.expertId, match.expert.expertName);
} else {
  console.log("No suitable expert found.");
}
  const selectedExpert = match
    ? match.expert
    : null;
  const status = selectedExpert
    ? "Assigned"
    : "New";
  await appendRow("Expert_Cases", [
    preparedCase.caseId,
    preparedCase.dateTime,
    preparedCase.farmerName,
    preparedCase.whatsapp,
    preparedCase.district,
    preparedCase.panchayath,
    preparedCase.crop,
    preparedCase.problem,
    preparedCase.aiDiagnosis,
    preparedCase.aiConfidence,
    preparedCase.priority,
    selectedExpert
      ? selectedExpert.expertId
      : "",
    selectedExpert
      ? selectedExpert.name
      : "",
    selectedExpert
   selectedExpert
  ? selectedExpert.whatsappNumber
  : "",
    status,
    "",
    "",
    "",
    preparedCase.problemCategory,
    preparedCase.imageIds,
    preparedCase.caseSummary
  ]);
  const farmerMessage =
    selectedExpert
      ? (
        settings &&
        settings.MSG_EXPERT_ASSIGNED
      ) ||
        "നിങ്ങളുടെ കേസ് BhoomiMitra വിദഗ്ധ പരിശോധനയ്ക്കായി രജിസ്റ്റർ ചെയ്തിരിക്കുന്നു. അനുയോജ്യനായ വിദഗ്ധന് കേസ് കൈമാറിയിട്ടുണ്ട്. വിദഗ്ധൻ പരിശോധിച്ച ശേഷം മറുപടി നൽകുന്നതാണ്."
      : (
        settings &&
        settings.MSG_EXPERT_REGISTERED
      ) ||
        "നിങ്ങളുടെ കേസ് BhoomiMitra വിദഗ്ധ പരിശോധനയ്ക്കായി രജിസ്റ്റർ ചെയ്തിരിക്കുന്നു. രജിസ്റ്റർ ചെയ്ത അനുയോജ്യനായ വിദഗ്ധൻ പരിശോധിച്ച ശേഷം മറുപടി നൽകുന്നതാണ്.";
  const expertMessage = selectedExpert
    ? [
        "പുതിയ BhoomiMitra വിദഗ്ധ കേസ് ലഭിച്ചിട്ടുണ്ട്.",
        "",
        "Case ID: " + preparedCase.caseId,
        "Crop: " +
          (preparedCase.crop || "Not confirmed"),
        "District: " +
          (preparedCase.district || "Not available"),
        "Priority: " + preparedCase.priority,
        "Category: " +
          preparedCase.problemCategory,
        "",
        "Farmer problem:",
        preparedCase.problem ||
          preparedCase.caseSummary ||
          "Not available",
        "",
        "AI provisional diagnosis:",
        preparedCase.aiDiagnosis ||
          "Not available",
        "",
        "AI confidence: " +
          (preparedCase.aiConfidence || "Not available"),
        "",
        "Please review and reply with Case ID."
      ].join("\n")
    : "";
  return {
    success: true,
    caseId: preparedCase.caseId,
    status: status,
    priority: preparedCase.priority,
    problemCategory:
      preparedCase.problemCategory,
    expert: selectedExpert,
    expertScore: match ? match.score : 0,
    farmerMessage: farmerMessage,
    expertMessage: expertMessage
  };
}
module.exports = {
  assignExpertCase,
  chooseBestExpert,
  calculatePriority,
  getProblemCategory,
  scoreExpert
};
