"use strict";

/*
 * BhoomiMitra Case Manager
 *
 * Purpose:
 * - Maintain multiple recent agricultural cases for each WhatsApp user
 * - Keep photo, text and voice follow-up context separate from registration
 * - Support switching between previous crop cases
 * - Handle temporary clarification selections
 *
 * Important:
 * - Storage is currently in memory.
 * - All cases are lost when Render restarts or redeploys.
 * - This file does not access Google Sheets, OpenAI, WhatsApp or any API.
 */

const CASE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const CLARIFICATION_EXPIRY_MS = 10 * 60 * 1000;
const MAX_CASES_PER_USER = 5;
const MAX_RECENT_MESSAGES = 10;
const MAX_SUMMARY_LENGTH = 600;
const MAX_DIAGNOSIS_LENGTH = 300;

const userCases = Object.create(null);

const CROP_ALIASES = {
  Rice: [
    "rice",
    "paddy",
    "നെല്ല്"
  ],

  Tapioca: [
    "tapioca",
    "cassava",
    "കപ്പ",
    "മരച്ചീനി"
  ],

  Coconut: [
    "coconut",
    "coconut palm",
    "തെങ്ങ്"
  ],

  Arecanut: [
    "arecanut",
    "areca",
    "betel nut",
    "അടയ്ക്ക"
  ],

  Banana: [
    "banana",
    "plantain",
    "വാഴ"
  ],

  Sugarcane: [
    "sugarcane",
    "sugar cane",
    "കരിമ്പ്"
  ],

  Rubber: [
    "rubber",
    "rubber tree",
    "റബ്ബർ"
  ],

  Pepper: [
    "pepper",
    "black pepper",
    "കുരുമുളക്"
  ],

  Cardamom: [
    "cardamom",
    "ഏലം"
  ],

  Ginger: [
    "ginger",
    "ഇഞ്ചി"
  ],

  Turmeric: [
    "turmeric",
    "മഞ്ഞൾ"
  ],

  Nutmeg: [
    "nutmeg",
    "ജാതി",
    "ജാതിക്ക"
  ],

  Cocoa: [
    "cocoa",
    "കൊക്കോ"
  ],

  Jackfruit: [
    "jackfruit",
    "jack tree",
    "ചക്ക",
    "പ്ലാവ്"
  ],

  Mango: [
    "mango",
    "mango tree",
    "മാവ്",
    "മാങ്ങ"
  ],

  Guava: [
    "guava",
    "പേരയ്ക്ക"
  ],

  Rambutan: [
    "rambutan",
    "റംബൂട്ടാൻ"
  ],

  Mangosteen: [
    "mangosteen",
    "മാംഗോസ്റ്റീൻ"
  ],

  Pineapple: [
    "pineapple",
    "കൈതച്ചക്ക"
  ],

  Cashew: [
    "cashew",
    "cashew nut",
    "കശുമാവ്",
    "കശുവണ്ടി"
  ],

  Coffee: [
    "coffee",
    "കാപ്പി"
  ],

  Tea: [
    "tea",
    "തേയില"
  ],

  Papaya: [
    "papaya",
    "പപ്പായ"
  ],

  Tomato: [
    "tomato",
    "തക്കാളി"
  ],

  Brinjal: [
    "brinjal",
    "eggplant",
    "aubergine",
    "വഴുതന"
  ],

  Okra: [
    "okra",
    "ladies finger",
    "lady finger",
    "വെണ്ട"
  ],

  Chilli: [
    "chilli",
    "chili",
    "green chilli",
    "മുളക്"
  ],

  Cucumber: [
    "cucumber",
    "വെള്ളരി"
  ],

  Cowpea: [
    "cowpea",
    "yardlong bean",
    "വള്ളിപ്പയർ",
    "പയർ"
  ],

  Drumstick: [
    "drumstick",
    "moringa",
    "മുരിങ്ങ"
  ],

  Fodder: [
    "fodder",
    "fodder crop",
    "തീറ്റപ്പുൽ"
  ]
};

