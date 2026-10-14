"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  handlePersonalRecords,
  isPersonalRecordCommand,
  normalizePhone,
  getMemberByPhone
} = require("../utils/personalRecords");
const {
  createBhoomiMitraUI
} = require("../utils/bhoomiMitraUI");
const {
  SERVICE_OPTIONS,
  parseServiceSelections,
  getServicePrompt
} = require("../utils/menu");

function columnLetterToIndex(letters) {
  let result = 0;

  for (const character of letters) {
    result =
      result * 26 +
      character.charCodeAt(0) - 64;
  }

  return result - 1;
}

function makeLiveHeaders(whatsappHeader) {
  const headers =
    new Array(columnLetterToIndex("BG") + 1)
      .fill("");

  headers[columnLetterToIndex("A")] = "Farmer_ID";
  headers[columnLetterToIndex("B")] = "Name";
  headers[columnLetterToIndex("D")] = "Mobile";
  headers[columnLetterToIndex("E")] =
    whatsappHeader || "WhatApp";
  headers[columnLetterToIndex("G")] = "Distrct";
  headers[columnLetterToIndex("I")] = "Panchayath";
  headers[columnLetterToIndex("N")] = "Main Crop";
  headers[columnLetterToIndex("X")] = "Status";
  headers[columnLetterToIndex("AL")] = "Preferred Language";
  headers[columnLetterToIndex("AO")] = "Verification_Status";
  headers[columnLetterToIndex("AQ")] = "Active_Status";
  headers[columnLetterToIndex("BG")] = "Preferred_Language";

  return headers;
}

function makeFarmerRow(values) {
  const row =
    new Array(columnLetterToIndex("BG") + 1)
      .fill("");
  const data = {
    farmerId: "BM-1001",
    name: "Anu Farmer",
    mobile: "9847298918",
    whatsapp: "919847298918",
    district: "Pathanamthitta",
    panchayath: "Thiruvalla",
    mainCrop: "Rambutan",
    legacyLanguage: "",
    preferredLanguage: "English",
    registrationStatus: "Registered",
    verificationStatus: "Pending",
    activeStatus: "Active",
    ...(values || {})
  };

  row[columnLetterToIndex("A")] = data.farmerId;
  row[columnLetterToIndex("B")] = data.name;
  row[columnLetterToIndex("D")] = data.mobile;
  row[columnLetterToIndex("E")] = data.whatsapp;
  row[columnLetterToIndex("G")] = data.district;
  row[columnLetterToIndex("I")] = data.panchayath;
  row[columnLetterToIndex("N")] = data.mainCrop;
  row[columnLetterToIndex("X")] = data.registrationStatus;
  row[columnLetterToIndex("AL")] = data.legacyLanguage;
  row[columnLetterToIndex("AO")] = data.verificationStatus;
  row[columnLetterToIndex("AQ")] = data.activeStatus;
  row[columnLetterToIndex("BG")] = data.preferredLanguage;

  return row;
}

function createFakeSheets(options) {
  const settings = options || {};
  const calls = [];
  const farmers = settings.farmers || [
    makeLiveHeaders(),
    makeFarmerRow()
  ];
  const lands = settings.lands || [];
  const animals = settings.animals || [];
  const experts = settings.experts || [];

  return {
    calls,
    client: {
      spreadsheets: {
        values: {
          async get(request) {
            calls.push(request.range);

            if (request.range.startsWith("Farmers!")) {
              return { data: { values: farmers } };
            }

            if (request.range.startsWith("Land_Parcels!")) {
              return { data: { values: lands } };
            }

            if (request.range.startsWith("Animal_Registry!")) {
              return { data: { values: animals } };
            }

            if (request.range.startsWith("Expert_Directory!")) {
              return { data: { values: experts } };
            }

            throw new Error("Unexpected range: " + request.range);
          }
        }
      }
    }
  };
}

function makeAnimalRows() {
  return [
    [
      "Animal_ID",
      "WhatsApp_No",
      "Animal_Type",
      "Breed",
      "Sex",
      "Age",
      "Tag_Number",
      "Vaccination_Status",
      "Health_Status",
      "Active_Status"
    ],
    [
      "AN-1",
      "9847298918",
      "Cow",
      "Jersey",
      "Female",
      "4",
      "TAG-1",
      "Current",
      "Healthy",
      "Active"
    ]
  ];
}

