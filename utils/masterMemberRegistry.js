"use strict";

const MASTER_SHEET_NAME = "Master_Member_Registry";

const PRIMARY_HEADERS = Object.freeze({
  bmId: "BM_ID",
  name: "Name",
  memberType: "Member Type",
  mobile: "mobile No",
  whatsapp: "WhatsApp No",
  district: "District",
  panchayath: "Panchayath",
  registrationDate: "Registration Date",
  verificationStatus: "Verification Status",
  activeStatus: "Active Status",
  source: "Source",
  createdBy: "Created BY",
  memberSince: "Member Since",
  lastUpdated: "Last Updated",
  remarks: "Remarks"
});

const CONTROLLED_FIELD_KEYS = Object.freeze([
  "bmId",
  "name",
  "memberType",
  "mobile",
  "whatsapp",
  "district",
  "panchayath",
  "registrationDate",
  "verificationStatus",
  "activeStatus",
  "source",
  "lastUpdated"
]);

function normalizePhone(value) {
  const digits =
    String(value || "")
      .replace(/\D/g, "");

  return digits.length > 10
    ? digits.slice(-10)
    : digits;
}

function headerText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function findExactHeaderIndex(headers, expectedHeader) {
  const expected = headerText(expectedHeader);

  // Deliberately compare the full header text. Do not collapse spaces and
  // underscores: later buyer fields use duplicate-style header names.
  return headers.findIndex(function (header) {
    return headerText(header) === expected;
  });
}

function columnNumberToLetter(columnNumber) {
  let number = columnNumber + 1;
  let letters = "";

  while (number > 0) {
    const remainder = (number - 1) % 26;
    letters =
      String.fromCharCode(65 + remainder) +
      letters;
    number = Math.floor((number - 1) / 26);
  }

  return letters;
}

function getCell(row, index) {
  if (index < 0) {
    return "";
  }

  return String(row[index] || "").trim();
}

function setCell(row, index, value) {
  if (index < 0 || value == null) {
    return false;
  }

  while (row.length <= index) {
    row.push("");
  }

  row[index] = value;
  return true;
}

function resolvePrimaryIndexes(headers) {
  const indexes = {};

  Object.keys(PRIMARY_HEADERS).forEach(function (key) {
    indexes[key] = findExactHeaderIndex(
      headers,
      PRIMARY_HEADERS[key]
    );
  });

  return indexes;
}

function requiredHeadersMissing(indexes) {
  // Refuse a partial sync if any approved central target is unavailable.
  return CONTROLLED_FIELD_KEYS.filter(function (key) {
    return indexes[key] < 0;
  });
}

function memberPhoneKeys(member) {
  return new Set(
    [member.mobile, member.whatsapp]
      .map(normalizePhone)
      .filter(Boolean)
  );
}

function rowMatchesPhone(row, indexes, phoneKeys) {
  const rowKeys = [
    getCell(row, indexes.mobile),
    getCell(row, indexes.whatsapp)
  ]
    .map(normalizePhone)
    .filter(Boolean);

  return rowKeys.some(function (key) {
    return phoneKeys.has(key);
  });
}

function buildControlledValues(member, timestamp) {
  const registrationDate =
    String(member.registrationDate || timestamp);

  // Keep this list aligned with the approved central-member update policy.
  // Other Master columns (including buyer/profile data) remain untouched.
  return {
    bmId: String(member.bmId || "").trim(),
    name: String(member.name || "").trim(),
    memberType:
      String(member.memberType || "Farmer").trim(),
    mobile:
      String(member.mobile || member.whatsapp || "").trim(),
    whatsapp:
      String(member.whatsapp || member.mobile || "").trim(),
    district: String(member.district || "").trim(),
    panchayath:
      String(member.panchayath || "").trim(),
    registrationDate,
    verificationStatus:
      String(member.verificationStatus || "Approved").trim(),
    activeStatus:
      String(member.activeStatus || "Active").trim(),
    source:
      String(member.source || "WhatsApp Registration").trim(),
    lastUpdated:
      String(member.lastUpdated || timestamp).trim()
  };
}

async function readMasterRows(options) {
  const response =
    await options.sheets.spreadsheets.values.get({
      spreadsheetId: options.spreadsheetId,
      range:
        "'" +
        String(options.sheetName || MASTER_SHEET_NAME)
          .replace(/'/g, "''") +
        "'!A:BK"
    });

  return response.data.values || [];
}

async function appendMasterRow(options, row) {
  await options.sheets.spreadsheets.values.append({
    spreadsheetId: options.spreadsheetId,
    range:
      "'" +
      String(options.sheetName || MASTER_SHEET_NAME)
        .replace(/'/g, "''") +
      "'!A:BK",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row]
    }
  });
}

