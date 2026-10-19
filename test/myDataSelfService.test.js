"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MY_DATA_ACTIONS,
  getMyDataMenuOptions,
  interpretMyDataAction,
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
} = require("../utils/privacySelfService");

test("My Data menu exposes only the five prepared actions", function () {
  const options = getMyDataMenuOptions("English");

  assert.deepEqual(
    options.map(function (option) {
      return option.id;
    }),
    [
      MY_DATA_ACTIONS.VIEW,
      MY_DATA_ACTIONS.CORRECT,
      MY_DATA_ACTIONS.PRIVACY,
      MY_DATA_ACTIONS.WITHDRAW,
      MY_DATA_ACTIONS.BACK
    ]
  );
});

test("My Data actions support English and Malayalam natural language", function () {
  assert.equal(
    interpretMyDataAction("show my information"),
    MY_DATA_ACTIONS.VIEW
  );
  assert.equal(
    interpretMyDataAction("update my information"),
    MY_DATA_ACTIONS.CORRECT
  );
  assert.equal(
    interpretMyDataAction("privacy policy"),
    MY_DATA_ACTIONS.PRIVACY
  );
  assert.equal(
    interpretMyDataAction("എന്റെ വിവരങ്ങൾ കാണിക്കുക"),
    MY_DATA_ACTIONS.VIEW
  );
  assert.equal(
    interpretMyDataAction("എന്റെ ഭാഷ മാറ്റണം"),
    MY_DATA_ACTIONS.CORRECT
  );
  assert.equal(
    interpretMyDataAction("എന്റെ സമ്മതം പിൻവലിക്കണം"),
    MY_DATA_ACTIONS.WITHDRAW
  );
  assert.equal(interpretMyDataAction("unknown action"), "");
});

test("profile field allowlist contains only approved correction fields", function () {
  const approved = [
    ["Name", "name"],
    ["District", "district"],
    ["Panchayat", "localBody"],
    ["Panchayat / local body", "localBody"],
    ["Preferred Language", "preferredLanguage"],
    ["Main Crop", "mainCrop"]
  ];

  for (const [input, expected] of approved) {
    assert.deepEqual(
      classifyProfileField(input),
      {
        allowed: true,
        field: expected,
        reason: ""
      }
    );
  }

  assert.equal(getProfileCorrectionOptions("English").length, 5);
});

test("restricted and arbitrary profile fields are rejected", function () {
  for (const field of [
    "Farmer_ID",
    "Mobile Number",
    "WhatsApp",
    "Verification_Status",
    "Registration_Status",
    "Active_Status",
    "Remarks",
    "Admin Notes",
    "Expert_Assigned"
  ]) {
    const result = classifyProfileField(field);

    assert.equal(result.allowed, false, field);
    assert.equal(result.reason, "RESTRICTED_FIELD", field);
  }

  assert.deepEqual(
    classifyProfileField("Column_ZZ"),
    {
      allowed: false,
      field: "",
      reason: "UNKNOWN_FIELD"
    }
  );
});

test("approved profile values are normalized without preparing a Sheet write", function () {
  assert.deepEqual(
    validateProfileCorrection("Name", "  Anu Farmer  "),
    {
      valid: true,
      field: "name",
      value: "Anu Farmer",
      error: ""
    }
  );
  assert.deepEqual(
    validateProfileCorrection("Preferred Language", "both"),
    {
      valid: true,
      field: "preferredLanguage",
      value: "Bilingual",
      error: ""
    }
  );
});

test("invalid profile values are rejected", function () {
  assert.equal(
    validateProfileCorrection("Name", " ").error,
    "EMPTY_VALUE"
  );
  assert.equal(
    validateProfileCorrection("Name", "A").error,
    "VALUE_TOO_SHORT"
  );
  assert.equal(
    validateProfileCorrection("Preferred Language", "Hindi").error,
    "UNSUPPORTED_LANGUAGE"
  );
  assert.equal(
    validateProfileCorrection("District", "A\nB").error,
    "CONTROL_CHARACTERS"
  );
  assert.equal(
    validateProfileCorrection("Column_ZZ", "value").error,
    "UNKNOWN_FIELD"
  );
});

