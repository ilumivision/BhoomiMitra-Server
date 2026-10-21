"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEFAULT_DEDUP_TTL_MS,
  createRedisMessageLedger
} = require("../utils/webhookSecurity");
const {
  createRedisFeatureDiscovery,
  FEATURE_CATALOGUE
} = require("../utils/whatsNew");
const {
  DurableStateUnavailableError,
  createRedisRestClient,
  isProductionRuntime,
  resolveStateConfiguration,
  validateRedisConfiguration
} = require("../utils/redisState");

const HMAC_SECRET = "fixture-state-hmac-secret-with-32-chars";

function createAtomicRedis(clock) {
  const entries = new Map();
  const commands = [];

  function currentTime() {
    return clock ? clock.now : Date.now();
  }

  function get(key) {
    const entry = entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt != null && entry.expiresAt <= currentTime()) {
      entries.delete(key);
      return null;
    }
    return entry.value;
  }

  function set(key, value, ttlMs, onlyIfAbsent) {
    if (onlyIfAbsent && get(key) != null) return null;
    entries.set(key, {
      value,
      expiresAt: ttlMs == null ? null : currentTime() + Number(ttlMs)
    });
    return "OK";
  }

  async function execute(command) {
    commands.push(command.slice());
    const operation = command[0];
    if (operation === "GET") return get(command[1]);
    if (operation === "SET") {
      return set(command[1], command[2], null, command.includes("NX"));
    }
    if (operation !== "EVAL") throw new Error("Unsupported fake Redis command.");

    const script = command[1];
    const key = command[3];
    const token = command[4];
    const argument = command[5];
    const value = get(key);

    if (script.includes("webhook:claim:v1")) {
      if (value == null && set(key, "pending:" + token, argument, true)) {
        return ["CLAIMED", token];
      }
      return String(get(key) || "").startsWith("completed:")
        ? ["ALREADY_COMPLETED", ""]
        : ["ALREADY_IN_FLIGHT", ""];
    }
    if (script.includes("webhook:complete:v1")) {
      if (value === "pending:" + token) {
        set(key, "completed:v1", argument, false);
        return "COMPLETED";
      }
      return String(value || "").startsWith("completed:")
        ? "ALREADY_COMPLETED"
        : "LEASE_LOST";
    }
    if (script.includes("webhook:release:v1")) {
      if (value === "pending:" + token) {
        entries.delete(key);
        return "RELEASED";
      }
      return "NOT_OWNER";
    }
    if (script.includes("announcement:claim:v1")) {
      if (value == null && set(key, "pending:" + token, argument, true)) {
        return "CLAIMED";
      }
      return String(get(key) || "").startsWith("pending:")
        ? "IN_FLIGHT"
        : "PERMANENT";
    }
    if (script.includes("announcement:delivered:v1")) {
      if (value === "pending:" + token || value == null) {
        set(key, "delivered", null, value == null);
        return "DELIVERED";
      }
      return ["delivered", "opened", "dismissed"].includes(value)
        ? "ALREADY_RECORDED"
        : "NOT_OWNER";
    }
    if (script.includes("announcement:release:v1")) {
      if (value === "pending:" + token) {
        entries.delete(key);
        return "RELEASED";
      }
      return "NOT_OWNER";
    }
    throw new Error("Unsupported fake Redis script.");
  }

  return { commands, entries, execute };
}

test("Redis webhook claims are atomic and completed duplicates survive adapter restarts", async function () {
  const clock = { now: 1000 };
  const redis = createAtomicRedis(clock);
  const firstProcess = createRedisMessageLedger({ redis, hmacSecret: HMAC_SECRET });
  const secondProcess = createRedisMessageLedger({ redis, hmacSecret: HMAC_SECRET });

  const claims = await Promise.all([
    firstProcess.claim("wamid.CONCURRENT-PRIVATE"),
    secondProcess.claim("wamid.CONCURRENT-PRIVATE")
  ]);
  assert.equal(claims.filter(function (claim) { return claim.accepted; }).length, 1);
  assert.equal(claims.filter(function (claim) { return claim.code === "ALREADY_IN_FLIGHT"; }).length, 1);

  const owner = claims.find(function (claim) { return claim.accepted; });
  await firstProcess.complete("wamid.CONCURRENT-PRIVATE", owner.token);
  assert.equal(
    Array.from(redis.entries.values())[0].expiresAt,
    clock.now + DEFAULT_DEDUP_TTL_MS
  );
  const restartedProcess = createRedisMessageLedger({ redis, hmacSecret: HMAC_SECRET });
  assert.equal((await restartedProcess.claim("wamid.CONCURRENT-PRIVATE")).code, "ALREADY_COMPLETED");

  const serializedCommands = JSON.stringify(redis.commands);
  assert.doesNotMatch(serializedCommands, /CONCURRENT-PRIVATE/);
});

test("failed webhook work can release its owned claim and retry safely", async function () {
  const redis = createAtomicRedis();
  const ledger = createRedisMessageLedger({ redis, hmacSecret: HMAC_SECRET });
  const claim = await ledger.claim("wamid.FAILED-SEND");
  assert.equal((await ledger.release("wamid.FAILED-SEND", claim.token)).success, true);
  assert.equal((await ledger.claim("wamid.FAILED-SEND")).accepted, true);
});

