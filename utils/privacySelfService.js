"use strict";

const {
  normalizePreferredLanguage
} = require("./language");
const {
  normalizeWhatsapp,
  PRIVACY_POLICY_VERSION
} = require("./privacy");

const PRIVACY_TEXT_IS_DRAFT = true;
const DRAFT_PRIVACY_POLICY_VERSION =
  PRIVACY_POLICY_VERSION;

const CONSENT_ACTIONS = Object.freeze({
  AGREE: "AGREE",
  DECLINE: "DECLINE",
  POLICY: "POLICY"
});

const CONSENT_STATUSES = Object.freeze({
  AGREED: "AGREED",
  DECLINED: "DECLINED",
  WITHDRAWN: "WITHDRAWN",
  UNKNOWN: "UNKNOWN"
});

const MY_DATA_ACTIONS = Object.freeze({
  VIEW: "MY_DATA_VIEW",
  CORRECT: "MY_DATA_CORRECT",
  PRIVACY: "MY_DATA_PRIVACY",
  WITHDRAW: "MY_DATA_WITHDRAW",
  BACK: "MY_DATA_BACK"
});

const EDITABLE_PROFILE_FIELDS = Object.freeze({
  name: Object.freeze({
    id: "PROFILE_EDIT_NAME",
    maxLength: 100
  }),
  district: Object.freeze({
    id: "PROFILE_EDIT_DISTRICT",
    maxLength: 60
  }),
  localBody: Object.freeze({
    id: "PROFILE_EDIT_LOCAL_BODY",
    maxLength: 100
  }),
  preferredLanguage: Object.freeze({
    id: "PROFILE_EDIT_LANGUAGE",
    maxLength: 30
  }),
  mainCrop: Object.freeze({
    id: "PROFILE_EDIT_MAIN_CROP",
    maxLength: 120
  })
});

const FIELD_ALIASES = Object.freeze({
  name: "name",
  "profile_edit_name": "name",
  district: "district",
  "profile_edit_district": "district",
  panchayat: "localBody",
  panchayath: "localBody",
  "panchayat/local body": "localBody",
  "panchayat / local body": "localBody",
  "local body": "localBody",
  "local_body": "localBody",
  "profile_edit_local_body": "localBody",
  language: "preferredLanguage",
  "preferred language": "preferredLanguage",
  "preferred_language": "preferredLanguage",
  "profile_edit_language": "preferredLanguage",
  crop: "mainCrop",
  "main crop": "mainCrop",
  "main_crop": "mainCrop",
  "profile_edit_main_crop": "mainCrop"
});

const RESTRICTED_PROFILE_FIELDS = new Set([
  "farmer id",
  "farmer_id",
  "farmerid",
  "bm id",
  "bm_id",
  "mobile",
  "mobile number",
  "mobile_number",
  "phone",
  "phone number",
  "whatsapp",
  "whatsapp number",
  "whatsapp_number",
  "verification status",
  "verification_status",
  "registration status",
  "registration_status",
  "active status",
  "active_status",
  "status",
  "remarks",
  "internal remarks",
  "internal_remarks",
  "expert",
  "expert assigned",
  "expert_assigned",
  "admin",
  "admin notes",
  "admin_notes",
  "row",
  "row number",
  "row_number"
]);

