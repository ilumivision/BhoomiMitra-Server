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
  ["Dr. C. P. Robert", "Senior Scientist & Head", "Project Leader"],
  ["Dr. Vinod Mathew", "Subject Matter Specialist – Agronomy", "Crop Production & Agronomy Coordinator"],
  ["Dr. Shana Harshan", "Subject Matter Specialist – Home Science", "Farm Family Welfare & Value Addition Coordinator"],
  ["Dr. Sency Mathew", "Subject Matter Specialist – Animal Science", "Animal Husbandry & Livestock Advisory Coordinator"],
  ["Dr. Sindhu Sadanandan", "Subject Matter Specialist – Agricultural Extension", "Overall Field Implementation & Farmer Outreach Coordinator"],
  ["Dr. Rincy K. Abraham", "Subject Matter Specialist – Horticulture", "Horticulture Coordinator"],
  ["Dr. Alex John", "Subject Matter Specialist – Plant Protection", "Plant Health & Technical Validation Coordinator"],
  ["Sri Binu John", "Programme Assistant – Computer", "Digital Operations & Training Coordinator"],
  ["Smt. Ambily Varughese", "Farm Manager", "Farm Demonstration & Field Operations Coordinator"],
  ["Smt. Gayatri S", "Programme Assistant – Lab Technician", "Laboratory Information & Data Support Coordinator"],
  ["Smt. Anu John", "Junior Stenographer", "Administrative Support"]
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

test("About BhoomiMitra uses the approved identity, attribution and tagline", function () {
  const english = buildAboutText("English");
  const malayalam = buildAboutText("Malayalam");

  assert.match(english, /🌱 BhoomiMitra/);
  assert.match(english, /AI-Powered Agricultural Assistance Platform/);
  assert.match(english, /A Project of:\nICAR–Krishi Vigyan Kendra, CARD, Pathanamthitta/);
  assert.match(english, /Powered by:\nIlumivision, Manjadi, Thiruvalla/);
  assert.match(english, /മണ്ണിന്റെ നന്മയ്ക്ക്, കർഷകന്റെ കൂട്ടായി/);
  assert.match(english, /subject to institutional approval before deployment/);
  assert.match(malayalam, /AI സഹായത്തോടെ പ്രവർത്തിക്കുന്ന കാർഷിക സഹായ പ്ലാറ്റ്ഫോം/);
  assert.match(malayalam, /ICAR–കൃഷി വിജ്ഞാന കേന്ദ്രം, CARD, പത്തനംതിട്ട/);
  assert.match(malayalam, /Ilumivision, മഞ്ഞാടി, തിരുവല്ല/);
});

test("the public team directory contains exactly the 11 approved members in order", function () {
  assert.equal(TEAM_MEMBERS.length, 11);
  assert.deepEqual(TEAM_MEMBERS.map(function (member) {
    return [member.name, member.designationEnglish, member.roleEnglish];
  }), EXPECTED_TEAM);
  assert.equal(new Set(TEAM_MEMBERS.map(function (member) { return member.id; })).size, 11);

  const publicDirectory = JSON.stringify(TEAM_MEMBERS);
  assert.doesNotMatch(publicDirectory, /Dr\. Sindhu Sudharan/);
  assert.doesNotMatch(publicDirectory, /Dr\. Vincy K\. Abraham/);
  assert.doesNotMatch(publicDirectory, /Dr\. Cincy Mathew/);
  assert.doesNotMatch(publicDirectory, /Smt\. Ambily Varghese/);
  assert.doesNotMatch(publicDirectory, /Smt\. Gayathri/);
});

test("member profiles include role responsibilities except the approved Anu John exception", function () {
  TEAM_MEMBERS.slice(0, 10).forEach(function (member) {
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

  const anu = TEAM_MEMBERS[10];
  const anuEnglish = buildTeamMemberText(anu, "English");
  const anuMalayalam = buildTeamMemberText(anu, "Malayalam");
  assert.match(anuEnglish, /Smt\. Anu John/);
  assert.match(anuEnglish, /Junior Stenographer/);
  assert.match(anuEnglish, /Administrative Support/);
  assert.doesNotMatch(anuEnglish, /Responsibilities:/);
  assert.doesNotMatch(anuMalayalam, /പ്രധാന ഉത്തരവാദിത്വങ്ങൾ:/);
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
  assert.equal(page1.length, 10);
  assert.equal(page2.length, 7);
  assert.equal(page1[7].id, ABOUT_ACTION_IDS.TEAM_PAGE_2);
  assert.equal(page2[4].id, ABOUT_ACTION_IDS.TEAM_PAGE_1);

  const memberIds = page1.slice(0, 7).concat(page2.slice(0, 4)).map(function (row) {
    return row.id;
  });
  assert.equal(new Set(memberIds).size, 11);
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

  assert.equal(calls.length, 11);
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
