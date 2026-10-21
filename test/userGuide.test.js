"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createBhoomiMitraUI } = require("../utils/bhoomiMitraUI");
const {
  USER_GUIDE_ACTION_IDS,
  USER_GUIDE_TOPICS,
  buildUserGuideTopicText,
  parseUserGuideAction
} = require("../utils/userGuide");

function harness() {
  const calls = [];
  return {
    calls: calls,
    ui: createBhoomiMitraUI({
      axios: {
        post: async function (_url, body) {
          calls.push(body);
          return { data: { messages: [{ id: "wamid.guide" }] } };
        }
      },
      phoneNumberId: "phone-id",
      whatsappToken: "token"
    })
  };
}

function rows(payload) {
  return payload.interactive.action.sections[0].rows;
}

test("user guide contains the ten approved topics in exact order", function () {
  assert.deepEqual(USER_GUIDE_TOPICS.map(function (topic) {
    return topic.titleEnglish;
  }), [
    "Getting Started",
    "Farmer Registration",
    "Crop & Animal Advisory",
    "Land & Farm Records",
    "Weather & Market",
    "Expert Consultation",
    "Training Programmes",
    "Government Schemes",
    "Alerts & Reminders",
    "Frequently Asked Questions"
  ]);
});

test("English and Malayalam user guide navigation exposes every topic", async function () {
  const english = harness();
  const malayalam = harness();
  await english.ui.sendUserGuidePage("919000000000", "English", 1);
  await english.ui.sendUserGuidePage("919000000000", "English", 2);
  await malayalam.ui.sendUserGuidePage("919000000000", "Malayalam", 1);

  const topicIds = rows(english.calls[0]).slice(0, 5)
    .concat(rows(english.calls[1]).slice(0, 5))
    .map(function (row) { return row.id; });
  assert.equal(new Set(topicIds).size, 10);
  topicIds.forEach(function (id) {
    assert.equal(parseUserGuideAction(id).type, "TOPIC");
  });
  assert.match(english.calls[0].interactive.body.text, /Help & User Guide/);
  assert.match(malayalam.calls[0].interactive.body.text, /സഹായവും ഉപയോക്തൃ മാർഗനിർദേശവും/);
});

test("guide details are bilingual farmer-friendly and mark pilot features", function () {
  const alerts = USER_GUIDE_TOPICS.find(function (topic) {
    return topic.id === "alerts-reminders";
  });
  const schemes = USER_GUIDE_TOPICS.find(function (topic) {
    return topic.id === "government-schemes";
  });

  assert.match(buildUserGuideTopicText(alerts, "English"), /under pilot testing/);
  assert.match(buildUserGuideTopicText(alerts, "Malayalam"), /പൈലറ്റ് പരിശോധനയിലാണ്/);
  assert.match(buildUserGuideTopicText(schemes, "English"), /official source/);
  assert.match(buildUserGuideTopicText(schemes, "Malayalam"), /ഔദ്യോഗിക ഉറവിടം/);
  assert.deepEqual(parseUserGuideAction(USER_GUIDE_ACTION_IDS.PAGE_2), {
    type: "GUIDE",
    page: 2
  });
});

test("guide explains explicit registration and the approved language-menu path", function () {
  const registration = USER_GUIDE_TOPICS.find(function (topic) {
    return topic.id === "farmer-registration";
  });
  const faq = USER_GUIDE_TOPICS.find(function (topic) {
    return topic.id === "faq";
  });

  assert.match(registration.textEnglish, /Registration starts only when you choose it/);
  assert.match(registration.textEnglish, /does not register you automatically/);
  assert.match(registration.textEnglish, /resumes an incomplete registration/);
  assert.match(faq.textEnglish, /Main Menu → More Options → Change Language/);
  assert.match(faq.textMalayalam, /കൂടുതൽ ഓപ്ഷനുകൾ → ഭാഷ മാറ്റുക/);
});