async function runPersonalCommand(options) {
  const fake =
    createFakeSheets(options);
  const result =
    await handlePersonalRecords({
      phone:
        options && options.phone
          ? options.phone
          : "9847298918",
      userText:
        options && options.userText
          ? options.userText
          : "my profile",
      language:
        options && options.language
          ? options.language
          : "English",
      sheets: fake.client,
      spreadsheetId: "test-sheet"
    });

  return { result, fake };
}

test("normalizes +91, 91 and 10-digit phones to one identity", function () {
  assert.equal(normalizePhone("+91 98472 98918"), "9847298918");
  assert.equal(normalizePhone("919847298918"), "9847298918");
  assert.equal(normalizePhone("9847298918"), "9847298918");
});

test("looks up a Farmer by Mobile and reads only through BG", async function () {
  const fake = createFakeSheets();
  const lookup = await getMemberByPhone({
    phone: "+91 98472 98918",
    sheets: fake.client,
    spreadsheetId: "test-sheet"
  });

  assert.equal(lookup.state, "match");
  assert.equal(lookup.matches.length, 1);
  assert.deepEqual(fake.calls, ["Farmers!A:BG"]);
});

test("supports WhatApp and retained WhatsApp header aliases", async function (t) {
  for (const header of [
    "WhatApp",
    "WhatsApp",
    "WhatsApp No",
    "WhatsApp_No"
  ]) {
    await t.test(header, async function () {
      const farmers = [
        makeLiveHeaders(header),
        makeFarmerRow({ mobile: "" })
      ];
      const lookup = await getMemberByPhone({
        phone: "9847298918",
        sheets: createFakeSheets({ farmers }).client,
        spreadsheetId: "test-sheet"
      });

      assert.equal(lookup.state, "match");
      assert.equal(lookup.matches[0].farmerId, "BM-1001");
    });
  }
});

test("returns explicit no-match state", async function () {
  const fake = createFakeSheets({
    farmers: [makeLiveHeaders()]
  });
  const lookup = await getMemberByPhone({
    phone: "9000000000",
    sheets: fake.client,
    spreadsheetId: "test-sheet"
  });

  assert.equal(lookup.state, "no_match");
  assert.deepEqual(lookup.matches, []);
});

test("refuses multiple normalized-phone matches and reports Farmer IDs internally", async function () {
  const farmers = [
    makeLiveHeaders(),
    makeFarmerRow({ farmerId: "BM-1001" }),
    makeFarmerRow({
      farmerId: "BM-1002",
      name: "Second Farmer",
      mobile: "+91 98472 98918",
      whatsapp: ""
    })
  ];
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = function (...args) {
    warnings.push(args);
  };

  try {
    const { result } = await runPersonalCommand({
      farmers,
      phone: "919847298918",
      language: "English"
    });

    assert.equal(result.lookupState, "multiple_matches");
    assert.match(result.reply, /more than one Farmer record/i);
    assert.doesNotMatch(result.reply, /BM-1001|BM-1002|Anu Farmer|Second Farmer/);
    assert.deepEqual(
      warnings[0][1].farmerIds,
      ["BM-1001", "BM-1002"]
    );
  } finally {
    console.warn = originalWarn;
  }
});

test("English My Profile displays all approved live-header fields", async function () {
  const { result } = await runPersonalCommand({
    language: "English"
  });

  assert.equal(result.lookupState, "match");
  assert.match(result.reply, /My BhoomiMitra Profile/);
  assert.match(result.reply, /Farmer ID: BM-1001/);
  assert.match(result.reply, /Name: Anu Farmer/);
  assert.match(result.reply, /District: Pathanamthitta/);
  assert.match(result.reply, /Panchayath: Thiruvalla/);
  assert.match(result.reply, /Main Crop: Rambutan/);
  assert.match(result.reply, /Preferred Language: English/);
  assert.match(result.reply, /Registration Status: Registered/);
  assert.match(result.reply, /Verification Status: Pending/);
  assert.match(result.reply, /Active Status: Active/);
  assert.doesNotMatch(result.reply, /Expert ID|Remarks|Source|BM_ID|row number/i);
});

