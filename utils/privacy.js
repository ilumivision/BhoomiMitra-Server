const CONSENT_SHEET =
  "User_Consent_Log";

const AGREEMENT_VERSION =
  "PILOT-1.0";

const PRIVACY_POLICY_VERSION =
  "PILOT-1.0";

function normalizeWhatsapp(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(-10);
}

async function readConsentLog({
  sheets,
  spreadsheetId
}) {
  try {
    const response =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range:
          CONSENT_SHEET + "!A:M"
      });

    const rows =
      response.data.values || [];

    if (rows.length <= 1) {
      return {
        success: true,
        rows: []
      };
    }

    const data =
      rows.slice(1).map(function (row) {
        return {
          consentId:
            row[0] || "",
          whatsapp:
            normalizeWhatsapp(row[1]),
          farmerId:
            row[2] || "",
          agreementVersion:
            row[3] || "",
          privacyPolicyVersion:
            row[4] || "",
          consentStatus:
            String(row[5] || "")
              .trim()
              .toUpperCase(),
          consentDate:
            row[6] || "",
          withdrawalDate:
            row[7] || "",
          source:
            row[8] || "",
          policyLanguage:
            row[9] || "",
          remarks:
            row[10] || "",
          createdAt:
            row[11] || "",
          updatedAt:
            row[12] || ""
        };
      });

    return {
      success: true,
      rows: data
    };
  } catch (error) {
    console.error(
      "readConsentLog error:",
      error.message
    );

    return {
      success: false,
      error:
        "Consent records could not be read."
    };
  }
}
async function getLatestConsent({
  sheets,
  spreadsheetId,
  whatsapp
}) {
  const normalizedWhatsapp =
    normalizeWhatsapp(whatsapp);

  const logResult =
    await readConsentLog({
      sheets,
      spreadsheetId
    });

  if (
    !logResult ||
    !logResult.success
  ) {
    return {
      success: false,
      error:
        logResult &&
        logResult.error
          ? logResult.error
          : "Consent records could not be read."
    };
  }

  const matchingRows =
    logResult.rows
      .filter(function (row) {
        return (
          row.whatsapp ===
          normalizedWhatsapp
        );
      })
      .sort(function (a, b) {
        const dateA =
          new Date(
            a.updatedAt ||
            a.createdAt ||
            a.consentDate ||
            0
          ).getTime();

        const dateB =
          new Date(
            b.updatedAt ||
            b.createdAt ||
            b.consentDate ||
            0
          ).getTime();

        return dateB - dateA;
      });

  if (matchingRows.length === 0) {
    return {
      success: true,
      found: false,
      consent: null
    };
  }

  return {
    success: true,
    found: true,
    consent:
      matchingRows[0]
  };
}

async function saveConsent({
  sheets,
  spreadsheetId,
  whatsapp,
  farmerId = "",
  consentStatus,
  policyLanguage = "ENGLISH",
  source = "WHATSAPP",
  remarks = ""
}) {
  try {
    const now =
      new Date().toISOString();

    const consentId =
      "CONSENT-" + Date.now();

    const normalizedStatus =
      String(consentStatus || "")
        .trim()
        .toUpperCase();

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range:
        CONSENT_SHEET + "!A:M",
      valueInputOption:
        "USER_ENTERED",
      requestBody: {
        values: [[
          consentId,
          normalizeWhatsapp(whatsapp),
          farmerId,
          AGREEMENT_VERSION,
          PRIVACY_POLICY_VERSION,
          normalizedStatus,
          normalizedStatus === "AGREED"
            ? now
            : "",
          normalizedStatus === "WITHDRAWN"
            ? now
            : "",
          source,
          policyLanguage,
          remarks,
          now,
          now
        ]]
      }
    });

    return {
      success: true,
      consentId,
      consentStatus:
        normalizedStatus
    };
  } catch (error) {
    console.error(
      "saveConsent error:",
      error.message
    );

    return {
      success: false,
      error:
        "Consent could not be saved."
    };
  }
}
module.exports = {
  CONSENT_SHEET,
  AGREEMENT_VERSION,
  PRIVACY_POLICY_VERSION,
  normalizeWhatsapp,
  readConsentLog,
  getLatestConsent,
  saveConsent
};
