"use strict";

const {
  createSenderAuthorizationContext
} = require("./privacySelfService");

const USER_REGISTRATION_STATES = Object.freeze({
  REGISTERED_FARMER: "REGISTERED_FARMER",
  UNREGISTERED: "UNREGISTERED",
  INCOMPLETE: "INCOMPLETE",
  INACTIVE: "INACTIVE",
  REGISTERED_SERVICE_MEMBER: "REGISTERED_SERVICE_MEMBER",
  RESTRICTED_VERIFICATION: "RESTRICTED_VERIFICATION"
});

const CATEGORY_CONFIGS = Object.freeze([
  Object.freeze({
    category: "farmer",
    sheetName: "Farmers",
    idHeaders: ["Farmer_ID", "Farmer ID", "BM_ID", "Member_ID"],
    nameHeaders: ["Name", "Farmer Name", "Full Name"],
    mobileHeaders: ["Mobile", "Mobile_No", "Mobile No", "Mobile Number"],
    whatsappHeaders: ["WhatsApp", "WhatsApp_No", "WhatsApp No", "WhatsApp Number", "WhatApp"],
    registrationStatusHeaders: ["Registration_Status", "Registration Status", "Status"],
    verificationStatusHeaders: ["Verification_Status", "Verification Status", "Verification Level"],
    activeStatusHeaders: ["Active_Status", "Active Status"]
  }),
  Object.freeze({
    category: "expert",
    sheetName: "Expert_Directory",
    idHeaders: ["Expert_ID", "Expert ID"],
    nameHeaders: ["Name", "Expert Name"],
    mobileHeaders: ["Mobile_No", "Mobile No", "Mobile", "Mob No"],
    whatsappHeaders: ["WhatsApp_No", "WhatsApp No", "WhatsApp", "WhatsApp Number"],
    registrationStatusHeaders: ["Status"],
    verificationStatusHeaders: ["Verification_Status", "Verification Status", "Verification Level", "Verified"],
    activeStatusHeaders: ["Active_Status", "Active Status", "Availability"],
    allowBlankActiveStatus: true
  }),
  Object.freeze({
    category: "skilled_worker",
    sheetName: "Skilled Workers",
    idHeaders: ["Worker_ID", "Worker ID"],
    nameHeaders: ["Name", "Worker Name"],
    mobileHeaders: ["Mobile", "Mobile No", "Mob No"],
    whatsappHeaders: ["WhatsApp", "WhatsApp No", "WhatsApp_No", "WhatsApp Number"],
    registrationStatusHeaders: ["Status"],
    verificationStatusHeaders: ["Verification_Status", "Verification Status", "Verification Level", "Verified"],
    activeStatusHeaders: ["Active_Status", "Active Status", "Live Status", "Availability"],
    allowBlankActiveStatus: true
  }),
  Object.freeze({
    category: "service_provider",
    sheetName: "Workforce Providers",
    idHeaders: ["Provider_ID", "Provider ID", "ID"],
    nameHeaders: ["Provider Name", "Contact Person", "Name"],
    mobileHeaders: ["Mob No", "Mobile No", "Mobile"],
    whatsappHeaders: ["WhatsApp No", "WhatsApp_No", "WhatsApp", "WhatsApp Number"],
    registrationStatusHeaders: ["Status"],
    verificationStatusHeaders: ["Verification_Status", "Verification Status", "Verification Level", "Verified"],
    activeStatusHeaders: ["Active_Status", "Active Status", "Availability"],
    allowBlankActiveStatus: true
  })
]);

const ACTIVE_VALUES = new Set([
  "active", "enabled", "current", "available", "yes", "live", "true"
]);
const REGISTERED_VALUES = new Set([
  "registered", "complete", "completed", "approved", "verified", "active"
]);
const VERIFIED_VALUES = new Set([
  "verified", "approved", "yes"
]);
const INACTIVE_VALUES = new Set([
  "inactive", "suspended", "disabled", "blocked", "closed", "deactivated", "deleted", "rejected", "no", "false"
]);

