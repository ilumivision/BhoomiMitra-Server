"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createRegistrationCoordinator,
  createRegistrationIdFactory
} = require("../utils/registrationIntegrity");
const {
  PRIMARY_HEADERS,
  syncFarmerRegistration,
  upsertMasterMember
} = require("../utils/masterMemberRegistry");
const {
  formatFarmerRegistrationConfirmation
} = require("../utils/registrationFields");

const MASTER_HEADERS = Object.keys(PRIMARY_HEADERS).map(function (key) {
  return PRIMARY_HEADERS[key];
});

function fixedRandomBytes() {
  return Buffer.alloc(8);
}

function columnLetterToIndex(letters) {
  let result = 0;
  for (const character of letters) {
    result = result * 26 + character.charCodeAt(0) - 64;
  }
  return result - 1;
}

function createMasterSheets(initialRows) {
  const rows = initialRows.map(function (row) { return row.slice(); });
  const calls = { append: 0, batchUpdate: 0 };

  return {
    rows,
    calls,
    client: {
      spreadsheets: {
        values: {
          async get() {
            return { data: { values: rows.map(function (row) { return row.slice(); }) } };
          },
          async append(request) {
            calls.append += 1;
            await new Promise(function (resolve) { setImmediate(resolve); });
            rows.push(request.requestBody.values[0].slice());
          },
          async batchUpdate(request) {
            calls.batchUpdate += 1;
            request.requestBody.data.forEach(function (entry) {
              const match = entry.range.match(/!([A-Z]+)(\d+)$/);
              rows[Number(match[2]) - 1][columnLetterToIndex(match[1])] =
                entry.values[0][0];
            });
          }
        }
      }
    }
  };
}

function farmer(overrides) {
  return {
    farmerId: "BM-1700000000000123456000001",
    memberId: "BM-1700000000000123456000001",
    name: "Anu Farmer",
    mobile: "9847298918",
    whatsapp: "919847298918",
    district: "Pathanamthitta",
    panchayath: "Thiruvalla",
    preferredLanguage: "English",
    verificationStatus: "Pending",
    activeStatus: "Active",
    ...(overrides || {})
  };
}

test("Farmer IDs remain numeric-format compatible and unique under a frozen clock", function () {
  const factory = createRegistrationIdFactory({
    now: function () { return 1700000000000; },
    randomBytes: fixedRandomBytes
  });
  const ids = new Set();

  for (let index = 0; index < 1000; index += 1) {
    ids.add(factory.generate("BM-"));
  }

  assert.equal(ids.size, 1000);
  ids.forEach(function (id) {
    assert.match(id, /^BM-\d+$/);
  });
});

test("Farmer ID generation skips IDs already present in the registration sheet snapshot", function () {
  const factory = createRegistrationIdFactory({
    now: function () { return 1700000000000; },
    randomBytes: fixedRandomBytes
  });
  const comparisonFactory = createRegistrationIdFactory({
    now: function () { return 1700000000000; },
    randomBytes: fixedRandomBytes
  });
  const firstCandidate = comparisonFactory.generate("BM-");
  const generated = factory.generate("BM-", [firstCandidate]);

  assert.notEqual(generated, firstCandidate);
  assert.match(generated, /^BM-\d+$/);
});

test("concurrent registration requests for one WhatsApp identity append once", async function () {
  const coordinator = createRegistrationCoordinator({
    now: function () { return 1700000000000; },
    randomBytes: fixedRandomBytes
  });
  const records = [];
  let appendCount = 0;

  async function register() {
    return coordinator.runExclusive("farmer", "+91 98472 98918", async function () {
      const existing = records.find(function (record) {
        return record.phone === "9847298918";
      });
      if (existing) return { action: "existing", farmerId: existing.farmerId };

      await new Promise(function (resolve) { setImmediate(resolve); });
      const farmerId = coordinator.generateId(
        "BM-",
        records.map(function (record) { return record.farmerId; })
      );
      records.push({ phone: "9847298918", farmerId });
      appendCount += 1;
      return { action: "created", farmerId };
    });
  }

  const results = await Promise.all([register(), register()]);
  assert.equal(appendCount, 1);
  assert.equal(records.length, 1);
  assert.equal(results[0].farmerId, results[1].farmerId);
  assert.deepEqual(
    results.map(function (result) { return result.action; }),
    ["created", "existing"]
  );
});

test("an interrupted append response is recovered by the next registration retry", async function () {
  const coordinator = createRegistrationCoordinator({
    now: function () { return 1700000000000; },
    randomBytes: fixedRandomBytes
  });
  const records = [];
  let appendCount = 0;

  async function attempt(interruptAfterAppend) {
    return coordinator.runExclusive("farmer", "9847298918", async function () {
      const existing = records[0];
      if (existing) return { action: "recovered", farmerId: existing.farmerId };

      const farmerId = coordinator.generateId("BM-", []);
      records.push({ farmerId });
      appendCount += 1;
      if (interruptAfterAppend) throw new Error("simulated uncertain response");
      return { action: "created", farmerId };
    });
  }

  await assert.rejects(attempt(true), /simulated uncertain response/);
  const retry = await attempt(false);
  assert.equal(retry.action, "recovered");
  assert.equal(retry.farmerId, records[0].farmerId);
  assert.equal(appendCount, 1);
});

