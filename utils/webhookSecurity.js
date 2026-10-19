"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DEFAULT_DEDUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_COMPLETED = 10000;

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function captureRawBody(req, _res, buffer) {
  req.rawBody = Buffer.from(buffer || "");
}

function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  const secret = clean(appSecret);
  const supplied = clean(signatureHeader);

  if (!secret) return { valid: false, code: "APP_SECRET_MISSING" };
  if (!supplied) return { valid: false, code: "SIGNATURE_MISSING" };

  const match = supplied.match(/^sha256=([a-f0-9]{64})$/i);
  if (!match) return { valid: false, code: "SIGNATURE_INVALID" };

  const body = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(rawBody == null ? "" : String(rawBody));
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest();
  const provided = Buffer.from(match[1], "hex");
  const valid =
    provided.length === expected.length &&
    crypto.timingSafeEqual(provided, expected);

  return {
    valid: valid,
    code: valid ? "SIGNATURE_VALID" : "SIGNATURE_INVALID"
  };
}

function hashIdentifier(value) {
  const input = clean(value);
  if (!input) return "none";
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 12);
}

function ledgerIdentifier(value) {
  const input = clean(value);
  if (!input) return "";
  return crypto.createHash("sha256").update(input).digest("hex");
}

function safeErrorDetails(error) {
  const input = error || {};
  const code = clean(input.code).replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80);
  const name = clean(input.name).replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80);
  const status = Number(
    input.status ||
    (input.response && input.response.status)
  );

  return {
    name: name || "Error",
    code: code || "UNEXPECTED_ERROR",
    status: Number.isInteger(status) && status >= 100 && status <= 599
      ? status
      : null
  };
}

