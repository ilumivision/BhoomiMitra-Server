"use strict";

const {
  containsEnglish,
  containsMalayalam,
  detectManglish,
  normalizePreferredLanguage
} = require("./language");

const ADVISORY_RESPONSE_RULES = [
  "Give the direct answer first.",
  "For an ordinary question, prefer about 60 to 120 words when that is sufficient.",
  "Use short paragraphs, concise bullets where useful, and at most one necessary follow-up question.",
  "Do not repeat the farmer's question or ask again for information already present in the supplied farmer or conversation context.",
  "For disease, livestock health, pesticide, fertiliser or safety questions, use the additional length needed for scientific accuracy and safety.",
  "Treat seasons and timing as approximate when conditions can vary.",
  "Use supplied location and farm context when relevant, and distinguish verified facts from estimates.",
  "Never invent weather observations, market prices, scheme eligibility, pesticide doses, withdrawal periods, veterinary prescriptions or scientific recommendations.",
  "When evidence is insufficient or the case is high risk, say so clearly and direct the farmer to the existing expert workflow.",
  "Use WhatsApp-compatible formatting only: short headings, blank lines, bullets and matched single asterisks for bold. Do not output Markdown headings or double asterisks."
].join(" ");

function savedLanguageOrFallback(value) {
  return normalizePreferredLanguage(value) || "Malayalam";
}

function resolveAdvisoryLanguage(text, savedLanguage, inputType) {
  const fallback = savedLanguageOrFallback(savedLanguage);
  const type = String(inputType || "text").trim().toLowerCase();

  // Voice-only, photo-only and other non-text inputs use the saved interface
  // preference because their language cannot be inferred reliably here.
  if (!["text", "caption"].includes(type)) {
    return fallback;
  }

  const hasMalayalam = containsMalayalam(text);
  const hasEnglish = containsEnglish(text);

  if (hasMalayalam && !hasEnglish) {
    return "Malayalam";
  }

  if (hasEnglish && !hasMalayalam && !detectManglish(text)) {
    return "English";
  }

  // Mixed-script, empty, numeric and otherwise ambiguous inputs retain the
  // farmer's explicit saved preference without mutating it.
  return fallback;
}

function languageInstruction(language) {
  const normalized = savedLanguageOrFallback(language);

  if (normalized === "English") {
    return "Answer entirely in clear, simple English suitable for farmers.";
  }

  if (normalized === "Bilingual") {
    return "Answer concisely in Malayalam and English, with Malayalam first.";
  }

  return "Answer entirely in clear Malayalam script suitable for farmers. Do not use Manglish.";
}

function buildAdvisoryPrompt(options) {
  const input = options || {};
  const question = String(input.question || "").trim();
  const context = String(input.context || "").trim();
  const domain = String(input.domain || "general agriculture").trim();

  return [
    "ADVISORY REQUEST",
    "Domain: " + domain,
    "Reply language: " + savedLanguageOrFallback(input.language),
    languageInstruction(input.language),
    ADVISORY_RESPONSE_RULES,
    context ? "Available approved context:\n" + context : "",
    "Farmer question:\n" + question
  ].filter(Boolean).join("\n\n");
}

function normalizeBoundaryAsterisks(line) {
  let value = line;

  if (/^\*\*[^*].*\*$/.test(value) && !/\*\*$/.test(value)) {
    value = value.slice(1);
  } else if (/^\*\*[^*]/.test(value) && !/\*\*$/.test(value)) {
    value = value.slice(2);
  } else if (/^\*[^*]/.test(value) && !/\*$/.test(value)) {
    value = value.slice(1);
  }

  if (!/^\*/.test(value) && /[^*]\*\*$/.test(value)) {
    value = value.slice(0, -2);
  } else if (!/^\*/.test(value) && /[^*]\*$/.test(value)) {
    value = value.slice(0, -1);
  }

  return value;
}

function formatWhatsAppAdvisory(value) {
  const text = String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/```(?:[a-z0-9_-]+)?\n?([\s\S]*?)```/gi, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1: $2")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\*\*([^*\n]+)\*\*/g, "*$1*")
    .replace(/__([^_\n]+)__/g, "_$1_")
    .replace(/~~([^~\n]+)~~/g, "~$1~");

  const lines = text.split("\n").map(function (originalLine) {
    let line = originalLine.replace(/^\s{0,3}#{1,6}\s+(.+?)\s*#*$/, "*$1*");
    line = line.replace(/^\s*[-+]\s+/, "• ");
    line = line.replace(/^\s*\*\s+/, "• ");
    return normalizeBoundaryAsterisks(line).replace(/[ \t]+$/g, "");
  });

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

module.exports = {
  ADVISORY_RESPONSE_RULES,
  buildAdvisoryPrompt,
  formatWhatsAppAdvisory,
  languageInstruction,
  resolveAdvisoryLanguage,
  savedLanguageOrFallback
};