function normalizeCommand(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function resolveLanguage(value) {
  return normalizePreferredLanguage(value) || "Malayalam";
}

function localize(english, malayalam, language) {
  const resolved = resolveLanguage(language);

  if (resolved === "English") {
    return english;
  }

  if (resolved === "Bilingual") {
    return english + "\n\n" + malayalam;
  }

  return malayalam;
}

function formatShortConsentSummary(language) {
  const english = [
    "🔐 BhoomiMitra Privacy & Consent",
    "",
    "BhoomiMitra uses your name, phone number and farming information to provide farming advice, weather, market, services and expert help.",
    "",
    "Your private information will not be shared unnecessarily. You can view or correct your information and withdraw consent at any time."
  ].join("\n");

  const malayalam = [
    "🔐 ഭൂമിമിത്ര സ്വകാര്യതയും സമ്മതവും",
    "",
    "കൃഷി ഉപദേശം, കാലാവസ്ഥ, വിപണി, സേവനങ്ങൾ, വിദഗ്ധ സഹായം എന്നിവ നൽകാൻ ഭൂമിമിത്ര നിങ്ങളുടെ പേര്, ഫോൺ നമ്പർ, കൃഷി വിവരങ്ങൾ എന്നിവ ഉപയോഗിക്കും.",
    "",
    "ആവശ്യമില്ലാതെ നിങ്ങളുടെ സ്വകാര്യ വിവരങ്ങൾ പങ്കിടില്ല. നിങ്ങളുടെ വിവരങ്ങൾ കാണാനും തിരുത്താനും എപ്പോൾ വേണമെങ്കിലും സമ്മതം പിൻവലിക്കാനും കഴിയും."
  ].join("\n");

  return localize(english, malayalam, language);
}

function formatPrivacyPolicy(language) {
  const english = [
    "📄 BhoomiMitra Privacy Policy",
    "",
    "1. What information BhoomiMitra collects",
    "Your name, phone number, preferred language and farming information. When you use related services, this may also include land, crop, animal, GPS, photo, voice or question details that you provide.",
    "",
    "2. Why it is used",
    "To provide registration, farming advice, weather and market information, farm services, expert help, security and service support.",
    "",
    "3. Who may see it",
    "Only authorized BhoomiMitra team members and service providers or experts who need the information for a service you request. Private information will not be shared unnecessarily.",
    "",
    "4. Farmer rights",
    "You can view your information, request corrections and withdraw consent. Withdrawal may limit personalized services, but it does not automatically delete historical records that must be retained.",
    "",
    "5. Important note",
    "AI, weather, satellite and market information are supporting indicators. They may be incomplete or delayed, so important decisions should also use field observation or qualified expert advice."
  ].join("\n");

  const malayalam = [
    "📄 ഭൂമിമിത്ര സ്വകാര്യതാ നയം",
    "",
    "1. ഭൂമിമിത്ര ശേഖരിക്കുന്ന വിവരങ്ങൾ",
    "നിങ്ങളുടെ പേര്, ഫോൺ നമ്പർ, ഇഷ്ടഭാഷ, കൃഷി വിവരങ്ങൾ എന്നിവ. ബന്ധപ്പെട്ട സേവനങ്ങൾ ഉപയോഗിക്കുമ്പോൾ നിങ്ങൾ നൽകുന്ന ഭൂമി, വിള, മൃഗം, GPS, ചിത്രം, ശബ്ദം, ചോദ്യം എന്നിവയുടെ വിവരങ്ങളും ഉൾപ്പെടാം.",
    "",
    "2. വിവരങ്ങൾ ഉപയോഗിക്കുന്നതിന്റെ കാരണം",
    "രജിസ്ട്രേഷൻ, കൃഷി ഉപദേശം, കാലാവസ്ഥയും വിപണിയും സംബന്ധിച്ച വിവരം, കാർഷിക സേവനങ്ങൾ, വിദഗ്ധ സഹായം, സുരക്ഷ, സേവന സഹായം എന്നിവ നൽകാൻ.",
    "",
    "3. വിവരങ്ങൾ ആരെല്ലാം കാണാം",
    "നിങ്ങൾ ആവശ്യപ്പെടുന്ന സേവനത്തിന് വിവരം ആവശ്യമുള്ള അംഗീകൃത ഭൂമിമിത്ര പ്രവർത്തകർ, സേവനദാതാക്കൾ അല്ലെങ്കിൽ വിദഗ്ധർ മാത്രം. സ്വകാര്യ വിവരങ്ങൾ ആവശ്യമില്ലാതെ പങ്കിടില്ല.",
    "",
    "4. കർഷകന്റെ അവകാശങ്ങൾ",
    "നിങ്ങളുടെ വിവരങ്ങൾ കാണാനും തിരുത്തൽ ആവശ്യപ്പെടാനും സമ്മതം പിൻവലിക്കാനും കഴിയും. സമ്മതം പിൻവലിച്ചാൽ വ്യക്തിഗത സേവനങ്ങൾ പരിമിതമായേക്കാം; എന്നാൽ സൂക്ഷിക്കേണ്ട പഴയ രേഖകൾ സ്വയമേവ ഇല്ലാതാകില്ല.",
    "",
    "5. പ്രധാന കുറിപ്പ്",
    "AI, കാലാവസ്ഥ, സാറ്റലൈറ്റ്, വിപണി വിവരങ്ങൾ സഹായ സൂചികകൾ മാത്രമാണ്. അവ അപൂർണ്ണമോ വൈകിയതോ ആയേക്കാം; പ്രധാന തീരുമാനങ്ങൾക്ക് വയൽ പരിശോധനയോ യോഗ്യനായ വിദഗ്ധന്റെ ഉപദേശമോ കൂടി ഉപയോഗിക്കുക."
  ].join("\n");

  return localize(english, malayalam, language);
}

function getChoiceValue(input) {
  if (input && typeof input === "object") {
    return input.id || input.title || input.text || "";
  }

  return input;
}

function interpretConsentChoice(input) {
  const choice = normalizeCommand(
    getChoiceValue(input)
  );

  const agree = new Set([
    "consent_agree",
    "agree",
    "yes",
    "i agree",
    "i accept",
    "accept",
    "ഞാൻ അംഗീകരിക്കുന്നു",
    "അംഗീകരിക്കുന്നു",
    "സമ്മതിക്കുന്നു"
  ]);
  const decline = new Set([
    "consent_decline",
    "decline",
    "no",
    "i decline",
    "i do not agree",
    "do not agree",
    "i do not accept",
    "do not accept",
    "ഞാൻ അംഗീകരിക്കുന്നില്ല",
    "അംഗീകരിക്കുന്നില്ല",
    "സമ്മതിക്കുന്നില്ല"
  ]);
  const policy = new Set([
    "consent_policy",
    "policy",
    "privacy policy",
    "സ്വകാര്യതാ നയം"
  ]);

  if (agree.has(choice)) {
    return CONSENT_ACTIONS.AGREE;
  }

  if (decline.has(choice)) {
    return CONSENT_ACTIONS.DECLINE;
  }

  if (policy.has(choice)) {
    return CONSENT_ACTIONS.POLICY;
  }

  return "";
}

function interpretConsentStatus(value, language) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  const status = Object.prototype.hasOwnProperty.call(
    CONSENT_STATUSES,
    normalized
  )
    ? CONSENT_STATUSES[normalized]
    : CONSENT_STATUSES.UNKNOWN;
  const labels = {
    AGREED: ["Consent given", "സമ്മതം നൽകിയിട്ടുണ്ട്"],
    DECLINED: ["Consent not given", "സമ്മതം നൽകിയിട്ടില്ല"],
    WITHDRAWN: ["Consent withdrawn", "സമ്മതം പിൻവലിച്ചു"],
    UNKNOWN: ["Consent status not available", "സമ്മത നില ലഭ്യമല്ല"]
  };
  const selectedLabels = labels[status];

  return {
    status,
    hasDecision: status !== CONSENT_STATUSES.UNKNOWN,
    hasActiveConsent: status === CONSENT_STATUSES.AGREED,
    isDeclined: status === CONSENT_STATUSES.DECLINED,
    isWithdrawn: status === CONSENT_STATUSES.WITHDRAWN,
    label: localize(
      selectedLabels[0],
      selectedLabels[1],
      language
    )
  };
}

