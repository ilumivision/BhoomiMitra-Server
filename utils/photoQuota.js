"use strict";

const crypto = require("crypto");
const { opaqueStateId } = require("./redisState");

const DEFAULT_DAILY_LIMIT = 3;
const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const INDIA_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const EXPIRY_GRACE_SECONDS = 5 * 60;

const REDIS_PHOTO_CLAIM_SCRIPT = `-- bhoomimitra:photo-quota:claim:v1
local expired = redis.call("ZRANGEBYSCORE", KEYS[1], "-inf", ARGV[1])
for _, member in ipairs(expired) do
  if redis.call("HGET", KEYS[2], member) ~= "accepted" then
    redis.call("HDEL", KEYS[2], member)
    redis.call("ZREM", KEYS[1], member)
  end
end
local current = redis.call("HGET", KEYS[2], ARGV[3])
if current == "accepted" then return "ALREADY_ACCEPTED" end
if current then return "IN_FLIGHT" end
if redis.call("ZCARD", KEYS[1]) >= tonumber(ARGV[6]) then return "LIMIT_REACHED" end
redis.call("HSET", KEYS[2], ARGV[3], ARGV[4])
redis.call("ZADD", KEYS[1], ARGV[2], ARGV[3])
redis.call("EXPIRE", KEYS[1], ARGV[5])
redis.call("EXPIRE", KEYS[2], ARGV[5])
return "CLAIMED"`;

const REDIS_PHOTO_COMPLETE_SCRIPT = `-- bhoomimitra:photo-quota:complete:v1
local current = redis.call("HGET", KEYS[2], ARGV[1])
if current == "accepted" then return "ALREADY_ACCEPTED" end
if current ~= ARGV[2] then return "NOT_OWNER" end
redis.call("HSET", KEYS[2], ARGV[1], "accepted")
redis.call("ZADD", KEYS[1], ARGV[3], ARGV[1])
redis.call("EXPIRE", KEYS[1], ARGV[4])
redis.call("EXPIRE", KEYS[2], ARGV[4])
return "ACCEPTED"`;

const REDIS_PHOTO_RELEASE_SCRIPT = `-- bhoomimitra:photo-quota:release:v1
local current = redis.call("HGET", KEYS[2], ARGV[1])
if current == ARGV[2] then
  redis.call("HDEL", KEYS[2], ARGV[1])
  redis.call("ZREM", KEYS[1], ARGV[1])
  return "RELEASED"
end
return "NOT_OWNER"`;

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function indiaDayWindow(nowValue) {
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue || Date.now());
  const shifted = new Date(now.getTime() + INDIA_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const nextMidnight = Date.UTC(year, month, day + 1) - INDIA_OFFSET_MS;
  return {
    dayKey: [year, String(month + 1).padStart(2, "0"), String(day).padStart(2, "0")].join("-"),
    nowMs: now.getTime(),
    endMs: nextMidnight,
    ttlSeconds: Math.max(1, Math.ceil((nextMidnight - now.getTime()) / 1000) + EXPIRY_GRACE_SECONDS)
  };
}

function claimedDayWindow(dayKey, nowValue) {
  const current = indiaDayWindow(nowValue);
  const match = clean(dayKey).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return current;
  const endMs = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1) - INDIA_OFFSET_MS;
  return {
    dayKey: match[0],
    nowMs: current.nowMs,
    endMs,
    ttlSeconds: Math.max(1, Math.ceil((endMs - current.nowMs) / 1000) + EXPIRY_GRACE_SECONDS)
  };
}

function validateIdentity(farmerId, requestId) {
  if (!clean(farmerId)) return { success: false, code: "FARMER_ID_REQUIRED" };
  if (!clean(requestId)) return { success: false, code: "REQUEST_ID_REQUIRED" };
  return null;
}

function createMemoryPhotoQuota(options) {
  const settings = options || {};
  const limit = positiveInteger(settings.limit, DEFAULT_DAILY_LIMIT);
  const leaseMs = positiveInteger(settings.leaseMs, DEFAULT_LEASE_MS);
  const clock = typeof settings.clock === "function" ? settings.clock : function () { return new Date(); };
  const days = new Map();

  function identifiers(farmerId, requestId, window) {
    return {
      day: clean(farmerId).toUpperCase() + "|" + window.dayKey,
      request: clean(requestId)
    };
  }

  async function claim(farmerId, requestId) {
    const invalid = validateIdentity(farmerId, requestId);
    if (invalid) return invalid;
    const window = indiaDayWindow(clock());
    const ids = identifiers(farmerId, requestId, window);
    const entries = days.get(ids.day) || new Map();
    entries.forEach(function (entry, key) {
      if (entry.status === "pending" && entry.expiresAt <= window.nowMs) entries.delete(key);
    });
    days.set(ids.day, entries);
    const existing = entries.get(ids.request);
    if (existing) {
      return {
        accepted: false,
        duplicate: true,
        code: existing.status === "accepted" ? "ALREADY_ACCEPTED" : "IN_FLIGHT"
      };
    }
    if (entries.size >= limit) return { accepted: false, duplicate: false, code: "LIMIT_REACHED" };
    const token = crypto.randomBytes(24).toString("hex");
    entries.set(ids.request, { status: "pending", token, expiresAt: window.nowMs + leaseMs });
    return { accepted: true, duplicate: false, code: "CLAIMED", token, dayKey: window.dayKey };
  }

  async function complete(farmerId, requestId, token, dayKey) {
    const window = claimedDayWindow(dayKey, clock());
    const ids = identifiers(farmerId, requestId, window);
    const entry = days.get(ids.day) && days.get(ids.day).get(ids.request);
    if (entry && entry.status === "accepted") return { success: true, code: "ALREADY_ACCEPTED" };
    if (!entry || entry.token !== clean(token)) return { success: false, code: "NOT_OWNER" };
    days.get(ids.day).set(ids.request, { status: "accepted", token: "", expiresAt: window.endMs });
    return { success: true, code: "ACCEPTED" };
  }

  async function release(farmerId, requestId, token, dayKey) {
    const window = claimedDayWindow(dayKey, clock());
    const ids = identifiers(farmerId, requestId, window);
    const entries = days.get(ids.day);
    const entry = entries && entries.get(ids.request);
    if (!entry || entry.status !== "pending" || entry.token !== clean(token)) {
      return { success: false, code: "NOT_OWNER" };
    }
    entries.delete(ids.request);
    return { success: true, code: "RELEASED" };
  }

  return Object.freeze({ claim, complete, release, persistence: "MEMORY" });
}

