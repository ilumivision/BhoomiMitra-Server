"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  USER_REGISTRATION_STATES,
  CATEGORY_CONFIGS,
  analyzeRegistrationRows,
  resolveUserRegistrationStatus,
  validateRegistrationIdentityHeaders,
  isGuestAllowedAction
} = require("../utils/userRegistrationStatus");
const {
  shouldShowWhatsNew
} = require("../utils/whatsNew");
const {
  createBhoomiMitraUI
} = require("../utils/bhoomiMitraUI");

const PHONE = "919847298918";

function headers(config) {
  return [
    config.idHeaders[0],
    config.nameHeaders[0],
    config.mobileHeaders[0],
    config.whatsappHeaders[0],
    config.registrationStatusHeaders[0],
    config.verificationStatusHeaders[0],
    config.activeStatusHeaders[0]
  ];
}

function row(config, overrides) {
  const input = Object.assign({
    id: config.category === "farmer" ? "BM-1001" : "BM-MEMBER-1",
    name: "Registered Member",
    mobile: "9847298918",
    whatsapp: PHONE,
    registrationStatus: config.category === "farmer" ? "Registered" : "Approved",
    verificationStatus: config.category === "farmer" ? "Pending" : "Approved",
    activeStatus: "Active"
  }, overrides || {});
  return [
    input.id,
    input.name,
    input.mobile,
    input.whatsapp,
    input.registrationStatus,
    input.verificationStatus,
    input.activeStatus
  ];
}

function sheetRows(overrides) {
  const settings = overrides || {};
  const map = {};
  CATEGORY_CONFIGS.forEach(function (config) {
    map[config.sheetName] = [headers(config)].concat(settings[config.category] || []);
  });
  return map;
}

async function resolve(overrides, options) {
  const rows = sheetRows(overrides);
  return resolveUserRegistrationStatus({
    sender: options && options.sender || PHONE,
    hasRegistrationSession: Boolean(options && options.hasRegistrationSession),
    async readSheetRows(sheetName) {
      return rows[sheetName];
    }
  });
}

test("unique complete active farmer receives registered farmer access", async function () {
  const farmerConfig = CATEGORY_CONFIGS[0];
  const result = await resolve({ farmer: [row(farmerConfig)] });

  assert.equal(result.state, USER_REGISTRATION_STATES.REGISTERED_FARMER);
  assert.equal(result.canAccessPersonalRecords, true);
  assert.equal(result.farmer.id, "BM-1001");
  assert.equal(result.farmer.exactWhatsappMatch, true);
});

test("missing Farmer_ID is incomplete and never upgraded automatically", async function () {
  const farmerConfig = CATEGORY_CONFIGS[0];
  const result = await resolve({ farmer: [row(farmerConfig, { id: "" })] });

  assert.equal(result.state, USER_REGISTRATION_STATES.INCOMPLETE);
  assert.equal(result.canAccessPersonalRecords, false);
  assert.equal(result.memberships[0].id, "");
});

test("inactive farmer is distinguished and cannot access personal records", async function () {
  const farmerConfig = CATEGORY_CONFIGS[0];
  const result = await resolve({
    farmer: [row(farmerConfig, { activeStatus: "Suspended" })]
  });

  assert.equal(result.state, USER_REGISTRATION_STATES.INACTIVE);
  assert.equal(result.canAccessPersonalRecords, false);
});

test("canonical farmer status columns outrank earlier legacy Status columns", function () {
  const farmerConfig = CATEGORY_CONFIGS[0];
  const analysis = analyzeRegistrationRows([
    [
      "Farmer_ID", "Name", "Mobile", "WhatsApp", "Status",
      "Registration_Status", "Active_Status"
    ],
    [
      "BM-1001", "Registered Farmer", "9847298918", PHONE, "Pending",
      "Registered", "Active"
    ]
  ], farmerConfig, "9847298918");

  assert.equal(analysis.matches[0].registrationStatus, "Registered");
  assert.equal(analysis.matches[0].complete, true);
});