test("Preferred_Language in BG has priority over legacy Preferred Language", async function () {
  const farmers = [
    makeLiveHeaders(),
    makeFarmerRow({
      legacyLanguage: "English",
      preferredLanguage: "Malayalam"
    })
  ];
  const { result } = await runPersonalCommand({ farmers });

  assert.match(result.reply, /എന്റെ ഭൂമിമിത്ര പ്രൊഫൈൽ/);
  assert.match(result.reply, /ഇഷ്ട ഭാഷ: മലയാളം/);
});

test("Malayalam preference produces a Malayalam profile and localized statuses", async function () {
  const farmers = [
    makeLiveHeaders(),
    makeFarmerRow({ preferredLanguage: "Malayalam" })
  ];
  const { result } = await runPersonalCommand({
    farmers,
    language: "English"
  });

  assert.match(result.reply, /എന്റെ ഭൂമിമിത്ര പ്രൊഫൈൽ/);
  assert.match(result.reply, /കർഷക ഐഡി: BM-1001/);
  assert.match(result.reply, /രജിസ്ട്രേഷൻ നില: രജിസ്റ്റർ ചെയ്തു/);
  assert.match(result.reply, /പരിശോധന നില: പരിശോധന കാത്തിരിക്കുന്നു/);
  assert.match(result.reply, /സജീവ നില: സജീവം/);
});

test("historical Bilingual values remain readable and fall back safely", async function () {
  const farmers = [
    makeLiveHeaders(),
    makeFarmerRow({ preferredLanguage: "Bilingual" })
  ];
  const { result } = await runPersonalCommand({
    farmers,
    language: "English"
  });

  assert.match(result.reply, /My BhoomiMitra Profile/);
  assert.match(result.reply, /Preferred Language: Bilingual/);
});

test("missing usable language preference uses Malayalam-first fallback", async function () {
  const farmers = [
    makeLiveHeaders(),
    makeFarmerRow({ preferredLanguage: "" })
  ];
  const { result } = await runPersonalCommand({
    farmers,
    language: "Bilingual"
  });

  assert.match(result.reply, /എന്റെ ഭൂമിമിത്ര പ്രൊഫൈൽ/);
});

test("same normalized Mobile and WhatsApp render as one combined line", async function () {
  const { result } = await runPersonalCommand({
    language: "English"
  });

  assert.match(result.reply, /Mobile \/ WhatsApp: 919847298918/);
  assert.doesNotMatch(result.reply, /^Mobile:/m);
  assert.doesNotMatch(result.reply, /^WhatsApp:/m);
});

test("different Mobile and WhatsApp render as separate lines", async function () {
  const farmers = [
    makeLiveHeaders(),
    makeFarmerRow({
      mobile: "9847298918",
      whatsapp: "919999999999"
    })
  ];
  const { result } = await runPersonalCommand({
    farmers,
    phone: "9847298918",
    language: "English"
  });

  assert.match(result.reply, /^Mobile: 9847298918$/m);
  assert.match(result.reply, /^WhatsApp: 919999999999$/m);
  assert.doesNotMatch(result.reply, /Mobile \/ WhatsApp:/);
});

test("My Details remains a backward-compatible alias for My Profile", async function () {
  const profile = await runPersonalCommand({
    userText: "my profile",
    language: "English"
  });
  const details = await runPersonalCommand({
    userText: "my details",
    language: "English"
  });

  assert.equal(details.result.reply, profile.result.reply);
  assert.equal(isPersonalRecordCommand("my details"), true);
  assert.equal(isPersonalRecordCommand("my profile"), true);
});

test("My Farmer ID remains functional", async function () {
  const { result } = await runPersonalCommand({
    userText: "my farmer id",
    language: "English"
  });

  assert.match(result.reply, /BhoomiMitra Farmer ID/);
  assert.match(result.reply, /Farmer ID: BM-1001/);
});