const SAME_CASE_SIGNALS = [
  "same crop",
  "same plant",
  "same problem",
  "same case",
  "same photo",
  "previous photo",
  "previous image",
  "earlier photo",
  "earlier image",
  "this photo",
  "this image",
  "this problem",
  "this plant",
  "what is the control",
  "control for this",
  "continue this",
  "ഇതേ വിള",
  "ഇതേ ചെടി",
  "ഇതേ പ്രശ്നം",
  "ഇതിന്റെ നിയന്ത്രണം",
  "ഈ ചിത്രത്തിലെ",
  "മുമ്പത്തെ ചിത്രം",
  "മുമ്പത്തെ ഫോട്ടോ",
  "അതേ ചെടി",
  "അതേ വിള"
];

const NEW_CASE_SIGNALS = [
  "new case",
  "new crop",
  "new problem",
  "another crop",
  "another plant",
  "another problem",
  "different crop",
  "different plant",
  "different problem",
  "പുതിയ കേസ്",
  "പുതിയ വിള",
  "പുതിയ പ്രശ്നം",
  "മറ്റൊരു വിള",
  "മറ്റൊരു ചെടി",
  "മറ്റൊരു പ്രശ്നം",
  "വേറെ വിള",
  "വേറെ ചെടി",
  "വേറെ പ്രശ്നം"
];

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[.,!?;:()[\]{}"'`~@#$%^&*+=\\/|<>_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value, maximumLength) {
  const text = String(value || "").trim();

  if (text.length <= maximumLength) {
    return text;
  }

  return text.substring(0, maximumLength);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsEnglishAlias(normalizedText, alias) {
  const normalizedAlias = normalizeText(alias);

  if (!normalizedAlias) {
    return false;
  }

  const pattern = new RegExp(
    "(^|\\s)" + escapeRegExp(normalizedAlias) + "(?=\\s|$)",
    "i"
  );

  return pattern.test(normalizedText);
}

function containsMalayalamAlias(normalizedText, alias) {
  const normalizedAlias = normalizeText(alias);

  if (!normalizedAlias) {
    return false;
  }

  return normalizedText.includes(normalizedAlias);
}

function extractRecognisedCrop(text) {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return "";
  }

  const cropNames = Object.keys(CROP_ALIASES);

  for (const cropName of cropNames) {
    const aliases = CROP_ALIASES[cropName];

    for (const alias of aliases) {
      const containsMalayalam = /[\u0D00-\u0D7F]/.test(alias);

      const matched = containsMalayalam
        ? containsMalayalamAlias(normalizedText, alias)
        : containsEnglishAlias(normalizedText, alias);

      if (matched) {
        return cropName;
      }
    }
  }

  return "";
}

function messageHasSignal(text, signals) {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return false;
  }

  return signals.some(function (signal) {
    return normalizedText.includes(normalizeText(signal));
  });
}

function messageRefersToCurrentCase(text) {
  return messageHasSignal(text, SAME_CASE_SIGNALS);
}

function messageStartsNewCase(text) {
  return messageHasSignal(text, NEW_CASE_SIGNALS);
}

function getStore(from) {
  const userKey = String(from || "").trim();

  if (!userKey) {
    throw new Error("caseManager: WhatsApp user identifier is required.");
  }

  if (!userCases[userKey]) {
    userCases[userKey] = {
      activeCaseId: "",
      cases: [],
      pendingClarification: null
    };
  }

  return userCases[userKey];
}

function makeCaseId() {
  return (
    "CASE-" +
    Date.now() +
    "-" +
    Math.random().toString(36).substring(2, 8).toUpperCase()
  );
}
function removeExpiredCases(from) {
  const store = getStore(from);
  const now = Date.now();

  store.cases = store.cases.filter(function (item) {
    return (now - item.updatedAt) < CASE_EXPIRY_MS;
  });

  if (
    store.activeCaseId &&
    !store.cases.find(function (c) {
      return c.caseId === store.activeCaseId;
    })
  ) {
    store.activeCaseId =
      store.cases.length > 0 ? store.cases[0].caseId : "";
  }

  if (
    store.pendingClarification &&
    store.pendingClarification.expiresAt < now
  ) {
    store.pendingClarification = null;
  }

  return store;
}

function getActiveCase(from) {
  const store = removeExpiredCases(from);

  if (!store.activeCaseId) {
    return null;
  }

  return (
    store.cases.find(function (c) {
      return c.caseId === store.activeCaseId;
    }) || null
  );
}