async function updateMasterCells(
  options,
  rowNumber,
  changes
) {
  const sheetName =
    String(options.sheetName || MASTER_SHEET_NAME)
      .replace(/'/g, "''");

  const data = changes.map(function (change) {
    return {
      range:
        "'" + sheetName + "'!" +
        columnNumberToLetter(change.index) +
        rowNumber,
      values: [[change.value]]
    };
  });

  await options.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: options.spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data
    }
  });
}

async function upsertMasterMember(options) {
  const member = options.member || {};
  const bmId = String(member.bmId || "").trim();
  const phoneKeys = memberPhoneKeys(member);

  if (!bmId) {
    return {
      success: false,
      code: "BM_ID_REQUIRED"
    };
  }

  if (phoneKeys.size === 0) {
    return {
      success: false,
      code: "PHONE_REQUIRED"
    };
  }

  const rows = await readMasterRows(options);

  if (rows.length === 0) {
    return {
      success: false,
      code: "MASTER_HEADER_MISSING"
    };
  }

  const headers = rows[0];
  const indexes = resolvePrimaryIndexes(headers);
  const missingHeaders = requiredHeadersMissing(indexes);

  if (missingHeaders.length > 0) {
    return {
      success: false,
      code: "MASTER_PRIMARY_HEADERS_MISSING",
      missingHeaders
    };
  }

  const matches = rows
    .slice(1)
    .map(function (row, index) {
      return {
        row,
        rowNumber: index + 2
      };
    })
    .filter(function (item) {
      return rowMatchesPhone(
        item.row,
        indexes,
        phoneKeys
      );
    });

  if (matches.length > 1) {
    return {
      success: false,
      code: "MASTER_PHONE_AMBIGUITY",
      matchCount: matches.length,
      rowNumbers: matches.map(function (match) {
        return match.rowNumber;
      })
    };
  }

  const timestamp =
    String(options.now || new Date().toISOString());
  const values =
    buildControlledValues(member, timestamp);

  if (matches.length === 0) {
    const row = new Array(headers.length).fill("");

    Object.keys(values).forEach(function (key) {
      setCell(row, indexes[key], values[key]);
    });

    if (!options.dryRun) {
      await appendMasterRow(options, row);
    }

    return {
      success: true,
      action: options.dryRun
        ? "would_append"
        : "appended",
      bmId
    };
  }

  const match = matches[0];
  const existingBmId =
    getCell(match.row, indexes.bmId);

  if (
    existingBmId &&
    existingBmId !== bmId
  ) {
    return {
      success: false,
      code: "MASTER_BM_ID_CONFLICT",
      rowNumber: match.rowNumber,
      existingBmId,
      incomingBmId: bmId
    };
  }

  const changes = [];
  const preserveWhenPresent = new Set([
    "registrationDate"
  ]);

  Object.keys(values).forEach(function (key) {
    if (key === "lastUpdated") {
      return;
    }

    const index = indexes[key];
    const incoming = values[key];

    if (index < 0 || !incoming) {
      return;
    }

    const current = getCell(match.row, index);

    if (
      preserveWhenPresent.has(key) &&
      current
    ) {
      return;
    }

    if (current !== incoming) {
      changes.push({
        key,
        index,
        value: incoming
      });
    }
  });

  if (
    changes.length > 0 &&
    indexes.lastUpdated >= 0 &&
    values.lastUpdated
  ) {
    changes.push({
      key: "lastUpdated",
      index: indexes.lastUpdated,
      value: values.lastUpdated
    });
  }

  if (changes.length === 0) {
    return {
      success: true,
      action: "unchanged",
      rowNumber: match.rowNumber,
      bmId
    };
  }

  if (!options.dryRun) {
    await updateMasterCells(
      options,
      match.rowNumber,
      changes
    );
  }

  return {
    success: true,
    action: options.dryRun
      ? "would_update"
      : "updated",
    rowNumber: match.rowNumber,
    bmId,
    updatedFields: changes.map(function (change) {
      return PRIMARY_HEADERS[change.key];
    })
  };
}

