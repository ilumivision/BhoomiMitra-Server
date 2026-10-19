"use strict";

const {
  getFarmerAnimals
} = require("./animalRegistration");
const {
  getFarmerPreferredLanguage,
  readFarmerStatuses
} = require("./registrationFields");
const { safeErrorDetails } = require("./webhookSecurity");

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizePhone(value) {
  const digits =
    String(value || "")
      .replace(/\D/g, "");

  return digits.length > 10
    ? digits.slice(-10)
    : digits;
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getCell(row, index) {
  if (index < 0) {
    return "";
  }

  return String(row[index] || "").trim();
}

function findFirstHeaderIndex(
  headers,
  possibleHeaders
) {
  for (
    let index = 0;
    index < possibleHeaders.length;
    index += 1
  ) {
    const headerIndex =
      headers.indexOf(
        possibleHeaders[index]
      );

    if (headerIndex >= 0) {
      return headerIndex;
    }
  }

  return -1;
}

function findAllHeaderIndexes(
  headers,
  possibleHeaders
) {
  const possibleHeaderSet =
    new Set(possibleHeaders);

  return headers
    .map(function (header, index) {
      return possibleHeaderSet.has(header)
        ? index
        : -1;
    })
    .filter(function (index) {
      return index >= 0;
    });
}

function isPersonalRecordCommand(userText) {
  const text =
    normalizeText(userText);

  return [
    "my profile",
    "my details",
    "my farmer id",
    "my land",
    "my lands",
    "my animals"
  ].includes(text);
}
async function getMemberByPhone(data) {
  const sheets =
    data && data.sheets;

  const spreadsheetId =
    data && data.spreadsheetId;

  const phone =
    normalizePhone(
      data && data.phone
    );

  if (!phone) {
    return {
      state: "no_match",
      normalizedPhone: "",
      matches: []
    };
  }

  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range:
        "Farmers!A:BG"
    });

  const rows =
    response.data.values || [];

  if (rows.length < 2) {
    return {
      state: "no_match",
      normalizedPhone: phone,
      matches: []
    };
  }

  const rawHeaders = rows[0];
  const headers =
    rawHeaders.map(normalizeHeader);

  const phoneIndexes =
    findAllHeaderIndexes(
      headers,
      [
        "mobile_no",
        "mobile_number",
        "mobile",
        "whatapp",
        "whatsapp_no",
        "whatsapp_number",
        "whatsapp",
        "registered_mobile",
        "farmer_mobile"
      ]
    );

  const idIndex =
    findFirstHeaderIndex(
      headers,
      [
        "farmer_id",
        "farmerid",
        "bm_id",
        "member_id"
      ]
    );

  const matches =
    rows
      .slice(1)
      .map(function (row, index) {
        return {
          row,
          rowNumber: index + 2,
          farmerId:
            getCell(row, idIndex)
        };
      })
      .filter(function (item) {
        return phoneIndexes.some(
          function (index) {
            return (
              normalizePhone(
                item.row[index]
              ) === phone
            );
          }
        );
      });

  if (matches.length === 0) {
    return {
      state: "no_match",
      normalizedPhone: phone,
      matches: []
    };
  }

  if (matches.length > 1) {
    return {
      state: "multiple_matches",
      normalizedPhone: phone,
      matchingFarmerIds:
        matches.map(function (match) {
          return match.farmerId || "(missing Farmer_ID)";
        }),
      rowNumbers:
        matches.map(function (match) {
          return match.rowNumber;
        }),
      matches
    };
  }

  return {
    state: "match",
    normalizedPhone: phone,
    rawHeaders,
    headers,
    row: matches[0].row,
    rowNumber: matches[0].rowNumber,
    matches
  };
}
async function getExpertByPhone(data) {
  const sheets =
    data && data.sheets;

  const spreadsheetId =
    data && data.spreadsheetId;

  const phone =
    normalizePhone(
      data && data.phone
    );

  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range:
        "Expert_Directory!A:AZ"
    });

  const rows =
    response.data.values || [];

  if (rows.length < 2) {
    return null;
  }

  const headers =
    rows[0].map(normalizeHeader);

  const phoneIndexes =
    findAllHeaderIndexes(
      headers,
      [
        "mobile_no",
        "mobile",
        "whatsapp_no",
        "whatsapp"
      ]
    );

  const expertIdIndex =
    findFirstHeaderIndex(
      headers,
      [
        "expert_id"
      ]
    );

  const expertRow =
    rows
      .slice(1)
      .find(function (row) {
        return phoneIndexes.some(
          function (index) {
            return (
              normalizePhone(
                row[index]
              ) === phone
            );
          }
        );
      });

  if (!expertRow) {
    return null;
  }

  return {
    expertId:
      getCell(
        expertRow,
        expertIdIndex
      )
  };
}

