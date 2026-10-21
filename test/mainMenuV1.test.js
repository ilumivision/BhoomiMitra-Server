"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createBhoomiMitraUI } = require("../utils/bhoomiMitraUI");
const { ANIMAL_ACTION_IDS, parseAnimalAction } = require("../utils/animalHusbandry");
const { SCHEME_ACTION_IDS, parseSchemeAction } = require("../utils/schemes");
const { TRAINING_ACTION_IDS, parseTrainingAction } = require("../utils/training");
const { shouldShowWhatsNew } = require("../utils/whatsNew");

const EXPECTED_MAIN_IDS = [
  "HOME_ASK",
  ANIMAL_ACTION_IDS.OPEN,
  "HOME_FARM",
  "FARM_WEATHER_ALERTS",
  "HOME_MARKET",
  "HOME_EXPERT",
  SCHEME_ACTION_IDS.OPEN,
  "HOME_ENTERPRISE",
  "HOME_PROFILE",
  "HOME_MORE"
];

function harness() {
  const calls = [];
  const ui = createBhoomiMitraUI({
    axios: {
      async post(_url, body) {
        calls.push(body);
        return { data: { messages: [{ id: "menu-test" }] } };
      }
    },
    phoneNumberId: "phone-id",
    whatsappToken: "test-token"
  });
  return { calls, ui };
}

function rows(payload) {
  return payload.interactive.action.sections.flatMap(function (section) {
    return section.rows;
  });
}

test("registered farmer menu presents the ten approved options within WhatsApp limits", async function () {
  const { calls, ui } = harness();
  await ui.sendMainMenu("919000000000", "English");
  await ui.sendMainMenuMore("919000000000", "English");

  assert.deepEqual(rows(calls[0]).map(function (row) { return row.id; }), EXPECTED_MAIN_IDS);
  assert.deepEqual(rows(calls[0]).map(function (row) { return row.title; }), [
    "Crop Advisory",
    "Animal Husbandry",
    "My Farm",
    "Weather & Alerts",
    "Market Intelligence",
    "Experts & Training",
    "Government Schemes",
    "Enterprise & Services",
    "My Profile",
    "More Options"
  ]);
  assert.equal(rows(calls[0]).length, 10);
  assert.deepEqual(rows(calls[1]).map(function (row) { return row.id; }), [
    "PROFILE_ABOUT",
    "PROFILE_HELP",
    "CHANGE_LANGUAGE",
    "NAV_HOME"
  ]);
  assert.equal(rows(calls[1])[0].title, "About BhoomiMitra");
  assert.equal(rows(calls[1])[1].title, "Help & User Guide");
  assert.equal(rows(calls[1])[2].title, "Change Language");
});

test("main menu preserves approved institutional wording", async function () {
  const { calls, ui } = harness();
  await ui.sendMainMenu("919000000000", "English");
  const text = calls[0].interactive.body.text;

  assert.match(text, /BhoomiMitra – ഭൂമിമിത്ര/);
  assert.match(text, /A Project of ICAR–Krishi Vigyan Kendra, CARD, Pathanamthitta/);
  assert.match(text, /Powered by IlumiVision/);
});

test("Malayalam is the menu default and explicit English switching remains available", async function () {
  const { calls, ui } = harness();
  await ui.sendMainMenu("919000000000");
  await ui.sendMainMenu("919000000000", "English");

  assert.equal(rows(calls[0])[0].title, "വിള ഉപദേശം");
  assert.equal(rows(calls[0])[8].title, "എന്റെ പ്രൊഫൈൽ");
  assert.equal(rows(calls[1])[0].title, "Crop Advisory");
  assert.equal(rows(calls[1])[8].title, "My Profile");
});

test("new menu navigation IDs connect to dedicated submenus", function () {
  const { ui } = harness();

  assert.equal(ui.getNavigationAction("HOME_MORE"), "MAIN_MENU_MORE");
  assert.equal(ui.getNavigationAction("HOME_ENTERPRISE"), "ENTERPRISE_SERVICES_MENU");
  assert.equal(ui.getNavigationAction("HOME_EXPERT"), "EXPERT_MENU");
  assert.deepEqual(parseAnimalAction(ANIMAL_ACTION_IDS.OPEN), {
    action: "OPEN",
    id: ANIMAL_ACTION_IDS.OPEN
  });
  assert.deepEqual(parseSchemeAction(SCHEME_ACTION_IDS.OPEN), {
    action: "OPEN"
  });
});

test("Experts and Training submenu connects only its current destinations", async function () {
  const { calls, ui } = harness();
  await ui.sendExpertsTrainingMenu("919000000000", "English");
  const ids = rows(calls[0]).map(function (row) { return row.id; });

  assert.deepEqual(ids, [
    "SERVICE_6",
    ANIMAL_ACTION_IDS.EXPERT,
    TRAINING_ACTION_IDS.OPEN,
    "NAV_HOME"
  ]);
  assert.deepEqual(parseTrainingAction(TRAINING_ACTION_IDS.OPEN), {
    action: "OPEN"
  });
});