function normalizeHeader(value) {
  return String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function findIndexes(headers, aliases) {
  const wanted = new Set((aliases || []).map(normalizeHeader));
  return (headers || []).map(function (header, index) {
    return wanted.has(normalizeHeader(header)) ? index : -1;
  }).filter(function (index) {
    return index >= 0;
  });
}

function findIndexesByAliasPriority(headers, aliases) {
  const values = Array.isArray(headers) ? headers : [];
  const indexes = [];
  (aliases || []).forEach(function (alias) {
    const wanted = normalizeHeader(alias);
    values.forEach(function (header, index) {
      if (normalizeHeader(header) === wanted && !indexes.includes(index)) {
        indexes.push(index);
      }
    });
  });
  return indexes;
}

function firstValue(row, indexes) {
  for (const index of indexes || []) {
    const value = clean((row || [])[index]);
    if (value) return value;
  }
  return "";
}

function normalizedStatus(value) {
  return clean(value).toLowerCase().replace(/[\s_-]+/g, " ");
}

function statusMatches(value, allowed) {
  const normalized = normalizedStatus(value);
  return allowed.has(normalized);
}

function hasInactiveStatus() {
  return Array.from(arguments).some(function (value) {
    return statusMatches(value, INACTIVE_VALUES);
  });
}

function isFarmerRegistrationEligible(statuses) {
  const values = statuses || {};
  if (hasInactiveStatus(
    values.registrationStatus,
    values.verificationStatus,
    values.activeStatus
  )) {
    return false;
  }

  return (
    statusMatches(values.registrationStatus, REGISTERED_VALUES) &&
    statusMatches(values.activeStatus, ACTIVE_VALUES)
  );
}

function isServiceMemberEligible(statuses) {
  const values = statuses || {};
  if (hasInactiveStatus(
    values.registrationStatus,
    values.verificationStatus,
    values.activeStatus
  )) {
    return false;
  }

  const verified =
    statusMatches(values.verificationStatus, VERIFIED_VALUES) ||
    statusMatches(values.registrationStatus, VERIFIED_VALUES);
  const activeStatus = normalizedStatus(values.activeStatus);
  const operational = activeStatus
    ? ACTIVE_VALUES.has(activeStatus)
    : Boolean(values.allowBlankActiveStatus);

  return verified && operational;
}

function analyzeRegistrationRows(rows, config, senderIdentity) {
  const values = Array.isArray(rows) ? rows : [];
  if (values.length === 0) {
    return { category: config.category, schemaValid: false, code: "HEADER_ROW_MISSING", matches: [] };
  }

  const headers = values[0];
  const indexes = {
    id: findIndexes(headers, config.idHeaders),
    name: findIndexes(headers, config.nameHeaders),
    mobile: findIndexes(headers, config.mobileHeaders),
    whatsapp: findIndexes(headers, config.whatsappHeaders),
    registrationStatus: findIndexesByAliasPriority(headers, config.registrationStatusHeaders),
    verificationStatus: findIndexesByAliasPriority(headers, config.verificationStatusHeaders),
    activeStatus: findIndexesByAliasPriority(headers, config.activeStatusHeaders)
  };
  const missingIdentityHeaders = ["id", "name", "whatsapp"].filter(function (key) {
    return indexes[key].length === 0;
  });

  if (missingIdentityHeaders.length > 0) {
    return {
      category: config.category,
      schemaValid: false,
      code: "IDENTITY_HEADERS_MISSING",
      missingIdentityHeaders,
      matches: []
    };
  }

  const exactMatches = [];
  const mobileOnlyMatches = [];

  values.slice(1).forEach(function (row, offset) {
    const whatsappValues = indexes.whatsapp.map(function (index) {
      return createSenderAuthorizationContext(row[index]).whatsapp;
    }).filter(Boolean);
    const mobileValues = indexes.mobile.map(function (index) {
      return createSenderAuthorizationContext(row[index]).whatsapp;
    }).filter(Boolean);
    const whatsappMatch = whatsappValues.includes(senderIdentity);
    const mobileMatch = mobileValues.includes(senderIdentity);

    if (!whatsappMatch && !mobileMatch) return;

    const id = firstValue(row, indexes.id);
    const name = firstValue(row, indexes.name);
    const registrationStatus = firstValue(row, indexes.registrationStatus);
    const verificationStatus = firstValue(row, indexes.verificationStatus);
    const activeStatus = firstValue(row, indexes.activeStatus);
    const explicitlyInactive = hasInactiveStatus(
      registrationStatus,
      verificationStatus,
      activeStatus
    );
    let complete = false;

    if (!explicitlyInactive && id && name && whatsappMatch) {
      if (config.category === "farmer") {
        complete = isFarmerRegistrationEligible({
          registrationStatus,
          verificationStatus,
          activeStatus
        });
      } else {
        complete = isServiceMemberEligible({
          registrationStatus,
          verificationStatus,
          activeStatus,
          allowBlankActiveStatus: config.allowBlankActiveStatus
        });
      }
    }

    const record = {
      category: config.category,
      sheetName: config.sheetName,
      rowNumber: offset + 2,
      id,
      name,
      whatsapp: firstValue(row, indexes.whatsapp),
      registrationStatus,
      verificationStatus,
      activeStatus,
      exactWhatsappMatch: whatsappMatch,
      mobileOnlyMatch: !whatsappMatch && mobileMatch,
      explicitlyInactive,
      complete
    };

    if (whatsappMatch) exactMatches.push(record);
    else mobileOnlyMatches.push(record);
  });

  return {
    category: config.category,
    schemaValid: true,
    matches: exactMatches,
    mobileOnlyMatches
  };
}

async function resolveUserRegistrationStatus(options) {
  const input = options || {};
  const sender = createSenderAuthorizationContext(input.sender);
  if (!sender.valid) {
    return {
      state: USER_REGISTRATION_STATES.RESTRICTED_VERIFICATION,
      reason: "INVALID_WHATSAPP_SENDER",
      roles: [],
      canAccessPersonalRecords: false
    };
  }

  const configs = Array.isArray(input.categories) ? input.categories : CATEGORY_CONFIGS;
  const readRows = input.readSheetRows;
  if (typeof readRows !== "function") {
    throw new Error("readSheetRows is required");
  }

  const settled = await Promise.allSettled(configs.map(async function (config) {
    const rows = await readRows(config.sheetName, "A:BK");
    return analyzeRegistrationRows(rows, config, sender.whatsapp);
  }));
  const analyses = settled.filter(function (result) {
    return result.status === "fulfilled";
  }).map(function (result) {
    return result.value;
  });
  const failedCategories = settled.map(function (result, index) {
    return result.status === "rejected" ? configs[index].category : "";
  }).filter(Boolean);

  const farmerAnalysis = analyses.find(function (analysis) {
    return analysis.category === "farmer";
  });
  if (!farmerAnalysis || !farmerAnalysis.schemaValid) {
    return {
      state: USER_REGISTRATION_STATES.RESTRICTED_VERIFICATION,
      reason: failedCategories.includes("farmer") ? "FARMER_LOOKUP_FAILED" : "FARMER_SCHEMA_INVALID",
      roles: [],
      canAccessPersonalRecords: false
    };
  }

  const ambiguous = analyses.find(function (analysis) {
    return (
      analysis.matches.length +
      (analysis.mobileOnlyMatches || []).length
    ) > 1;
  });
  if (ambiguous) {
    return {
      state: USER_REGISTRATION_STATES.RESTRICTED_VERIFICATION,
      reason: "DUPLICATE_IDENTITY_MATCH",
      category: ambiguous.category,
      matchCount:
        ambiguous.matches.length +
        (ambiguous.mobileOnlyMatches || []).length,
      roles: [],
      canAccessPersonalRecords: false
    };
  }

  const exactRecords = analyses.flatMap(function (analysis) {
    return analysis.matches;
  });
  const mobileOnlyRecords = analyses.flatMap(function (analysis) {
    return analysis.mobileOnlyMatches || [];
  });
  const completeRecords = exactRecords.filter(function (record) {
    return record.complete;
  });
  const farmer = completeRecords.find(function (record) {
    return record.category === "farmer";
  });
  const serviceRecords = completeRecords.filter(function (record) {
    return record.category !== "farmer";
  });
  const roles = completeRecords.map(function (record) {
    return record.category;
  });

  if (farmer) {
    return {
      state: USER_REGISTRATION_STATES.REGISTERED_FARMER,
      reason: "UNIQUE_COMPLETE_ACTIVE_FARMER",
      farmer,
      memberships: exactRecords,
      roles,
      senderIdentity: sender.whatsapp,
      canAccessPersonalRecords: true
    };
  }

  if (serviceRecords.length > 0) {
    return {
      state: USER_REGISTRATION_STATES.REGISTERED_SERVICE_MEMBER,
      reason: "UNIQUE_COMPLETE_ACTIVE_SERVICE_MEMBER",
      serviceMemberships: serviceRecords,
      memberships: exactRecords,
      roles,
      senderIdentity: sender.whatsapp,
      canAccessPersonalRecords: false
    };
  }

  if (exactRecords.some(function (record) { return record.explicitlyInactive; })) {
    return {
      state: USER_REGISTRATION_STATES.INACTIVE,
      reason: "INACTIVE_REGISTRATION",
      memberships: exactRecords,
      roles: [],
      canAccessPersonalRecords: false
    };
  }

  if (exactRecords.length > 0 || mobileOnlyRecords.length > 0 || input.hasRegistrationSession) {
    return {
      state: USER_REGISTRATION_STATES.INCOMPLETE,
      reason: mobileOnlyRecords.length > 0 && exactRecords.length === 0
        ? "WHATSAPP_IDENTITY_NOT_VERIFIED"
        : "INCOMPLETE_REGISTRATION",
      memberships: exactRecords,
      roles: [],
      canAccessPersonalRecords: false
    };
  }

  if (failedCategories.length > 0 || analyses.some(function (analysis) { return !analysis.schemaValid; })) {
    return {
      state: USER_REGISTRATION_STATES.RESTRICTED_VERIFICATION,
      reason: "MEMBERSHIP_LOOKUP_INCOMPLETE",
      failedCategories,
      roles: [],
      canAccessPersonalRecords: false
    };
  }

  return {
    state: USER_REGISTRATION_STATES.UNREGISTERED,
    reason: "NO_REGISTRATION_MATCH",
    roles: [],
    senderIdentity: sender.whatsapp,
    canAccessPersonalRecords: false
  };
}

function validateRegistrationIdentityHeaders(headers, config) {
  const values = Array.isArray(headers) ? headers : [];
  const required = {
    id: config && config.idHeaders,
    name: config && config.nameHeaders,
    whatsapp: config && config.whatsappHeaders
  };
  const missing = Object.keys(required).filter(function (key) {
    return findIndexes(values, required[key]).length === 0;
  });

  if (config && config.category === "farmer") {
    if (findIndexes(values, config.registrationStatusHeaders).length === 0) missing.push("registrationStatus");
    if (findIndexes(values, config.activeStatusHeaders).length === 0) missing.push("activeStatus");
  }

  return {
    valid: missing.length === 0,
    missing
  };
}

const GUEST_ACTION_IDS = new Set([
  "HOME_ASK", "HOME_MARKET", "ASK_MENU", "MARKET_MENU", "GUEST_EXPLORE",
  "SERVICE_1", "SERVICE_2", "SERVICE_3", "SERVICE_4", "SERVICE_5", "SERVICE_11",
  "PROFILE_HELP", "PROFILE_ABOUT", "PROFILE_TERMS_PRIVACY", "PRIVACY_READ_POLICY",
  "CHANGE_LANGUAGE", "LANG_ENGLISH", "LANG_MALAYALAM", "NAV_HOME", "MAIN_MENU"
]);

function isGuestAllowedAction(selectionId) {
  const id = clean(selectionId);
  return Boolean(
    GUEST_ACTION_IDS.has(id) ||
    id.startsWith("ABOUT_") ||
    id.startsWith("GUIDE_") ||
    id.startsWith("USER_GUIDE_")
  );
}

function isLimitedAccessState(status) {
  const state = status && status.state;
  return ![
    USER_REGISTRATION_STATES.REGISTERED_FARMER,
    USER_REGISTRATION_STATES.REGISTERED_SERVICE_MEMBER
  ].includes(state);
}

function formatRestrictedAccess(status, language) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  const state = status && status.state;
  const messages = {
    INCOMPLETE: [
      "Your BhoomiMitra registration is incomplete or its WhatsApp identity could not be verified. Personal and registration-dependent services remain restricted. Choose Membership to register or resume, Help for guidance, or Back/Main Menu. Contact the KVK team if verification is required.",
      "നിങ്ങളുടെ BhoomiMitra രജിസ്ട്രേഷൻ അപൂർണ്ണമാണ് അല്ലെങ്കിൽ WhatsApp തിരിച്ചറിയൽ സ്ഥിരീകരിക്കാനായില്ല. വ്യക്തിഗതവും രജിസ്ട്രേഷൻ ആവശ്യമായതുമായ സേവനങ്ങൾ നിയന്ത്രിച്ചിരിക്കുന്നു. തുടരാൻ അംഗത്വം തിരഞ്ഞെടുക്കുക അല്ലെങ്കിൽ പരിശോധനയ്ക്കായി KVK ടീമുമായി ബന്ധപ്പെടുക."
    ],
    INACTIVE: [
      "Your BhoomiMitra registration is inactive. Personal and registration-dependent services remain restricted. Choose Help for guidance or Back/Main Menu, and contact the KVK team for verification.",
      "നിങ്ങളുടെ BhoomiMitra രജിസ്ട്രേഷൻ സജീവമല്ല. വ്യക്തിഗതവും രജിസ്ട്രേഷൻ ആവശ്യമായതുമായ സേവനങ്ങൾ നിയന്ത്രിച്ചിരിക്കുന്നു. പരിശോധനയ്ക്കായി KVK ടീമുമായി ബന്ധപ്പെടുക."
    ],
    RESTRICTED_VERIFICATION: [
      "This WhatsApp identity needs manual verification because the registration lookup is ambiguous or unavailable. No personal record has been shown and no registration record was changed. Choose Help for guidance or Back/Main Menu, and contact the KVK team.",
      "രജിസ്ട്രേഷൻ കണ്ടെത്തൽ വ്യക്തതയില്ലാത്തതിനാലോ ലഭ്യമല്ലാത്തതിനാലോ ഈ WhatsApp തിരിച്ചറിയലിന് കൈമാറ്റ പരിശോധന ആവശ്യമാണ്. വ്യക്തിഗത രേഖകളൊന്നും കാണിച്ചിട്ടില്ല; രജിസ്ട്രേഷൻ രേഖകളൊന്നും മാറ്റിയിട്ടില്ല."
    ],
    UNREGISTERED: [
      "Welcome to BhoomiMitra. You can use general agricultural information, choose Membership to register, Help for guidance, or Back/Main Menu.",
      "BhoomiMitraയിലേക്ക് സ്വാഗതം. പരിമിതമായ പൊതുവായ കാർഷിക വിവരങ്ങൾ ഉപയോഗിക്കാം അല്ലെങ്കിൽ രജിസ്റ്റർ ചെയ്യാൻ അംഗത്വം തിരഞ്ഞെടുക്കാം."
    ]
  };
  const selected = messages[state] || messages.RESTRICTED_VERIFICATION;
  return ml ? selected[1] : selected[0];
}

module.exports = {
  USER_REGISTRATION_STATES,
  CATEGORY_CONFIGS,
  analyzeRegistrationRows,
  resolveUserRegistrationStatus,
  validateRegistrationIdentityHeaders,
  isFarmerRegistrationEligible,
  isServiceMemberEligible,
  isGuestAllowedAction,
  isLimitedAccessState,
  formatRestrictedAccess
};
