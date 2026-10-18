"use strict";

require("dotenv").config();

const { google } = require("googleapis");
const {
  FARMER_HEADER_ALIASES
} = require("../utils/registrationFields");
const {
  reconcileFarmersToMaster
} = require("../utils/masterMemberRegistry");

const privateKey =
  String(process.env.GOOGLE_PRIVATE_KEY || "")
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n")
    .trim();

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: privateKey,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets"
  ]
});

const sheets = google.sheets({
  version: "v4",
  auth
});

function parseCommandLine(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const execute = args.includes("--execute");
  const farmerIdIndex = args.indexOf("--farmer-id");
  let farmerId = "";

  if (farmerIdIndex >= 0) {
    const rawFarmerId = args[farmerIdIndex + 1];

    if (
      rawFarmerId == null ||
      String(rawFarmerId).startsWith("--") ||
      !String(rawFarmerId).trim()
    ) {
      throw new Error(
        "--farmer-id requires a Farmer_ID value."
      );
    }

    farmerId = String(rawFarmerId).trim();
  }

  return {
    execute,
    dryRun: !execute,
    farmerId
  };
}

async function main(argv) {
  const cliOptions =
    parseCommandLine(
      argv || process.argv.slice(2)
    );

  const result = await reconcileFarmersToMaster({
    sheets,
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    farmerHeaderAliases: FARMER_HEADER_ALIASES,
    farmerId: cliOptions.farmerId,
    dryRun: cliOptions.dryRun
  });

  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch(function (error) {
    console.error(
      "Master member reconciliation failed:",
      error && error.message
        ? error.message
        : error
    );
    process.exitCode = 1;
  });
}

module.exports = {
  parseCommandLine,
  main
};
