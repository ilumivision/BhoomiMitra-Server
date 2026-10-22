"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  ADVISORY_RESPONSE_RULES,
  buildAdvisoryPrompt,
  formatWhatsAppAdvisory,
  resolveAdvisoryLanguage,
  splitWhatsAppText
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

test("weather, market, training and scheme routes use the current-question language", function () {
  const source = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");

  assert.match(source, /const currentResponseLanguage = resolveAdvisoryLanguage\(/);
  assert.match(
    source,
    /sendWeatherSheetReply\(\s*from,\s*userText,\s*currentResponseLanguage\s*\)/
  );
  assert.match(
    source,
    /sendWhatsAppMessage\(\s*from,\s*finalReply,\s*\{ responseLanguage: currentResponseLanguage \}\s*\)/
  );
  assert.match(
    source,
    /naturalFeatureEntry === "TRAINING"[\s\S]*?sendTrainingHome\(\s*from,\s*currentResponseLanguage\s*\)/
  );
  assert.match(
    source,
    /naturalFeatureEntry === "SCHEMES"[\s\S]*?sendSchemesMenu\(\s*from,\s*currentResponseLanguage\s*\)/
  );
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

test("short advisory answer and Main Menu control use one interactive message", async function () {
  const { calls, ui } = uiHarness();
  const answer = "🌾 Pepper flowers usually appear after suitable rain and new growth. Keep drainage clear and avoid excess nitrogen.";

  await ui.sendAdvisoryAnswer("919000000000", "English", answer);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, "interactive");
  assert.equal(calls[0].interactive.body.text, answer);
  assert.deepEqual(
    calls[0].interactive.action.buttons.map(function (button) {
      return button.reply;
    }),
    [{ id: "NAV_HOME", title: "🏠 Main Menu" }]
  );
});

test("long advisory text is split at readable boundaries before navigation", async function () {
  const { calls, ui } = uiHarness();
  const longAnswer = Array.from({ length: 90 }, function (_value, index) {
    return "Recommendation " + (index + 1) + " keeps the farmer-facing explanation complete and safe.";
  }).join(" ");

  const chunks = splitWhatsAppText(longAnswer, 4096);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(" "), longAnswer);
  chunks.forEach(function (chunk) {
    assert.ok(Array.from(chunk).length <= 4096);
    assert.match(chunk, /[.!?]$/);
  });

  await ui.sendAdvisoryAnswer("919000000000", "Malayalam", longAnswer);
  assert.equal(calls.length, chunks.length + 1);
  calls.slice(0, -1).forEach(function (payload) {
    assert.equal(payload.type, "text");
    assert.ok(Array.from(payload.text.body).length <= 4096);
  });
  assert.equal(calls.at(-1).interactive.action.buttons[0].reply.id, "NAV_HOME");
});

