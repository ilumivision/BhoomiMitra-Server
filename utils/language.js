"use strict";

/*
 * BhoomiMitra Language Engine
 *
 * Detects:
 * 1. Malayalam
 * 2. English
 * 3. Manglish (Malayalam typed in English)
 *
 * Cost: Zero (No AI call)
 */

const MANGLISH_WORDS = [
  "enthu","entha","engane","evide","eppo","venam","venda",
  "njan","ningal","ente","nammal","krishi","vazha","banana",
  "thengu","coconut","kurumulak","pepper","nellu","paddy",
  "mannu","soil","valam","mazha","vila","rogam","marunnu",
  "ila","kay","chedi","vellam","thottam","parambu",
  "aadu","kozhi","pashu","meen","theng","chakka","rambutan"
];

function containsMalayalam(text) {
  return /[\u0D00-\u0D7F]/.test(String(text || ""));
}

function containsEnglish(text) {
  return /[A-Za-z]/.test(String(text || ""));
}

function detectManglish(text) {

  const value =
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  if (!value) {
    return false;
  }

  let score = 0;

  MANGLISH_WORDS.forEach(function(word) {
    if (value.includes(word)) {
      score++;
    }
  });

  return score >= 2;
}

function detectLanguage(text, preferredLanguage) {

  if (containsMalayalam(text)) {
    return "Malayalam";
  }

  if (detectManglish(text)) {
    return "Malayalam";
  }

  if (containsEnglish(text)) {
    return "English";
  }

  return preferredLanguage || "Malayalam";
}

function getLanguageInstruction(language) {

  switch (language) {

    case "English":
      return "Reply only in English.";

    case "Bilingual":
      return "Reply first in English and then in Malayalam.";

    case "Malayalam":
    default:
      return "Reply only in Malayalam.";
  }
}

module.exports = {
  detectLanguage,
  getLanguageInstruction,
  detectManglish,
  containsMalayalam,
  containsEnglish
};