function buildMemberRecord(memberData) {
  const headers =
    memberData.headers;

  const rawHeaders =
    memberData.rawHeaders || headers;

  const row =
    memberData.row;

  const idIndex =
    findFirstHeaderIndex(
      headers,
      [
        "bm_id",
        "farmer_id",
        "member_id"
      ]
    );

  const nameIndex =
    findFirstHeaderIndex(
      headers,
      [
        "name",
        "full_name",
        "farmer_name"
      ]
    );

  const districtIndex =
    findFirstHeaderIndex(
      headers,
      [
        "district",
        "distrct"
      ]
    );

  const panchayatIndex =
    findFirstHeaderIndex(
      headers,
      [
        "panchayath",
        "panchayat",
        "local_body"
      ]
    );

  const mobileIndex =
    findFirstHeaderIndex(
      headers,
      [
        "mobile",
        "mobile_no",
        "mobile_number",
        "mob_no"
      ]
    );

  const whatsappIndex =
    findFirstHeaderIndex(
      headers,
      [
        "whatapp",
        "whatsapp",
        "whatsapp_no",
        "whatsapp_number"
      ]
    );

  const mainCropIndex =
    findFirstHeaderIndex(
      headers,
      [
        "main_crop",
        "crop"
      ]
    );

  const farmerId =
    getCell(row, idIndex);
  const statuses =
    readFarmerStatuses(
      row,
      rawHeaders,
      farmerId
    );

  return {
    farmerId,
    name:
      getCell(row, nameIndex),
    district:
      getCell(
        row,
        districtIndex
      ),
    panchayath:
      getCell(
        row,
        panchayatIndex
      ),
    mobile:
      getCell(
        row,
        mobileIndex
      ),
    whatsapp:
      getCell(
        row,
        whatsappIndex
      ),
    mainCrop:
      getCell(
        row,
        mainCropIndex
      ),
    preferredLanguage:
      getFarmerPreferredLanguage(
        row,
        rawHeaders
      ),
    registrationStatus:
      statuses.registrationStatus,
    verificationStatus:
      statuses.verificationStatus,
    activeStatus:
      statuses.activeStatus
  };
}

async function getLandsByPhone(data) {
  const sheets =
    data && data.sheets;

  const spreadsheetId =
    data && data.spreadsheetId;

  const phone =
    normalizePhone(
      data && data.phone
    );

  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Land_Parcels!A:AZ"
    });

  const rows =
    response.data.values || [];

  if (rows.length < 2) {
    return [];
  }

  const headers =
    rows[0].map(normalizeHeader);

  const phoneIndexes =
    findAllHeaderIndexes(
      headers,
      [
        "phone",
        "mobile",
        "mobile_number",
        "whatsapp",
        "whatsapp_no",
        "whatsapp_number",
        "registered_mobile",
        "farmer_mobile",
        "farmer_reported"
      ]
    );

  const landIdIndex =
    findFirstHeaderIndex(
      headers,
      ["land_id"]
    );

  const farmNameIndex =
    findFirstHeaderIndex(
      headers,
      [
        "farm_name",
        "land_name"
      ]
    );

  const districtIndex =
    findFirstHeaderIndex(
      headers,
      ["district"]
    );

  const localBodyIndex =
    findFirstHeaderIndex(
      headers,
      ["local_body"]
    );

  const areaIndexes = [
    "farmer_reported_area",
    "revenue_record_area",
    "gps_calculated_area",
    "area"
  ].map(function (header) {
    return findFirstHeaderIndex(headers, [header]);
  }).filter(function (index) {
    return index >= 0;
  });

  const areaUnitIndex =
    findFirstHeaderIndex(
      headers,
      [
        "area_unit",
        "farmer_reported_area_unit",
        "revenue_record_area_unit",
        "gps_calculated_area_unit"
      ]
    );

  const mainCropIndex =
    findFirstHeaderIndex(
      headers,
      ["main_crop"]
    );

  return rows
    .slice(1)
    .filter(function (row) {
      return phoneIndexes.some(
        function (index) {
          return (
            normalizePhone(
              row[index]
            ) === phone
          );
        }
      );
    })
    .map(function (row) {
      return {
        landId:
          getCell(
            row,
            landIdIndex
          ),
        farmName:
          getCell(
            row,
            farmNameIndex
          ),
        district:
          getCell(
            row,
            districtIndex
          ),
        localBody:
          getCell(
            row,
            localBodyIndex
          ),
        area:
          areaIndexes.map(function (index) {
            return getCell(row, index);
          }).find(Boolean) || "",
        areaUnit:
          getCell(
            row,
            areaUnitIndex
          ),
        mainCrop:
          getCell(
            row,
            mainCropIndex
          )
      };
    });
}

