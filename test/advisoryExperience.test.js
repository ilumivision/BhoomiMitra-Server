"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ADVISORY_RESPONSE_RULES,
  buildAdvisoryPrompt,
  formatWhatsAppAdvisory,
  resolveAdvisoryLanguage
} = require("../utils/advisory");
const { createBhoomiMitraUI } = require("../utils/bhoomiMitraUI");

function uiHarness() {
  const calls = [];
  const ui = createBhoomiMitraUI({
    axios: {
      async post(_url, body) {
        calls.push(body);
        return { data: { messages: [{ id: "advisory-ui-test" }] } };
      }
    },
    phoneNumberId: "phone-id",
    whatsappToken: "test-token"
  });
  return { calls, ui };
}

test("clear Malayalam and English advisory questions use the question language", function () {
  assert.equal(
    resolveAdvisoryLanguage("റംബൂട്ടാൻ ഇപ്പോൾ കായ്ക്കുമോ?", "English", "text"),
    "Malayalam"
  );
  assert.equal(
    resolveAdvisoryLanguage("When does rambutan flower?", "Malayalam", "text"),
    "English"
  );
});

test("mixed, ambiguous, photo-only and voice-only input uses the saved language", function () {
  assert.equal(
    resolveAdvisoryLanguage("pepper ഇല മഞ്ഞയാണ്", "Malayalam", "text"),
    "Malayalam"
  );
  assert.equal(resolveAdvisoryLanguage("123?", "English", "text"), "English");
  assert.equal(
    resolveAdvisoryLanguage("vazhaykku enthu valam venam", "Malayalam", "text"),
    "Malayalam"
  );
  assert.equal(resolveAdvisoryLanguage("", "Malayalam", "image"), "Malayalam");
  assert.equal(
    resolveAdvisoryLanguage("When will it flower?", "Malayalam", "voice"),
    "Malayalam"
  );
});

test("a one-off question language does not mutate the saved preference", function () {
  const farmer = { preferredLanguage: "Malayalam" };
  const replyLanguage = resolveAdvisoryLanguage(
    "How should I prune pepper?",
    farmer.preferredLanguage,
    "text"
  );

  assert.equal(replyLanguage, "English");
  assert.equal(farmer.preferredLanguage, "Malayalam");
});

test("ordinary advisory prompt is concise while complex safety advice stays complete", function () {
  const prompt = buildAdvisoryPrompt({
    question: "What should I do for leaf spots?",
    language: "English",
    domain: "crop advisory",
    context: "District: Pathanamthitta"
  });

  assert.match(prompt, /direct answer first/i);
  assert.match(prompt, /60 to 120 words/i);
  assert.match(prompt, /at most one necessary follow-up question/i);
  assert.match(prompt, /pesticide doses/i);
  assert.match(prompt, /withdrawal periods/i);
  assert.match(prompt, /existing expert workflow/i);
  assert.match(prompt, /District: Pathanamthitta/);
  assert.match(ADVISORY_RESPONSE_RULES, /additional length needed for scientific accuracy and safety/i);
});

test("WhatsApp formatting cleans malformed Markdown without damaging Malayalam or measurements", function () {
  const result = formatWhatsAppAdvisory([
    "## വിള പരിചരണം",
    "",
    "*January to March",
    "**4–5 months",
    "**June to September*",
    "**Verified advice**",
    "- Keep 5*5 m spacing",
    "കുരുമുളക് 2% ലായനി"
  ].join("\n"));

  assert.equal(result, [
    "*വിള പരിചരണം*",
    "",
    "January to March",
    "4–5 months",
    "*June to September*",
    "*Verified advice*",
    "• Keep 5*5 m spacing",
    "കുരുമുളക് 2% ലായനി"
  ].join("\n"));
  assert.doesNotMatch(result, /\*\*/);
});

test("advisory completion offers one localized Main Menu button within Meta limits", async function () {
  const { calls, ui } = uiHarness();
  await ui.sendAdvisoryNavigation("919000000000", "English");
  await ui.sendAdvisoryNavigation("919000000000", "Malayalam");

  assert.equal(calls.length, 2);
  calls.forEach(function (payload) {
    const interactive = payload.interactive;
    assert.equal(interactive.type, "button");
    assert.equal(interactive.action.buttons.length, 1);
    assert.equal(interactive.action.buttons[0].reply.id, "NAV_HOME");
    assert.ok(Array.from(interactive.action.buttons[0].reply.title).length <= 20);
    assert.ok(Array.from(interactive.body.text).length <= 1024);
  });
  assert.equal(calls[0].interactive.action.buttons[0].reply.title, "🏠 Main Menu");
  assert.equal(calls[1].interactive.action.buttons[0].reply.title, "🏠 പ്രധാന മെനു");
  assert.match(calls[0].interactive.body.text, /another question naturally/i);
  assert.match(calls[1].interactive.body.text, /മറ്റൊരു ചോദ്യം/);
});

