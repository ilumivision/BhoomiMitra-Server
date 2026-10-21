"use strict";

const crypto = require("crypto");
const axios = require("axios");

const REDIS_REQUEST_TIMEOUT_MS = 5000;

class DurableStateUnavailableError extends Error {
  constructor(code) {
    super("Durable state storage is unavailable.");
    this.name = "DurableStateUnavailableError";
    this.code = code || "DURABLE_STATE_UNAVAILABLE";
  }
}

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function validateRedisConfiguration(options) {
  const input = options || {};
  const url = clean(input.url);
  const token = clean(input.token);
  const hmacSecret = clean(input.hmacSecret);
  const supplied = [url, token, hmacSecret].filter(Boolean).length;

  if (supplied > 0 && supplied < 3) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN and STATE_HMAC_SECRET must be configured together."
    );
  }
  if (!supplied) return { configured: false, url: "", token: "", hmacSecret: "" };

  let parsed;
  try {
    parsed = new URL(url);
  } catch (_error) {
    throw new Error("UPSTASH_REDIS_REST_URL must be a valid HTTPS URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("UPSTASH_REDIS_REST_URL must use HTTPS.");
  }
  if (hmacSecret.length < 32) {
    throw new Error("STATE_HMAC_SECRET must contain at least 32 characters.");
  }

  return { configured: true, url, token, hmacSecret };
}

function createRedisRestClient(options) {
  const config = validateRedisConfiguration(options);
  if (!config.configured) {
    throw new Error("Upstash Redis REST configuration is required.");
  }
  const request = typeof options.request === "function"
    ? options.request
    : async function (command) {
      const response = await axios.post(config.url, command, {
        headers: {
          Authorization: "Bearer " + config.token,
          "Content-Type": "application/json"
        },
        timeout: REDIS_REQUEST_TIMEOUT_MS,
        validateStatus: function () { return true; }
      });
      return {
        status: response.status,
        data: response.data
      };
    };

  async function execute(command) {
    try {
      const response = await request(command.slice());
      const status = Number(response && response.status);
      const body = response && response.data;
      if (
        !Number.isInteger(status) ||
        status < 200 ||
        status >= 300 ||
        !body ||
        Object.prototype.hasOwnProperty.call(body, "error") ||
        !Object.prototype.hasOwnProperty.call(body, "result")
      ) {
        throw new DurableStateUnavailableError("REDIS_COMMAND_FAILED");
      }
      return body.result;
    } catch (error) {
      if (error instanceof DurableStateUnavailableError) throw error;
      throw new DurableStateUnavailableError("REDIS_REQUEST_FAILED");
    }
  }

  return Object.freeze({ execute });
}

function opaqueStateId(hmacSecret, namespace, values) {
  const secret = clean(hmacSecret);
  if (secret.length < 32) {
    throw new Error("STATE_HMAC_SECRET must contain at least 32 characters.");
  }
  const parts = Array.isArray(values) ? values : [values];
  const framed = parts.map(function (value) {
    const item = String(value == null ? "" : value);
    return Buffer.byteLength(item, "utf8") + ":" + item;
  }).join("|");
  return crypto
    .createHmac("sha256", secret)
    .update(clean(namespace) + "\u0000" + framed)
    .digest("hex");
}

function isProductionRuntime(environment) {
  const env = environment || {};
  return clean(env.NODE_ENV).toLowerCase() === "production" ||
    Boolean(clean(env.RENDER) || clean(env.RENDER_SERVICE_ID) || clean(env.RENDER_EXTERNAL_HOSTNAME));
}

function resolveStateConfiguration(environment) {
  const env = environment || {};
  const config = validateRedisConfiguration({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
    hmacSecret: env.STATE_HMAC_SECRET
  });
  if (isProductionRuntime(env) && !config.configured) {
    throw new Error(
      "Production requires UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN and STATE_HMAC_SECRET."
    );
  }
  return config;
}

module.exports = {
  DurableStateUnavailableError,
  REDIS_REQUEST_TIMEOUT_MS,
  createRedisRestClient,
  isProductionRuntime,
  opaqueStateId,
  resolveStateConfiguration,
  validateRedisConfiguration
};
