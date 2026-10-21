"use strict";

const crypto = require("crypto");
const {
  createExpertQuestionId,
  deriveExpertTopic,
  assessExpertCaseRow
} = require("./expertAdviceFlow");

const EXPERT_CASE_HEADERS = [
  "Case_ID",
  "Date_Time",
  "Farmer_Name",
  "WhatsApp",
  "District",
  "Panchayath",
  "Crop",
  "Problem",
  "AI_Diagnosis",
  "AI_Confidence",
  "Priority",
  "Assigned_Expert",
  "Status",
  "Expert_Remark",
  "Closed_Date",
  "Photo_URL",
  "AI_Response",
  "Resolution_Time_Hours",
  "Farmer_Feedback",
  "Farmer_ID",
  "Assigned_Expert_ID",
  "Assigned_Expert_WhatsApp",
  "Category",
  "Assigned_At",
  "Source_Message_ID",
  "Expert_Notification_Status",
  "Expert_Notification_Message_ID",
  "Notification_Attempts",
  "Last_Notification_Error",
  "Last_Notification_At"
];

const inFlightSourceMessages = new Set();

function clean(value) {
  return value == null ? "" : String(value).trim();
}

function formatWhatsAppNumber(number) {
  let mobile = clean(number).replace(/[^\d]/g, "");

  if (mobile.length === 10) {
    mobile = "91" + mobile;
  }

  return mobile;
}

