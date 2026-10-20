"use strict";

const INACTIVE_VALUES = new Set([
  "inactive", "suspended", "disabled", "blocked", "closed",
  "deactivated", "deleted", "rejected", "no", "false"
]);

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function phoneKey(value) {
  const digits = clean(value).replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function isInactive(value) {
  return INACTIVE_VALUES.has(
    clean(value).toLowerCase().replace(/[\s_-]+/g, " ")
  );
}

function resumeField(existing, name) {
  if (name === "crop") {
    return clean(existing.mainCrop || existing.service);
  }
  return clean(existing[name]);
}

function getRegistrationResumePlan(existing, senderIdentity) {
  if (!existing || existing.success !== true) {
    return { eligible: false, code: "REGISTRATION_NOT_UNIQUE" };
  }
  if (existing.category !== "farmer") {
    return { eligible: false, code: "SERVICE_MEMBER_REVIEW_REQUIRED" };
  }
  if (!clean(existing.memberId)) {
    return { eligible: false, code: "STABLE_FARMER_ID_REQUIRED" };
  }
  if (
    !phoneKey(existing.whatsapp) ||
    phoneKey(existing.whatsapp) !== phoneKey(senderIdentity)
  ) {
    return { eligible: false, code: "EXACT_WHATSAPP_REQUIRED" };
  }
  if (
    isInactive(existing.registrationStatus) ||
    isInactive(existing.verificationStatus) ||
    isInactive(existing.activeStatus)
  ) {
    return { eligible: false, code: "REGISTRATION_INACTIVE" };
  }

  const data = {
    category: "farmer",
    whatsapp: clean(existing.whatsapp),
    mobile: clean(existing.mobile || existing.whatsapp),
    name: resumeField(existing, "name"),
    district: resumeField(existing, "district"),
    panchayath: resumeField(existing, "panchayath"),
    crop: resumeField(existing, "crop"),
    service: resumeField(existing, "crop"),
    preferredLanguage: clean(existing.preferredLanguage),
    resumeMemberId: clean(existing.memberId)
  };
  const nextStep = ["name", "district", "panchayath", "crop"]
    .find(function (field) { return !clean(data[field]); }) ||
    "resume_confirm";

  return {
    eligible: true,
    code: "RESUME_EXISTING_FARMER",
    nextStep,
    data
  };
}

function isResumeConfirmation(value) {
  const text = clean(value).toLowerCase();
  return [
    "1", "yes", "continue", "confirm", "complete",
    "തുടരുക", "അതെ", "സ്ഥിരീകരിക്കുക"
  ].includes(text);
}

function registrationResumePrompt(step, language) {
  const ml = clean(language).toLowerCase() === "malayalam";
  const prompts = {
    name: ["Please send your name only.", "ദയവായി നിങ്ങളുടെ പേര് മാത്രം അയയ്ക്കുക."],
    district: ["Which Kerala district are you in?", "നിങ്ങളുടെ കേരള ജില്ല ഏതാണ്?"],
    panchayath: ["Which Panchayath or local body are you in?", "നിങ്ങളുടെ പഞ്ചായത്ത് / തദ്ദേശസ്ഥാപനം ഏതാണ്?"],
    crop: ["What is your main crop or farming activity?", "നിങ്ങളുടെ പ്രധാന വിള / കൃഷി ഏതാണ്?"],
    resume_confirm: [
      "Your existing Farmer_ID was found. Reply CONTINUE to complete this same registration, or CANCEL.",
      "നിങ്ങളുടെ നിലവിലുള്ള Farmer_ID കണ്ടെത്തി. ഇതേ രജിസ്ട്രേഷൻ പൂർത്തിയാക്കാൻ തുടരുക എന്ന് അയയ്ക്കുക; റദ്ദാക്കാൻ CANCEL അയയ്ക്കുക."
    ]
  };
  const pair = prompts[step] || prompts.resume_confirm;
  return ml ? pair[1] : pair[0];
}

module.exports = {
  getRegistrationResumePlan,
  isResumeConfirmation,
  registrationResumePrompt
};
