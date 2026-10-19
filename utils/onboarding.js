"use strict";

function hasCurrentConsent(consentResult, versions) {
  const expected = versions || {};
  const consent = consentResult && consentResult.consent;

  return Boolean(
    consentResult &&
    consentResult.success &&
    consentResult.found &&
    consent &&
    consent.consentStatus === "AGREED" &&
    consent.agreementVersion === expected.agreementVersion &&
    consent.privacyPolicyVersion === expected.privacyPolicyVersion
  );
}

function getReturningWelcome(language) {
  return String(language || "").toLowerCase() === "malayalam"
    ? "🌱 ഭൂമിമിത്രയിലേക്ക് വീണ്ടും സ്വാഗതം! ചോദ്യം നേരിട്ട് ടൈപ്പ് ചെയ്യുകയോ വോയ്സ്/ഫോട്ടോ അയയ്ക്കുകയോ ചെയ്യാം."
    : "🌱 Welcome back to BhoomiMitra! Ask directly by text, voice, or photo.";
}

module.exports = {
  hasCurrentConsent,
  getReturningWelcome
};
