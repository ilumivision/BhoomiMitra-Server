"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createBhoomiMitraUI } = require("../utils/bhoomiMitraUI");
const {
  getMissingPreferenceAction,
  shouldSendRegisteredHelpPrompt
} = require("../utils/greetingPolicy");
const {
  USER_REGISTRATION_STATES
} = require("../utils/userRegistrationStatus");

function harness() {
  const calls = [];
  const ui = createBhoomiMitraUI({
    axios: {
      async post(_url, body) {
        calls.push(body);
        return { data: { messages: [{ id: "greeting-test" }] } };
      }
    },
    phoneNumberId: "phone-id",
    whatsappToken: "test-token"
  });
  return { calls, ui };
}

const registeredFarmer = {
  state: USER_REGISTRATION_STATES.REGISTERED_FARMER
};

test("registered farmer greetings use only the short Main Menu prompt", async function () {
  const { calls, ui } = harness();
  await ui.sendRegisteredHelpPrompt("919000000000", "English");
  await ui.sendRegisteredHelpPrompt("919000000000", "Malayalam");

  assert.equal(
    calls[0].interactive.body.text,
    "🌱 BhoomiMitra\nHow can I help you today?"
  );
  assert.deepEqual(
    calls[0].interactive.action.buttons.map(function (button) {
      return button.reply;
    }),
    [{ id: "NAV_HOME", title: "Main Menu" }]
  );
  assert.match(calls[1].interactive.body.text, /ഇന്ന് നിങ്ങളെ എങ്ങനെ സഹായിക്കാം/);
  assert.doesNotMatch(JSON.stringify(calls), /Welcome|Welcome back/i);
});

test("registered greeting policy survives new conversations without session state", function () {
  ["Hi", "Hello", "MENU", "HOME", "ഹായ്", "നമസ്കാരം", "പ്രധാന മെനു"].forEach(
    function (text) {
      assert.equal(
        shouldSendRegisteredHelpPrompt(registeredFarmer, text, "text"),
        true,
        text
      );
    }
  );
});

test("questions voice and photos bypass the registered greeting prompt", function () {
  assert.equal(
    shouldSendRegisteredHelpPrompt(
      registeredFarmer,
      "Why are my coconut leaves yellow?",
      "text"
    ),
    false
  );
  assert.equal(
    shouldSendRegisteredHelpPrompt(registeredFarmer, "Hi", "voice"),
    false
  );
  assert.equal(
    shouldSendRegisteredHelpPrompt(registeredFarmer, "Hello", "image"),
    false
  );
});

test("only unregistered language selection contains the welcome copy", async function () {
  const { calls, ui } = harness();
  await ui.sendLanguageSelection("919000000000", { includeWelcome: true });
  await ui.sendLanguageSelection("919000000000", { includeWelcome: false });

  assert.match(calls[0].interactive.body.text, /Welcome to BhoomiMitra/);
  assert.doesNotMatch(calls[1].interactive.body.text, /Welcome|സ്വാഗതം/i);
  assert.match(calls[1].interactive.body.text, /Choose your preferred language/);
});

test("missing saved language never reintroduces a welcome for registered identities", function () {
  assert.equal(
    getMissingPreferenceAction(registeredFarmer),
    "INFER_WITHOUT_WELCOME"
  );
  assert.equal(
    getMissingPreferenceAction({
      state: USER_REGISTRATION_STATES.REGISTERED_SERVICE_MEMBER
    }),
    "INFER_WITHOUT_WELCOME"
  );
  assert.equal(
    getMissingPreferenceAction({ state: USER_REGISTRATION_STATES.UNREGISTERED }),
    "WELCOME_AND_SELECT"
  );
  assert.equal(
    getMissingPreferenceAction({ state: USER_REGISTRATION_STATES.INCOMPLETE }),
    "SELECT_WITHOUT_WELCOME"
  );
});
