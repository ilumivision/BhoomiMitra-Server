"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  opaqueStateId
} = require("./redisState");

const DEFAULT_ANNOUNCEMENT_LEASE_MS = 5 * 60 * 1000;

const REDIS_ANNOUNCEMENT_CLAIM_SCRIPT = `-- bhoomimitra:announcement:claim:v1
local current = redis.call("GET", KEYS[1])
if not current then
  local created = redis.call("SET", KEYS[1], "pending:" .. ARGV[1], "PX", ARGV[2], "NX")
  if created then return "CLAIMED" end
  current = redis.call("GET", KEYS[1])
end
if current and string.sub(current, 1, 8) == "pending:" then return "IN_FLIGHT" end
return "PERMANENT"`;

const REDIS_ANNOUNCEMENT_DELIVERED_SCRIPT = `-- bhoomimitra:announcement:delivered:v1
local current = redis.call("GET", KEYS[1])
if current == "pending:" .. ARGV[1] then
  redis.call("SET", KEYS[1], "delivered")
  return "DELIVERED"
end
if not current then
  redis.call("SET", KEYS[1], "delivered", "NX")
  return "DELIVERED"
end
if current == "delivered" or current == "opened" or current == "dismissed" then
  return "ALREADY_RECORDED"
end
return "NOT_OWNER"`;

const REDIS_ANNOUNCEMENT_RELEASE_SCRIPT = `-- bhoomimitra:announcement:release:v1
local current = redis.call("GET", KEYS[1])
if current == "pending:" .. ARGV[1] then
  redis.call("DEL", KEYS[1])
  return "RELEASED"
end
return "NOT_OWNER"`;

const FEATURE_CATALOGUE = Object.freeze([
  Object.freeze({
    id: "training-requests-v1",
    titleMalayalam: "🎓 പരിശീലനം അഭ്യർത്ഥിക്കുക",
    titleEnglish: "🎓 Request Farm Training",
    descriptionMalayalam:
      "ലഭ്യമായ പരിപാടിയിൽ വിഷയം ഇല്ലെങ്കിൽ നിങ്ങൾക്ക് ആവശ്യമായ കാർഷിക പരിശീലനം അഭ്യർത്ഥിക്കാം.",
    descriptionEnglish:
      "Request the agricultural training you need when the topic is not in an available programme.",
    instructionsMalayalam:
      "Expert & Services → പരിശീലനം → പരിശീലനം അഭ്യർത്ഥിക്കുക",
    instructionsEnglish:
      "Expert & Services → Training Programmes → Request Training",
    destination: "HOME_TRAINING",
    releaseDate: "2026-10-19",
    status: "AVAILABLE",
    targetUserCategory: "FARMER",
    eligibility: "Registered farmer"
  })
]);

function isAvailableFeature(feature, options) {
  const input = options || {};
  const today = String(input.date || new Date().toISOString().slice(0, 10));
  const category = String(input.userCategory || "FARMER").trim().toUpperCase();

  return Boolean(
    feature &&
    feature.status === "AVAILABLE" &&
    feature.releaseDate <= today &&
    (!feature.targetUserCategory || feature.targetUserCategory === category)
  );
}

function shouldShowWhatsNew(trigger) {
  return String(trigger || "").trim().toUpperCase() === "WHATS_NEW";
}

const AUTOMATICALLY_SUPPRESSED_TRIGGERS = new Set([
  "hi", "hello", "hai", "menu", "main menu", "home", "back",
  "ഹായ്", "ഹലോ", "ഹി", "നമസ്കാരം", "മെനു", "പ്രധാന മെനു", "പിന്നോട്ട്"
]);