function normalizeProfileLanguage(value) {
  const normalized =
    String(value || "")
      .trim()
      .toLowerCase();

  if (normalized === "english") {
    return "English";
  }

  if (normalized === "malayalam") {
    return "Malayalam";
  }

  return "";
}

function resolveProfileLanguage(member, fallbackLanguage) {
  return (
    normalizeProfileLanguage(
      member && member.preferredLanguage
    ) ||
    normalizeProfileLanguage(
      fallbackLanguage
    ) ||
    "Malayalam"
  );
}

function localizeProfileValue(value, language) {
  if (language !== "Malayalam") {
    return value || "-";
  }

  const translations = {
    registered: "രജിസ്റ്റർ ചെയ്തു",
    pending: "പരിശോധന കാത്തിരിക്കുന്നു",
    verified: "സ്ഥിരീകരിച്ചു",
    approved: "അംഗീകരിച്ചു",
    active: "സജീവം",
    suspended: "സസ്‌പെൻഡ് ചെയ്തു",
    inactive: "നിഷ്‌ക്രിയം",
    english: "ഇംഗ്ലീഷ്",
    malayalam: "മലയാളം",
    bilingual: "ദ്വിഭാഷ"
  };

  const normalized =
    String(value || "")
      .trim()
      .toLowerCase();

  return translations[normalized] || value || "-";
}

function buildPhoneLines(member, language) {
  const mobile = String(member.mobile || "").trim();
  const whatsapp = String(member.whatsapp || "").trim();
  const samePhone =
    mobile &&
    whatsapp &&
    normalizePhone(mobile) === normalizePhone(whatsapp);

  if (
    samePhone ||
    !mobile ||
    !whatsapp
  ) {
    return [
      (
        language === "Malayalam"
          ? "മൊബൈൽ / വാട്സ്ആപ്പ്: "
          : "Mobile / WhatsApp: "
      ) + (whatsapp || mobile || "-")
    ];
  }

  return [
    (
      language === "Malayalam"
        ? "മൊബൈൽ: "
        : "Mobile: "
    ) + mobile,
    (
      language === "Malayalam"
        ? "വാട്സ്ആപ്പ്: "
        : "WhatsApp: "
    ) + whatsapp
  ];
}

function formatMyProfile(member, language) {
  const phoneLines =
    buildPhoneLines(member, language);

  if (language === "Malayalam") {
    return [
      "👤 എന്റെ ഭൂമിമിത്ര പ്രൊഫൈൽ",
      "",
      "കർഷക ഐഡി: " +
        (member.farmerId || "-"),
      "പേര്: " +
        (member.name || "-"),
      ...phoneLines,
      "ജില്ല: " +
        (member.district || "-"),
      "പഞ്ചായത്ത്: " +
        (member.panchayath || "-"),
      "പ്രധാന വിള: " +
        (member.mainCrop || "-"),
      "ഇഷ്ട ഭാഷ: " +
        localizeProfileValue(
          member.preferredLanguage,
          language
        ),
      "രജിസ്ട്രേഷൻ നില: " +
        localizeProfileValue(
          member.registrationStatus,
          language
        ),
      "പരിശോധന നില: " +
        localizeProfileValue(
          member.verificationStatus,
          language
        ),
      "സജീവ നില: " +
        localizeProfileValue(
          member.activeStatus,
          language
        )
    ].join("\n");
  }

  return [
    "👤 My BhoomiMitra Profile",
    "",
    "Farmer ID: " +
      (member.farmerId || "-"),
    "Name: " +
      (member.name || "-"),
    ...phoneLines,
    "District: " +
      (member.district || "-"),
    "Panchayath: " +
      (member.panchayath || "-"),
    "Main Crop: " +
      (member.mainCrop || "-"),
    "Preferred Language: " +
      (member.preferredLanguage || "-"),
    "Registration Status: " +
      (member.registrationStatus || "-"),
    "Verification Status: " +
      (member.verificationStatus || "-"),
    "Active Status: " +
      (member.activeStatus || "-")
  ].join("\n");
}

function formatMyDetails(member, language) {
  return formatMyProfile(member, language);
}

