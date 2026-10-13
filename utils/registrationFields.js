"use strict";

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
  languageHeaders: Object.freeze([
    "Preferred_Language",
    "Preferred Language",
    "Prefered Language"
  ]),
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

function withPreferredLanguage(data, preferredLanguage) {
  const registrationData = {
    ...(data || {})
  };

  if (!registrationData.preferredLanguage) {
    registrationData.preferredLanguage =
      String(preferredLanguage || "").trim();
  }

  return registrationData;
}

module.exports = {
  FARMER_HEADER_ALIASES,
  normalizeRegistrationHeader,
  withPreferredLanguage
};