test("My Lands route keeps the existing land retrieval behavior", async function () {
  const lands = [
    [
      "Land_ID",
      "Phone",
      "Farm_Name",
      "District",
      "Local_Body",
      "GPS_Calculated_Area",
      "Area_Unit",
      "Main_Crop"
    ],
    [
      "LAND-1",
      "+91 98472 98918",
      "Home Farm",
      "Pathanamthitta",
      "Thiruvalla",
      "2",
      "Acre",
      "Rambutan"
    ]
  ];
  const { result } = await runPersonalCommand({
    userText: "my lands",
    lands
  });

  assert.match(result.reply, /My Registered Lands/);
  assert.match(result.reply, /Land ID: LAND-1/);
  assert.match(result.reply, /Main crop: Rambutan/);
});

test("My Animals route keeps the existing animal retrieval behavior", async function () {
  const { result } = await runPersonalCommand({
    userText: "my animals",
    animals: makeAnimalRows()
  });

  assert.match(result.reply, /My Registered Animals/);
  assert.match(result.reply, /Animal ID: AN-1/);
  assert.match(result.reply, /Breed: Jersey/);
});

test("My Records uses interactive tap/list selections with preserved IDs", async function () {
  const calls = [];
  const ui = createBhoomiMitraUI({
    axios: {
      async post(url, body) {
        calls.push({ url, body });
        return { data: { ok: true } };
      }
    },
    phoneNumberId: "phone-id",
    whatsappToken: "token"
  });

  await ui.sendPersonalRecordsMenu("919847298918", "English");

  const interactive = calls[0].body.interactive;
  const rows = interactive.action.sections[0].rows;
  assert.equal(interactive.type, "list");
  assert.deepEqual(
    rows.map(function (row) { return row.id; }),
    [
      "PERSONAL_DETAILS",
      "PERSONAL_LANDS",
      "PERSONAL_ANIMALS",
      "PERSONAL_FARMER_ID",
      "NAV_HOME"
    ]
  );
  assert.equal(
    new Set(
      rows.map(function (row) { return row.id; })
    ).size,
    rows.length
  );
  assert.deepEqual(
    rows.map(function (row) { return row.title; }),
    [
      "👤 My Profile",
      "🌾 My Lands / Farms",
      "🐄 My Animals",
      "🪪 My Farmer ID",
      "↩️ Back"
    ]
  );
  assert.equal(
    ui.getNavigationAction("NAV_HOME"),
    "MAIN_MENU"
  );
});

test("Malayalam My Records menu uses natural localized tap labels", async function () {
  const calls = [];
  const ui = createBhoomiMitraUI({
    axios: {
      async post(url, body) {
        calls.push({ url, body });
        return { data: { ok: true } };
      }
    },
    phoneNumberId: "phone-id",
    whatsappToken: "token"
  });

  await ui.sendPersonalRecordsMenu("919847298918", "Malayalam");

  const rows =
    calls[0].body.interactive.action.sections[0].rows;
  assert.deepEqual(
    rows.map(function (row) { return row.id; }),
    [
      "PERSONAL_DETAILS",
      "PERSONAL_LANDS",
      "PERSONAL_ANIMALS",
      "PERSONAL_FARMER_ID",
      "NAV_HOME"
    ]
  );
  assert.match(calls[0].body.interactive.body.text, /എന്റെ രേഖകൾ/);
  assert.match(rows[0].title, /എന്റെ പ്രൊഫൈൽ/);
  assert.match(rows[1].title, /എന്റെ ഭൂമി/);
  assert.match(rows[3].title, /കർഷക ഐഡി/);
});

test("Bilingual is not offered and falls back to Malayalam-first navigation", async function () {
  const calls = [];
  const ui = createBhoomiMitraUI({
    axios: {
      async post(url, body) {
        calls.push({ url, body });
        return { data: { ok: true } };
      }
    },
    phoneNumberId: "phone-id",
    whatsappToken: "token"
  });

  await ui.sendLanguageSelection("919847298918");
  await ui.sendProfileMenu(
    "919847298918",
    "Bilingual"
  );
  await ui.sendPersonalRecordsMenu(
    "919847298918",
    "Bilingual"
  );

  const languagePayload =
    JSON.stringify(calls[0].body.interactive);
  const recordsPayload =
    calls[2].body.interactive;

  assert.doesNotMatch(languagePayload, /bilingual/i);
  assert.match(
    calls[1].body.interactive.body.text,
    /എന്റെ BhoomiMitra/
  );
  assert.match(recordsPayload.body.text, /എന്റെ രേഖകൾ/);
});