function findFarmerHeader(headers, aliases) {
  for (const alias of aliases) {
    const index = findExactHeaderIndex(headers, alias);

    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

async function reconcileFarmersToMaster(options) {
  const farmerResponse =
    await options.sheets.spreadsheets.values.get({
      spreadsheetId: options.spreadsheetId,
      range: "'Farmers'!A:BK"
    });

  const rows = farmerResponse.data.values || [];

  if (rows.length === 0) {
    return {
      success: false,
      code: "FARMERS_HEADER_MISSING"
    };
  }

  const headers = rows[0];
  const aliases = options.farmerHeaderAliases;
  const indexes = {
    id: findFarmerHeader(headers, aliases.idHeaders),
    name: findFarmerHeader(headers, aliases.nameHeaders),
    mobile: findFarmerHeader(headers, aliases.mobileHeaders),
    whatsapp:
      findFarmerHeader(headers, aliases.whatsappHeaders),
    district:
      findFarmerHeader(headers, aliases.districtHeaders),
    panchayath:
      findFarmerHeader(headers, aliases.panchayathHeaders),
    language:
      findFarmerHeader(headers, aliases.languageHeaders),
    registrationDate:
      findFarmerHeader(headers, [
        "Registration date",
        "Registration Date",
        "Registration_Date",
        "Created date"
      ]),
    verificationStatus:
      findFarmerHeader(headers, [
        "Verification_Status",
        "Verification Status",
        "Status"
      ]),
    activeStatus:
      findFarmerHeader(headers, [
        "Active_Status",
        "Active Status"
      ]),
    source:
      findFarmerHeader(headers, [
        "Source",
        "AI_Registration_Source",
        "AI_Registration",
        "AI Registration"
      ])
  };

  const summary = {
    success: true,
    dryRun: options.dryRun !== false,
    processed: 0,
    appended: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    conflicts: 0,
    ambiguities: 0,
    errors: 0,
    issues: []
  };

  let farmerRows = rows.slice(1);
  const requestedFarmerId =
    String(options.farmerId || "").trim();

  if (requestedFarmerId) {
    summary.farmerId = requestedFarmerId;

    const matches = farmerRows
      .map(function (row, index) {
        return {
          row,
          rowNumber: index + 2
        };
      })
      .filter(function (item) {
        return (
          getCell(item.row, indexes.id) ===
          requestedFarmerId
        );
      });

    if (matches.length === 0) {
      return {
        ...summary,
        success: false,
        code: "FARMER_NOT_FOUND",
        farmerId: requestedFarmerId
      };
    }

    if (matches.length > 1) {
      return {
        ...summary,
        success: false,
        code: "FARMER_ID_AMBIGUITY",
        farmerId: requestedFarmerId,
        matchCount: matches.length,
        rowNumbers: matches.map(function (match) {
          return match.rowNumber;
        })
      };
    }

    // From this point onward, a targeted run cannot inspect or upsert any
    // unrelated Farmer row.
    farmerRows = [matches[0].row];
  }

  for (const row of farmerRows) {
    const bmId = getCell(row, indexes.id);
    const mobile = getCell(row, indexes.mobile);
    const whatsapp = getCell(row, indexes.whatsapp);

    if (
      !bmId ||
      memberPhoneKeys({ mobile, whatsapp }).size === 0
    ) {
      summary.skipped += 1;
      continue;
    }

    summary.processed += 1;

    try {
      const result = await upsertMasterMember({
        sheets: options.sheets,
        spreadsheetId: options.spreadsheetId,
        dryRun: options.dryRun !== false,
        member: {
          bmId,
          name: getCell(row, indexes.name),
          memberType: "Farmer",
          mobile,
          whatsapp,
          district: getCell(row, indexes.district),
          panchayath: getCell(row, indexes.panchayath),
          registrationDate:
            getCell(row, indexes.registrationDate),
          verificationStatus:
            getCell(row, indexes.verificationStatus) ||
            "Approved",
          activeStatus:
            getCell(row, indexes.activeStatus) ||
            "Active",
          source:
            getCell(row, indexes.source) ||
            "Farmers reconciliation",
          preferredLanguage:
            getCell(row, indexes.language)
        }
      });

      if (!result.success) {
        summary.issues.push({
          bmId,
          code: result.code,
          rowNumber: result.rowNumber,
          rowNumbers: result.rowNumbers,
          existingBmId: result.existingBmId,
          incomingBmId: result.incomingBmId
        });

        if (result.code === "MASTER_BM_ID_CONFLICT") {
          summary.conflicts += 1;
        } else if (
          result.code === "MASTER_PHONE_AMBIGUITY"
        ) {
          summary.ambiguities += 1;
        } else {
          summary.errors += 1;
        }

        continue;
      }

      if (
        result.action === "appended" ||
        result.action === "would_append"
      ) {
        summary.appended += 1;
      } else if (
        result.action === "updated" ||
        result.action === "would_update"
      ) {
        summary.updated += 1;
      } else {
        summary.unchanged += 1;
      }
    } catch (error) {
      summary.errors += 1;
      summary.issues.push({
        bmId,
        code: "MASTER_RECONCILIATION_EXCEPTION",
        error:
          error && error.message
            ? error.message
            : String(error)
      });
    }
  }

  return summary;
}

module.exports = {
  MASTER_SHEET_NAME,
  PRIMARY_HEADERS,
  CONTROLLED_FIELD_KEYS,
  normalizePhone,
  findExactHeaderIndex,
  upsertMasterMember,
  reconcileFarmersToMaster
};
