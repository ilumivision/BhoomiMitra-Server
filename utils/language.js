"use strict";

/*
 * BhoomiMitra Language Engine
 *
 * Detects:
 * 1. Malayalam script
 * 2. English
 * 3. Manglish — Malayalam typed using English letters
 *
 * Behaviour:
 * - Malayalam input → Malayalam reply
 * - Manglish input → Malayalam reply
 * - Clear English input → English reply
 * - Unclear input, numbers or symbols → saved preference
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
 * Strong Manglish indicators.
 *
 * These are mainly Malayalam grammar words,
 * conversational expressions and transliterated
 * agricultural terms.
 *
 * Avoid ordinary English words such as:
 * banana, coconut, pepper, worker, expert,
 * tractor, service, operator, etc.
 *
 * Otherwise an English message such as
 * "Need coconut climber" may be wrongly
 * classified as Manglish.
 */
const MANGLISH_WORDS = [
  // Questions and conversation
  "enthu",
  "entha",
  "enthanu",
  "enthina",
  "engane",
  "evide",
  "evido",
  "eppo",
  "epol",
  "eppol",
  "aaru",
  "ethra",
  "ethu",

  // Requests and responses
  "venam",
  "venda",
  "venamo",
  "mathi",
  "kittumo",
  "kittilla",
  "undo",
  "illa",
  "aanu",
  "anu",
  "alle",
  "allallo",
  "aakumo",
  "patumo",
  "pattumo",

  // Pronouns and common words
  "njan",
  "njangal",
  "ningal",
  "ningalkku",
  "ningalk",
  "ente",
  "enikku",
  "enik",
  "nammal",
  "namukku",
  "ithu",
  "ithil",
  "athu",
  "athil",
  "ivide",
  "avide",

  // Actions
  "kodukkanam",
  "kodukkamo",
  "koduthu",
  "idamo",
  "idanam",
  "cheyyanam",
  "cheyyamo",
  "cheyyuka",
  "parayamo",
  "parayu",
  "ariyanam",
  "nokkanam",
  "nokku",
  "varumo",
  "varunnu",
  "ayi",
  "aayi",
  "akunnu",

  // Agriculture-related Manglish
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
  "ila",
  "kay",
  "kaay",
  "poovu",
  "chedi",
  "maram",
  "veru",
  "thandu",
  "kuru",

  // Crop names commonly written in Manglish
  "vazha",
  "vazhaykku",
  "vazhayil",
  "thengu",
  "thenginu",
  "thengil",
  "theng",
  "kurumulak",
  "nellu",
  "chakka",
  "manga",
  "kappa",
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
  "kappi",

  // Livestock
  "pashu",
  "aadu",
  "kozhi",
  "meen",
  "paal",
  "motta",

  // Labour-related Manglish
  "thozhilali",
  "panikkaran",
  "kayattakkaran",
  "thengu kayaran",
  "thengu kayattam"
];

/*
 * Words that strongly indicate a genuine
 * English sentence.
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
  "may",
  "please",
  "need",
  "want",
  "give",
  "apply",
  "control",
  "treat",
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
  "service",
  "provider",
  "operator",
  "climber",
  "tractor",
  "tiller",
  "spraying",
  "irrigation",
  "nursery",
  "available",
  "today",
  "tomorrow",
  "help",
  "find",
  "show",
  "tell"
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
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

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
    normalized === "english + malayalam" ||
    normalized === "malayalam + english" ||
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

function tokenizeLatinText(text) {
  const normalized =
    normalizeLatinText(text);

  if (!normalized) {
    return [];
  }

  return normalized
    .split(" ")
    .filter(Boolean);
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

  const words =
    tokenizeLatinText(text);

  const wordCount =
    words.length;

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
   * Strong Manglish sentence:
   * Example:
   * "vazhaykku enthu valam kodukkanam"
   */
  if (
    manglishScore >= 2 &&
    manglishScore >
      englishScore
  ) {
    return true;
  }

  /*
   * Very short Manglish expression:
   * "mazha undo"
   * "valam venam"
   * "rogam aanu"
   */
  if (
    manglishScore >= 1 &&
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
 * Decides the reply language for the
 * current message.
 *
 * A clearly detected message language
 * temporarily overrides the saved preference.
 *
 * The saved preference itself is not changed.
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

  if (
    normalizedLanguage ===
    "English"
  ) {
    return (
      "Reply only in clear, simple English " +
      "suitable for farmers."
    );
  }

  if (
    normalizedLanguage ===
    "Bilingual"
  ) {
    return (
      "Reply first in clear English and then " +
      "provide the same answer in proper " +
      "Malayalam script."
    );
  }

  return (
    "Reply only in proper Malayalam script. " +
    "Do not use Manglish."
  );
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
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

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
    normalized === "english + malayalam" ||
    normalized === "english malayalam" ||
    normalized === "malayalam + english"
  ) {
    return "Bilingual";
  }

  return "";
}

function getLanguageSelectionMessage(
  interfaceLanguage
) {
  const interfacePreference =
    normalizePreferredLanguage(
      interfaceLanguage
    );

  if (
    interfacePreference ===
    "English"
  ) {
    return [
      "🙏 Welcome to BhoomiMitra",
      "ഭൂമിമിത്രയിലേക്ക് സ്വാഗതം",
      "",
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
    "🙏 Welcome to BhoomiMitra",
    "ഭൂമിമിത്രയിലേക്ക് സ്വാഗതം",
    "",
    "Please choose your preferred reply language.",
    "മറുപടി ലഭിക്കേണ്ട ഭാഷ തിരഞ്ഞെടുക്കുക.",
    "",
    "1️⃣ English",
    "2️⃣ മലയാളം",
    "3️⃣ English + മലയാളം",
    "",
    "Reply with 1, 2 or 3.",
    "1, 2 അല്ലെങ്കിൽ 3 അയയ്ക്കുക."
  ].join("\n");
}

function isSupportedLanguage(language) {
  const normalized =
    normalizePreferredLanguage(
      language
    );

  return SUPPORTED_LANGUAGES.includes(
    normalized
  );
}

module.exports = {
  SUPPORTED_LANGUAGES,
  MANGLISH_WORDS,
  ENGLISH_SIGNAL_WORDS,
  normalizeText,
  normalizeLatinText,
  normalizePreferredLanguage,
  containsMalayalam,
  containsEnglish,
  tokenizeLatinText,
  countMatchedWords,
  detectManglish,
  detectEnglish,
  detectLanguage,
  getLanguageInstruction,
  shouldAskLanguagePreference,
  parseLanguageSelection,
  getLanguageSelectionMessage,
  isSupportedLanguage
};
