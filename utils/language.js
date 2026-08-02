"use strict";

/*
 * BhoomiMitra Language Engine
 *
 * Detects:
 * 1. Malayalam script
 * 2. English
 * 3. Manglish — Malayalam typed using English letters
 *
 * Reply behaviour:
 * - Malayalam message → Malayalam reply
 * - Manglish message → Malayalam reply
 * - Clear English message → English reply
 * - Unclear message → use saved preferred language
 *
 * Cost: Zero
 * No AI call is used for language detection.
 */

const SUPPORTED_LANGUAGES = [
  "English",
  "Malayalam",
  "Bilingual"
];

/*
 * Common Malayalam words written in English letters.
 *
 * Keep adding common farmer expressions here later
 * without changing the rest of the code.
 */
const MANGLISH_WORDS = [
  "enthu",
  "entha",
  "enthanu",
  "engane",
  "evide",
  "eppo",
  "epol",
  "venam",
  "venda",
  "venamo",
  "njan",
  "njangal",
  "ningal",
  "ningalkku",
  "ente",
  "nammal",
  "ithu",
  "athu",
  "aanu",
  "alle",
  "undo",
  "illa",
  "kodukkanam",
  "kodukkamo",
  "cheyyanam",
  "cheyyamo",
  "parayamo",
  "parayu",
  "ariyanam",
  "kittumo",

  "krishi",
  "karshakan",
  "karshika",
  "thottam",
  "parambu",
  "purayidam",
  "nilam",
  "mannu",
  "valam",
  "jaivavalam",
  "rasavalam",
  "vellam",
  "nanavu",
  "mazha",
  "vila",
  "vilavu",
  "rogam",
  "keedam",
  "marunnu",
  "spray",
  "ila",
  "kay",
  "poovu",
  "chedi",
  "maram",
  "veru",
  "thandu",
  "kuru",

  "vazha",
  "vazhaykku",
  "vazhayil",
  "banana",
  "thengu",
  "thenginu",
  "thengil",
  "theng",
  "coconut",
  "kurumulak",
  "pepper",
  "nellu",
  "paddy",
  "ari",
  "rambutan",
  "chakka",
  "jackfruit",
  "manga",
  "mango",
  "kappa",
  "cassava",
  "chembu",
  "chena",
  "payar",
  "mulaku",
  "mathan",
  "vellarikka",
  "padavalam",
  "kavungu",
  "adakka",
  "jaathi",
  "nutmeg",
  "cocoa",
  "kappi",
  "coffee",
  "rubber",

  "pashu",
  "aadu",
  "kozhi",
  "meen",
  "paal",
  "motta",

  "thozhilali",
  "panikkaran",
  "climber",
  "operator",
  "tractor",
  "tiller",
  "nursery",
  "expert"
];

/*
 * English words that strongly indicate a genuine
 * English sentence rather than Manglish.
 */
const ENGLISH_SIGNAL_WORDS = [
  "what",
  "when",
  "where",
  "why",
  "which",
  "who",
  "how",
  "should",
  "could",
  "would",
  "can",
  "please",
  "need",
  "want",
  "apply",
  "control",
  "treatment",
  "fertilizer",
  "fertiliser",
  "recommend",
  "recommendation",
  "disease",
  "pest",
  "price",
  "weather",
  "rainfall",
  "market",
  "expert",
  "worker",
  "service"
];