function formatFarmerId(member, language) {
  if (!member.farmerId) {
    if (language === "Malayalam") {
      return [
        "നിങ്ങളുടെ ഭൂമിമിത്ര കർഷക ഐഡി ലഭ്യമല്ല.",
        "",
        "ദയവായി കർഷക രജിസ്ട്രേഷൻ പൂർത്തിയാക്കുകയോ തിരുത്തുകയോ ചെയ്യുക."
      ].join("\n");
    }

    return [
      "Your BhoomiMitra Farmer ID is not available.",
      "",
      "Please complete or correct your farmer registration."
    ].join("\n");
  }

  if (language === "Malayalam") {
    return [
      "🌾 ഭൂമിമിത്ര കർഷക ഐഡി",
      "",
      "കർഷക ഐഡി: " + member.farmerId,
      "പേര്: " + (member.name || "-"),
      "ജില്ല: " + (member.district || "-"),
      "പഞ്ചായത്ത്: " + (member.panchayath || "-"),
      "",
      "ഈ ഐഡി നിങ്ങളുടെ രജിസ്റ്റർ ചെയ്ത വാട്സ്ആപ്പ് നമ്പറുമായി ബന്ധിപ്പിച്ചിരിക്കുന്നു."
    ].join("\n");
  }

  return [
    "🌾 BhoomiMitra Farmer ID",
    "",
    "Farmer ID: " +
      member.farmerId,
    "Name: " +
      (member.name || "-"),
    "District: " +
      (member.district || "-"),
    "Local body: " +
      (member.panchayath || "-"),
    "",
    "This ID is linked to your registered WhatsApp number."
  ].join("\n");
}

function formatLands(lands) {
  if (!lands.length) {
    return [
      "No registered land parcels were found for this WhatsApp number.",
      "",
      "Use Farm & Land Management to register a new land parcel."
    ].join("\n");
  }

  const lines = [
    "🌾 My Registered Lands",
    ""
  ];

  lands.forEach(
    function (land, index) {
      lines.push(
        String(index + 1) +
          ". " +
          (
            land.farmName ||
            "Unnamed land"
          )
      );

      lines.push(
        "Land ID: " +
          (land.landId || "-")
      );

      lines.push(
        "Location: " +
          [
            land.localBody,
            land.district
          ]
            .filter(Boolean)
            .join(", ")
      );

      const rawArea = String(land.area || "").trim();
      const numericArea = Number(rawArea.replace(/,/g, ""));
      const validArea = rawArea && Number.isFinite(numericArea) && numericArea > 0;

      lines.push(
        "Area: " +
          (validArea
            ? [rawArea, land.areaUnit].filter(Boolean).join(" ")
            : "-")
      );

      lines.push(
        "Main crop: " +
          (land.mainCrop || "-")
      );

      lines.push("");
    }
  );

  return lines
    .join("\n")
    .trim();
}

function formatNoMember(language) {
  if (language === "Malayalam") {
    return [
      "ഈ വാട്സ്ആപ്പ് നമ്പറിന് ഭൂമിമിത്ര കർഷക രജിസ്ട്രേഷൻ കണ്ടെത്താനായില്ല.",
      "",
      "രജിസ്റ്റർ ചെയ്യാൻ My BhoomiMitra മെനുവിലെ Membership തിരഞ്ഞെടുക്കുക. തിരുത്തൽ ആവശ്യമെങ്കിൽ ഭൂമിമിത്ര സഹായവുമായി ബന്ധപ്പെടുക."
    ].join("\n");
  }

  return [
    "No BhoomiMitra Farmer registration was found for this WhatsApp number.",
    "",
    "To register, choose Membership in the My BhoomiMitra menu. Contact BhoomiMitra support if the record needs correction."
  ].join("\n");
}

function formatPhoneAmbiguity(language) {
  if (language === "Malayalam") {
    return [
      "ഈ വാട്സ്ആപ്പ് നമ്പറുമായി ഒന്നിലധികം കർഷക രേഖകൾ ബന്ധിപ്പിച്ചിരിക്കുന്നു.",
      "",
      "തെറ്റായ പ്രൊഫൈൽ കാണിക്കാതിരിക്കാൻ വിവരങ്ങൾ ഇപ്പോൾ പ്രദർശിപ്പിക്കുന്നില്ല. ദയവായി ഭൂമിമിത്ര സഹായവുമായി ബന്ധപ്പെടുക."
    ].join("\n");
  }

  return [
    "More than one Farmer record is linked to this WhatsApp number.",
    "",
    "Your profile is not being displayed so that the wrong record is not exposed. Please contact BhoomiMitra support for review."
  ].join("\n");
}

