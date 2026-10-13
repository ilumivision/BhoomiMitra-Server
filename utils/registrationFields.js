"use strict";

const FARMER_PREFERRED_LANGUAGE_HEADERS = Object.freeze([
  "Preferred_Language",
  "Preferred Language",
  "Prefered Language"
]);

const FARMER_HEADER_ALIASES = Object.freeze({
  idHeaders: Object.freeze([
    "Farmer_ID",
    "Farmer ID"
  ]),
  nameHeaders: Object.freeze([
    "Name",
    "Farmer Name"
  ]),
  mobileHeaders: Object.freeze([
    "Mobile",
    "Mobile No",
    "Mob No"
  ]),
  whatsappHeaders: Object.freeze([
    "WhatsApp",
    "WhatsApp No",
    "WhatsApp_No",
    "WhatApp"
  ]),
  districtHeaders: Object.freeze([
    "District",
    "Distrct"
  ]),
  panchayathHeaders: Object.freeze([
    "Panchayath",
    "Panchayat"
  ]),
  serviceHeaders: Object.freeze([
    "Main Crop",
    "Main_Crop",
    "Crop"
  ]),
  languageHeaders: FARMER_PREFERRED_LANGUAGE_HEADERS,
  statusHeaders: Object.freeze([
    "Status",
    "Verification_Status"
  ]),
  aiRegistrationHeaders: Object.freeze([
    "AI_Registration",
    "AI Registration",
    "AI_Registration_Source"
  ])
});

function normalizeRegistrationHeader(value) {
  return String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function findFarmerPreferredLanguageColumn(headers) {
  const sheetHeaders = Array.isArray(headers)
    ? headers
    : [];

  // Match complete header text in priority order. This intentionally does
  // not use normalized-header matching because spaces and underscores must
  // remain distinct for the duplicate Farmers language columns.
  for (const expectedHeader of FARMER_PREFERRED_LANGUAGE_HEADERS) {
    const index = sheetHeaders.findIndex(function (header) {
      return String(header || "").trim() === expectedHeader;
    });

    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

function normalizeAiLanguageChoice(value) {
  const normalized =
    String(value || "").trim().toLowerCase();

  if (normalized === "english") {
    return "English";
  }

  if (normalized === "malayalam") {
    return "Malayalam";
  }

  return "";
}

function getFarmerPreferredLanguage(row, headers) {
  const index =
    findFarmerPreferredLanguageColumn(headers);

  if (index < 0) {
    return "";
  }

  // Reads intentionally preserve administrative values such as Bilingual.
  return String((row || [])[index] || "").trim();
}

function resolveFarmerPreferredLanguageWrite(headers, value) {
  const index =
    findFarmerPreferredLanguageColumn(headers);
  const language = normalizeAiLanguageChoice(value);

  if (index < 0 || !language) {
    return null;
  }

  return {
    index,
    value: language
  };
}

function setFarmerPreferredLanguage(row, headers, value) {
  const write =
    resolveFarmerPreferredLanguageWrite(
      headers,
      value
    );

  if (!write) {
    return false;
  }

  while (row.length <= write.index) {
    row.push("");
  }

  row[write.index] = write.value;
  return true;
}

function withPreferredLanguage(data, preferredLanguage) {
  const registrationData = {
    ...(data || {})
  };

  registrationData.preferredLanguage =
    normalizeAiLanguageChoice(
      registrationData.preferredLanguage
    ) || normalizeAiLanguageChoice(preferredLanguage);

  return registrationData;
}

module.exports = {
  FARMER_PREFERRED_LANGUAGE_HEADERS,
  FARMER_HEADER_ALIASES,
  normalizeRegistrationHeader,
  findFarmerPreferredLanguageColumn,
  normalizeAiLanguageChoice,
  getFarmerPreferredLanguage,
  resolveFarmerPreferredLanguageWrite,
  setFarmerPreferredLanguage,
  withPreferredLanguage
};