function formatWithdrawalInformation(language) {
  const english = [
    "↩️ Withdraw Consent",
    "",
    "If you withdraw consent, personalized BhoomiMitra services may become limited.",
    "Your consent history will be preserved. Withdrawing consent does not automatically delete historical records."
  ].join("\n");
  const malayalam = [
    "↩️ സമ്മതം പിൻവലിക്കുക",
    "",
    "സമ്മതം പിൻവലിച്ചാൽ ഭൂമിമിത്രയുടെ വ്യക്തിഗത സേവനങ്ങൾ പരിമിതമായേക്കാം.",
    "നിങ്ങളുടെ സമ്മത ചരിത്രം സൂക്ഷിക്കും. സമ്മതം പിൻവലിക്കുന്നത് പഴയ രേഖകൾ സ്വയമേവ ഇല്ലാതാക്കില്ല."
  ].join("\n");

  return localize(english, malayalam, language);
}

function getMyDataMenuOptions(language) {
  return [
    {
      id: MY_DATA_ACTIONS.VIEW,
      title: localize(
        "📄 View My Information",
        "📄 എന്റെ വിവരങ്ങൾ കാണുക",
        language
      )
    },
    {
      id: MY_DATA_ACTIONS.CORRECT,
      title: localize(
        "✏️ Correct My Information",
        "✏️ വിവരങ്ങൾ തിരുത്തുക",
        language
      )
    },
    {
      id: MY_DATA_ACTIONS.PRIVACY,
      title: localize(
        "🔒 Privacy & Consent",
        "🔒 സ്വകാര്യതയും സമ്മതവും",
        language
      )
    },
    {
      id: MY_DATA_ACTIONS.WITHDRAW,
      title: localize(
        "↩️ Withdraw Consent",
        "↩️ സമ്മതം പിൻവലിക്കുക",
        language
      )
    },
    {
      id: MY_DATA_ACTIONS.BACK,
      title: localize(
        "⬅️ Back",
        "⬅️ പിന്നോട്ട്",
        language
      )
    }
  ];
}

