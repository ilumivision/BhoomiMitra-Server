"use strict";

const EXPLICIT_REGISTRATION_EXIT_IDS = new Set([
  "LANG_ENGLISH",
  "LANG_MALAYALAM",
  "HOME_ASK",
  "HOME_FARM",
  "HOME_EXPERT",
  "HOME_MARKET",
  "HOME_PROFILE",
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
  "PERSONAL_FARMER_ID"
]);

const REGISTRATION_MENU_STEPS = new Set([
  "privacy_consent_pending",
  "registration_active"
]);

function isExplicitRegistrationExit(selectionId) {
  return EXPLICIT_REGISTRATION_EXIT_IDS.has(
    String(selectionId || "").trim()
  );
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

module.exports = {
  EXPLICIT_REGISTRATION_EXIT_IDS,
  REGISTRATION_MENU_STEPS,
  isExplicitRegistrationExit,
  closeRegistrationSessionForNavigation
};