function lower(value) {
  return clean(value).toLowerCase();
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

function findMissingHeaders(headers) {
  const headerMap = makeHeaderMap(headers);

  return EXPERT_CASE_HEADERS.filter(function (header) {
    return headerMap[normalizeHeader(header)] === undefined;
  });
}

function buildRowFromHeaders(headers, valuesByHeader) {
  const normalizedValues = Object.create(null);

  Object.keys(valuesByHeader || {}).forEach(function (header) {
    normalizedValues[normalizeHeader(header)] =
      valuesByHeader[header] == null ? "" : valuesByHeader[header];
  });

  return (headers || []).map(function (header) {
    const key = normalizeHeader(header);

    return Object.prototype.hasOwnProperty.call(normalizedValues, key)
      ? normalizedValues[key]
      : "";
  });
}

function sheetColumnLetter(columnIndex) {
  let number = Number(columnIndex) + 1;
  let letters = "";

  while (number > 0) {
    const remainder = (number - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    number = Math.floor((number - 1) / 26);
  }

  return letters;
}

function buildSheetCellUpdates(
  headers,
  rowNumber,
  sheetName,
  valuesByHeader
) {
  const headerMap = makeHeaderMap(headers);
  const safeRowNumber = Number(rowNumber);

  if (!Number.isInteger(safeRowNumber) || safeRowNumber < 2) {
    throw new Error("A valid Sheet row number is required.");
  }

  return Object.keys(valuesByHeader || {}).map(function (header) {
    const columnIndex = headerMap[normalizeHeader(header)];

    if (columnIndex === undefined) {
      throw new Error("Required Expert_Cases header is missing: " + header);
    }

    return {
      range:
        "'" +
        clean(sheetName || "Expert_Cases").replace(/'/g, "''") +
        "'!" +
        sheetColumnLetter(columnIndex) +
        safeRowNumber,
      values: [[
        valuesByHeader[header] == null
          ? ""
          : valuesByHeader[header]
      ]]
    };
  });
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

const MIN_EXPERT_SEMANTIC_SCORE = 60;
const EXPERT_SEMANTIC_TIER = Object.freeze({
  NONE: 0,
  CROP: 1,
  DOMAIN: 2,
  SUBJECT_SPECIALIZATION: 3
});
const GENERIC_EXPERT_TERMS = new Set([
  "advice",
  "agriculture",
  "agricultural",
  "crop",
  "expert",
  "farm",
  "farming",
  "general",
  "help",
  "management",
  "plant",
  "production",
  "service",
  "services"
]);

function normalizeExpertRoutingText(value) {
  let normalized = lower(value)
    .normalize("NFKC")
    .replace(/\bgoats\b/g, "goat")
    .replace(/\bcows\b/g, "cow")
    .replace(/\bchickens\b/g, "chicken")
    .replace(/\bducks\b/g, "duck")
    .replace(/\bfishes\b/g, "fish")
    .replace(/\bmycorrhiza(?:e|l)?\b/g, "mycorrhiza")
    .replace(/\bbiofertilisers?\b/g, "biofertilizer")
    .replace(/\bbiofertilizers?\b/g, "biofertilizer")
    .replace(/[^a-z0-9\u0D00-\u0D7F\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/\b(?:amf|mycorrhiza)\b/.test(normalized)) {
    normalized += " arbuscular mycorrhiza fungi amf";
  }

  return normalized.replace(/\s+/g, " ").trim();
}

function uniqueRoutingPhrases(value) {
  return Array.from(new Set(
    clean(value)
      .split(/[,;|/]+/)
      .map(normalizeExpertRoutingText)
      .filter(Boolean)
  ));
}

function meaningfulRoutingTokens(value) {
  return Array.from(new Set(
    normalizeExpertRoutingText(value)
      .split(" ")
      .filter(function (word) {
        return (
          word.length >= 3 &&
          !GENERIC_EXPERT_TERMS.has(word)
        );
      })
  ));
}

function includesRoutingPhrase(text, phrase) {
  return (" " + text + " ").includes(
    " " + phrase + " "
  );
}

function scoreTextAgainstPhrases(
  text,
  phrases,
  phraseScore,
  tokenScore
) {
  if (!text) {
    return 0;
  }

  const textTokens = new Set(
    meaningfulRoutingTokens(text)
  );
  let bestScore = 0;
  let exactPhraseMatches = 0;

  phrases.forEach(function (phrase) {
    const phraseTokens =
      meaningfulRoutingTokens(phrase);

    if (phraseTokens.length === 0) {
      return;
    }

    if (includesRoutingPhrase(text, phrase)) {
      exactPhraseMatches += 1;
      bestScore = Math.max(
        bestScore,
        phraseScore
      );
      return;
    }

    const overlapCount = phraseTokens.filter(
      function (word) {
        return textTokens.has(word);
      }
    ).length;

    if (overlapCount > 0) {
      bestScore = Math.max(
        bestScore,
        tokenScore + Math.min(
          10,
          (overlapCount - 1) * 5
        )
      );
    }
  });

  if (exactPhraseMatches > 1) {
    bestScore += Math.min(
      20,
      (exactPhraseMatches - 1) * 10
    );
  }

  return bestScore;
}

function isUsableRoutingProblem(value) {
  const problem = clean(value);

  return Boolean(
    problem &&
    !isEscalationOnlyMessage(problem) &&
    !/^expert assistance requested;/i.test(problem)
  );
}

function scoreExpertDetails(expert, caseData) {
  const input = caseData || {};
  const hasUsableProblem =
    isUsableRoutingProblem(input.problem);
  const subjectText = hasUsableProblem
    ? normalizeExpertRoutingText([
        input.problem,
        input.problemCategory,
        input.caseSummary
      ].join(" "))
    : "";
  const cropText = hasUsableProblem
    ? normalizeExpertRoutingText(input.crop)
    : "";
  const specializationPhrases =
    uniqueRoutingPhrases(expert.specialisation);
  const groupPhrases =
    uniqueRoutingPhrases(expert.expertGroup);
  const subjectSpecializationScore =
    scoreTextAgainstPhrases(
      subjectText,
      specializationPhrases,
      100,
      75
    );
  const subjectDomainScore =
    scoreTextAgainstPhrases(
      subjectText,
      groupPhrases,
      85,
      65
    );
  const cropSpecializationScore =
    scoreTextAgainstPhrases(
      cropText,
      specializationPhrases,
      60,
      45
    );
  const cropDomainScore =
    scoreTextAgainstPhrases(
      cropText,
      groupPhrases,
      50,
      35
    );
  const cropScore = Math.max(
    cropSpecializationScore,
    cropDomainScore
  );
  let semanticTier =
    EXPERT_SEMANTIC_TIER.NONE;
  let semanticScore = 0;

  if (
    subjectSpecializationScore >=
    MIN_EXPERT_SEMANTIC_SCORE
  ) {
    semanticTier =
      EXPERT_SEMANTIC_TIER.SUBJECT_SPECIALIZATION;
    semanticScore =
      subjectSpecializationScore;
  } else if (
    subjectDomainScore >=
    MIN_EXPERT_SEMANTIC_SCORE
  ) {
    semanticTier =
      EXPERT_SEMANTIC_TIER.DOMAIN;
    semanticScore = subjectDomainScore;
  } else if (
    cropScore >=
    MIN_EXPERT_SEMANTIC_SCORE
  ) {
    semanticTier =
      EXPERT_SEMANTIC_TIER.CROP;
    semanticScore = cropScore;
  }
  let operationalScore = 0;

  if (
    lower(expert.district) &&
    lower(input.district) &&
    lower(expert.district) === lower(input.district)
  ) {
    operationalScore += 10;
  }

  if (["available", "yes", "active"].includes(lower(expert.availability))) {
    operationalScore += 10;
  }

  const rating = Number(expert.averageRating || 0);
  if (rating >= 4.5) {
    operationalScore += 10;
  } else if (rating >= 4) {
    operationalScore += 5;
  }

  const currentConsultationCount =
    expert.currentConsultationCount;
  if (
    Number.isFinite(currentConsultationCount) &&
    currentConsultationCount >= 0
  ) {
    if (currentConsultationCount === 0) {
      operationalScore += 10;
    } else if (currentConsultationCount <= 3) {
      operationalScore += 5;
    } else if (currentConsultationCount > 5) {
      operationalScore -= 10;
    }
  }

  return {
    semanticTier: semanticTier,
    semanticScore: semanticScore,
    operationalScore: operationalScore,
    totalScore:
      semanticTier * 1000000 +
      semanticScore * 100 +
      operationalScore
  };
}

function scoreExpert(expert, caseData) {
  return scoreExpertDetails(
    expert,
    caseData
  ).totalScore;
}

function optionalNonNegativeNumber(value) {
  const text = clean(value);

  if (!text) {
    return null;
  }

  const number = Number(text);
  return Number.isFinite(number) && number >= 0
    ? number
    : null;
}

function mapExpertRow(row) {
  return {
    expertId: clean(row[0]),
    expertName: clean(row[1]),
    name: clean(row[1]),
    mobileNumber: formatWhatsAppNumber(row[3]),
    whatsappNumber: formatWhatsAppNumber(row[4]),
    phone: formatWhatsAppNumber(row[4] || row[3]),
    district: clean(row[9]),
    organization: clean(row[10]),
    department: clean(row[11]),
    designation: clean(row[12]),
    expertGroup: clean(row[16]),
    specialisation: clean(row[17]),
    cropExpertise: clean(row[16]) + " " + clean(row[17]),
    problemExpertise: clean(row[16]) + " " + clean(row[17]),
    availability: clean(row[25]),
    autoRoute: clean(row[26]),
    status: clean(row[27]),
    verificationStatus: clean(row[30]),
    approvalStatus: clean(row[30]),
    activeStatus: clean(row[32]),
    totalConsultations: Number(row[34]) || 0,
    averageRating: Number(row[35]) || 0,
    farmersAssigned: Number(row[36]) || 0,
    aiPriority: clean(row[37]),
    currentConsultationCount:
      optionalNonNegativeNumber(row[42]),
    raw: row
  };
}

function chooseBestExpert(expertRows, caseData) {
  const experts = (expertRows || [])
    .map(mapExpertRow)
    .filter(function (expert) {
      const isActive = ["active", ""].includes(lower(expert.status));
      const isAvailable = ["available", "yes", "active", ""].includes(
        lower(expert.availability)
      );
      const canAutoRoute = ["yes", "active", ""].includes(
        lower(expert.autoRoute)
      );
      const hasActiveStatus = ["active", "yes", ""].includes(
        lower(expert.activeStatus)
      );
      const isVerified = [
        "verified",
        "approved",
        "active",
        "yes",
        ""
      ].includes(lower(expert.verificationStatus));

      return (
        isActive &&
        isAvailable &&
        canAutoRoute &&
        hasActiveStatus &&
        isVerified &&
        expert.expertId &&
        expert.expertName &&
        expert.phone
      );
    });

  if (experts.length === 0) {
    return null;
  }

  const scored = experts.map(function (expert) {
    const scoreDetails = scoreExpertDetails(
      expert,
      caseData
    );

    return {
      expert: expert,
      score: scoreDetails.totalScore,
      semanticTier:
        scoreDetails.semanticTier,
      semanticScore:
        scoreDetails.semanticScore,
      operationalScore:
        scoreDetails.operationalScore
    };
  }).filter(function (match) {
    return match.semanticTier > EXPERT_SEMANTIC_TIER.NONE;
  });

  if (scored.length === 0) {
    return null;
  }

  scored.sort(function (a, b) {
    if (b.semanticTier !== a.semanticTier) {
      return b.semanticTier - a.semanticTier;
    }

    if (b.semanticScore !== a.semanticScore) {
      return b.semanticScore - a.semanticScore;
    }

    if (b.operationalScore !== a.operationalScore) {
      return b.operationalScore - a.operationalScore;
    }

    const aHasKnownWorkload = Number.isFinite(
      a.expert.currentConsultationCount
    );
    const bHasKnownWorkload = Number.isFinite(
      b.expert.currentConsultationCount
    );

    if (aHasKnownWorkload !== bHasKnownWorkload) {
      return aHasKnownWorkload ? -1 : 1;
    }

    if (
      aHasKnownWorkload &&
      a.expert.currentConsultationCount !==
        b.expert.currentConsultationCount
    ) {
      return (
        a.expert.currentConsultationCount -
        b.expert.currentConsultationCount
      );
    }

    return String(a.expert.expertId).localeCompare(
      String(b.expert.expertId)
    );
  });

  return scored[0];
}

function createCaseId() {
  return "BM-EXP-" + crypto.randomBytes(16).toString("hex").toUpperCase();
}

function normalizeMessageText(value) {
  return lower(value)
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\bi['’]m\b/g, "i am")
    .replace(/\bi['’]d\b/g, "i would")
    .replace(/["'`´\u2032-\u2037]/g, "")
    .replace(/[.!?,;:…()[\]{}<>/\\|_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ENGLISH_EXPERT_REQUEST_PATTERNS = [
  /^(?:(?:please|kindly) |(?:(?:can|could|would) you ))?(?:get|give|find)(?: me)? (?:an? )?expert(?: (?:help|advice|assistance))?(?: please)?$/,
  /^(?:(?:please|kindly) |(?:(?:can|could|would) you ))?connect(?: me)?(?: (?:to|with))? (?:an? )?expert(?: (?:help|advice|assistance))?(?: please)?$/,
  /^(?:(?:please|kindly) |(?:(?:can|could|would) you ))?(?:talk|speak)(?: (?:to|with))? (?:an? )?expert(?: (?:help|advice|assistance))?(?: please)?$/,
  /^(?:(?:please|kindly) )?(?:i )?(?:want|need)(?: to (?:(?:talk|speak)(?: (?:to|with))?|connect(?: me)?(?: (?:to|with))?))? (?:an? )?expert(?: (?:help|advice|assistance))?(?: please)?$/,
  /^(?:(?:please|kindly) )?expert(?: (?:help|advice|assistance))?(?: please)?$/
];

const MALAYALAM_EXPERT_REQUEST_PATTERNS = [
  /^(?:എനിക്ക് )?(?:ഒരു )?വിദഗ്ധനെ വേണം$/,
  /^വിദഗ്ധ സഹായം(?: വേണം| ആവശ്യമാണ്)?$/,
  /^(?:എനിക്ക് )?വിദഗ്ധന(?:ുമായി|ോട്) സംസാരിക്കണം$/,
  /^ഫീൽഡ് വിസിറ്റ് വേണം$/
];

function isEscalationOnlyMessage(value) {
  const text = normalizeMessageText(value);

  if (!text) {
    return false;
  }

  if (text === "visit my farm" || text === "field visit") {
    return true;
  }

  return ENGLISH_EXPERT_REQUEST_PATTERNS.some(function (pattern) {
    return pattern.test(text);
  }) || MALAYALAM_EXPERT_REQUEST_PATTERNS.some(function (pattern) {
    return pattern.test(text);
  });
}

function isDetailedFarmerProblem(value) {
  const text = clean(value);

  if (!text || isEscalationOnlyMessage(text)) {
    return false;
  }

  const words = text.split(/\s+/).filter(Boolean);
  return text.length >= 15 || words.length >= 4;
}

function isExcludedRecentProblemMessage(value, detectedIntent) {
  const text = normalizeMessageText(value);
  const intent = normalizeMessageText(detectedIntent);

  if (!text) {
    return true;
  }

  if (intent === "weather" || intent === "market") {
    return true;
  }

  if (
    /^(menu|main menu|back|cancel|home|start|help|english|malayalam)$/i.test(text) ||
    /\b(main menu|menu options|go back|return home|personal records)\b/i.test(text) ||
    /^(change|select|choose) (my )?language\b/i.test(text) ||
    /^(my )?(profile|records|farmer id|lands?|animals?)$/i.test(text) ||
    /^bm-(?:f|l|exp|ex)-[a-z0-9-]+$/i.test(text) ||
    /^\d+$/.test(text)
  ) {
    return true;
  }

  return false;
}

function rememberRecentExpertProblem(store, userKey, input) {
  const target = store && typeof store === "object" ? store : null;
  const key = clean(userKey);
  const data = input || {};
  const text = clean(data.text);

  if (
    !target ||
    !key ||
    !isDetailedFarmerProblem(text) ||
    isEscalationOnlyMessage(text) ||
    isExcludedRecentProblemMessage(text, data.detectedIntent)
  ) {
    return null;
  }

  const timestamp = Number(data.timestamp);
  const entry = {
    text: text,
    timestamp: Number.isFinite(timestamp)
      ? timestamp
      : Date.now(),
    crop: clean(data.crop),
    category: clean(data.category),
    context: clean(data.context)
  };

  target[key] = entry;
  return entry;
}

function getRecentExpertProblem(
  store,
  userKey,
  maximumAgeMs,
  now = Date.now()
) {
  const target = store && typeof store === "object" ? store : null;
  const key = clean(userKey);

  if (!target || !key) {
    return null;
  }

  const entry = target[key];

  if (!entry || !isDetailedFarmerProblem(entry.text)) {
    delete target[key];
    return null;
  }

  const timestamp = Number(entry.timestamp);
  const maximumAge = Number(maximumAgeMs);
  const currentTime = Number(now);
  const expired =
    !Number.isFinite(timestamp) ||
    !Number.isFinite(maximumAge) ||
    maximumAge < 0 ||
    !Number.isFinite(currentTime) ||
    currentTime - timestamp > maximumAge ||
    currentTime < timestamp;

  if (expired) {
    delete target[key];
    return null;
  }

  return entry;
}

function consumeRecentExpertProblem(store, userKey, expectedTimestamp) {
  const target = store && typeof store === "object" ? store : null;
  const key = clean(userKey);

  if (!target || !key || !target[key]) {
    return false;
  }

  if (
    expectedTimestamp !== undefined &&
    Number(target[key].timestamp) !== Number(expectedTimestamp)
  ) {
    return false;
  }

  delete target[key];
  return true;
}

function resolveExpertProblemContext(options) {
  const input = options || {};
  const currentText = clean(input.currentText);
  const recentProblem = clean(input.recentProblem);
  const activeCase = input.activeCase || null;
  const recentMessages = activeCase && Array.isArray(activeCase.recentMessages)
    ? activeCase.recentMessages
    : [];
  const priorProblems = recentMessages
    .map(function (message) {
      return clean(message && message.text);
    })
    .filter(function (text) {
      return text && text !== currentText && isDetailedFarmerProblem(text);
    });
  const subject = clean(activeCase && activeCase.subject);
  const currentIsCommand = isEscalationOnlyMessage(currentText);
  let problem = currentText;
  let problemSource = "CURRENT";

  if (currentIsCommand && priorProblems.length > 0) {
    problem = priorProblems[priorProblems.length - 1];
    problemSource = "ACTIVE_CASE";
  } else if (
    currentIsCommand &&
    isDetailedFarmerProblem(subject)
  ) {
    problem = subject;
    problemSource = "ACTIVE_CASE";
  } else if (
    currentIsCommand &&
    isDetailedFarmerProblem(recentProblem)
  ) {
    problem = recentProblem;
    problemSource = "RECENT";
  } else if (currentIsCommand) {
    problem = "Expert assistance requested; no detailed farmer problem is available.";
    problemSource = "FALLBACK";
  }

  if (!problem) {
    problem = "Expert assistance requested; no detailed farmer problem is available.";
    problemSource = "FALLBACK";
  }

  const earlierContext = priorProblems
    .filter(function (text) {
      return text !== problem;
    })
    .slice(-2);

  return {
    problem: problem,
    caseSummary: earlierContext.length > 0
      ? "Earlier farmer context:\n- " + earlierContext.join("\n- ")
      : "",
    usedPriorProblem:
      problemSource === "ACTIVE_CASE" ||
      problemSource === "RECENT",
    problemSource: problemSource
  };
}

function parseExpertReplyText(value) {
  const match = clean(value).match(
    /^REPLY\s+(BM-EXP-[A-Z0-9-]+)\s*([\s\S]*)$/i
  );

  if (!match) {
    return null;
  }

  return {
    caseId: clean(match[1]),
    advice: clean(match[2])
  };
}

function safeFarmerIdentifier(caseData) {
  const name = clean(caseData.farmerName);
  const farmerId = clean(caseData.farmerId);

  if (name && farmerId) {
    return name + " (" + farmerId + ")";
  }

  if (name || farmerId) {
    return name || farmerId;
  }

  const phone = formatWhatsAppNumber(caseData.whatsapp);
  return phone ? "Farmer ending " + phone.slice(-4) : "Farmer identity unavailable";
}

function buildExpertReplyLink(caseId, settings) {
  const whatsappNumber = formatWhatsAppNumber(
    settings && settings.businessWhatsAppNumber
      ? settings.businessWhatsAppNumber
      : "919746689205"
  );
  const replyText = "REPLY " + caseId + "\n";

  return (
    "https://wa.me/" +
    whatsappNumber +
    "?text=" +
    encodeURIComponent(replyText)
  );
}

function splitGraphemeText(value, maximumLength) {
  const text = String(value == null ? "" : value);

  if (!text) {
    return [];
  }

  const segments = typeof Intl.Segmenter === "function"
    ? Array.from(
        new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
        function (item) {
          return item.segment;
        }
      )
    : Array.from(text);
  const chunks = [];
  let chunk = "";

  segments.forEach(function (segment) {
    if (chunk && chunk.length + segment.length > maximumLength) {
      chunks.push(chunk);
      chunk = "";
    }

    chunk += segment;
  });

  if (chunk) {
    chunks.push(chunk);
  }

  return chunks;
}

function buildPrefixedParts(prefix, content, maximumLength) {
  const capacity = maximumLength - prefix.length;

  if (capacity < 1) {
    throw new Error("Expert notification prefix exceeds the safe message length.");
  }

  return splitGraphemeText(content, capacity).map(function (chunk) {
    return prefix + chunk;
  });
}

function buildExpertNotificationParts(preparedCase, settings) {
  const maximumLength = 3200;
  const caseId = preparedCase.caseId;
  const expertQuestionId =
    createExpertQuestionId(caseId);
  const topic = deriveExpertTopic(
    preparedCase.problem,
    preparedCase.problemCategory,
    preparedCase.crop
  );
  const problem = preparedCase.problem || "Not available";
  const primaryPrefix = [
    "🩺 New BhoomiMitra Expert Case",
    "Expert Qn ID: " + expertQuestionId,
    "Case ID: " + caseId,
    "Topic: " + topic,
    "Farmer: " + safeFarmerIdentifier(preparedCase),
    "District: " + (preparedCase.district || "Not available"),
    "Crop/Animal: " + (preparedCase.crop || "Not specified"),
    "Category: " + (preparedCase.problemCategory || "Not available"),
    "Photo/media available: " + (preparedCase.mediaAvailable ? "Yes" : "No"),
    "Priority: " + preparedCase.priority,
    "",
    "Problem:",
    ""
  ].join("\n");
  const detailSections = [];

  if (preparedCase.caseSummary) {
    detailSections.push(
      "Case context:\n" + preparedCase.caseSummary
    );
  }

  if (preparedCase.aiDiagnosis) {
    detailSections.push(
      "AI provisional assessment:\n" + preparedCase.aiDiagnosis
    );
  }

  const replyInstructions = [
    "Tap to reply:",
    buildExpertReplyLink(caseId, settings),
    "",
    "The Case ID is filled automatically. Type your recommendation after it and send."
  ].join("\n");

  const contextDetails = detailSections.join("\n\n");
  const details = [contextDetails, replyInstructions]
    .filter(Boolean)
    .join("\n\n");
  const completeMessage = primaryPrefix + problem + "\n\n" + details;

  if (completeMessage.length <= maximumLength) {
    return [completeMessage];
  }

  const firstCapacity = maximumLength - primaryPrefix.length;

  if (firstCapacity < 1) {
    throw new Error("Expert notification header exceeds the safe message length.");
  }

  const problemChunks = splitGraphemeText(problem, firstCapacity);
  const parts = [];

  if (problemChunks.length > 0) {
    parts.push(primaryPrefix + problemChunks.shift());
  }

  const continuationPrefix =
    "📝 Case continuation\nCase ID: " + caseId + "\n\n";

  problemChunks.forEach(function (chunk) {
    buildPrefixedParts(
      continuationPrefix,
      chunk,
      maximumLength
    ).forEach(function (part) {
      parts.push(part);
    });
  });

  if (contextDetails) {
    const detailsPrefix =
      "📎 Expert case details\nCase ID: " + caseId + "\n\n";

    buildPrefixedParts(
      detailsPrefix,
      contextDetails,
      maximumLength
    ).forEach(function (part) {
      parts.push(part);
    });
  }

  parts.push(
    "📲 Expert reply\nCase ID: " + caseId + "\n\n" + replyInstructions
  );

  return parts;
}

function getAcceptedMessageId(sendResult) {
  const directId = clean(sendResult && sendResult.messageId);

  if (sendResult && sendResult.accepted === true && directId) {
    return directId;
  }

  return clean(
    sendResult &&
    sendResult.data &&
    sendResult.data.messages &&
    sendResult.data.messages[0] &&
    sendResult.data.messages[0].id
  );
}

function errorText(error) {
  const responseData = error && error.response && error.response.data;
  const value = responseData || (error && error.message) || error || "Unknown error";

  if (typeof value === "string") {
    return value.substring(0, 500);
  }

  try {
    return JSON.stringify(value).substring(0, 500);
  } catch (jsonError) {
    return "Unknown error";
  }
}

function pendingFarmerMessage() {
  return "Your expert request has been recorded and is awaiting expert assignment.";
}

function saveFailureFarmerMessage() {
  return "We could not complete your expert request right now. Please try again shortly.";
}

function duplicateResult(row, headerMap) {
  const status = clean(getHeaderValue(row, headerMap, "Status"));
  const notificationMessageId = clean(
    getHeaderValue(row, headerMap, "Expert_Notification_Message_ID")
  );
  const expertName = clean(getHeaderValue(row, headerMap, "Assigned_Expert"));
  const delivered = [
    "assigned",
    "expert replied",
    "farmer follow-up",
    "closed"
  ].includes(lower(status)) && Boolean(notificationMessageId);

  return {
    success: delivered,
    duplicate: true,
    caseId: clean(getHeaderValue(row, headerMap, "Case_ID")),
    status: status,
    expert: {
      expertId: clean(getHeaderValue(row, headerMap, "Assigned_Expert_ID")),
      expertName: expertName,
      name: expertName,
      phone: clean(getHeaderValue(row, headerMap, "Assigned_Expert_WhatsApp"))
    },
    farmerMessage: delivered && expertName
      ? "Expert " + expertName + " has been assigned"
      : pendingFarmerMessage()
  };
}

async function assignExpertCase(options) {
  const input = options || {};
  const caseData = input.caseData || {};
  const readSheetRows = input.readSheetRows;
  const appendRow = input.appendRow;
  const updateCase = input.updateCase;
  const sendExpertMessage = input.sendExpertMessage;
  const sourceMessageId = clean(caseData.sourceMessageId);

  if (typeof readSheetRows !== "function") {
    throw new Error("readSheetRows function is required.");
  }

  if (typeof appendRow !== "function") {
    throw new Error("appendRow function is required.");
  }

  if (typeof updateCase !== "function") {
    throw new Error("updateCase function is required.");
  }

  if (typeof sendExpertMessage !== "function") {
    throw new Error("sendExpertMessage function is required.");
  }

  if (!sourceMessageId) {
    return {
      success: false,
      error: "Source_Message_ID is required.",
      farmerMessage: saveFailureFarmerMessage()
    };
  }

  if (inFlightSourceMessages.has(sourceMessageId)) {
    return {
      success: false,
      duplicate: true,
      error: "Expert assignment is already in progress for this message.",
      farmerMessage: pendingFarmerMessage()
    };
  }

  inFlightSourceMessages.add(sourceMessageId);

  try {
    const caseRows = await readSheetRows("Expert_Cases", "A:AD");
    const headers = caseRows && caseRows[0] ? caseRows[0] : [];
    const missingHeaders = findMissingHeaders(headers);

    if (missingHeaders.length > 0) {
      return {
        success: false,
        error: "Expert_Cases headers missing: " + missingHeaders.join(", "),
        missingHeaders: missingHeaders,
        farmerMessage: saveFailureFarmerMessage()
      };
    }

    const headerMap = makeHeaderMap(headers);
    const duplicate = (caseRows || []).slice(1).find(function (row) {
      return assessExpertCaseRow(row, headers).compatible &&
        clean(getHeaderValue(row, headerMap, "Source_Message_ID")) === sourceMessageId;
    });

    if (duplicate) {
      return duplicateResult(duplicate, headerMap);
    }

    const expertRows = await readSheetRows("Expert_Directory", "A2:AS");
    const problemCategory = clean(caseData.problemCategory) ||
      getProblemCategory(caseData.problem);
    const priority = clean(caseData.priority) ||
      calculatePriority(caseData.problem, caseData.aiConfidence);
    const preparedCase = {
      caseId: clean(caseData.caseId) || createCaseId(),
      dateTime: clean(caseData.dateTime) || new Date().toISOString(),
      farmerId: clean(caseData.farmerId),
      farmerName: clean(caseData.farmerName),
      whatsapp: formatWhatsAppNumber(caseData.whatsapp || caseData.from),
      district: clean(caseData.district),
      panchayath: clean(caseData.panchayath),
      crop: clean(caseData.crop || caseData.animal),
      problem: clean(caseData.problem || caseData.farmerMessage),
      aiDiagnosis: clean(caseData.aiDiagnosis),
      aiConfidence: clean(caseData.aiConfidence),
      priority: priority,
      problemCategory: problemCategory,
      photoUrl: clean(caseData.photoUrl),
      mediaAvailable: Boolean(
        caseData.mediaAvailable ||
        clean(caseData.photoUrl) ||
        clean(caseData.imageIds)
      ),
      caseSummary: clean(caseData.caseSummary),
      sourceMessageId: sourceMessageId
    };
    const match = chooseBestExpert(expertRows, preparedCase);

    const selectedExpert = match ? match.expert : null;
    const initialNotificationStatus = selectedExpert
      ? "Pending"
      : "Pending - No Eligible Expert";
    const valuesByHeader = {
      Case_ID: preparedCase.caseId,
      Date_Time: preparedCase.dateTime,
      Farmer_Name: preparedCase.farmerName,
      WhatsApp: preparedCase.whatsapp,
      District: preparedCase.district,
      Panchayath: preparedCase.panchayath,
      Crop: preparedCase.crop,
      Problem: preparedCase.problem,
      AI_Diagnosis: preparedCase.aiDiagnosis,
      AI_Confidence: preparedCase.aiConfidence,
      Priority: preparedCase.priority,
      Assigned_Expert: selectedExpert ? selectedExpert.expertName : "",
      Status: "Pending Expert Notification",
      Expert_Remark: "",
      Closed_Date: "",
      Photo_URL: preparedCase.photoUrl,
      AI_Response: "",
      Resolution_Time_Hours: "",
      Farmer_Feedback: "",
      Farmer_ID: preparedCase.farmerId,
      Assigned_Expert_ID: selectedExpert ? selectedExpert.expertId : "",
      Assigned_Expert_WhatsApp: selectedExpert ? selectedExpert.phone : "",
      Category: preparedCase.problemCategory,
      Assigned_At: "",
      Source_Message_ID: preparedCase.sourceMessageId,
      Expert_Notification_Status: initialNotificationStatus,
      Expert_Notification_Message_ID: "",
      Notification_Attempts: 0,
      Last_Notification_Error: "",
      Last_Notification_At: ""
    };
    const row = buildRowFromHeaders(headers, valuesByHeader);
    let appendResult;

    try {
      appendResult = await appendRow("Expert_Cases", row);
    } catch (error) {
      return {
        success: false,
        caseId: preparedCase.caseId,
        error: "Expert_Cases append failed: " + errorText(error),
        farmerMessage: saveFailureFarmerMessage()
      };
    }

    const appendSucceeded = appendResult === true ||
      Boolean(appendResult && appendResult.success === true);

    if (!appendSucceeded) {
      return {
        success: false,
        caseId: preparedCase.caseId,
        error: "Expert_Cases append failed.",
        farmerMessage: saveFailureFarmerMessage()
      };
    }

    const persistedCase = {
      sheetName: "Expert_Cases",
      rowNumber: appendResult && appendResult.rowNumber,
      caseId: preparedCase.caseId,
      sourceMessageId: preparedCase.sourceMessageId,
      headers: headers
    };

    if (!selectedExpert) {
      return {
        success: false,
        caseId: preparedCase.caseId,
        status: "Pending Expert Notification",
        error: "No eligible expert is available.",
        farmerMessage: pendingFarmerMessage()
      };
    }

    const expertMessages = buildExpertNotificationParts(
      preparedCase,
      input.settings
    );
    const notificationAt = new Date().toISOString();
    const notificationMessageIds = [];
    let notificationAttempts = 0;
    let notificationFailure = "";

    for (let index = 0; index < expertMessages.length; index += 1) {
      notificationAttempts += 1;

      try {
        const sendResult = await sendExpertMessage(
          selectedExpert.phone,
          expertMessages[index],
          { skipPreferredLanguageConversion: true }
        );
        const acceptedMessageId = getAcceptedMessageId(sendResult);

        if (!acceptedMessageId) {
          notificationFailure =
            "Meta did not return an accepted WhatsApp message ID for expert notification part " +
            (index + 1) +
            " of " +
            expertMessages.length +
            ".";
          break;
        }

        notificationMessageIds.push(acceptedMessageId);
      } catch (error) {
        notificationFailure =
          "Expert notification part " +
          (index + 1) +
          " of " +
          expertMessages.length +
          " failed: " +
          errorText(error);
        break;
      }
    }

    if (notificationFailure) {
      const primaryMessageId = notificationMessageIds[0] || "";

      await updateCase(Object.assign({}, persistedCase, {
        valuesByHeader: {
          Status: "Pending Expert Notification",
          Expert_Notification_Status: "Failed",
          Expert_Notification_Message_ID: primaryMessageId,
          Notification_Attempts: notificationAttempts,
          Last_Notification_Error: notificationFailure,
          Last_Notification_At: notificationAt
        }
      }));

      return {
        success: false,
        caseId: preparedCase.caseId,
        status: "Pending Expert Notification",
        error: notificationFailure,
        expert: selectedExpert,
        expertMessage: expertMessages[0] || "",
        expertMessages: expertMessages,
        notificationMessageIds: notificationMessageIds,
        farmerMessage: pendingFarmerMessage()
      };
    }

    const acceptedMessageId = notificationMessageIds[0];
    const assignedAt = new Date().toISOString();
    const updateSucceeded = await updateCase(Object.assign({}, persistedCase, {
      valuesByHeader: {
        Status: "Assigned",
        Assigned_At: assignedAt,
        Assigned_Expert_ID: selectedExpert.expertId,
        Assigned_Expert_WhatsApp: selectedExpert.phone,
        Expert_Notification_Status: "Accepted",
        Expert_Notification_Message_ID: acceptedMessageId,
        Notification_Attempts: notificationAttempts,
        Last_Notification_Error: "",
        Last_Notification_At: notificationAt
      }
    }));

    if (!updateSucceeded) {
      return {
        success: false,
        caseId: preparedCase.caseId,
        status: "Pending Expert Notification",
        error: "Expert delivery was accepted but the case status update failed.",
        expert: selectedExpert,
        expertMessage: expertMessages[0] || "",
        expertMessages: expertMessages,
        notificationMessageIds: notificationMessageIds,
        farmerMessage: pendingFarmerMessage()
      };
    }

    return {
      success: true,
      caseId: preparedCase.caseId,
      status: "Assigned",
      priority: preparedCase.priority,
      problemCategory: preparedCase.problemCategory,
      expert: selectedExpert,
      expertScore: match ? match.score : 0,
      expertMessage: expertMessages[0] || "",
      expertMessages: expertMessages,
      notificationMessageId: acceptedMessageId,
      notificationMessageIds: notificationMessageIds,
      farmerMessage: "Expert " + selectedExpert.expertName + " has been assigned"
    };
  } finally {
    inFlightSourceMessages.delete(sourceMessageId);
  }
}

module.exports = {
  EXPERT_CASE_HEADERS,
  assignExpertCase,
  buildExpertNotificationParts,
  buildRowFromHeaders,
  buildSheetCellUpdates,
  chooseBestExpert,
  createCaseId,
  calculatePriority,
  findMissingHeaders,
  getHeaderValue,
  getProblemCategory,
  getRecentExpertProblem,
  isDetailedFarmerProblem,
  isExcludedRecentProblemMessage,
  isEscalationOnlyMessage,
  makeHeaderMap,
  parseExpertReplyText,
  rememberRecentExpertProblem,
  resolveExpertProblemContext,
  consumeRecentExpertProblem,
  scoreExpert
};
