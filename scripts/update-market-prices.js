"use strict";

require("dotenv").config();

const { google } = require("googleapis");
const { runMarketCheck } = require("../utils/marketScheduler");

const WRITE_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const MARKET_SHEET = "Commodity_Market";

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function executionAuthorized(argv, env) {
  const args = Array.isArray(argv) ? argv : [];
  const settings = env || {};
  return (
    args.includes("--execute") &&
    clean(settings.MARKET_UPDATE_ENABLED).toLowerCase() === "true"
  );
}

function loadConfiguration(env) {
  const settings = env || {};
  const configuration = {
    spreadsheetId: clean(settings.GOOGLE_SHEET_ID),
    clientEmail: clean(settings.GOOGLE_CLIENT_EMAIL),
    privateKey: clean(settings.GOOGLE_PRIVATE_KEY)
      .replace(/^"|"$/g, "")
      .replace(/\\n/g, "\n")
  };
  const missing = Object.keys(configuration).filter(function (key) {
    return !configuration[key];
  });
  if (missing.length > 0) {
    throw new Error("Missing required market-update configuration: " + missing.join(", "));
  }
  return configuration;
}

function columnLetter(index) {
  let number = index + 1;
  let letters = "";
  while (number > 0) {
    const remainder = (number - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    number = Math.floor((number - 1) / 26);
  }
  return letters;
}

function createSheetAdapter(configuration, sheetsApi) {
  return {
    async readSheetRows(sheetName, range) {
      const response = await sheetsApi.spreadsheets.values.get({
        spreadsheetId: configuration.spreadsheetId,
        range: "'" + String(sheetName).replace(/'/g, "''") + "'!" + range,
        valueRenderOption: "UNFORMATTED_VALUE",
        dateTimeRenderOption: "FORMATTED_STRING"
      });
      return Array.isArray(response.data && response.data.values)
        ? response.data.values
        : [];
    },
    async appendRow(sheetName, row) {
      await sheetsApi.spreadsheets.values.append({
        spreadsheetId: configuration.spreadsheetId,
        range: "'" + String(sheetName).replace(/'/g, "''") + "'!A:ZZ",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] }
      });
    },
    async updateRow(sheetName, rowNumber, valuesByHeader, headers) {
      const data = [];
      (headers || []).forEach(function (header, index) {
        const value = valuesByHeader[header];
        if (value === undefined || value === null || value === "") return;
        data.push({
          range:
            "'" + String(sheetName).replace(/'/g, "''") + "'!" +
            columnLetter(index) + rowNumber,
          values: [[value]]
        });
      });
      if (data.length === 0) return;
      await sheetsApi.spreadsheets.values.batchUpdate({
        spreadsheetId: configuration.spreadsheetId,
        requestBody: { valueInputOption: "RAW", data }
      });
    }
  };
}

async function main(options) {
  const input = options || {};
  const argv = input.argv || process.argv.slice(2);
  const env = input.env || process.env;
  const writeOutput = input.writeOutput || function (value) {
    process.stdout.write(JSON.stringify(value, null, 2) + "\n");
  };

  if (!executionAuthorized(argv, env)) {
    const report = {
      success: true,
      mode: "DISABLED",
      sheetWrites: 0,
      note: "Market updates require both MARKET_UPDATE_ENABLED=true and --execute. No scheduler was activated."
    };
    writeOutput(report);
    return report;
  }

  const configuration = loadConfiguration(env);
  const auth = input.auth || new google.auth.JWT({
    email: configuration.clientEmail,
    key: configuration.privateKey,
    scopes: [WRITE_SCOPE]
  });
  const sheetsApi = input.sheetsApi || google.sheets({ version: "v4", auth });
  const adapter = createSheetAdapter(configuration, sheetsApi);
  const runCheck = input.runMarketCheck || runMarketCheck;
  const result = await runCheck({
    ...adapter,
    forceRun: argv.includes("--force")
  });
  const report = {
    success: result.success,
    mode: "MANUAL_CONTROLLED_EXECUTION",
    sheet: MARKET_SHEET,
    schedulerActivated: false,
    result
  };
  writeOutput(report);
  return report;
}

if (require.main === module) {
  main().catch(function (error) {
    process.stderr.write(JSON.stringify({
      success: false,
      mode: "MANUAL_CONTROLLED_EXECUTION",
      error: clean(error && error.message ? error.message : error).slice(0, 500)
    }, null, 2) + "\n");
    process.exitCode = 1;
  });
}

module.exports = {
  WRITE_SCOPE,
  executionAuthorized,
  loadConfiguration,
  createSheetAdapter,
  main
};