test("verification-pending farmer remains eligible with complete active registration", async function () {
  const farmerConfig = CATEGORY_CONFIGS[0];
  const result = await resolve({
    farmer: [row(farmerConfig, {
      verificationStatus: "Pending",
      activeStatus: "Yes"
    })]
  });

  assert.equal(result.state, USER_REGISTRATION_STATES.REGISTERED_FARMER);
  assert.equal(result.canAccessPersonalRecords, true);
});

test("duplicate exact WhatsApp matches require manual verification", async function () {
  const farmerConfig = CATEGORY_CONFIGS[0];
  const result = await resolve({
    farmer: [
      row(farmerConfig),
      row(farmerConfig, { id: "BM-1002", name: "Second Farmer" })
    ]
  });

  assert.equal(result.state, USER_REGISTRATION_STATES.RESTRICTED_VERIFICATION);
  assert.equal(result.reason, "DUPLICATE_IDENTITY_MATCH");
  assert.equal(result.matchCount, 2);
  assert.equal(result.canAccessPersonalRecords, false);
});

test("exact WhatsApp plus another mobile-only row is an ambiguous identity", async function () {
  const farmerConfig = CATEGORY_CONFIGS[0];
  const result = await resolve({
    farmer: [
      row(farmerConfig),
      row(farmerConfig, {
        id: "BM-1002",
        name: "Mobile Collision",
        whatsapp: "919999999999"
      })
    ]
  });

  assert.equal(result.state, USER_REGISTRATION_STATES.RESTRICTED_VERIFICATION);
  assert.equal(result.reason, "DUPLICATE_IDENTITY_MATCH");
  assert.equal(result.matchCount, 2);
});

test("mobile-only farmer match is incomplete because WhatsApp is not verified", async function () {
  const farmerConfig = CATEGORY_CONFIGS[0];
  const result = await resolve({
    farmer: [row(farmerConfig, { whatsapp: "919999999999" })]
  });

  assert.equal(result.state, USER_REGISTRATION_STATES.INCOMPLETE);
  assert.equal(result.reason, "WHATSAPP_IDENTITY_NOT_VERIFIED");
  assert.equal(result.canAccessPersonalRecords, false);
});

test("active expert worker and provider identities are recognized without farmer creation", async function (t) {
  for (const config of CATEGORY_CONFIGS.slice(1)) {
    await t.test(config.category, async function () {
      const result = await resolve({
        [config.category]: [row(config)]
      });

      assert.equal(result.state, USER_REGISTRATION_STATES.REGISTERED_SERVICE_MEMBER);
      assert.deepEqual(result.roles, [config.category]);
      assert.equal(result.canAccessPersonalRecords, false);
      assert.equal(result.farmer, undefined);
    });
  }
});

test("service identities support WhatsApp Number and established Yes and Live values", async function (t) {
  for (const config of CATEGORY_CONFIGS.slice(1)) {
    await t.test(config.category, function () {
      const analysis = analyzeRegistrationRows([
        [
          config.idHeaders[0],
          config.nameHeaders[0],
          config.mobileHeaders[0],
          "WhatsApp Number",
          "Status",
          "Verification_Status",
          config.category === "skilled_worker" ? "Live Status" : "Active_Status"
        ],
        [
          "BM-SERVICE-1",
          "Verified Service Member",
          "9847298918",
          PHONE,
          "Pending",
          "Yes",
          "Live"
        ]
      ], config, "9847298918");

      assert.equal(analysis.schemaValid, true);
      assert.equal(analysis.matches[0].verificationStatus, "Yes");
      assert.equal(analysis.matches[0].activeStatus, "Live");
      assert.equal(analysis.matches[0].complete, true);
    });
  }
});

test("service verification and operational status remain distinct", function () {
  const expertConfig = CATEGORY_CONFIGS[1];
  const analysis = analyzeRegistrationRows([
    [
      "Expert_ID", "Name", "Mobile_No", "WhatsApp_No",
      "Status", "Verification_Status", "Active_Status"
    ],
    [
      "BM-EX-1", "Pending Expert", "9847298918", PHONE,
      "Active", "Pending", "Active"
    ],
    [
      "BM-EX-2", "Unknown Status Expert", "9847000000", PHONE,
      "Approved", "Approved", "Unknown"
    ]
  ], expertConfig, "9847298918");

  assert.equal(analysis.matches[0].registrationStatus, "Active");
  assert.equal(analysis.matches[0].verificationStatus, "Pending");
  assert.equal(analysis.matches[0].complete, false);
  assert.equal(analysis.matches[1].complete, false);
});

