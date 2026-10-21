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

module.exports = {
  hasCurrentConsent
};
