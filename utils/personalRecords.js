"use strict";

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizePhone(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .trim();
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
  return possibleHeaders
    .map(function (header) {
      return headers.indexOf(header);
    })
    .filter(function (index) {
      return index >= 0;
    });
}

function isPersonalRecordCommand(userText) {
  const text =
    normalizeText(userText);

  return [
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

  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range:
        "Master_Member_Registry!A:AZ"
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
        "mobile_number",
        "mobile",
        "whatsapp_no",
        "whatsapp_number",
        "whatsapp",
        "registered_mobile",
        "farmer_mobile"
      ]
    );

  const memberRow =
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

  if (!memberRow) {
    return null;
  }

  return {
    headers,
    row: memberRow
  };
}

function buildMemberRecord(memberData) {
  const headers =
    memberData.headers;

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

  const memberTypeIndex =
    findFirstHeaderIndex(
      headers,
      [
        "member_type",
        "registration_type"
      ]
    );

  const districtIndex =
    findFirstHeaderIndex(
      headers,
      ["district"]
    );

  const panchayatIndex =
    findFirstHeaderIndex(
      headers,
      [
        "panchayat",
        "local_body"
      ]
    );

  const mobileIndex =
    findFirstHeaderIndex(
      headers,
      [
        "whatsapp_no",
        "whatsapp_number",
        "mobile_no",
        "mobile_number"
      ]
    );

  return {
    farmerId:
      getCell(row, idIndex),
    name:
      getCell(row, nameIndex),
    memberType:
      getCell(
        row,
        memberTypeIndex
      ),
    district:
      getCell(
        row,
        districtIndex
      ),
    panchayat:
      getCell(
        row,
        panchayatIndex
      ),
    mobile:
      getCell(
        row,
        mobileIndex
      )
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

  const areaIndex =
    findFirstHeaderIndex(
      headers,
      [
        "area",
        "gps_calculated_area"
      ]
    );

  const areaUnitIndex =
    findFirstHeaderIndex(
      headers,
      ["area_unit"]
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
          getCell(
            row,
            areaIndex
          ),
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

function formatMyDetails(member) {
  return [
    "👤 My BhoomiMitra Details",
    "",
    "Name: " +
      (member.name || "-"),
    "Farmer ID: " +
      (member.farmerId || "-"),
    "Member type: " +
      (member.memberType || "-"),
    "WhatsApp number: " +
      (member.mobile || "-"),
    "District: " +
      (member.district || "-"),
    "Panchayat/Local body: " +
      (member.panchayat || "-")
  ].join("\n");
}

function formatFarmerId(member) {
  if (!member.farmerId) {
    return [
      "Your BhoomiMitra Farmer ID is not available.",
      "",
      "Please complete or correct your farmer registration."
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
      (member.panchayat || "-"),
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

      lines.push(
        "Area: " +
          [
            land.area,
            land.areaUnit
          ]
            .filter(Boolean)
            .join(" ")
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
    const memberData =
      await getMemberByPhone(data);

    if (!memberData) {
      return {
        handled: true,
        reply: [
          "No BhoomiMitra member record was found for this WhatsApp number.",
          "",
          "Please register first or contact BhoomiMitra support for correction."
        ].join("\n")
      };
    }

    const member =
      buildMemberRecord(
        memberData
      );

    const command =
      normalizeText(userText);

    if (command === "my details") {
      return {
        handled: true,
        reply:
          formatMyDetails(member)
      };
    }

    if (
      command ===
      "my farmer id"
    ) {
      return {
        handled: true,
        reply:
          formatFarmerId(member)
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
        reply:
          formatLands(lands)
      };
    }

    if (
      command === "my animals"
    ) {
      return {
        handled: true,
        reply:
          "Animal records will be connected shortly."
      };
    }

    return {
      handled: false,
      reply: null
    };
  } catch (error) {
    console.error(
      "Personal records error:",
      error &&
      error.message
        ? error.message
        : error
    );

    return {
      handled: true,
      reply:
        "Sorry, your personal records could not be retrieved. Please try again."
    };
  }
}

module.exports = {
  handlePersonalRecords,
  isPersonalRecordCommand
};