test("verified legacy service member may use the established blank-active rule", function () {
  const expertConfig = CATEGORY_CONFIGS[1];
  const analysis = analyzeRegistrationRows([
    [
      "Expert_ID", "Name", "Mobile_No", "WhatsApp Number",
      "Status", "Verification_Status", "Active_Status"
    ],
    [
      "BM-EX-1", "Legacy Expert", "9847298918", PHONE,
      "Verified", "Verified", ""
    ]
  ], expertConfig, "9847298918");

  assert.equal(analysis.matches[0].complete, true);
});

test("unregistered sender remains guest when all identity schemas are available", async function () {
  const result = await resolve({});
  assert.equal(result.state, USER_REGISTRATION_STATES.UNREGISTERED);
  assert.equal(result.canAccessPersonalRecords, false);
});

test("registration write schema requires identity headers and farmer status headers", function () {
  const farmerConfig = CATEGORY_CONFIGS[0];
  const complete = validateRegistrationIdentityHeaders(headers(farmerConfig), farmerConfig);
  const missingWhatsapp = validateRegistrationIdentityHeaders(
    headers(farmerConfig).filter(function (header) {
      return header !== farmerConfig.whatsappHeaders[0];
    }),
    farmerConfig
  );

  assert.deepEqual(complete, { valid: true, missing: [] });
  assert.equal(missingWhatsapp.valid, false);
  assert.ok(missingWhatsapp.missing.includes("whatsapp"));
});

test("guest allowlist permits only public information registration help about and language", function () {
  [
    "HOME_ASK", "HOME_MARKET", "SERVICE_1", "SERVICE_2", "SERVICE_3",
    "SERVICE_4", "SERVICE_5", "SERVICE_11", "PROFILE_HELP", "PROFILE_ABOUT",
    "CHANGE_LANGUAGE", "ABOUT_TEAM", "GUIDE_PAGE_1"
  ].forEach(function (id) {
    assert.equal(isGuestAllowedAction(id), true, id);
  });
  [
    "HOME_FARM", "HOME_EXPERT", "HOME_PROFILE", "SERVICE_6", "SERVICE_9",
    "SERVICE_10", "PERSONAL_DETAILS", "LAND_VIEW", "ANIMAL_MY_ANIMALS"
  ].forEach(function (id) {
    assert.equal(isGuestAllowedAction(id), false, id);
  });
});

test("MENU HOME and BACK never request What's New while explicit action does", function () {
  ["MENU", "HOME", "BACK", "MAIN_MENU", "NAV_HOME", ""].forEach(function (trigger) {
    assert.equal(shouldShowWhatsNew(trigger), false, trigger);
  });
  assert.equal(shouldShowWhatsNew("WHATS_NEW"), true);
});

test("guest menu is bilingual and contains only approved stable actions", async function () {
  const calls = [];
  const ui = createBhoomiMitraUI({
    axios: {
      async post(_url, body) {
        calls.push(body);
        return { data: { messages: [{ id: "mock" }] } };
      }
    },
    phoneNumberId: "phone-id",
    whatsappToken: "token"
  });

  await ui.sendGuestMenu(PHONE, "English");
  await ui.sendGuestMenu(PHONE, "Malayalam");

  calls.forEach(function (payload) {
    const rows = payload.interactive.action.sections[0].rows;
    assert.deepEqual(rows.map(function (item) { return item.id; }), [
      "HOME_ASK", "SERVICE_3", "SERVICE_4", "HOME_MARKET",
      "PROFILE_HELP", "PROFILE_ABOUT", "SERVICE_11", "CHANGE_LANGUAGE"
    ]);
    assert.ok(rows.every(function (item) { return isGuestAllowedAction(item.id); }));
  });
  assert.match(calls[0].interactive.body.text, /Limited general services/);
  assert.match(calls[1].interactive.body.text, /പരിമിതമായ പൊതുവായ സേവനങ്ങൾ/);
});
