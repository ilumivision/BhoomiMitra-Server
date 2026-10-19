"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createBhoomiMitraUI } = require("../utils/bhoomiMitraUI");
const {
  getNaturalFeatureEntry
} = require("../utils/menu");
const {
  createFeatureDiscovery,
  FEATURE_CATALOGUE
} = require("../utils/whatsNew");
const {
  getReturningWelcome,
  hasCurrentConsent
} = require("../utils/onboarding");
const {
  CROP_FARM_ACTION_IDS
} = require("../utils/cropFarmRecords");
const {
  ANIMAL_ACTION_IDS
} = require("../utils/animalHusbandry");
const {
  FARM_ALERT_ACTION_IDS
} = require("../utils/farmAlerts");
const {
  SCHEME_ACTION_IDS
} = require("../utils/schemes");
const {
  TRAINING_ACTION_IDS
} = require("../utils/training");

function harness(extra) {
  const calls = [];
  const ui = createBhoomiMitraUI(Object.assign({
    axios: {
      async post(_url, body) {
        calls.push(body);
        return { data: { messages: [{ id: "mock-message" }] } };
      }
    },
    phoneNumberId: "phone-id",
    whatsappToken: "test-token"
  }, extra || {}));
  return { calls, ui };
}

function rows(payload) {
  return payload.interactive.action.sections.flatMap(function (section) {
    return section.rows;
  });
}

test("final main menu keeps the five preserved categories", async function () {
  const { calls, ui } = harness();
  await ui.sendMainMenu("919000000000", "English");
  assert.deepEqual(rows(calls[0]).map(function (row) { return row.id; }), [
    "HOME_ASK",
    "HOME_FARM",
    "HOME_EXPERT",
    "HOME_MARKET",
    "HOME_PROFILE"
  ]);
});

test("My Farm is a six-route hub over existing modules", async function () {
  const { calls, ui } = harness();
  await ui.sendFarmMenu("919000000000", "English");
  assert.deepEqual(rows(calls[0]).map(function (row) { return row.id; }), [
    CROP_FARM_ACTION_IDS.OPEN,
    ANIMAL_ACTION_IDS.OPEN,
    "SERVICE_9",
    "FARM_WEATHER_ALERTS",
    "SERVICE_3",
    "NAV_HOME"
  ]);
  assert.equal(ui.getNavigationAction("FARM_WEATHER_ALERTS"), "WEATHER_ALERTS_MENU");
});

test("weather and alerts hub exposes only connected existing actions", async function () {
  const { calls, ui } = harness();
  await ui.sendWeatherAlertsMenu("919000000000", "Malayalam");
  const ids = rows(calls[0]).map(function (row) { return row.id; });
  assert.deepEqual(ids, [
    "SERVICE_4",
    CROP_FARM_ACTION_IDS.ALERTS,
    ANIMAL_ACTION_IDS.ALERTS,
    FARM_ALERT_ACTION_IDS.OPEN,
    "HOME_FARM",
    "NAV_HOME"
  ]);
});

test("Expert and Services retains the required seven destinations", async function () {
  const { calls, ui } = harness();
  await ui.sendExpertMenu("919000000000", "English");
  assert.deepEqual(rows(calls[0]).map(function (row) { return row.id; }), [
    "SERVICE_6",
    ANIMAL_ACTION_IDS.EXPERT,
    "SERVICE_7",
    "SERVICE_8",
    SCHEME_ACTION_IDS.OPEN,
    TRAINING_ACTION_IDS.OPEN,
    "NAV_HOME"
  ]);
});

test("My BhoomiMitra and its secondary settings stay within WhatsApp limits", async function () {
  const { calls, ui } = harness();
  await ui.sendProfileMenu("919000000000", "English");
  await ui.sendProfileSettingsMenu("919000000000", "Malayalam");
  const profileRows = rows(calls[0]);
  const settingsRows = rows(calls[1]);
  assert.ok(profileRows.length <= 10);
  assert.ok(settingsRows.length <= 10);
  assert.ok(profileRows.some(function (row) { return row.id === "PROFILE_HELP"; }));
  assert.ok(profileRows.some(function (row) { return row.id === "PROFILE_WHATS_NEW"; }));
  assert.ok(profileRows.some(function (row) { return row.id === "PROFILE_ABOUT"; }));
  assert.ok(settingsRows.some(function (row) { return row.id === "SERVICE_11"; }));
  assert.ok(settingsRows.some(function (row) { return row.id === "CHANGE_LANGUAGE"; }));
  assert.ok(settingsRows.some(function (row) { return row.id === "PROFILE_TERMS_PRIVACY"; }));
});

test("consent is affirmative and exposes policy plus Not Now controls", async function () {
  const { calls, ui } = harness();
  await ui.sendConsentPrompt("919000000000");
  const interactive = calls[0].interactive;
  assert.equal(interactive.type, "button");
  assert.deepEqual(interactive.action.buttons.map(function (button) {
    return button.reply.id;
  }), ["CONSENT_AGREE", "CONSENT_POLICY", "CONSENT_DECLINE"]);
  assert.match(interactive.body.text, /Ilumivision/);
  assert.match(interactive.body.text, /തിരുത്തലോ ഇല്ലാതാക്കലോ/);
});

