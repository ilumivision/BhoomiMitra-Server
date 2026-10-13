"use strict";

require("dotenv").config();

const { google } = require("googleapis");
const {
  FARMER_HEADER_ALIASES
} = require("../utils/registrationFields");
const {
  reconcileFarmersToMaster
} = require("../utils/masterMemberRegistry");

const execute = process.argv.includes("--execute");

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

async function main() {
  const result = await reconcileFarmersToMaster({
    sheets,
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    farmerHeaderAliases: FARMER_HEADER_ALIASES,
    dryRun: !execute
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch(function (error) {
  console.error(
    "Master member reconciliation failed:",
    error && error.message
      ? error.message
      : error
  );
  process.exitCode = 1;
});
