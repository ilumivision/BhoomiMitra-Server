"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  USER_REGISTRATION_STATES
} = require("../utils/userRegistrationStatus");
const {
  routeRegistrationWebhookResult
} = require("../utils/registrationWebhook");

function harness(status) {
  const events = [];
  return {
    events,
    options: {
      from: "919876543210",
      userText: "Rubber",
      language: "English",
      async sendMessage(_from, text) {
        events.push({ type: "message", text });
      },
      async resolveRegistrationStatus() {
        events.push({ type: "resolve" });
        return status;
      },
      async sendHome(_from, language, access, includeNotice) {
        events.push({ type: "home", language, access, includeNotice });
      },
      async logRegistration() {
        events.push({ type: "log" });
      }
    }
  };
}

test("webhook completion sends confirmation then re-resolves and sends full farmer menu", async function () {
  const status = { state: USER_REGISTRATION_STATES.REGISTERED_FARMER };
  const setup = harness(status);
  const result = await routeRegistrationWebhookResult(Object.assign(setup.options, {
    registrationResult: {
      handled: true,
      registrationCompleted: true,
      category: "farmer",
      reply: "Registration completed."
    }
  }));
  assert.equal(result.handled, true);
  assert.equal(result.homeSent, true);
  assert.deepEqual(setup.events.slice(0, 3).map(function (event) {
    return event.type;
  }), ["message", "resolve", "home"]);
  assert.equal(setup.events[2].includeNotice, false);
});

test("webhook HOME during registration exits workflow and sends status-aware home only", async function () {
  const status = { state: USER_REGISTRATION_STATES.UNREGISTERED };
  const setup = harness(status);
  const result = await routeRegistrationWebhookResult(Object.assign(setup.options, {
    registrationResult: { handled: true, showHome: true }
  }));
  assert.equal(result.replySent, false);
  assert.equal(result.homeSent, true);
  assert.deepEqual(setup.events.map(function (event) { return event.type; }), ["resolve", "home"]);
  assert.equal(setup.events[1].includeNotice, true);
});

test("ordinary registration prompt does not resolve status or send a menu", async function () {
  const setup = harness({ state: USER_REGISTRATION_STATES.UNREGISTERED });
  const result = await routeRegistrationWebhookResult(Object.assign(setup.options, {
    registrationResult: "Please send your name."
  }));
  assert.equal(result.replySent, true);
  assert.equal(result.homeSent, false);
  assert.deepEqual(setup.events.slice(0, 1).map(function (event) { return event.type; }), ["message"]);
});