function createRedisPhotoQuota(options) {
  const settings = options || {};
  const redis = settings.redis;
  const hmacSecret = clean(settings.hmacSecret);
  const limit = positiveInteger(settings.limit, DEFAULT_DAILY_LIMIT);
  const leaseMs = positiveInteger(settings.leaseMs, DEFAULT_LEASE_MS);
  const clock = typeof settings.clock === "function" ? settings.clock : function () { return new Date(); };

  if (!redis || typeof redis.execute !== "function") throw new Error("A Redis command client is required.");
  if (hmacSecret.length < 32) throw new Error("STATE_HMAC_SECRET must contain at least 32 characters.");

  function keysAndMember(farmerId, requestId, window) {
    const userDay = opaqueStateId(hmacSecret, "photo-quota-user-day", [farmerId, window.dayKey]);
    const request = opaqueStateId(hmacSecret, "photo-quota-request", requestId);
    return {
      claims: "bm:v1:photo:{" + userDay + "}:claims",
      owners: "bm:v1:photo:{" + userDay + "}:owners",
      request
    };
  }

  async function claim(farmerId, requestId) {
    const invalid = validateIdentity(farmerId, requestId);
    if (invalid) return invalid;
    const window = indiaDayWindow(clock());
    const ids = keysAndMember(farmerId, requestId, window);
    const token = crypto.randomBytes(24).toString("hex");
    const code = clean(await redis.execute([
      "EVAL", REDIS_PHOTO_CLAIM_SCRIPT, "2", ids.claims, ids.owners,
      String(window.nowMs), String(window.nowMs + leaseMs), ids.request, token,
      String(window.ttlSeconds), String(limit)
    ]));
    if (code === "CLAIMED") {
      return { accepted: true, duplicate: false, code, token, dayKey: window.dayKey };
    }
    if (["ALREADY_ACCEPTED", "IN_FLIGHT"].includes(code)) {
      return { accepted: false, duplicate: true, code };
    }
    if (code === "LIMIT_REACHED") return { accepted: false, duplicate: false, code };
    throw new Error("Unexpected Redis photo quota claim result.");
  }

  async function complete(farmerId, requestId, token, dayKey) {
    const window = claimedDayWindow(dayKey, clock());
    const ids = keysAndMember(farmerId, requestId, window);
    const code = clean(await redis.execute([
      "EVAL", REDIS_PHOTO_COMPLETE_SCRIPT, "2", ids.claims, ids.owners,
      ids.request, clean(token), String(window.endMs + EXPIRY_GRACE_SECONDS * 1000),
      String(window.ttlSeconds)
    ]));
    return { success: ["ACCEPTED", "ALREADY_ACCEPTED"].includes(code), code };
  }

  async function release(farmerId, requestId, token, dayKey) {
    const window = claimedDayWindow(dayKey, clock());
    const ids = keysAndMember(farmerId, requestId, window);
    const code = clean(await redis.execute([
      "EVAL", REDIS_PHOTO_RELEASE_SCRIPT, "2", ids.claims, ids.owners,
      ids.request, clean(token)
    ]));
    return { success: code === "RELEASED", code };
  }

  return Object.freeze({ claim, complete, release, persistence: "UPSTASH_REDIS_REST" });
}

function photoLimitMessage(language) {
  return String(language || "").toLowerCase() === "malayalam"
    ? "ഇന്നത്തെ 3 ഫോട്ടോ വിശകലന പരിധി പൂർത്തിയായി. ഇന്ത്യൻ സമയം അർധരാത്രിക്ക് ശേഷം വീണ്ടും ശ്രമിക്കുക."
    : "You have reached today's limit of 3 photo analyses. Please try again after midnight India time.";
}

function photoQuotaUnavailableMessage(language) {
  return String(language || "").toLowerCase() === "malayalam"
    ? "ഫോട്ടോ പരിധി സുരക്ഷിതമായി പരിശോധിക്കാൻ ഇപ്പോൾ കഴിയുന്നില്ല. ദയവായി കുറച്ച് കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക."
    : "The photo limit cannot be checked safely right now. Please try again shortly.";
}

module.exports = {
  DEFAULT_DAILY_LIMIT,
  DEFAULT_LEASE_MS,
  REDIS_PHOTO_CLAIM_SCRIPT,
  REDIS_PHOTO_COMPLETE_SCRIPT,
  REDIS_PHOTO_RELEASE_SCRIPT,
  createMemoryPhotoQuota,
  createRedisPhotoQuota,
  indiaDayWindow,
  photoLimitMessage,
  photoQuotaUnavailableMessage
};
