"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PRIVACY_POLICY_VERSION
} = require("../utils/privacy");
const {
  PRIVACY_TEXT_IS_DRAFT,
  DRAFT_PRIVACY_POLICY_VERSION,
  CONSENT_ACTIONS,
  CONSENT_STATUSES,
  formatShortConsentSummary,
  formatPrivacyPolicy,
  interpretConsentChoice,
  interpretConsentStatus,
  formatWithdrawalInformation,
  isWithdrawalIntent
} = require("../utils/privacySelfService");

test("draft privacy wording keeps the existing policy version", function () {
  assert.equal(PRIVACY_TEXT_IS_DRAFT, true);
  assert.equal(
    DRAFT_PRIVACY_POLICY_VERSION,
    PRIVACY_POLICY_VERSION
  );
  assert.equal(PRIVACY_POLICY_VERSION, "PILOT-1.0");
});

test("short consent summary supports English, Malayalam and Bilingual", function () {
  const english = formatShortConsentSummary("English");
  const malayalam = formatShortConsentSummary("Malayalam");
  const bilingual = formatShortConsentSummary("Bilingual");

  assert.match(english, /name, phone number and farming information/i);
  assert.match(english, /withdraw consent/i);
  assert.match(malayalam, /പേര്, ഫോൺ നമ്പർ, കൃഷി വിവരങ്ങൾ/);
  assert.match(malayalam, /സമ്മതം പിൻവലിക്കാനും/);
  assert.match(bilingual, /BhoomiMitra Privacy & Consent/);
  assert.match(bilingual, /ഭൂമിമിത്ര സ്വകാര്യതയും സമ്മതവും/);
});

test("privacy policy uses the five simple farmer-facing sections", function () {
  const english = formatPrivacyPolicy("English");
  const malayalam = formatPrivacyPolicy("Malayalam");

  assert.match(english, /1\. What information BhoomiMitra collects/);
  assert.match(english, /2\. Why it is used/);
  assert.match(english, /3\. Who may see it/);
  assert.match(english, /4\. Farmer rights/);
  assert.match(english, /5\. Important note/);
  assert.match(english, /supporting indicators/i);
  assert.match(malayalam, /1\. ഭൂമിമിത്ര ശേഖരിക്കുന്ന വിവരങ്ങൾ/);
  assert.match(malayalam, /4\. കർഷകന്റെ അവകാശങ്ങൾ/);
  assert.match(malayalam, /സഹായ സൂചികകൾ/);
});

test("privacy policy supports bilingual output", function () {
  const text = formatPrivacyPolicy("Bilingual");

  assert.match(text, /BhoomiMitra Privacy Policy/);
  assert.match(text, /ഭൂമിമിത്ര സ്വകാര്യതാ നയം/);
});

test("consent button IDs are interpreted without activating routing", function () {
  assert.equal(
    interpretConsentChoice({ id: "CONSENT_AGREE" }),
    CONSENT_ACTIONS.AGREE
  );
  assert.equal(
    interpretConsentChoice({ id: "CONSENT_DECLINE" }),
    CONSENT_ACTIONS.DECLINE
  );
  assert.equal(
    interpretConsentChoice({ id: "CONSENT_POLICY" }),
    CONSENT_ACTIONS.POLICY
  );
});

test("existing typed acceptance and refusal commands remain recognized", function () {
  for (const value of [
    "AGREE",
    "YES",
    "I AGREE",
    "I ACCEPT",
    "ACCEPT",
    "ഞാൻ അംഗീകരിക്കുന്നു",
    "സമ്മതിക്കുന്നു"
  ]) {
    assert.equal(
      interpretConsentChoice(value),
      CONSENT_ACTIONS.AGREE
    );
  }

  for (const value of [
    "DECLINE",
    "NO",
    "I DECLINE",
    "I DO NOT ACCEPT",
    "DO NOT ACCEPT",
    "ഞാൻ അംഗീകരിക്കുന്നില്ല",
    "സമ്മതിക്കുന്നില്ല"
  ]) {
    assert.equal(
      interpretConsentChoice(value),
      CONSENT_ACTIONS.DECLINE
    );
  }

  assert.equal(
    interpretConsentChoice("POLICY"),
    CONSENT_ACTIONS.POLICY
  );
  assert.equal(interpretConsentChoice("maybe"), "");
});

test("consent status interpretation is explicit and non-enforcing", function () {
  const agreed = interpretConsentStatus("agreed", "English");
  const declined = interpretConsentStatus("DECLINED", "English");
  const withdrawn = interpretConsentStatus("WITHDRAWN", "Malayalam");
  const unknown = interpretConsentStatus("", "English");

  assert.equal(agreed.status, CONSENT_STATUSES.AGREED);
  assert.equal(agreed.hasActiveConsent, true);
  assert.equal(declined.isDeclined, true);
  assert.equal(withdrawn.isWithdrawn, true);
  assert.match(withdrawn.label, /സമ്മതം പിൻവലിച്ചു/);
  assert.equal(unknown.status, CONSENT_STATUSES.UNKNOWN);
  assert.equal(unknown.hasDecision, false);
});

test("withdrawal information is cautious and preserves history", function () {
  const english = formatWithdrawalInformation("English");
  const malayalam = formatWithdrawalInformation("Malayalam");

  assert.match(english, /personalized.*limited/i);
  assert.match(english, /does not automatically delete historical records/i);
  assert.match(malayalam, /വ്യക്തിഗത സേവനങ്ങൾ പരിമിതമായേക്കാം/);
  assert.match(malayalam, /പഴയ രേഖകൾ സ്വയമേവ ഇല്ലാതാക്കില്ല/);
});

test("withdrawal intent recognizes button and natural-language forms", function () {
  assert.equal(isWithdrawalIntent("MY_DATA_WITHDRAW"), true);
  assert.equal(isWithdrawalIntent("CONSENT_WITHDRAW_CONFIRM"), true);
  assert.equal(isWithdrawalIntent("withdraw my consent"), true);
  assert.equal(isWithdrawalIntent("എന്റെ സമ്മതം പിൻവലിക്കണം"), true);
  assert.equal(isWithdrawalIntent("show my information"), false);
});
