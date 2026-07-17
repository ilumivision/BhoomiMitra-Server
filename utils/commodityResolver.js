"use strict";

const { google } = require("googleapis");

const SHEET_NAME =
  "Commodity_Master";

const CACHE_TIME_MS =
  10 * 60 * 1000;

let cachedRows = [];
let cacheLoadedAt = 0;

function clean(value) {
  return String(
    value == null ? "" : value
  ).trim();
}

function normaliseText(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\u0D00-\u0D7F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSpreadsheetId() {
  return clean(
    process.env.GOOGLE_SHEET_ID ||
    process.env.SPREADSHEET_ID ||
    process.env.GOOGLE_SPREADSHEET_ID
  );
}

function getServiceAccountCredentials() {
  const rawCredentials =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_CREDENTIALS ||
    process.env.GOOGLE_SERVICE_ACCOUNT;

  if (!rawCredentials) {
    throw new Error(
      "Google service account credentials are not configured."
    );
  }

  let credentials;

  try {
    credentials =
      JSON.parse(rawCredentials);
  } catch (error) {
    throw new Error(
      "Google service account credentials contain invalid JSON."
    );
  }

  if (
    credentials.private_key
  ) {
    credentials.private_key =
      credentials.private_key.replace(
        /\\n/g,
        "\n"
      );
  }

  return credentials;
}

async function getSheetsClient() {
  const credentials =
    getServiceAccountCredentials();

  const auth =
    new google.auth.GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets.readonly"
      ]
    });

  return google.sheets({
    version: "v4",
    auth
  });
}

function rowsToObjects(values) {
  if (
    !Array.isArray(values) ||
    values.length < 2
  ) {
    return [];
  }

  const headers =
    values[0].map(clean);

  return values
    .slice(1)
    .map(function (row) {
      const item = {};

      headers.forEach(
        function (
          header,
          index
        ) {
          item[header] =
            clean(
              row[index]
            );
        }
      );

      return item;
    })
    .filter(
      function (item) {
        return (
          clean(
            item.Commodity_ID
          ) ||
          clean(
            item.BhoomiMitra_Name
          )
        );
      }
    );
}

async function loadCommodityMaster(
  forceRefresh
) {
  const now =
    Date.now();

  if (
    !forceRefresh &&
    cachedRows.length > 0 &&
    now - cacheLoadedAt <
      CACHE_TIME_MS
  ) {
    return cachedRows;
  }

  const spreadsheetId =
    getSpreadsheetId();

  if (!spreadsheetId) {
    throw new Error(
      "Google spreadsheet ID is not configured."
    );
  }

  const sheets =
    await getSheetsClient();

  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range:
        "'" +
        SHEET_NAME +
        "'!A:Z"
    });

  const values =
    response &&
    response.data &&
    Array.isArray(
      response.data.values
    )
      ? response.data.values
      : [];

  cachedRows =
    rowsToObjects(values).filter(
      function (row) {
        const active =
          normaliseText(
            row.Active
          );

        return (
          !active ||
          active === "yes" ||
          active === "active" ||
          active === "true" ||
          active === "1"
        );
      }
    );

  cacheLoadedAt =
    Date.now();

  console.log(
    "Commodity_Master rows loaded:",
    cachedRows.length
  );

  return cachedRows;
}

function getSearchTerms(row) {
  return [
    row.BhoomiMitra_Name,
    row.Malayalam_Name,
    row.AGMARKNET_Name,
    row.Alias_1,
    row.Alias_2,
    row.Alias_3,
    row.Alias_4,
    row.Alias_5
  ]
    .map(normaliseText)
    .filter(Boolean);
}

function removePriceWords(message) {
  let text =
    normaliseText(message);

  const removablePhrases = [
    "what is the",
    "what is",
    "tell me",
    "show me",
    "market price of",
    "current market price of",
    "latest market price of",
    "today market price of",
    "price of",
    "current price of",
    "latest price of",
    "market price",
    "price today",
    "today price",
    "latest price",
    "current price",
    "price",
    "rate today",
    "market rate",
    "rate",
    "today",
    "yesterday",
    "now",
    "വില",
    "ഇന്നത്തെ വില",
    "മാർക്കറ്റ് വില",
    "വിപണി വില"
  ];

  removablePhrases.forEach(
    function (phrase) {
      const normalisedPhrase =
        normaliseText(
          phrase
        );

      text = text
        .replace(
          new RegExp(
            "(^|\\s)" +
            normalisedPhrase
              .replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
              ) +
            "(?=\\s|$)",
            "g"
          ),
          " "
        )
        .replace(
          /\s+/g,
          " "
        )
        .trim();
    }
  );

  return text;
}

function scoreMatch(
  query,
  term
) {
  if (
    !query ||
    !term
  ) {
    return 0;
  }

  if (
    query === term
  ) {
    return 100;
  }

  if (
    query.startsWith(
      term + " "
    ) ||
    query.endsWith(
      " " + term
    )
  ) {
    return 90;
  }

  if (
    query.includes(
      term
    )
  ) {
    return 80;
  }

  if (
    term.includes(
      query
    )
  ) {
    return 60;
  }

  return 0;
}

async function resolveCommodity(
  message,
  options
) {
  const input =
    options || {};

  const rows =
    await loadCommodityMaster(
      Boolean(
        input.forceRefresh
      )
    );

  const originalMessage =
    clean(message);

  const cleanedQuery =
    removePriceWords(
      originalMessage
    );

  if (!cleanedQuery) {
    return null;
  }

  let bestMatch =
    null;

  let bestScore =
    0;

  rows.forEach(
    function (row) {
      const terms =
        getSearchTerms(row);

      terms.forEach(
        function (term) {
          const score =
            scoreMatch(
              cleanedQuery,
              term
            );

          if (
            score > bestScore
          ) {
            bestScore =
              score;

            bestMatch =
              row;
          }
        }
      );
    }
  );

  if (
    !bestMatch ||
    bestScore < 60
  ) {
    console.log(
      "Commodity_Master no match:",
      {
        originalMessage,
        cleanedQuery
      }
    );

    return null;
  }

  const resolved = {
    commodityId:
      clean(
        bestMatch.Commodity_ID
      ),

    bhoomiMitraName:
      clean(
        bestMatch.BhoomiMitra_Name
      ),

    malayalamName:
      clean(
        bestMatch.Malayalam_Name
      ),

    category:
      clean(
        bestMatch.Category
      ),

    agmarknetName:
      clean(
        bestMatch.AGMARKNET_Name
      ),

    defaultUnit:
      clean(
        bestMatch.Default_Unit ||
        "kg"
      ),

    aliases:
      getSearchTerms(
        bestMatch
      ),

    originalMessage,

    cleanedQuery,

    matchScore:
      bestScore
  };

  console.log(
    "Commodity_Master resolved:",
    resolved
  );

  return resolved;
}

function clearCommodityCache() {
  cachedRows = [];
  cacheLoadedAt = 0;
}

module.exports = {
  resolveCommodity,
  loadCommodityMaster,
  clearCommodityCache,
  normaliseText,
  removePriceWords
};
