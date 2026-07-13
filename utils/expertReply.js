"use strict";

const crypto = require("crypto");

function cleanText(value) {
  return String(value || "").trim();
}

function getReplySecret() {
  const secret = cleanText(
    process.env.EXPERT_REPLY_SECRET
  );

  if (!secret) {
    throw new Error(
      "EXPERT_REPLY_SECRET is not configured."
    );
  }

  return secret;
}

function createExpertReplyToken(
  caseId,
  expertId
) {
  const cleanCaseId = cleanText(caseId);
  const cleanExpertId = cleanText(expertId);

  if (!cleanCaseId) {
    throw new Error("Case ID is required.");
  }

  if (!cleanExpertId) {
    throw new Error("Expert ID is required.");
  }

  const payload =
    cleanCaseId + "|" + cleanExpertId;

  return crypto
    .createHmac(
      "sha256",
      getReplySecret()
    )
    .update(payload)
    .digest("hex");
}

function verifyExpertReplyToken(
  caseId,
  expertId,
  suppliedToken
) {
  const token = cleanText(suppliedToken);

  if (!token) {
    return false;
  }

  const expectedToken =
    createExpertReplyToken(
      caseId,
      expertId
    );

  const suppliedBuffer =
    Buffer.from(token, "utf8");

  const expectedBuffer =
    Buffer.from(expectedToken, "utf8");

  if (
    suppliedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    suppliedBuffer,
    expectedBuffer
  );
}

function buildExpertReplyLink(options) {
  const input = options || {};

  const baseUrl =
    cleanText(input.baseUrl) ||
    "https://ilumivision.in/bhoomimitra/expert-reply/";

  const caseId =
    cleanText(input.caseId);

  const expertId =
    cleanText(input.expertId);

  if (!caseId || !expertId) {
    throw new Error(
      "Case ID and Expert ID are required."
    );
  }

  const token =
    createExpertReplyToken(
      caseId,
      expertId
    );

  const separator =
    baseUrl.includes("?")
      ? "&"
      : "?";

  return (
    baseUrl +
    separator +
    "case=" +
    encodeURIComponent(caseId) +
    "&expert=" +
    encodeURIComponent(expertId) +
    "&token=" +
    encodeURIComponent(token)
  );
}

module.exports = {
  createExpertReplyToken,
  verifyExpertReplyToken,
  buildExpertReplyLink
};
