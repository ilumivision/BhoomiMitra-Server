"use strict";

const crypto = require("crypto");

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeRegistrationIdentity(value) {
  const digits = clean(value).replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function createKeyedExecutor() {
  const tails = new Map();

  async function run(key, task) {
    const lockKey = clean(key);
    if (!lockKey) {
      throw new Error("A registration lock key is required.");
    }
    if (typeof task !== "function") {
      throw new Error("A registration task is required.");
    }

    const previous = tails.get(lockKey) || Promise.resolve();
    const result = previous.catch(function () {}).then(task);
    const tail = result.catch(function () {});
    tails.set(lockKey, tail);

    try {
      return await result;
    } finally {
      if (tails.get(lockKey) === tail) {
        tails.delete(lockKey);
      }
    }
  }

  return { run };
}

function randomTwelveDigits(randomBytes) {
  const bytes = randomBytes(8);
  const value = Buffer.isBuffer(bytes)
    ? BigInt("0x" + bytes.toString("hex"))
    : BigInt(Math.abs(Number(bytes) || 0));
  return String(value % 1000000000000n).padStart(12, "0");
}

function createRegistrationIdFactory(options) {
  const input = options || {};
  const now = typeof input.now === "function" ? input.now : Date.now;
  const randomBytes = typeof input.randomBytes === "function"
    ? input.randomBytes
    : crypto.randomBytes;
  const issued = new Set();
  let sequence = 0;

  function generate(prefix, existingIds) {
    const cleanPrefix = clean(prefix);
    if (!cleanPrefix) {
      throw new Error("A registration ID prefix is required.");
    }

    const known = new Set(
      Array.from(existingIds || [], function (value) {
        return clean(value);
      }).filter(Boolean)
    );

    for (let attempt = 0; attempt < 10000; attempt += 1) {
      sequence += 1;
      const timestamp = Math.max(0, Math.floor(Number(now()) || 0));
      const candidate =
        cleanPrefix +
        String(timestamp) +
        randomTwelveDigits(randomBytes) +
        String(sequence).padStart(6, "0");

      if (!issued.has(candidate) && !known.has(candidate)) {
        issued.add(candidate);
        return candidate;
      }
    }

    throw new Error("A unique registration ID could not be generated.");
  }

  return { generate };
}

function createRegistrationCoordinator(options) {
  const input = options || {};
  const executor = input.executor || createKeyedExecutor();
  const idFactory = input.idFactory || createRegistrationIdFactory(input);

  function identityKey(category, phone) {
    const identity = normalizeRegistrationIdentity(phone);
    if (!identity) return "";
    return clean(category || "farmer").toLowerCase() + ":" + identity;
  }

  async function runExclusive(category, phone, task) {
    const key = identityKey(category, phone);
    if (!key) {
      return {
        success: false,
        code: "REGISTRATION_PHONE_REQUIRED"
      };
    }
    return executor.run(key, task);
  }

  function generateId(prefix, existingIds) {
    return idFactory.generate(prefix, existingIds);
  }

  return {
    generateId,
    identityKey,
    runExclusive
  };
}

module.exports = {
  createKeyedExecutor,
  createRegistrationCoordinator,
  createRegistrationIdFactory,
  normalizeRegistrationIdentity
};
