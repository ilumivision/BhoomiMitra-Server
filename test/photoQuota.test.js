"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createMemoryPhotoQuota,
  createRedisPhotoQuota,
  indiaDayWindow,
  photoLimitMessage
} = require("../utils/photoQuota");

const HMAC_SECRET = "photo-quota-test-secret-at-least-32-characters";

function createFakeRedis() {
  const sortedSets = new Map();
  const hashes = new Map();
  const commands = [];

  function zset(key) {
    if (!sortedSets.has(key)) sortedSets.set(key, new Map());
    return sortedSets.get(key);
  }
  function hash(key) {
    if (!hashes.has(key)) hashes.set(key, new Map());
    return hashes.get(key);
  }

  return {
    commands,
    async execute(command) {
      commands.push(command.slice());
      const script = command[1] || "";
      const claims = zset(command[3]);
      const owners = hash(command[4]);
      const request = command[7] || command[5];

      if (script.includes("photo-quota:claim:v1")) {
        const now = Number(command[5]);
        for (const [member, score] of claims.entries()) {
          if (score <= now && owners.get(member) !== "accepted") {
            claims.delete(member);
            owners.delete(member);
          }
        }
        if (owners.get(request) === "accepted") return "ALREADY_ACCEPTED";
        if (owners.has(request)) return "IN_FLIGHT";
        if (claims.size >= Number(command[10])) return "LIMIT_REACHED";
        owners.set(request, command[8]);
        claims.set(request, Number(command[6]));
        return "CLAIMED";
      }

      if (script.includes("photo-quota:complete:v1")) {
        const member = command[5];
        const token = command[6];
        if (owners.get(member) === "accepted") return "ALREADY_ACCEPTED";
        if (owners.get(member) !== token) return "NOT_OWNER";
        owners.set(member, "accepted");
        claims.set(member, Number(command[7]));
        return "ACCEPTED";
      }

      if (script.includes("photo-quota:release:v1")) {
        const member = command[5];
        const token = command[6];
        if (owners.get(member) !== token) return "NOT_OWNER";
        owners.delete(member);
        claims.delete(member);
        return "RELEASED";
      }

      throw new Error("Unexpected Redis command");
    }
  };
}

test("photo quota allows three accepted analyses and rejects the fourth", async function () {
  const quota = createMemoryPhotoQuota({
    clock: function () { return new Date("2026-10-21T10:00:00.000Z"); }
  });
  const claims = await Promise.all([1, 2, 3, 4].map(function (index) {
    return quota.claim("BM-F-1", "wamid-" + index);
  }));
  assert.equal(claims.filter(function (claim) { return claim.accepted; }).length, 3);
  assert.equal(claims.filter(function (claim) { return claim.code === "LIMIT_REACHED"; }).length, 1);
  for (let index = 0; index < 3; index += 1) {
    assert.equal((await quota.complete(
      "BM-F-1",
      "wamid-" + (index + 1),
      claims[index].token,
      claims[index].dayKey
    )).success, true);
  }
  assert.equal((await quota.claim("BM-F-2", "wamid-4")).accepted, true);
});

test("failed analyses release reservations and duplicate requests consume no extra quota", async function () {
  const quota = createMemoryPhotoQuota({
    clock: function () { return new Date("2026-10-21T10:00:00.000Z"); }
  });
  const first = await quota.claim("BM-F-1", "same-message");
  assert.equal(first.accepted, true);
  assert.equal((await quota.claim("BM-F-1", "same-message")).code, "IN_FLIGHT");
  assert.equal((await quota.release("BM-F-1", "same-message", first.token)).success, true);
  const retry = await quota.claim("BM-F-1", "same-message");
  assert.equal(retry.accepted, true);
  await quota.complete("BM-F-1", "same-message", retry.token);
  assert.equal((await quota.claim("BM-F-1", "same-message")).code, "ALREADY_ACCEPTED");

  const second = await quota.claim("BM-F-1", "message-2");
  const third = await quota.claim("BM-F-1", "message-3");
  assert.equal(second.accepted, true);
  assert.equal(third.accepted, true);
  assert.equal((await quota.claim("BM-F-1", "message-4")).code, "LIMIT_REACHED");
});

test("expired concurrent reservations are reclaimed safely", async function () {
  let now = new Date("2026-10-21T10:00:00.000Z");
  const quota = createMemoryPhotoQuota({
    limit: 1,
    leaseMs: 1000,
    clock: function () { return now; }
  });
  const abandoned = await quota.claim("BM-F-1", "abandoned");
  assert.equal(abandoned.accepted, true);
  assert.equal((await quota.claim("BM-F-1", "blocked")).code, "LIMIT_REACHED");
  now = new Date("2026-10-21T10:00:02.000Z");
  assert.equal((await quota.claim("BM-F-1", "recovered")).accepted, true);
  assert.equal((await quota.complete("BM-F-1", "abandoned", abandoned.token)).code, "NOT_OWNER");
});

test("a photo accepted before India midnight completes against its original day", async function () {
  let now = new Date("2026-10-21T18:29:59.000Z");
  const quota = createMemoryPhotoQuota({ clock: function () { return now; } });
  const claim = await quota.claim("BM-F-1", "midnight-photo");
  now = new Date("2026-10-21T18:30:01.000Z");
  assert.equal((await quota.complete(
    "BM-F-1", "midnight-photo", claim.token, claim.dayKey
  )).success, true);
  assert.equal((await quota.claim("BM-F-1", "new-day-photo")).accepted, true);
});

test("Redis quota is atomic, restart-safe and uses only opaque identifiers", async function () {
  const redis = createFakeRedis();
  const options = {
    redis,
    hmacSecret: HMAC_SECRET,
    clock: function () { return new Date("2026-10-21T10:00:00.000Z"); }
  };
  const firstProcess = createRedisPhotoQuota(options);
  const first = await firstProcess.claim("BM-F-PRIVATE-1", "wamid.private.1");
  assert.equal(first.accepted, true);
  assert.equal((await firstProcess.complete("BM-F-PRIVATE-1", "wamid.private.1", first.token)).success, true);

  const restartedProcess = createRedisPhotoQuota(options);
  assert.equal(
    (await restartedProcess.claim("BM-F-PRIVATE-1", "wamid.private.1")).code,
    "ALREADY_ACCEPTED"
  );
  const serialized = JSON.stringify(redis.commands);
  assert.doesNotMatch(serialized, /BM-F-PRIVATE-1|wamid\.private\.1/);
});

test("Redis failure rejects photo quota checks instead of allowing an unsafe fallback", async function () {
  const quota = createRedisPhotoQuota({
    redis: { async execute() { throw new Error("outage with private details"); } },
    hmacSecret: HMAC_SECRET
  });
  await assert.rejects(quota.claim("BM-F-1", "wamid-1"), /outage/);
});

test("photo quota day boundary is midnight in India and messages are localized", function () {
  const before = indiaDayWindow(new Date("2026-10-21T18:29:59.000Z"));
  const after = indiaDayWindow(new Date("2026-10-21T18:30:00.000Z"));
  assert.equal(before.dayKey, "2026-10-21");
  assert.equal(after.dayKey, "2026-10-22");
  assert.match(photoLimitMessage("English"), /limit of 3/);
  assert.match(photoLimitMessage("Malayalam"), /3 ഫോട്ടോ/);
});