test("onboarding reuses only accepted current-version consent", function () {
  const versions = {
    agreementVersion: "PILOT-1.0",
    privacyPolicyVersion: "PILOT-1.0"
  };
  const current = {
    success: true,
    found: true,
    consent: {
      consentStatus: "AGREED",
      agreementVersion: "PILOT-1.0",
      privacyPolicyVersion: "PILOT-1.0"
    }
  };
  assert.equal(hasCurrentConsent(current, versions), true);
  assert.equal(hasCurrentConsent(Object.assign({}, current, {
    consent: Object.assign({}, current.consent, { privacyPolicyVersion: "OLD" })
  }), versions), false);
  assert.equal(hasCurrentConsent(Object.assign({}, current, {
    consent: Object.assign({}, current.consent, { consentStatus: "DECLINED" })
  }), versions), false);
});

test("returning-user welcome is short bilingual-safe guidance", function () {
  assert.match(getReturningWelcome("English"), /Welcome back/);
  assert.match(getReturningWelcome("English"), /text, voice, or photo/);
  assert.match(getReturningWelcome("Malayalam"), /വീണ്ടും സ്വാഗതം/);
  assert.match(getReturningWelcome("Malayalam"), /വോയ്സ്\/ഫോട്ടോ/);
});

test("welcome media is optional and delivery failure never rejects onboarding", async function () {
  const absent = harness();
  assert.deepEqual(await absent.ui.sendOptionalWelcomeMedia("919000000000"), {
    sent: false,
    code: "NOT_CONFIGURED"
  });
  assert.equal(absent.calls.length, 0);

  const failingUi = createBhoomiMitraUI({
    axios: { post: async function () { throw new Error("offline"); } },
    phoneNumberId: "phone-id",
    whatsappToken: "test-token",
    welcomeMediaUrl: "https://example.invalid/approved.mp4",
    welcomeMediaType: "video"
  });
  assert.deepEqual(await failingUi.sendOptionalWelcomeMedia("919000000000"), {
    sent: false,
    code: "DELIVERY_FAILED"
  });
});

test("deterministic bilingual navigation covers the requested reliable phrases", function () {
  const examples = new Map([
    ["എനിക്ക് പരിശീലനം വേണം", "TRAINING"],
    ["സർക്കാർ പദ്ധതികൾ", "SCHEMES"],
    ["എന്റെ പശുക്കൾ", "MY_ANIMALS"],
    ["വിളരോഗ മുന്നറിയിപ്പ്", "CROP_ALERTS"],
    ["സാറ്റലൈറ്റ് വിവരം", "SATELLITE"],
    ["ഇന്നത്തെ വിപണിവില", "MARKET"],
    ["Show my farm", "FARM"],
    ["Training programmes", "TRAINING"],
    ["Government schemes", "SCHEMES"],
    ["Animal registration", "ANIMAL_REGISTRATION"],
    ["Crop alerts", "CROP_ALERTS"],
    ["Satellite monitoring", "SATELLITE"]
  ]);
  examples.forEach(function (expected, phrase) {
    assert.equal(getNaturalFeatureEntry(phrase), expected, phrase);
  });
  assert.equal(getNaturalFeatureEntry("Why are my coconut leaves yellow?"), "");
});

test("feature discovery shows at most once and records only session-memory acknowledgement", function () {
  const discovery = createFeatureDiscovery();
  const first = discovery.select("farmer-1", {
    userCategory: "FARMER",
    date: "2026-10-19"
  });
  assert.equal(first.id, FEATURE_CATALOGUE[0].id);
  assert.equal(first.destination, "HOME_TRAINING");
  discovery.markShown("farmer-1", first.id);
  assert.equal(discovery.select("farmer-1", {
    userCategory: "FARMER",
    date: "2026-10-19"
  }), null);
  discovery.acknowledge("farmer-1", first.id);
  assert.equal(discovery.persistence, "SESSION_MEMORY_ONLY");
});

test("all new list rows and reply buttons obey WhatsApp UI limits", async function () {
  const { calls, ui } = harness();
  await ui.sendMainMenu("919000000000", "Malayalam");
  await ui.sendFarmMenu("919000000000", "Malayalam");
  await ui.sendWeatherAlertsMenu("919000000000", "Malayalam");
  await ui.sendProfileMenu("919000000000", "Malayalam");
  await ui.sendProfileSettingsMenu("919000000000", "Malayalam");
  await ui.sendAboutMenu("919000000000", "Malayalam");
  await ui.sendTeamDirectory("919000000000", "Malayalam", 1);
  await ui.sendTeamDirectory("919000000000", "Malayalam", 2);
  await ui.sendHelpMenu("919000000000", "Malayalam");
  await ui.sendConsentPrompt("919000000000");
  await ui.sendTermsPrivacyMenu("919000000000", "Malayalam");
  await ui.sendWhatsNewAnnouncement("919000000000", "Malayalam", FEATURE_CATALOGUE[0], false);

  calls.forEach(function (payload) {
    const interactive = payload.interactive;
    if (interactive.type === "list") {
      const listRows = rows(payload);
      assert.ok(listRows.length <= 10);
      assert.equal(new Set(listRows.map(function (row) { return row.id; })).size, listRows.length);
      listRows.forEach(function (row) {
        assert.ok(Array.from(row.title).length <= 24, row.title);
        assert.ok(Array.from(row.description || "").length <= 72, row.description);
        assert.ok(row.id.length <= 256, row.id);
      });
    }
    if (interactive.type === "button") {
      assert.ok(interactive.action.buttons.length <= 3);
      interactive.action.buttons.forEach(function (button) {
        assert.ok(Array.from(button.reply.title).length <= 20, button.reply.title);
        assert.ok(button.reply.id.length <= 256, button.reply.id);
      });
    }
  });
});
