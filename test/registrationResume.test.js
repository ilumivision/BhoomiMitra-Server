"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getRegistrationResumePlan,
  isResumeConfirmation,
  registrationResumePrompt
} = require("../utils/registrationResume");

function farmer(overrides) {
  return Object.assign({
    success: true,
    category: "farmer",
    memberId: "BM-1783517586436",
    whatsapp: "+91 98765 43210",
    mobile: "9876543210",
    name: "",
    district: "Pathanamthitta",
    panchayath: "Ranni",
    mainCrop: "Rubber",
    registrationStatus: "Registered",
    verificationStatus: "Pending",
    activeStatus: "Active"
  }, overrides || {});
}

test("unique incomplete farmer resumes the same Farmer_ID at the first missing field", function () {
  const plan = getRegistrationResumePlan(farmer(), "919876543210");
  assert.equal(plan.eligible, true);
  assert.equal(plan.nextStep, "name");
  assert.equal(plan.data.resumeMemberId, "BM-1783517586436");
  assert.equal(plan.data.crop, "Rubber");
});

test("complete persisted details use explicit confirmation without generating an ID", function () {
  const plan = getRegistrationResumePlan(farmer({ name: "Anu" }), "9876543210");
  assert.equal(plan.eligible, true);
  assert.equal(plan.nextStep, "resume_confirm");
  assert.equal(plan.data.resumeMemberId, "BM-1783517586436");
  assert.equal(Object.hasOwn(plan.data, "generatedId"), false);
});

test("inactive ambiguous mobile-only and ID-less records cannot resume", function () {
  assert.equal(getRegistrationResumePlan(null, "9876543210").eligible, false);
  assert.equal(getRegistrationResumePlan(farmer({ activeStatus: "Inactive" }), "9876543210").eligible, false);
  assert.equal(getRegistrationResumePlan(farmer({ whatsapp: "" }), "9876543210").eligible, false);
  assert.equal(getRegistrationResumePlan(farmer({ memberId: "" }), "9876543210").eligible, false);
});

test("service-member registrations remain on manual verification paths", function () {
  const plan = getRegistrationResumePlan(farmer({ category: "expert" }), "9876543210");
  assert.equal(plan.eligible, false);
  assert.equal(plan.code, "SERVICE_MEMBER_REVIEW_REQUIRED");
});

test("resume confirmation and prompts support English and Malayalam", function () {
  assert.equal(isResumeConfirmation("CONTINUE"), true);
  assert.equal(isResumeConfirmation("തുടരുക"), true);
  assert.equal(isResumeConfirmation("no"), false);
  assert.match(registrationResumePrompt("name", "English"), /name/i);
  assert.match(registrationResumePrompt("name", "Malayalam"), /പേര്/);
});