function createCase(from, initialData) {
  const store = removeExpiredCases(from);

  const newCase = {
    caseId: makeCaseId(),
    crop: initialData.crop || "",
    subject: truncate(initialData.subject || "", 150),
    summary: truncate(initialData.summary || "", MAX_SUMMARY_LENGTH),
    latestDiagnosis: truncate(
      initialData.latestDiagnosis || "",
      MAX_DIAGNOSIS_LENGTH
    ),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    awaitingPhoto: false,
    recentMessages: [],
    photos: []
  };

  store.cases.unshift(newCase);

  while (store.cases.length > MAX_CASES_PER_USER) {

    let oldestIndex = 0;

    for (let i = 1; i < store.cases.length; i++) {

      if (
        store.cases[i].updatedAt <
        store.cases[oldestIndex].updatedAt
      ) {
        oldestIndex = i;
      }

    }

    store.cases.splice(oldestIndex, 1);

  }

  store.activeCaseId = newCase.caseId;

  return {
    event: "CASE_CREATED",
    case: newCase
  };
}

function switchCase(from, caseId) {

  const store = removeExpiredCases(from);

  const found = store.cases.find(function (c) {
    return c.caseId === caseId;
  });

  if (!found) {

    return {
      event: "CASE_NOT_FOUND"
    };

  }

  store.activeCaseId = found.caseId;
  found.updatedAt = Date.now();

  return {
    event: "CASE_SWITCHED",
    case: found
  };
}

function addMessage(caseObject, type, text) {

  if (!caseObject) {
    return;
  }

  caseObject.recentMessages.push({
    type,
    text,
    timestamp: Date.now()
  });

  while (
    caseObject.recentMessages.length >
    MAX_RECENT_MESSAGES
  ) {
    caseObject.recentMessages.shift();
  }

  caseObject.updatedAt = Date.now();
}

function addPhoto(caseObject, mediaId, caption) {

  if (!caseObject) {
    return;
  }

  caseObject.photos.push({
    mediaId,
    caption,
    timestamp: Date.now()
  });

  while (caseObject.photos.length > 10) {
    caseObject.photos.shift();
  }

  caseObject.updatedAt = Date.now();
}

function updateDiagnosis(caseObject, diagnosis) {

  if (!caseObject) {
    return;
  }

  caseObject.latestDiagnosis = truncate(
    diagnosis,
    MAX_DIAGNOSIS_LENGTH
  );

  caseObject.summary = truncate(
    diagnosis,
    MAX_SUMMARY_LENGTH
  );

  caseObject.updatedAt = Date.now();
}

function buildPhotoContext(caseObject, caption) {

  const parts = [];

  if (caption) {
    parts.push("Caption: " + caption);
  }

  if (!caseObject) {
    return parts.join("\n");
  }

  if (caseObject.crop) {
    parts.push("Crop: " + caseObject.crop);
  }

  if (caseObject.subject) {
    parts.push("Subject: " + caseObject.subject);
  }

  if (caseObject.summary) {
    parts.push("Summary: " + caseObject.summary);
  }

  return parts.join("\n");
}
function startClarification(from, options) {

  const store = getStore(from);

  store.pendingClarification = {
    options: options || [],
    expiresAt: Date.now() + CLARIFICATION_EXPIRY_MS
  };

  return store.pendingClarification;
}

function clearClarification(from) {

  const store = getStore(from);

  store.pendingClarification = null;
}

function getPendingClarification(from) {

  const store = removeExpiredCases(from);

  return store.pendingClarification;
}

function selectClarification(from, index) {

  const store = removeExpiredCases(from);

  if (!store.pendingClarification) {

    return {
      event: "NO_PENDING_CLARIFICATION"
    };

  }

  const options = store.pendingClarification.options;

  if (
    index < 0 ||
    index >= options.length
  ) {

    return {
      event: "INVALID_SELECTION"
    };

  }

  const selected = options[index];

  store.pendingClarification = null;

  return switchCase(from, selected.caseId);
}

function getCases(from) {

  return removeExpiredCases(from).cases;
}

module.exports = {

  CASE_EXPIRY_MS,
  MAX_CASES_PER_USER,
  MAX_RECENT_MESSAGES,

  CROP_ALIASES,

  extractRecognisedCrop,

  messageRefersToCurrentCase,
  messageStartsNewCase,

  getStore,
  getCases,

  getActiveCase,

  createCase,
  switchCase,

  addMessage,
  addPhoto,
  updateDiagnosis,

  buildPhotoContext,

  startClarification,
  clearClarification,
  getPendingClarification,
  selectClarification

};
