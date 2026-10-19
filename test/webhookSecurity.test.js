"use strict";

const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");

const {
  captureRawBody,
  createMessageLedger,
  redactSensitiveText,
  safeErrorDetails,
  safeMessageMetadata,
  verifyMetaSignature
} = require("../utils/webhookSecurity");

function signature(body, secret) {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

test("valid Meta webhook signature is accepted against the original raw body", function () {
  const body = Buffer.from('{"object":"whatsapp_business_account","text":"കൃഷി"}');
  const result = verifyMetaSignature(body, signature(body, "test-secret"), "test-secret");
  assert.deepEqual(result, { valid: true, code: "SIGNATURE_VALID" });
});

test("invalid Meta webhook signature is rejected", function () {
  const body = Buffer.from('{"object":"whatsapp_business_account"}');
  const result = verifyMetaSignature(body, signature(Buffer.from("different"), "test-secret"), "test-secret");
  assert.deepEqual(result, { valid: false, code: "SIGNATURE_INVALID" });
});

test("missing signature and missing App Secret fail closed", function () {
  const body = Buffer.from("{}");
  assert.equal(verifyMetaSignature(body, "", "test-secret").code, "SIGNATURE_MISSING");
  assert.equal(verifyMetaSignature(body, signature(body, "test-secret"), "").code, "APP_SECRET_MISSING");
});

test("raw-body capture preserves the exact bytes used for signature verification", function () {
  const request = {};
  const body = Buffer.from('{ "a": 1, "space": "preserved" }');
  captureRawBody(request, null, body);
  assert.ok(Buffer.isBuffer(request.rawBody));
  assert.equal(request.rawBody.equals(body), true);
});

test("duplicate message claims are rejected while the first attempt is in flight", async function (t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bm-webhook-"));
  t.after(function () { fs.rmSync(directory, { recursive: true, force: true }); });
  const ledger = createMessageLedger({ filePath: path.join(directory, "state.json") });

  const first = await ledger.claim("wamid.TEST-1");
  const duplicate = await ledger.claim("wamid.TEST-1");
  assert.equal(first.accepted, true);
  assert.deepEqual(duplicate, {
    accepted: false,
    duplicate: true,
    code: "ALREADY_IN_FLIGHT"
  });
});

test("completed message remains deduplicated after a process-style ledger restart", async function (t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bm-webhook-"));
  t.after(function () { fs.rmSync(directory, { recursive: true, force: true }); });
  const filePath = path.join(directory, "state.json");
  const firstProcess = createMessageLedger({ filePath: filePath });
  await firstProcess.claim("wamid.TEST-2");
  await firstProcess.complete("wamid.TEST-2");

  const restartedProcess = createMessageLedger({ filePath: filePath });
  const duplicate = await restartedProcess.claim("wamid.TEST-2");
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.code, "ALREADY_COMPLETED");

  const persisted = fs.readFileSync(filePath, "utf8");
  assert.doesNotMatch(persisted, /wamid\.TEST-2/);
});

test("pending crash state is retried after restart and failed work can be released", async function (t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bm-webhook-"));
  t.after(function () { fs.rmSync(directory, { recursive: true, force: true }); });
  const filePath = path.join(directory, "state.json");
  const firstProcess = createMessageLedger({ filePath: filePath });
  await firstProcess.claim("wamid.TEST-3");

  const restartedProcess = createMessageLedger({ filePath: filePath });
  const recovered = await restartedProcess.claim("wamid.TEST-3");
  assert.equal(recovered.accepted, true);
  assert.equal(recovered.recovered, true);
  await restartedProcess.release("wamid.TEST-3");

  const retry = await restartedProcess.claim("wamid.TEST-3");
  assert.equal(retry.accepted, true);
  assert.equal(retry.recovered, false);
});

test("safe diagnostics omit error messages, secrets, farmer text and phone identity", function () {
  const error = new Error("Farmer said wilt on 9876543210; Bearer secret-token-value");
  error.code = "ECONNRESET";
  error.response = { status: 503, data: { access_token: "secret-token-value" } };
  const details = safeErrorDetails(error);
  const serialized = JSON.stringify(details);

  assert.deepEqual(details, { name: "Error", code: "ECONNRESET", status: 503 });
  assert.doesNotMatch(serialized, /wilt|9876543210|secret-token-value/);
});

test("sensitive-data redaction removes credentials, phone numbers and email addresses", function () {
  const redacted = redactSensitiveText(
    "Bearer abc.def.ghi contact farmer@example.com +91 9876543210 token=secret-value"
  );
  assert.doesNotMatch(redacted, /abc\.def|farmer@example\.com|9876543210|secret-value/);
  assert.match(redacted, /REDACTED/);
});

test("message metadata is content-free and hashes the external message identifier", function () {
  const metadata = safeMessageMetadata({
    id: "wamid.SENSITIVE-ID",
    type: "text",
    from: "919876543210",
    text: { body: "My crop and address are private" }
  });
  const serialized = JSON.stringify(metadata);
  assert.equal(metadata.type, "text");
  assert.equal(metadata.hasText, true);
  assert.doesNotMatch(serialized, /919876543210|My crop|SENSITIVE-ID/);
});
