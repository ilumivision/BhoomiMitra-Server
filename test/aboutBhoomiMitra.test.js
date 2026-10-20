"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createBhoomiMitraUI } = require("../utils/bhoomiMitraUI");
const {
  ABOUT_ACTION_IDS,
  TEAM_MEMBERS,
  buildAboutText,
  buildTeamMemberText,
  parseAboutAction
} = require("../utils/aboutBhoomiMitra");

const EXPECTED_TEAM = [
  ["Dr. C. P. Robert", "Senior Scientist & Head", "Project Director & Strategic Leadership"],
  ["Dr. Sindhu Sadanandan", "Subject Matter Specialist – Agricultural Extension", "Project Coordinator & Farmer Outreach"],
  ["Sri Binu John", "Programme Assistant (Computer)", "Digital Operations & Training Coordination"],
  ["Smt. Gayathri", "Programme Assistant (Lab)", "Field Coordination & Farmer Engagement"],
  ["Dr. Vinod Mathew", "Subject Matter Specialist – Agronomy", "Crop Production & Nutrient Management"],
  ["Dr. Rincy K. Abraham", "Subject Matter Specialist – Horticulture", "Horticultural Crops & Orchard Advisory"],
  ["Dr. Sency Mathew", "Subject Matter Specialist – Animal Science", "Livestock, Poultry & Veterinary Advisory Coordination"],
  ["Dr. Alex John", "Subject Matter Specialist – Plant Protection", "Crop Health & Pest-Disease Management"],
  ["Dr. Shana Harshan", "Subject Matter Specialist – Home Science", "Value Addition & Agri-Enterprise Development"],
  ["Smt. Ambily Varughese", "Farm Manager", "Farm Operations & Technology Demonstration"]
];

function harness() {
  const calls = [];
  const ui = createBhoomiMitraUI({
    axios: {
      async post(_url, body) {
        calls.push(body);
        return { data: { messages: [{ id: "mock-message" }] } };
      }
    },
    phoneNumberId: "phone-id",
    whatsappToken: "test-token"
  });
  return { calls, ui };
}

function listRows(payload) {
  return payload.interactive.action.sections.flatMap(function (section) {
    return section.rows;
  });
}

test("About BhoomiMitra uses the exact approved institutional identity", function () {
  const english = buildAboutText("English");
  const malayalam = buildAboutText("Malayalam");

  assert.equal(english, [
    "🌱 BhoomiMitra – ഭൂമിമിത്ര",
    "",
    "A Project of ICAR–Krishi Vigyan Kendra,",
    "CARD, Pathanamthitta",
    "",
    "Powered by IlumiVision"
  ].join("\n"));
  assert.match(malayalam, /BhoomiMitra – ഭൂമിമിത്ര/);
  assert.match(malayalam, /ICAR–കൃഷി വിജ്ഞാന കേന്ദ്രം/);
  assert.match(malayalam, /IlumiVision/);
  assert.doesNotMatch(english + malayalam, /Ilumivision/);
});

test("the public team directory contains exactly the 10 approved members in order", function () {
  assert.equal(TEAM_MEMBERS.length, 10);
  assert.deepEqual(TEAM_MEMBERS.map(function (member) {
    return [member.name, member.designationEnglish, member.roleEnglish];
  }), EXPECTED_TEAM);
  assert.equal(new Set(TEAM_MEMBERS.map(function (member) { return member.id; })).size, 10);

  const publicDirectory = JSON.stringify(TEAM_MEMBERS);
  assert.doesNotMatch(publicDirectory, /Dr\. Sindhu Sudharan/);
  assert.doesNotMatch(publicDirectory, /Dr\. Vincy K\. Abraham/);
  assert.doesNotMatch(publicDirectory, /Dr\. Cincy Mathew/);
  assert.doesNotMatch(publicDirectory, /Smt\. Ambily Varghese/);
  assert.doesNotMatch(publicDirectory, /Smt\. Anu John/);
});