test("failed registration work releases its identity lock for a clean retry", async function () {
  const coordinator = createRegistrationCoordinator();
  await assert.rejects(
    coordinator.runExclusive("farmer", "9847298918", async function () {
      throw new Error("temporary failure");
    }),
    /temporary failure/
  );

  const result = await coordinator.runExclusive(
    "farmer",
    "9847298918",
    async function () { return "retried"; }
  );
  assert.equal(result, "retried");
});

test("partial Master Registry failure is recoverable and preserves the assigned Farmer ID", async function () {
  const registration = farmer();
  let capturedId = "";
  let attempts = 0;
  const upsert = async function (options) {
    attempts += 1;
    capturedId = options.member.bmId;
    if (attempts === 1) throw new Error("temporary Sheets failure");
    return { success: true, action: "appended", bmId: options.member.bmId };
  };

  const failed = await syncFarmerRegistration({ registration, upsert });
  const recovered = await syncFarmerRegistration({ registration, upsert });

  assert.deepEqual(
    { success: failed.success, code: failed.code, recoverable: failed.recoverable },
    { success: false, code: "MASTER_SYNC_EXCEPTION", recoverable: true }
  );
  assert.equal(recovered.success, true);
  assert.equal(recovered.farmerId, registration.farmerId);
  assert.equal(capturedId, registration.farmerId);
});

test("Master synchronization never invents a missing Farmer ID", async function () {
  let called = false;
  const result = await syncFarmerRegistration({
    registration: farmer({ farmerId: "", memberId: "" }),
    upsert: async function () {
      called = true;
      return { success: true };
    }
  });

  assert.equal(result.success, false);
  assert.equal(result.code, "FARMER_ID_REQUIRED");
  assert.equal(result.recoverable, false);
  assert.equal(called, false);
});

test("Master synchronization refuses conflicting existing identities without merging", async function () {
  const registration = farmer();
  const result = await syncFarmerRegistration({
    registration,
    upsert: async function () {
      return {
        success: false,
        code: "MASTER_BM_ID_CONFLICT",
        existingBmId: "BM-EXISTING",
        incomingBmId: registration.farmerId
      };
    }
  });

  assert.equal(result.success, false);
  assert.equal(result.code, "MASTER_BM_ID_CONFLICT");
  assert.equal(result.recoverable, false);
  assert.equal(result.farmerId, registration.farmerId);
});

test("concurrent Master Registry synchronization appends one row", async function () {
  const fake = createMasterSheets([MASTER_HEADERS]);
  const registration = farmer();
  const options = {
    sheets: fake.client,
    spreadsheetId: "test-sheet",
    member: {
      bmId: registration.farmerId,
      name: registration.name,
      memberType: "Farmer",
      mobile: registration.mobile,
      whatsapp: registration.whatsapp,
      verificationStatus: "Pending",
      activeStatus: "Active"
    }
  };

  const results = await Promise.all([
    upsertMasterMember(options),
    upsertMasterMember(options)
  ]);

  assert.equal(fake.calls.append, 1);
  assert.equal(fake.rows.length, 2);
  assert.deepEqual(
    results.map(function (result) { return result.action; }),
    ["appended", "unchanged"]
  );
});

test("recovery does not overwrite populated Master fields", async function () {
  const existing = new Array(MASTER_HEADERS.length).fill("");
  existing[MASTER_HEADERS.indexOf("BM_ID")] = farmer().farmerId;
  existing[MASTER_HEADERS.indexOf("Name")] = "Manually Reviewed Name";
  existing[MASTER_HEADERS.indexOf("mobile No")] = "9847298918";
  existing[MASTER_HEADERS.indexOf("WhatsApp No")] = "919847298918";
  existing[MASTER_HEADERS.indexOf("Last Updated")] = "2025-01-01T00:00:00.000Z";
  const fake = createMasterSheets([MASTER_HEADERS, existing]);

  const result = await syncFarmerRegistration({
    sheets: fake.client,
    spreadsheetId: "test-sheet",
    registration: farmer({ name: "Incoming Name" })
  });

  assert.equal(result.success, true);
  assert.equal(
    fake.rows[1][MASTER_HEADERS.indexOf("Name")],
    "Manually Reviewed Name"
  );
  assert.equal(
    fake.rows[1][MASTER_HEADERS.indexOf("Last Updated")],
    "2025-01-01T00:00:00.000Z"
  );
});

test("English and Malayalam recovery confirmations preserve the existing Farmer ID", function () {
  const registration = farmer();
  const english = formatFarmerRegistrationConfirmation({
    result: registration,
    fallbackPhone: registration.whatsapp,
    language: "English",
    existing: true
  });
  const malayalam = formatFarmerRegistrationConfirmation({
    result: registration,
    fallbackPhone: registration.whatsapp,
    language: "Malayalam",
    existing: true
  });

  assert.match(english, new RegExp(registration.farmerId));
  assert.match(malayalam, new RegExp(registration.farmerId));
  assert.match(english, /already registered/i);
  assert.match(malayalam, /നിലവിലുള്ള|രജിസ്റ്റർ/);
});