function formatPersonalRecordsError(language) {
  if (language === "Malayalam") {
    return "നിങ്ങളുടെ വ്യക്തിഗത രേഖകൾ ഇപ്പോൾ ലഭ്യമാക്കാനായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.";
  }

  return "Sorry, your personal records could not be retrieved. Please try again.";
}

async function handlePersonalRecords(data) {
  const userText =
    data && data.userText;

  if (
    !isPersonalRecordCommand(
      userText
    )
  ) {
    return {
      handled: false,
      reply: null
    };
  }

  try {
    const fallbackLanguage =
      normalizeProfileLanguage(
        data && data.language
      ) || "Malayalam";
    const memberData =
      await getMemberByPhone(data);

    if (
      memberData.state ===
      "no_match"
    ) {
      return {
        handled: true,
        lookupState: "no_match",
        showRegistrationPath: true,
        reply:
          formatNoMember(
            fallbackLanguage
          )
      };
    }

    if (
      memberData.state ===
      "multiple_matches"
    ) {
      console.warn(
        "Personal records phone ambiguity:",
        {
          matchCount:
            memberData.matchingFarmerIds.length
        }
      );

      return {
        handled: true,
        lookupState:
          "multiple_matches",
        reply:
          formatPhoneAmbiguity(
            fallbackLanguage
          )
      };
    }

    const member =
      buildMemberRecord(
        memberData
      );
    const language =
      resolveProfileLanguage(
        member,
        data && data.language
      );

    const command =
      normalizeText(userText);

    if (
      command === "my profile" ||
      command === "my details"
    ) {
      return {
        handled: true,
        lookupState: "match",
        reply:
          formatMyDetails(
            member,
            language
          )
      };
    }

    if (
      command ===
      "my farmer id"
    ) {
      return {
        handled: true,
        lookupState: "match",
        reply:
          formatFarmerId(
            member,
            language
          )
      };
    }

    if (
      command === "my land" ||
      command === "my lands"
    ) {
      const lands =
        await getLandsByPhone(data);

      return {
        handled: true,
        lookupState: "match",
        reply:
          formatLands(lands)
      };
    }

   if (
  command === "my animals"
) {
  const animalResult =
    await getFarmerAnimals({
      sheets:
        data && data.sheets,
      spreadsheetId:
        data && data.spreadsheetId,
      phone:
        data && data.phone,
      farmerId:
        member.farmerId
    });

  if (
    !animalResult ||
    !animalResult.success
  ) {
    return {
      handled: true,
      reply:
        "Sorry, your animal records could not be retrieved. Please try again."
    };
  }

  if (
    !Array.isArray(
      animalResult.animals
    ) ||
    animalResult.animals.length === 0
  ) {
    return {
      handled: true,
      reply: [
        "🐄 No registered animals were found for this WhatsApp number.",
        "",
        "Animal registration will be available shortly."
      ].join("\n")
    };
  }

  const lines = [
    "🐄 My Registered Animals",
    ""
  ];

  animalResult.animals.forEach(
    function (animal, index) {
      lines.push(
        String(index + 1) +
          ". " +
          (
            animal.animalType ||
            "Animal"
          )
      );

      lines.push(
        "Animal ID: " +
          (
            animal.animalId ||
            "-"
          )
      );

      lines.push(
        "Breed: " +
          (
            animal.breed ||
            "-"
          )
      );

      lines.push(
        "Sex: " +
          (
            animal.sex ||
            "-"
          )
      );

      lines.push(
        "Age: " +
          (
            animal.age ||
            "-"
          )
      );

      lines.push(
        "Tag number: " +
          (
            animal.tagNumber ||
            "-"
          )
      );

      lines.push(
        "Vaccination: " +
          (
            animal.vaccinationStatus ||
            "-"
          )
      );

      lines.push(
        "Health status: " +
          (
            animal.healthStatus ||
            "-"
          )
      );

      lines.push("");
    }
  );

  return {
    handled: true,
      lookupState: "match",
    reply:
      lines.join("\n").trim()
  };
}

    return {
      handled: false,
      reply: null
    };
  } catch (error) {
    console.error(
      "Personal records error.",
      { error: safeErrorDetails(error) }
    );

    return {
      handled: true,
      reply:
        formatPersonalRecordsError(
          normalizeProfileLanguage(
            data && data.language
          ) || "Malayalam"
        )
    };
  }
}

module.exports = {
  handlePersonalRecords,
  isPersonalRecordCommand,
  normalizePhone,
  getMemberByPhone,
  buildMemberRecord,
  formatMyProfile,
  formatFarmerId
};
