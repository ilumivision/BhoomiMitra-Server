"use strict";

const { isLimitedAccessState } = require("./userRegistrationStatus");

async function routeRegistrationWebhookResult(options) {
  const input = options || {};
  const result = input.registrationResult;
  if (!result) return { handled: false };

  const reply = typeof result === "string"
    ? result
    : String(result.reply || "");

  if (reply && typeof input.sendMessage === "function") {
    await input.sendMessage(input.from, reply);
  }

  let access = null;
  if (
    typeof result === "object" &&
    (result.showHome || result.registrationCompleted)
  ) {
    access = await input.resolveRegistrationStatus(input.from);
    await input.sendHome(
      input.from,
      input.language || "Malayalam",
      access,
      isLimitedAccessState(access)
    );
  }

  if (reply && typeof input.logRegistration === "function") {
    Promise.resolve(
      input.logRegistration(
        input.from,
        input.userText,
        reply,
        "registration"
      )
    ).catch(function (error) {
      if (typeof input.onLogError === "function") {
        input.onLogError(error);
      }
    });
  }

  return {
    handled: true,
    replySent: Boolean(reply),
    homeSent: Boolean(access),
    access
  };
}

module.exports = {
  routeRegistrationWebhookResult
};
