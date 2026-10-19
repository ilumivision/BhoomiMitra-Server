"use strict";

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

function createFeatureDiscovery(options) {
  const settings = options || {};
  const catalogue = Array.isArray(settings.catalogue)
    ? settings.catalogue.slice()
    : FEATURE_CATALOGUE.slice();
  const sessionState = new Map();

  function stateFor(userKey) {
    const key = String(userKey || "").trim();
    if (!key) return null;
    if (!sessionState.has(key)) {
      sessionState.set(key, {
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
        !state.shown.has(feature.id) &&
        !state.acknowledged.has(feature.id);
    }) || null;
  }

  function markShown(userKey, featureId) {
    const state = stateFor(userKey);
    const id = String(featureId || "").trim();
    if (!state || !id) return false;
    state.shown.add(id);
    return true;
  }

  function acknowledge(userKey, featureId) {
    const state = stateFor(userKey);
    const id = String(featureId || "").trim();
    if (!state || !id) return false;
    state.shown.add(id);
    state.acknowledged.add(id);
    return true;
  }

  function firstAvailable(selectionOptions) {
    return catalogue.find(function (feature) {
      return isAvailableFeature(feature, selectionOptions);
    }) || null;
  }

  return {
    catalogue: catalogue.slice(),
    select,
    markShown,
    acknowledge,
    firstAvailable,
    persistence: "SESSION_MEMORY_ONLY"
  };
}

module.exports = {
  FEATURE_CATALOGUE,
  isAvailableFeature,
  createFeatureDiscovery
};
