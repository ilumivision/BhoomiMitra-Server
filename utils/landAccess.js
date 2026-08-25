const LAND_ACCESS_SHEET =
  "Land_Access";

function normalizeValue(value) {
  return String(value || "")
    .trim();
}

function normalizeMobile(value) {
  return normalizeValue(value)
    .replace(/\D/g, "")
    .slice(-10);
}

function normalizeAccessLevel(value) {
  return normalizeValue(value)
    .toUpperCase();
}

function normalizeStatus(value) {
  return normalizeValue(value)
    .toUpperCase();
}

async function readLandAccessSheet({
  sheets,
  spreadsheetId
}) {
  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range:
        LAND_ACCESS_SHEET + "!A:M"
    });

  const rows =
    response.data.values || [];

  if (rows.length < 2) {
    return [];
  }

  return rows
    .slice(1)
    .filter(function (row) {
      return row.some(function (cell) {
        return normalizeValue(cell) !== "";
      });
    })
    .map(function (row, index) {
      return {
        rowNumber:
          index + 2,

        accessId:
          normalizeValue(row[0]),

        landId:
          normalizeValue(row[1]),

        ownerFarmerId:
          normalizeValue(row[2]),

        ownerWhatsapp:
          normalizeMobile(row[3]),

        authorizedName:
          normalizeValue(row[4]),

        authorizedWhatsapp:
          normalizeMobile(row[5]),

        relationship:
          normalizeValue(row[6]),

        accessLevel:
          normalizeAccessLevel(row[7]),

        status:
          normalizeStatus(row[8]),

        grantedAt:
          normalizeValue(row[9]),

        grantedBy:
          normalizeMobile(row[10]),

        revokedAt:
          normalizeValue(row[11]),

        remarks:
          normalizeValue(row[12])
      };
    });
}

async function checkLandAccess({
  sheets,
  spreadsheetId,
  landId,
  whatsapp,
  requiredLevel = "VIEW"
}) {
  const mobile =
    normalizeMobile(whatsapp);

  const requestedLandId =
    normalizeValue(landId)
      .toUpperCase();

  if (!mobile || !requestedLandId) {
    return {
      success: false,
      allowed: false,
      error:
        "Land ID and WhatsApp number are required."
    };
  }

  const rows =
    await readLandAccessSheet({
      sheets,
      spreadsheetId
    });

  const matchingAccess =
    rows.find(function (row) {
      return (
        row.landId.toUpperCase() ===
          requestedLandId &&
        row.authorizedWhatsapp ===
          mobile &&
        row.status ===
          "ACTIVE"
      );
    });

  if (!matchingAccess) {
    return {
      success: true,
      allowed: false,
      access: null
    };
  }

  const required =
    normalizeAccessLevel(
      requiredLevel
    );

  const actual =
    matchingAccess.accessLevel;

  let allowed = false;

  if (required === "VIEW") {
    allowed =
      actual === "VIEW" ||
      actual === "MANAGE";
  } else if (required === "MANAGE") {
    allowed =
      actual === "MANAGE";
  }

  return {
    success: true,
    allowed,
    access:
      matchingAccess
  };
}

async function grantLandAccess({
  sheets,
  spreadsheetId,
  landId,
  ownerFarmerId = "",
  ownerWhatsapp,
  authorizedName,
  authorizedWhatsapp,
  relationship = "",
  accessLevel = "VIEW",
  grantedBy = "",
  remarks = ""
}) {
  const now =
    new Date().toISOString();

  const accessId =
    "ACC-" +
    Date.now();

  const level =
    normalizeAccessLevel(
      accessLevel
    );

  if (
    level !== "VIEW" &&
    level !== "MANAGE"
  ) {
    throw new Error(
      "Access level must be VIEW or MANAGE."
    );
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range:
      LAND_ACCESS_SHEET + "!A:M",
    valueInputOption:
      "USER_ENTERED",
    insertDataOption:
      "INSERT_ROWS",
    requestBody: {
      values: [
        [
          accessId,
          normalizeValue(landId),
          normalizeValue(
            ownerFarmerId
          ),
          normalizeMobile(
            ownerWhatsapp
          ),
          normalizeValue(
            authorizedName
          ),
          normalizeMobile(
            authorizedWhatsapp
          ),
          normalizeValue(
            relationship
          ),
          level,
          "ACTIVE",
          now,
          normalizeMobile(
            grantedBy ||
            ownerWhatsapp
          ),
          "",
          normalizeValue(
            remarks
          )
        ]
      ]
    }
  });

  return {
    success: true,
    accessId
  };
}

async function revokeLandAccess({
  sheets,
  spreadsheetId,
  landId,
  ownerWhatsapp,
  authorizedWhatsapp
}) {
  const rows =
    await readLandAccessSheet({
      sheets,
      spreadsheetId
    });

  const ownerMobile =
    normalizeMobile(
      ownerWhatsapp
    );

  const authorizedMobile =
    normalizeMobile(
      authorizedWhatsapp
    );

  const land =
    normalizeValue(landId)
      .toUpperCase();

  const matchingAccess =
    rows.find(function (row) {
      return (
        row.landId.toUpperCase() ===
          land &&
        row.ownerWhatsapp ===
          ownerMobile &&
        row.authorizedWhatsapp ===
          authorizedMobile &&
        row.status ===
          "ACTIVE"
      );
    });

  if (!matchingAccess) {
    return {
      success: true,
      revoked: false,
      message:
        "No active access record found."
    };
  }

  const now =
    new Date().toISOString();

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption:
        "USER_ENTERED",
      data: [
        {
          range:
            LAND_ACCESS_SHEET +
            "!I" +
            matchingAccess.rowNumber,
          values: [
            ["REVOKED"]
          ]
        },
        {
          range:
            LAND_ACCESS_SHEET +
            "!L" +
            matchingAccess.rowNumber,
          values: [
            [now]
          ]
        }
      ]
    }
  });

  return {
    success: true,
    revoked: true,
    accessId:
      matchingAccess.accessId
  };
}

async function getLandAuthorizedUsers({
  sheets,
  spreadsheetId,
  landId,
  ownerWhatsapp
}) {
  const rows =
    await readLandAccessSheet({
      sheets,
      spreadsheetId
    });

  const land =
    normalizeValue(landId)
      .toUpperCase();

  const ownerMobile =
    normalizeMobile(
      ownerWhatsapp
    );

  const users =
    rows.filter(function (row) {
      return (
        row.landId.toUpperCase() ===
          land &&
        row.ownerWhatsapp ===
          ownerMobile &&
        row.status ===
          "ACTIVE"
      );
    });

  return {
    success: true,
    count:
      users.length,
    users
  };
}

module.exports = {
  readLandAccessSheet,
  checkLandAccess,
  grantLandAccess,
  revokeLandAccess,
  getLandAuthorizedUsers
};