function interpretMyDataAction(input) {
  const action = normalizeCommand(
    getChoiceValue(input)
  );
  const mappings = new Map([
    ["my_data_view", MY_DATA_ACTIONS.VIEW],
    ["view my information", MY_DATA_ACTIONS.VIEW],
    ["show my information", MY_DATA_ACTIONS.VIEW],
    ["എന്റെ വിവരങ്ങൾ കാണിക്കുക", MY_DATA_ACTIONS.VIEW],
    ["എന്റെ വിവരങ്ങൾ കാണുക", MY_DATA_ACTIONS.VIEW],
    ["my_data_correct", MY_DATA_ACTIONS.CORRECT],
    ["correct my information", MY_DATA_ACTIONS.CORRECT],
    ["update my information", MY_DATA_ACTIONS.CORRECT],
    ["change my language", MY_DATA_ACTIONS.CORRECT],
    ["change my district", MY_DATA_ACTIONS.CORRECT],
    ["എന്റെ വിവരങ്ങൾ തിരുത്തണം", MY_DATA_ACTIONS.CORRECT],
    ["വിവരങ്ങൾ തിരുത്തുക", MY_DATA_ACTIONS.CORRECT],
    ["എന്റെ ഭാഷ മാറ്റണം", MY_DATA_ACTIONS.CORRECT],
    ["എന്റെ ജില്ല തിരുത്തണം", MY_DATA_ACTIONS.CORRECT],
    ["my_data_privacy", MY_DATA_ACTIONS.PRIVACY],
    ["privacy & consent", MY_DATA_ACTIONS.PRIVACY],
    ["privacy policy", MY_DATA_ACTIONS.PRIVACY],
    ["സ്വകാര്യതാ നയം", MY_DATA_ACTIONS.PRIVACY],
    ["my_data_withdraw", MY_DATA_ACTIONS.WITHDRAW],
    ["withdraw consent", MY_DATA_ACTIONS.WITHDRAW],
    ["withdraw my consent", MY_DATA_ACTIONS.WITHDRAW],
    ["എന്റെ സമ്മതം പിൻവലിക്കണം", MY_DATA_ACTIONS.WITHDRAW],
    ["സമ്മതം പിൻവലിക്കുക", MY_DATA_ACTIONS.WITHDRAW],
    ["my_data_back", MY_DATA_ACTIONS.BACK],
    ["back", MY_DATA_ACTIONS.BACK],
    ["പിന്നോട്ട്", MY_DATA_ACTIONS.BACK]
  ]);

  return mappings.get(action) || "";
}

function isWithdrawalIntent(input) {
  const value = normalizeCommand(
    getChoiceValue(input)
  );

  return interpretMyDataAction(input) === MY_DATA_ACTIONS.WITHDRAW ||
    [
      "consent_withdraw_confirm",
      "withdraw",
      "പിൻവലിക്കുക"
    ].includes(value);
}

function normalizeFieldName(value) {
  return normalizeCommand(value)
    .replace(/-/g, "_");
}

function classifyProfileField(value) {
  const normalized = normalizeFieldName(value);
  const editable = FIELD_ALIASES[normalized];

  if (editable) {
    return {
      allowed: true,
      field: editable,
      reason: ""
    };
  }

  if (RESTRICTED_PROFILE_FIELDS.has(normalized)) {
    return {
      allowed: false,
      field: "",
      reason: "RESTRICTED_FIELD"
    };
  }

  return {
    allowed: false,
    field: "",
    reason: "UNKNOWN_FIELD"
  };
}