function canAutoShowWhatsNewAfterText(text) {
  const normalized = String(text || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  return Boolean(normalized) && !AUTOMATICALLY_SUPPRESSED_TRIGGERS.has(normalized);
}

function createFeatureDiscovery(options) {
  const settings = options || {};
  const catalogue = Array.isArray(settings.catalogue)
    ? settings.catalogue.slice()
    : FEATURE_CATALOGUE.slice();
  const filePath = String(settings.filePath || "").trim()
    ? path.resolve(String(settings.filePath).trim())
    : "";
  const fileSystem = settings.fs || fs;
  const sessionState = new Map();
  let loaded = false;

  function userStateKey(userKey) {
    const key = String(userKey || "").trim();
    if (!key) return "";
    return crypto.createHash("sha256").update(key).digest("hex");
  }

  function restoreState(rawState) {
    const restored = new Map();
    const users = rawState && rawState.users && typeof rawState.users === "object"
      ? rawState.users
      : {};

    Object.keys(users).forEach(function (key) {
      const entry = users[key] || {};
      const delivered = Array.isArray(entry.delivered) ? entry.delivered : [];
      const automaticClaims = Array.isArray(entry.automaticClaims)
        ? entry.automaticClaims
        : delivered;
      restored.set(key, {
        automaticClaims: new Set(automaticClaims.concat(delivered)),
        shown: new Set(delivered),
        acknowledged: new Set(
          Array.isArray(entry.acknowledged) ? entry.acknowledged : []
        )
      });
    });

    return restored;
  }

  function load() {
    if (loaded) return;
    loaded = true;
    if (!filePath) return;

    try {
      const parsed = JSON.parse(fileSystem.readFileSync(filePath, "utf8"));
      restoreState(parsed).forEach(function (value, key) {
        sessionState.set(key, value);
      });
    } catch (error) {
      if (!error || error.code !== "ENOENT") throw error;
    }
  }

  function persist() {
    if (!filePath) return;

    const users = Object.create(null);
    sessionState.forEach(function (state, key) {
      users[key] = {
        automaticClaims: Array.from(state.automaticClaims),
        delivered: Array.from(state.shown),
        acknowledged: Array.from(state.acknowledged)
      };
    });

    const directory = path.dirname(filePath);
    const temporary = filePath + "." + process.pid + ".tmp";
    fileSystem.mkdirSync(directory, { recursive: true });
    fileSystem.writeFileSync(
      temporary,
      JSON.stringify({ version: 1, users: users }),
      { encoding: "utf8", mode: 0o600 }
    );

    try {
      fileSystem.renameSync(temporary, filePath);
    } catch (error) {
      if (!error || !["EEXIST", "EPERM"].includes(error.code)) {
        try { fileSystem.unlinkSync(temporary); } catch (_cleanupError) {}
        throw error;
      }
      try { fileSystem.unlinkSync(filePath); } catch (_cleanupError) {}
      fileSystem.renameSync(temporary, filePath);
    }
  }

  function stateFor(userKey) {
    load();
    const key = userStateKey(userKey);
    if (!key) return null;
    if (!sessionState.has(key)) {
      sessionState.set(key, {
        automaticClaims: new Set(),
        shown: new Set(),
        acknowledged: new Set()
      });
    }
    return sessionState.get(key);
  }

  function select(userKey, selectionOptions) {
    const state = stateFor(userKey);
    if (!state) return null;

    return catalogue.find(function (feature) {
      return isAvailableFeature(feature, selectionOptions) &&
        !state.automaticClaims.has(feature.id) &&
        !state.shown.has(feature.id) &&
        !state.acknowledged.has(feature.id);
    }) || null;
  }

  function markShown(userKey, featureId) {
    const state = stateFor(userKey);
    const id = String(featureId || "").trim();
    if (!state || !id) return false;
    state.automaticClaims.add(id);
    state.shown.add(id);
    persist();
    return true;
  }

  function acknowledge(userKey, featureId) {
    const state = stateFor(userKey);
    const id = String(featureId || "").trim();
    if (!state || !id) return false;
    state.automaticClaims.add(id);
    state.shown.add(id);
    state.acknowledged.add(id);
    persist();
    return true;
  }

  function claim(userKey, selectionOptions) {
    const feature = select(userKey, selectionOptions);
    if (!feature) return null;
    const state = stateFor(userKey);
    state.automaticClaims.add(feature.id);
    persist();
    return feature;
  }

  function releaseClaim(userKey, featureId) {
    const state = stateFor(userKey);
    const id = String(featureId || "").trim();
    if (!state || !id || state.shown.has(id) || state.acknowledged.has(id)) {
      return false;
    }
    const released = state.automaticClaims.delete(id);
    if (released) persist();
    return released;
  }

  function firstAvailable(selectionOptions) {
    return catalogue.find(function (feature) {
      return isAvailableFeature(feature, selectionOptions);
    }) || null;
  }

  return {
    catalogue: catalogue.slice(),
    select,
    claim,
    markShown,
    acknowledge,
    releaseClaim,
    firstAvailable,
    persistence: filePath ? "LOCAL_FILE" : "SESSION_MEMORY_ONLY",
    filePath: filePath
  };
}

function createRedisFeatureDiscovery(options) {
  const settings = options || {};
  const catalogue = Array.isArray(settings.catalogue)
    ? settings.catalogue.slice()
    : FEATURE_CATALOGUE.slice();
  const redis = settings.redis;
  const hmacSecret = String(settings.hmacSecret || "").trim();
  const leaseMs = Number.isFinite(Number(settings.leaseMs)) && Number(settings.leaseMs) > 0
    ? Math.floor(Number(settings.leaseMs))
    : DEFAULT_ANNOUNCEMENT_LEASE_MS;
  const ownedClaims = new Map();

  if (!redis || typeof redis.execute !== "function") {
    throw new Error("A Redis command client is required.");
  }
  if (hmacSecret.length < 32) {
    throw new Error("STATE_HMAC_SECRET must contain at least 32 characters.");
  }

  function stateKey(userKey, featureId) {
    const user = String(userKey || "").trim();
    const feature = String(featureId || "").trim();
    if (!user || !feature) return "";
    return "bm:v1:announcement:" + opaqueStateId(
      hmacSecret,
      "farmer-announcement",
      [user, feature]
    );
  }

  function available(selectionOptions) {
    return catalogue.filter(function (feature) {
      return isAvailableFeature(feature, selectionOptions);
    });
  }

  async function select(userKey, selectionOptions) {
    const candidates = available(selectionOptions);
    for (const feature of candidates) {
      const key = stateKey(userKey, feature.id);
      if (!key) return null;
      const current = await redis.execute(["GET", key]);
      if (current == null) return feature;
    }
    return null;
  }

  async function claim(userKey, selectionOptions) {
    const candidates = available(selectionOptions);
    for (const feature of candidates) {
      const key = stateKey(userKey, feature.id);
      if (!key) return null;
      const token = crypto.randomBytes(24).toString("hex");
      const code = String(await redis.execute([
        "EVAL",
        REDIS_ANNOUNCEMENT_CLAIM_SCRIPT,
        "1",
        key,
        token,
        String(leaseMs)
      ]) || "");
      if (code === "CLAIMED") {
        ownedClaims.set(key, token);
        return feature;
      }
      if (code === "IN_FLIGHT") return null;
      if (code !== "PERMANENT") {
        throw new Error("Unexpected Redis announcement claim result.");
      }
    }
    return null;
  }

  async function markShown(userKey, featureId) {
    const key = stateKey(userKey, featureId);
    if (!key) return false;
    const token = ownedClaims.get(key) || "";
    const code = String(await redis.execute([
      "EVAL",
      REDIS_ANNOUNCEMENT_DELIVERED_SCRIPT,
      "1",
      key,
      token
    ]) || "");
    if (["DELIVERED", "ALREADY_RECORDED"].includes(code)) {
      ownedClaims.delete(key);
      return true;
    }
    return false;
  }

  async function acknowledge(userKey, featureId, outcome) {
    const key = stateKey(userKey, featureId);
    if (!key) return false;
    const status = String(outcome || "opened").trim().toLowerCase() === "dismissed"
      ? "dismissed"
      : "opened";
    await redis.execute(["SET", key, status]);
    ownedClaims.delete(key);
    return true;
  }

  async function releaseClaim(userKey, featureId) {
    const key = stateKey(userKey, featureId);
    const token = key && ownedClaims.get(key);
    if (!key || !token) return false;
    const code = String(await redis.execute([
      "EVAL",
      REDIS_ANNOUNCEMENT_RELEASE_SCRIPT,
      "1",
      key,
      token
    ]) || "");
    ownedClaims.delete(key);
    return code === "RELEASED";
  }

  function firstAvailable(selectionOptions) {
    return catalogue.find(function (feature) {
      return isAvailableFeature(feature, selectionOptions);
    }) || null;
  }

  return Object.freeze({
    catalogue: catalogue.slice(),
    select,
    claim,
    markShown,
    acknowledge,
    releaseClaim,
    firstAvailable,
    persistence: "UPSTASH_REDIS_REST"
  });
}

module.exports = {
  FEATURE_CATALOGUE,
  DEFAULT_ANNOUNCEMENT_LEASE_MS,
  canAutoShowWhatsNewAfterText,
  isAvailableFeature,
  shouldShowWhatsNew,
  createFeatureDiscovery,
  createRedisFeatureDiscovery
};