function redactSensitiveText(value) {
  return String(value == null ? "" : value)
    .replace(/-----BEGIN(?: RSA| EC| OPENSSH)? PRIVATE KEY-----[\s\S]*?-----END(?: RSA| EC| OPENSSH)? PRIVATE KEY-----/gi, "[REDACTED_PRIVATE_KEY]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk|gh[pousr])[-_][A-Za-z0-9_-]{16,}\b/g, "[REDACTED_TOKEN]")
    .replace(/\bEAA[A-Za-z0-9]{30,}\b/g, "[REDACTED_TOKEN]")
    .replace(/([?&](?:access_token|token|key|secret)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/\b(access_token|api_key|token|secret|password)\s*[:=]\s*["']?[^"'\s,;&]+/gi, "$1=[REDACTED]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/(?<!\d)(?:\+?91[-\s]?)?[6-9]\d{9}(?!\d)/g, "[REDACTED_PHONE]");
}

function safeMessageMetadata(message) {
  const input = message || {};
  return {
    messageIdHash: hashIdentifier(input.id),
    type: clean(input.type).replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 40) || "unknown",
    hasText: Boolean(input.text && input.text.body),
    hasMedia: Boolean(input.audio || input.voice || input.image || input.document)
  };
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function createMessageLedger(options) {
  const input = options || {};
  const filePath = path.resolve(clean(input.filePath));
  const fileSystem = input.fs || fs;
  const now = typeof input.now === "function" ? input.now : Date.now;
  const ttlMs = positiveNumber(input.ttlMs, DEFAULT_DEDUP_TTL_MS);
  const maxCompleted = Math.floor(
    positiveNumber(input.maxCompleted, DEFAULT_MAX_COMPLETED)
  );
  let loaded = false;
  let state = {
    completed: new Map(),
    pending: new Map()
  };
  const inFlight = new Set();
  let operation = Promise.resolve();

  if (!clean(input.filePath)) {
    throw new Error("A message ledger file path is required.");
  }

  function withLock(task) {
    const result = operation.then(task, task);
    operation = result.catch(function () {});
    return result;
  }

  function restoreEntries(entries) {
    const map = new Map();
    (Array.isArray(entries) ? entries : []).forEach(function (entry) {
      const id = clean(entry && entry.id);
      const at = Number(entry && entry.at);
      if (id && Number.isFinite(at)) map.set(id, at);
    });
    return map;
  }

  async function load() {
    if (loaded) return;

    try {
      const raw = await fileSystem.promises.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      state = {
        completed: restoreEntries(parsed && parsed.completed),
        pending: restoreEntries(parsed && parsed.pending)
      };
    } catch (error) {
      if (!error || error.code !== "ENOENT") throw error;
    }

    loaded = true;
  }

  function prune() {
    const cutoff = now() - ttlMs;
    state.completed.forEach(function (at, id) {
      if (at < cutoff) state.completed.delete(id);
    });
    state.pending.forEach(function (at, id) {
      if (at < cutoff) state.pending.delete(id);
    });

    const newest = Array.from(state.completed.entries())
      .sort(function (left, right) { return right[1] - left[1]; })
      .slice(0, maxCompleted);
    state.completed = new Map(newest);
  }

  async function persist() {
    prune();
    const directory = path.dirname(filePath);
    const temporary = filePath + "." + process.pid + "." + crypto.randomBytes(6).toString("hex") + ".tmp";
    const payload = JSON.stringify({
      version: 1,
      completed: Array.from(state.completed, function (entry) {
        return { id: entry[0], at: entry[1] };
      }),
      pending: Array.from(state.pending, function (entry) {
        return { id: entry[0], at: entry[1] };
      })
    });

    await fileSystem.promises.mkdir(directory, { recursive: true });
    await fileSystem.promises.writeFile(temporary, payload, {
      encoding: "utf8",
      mode: 0o600
    });

    try {
      await fileSystem.promises.rename(temporary, filePath);
    } catch (error) {
      if (!error || !["EEXIST", "EPERM"].includes(error.code)) {
        await fileSystem.promises.unlink(temporary).catch(function () {});
        throw error;
      }
      await fileSystem.promises.unlink(filePath).catch(function () {});
      await fileSystem.promises.rename(temporary, filePath);
    }
  }

  async function claim(messageId) {
    const id = ledgerIdentifier(messageId);
    if (!id) return { accepted: false, duplicate: false, code: "MESSAGE_ID_REQUIRED" };

    return withLock(async function () {
      await load();
      prune();

      if (state.completed.has(id)) {
        return { accepted: false, duplicate: true, code: "ALREADY_COMPLETED" };
      }
      if (inFlight.has(id)) {
        return { accepted: false, duplicate: true, code: "ALREADY_IN_FLIGHT" };
      }

      const recovered = state.pending.has(id);
      const previousPending = state.pending.get(id);
      inFlight.add(id);
      state.pending.set(id, now());

      try {
        await persist();
      } catch (error) {
        inFlight.delete(id);
        if (previousPending == null) state.pending.delete(id);
        else state.pending.set(id, previousPending);
        throw error;
      }

      return {
        accepted: true,
        duplicate: false,
        recovered: recovered,
        code: recovered ? "RECOVERED_PENDING" : "CLAIMED"
      };
    });
  }

  async function complete(messageId) {
    const id = ledgerIdentifier(messageId);
    return withLock(async function () {
      await load();
      const previousPending = state.pending.get(id);
      const previousCompleted = state.completed.get(id);
      state.pending.delete(id);
      state.completed.set(id, now());

      try {
        await persist();
      } catch (error) {
        if (previousPending == null) state.pending.delete(id);
        else state.pending.set(id, previousPending);
        if (previousCompleted == null) state.completed.delete(id);
        else state.completed.set(id, previousCompleted);
        inFlight.delete(id);
        throw error;
      }

      inFlight.delete(id);
      return { success: true, code: "COMPLETED" };
    });
  }

  async function release(messageId) {
    const id = ledgerIdentifier(messageId);
    return withLock(async function () {
      await load();
      state.pending.delete(id);
      inFlight.delete(id);
      await persist();
      return { success: true, code: "RELEASED" };
    });
  }

  return {
    claim,
    complete,
    release
  };
}

module.exports = {
  DEFAULT_DEDUP_TTL_MS,
  DEFAULT_MAX_COMPLETED,
  captureRawBody,
  createMessageLedger,
  hashIdentifier,
  redactSensitiveText,
  safeErrorDetails,
  safeMessageMetadata,
  verifyMetaSignature
};