function isSpreadsheetFormulaInput(value) {
  return /^[\s\u200B-\u200D\uFEFF]*[=+\-@]/.test(
    String(value || "").normalize("NFKC")
  );
}

function validateProfileCorrection(fieldInput, value) {
  const classification = classifyProfileField(fieldInput);

  if (!classification.allowed) {
    return {
      valid: false,
      field: "",
      value: "",
      error: classification.reason
    };
  }

  if (typeof value !== "string") {
    return {
      valid: false,
      field: classification.field,
      value: "",
      error: "INVALID_VALUE"
    };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return {
      valid: false,
      field: classification.field,
      value: "",
      error: "EMPTY_VALUE"
    };
  }

  if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
    return {
      valid: false,
      field: classification.field,
      value: "",
      error: "CONTROL_CHARACTERS"
    };
  }

  if (isSpreadsheetFormulaInput(trimmed)) {
    return {
      valid: false,
      field: classification.field,
      value: "",
      error: "FORMULA_INPUT"
    };
  }

  const config = EDITABLE_PROFILE_FIELDS[classification.field];

  if (trimmed.length > config.maxLength) {
    return {
      valid: false,
      field: classification.field,
      value: "",
      error: "VALUE_TOO_LONG"
    };
  }

  if (classification.field === "preferredLanguage") {
    const language = normalizePreferredLanguage(trimmed);

    if (!language) {
      return {
        valid: false,
        field: classification.field,
        value: "",
        error: "UNSUPPORTED_LANGUAGE"
      };
    }

    return {
      valid: true,
      field: classification.field,
      value: language,
      error: ""
    };
  }

  if (trimmed.length < 2) {
    return {
      valid: false,
      field: classification.field,
      value: "",
      error: "VALUE_TOO_SHORT"
    };
  }

  return {
    valid: true,
    field: classification.field,
    value: trimmed,
    error: ""
  };
}

function getProfileCorrectionOptions(language) {
  const labels = {
    name: ["Name", "പേര്"],
    district: ["District", "ജില്ല"],
    localBody: ["Panchayat / local body", "പഞ്ചായത്ത് / തദ്ദേശസ്ഥാപനം"],
    preferredLanguage: ["Preferred language", "ഇഷ്ടഭാഷ"],
    mainCrop: ["Main crop", "പ്രധാന വിള"]
  };

  return Object.keys(EDITABLE_PROFILE_FIELDS).map(function (field) {
    return {
      id: EDITABLE_PROFILE_FIELDS[field].id,
      field,
      title: localize(
        labels[field][0],
        labels[field][1],
        language
      )
    };
  });
}

function formatProfileCorrectionPrompt(
  fieldInput,
  currentValue,
  language
) {
  const classification = classifyProfileField(fieldInput);

  if (!classification.allowed) {
    return "";
  }

  const option = getProfileCorrectionOptions(language)
    .find(function (item) {
      return item.field === classification.field;
    });
  const current = String(currentValue || "").trim() || "-";
  const english = [
    "✏️ Correct My Information",
    "",
    "Field: " + getProfileCorrectionOptions("English")
      .find(function (item) {
        return item.field === classification.field;
      }).title,
    "Current value: " + current,
    "",
    "Please send the new value. It will not be saved until you confirm."
  ].join("\n");
  const malayalam = [
    "✏️ വിവരങ്ങൾ തിരുത്തുക",
    "",
    "വിവരം: " + getProfileCorrectionOptions("Malayalam")
      .find(function (item) {
        return item.field === classification.field;
      }).title,
    "നിലവിലെ വിവരം: " + current,
    "",
    "പുതിയ വിവരം അയയ്ക്കുക. നിങ്ങൾ സ്ഥിരീകരിക്കുന്നതുവരെ ഇത് സേവ് ചെയ്യില്ല."
  ].join("\n");

  return option
    ? localize(english, malayalam, language)
    : "";
}

function safeDisplayValue(value) {
  const text = String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text || "-";
}