function normalizeText(value) {
  return String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

function normalizeLatinText(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePreferredLanguage(value) {
  const normalized =
    normalizeText(value)
      .toLowerCase();

  if (
    normalized === "english" ||
    normalized === "1"
  ) {
    return "English";
  }

  if (
    normalized === "malayalam" ||
    normalized === "മലയാളം" ||
    normalized === "2"
  ) {
    return "Malayalam";
  }

  if (
    normalized === "bilingual" ||
    normalized === "both" ||
    normalized === "english malayalam" ||
    normalized ===
      "english + malayalam" ||
    normalized === "3"
  ) {
    return "Bilingual";
  }

  return "";
}

function containsMalayalam(text) {
  return /[\u0D00-\u0D7F]/.test(
    normalizeText(text)
  );
}

function containsEnglish(text) {
  return /[A-Za-z]/.test(
    normalizeText(text)
  );
}

function countMatchedWords(
  normalizedText,
  wordList
) {
  if (!normalizedText) {
    return 0;
  }

  const words =
    normalizedText
      .split(" ")
      .filter(Boolean);

  let score = 0;

  wordList.forEach(function (candidate) {
    const normalizedCandidate =
      normalizeLatinText(candidate);

    if (!normalizedCandidate) {
      return;
    }

    const candidateWords =
      normalizedCandidate
        .split(" ")
        .filter(Boolean);

    if (candidateWords.length === 1) {
      if (
        words.includes(
          candidateWords[0]
        )
      ) {
        score += 1;
      }

      return;
    }

    if (
      normalizedText.includes(
        normalizedCandidate
      )
    ) {
      score += 1;
    }
  });

  return score;
}

function detectManglish(text) {
  const normalized =
    normalizeLatinText(text);

  if (!normalized) {
    return false;
  }

  const manglishScore =
    countMatchedWords(
      normalized,
      MANGLISH_WORDS
    );

  const englishScore =
    countMatchedWords(
      normalized,
      ENGLISH_SIGNAL_WORDS
    );

  /*
   * Two or more Manglish indicators normally
   * provide a reliable result.
   */
  if (manglishScore >= 2) {
    return true;
  }

  /*
   * A short farmer-style message may contain
   * only one distinctive Manglish word.
   *
   * Examples:
   * "valam venam"
   * "mazha undo"
   * "thengu rogam"
   */
  const wordCount =
    normalized
      .split(" ")
      .filter(Boolean)
      .length;

  if (
    manglishScore === 1 &&
    wordCount <= 4 &&
    englishScore === 0
  ) {
    return true;
  }

  return false;
}

function detectEnglish(text) {
  const normalized =
    normalizeLatinText(text);

  if (!normalized) {
    return false;
  }

  if (!containsEnglish(text)) {
    return false;
  }

  if (detectManglish(text)) {
    return false;
  }

  return true;
}

/*
 * Returns the language that should be used
 * for the current reply.
 *
 * The current message overrides the saved
 * preference when its language is clear.
 */
function detectLanguage(
  text,
  preferredLanguage
) {
  const preferred =
    normalizePreferredLanguage(
      preferredLanguage
    );

  if (containsMalayalam(text)) {
    return "Malayalam";
  }

  if (detectManglish(text)) {
    return "Malayalam";
  }

  if (detectEnglish(text)) {
    return "English";
  }

  return preferred || "Malayalam";
}

function getLanguageInstruction(language) {
  const normalizedLanguage =
    normalizePreferredLanguage(
      language
    ) || "Malayalam";

  switch (normalizedLanguage) {
    case "English":
      return (
        "Reply only in clear, simple English " +
        "suitable for farmers."
      );

    case "Bilingual":
      return (
        "Reply first in clear English and then " +
        "provide the same answer in proper " +
        "Malayalam script."
      );

    case "Malayalam":
    default:
      return (
        "Reply only in proper Malayalam script. " +
        "Do not use Manglish."
      );
  }
}

function shouldAskLanguagePreference(
  preferredLanguage
) {
  return !normalizePreferredLanguage(
    preferredLanguage
  );
}

function parseLanguageSelection(text) {
  const normalized =
    normalizeText(text)
      .toLowerCase();

  if (
    normalized === "1" ||
    normalized === "english"
  ) {
    return "English";
  }

  if (
    normalized === "2" ||
    normalized === "malayalam" ||
    normalized === "മലയാളം"
  ) {
    return "Malayalam";
  }

  if (
    normalized === "3" ||
    normalized === "bilingual" ||
    normalized === "both" ||
    normalized ===
      "english + malayalam" ||
    normalized ===
      "english malayalam"
  ) {
    return "Bilingual";
  }

  return "";
}

function getLanguageSelectionMessage(
  interfaceLanguage
) {
  if (
    normalizePreferredLanguage(
      interfaceLanguage
    ) === "English"
  ) {
    return [
      "Please choose your preferred reply language:",
      "",
      "1️⃣ English",
      "2️⃣ മലയാളം",
      "3️⃣ English + മലയാളം",
      "",
      "Reply with 1, 2 or 3."
    ].join("\n");
  }

  return [
    "മറുപടി ലഭിക്കേണ്ട ഭാഷ തിരഞ്ഞെടുക്കുക:",
    "",
    "1️⃣ English",
    "2️⃣ മലയാളം",
    "3️⃣ English + മലയാളം",
    "",
    "1, 2 അല്ലെങ്കിൽ 3 അയയ്ക്കുക."
  ].join("\n");
}

function isSupportedLanguage(
  language
) {
  return SUPPORTED_LANGUAGES.includes(
    normalizePreferredLanguage(
      language
    )
  );
}

module.exports = {
  SUPPORTED_LANGUAGES,
  MANGLISH_WORDS,
  normalizeText,
  normalizeLatinText,
  normalizePreferredLanguage,
  containsMalayalam,
  containsEnglish,
  detectManglish,
  detectEnglish,
  detectLanguage,
  getLanguageInstruction,
  shouldAskLanguagePreference,
  parseLanguageSelection,
  getLanguageSelectionMessage,
  isSupportedLanguage
};