test("all approved member profiles include bilingual designation role and responsibility", function () {
  TEAM_MEMBERS.forEach(function (member) {
    const english = buildTeamMemberText(member, "English");
    const malayalam = buildTeamMemberText(member, "Malayalam");
    assert.match(english, new RegExp(member.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(english, /Designation:/);
    assert.match(english, /Project role:/);
    assert.match(english, /Responsibilities:/);
    assert.match(malayalam, /പദവി:/);
    assert.match(malayalam, /പദ്ധതിയിലെ ചുമതല:/);
    assert.match(malayalam, /പ്രധാന ഉത്തരവാദിത്വങ്ങൾ:/);
  });

});

test("About and Our Team render as an explicit bilingual two-page UI path", async function () {
  const { calls, ui } = harness();
  await ui.sendProfileMenu("919000000000", "English");
  await ui.sendAboutMenu("919000000000", "English");
  await ui.sendTeamDirectory("919000000000", "English", 1);
  await ui.sendTeamDirectory("919000000000", "Malayalam", 2);

  const profileRows = listRows(calls[0]);
  assert.ok(profileRows.some(function (row) { return row.id === ABOUT_ACTION_IDS.OPEN; }));
  assert.equal(profileRows.length, 10);

  const about = calls[1].interactive;
  assert.equal(about.type, "button");
  assert.deepEqual(about.action.buttons.map(function (button) {
    return button.reply.id;
  }), [ABOUT_ACTION_IDS.TEAM, "HOME_PROFILE", "NAV_HOME"]);

  const page1 = listRows(calls[2]);
  const page2 = listRows(calls[3]);
  assert.match(calls[2].interactive.body.text, /Scientific, Technical and Field Implementation Team/);
  assert.match(calls[3].interactive.body.text, /ശാസ്ത്രീയ, സാങ്കേതിക, ഫീൽഡ് നടപ്പാക്കൽ ടീം/);
  assert.equal(page1.length, 8);
  assert.equal(page2.length, 8);
  assert.equal(page1[5].id, ABOUT_ACTION_IDS.TEAM_PAGE_2);
  assert.equal(page2[5].id, ABOUT_ACTION_IDS.TEAM_PAGE_1);

  const memberIds = page1.slice(0, 5).concat(page2.slice(0, 5)).map(function (row) {
    return row.id;
  });
  assert.equal(new Set(memberIds).size, 10);
  assert.deepEqual(memberIds.map(function (id) {
    return parseAboutAction(id).member.name;
  }), EXPECTED_TEAM.map(function (entry) { return entry[0]; }));
});

test("every member selection opens a bounded profile with Team, About and Main controls", async function () {
  const { calls, ui } = harness();

  for (const member of TEAM_MEMBERS) {
    const action = parseAboutAction("ABOUT_MEMBER_" + member.id);
    assert.ok(action);
    await ui.sendTeamMemberProfile(
      "919000000000",
      "English",
      action.member,
      action.page
    );
  }

  assert.equal(calls.length, 10);
  calls.forEach(function (payload, index) {
    const interactive = payload.interactive;
    assert.equal(interactive.type, "button");
    assert.ok(Array.from(interactive.body.text).length <= 1024);
    assert.match(interactive.body.text, new RegExp(EXPECTED_TEAM[index][0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.deepEqual(interactive.action.buttons.slice(1).map(function (button) {
      return button.reply.id;
    }), [ABOUT_ACTION_IDS.OPEN, "NAV_HOME"]);
    interactive.action.buttons.forEach(function (button) {
      assert.ok(Array.from(button.reply.title).length <= 20, button.reply.title);
      assert.ok(button.reply.id.length <= 256, button.reply.id);
    });
  });
});

test("About navigation IDs are deterministic and retain Back and Main routes", function () {
  const { ui } = harness();
  assert.deepEqual(parseAboutAction(ABOUT_ACTION_IDS.OPEN), { type: "ABOUT" });
  assert.deepEqual(parseAboutAction(ABOUT_ACTION_IDS.TEAM), { type: "TEAM", page: 1 });
  assert.deepEqual(parseAboutAction(ABOUT_ACTION_IDS.TEAM_PAGE_2), { type: "TEAM", page: 2 });
  assert.equal(parseAboutAction("ABOUT_MEMBER_unknown"), null);
  assert.equal(ui.getNavigationAction(ABOUT_ACTION_IDS.OPEN), "ABOUT_MENU");
  assert.equal(ui.getNavigationAction("HOME_PROFILE"), "PROFILE_MENU");
  assert.equal(ui.getNavigationAction("NAV_HOME"), "MAIN_MENU");
});