function projectFarmerInformation(profile) {
  const source = profile || {};

  return {
    farmerId: safeDisplayValue(source.farmerId),
    name: safeDisplayValue(source.name),
    district: safeDisplayValue(source.district),
    localBody: safeDisplayValue(
      source.localBody || source.panchayath || source.panchayat
    ),
    preferredLanguage: safeDisplayValue(source.preferredLanguage),
    mainCrop: safeDisplayValue(source.mainCrop),
    landSummary: safeDisplayValue(source.landSummary),
    animalSummary: safeDisplayValue(source.animalSummary)
  };
}

function formatMyInformation(profile, language) {
  const safe = projectFarmerInformation(profile);
  const english = [
    "👤 My Information",
    "",
    "Farmer ID: " + safe.farmerId,
    "Name: " + safe.name,
    "District: " + safe.district,
    "Panchayat / local body: " + safe.localBody,
    "Preferred language: " + safe.preferredLanguage,
    "Main crop: " + safe.mainCrop,
    "Land summary: " + safe.landSummary,
    "Animal summary: " + safe.animalSummary
  ].join("\n");
  const malayalam = [
    "👤 എന്റെ വിവരങ്ങൾ",
    "",
    "കർഷക ID: " + safe.farmerId,
    "പേര്: " + safe.name,
    "ജില്ല: " + safe.district,
    "പഞ്ചായത്ത് / തദ്ദേശസ്ഥാപനം: " + safe.localBody,
    "ഇഷ്ടഭാഷ: " + safe.preferredLanguage,
    "പ്രധാന വിള: " + safe.mainCrop,
    "ഭൂമി സംഗ്രഹം: " + safe.landSummary,
    "മൃഗ സംഗ്രഹം: " + safe.animalSummary
  ].join("\n");

  return localize(english, malayalam, language);
}

function formatPrivacyAndConsent(status, language) {
  const interpreted = interpretConsentStatus(status, language);
  const english = [
    "🔒 Privacy & Consent",
    "",
    "Current status: " + interpretConsentStatus(status, "English").label,
    "You can read the privacy policy or ask to withdraw your consent."
  ].join("\n");
  const malayalam = [
    "🔒 സ്വകാര്യതയും സമ്മതവും",
    "",
    "നിലവിലെ നില: " + interpretConsentStatus(status, "Malayalam").label,
    "സ്വകാര്യതാ നയം വായിക്കാനോ സമ്മതം പിൻവലിക്കാൻ ആവശ്യപ്പെടാനോ കഴിയും."
  ].join("\n");

  return interpreted
    ? localize(english, malayalam, language)
    : "";
}

function normalizeSenderIdentity(value) {
  const raw = String(value || "").trim();

  if (/[^0-9+\s().-]/.test(raw)) {
    return "";
  }

  const digits = raw.replace(/\D/g, "");

  if (
    !digits ||
    digits.length < 10 ||
    digits.length > 15
  ) {
    return "";
  }

  return normalizeWhatsapp(raw);
}

function createSenderAuthorizationContext(sender) {
  const whatsapp = normalizeSenderIdentity(sender);

  return {
    valid: Boolean(whatsapp),
    identitySource: whatsapp ? "WHATSAPP_SENDER" : "",
    whatsapp,
    acceptsTypedFarmerId: false
  };
}

function senderMatchesRegisteredPhone(sender, registeredPhone) {
  const senderIdentity = normalizeSenderIdentity(sender);
  const registeredIdentity = normalizeSenderIdentity(registeredPhone);

  return Boolean(
    senderIdentity &&
    registeredIdentity &&
    senderIdentity === registeredIdentity
  );
}

module.exports = {
  PRIVACY_TEXT_IS_DRAFT,
  DRAFT_PRIVACY_POLICY_VERSION,
  CONSENT_ACTIONS,
  CONSENT_STATUSES,
  MY_DATA_ACTIONS,
  EDITABLE_PROFILE_FIELDS,
  formatShortConsentSummary,
  formatPrivacyPolicy,
  interpretConsentChoice,
  interpretConsentStatus,
  formatWithdrawalInformation,
  getMyDataMenuOptions,
  interpretMyDataAction,
  isWithdrawalIntent,
  classifyProfileField,
  isSpreadsheetFormulaInput,
  validateProfileCorrection,
  getProfileCorrectionOptions,
  formatProfileCorrectionPrompt,
  projectFarmerInformation,
  formatMyInformation,
  formatPrivacyAndConsent,
  normalizeSenderIdentity,
  createSenderAuthorizationContext,
  senderMatchesRegisteredPhone
};