test("Enterprise and Services exposes only operational directory routes", async function () {
  const { calls, ui } = harness();
  await ui.sendEnterpriseServicesMenu("919000000000", "English");
  const payloadText = JSON.stringify(calls[0].interactive);

  assert.deepEqual(rows(calls[0]).map(function (row) { return row.id; }), [
    "SERVICE_7",
    "SERVICE_8",
    "NAV_HOME"
  ]);
  assert.doesNotMatch(calls[0].interactive.body.text, /Phase 2|coming later/i);
  assert.doesNotMatch(payloadText, /Karshikam|Samrambham|paid|payment/i);
});

test("registered and guest menu surfaces remain separate", async function () {
  const { calls, ui } = harness();
  await ui.sendMainMenu("919000000000", "English");
  await ui.sendGuestMenu("919000000000", "English");

  assert.deepEqual(rows(calls[1]).map(function (row) { return row.id; }), [
    "SERVICE_11",
    "GUEST_EXPLORE",
    "PROFILE_ABOUT",
    "PROFILE_HELP",
    "CHANGE_LANGUAGE"
  ]);
  assert.equal(rows(calls[1]).some(function (row) {
    return ["HOME_FARM", "HOME_PROFILE", "HOME_ENTERPRISE"].includes(row.id);
  }), false);
});

test("guest Explore Services retains approved public information routes", async function () {
  const { calls, ui } = harness();
  await ui.sendGuestExploreMenu("919000000000", "English");

  assert.deepEqual(rows(calls[0]).map(function (row) { return row.id; }), [
    "HOME_ASK",
    "SERVICE_3",
    "SERVICE_4",
    "HOME_MARKET",
    "NAV_HOME"
  ]);
  assert.equal(ui.getNavigationAction("GUEST_EXPLORE"), "PUBLIC_SERVICES_MENU");
});

test("incomplete users receive a Resume Registration guest action", async function () {
  const { calls, ui } = harness();
  await ui.sendGuestMenu("919000000000", "English", { state: "INCOMPLETE" });

  assert.equal(rows(calls[0])[0].id, "SERVICE_11");
  assert.equal(rows(calls[0])[0].title, "Resume Registration");
});

test("service-member menus expose role routes without farmer records or registration", async function () {
  const { calls, ui } = harness();
  await ui.sendServiceMemberMenu("919000000000", "English", ["expert"]);
  await ui.sendServiceMemberMenu("919000000000", "English", ["skilled_worker"]);
  await ui.sendServiceMemberMenu("919000000000", "English", ["service_provider"]);

  assert.deepEqual(rows(calls[0]).map(function (row) { return row.id; }), [
    "GUEST_EXPLORE", "HOME_EXPERT", "PROFILE_ABOUT", "PROFILE_HELP", "CHANGE_LANGUAGE"
  ]);
  assert.deepEqual(rows(calls[1]).map(function (row) { return row.id; }), [
    "GUEST_EXPLORE", "SERVICE_7", "PROFILE_ABOUT", "PROFILE_HELP", "CHANGE_LANGUAGE"
  ]);
  assert.deepEqual(rows(calls[2]).map(function (row) { return row.id; }), [
    "GUEST_EXPLORE", "SERVICE_8", "PROFILE_ABOUT", "PROFILE_HELP", "CHANGE_LANGUAGE"
  ]);
  calls.forEach(function (payload) {
    const ids = rows(payload).map(function (row) { return row.id; });
    assert.equal(ids.includes("SERVICE_11"), false);
    assert.equal(ids.some(function (id) {
      return ["HOME_FARM", "HOME_PROFILE", "SERVICE_9", "SERVICE_10"].includes(id);
    }), false);
  });
});

test("all main-menu list payloads obey WhatsApp row and text limits", async function () {
  const { calls, ui } = harness();
  await ui.sendMainMenu("919000000000", "Malayalam");
  await ui.sendMainMenuMore("919000000000", "Malayalam");
  await ui.sendExpertsTrainingMenu("919000000000", "Malayalam");
  await ui.sendEnterpriseServicesMenu("919000000000", "Malayalam");
  await ui.sendGuestMenu("919000000000", "Malayalam");
  await ui.sendGuestExploreMenu("919000000000", "Malayalam");
  await ui.sendServiceMemberMenu("919000000000", "Malayalam", ["expert", "skilled_worker", "service_provider"]);

  calls.forEach(function (payload) {
    const listRows = rows(payload);
    assert.ok(listRows.length <= 10);
    assert.equal(new Set(listRows.map(function (row) { return row.id; })).size, listRows.length);
    listRows.forEach(function (row) {
      assert.ok(Array.from(row.title).length <= 24, row.title);
      assert.ok(Array.from(row.description || "").length <= 72, row.description);
    });
  });
});

test("Hi Hello MENU HOME and BACK remain free of unsolicited What's New", function () {
  ["Hi", "Hello", "MENU", "HOME", "BACK", "MAIN_MENU", "NAV_HOME", "HOME_MORE"].forEach(function (trigger) {
    assert.equal(shouldShowWhatsNew(trigger), false, trigger);
  });
  assert.equal(shouldShowWhatsNew("WHATS_NEW"), true);
});
