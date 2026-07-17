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
    .replace(
      /[^a-z0-9\u0D00-\u0D7F]+/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function getSpreadsheetId() {
  return clean(
    process.env.GOOGLE_SHEET_ID
  );
}

function getGoogleClientEmail() {
  return clean(
    process.env.GOOGLE_CLIENT_EMAIL
  );
}

function getGooglePrivateKey() {
  return String(
    process.env.GOOGLE_PRIVATE_KEY ||
    ""
  )
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n")
    .trim();
}

function validateGoogleConfiguration() {
  const spreadsheetId =
    getSpreadsheetId();

  const clientEmail =
    getGoogleClientEmail();

  const privateKey =
    getGooglePrivateKey();

  if (!spreadsheetId) {
    throw new Error(
      "GOOGLE_SHEET_ID is not configured."
    );
  }

  if (!clientEmail) {
    throw new Error(
      "GOOGLE_CLIENT_EMAIL is not configured."
    );
  }

  if (!privateKey) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY is not configured."
    );
  }

  return {
    spreadsheetId,
    clientEmail,
    privateKey
  };
}

async function getSheetsClient() {
  const configuration =
    validateGoogleConfiguration();

  const auth =
    new google.auth.JWT({
      email:
        configuration.clientEmail,

      key:
        configuration.privateKey,

      scopes: [
        "https://www.googleapis.com/auth/spreadsheets"
      ]
    });

  return {
    sheets:
      google.sheets({
        version: "v4",
        auth
      }),

    spreadsheetId:
      configuration.spreadsheetId
  };
}

function normaliseSheetTitle(value) {
  return clean(value)
    .replace(
      /[\u200B-\u200D\uFEFF]/g,
      ""
    )
    .toLowerCase();
}

async function resolveActualSheetTitle(
  sheets,
  spreadsheetId,
  requestedSheetName
) {
  const spreadsheetInfo =
    await sheets.spreadsheets.get({
      spreadsheetId,

      fields:
        "sheets(properties(sheetId,title))"
    });

  const availableSheets =
    spreadsheetInfo &&
    spreadsheetInfo.data &&
    Array.isArray(
      spreadsheetInfo.data.sheets
    )
      ? spreadsheetInfo.data.sheets
      : [];

  const targetSheet =
    availableSheets.find(
      function (sheet) {
        const title =
          sheet &&
          sheet.properties
            ? sheet.properties.title
            : "";

        return (
          normaliseSheetTitle(
            title
          ) ===
          normaliseSheetTitle(
            requestedSheetName
          )
        );
      }
    );

  if (!targetSheet) {
    console.error(
      "Commodity_Master was not found."
    );

    console.error(
      "Available Google Sheet tabs:",
      availableSheets.map(
        function (sheet) {
          return (
            sheet &&
            sheet.properties
              ? sheet.properties.title
              : ""
          );
        }
      )
    );

    throw new Error(
      "Commodity_Master sheet was not found."
    );
  }

  return targetSheet.properties.title;
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
    .map(
      function (row) {
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
      }
    )
    .filter(
      function (item) {
        return Boolean(
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
    console.log(
      "Commodity_Master loaded from cache:",
      cachedRows.length
    );

    return cachedRows;
  }

  const client =
    await getSheetsClient();

  const actualSheetTitle =
    await resolveActualSheetTitle(
      client.sheets,
      client.spreadsheetId,
      SHEET_NAME
    );

  const escapedSheetTitle =
    actualSheetTitle.replace(
      /'/g,
      "''"
    );

  const fullRange =
    "'" +
    escapedSheetTitle +
    "'!A:Z";

  console.log(
    "Reading Commodity_Master range:",
    fullRange
  );

  const response =
    await client.sheets
      .spreadsheets
      .values
      .get({
        spreadsheetId:
          client.spreadsheetId,

        range:
          fullRange
      });

  const values =
    response &&
    response.data &&
    Array.isArray(
      response.data.values
    )
      ? response.data.values
      : [];

  const allRows =
    rowsToObjects(values);

  cachedRows =
    allRows.filter(
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

function escapeRegularExpression(
  value
) {
  return String(value)
    .replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
}

function removePriceWords(message) {
  let text =
    normaliseText(message);

  const removablePhrases = [
    "what is the",
    "what is",
    "tell me the",
    "tell me",
    "show me the",
    "show me",
    "current market price of",
    "latest market price of",
    "today market price of",
    "market price today",
    "market price of",
    "current price of",
    "latest price of",
    "today price of",
    "price of",
    "market rate of",
    "rate of",
    "market price",
    "price today",
    "today price",
    "latest price",
    "current price",
    "price",
    "market rate",
    "rate",
    "today",
    "yesterday",
    "now",
    "ഇന്നത്തെ വിപണി വില",
    "ഇന്നത്തെ മാർക്കറ്റ് വില",
    "ഇന്നത്തെ വില",
    "വിപണി വില",
    "മാർക്കറ്റ് വില",
    "വില ഇന്ന്",
    "വില"
  ];

  const sortedPhrases =
    removablePhrases
      .map(normaliseText)
      .filter(Boolean)
      .sort(
        function (first, second) {
          return (
            second.length -
            first.length
          );
        }
      );

  sortedPhrases.forEach(
    function (phrase) {
      const pattern =
        new RegExp(
          "(^|\\s)" +
          escapeRegularExpression(
            phrase
          ) +
          "(?=\\s|$)",
          "g"
        );

      text = text
        .replace(
          pattern,
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
    return 95;
  }

  if (
    query.includes(
      " " + term + " "
    )
  ) {
    return 90;
  }

  if (
    query.includes(term)
  ) {
    return 80;
  }

  if (
    term.includes(query)
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

  console.log(
    "Commodity_Master query:",
    {
      originalMessage,
      cleanedQuery
    }
  );

  if (!cleanedQuery) {
    console.log(
      "Commodity_Master query became empty."
    );

    return null;
  }

  let bestMatch =
    null;

  let bestMatchedTerm =
    "";

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

            bestMatchedTerm =
              term;
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
        cleanedQuery,
        bestScore
      }
    );

    return null;
  }

  const officialName =
    clean(
      bestMatch.AGMARKNET_Name
    );

  if (!officialName) {
    console.log(
      "Commodity_Master row has no AGMARKNET_Name:",
      bestMatch.BhoomiMitra_Name
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
      officialName,

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

    matchedTerm:
      bestMatchedTerm,

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

  console.log(
    "Commodity_Master cache cleared."
  );
}

module.exports = {
  resolveCommodity,
  loadCommodityMaster,
  clearCommodityCache,
  normaliseText,
  removePriceWords
};