test("expired webhook leases can be reclaimed and stale owners cannot complete", async function () {
  const clock = { now: 1000 };
  const redis = createAtomicRedis(clock);
  const first = createRedisMessageLedger({
    redis,
    hmacSecret: HMAC_SECRET,
    leaseMs: 100
  });
  const staleClaim = await first.claim("wamid.EXPIRED");
  clock.now += 101;
  const second = createRedisMessageLedger({ redis, hmacSecret: HMAC_SECRET, leaseMs: 100 });
  const currentClaim = await second.claim("wamid.EXPIRED");
  assert.equal(currentClaim.accepted, true);
  await assert.rejects(
    first.complete("wamid.EXPIRED", staleClaim.token),
    { code: "WEBHOOK_CLAIM_LEASE_LOST" }
  );
  await second.complete("wamid.EXPIRED", currentClaim.token);
});

test("announcement delivery is permanent, atomic and restart-safe", async function () {
  const redis = createAtomicRedis();
  const first = createRedisFeatureDiscovery({ redis, hmacSecret: HMAC_SECRET });
  const second = createRedisFeatureDiscovery({ redis, hmacSecret: HMAC_SECRET });
  const options = { userCategory: "FARMER", date: "2026-10-21" };
  const claims = await Promise.all([
    first.claim("farmer-private-identity", options),
    second.claim("farmer-private-identity", options)
  ]);
  assert.equal(claims.filter(Boolean).length, 1);
  const owner = claims[0] ? first : second;
  await owner.markShown("farmer-private-identity", FEATURE_CATALOGUE[0].id);

  const restarted = createRedisFeatureDiscovery({ redis, hmacSecret: HMAC_SECRET });
  assert.equal(await restarted.claim("farmer-private-identity", options), null);
  assert.equal(restarted.firstAvailable(options).id, FEATURE_CATALOGUE[0].id);
  assert.doesNotMatch(JSON.stringify(redis.commands), /farmer-private-identity/);
});

test("failed announcement sends release claims, while dismissals remain permanent", async function () {
  const redis = createAtomicRedis();
  const options = { userCategory: "FARMER", date: "2026-10-21" };
  const first = createRedisFeatureDiscovery({ redis, hmacSecret: HMAC_SECRET });
  const feature = await first.claim("farmer-failed-send", options);
  assert.equal(await first.releaseClaim("farmer-failed-send", feature.id), true);

  const retry = createRedisFeatureDiscovery({ redis, hmacSecret: HMAC_SECRET });
  assert.equal((await retry.claim("farmer-failed-send", options)).id, feature.id);
  await retry.acknowledge("farmer-failed-send", feature.id, "dismissed");

  const restarted = createRedisFeatureDiscovery({ redis, hmacSecret: HMAC_SECRET });
  assert.equal(await restarted.select("farmer-failed-send", options), null);
  assert.equal(await restarted.claim("farmer-failed-send", options), null);
});

test("expired announcement leases recover without allowing a stale owner to overwrite", async function () {
  const clock = { now: 1000 };
  const redis = createAtomicRedis(clock);
  const options = { userCategory: "FARMER", date: "2026-10-21" };
  const stale = createRedisFeatureDiscovery({
    redis,
    hmacSecret: HMAC_SECRET,
    leaseMs: 100
  });
  const feature = await stale.claim("farmer-expired-claim", options);
  clock.now += 101;
  const current = createRedisFeatureDiscovery({
    redis,
    hmacSecret: HMAC_SECRET,
    leaseMs: 100
  });
  assert.equal((await current.claim("farmer-expired-claim", options)).id, feature.id);
  assert.equal(await stale.markShown("farmer-expired-claim", feature.id), false);
  assert.equal(await current.markShown("farmer-expired-claim", feature.id), true);
  assert.equal(
    await createRedisFeatureDiscovery({ redis, hmacSecret: HMAC_SECRET })
      .claim("farmer-expired-claim", options),
    null
  );
});

test("Redis outages fail closed without leaking endpoint credentials", async function () {
  const client = createRedisRestClient({
    url: "https://private-endpoint.example",
    token: "private-redis-token",
    hmacSecret: HMAC_SECRET,
    request: async function () { throw new Error("private-redis-token"); }
  });
  const ledger = createRedisMessageLedger({ redis: client, hmacSecret: HMAC_SECRET });
  await assert.rejects(
    ledger.claim("wamid.OUTAGE"),
    function (error) {
      assert.ok(error instanceof DurableStateUnavailableError);
      assert.doesNotMatch(error.message, /private-endpoint|private-redis-token|OUTAGE/);
      return true;
    }
  );

  const announcements = createRedisFeatureDiscovery({ redis: client, hmacSecret: HMAC_SECRET });
  await assert.rejects(announcements.claim("farmer-outage", {
    userCategory: "FARMER",
    date: "2026-10-21"
  }), DurableStateUnavailableError);
  assert.equal(
    announcements.firstAvailable({ userCategory: "FARMER", date: "2026-10-21" }).id,
    FEATURE_CATALOGUE[0].id
  );
});

test("production detection and Redis configuration prevent filesystem fallback", function () {
  assert.equal(isProductionRuntime({ NODE_ENV: "production" }), true);
  assert.equal(isProductionRuntime({ RENDER_EXTERNAL_HOSTNAME: "service.onrender.com" }), true);
  assert.equal(isProductionRuntime({ NODE_ENV: "test" }), false);
  assert.throws(function () {
    resolveStateConfiguration({ NODE_ENV: "production" });
  }, /Production requires/);
  assert.equal(
    resolveStateConfiguration({ NODE_ENV: "test" }).configured,
    false
  );
  assert.throws(function () {
    validateRedisConfiguration({
      url: "https://example.upstash.io",
      token: "token"
    });
  }, /configured together/);
  assert.throws(function () {
    validateRedisConfiguration({
      url: "http://example.upstash.io",
      token: "token",
      hmacSecret: HMAC_SECRET
    });
  }, /HTTPS/);
});
