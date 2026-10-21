"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

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
    firstAvailable,
    persistence: filePath ? "LOCAL_FILE" : "SESSION_MEMORY_ONLY",
    filePath: filePath
  };
}

module.exports = {
  FEATURE_CATALOGUE,
  canAutoShowWhatsNewAfterText,
  isAvailableFeature,
  shouldShowWhatsNew,
  createFeatureDiscovery
};
