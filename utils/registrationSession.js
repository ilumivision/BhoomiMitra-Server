"use strict";

const EXPLICIT_REGISTRATION_EXIT_IDS = new Set([
  "LANG_ENGLISH",
  "LANG_MALAYALAM",
  "HOME_ASK",
  "HOME_FARM",
  "FARM_WEATHER_ALERTS",
  "ANIMAL_OPEN",
  "ANIMAL_REGISTER",
  "ANIMAL_MY_ANIMALS",
  "ANIMAL_HEALTH_DIARY",
  "ANIMAL_PREVENTIVE",
  "ANIMAL_PRODUCTION",
  "ANIMAL_RECORD_HISTORY",
  "ANIMAL_VET_ADVISORY",
  "ANIMAL_VET_EXPERT",
  "ANIMAL_DISEASE_ALERTS",
  "ANIMAL_MAIN_MENU",
  "HOME_EXPERT",
  "HOME_TRAINING",
  "TRAINING_PROMOTED",
  "HOME_SCHEMES",
  "FARM_ALERTS_OPEN",
  "TRAINING_REQUEST_START",
  "TRAINING_MY_REQUESTS",
  "HOME_MARKET",
  "HOME_PROFILE",
  "PROFILE_HELP",
  "PROFILE_WHATS_NEW",
  "PROFILE_ABOUT",
  "PROFILE_TERMS_PRIVACY",
  "PROFILE_SETTINGS",
  "PRIVACY_READ_POLICY",
  "WHATS_NEW_OPEN",
  "WHATS_NEW_TRY",
  "WHATS_NEW_DISMISS",
  "NAV_HOME",
  "CHANGE_LANGUAGE",
  "SERVICE_1",
  "SERVICE_2",
  "SERVICE_3",
  "SERVICE_4",
  "SERVICE_5",
  "SERVICE_6",
  "SERVICE_7",
  "SERVICE_8",
  "SERVICE_9",
  "SERVICE_10",
  "SERVICE_11",
  "PERSONAL_DETAILS",
  "PERSONAL_LANDS",
  "PERSONAL_ANIMALS",
  "PERSONAL_FARMER_ID",
  "LAND_REGISTER",
  "LAND_VIEW",
  "LAND_UPDATE",
  "LAND_ADD_CROP",
  "LAND_CROP_HISTORY",
  "LAND_USAGE_HISTORY",
  "LAND_SUMMARY",
  "LAND_SOIL",
  "LAND_SATELLITE_GPS",
  "LAND_BACK",
  "SAT_GPS_BOUNDARY_MAP",
  "SAT_GPS_MAP",
  "SAT_GPS_BOUNDARY_STATUS",
  "SAT_GPS_DETAILS",
  "SAT_GPS_CURRENT_STATUS",
  "SAT_GPS_HISTORY",
  "SAT_GPS_ACCESS",
  "SAT_GPS_BACK"
]);

const REGISTRATION_MENU_STEPS = new Set([
  "privacy_consent_pending",
  "registration_active"
]);

function isExplicitRegistrationExit(selectionId) {
  const id = String(selectionId || "").trim();
  return EXPLICIT_REGISTRATION_EXIT_IDS.has(id) ||
    id.startsWith("CROP_FARM_") ||
    id.startsWith("ABOUT_");
}

function closeRegistrationSessionForNavigation(options) {
  const settings = options || {};
  const userKey = String(settings.userKey || "").trim();
  const registrationSessions =
    settings.registrationSessions || {};
  const menuSessions = settings.menuSessions || {};

  if (
    !userKey ||
    !isExplicitRegistrationExit(settings.selectionId)
  ) {
    return false;
  }

  const menuSession = menuSessions[userKey];
  const hasRegistrationPayload =
    Object.prototype.hasOwnProperty.call(
      registrationSessions,
      userKey
    );
  const hasRegistrationMenuState = Boolean(
    menuSession &&
    REGISTRATION_MENU_STEPS.has(menuSession.step)
  );

  if (
    !hasRegistrationPayload &&
    !hasRegistrationMenuState
  ) {
    return false;
  }

  if (hasRegistrationPayload) {
    delete registrationSessions[userKey];
  }

  if (hasRegistrationMenuState) {
    menuSession.step = null;
    menuSession.updatedAt =
      typeof settings.now === "function"
        ? settings.now()
        : Date.now();
  }

  return true;
}

function clearCompletedRegistrationSession(options) {
  const settings = options || {};
  const userKey = String(settings.userKey || "").trim();
  const registrationSessions =
    settings.registrationSessions || {};
  const result = settings.result;

  if (!userKey || !result || result.success !== true) {
    return false;
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      registrationSessions,
      userKey
    )
  ) {
    return false;
  }

  delete registrationSessions[userKey];
  return true;
}

module.exports = {
  EXPLICIT_REGISTRATION_EXIT_IDS,
  REGISTRATION_MENU_STEPS,
  isExplicitRegistrationExit,
  closeRegistrationSessionForNavigation,
  clearCompletedRegistrationSession
};