test("English and Malayalam My Animals taps route to the same animal command", async function () {
  const calls = [];
  const ui = createBhoomiMitraUI({
    axios: {
      async post(url, body) {
        calls.push({ url, body });
        return { data: { ok: true } };
      }
    },
    phoneNumberId: "phone-id",
    whatsappToken: "token"
  });

  await ui.sendPersonalRecordsMenu("9847298918", "English");
  await ui.sendPersonalRecordsMenu("9847298918", "Malayalam");

  const englishAnimal =
    calls[0].body.interactive.action.sections[0].rows
      .find(function (row) {
        return row.title.includes("My Animals");
      });
  const malayalamAnimal =
    calls[1].body.interactive.action.sections[0].rows
      .find(function (row) {
        return row.title.includes("എന്റെ മൃഗങ്ങൾ");
      });

  assert.equal(englishAnimal.id, "PERSONAL_ANIMALS");
  assert.equal(malayalamAnimal.id, "PERSONAL_ANIMALS");

  const command =
    ui.getLegacyServiceCommand(englishAnimal.id);
  assert.equal(command, "my animals");
  assert.notEqual(command, "4");

  const { result } = await runPersonalCommand({
    userText: command,
    animals: makeAnimalRows()
  });

  assert.match(result.reply, /My Registered Animals/);
  assert.doesNotMatch(result.reply, /BM-SP-|Service Provider/i);
});

test("My Records selections map to semantic personal-record commands", function () {
  const calls = [];
  const ui = createBhoomiMitraUI({
    axios: {
      async post(url, body) {
        calls.push({ url, body });
        return { data: { ok: true } };
      }
    },
    phoneNumberId: "phone-id",
    whatsappToken: "token"
  });

  assert.equal(
    ui.getLegacyServiceCommand("PERSONAL_DETAILS"),
    "my details"
  );
  assert.equal(
    ui.getLegacyServiceCommand("PERSONAL_FARMER_ID"),
    "my farmer id"
  );
  assert.equal(
    ui.getLegacyServiceCommand("PERSONAL_LANDS"),
    "my land"
  );
  assert.equal(
    ui.getLegacyServiceCommand("PERSONAL_ANIMALS"),
    "my animals"
  );
  assert.notEqual(
    ui.getLegacyServiceCommand("PERSONAL_ANIMALS"),
    "4"
  );
  assert.equal(
    isPersonalRecordCommand(
      ui.getLegacyServiceCommand("PERSONAL_ANIMALS")
    ),
    true
  );
  assert.match(
    getServicePrompt("personal_records"),
    /Legacy fallback/
  );
});

test("Service Provider registration entry remains on the Membership route", function () {
  assert.equal(SERVICE_OPTIONS["11"].key, "registration");
  assert.deepEqual(
    parseServiceSelections("11"),
    [
      {
        number: "11",
        key: "registration",
        label: "Register as a BhoomiMitra Member"
      }
    ]
  );
  assert.equal(
    createBhoomiMitraUI({
      axios: { post() {} },
      phoneNumberId: "phone-id",
      whatsappToken: "token"
    }).getLegacyServiceCommand("SERVICE_11"),
    "11"
  );
});

test("unregistered Farmers receive localized guidance and an existing registration-path signal", async function () {
  const farmers = [makeLiveHeaders()];
  const english = await runPersonalCommand({
    farmers,
    phone: "9000000000",
    language: "English"
  });
  const malayalam = await runPersonalCommand({
    farmers,
    phone: "9000000000",
    language: "Malayalam"
  });

  assert.equal(english.result.lookupState, "no_match");
  assert.equal(english.result.showRegistrationPath, true);
  assert.match(english.result.reply, /choose Membership/i);
  assert.equal(malayalam.result.lookupState, "no_match");
  assert.match(malayalam.result.reply, /രജിസ്ട്രേഷൻ കണ്ടെത്താനായില്ല/);
});
