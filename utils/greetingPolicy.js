"use strict";

const { USER_REGISTRATION_STATES } = require("./userRegistrationStatus");

function normalize(value) {
  return String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const REGISTERED_HELP_COMMANDS = new Set([
  "hi",
  "hello",
  "hai",
  "menu",
  "main menu",
  "home",
  "ഹായ്",
  "ഹലോ",
  "ഹി",
  "നമസ്കാരം",
  "മെനു",
  "പ്രധാന മെനു"
]);

function shouldSendRegisteredHelpPrompt(status, text, messageType) {
  return Boolean(
    status &&
    status.state === USER_REGISTRATION_STATES.REGISTERED_FARMER &&
    String(messageType || "text").toLowerCase() === "text" &&
    REGISTERED_HELP_COMMANDS.has(normalize(text))
  );
}

function getMissingPreferenceAction(status) {
  const state = status && status.state;

  if (
    state === USER_REGISTRATION_STATES.REGISTERED_FARMER ||
    state === USER_REGISTRATION_STATES.REGISTERED_SERVICE_MEMBER
  ) {
    return "INFER_WITHOUT_WELCOME";
  }

  if (state === USER_REGISTRATION_STATES.UNREGISTERED) {
    return "WELCOME_AND_SELECT";
  }

  return "SELECT_WITHOUT_WELCOME";
}

module.exports = {
  REGISTERED_HELP_COMMANDS,
  getMissingPreferenceAction,
  shouldSendRegisteredHelpPrompt
};
