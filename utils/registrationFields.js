"use strict";

const FARMER_PREFERRED_LANGUAGE_HEADERS = Object.freeze([
  "Preferred_Language",
  "Preferred Language",
  "Prefered Language"
]);

const FARMER_REGISTRATION_STATUS_HEADERS = Object.freeze([
  "Registration_Status",
  "Registration Status",
  "Status"
]);

const FARMER_VERIFICATION_STATUS_HEADERS = Object.freeze([
  "Verification_Status",
  "Verification Status",
  "Verification Level"
]);

const FARMER_ACTIVE_STATUS_HEADERS = Object.freeze([
  "Active_Status",
  "Active Status"
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
  registrationStatusHeaders:
    FARMER_REGISTRATION_STATUS_HEADERS,
  verificationStatusHeaders:
    FARMER_VERIFICATION_STATUS_HEADERS,
  activeStatusHeaders:
    FARMER_ACTIVE_STATUS_HEADERS,
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

function findExactAliasedColumn(headers, aliases) {
  const sheetHeaders = Array.isArray(headers)
    ? headers
    : [];

  for (const alias of aliases || []) {
    const index = sheetHeaders.findIndex(function (header) {
      return String(header || "").trim() === alias;
    });

    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

function getExactAliasedValue(row, headers, aliases) {
  const index = findExactAliasedColumn(headers, aliases);

  if (index < 0) {
    return "";
  }

  return String((row || [])[index] || "").trim();
}

function setExactAliasedValue(row, headers, aliases, value) {
  const index = findExactAliasedColumn(headers, aliases);

  if (index < 0) {
    return false;
  }

  while (row.length <= index) {
    row.push("");
  }

  row[index] = value;
  return true;
}

function setExactAliasedValueIfBlank(
  row,
  headers,
  aliases,
  value
) {
  const index = findExactAliasedColumn(headers, aliases);

  if (index < 0) {
    return false;
  }

  if (String(row[index] || "").trim()) {
    return false;
  }

  return setExactAliasedValue(
    row,
    headers,
    aliases,
    value
  );
}

function applyNewFarmerStatuses(row, headers) {
  setExactAliasedValueIfBlank(
    row,
    headers,
    FARMER_REGISTRATION_STATUS_HEADERS,
    "Registered"
  );
  setExactAliasedValueIfBlank(
    row,
    headers,
    FARMER_VERIFICATION_STATUS_HEADERS,
    "Pending"
  );
  setExactAliasedValueIfBlank(
    row,
    headers,
    FARMER_ACTIVE_STATUS_HEADERS,
    "Active"
  );

  return row;
}

function readFarmerStatuses(row, headers, farmerId) {
  const storedRegistrationStatus = getExactAliasedValue(
    row,
    headers,
    FARMER_REGISTRATION_STATUS_HEADERS
  );
  const verificationStatus = getExactAliasedValue(
    row,
    headers,
    FARMER_VERIFICATION_STATUS_HEADERS
  );
  const activeStatus = getExactAliasedValue(
    row,
    headers,
    FARMER_ACTIVE_STATUS_HEADERS
  );
  const legacyStatus = getExactAliasedValue(
    row,
    headers,
    ["Status"]
  );
  const hasFarmerId = Boolean(String(farmerId || "").trim());
  const legacyVerification =
    legacyStatus &&
    legacyStatus.toLowerCase() !== "registered"
      ? legacyStatus
      : "";

  return {
    registrationStatus:
      storedRegistrationStatus ||
      (hasFarmerId ? "Registered" : ""),
    verificationStatus:
      verificationStatus ||
      legacyVerification ||
      "Pending",
    activeStatus
  };
}

function meaningfulFarmerCrop(value) {
  const crop = String(value || "").trim();
  const normalized = crop.toLowerCase();
  const placeholders = new Set([
    "whatsapp",
    "whatsapp registration",
    "ai registration",
    "bhoomimitra registration",
    "registration source",
    "not applicable",
    "n/a",
    "na",
    "-"
  ]);

  if (!crop || placeholders.has(normalized)) {
    return "";
  }

  if (
    (
      normalized.includes("registration") ||
      normalized.includes("registered") ||
      normalized.includes("source")
    ) &&
    (
      normalized.includes("whatsapp") ||
      normalized.includes("bhoomimitra") ||
      normalized.includes(" ai") ||
      normalized.startsWith("ai ")
    )
  ) {
    return "";
  }

  return crop;
}

function formatRegistrationServiceLine(
  category,
  value,
  language
) {
  if (category === "farmer") {
    const crop = meaningfulFarmerCrop(value);

    if (!crop) {
      return "";
    }

    return language === "Malayalam"
      ? "\nപ്രധാന വിള: " + crop
      : "\nMain Crop: " + crop;
  }

  const service = String(value || "").trim();

  return service
    ? "\nExpertise/Skill/Service: " + service
    : "";
}

function localizeFarmerStatus(value, language, type) {
  if (language !== "Malayalam") {
    return value;
  }

  const normalized = String(value || "").trim().toLowerCase();

  if (type === "registration" && normalized === "registered") {
    return "രജിസ്റ്റർ ചെയ്തു";
  }

  if (type === "verification" && normalized === "pending") {
    return "കാത്തിരിക്കുന്നു";
  }

  if (
    type === "verification" &&
    ["approved", "verified"].includes(normalized)
  ) {
    return "അംഗീകരിച്ചു";
  }

  return value;
}

function formatFarmerRegistrationConfirmation(options) {
  const result = options.result || {};
  const language = options.language === "Malayalam"
    ? "Malayalam"
    : "English";
  const existing = Boolean(options.existing);
  const crop = meaningfulFarmerCrop(
    result.crop || result.service
  );
  const phone =
    result.whatsapp ||
    result.mobile ||
    options.fallbackPhone ||
    "-";
  const registrationStatus =
    result.registrationStatus ||
    (result.memberId ? "Registered" : "");
  const verificationStatus =
    result.verificationStatus || "Pending";

  if (language === "Malayalam") {
    const lines = [
      existing
        ? "✅ നിങ്ങൾ ഇതിനകം BhoomiMitraയിൽ കർഷകനായി രജിസ്റ്റർ ചെയ്തിട്ടുണ്ട്."
        : "✅ BhoomiMitra കർഷക രജിസ്ട്രേഷൻ വിജയകരമായി പൂർത്തിയായി.",
      "",
      "കർഷക ഐഡി: " + (result.memberId || "-"),
      "പേര്: " + (result.name || "-"),
      "മൊബൈൽ/WhatsApp: " + phone,
      "ജില്ല: " + (result.district || "-"),
      "പഞ്ചായത്ത്: " + (result.panchayath || "-")
    ];

    if (crop) {
      lines.push("പ്രധാന വിള: " + crop);
    }

    lines.push(
      "രജിസ്ട്രേഷൻ നില: " +
        localizeFarmerStatus(
          registrationStatus,
          language,
          "registration"
        ),
      "പരിശോധന: " +
        localizeFarmerStatus(
          verificationStatus,
          language,
          "verification"
        )
    );

    if (existing) {
      lines.push(
        "",
        "വീണ്ടും അതേ വിഭാഗത്തിൽ രജിസ്റ്റർ ചെയ്യേണ്ടതില്ല."
      );
    }

    return lines.join("\n");
  }

  const lines = [
    existing
      ? "✅ You are already registered in BhoomiMitra as a Farmer."
      : "✅ Farmer registration completed successfully.",
    "",
    "Farmer ID: " + (result.memberId || "-"),
    "Name: " + (result.name || "-"),
    "Mobile/WhatsApp: " + phone,
    "District: " + (result.district || "-"),
    "Panchayath: " + (result.panchayath || "-")
  ];

  if (crop) {
    lines.push("Main Crop: " + crop);
  }

  lines.push(
    "Registration Status: " + registrationStatus,
    "Verification: " + verificationStatus
  );

  if (existing) {
    lines.push(
      "",
      "You do not need to register again in the same category."
    );
  }

  return lines.join("\n");
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
  FARMER_REGISTRATION_STATUS_HEADERS,
  FARMER_VERIFICATION_STATUS_HEADERS,
  FARMER_ACTIVE_STATUS_HEADERS,
  FARMER_HEADER_ALIASES,
  normalizeRegistrationHeader,
  findExactAliasedColumn,
  applyNewFarmerStatuses,
  readFarmerStatuses,
  meaningfulFarmerCrop,
  formatRegistrationServiceLine,
  formatFarmerRegistrationConfirmation,
  findFarmerPreferredLanguageColumn,
  normalizeAiLanguageChoice,
  getFarmerPreferredLanguage,
  resolveFarmerPreferredLanguageWrite,
  setFarmerPreferredLanguage,
  withPreferredLanguage
};