test("spreadsheet formula injection is rejected for every approved field", function () {
  const attacks = [
    "=HYPERLINK(\"https://example.invalid\")",
    "+SUM(1,2)",
    "-1+2",
    "@SUM(A1:A2)",
    "＝HYPERLINK(\"https://example.invalid\")",
    "  =IMPORTDATA(\"https://example.invalid\")"
  ];

  for (const attack of attacks) {
    assert.equal(isSpreadsheetFormulaInput(attack), true);
    assert.equal(
      validateProfileCorrection("Main Crop", attack).error,
      "FORMULA_INPUT"
    );
  }
});

test("farmer information projection does not expose internal fields", function () {
  const source = {
    farmerId: "BM-1001",
    name: "Anu Farmer",
    district: "Pathanamthitta",
    panchayath: "Thiruvalla",
    preferredLanguage: "Malayalam",
    mainCrop: "Rambutan",
    landSummary: "1 registered land",
    animalSummary: "2 registered animals",
    mobile: "REDACTED_PHONE",
    whatsapp: "REDACTED_WHATSAPP",
    verificationStatus: "Approved",
    activeStatus: "Active",
    remarks: "INTERNAL_REMARK",
    adminSecret: "INTERNAL_SECRET"
  };
  const projected = projectFarmerInformation(source);
  const reply = formatMyInformation(source, "English");

  assert.deepEqual(Object.keys(projected), [
    "farmerId",
    "name",
    "district",
    "localBody",
    "preferredLanguage",
    "mainCrop",
    "landSummary",
    "animalSummary"
  ]);
  assert.doesNotMatch(reply, /REDACTED_PHONE|REDACTED_WHATSAPP/);
  assert.doesNotMatch(reply, /INTERNAL_REMARK|INTERNAL_SECRET/);
  assert.doesNotMatch(reply, /Verification|Active Status|Remarks/);
});

test("My Information and correction prompts support bilingual output", function () {
  const profile = {
    farmerId: "BM-1001",
    name: "Anu Farmer",
    district: "Pathanamthitta",
    localBody: "Thiruvalla",
    preferredLanguage: "Bilingual",
    mainCrop: "Rambutan",
    landSummary: "1",
    animalSummary: "2"
  };
  const information = formatMyInformation(profile, "Bilingual");
  const prompt = formatProfileCorrectionPrompt(
    "District",
    "Pathanamthitta",
    "Bilingual"
  );

  assert.match(information, /My Information/);
  assert.match(information, /എന്റെ വിവരങ്ങൾ/);
  assert.match(prompt, /Current value: Pathanamthitta/);
  assert.match(prompt, /നിലവിലെ വിവരം: Pathanamthitta/);
});

test("privacy and consent summary reports status in all languages", function () {
  const english = formatPrivacyAndConsent("AGREED", "English");
  const malayalam = formatPrivacyAndConsent("WITHDRAWN", "Malayalam");
  const bilingual = formatPrivacyAndConsent("DECLINED", "Bilingual");

  assert.match(english, /Current status: Consent given/);
  assert.match(malayalam, /നിലവിലെ നില: സമ്മതം പിൻവലിച്ചു/);
  assert.match(bilingual, /Consent not given/);
  assert.match(bilingual, /സമ്മതം നൽകിയിട്ടില്ല/);
});

test("future authorization context accepts only a valid WhatsApp sender identity", function () {
  assert.equal(
    normalizeSenderIdentity("+91 98472 98918"),
    "9847298918"
  );
  assert.equal(normalizeSenderIdentity("BM-1001"), "");
  assert.equal(
    normalizeSenderIdentity("BM-1001 9847298918"),
    ""
  );

  assert.deepEqual(
    createSenderAuthorizationContext("919847298918"),
    {
      valid: true,
      identitySource: "WHATSAPP_SENDER",
      whatsapp: "9847298918",
      acceptsTypedFarmerId: false
    }
  );
  assert.equal(
    senderMatchesRegisteredPhone(
      "+91 98472 98918",
      "9847298918"
    ),
    true
  );
  assert.equal(
    senderMatchesRegisteredPhone(
      "9847298918",
      "9876543210"
    ),
    false
  );
});
