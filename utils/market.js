"use strict";

/*
 * BhoomiMitra Market Intelligence Module – Phase 1
 *
 * Functions:
 * 1. Reads Commodity_Market dynamically using its header row.
 * 2. Finds the latest available commodity price.
 * 3. Clearly separates source update time from BhoomiMitra check time.
 * 4. Validates commodity, market, unit and price.
 * 5. Detects genuine price changes.
 * 6. Prevents duplicate price records.
 * 7. Supports future experts, commodities and sources without hardcoding.
 *
 * Expected helper functions from index.js:
 * - readSheetRows(sheetName, range)
 * - appendRow(sheetName, row)
 */

const MARKET_SHEET = "Commodity_Market";

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function normaliseName(value) {
  return lower(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalisePrice(value) {
  const cleaned = clean(value)
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const number = Number(cleaned);

  return Number.isFinite(number)
    ? number
    : null;
}

function normaliseUnit(value) {
  const unit = normaliseName(value);

  const aliases = {
    kilogram: "kg",
    kilograms: "kg",
    kgs: "kg",
    kilo: "kg",
    quintals: "quintal",
    qtl: "quintal",
    tonnes: "tonne",
    tons: "tonne",
    numbers: "nos",
    number: "nos",
    pieces: "nos",
    piece: "nos"
  };

  return aliases[unit] || unit;
}

function toIsoDateTime(value) {
  const text = clean(value);

  if (!text) {
    return "";
  }

  const parsed = new Date(text);

  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return parsed.toISOString();
}

function nowIso() {
  return new Date().toISOString();
}

function headerKey(value) {
  return clean(value)
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase();
}

function rowsToObjects(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      headers: [],
      records: []
    };
  }

  const headers = rows[0].map(function (header) {
    return clean(header);
  });

  const records = rows.slice(1).map(function (row, index) {
    const record = {
      __rowNumber: index + 2
    };

    headers.forEach(function (header, columnIndex) {
      record[headerKey(header)] =
        row[columnIndex] == null
          ? ""
          : row[columnIndex];
    });

    return record;
  });

  return {
    headers,
    records
  };
}

function getValue(record, possibleNames) {
  const names = possibleNames || [];

  for (const name of names) {
    const key = headerKey(name);

    if (
      Object.prototype.hasOwnProperty.call(
        record,
        key
      ) &&
      clean(record[key]) !== ""
    ) {
      return record[key];
    }
  }

  return "";
}

function getCommodity(record) {
  return getValue(record, [
    "Commodity_Name",
    "Commodity",
    "Crop"
  ]);
}

function getVariety(record) {
  return getValue(record, [
    "Variety",
    "Commodity_Variety"
  ]);
}

function getMarket(record) {
  return getValue(record, [
    "Market",
    "Market_Name"
  ]);
}

function getDistrict(record) {
  return getValue(record, [
    "District",
    "Market_District"
  ]);
}

function getUnit(record) {
  return getValue(record, [
    "Unit",
    "Price_Unit"
  ]);
}

function getModalPrice(record) {
  return normalisePrice(
    getValue(record, [
      "Modal_Price",
      "Current_Price",
      "Average_Price",
      "Todays_Price",
      "Today_Price",
      "Expected_Price"
    ])
  );
}

function getMinimumPrice(record) {
  return normalisePrice(
    getValue(record, [
      "Minimum_Price",
      "Min_Price",
      "Lowest_Price"
    ])
  );
}

function getMaximumPrice(record) {
  return normalisePrice(
    getValue(record, [
      "Maximum_Price",
      "Max_Price",
      "Highest_Price"
    ])
  );
}

function getSourceName(record) {
  return getValue(record, [
    "Source_Name",
    "Primary_Source",
    "Source"
  ]);
}

function getSourcePublishedDate(record) {
  return getValue(record, [
    "Source_Published_Date",
    "Price_Date",
    "Date"
  ]);
}

function getSourcePublishedTime(record) {
  return getValue(record, [
    "Source_Published_Time",
    "Source_Update_Time"
  ]);
}

function getLastCheckedAt(record) {
  return getValue(record, [
    "Last_Checked_At",
    "Last_Checked",
    "Updated_At"
  ]);
}

function getLastChangedAt(record) {
  return getValue(record, [
    "Last_Changed_At",
    "Last_Changed"
  ]);
}

function recordTimestamp(record) {
  const possibleValues = [
    getLastChangedAt(record),
    getSourcePublishedDate(record) +
      " " +
      getSourcePublishedTime(record),
    getLastCheckedAt(record),
    getValue(record, ["Updated_At"]),
    getValue(record, ["Created_At"]),
    getValue(record, ["Date"])
  ];

  for (const value of possibleValues) {
    const date = new Date(clean(value));

    if (!Number.isNaN(date.getTime())) {
      return date.getTime();
    }
  }

  return 0;
}

function calculateFreshness(record) {
  const published =
    clean(getSourcePublishedDate(record)) +
    " " +
    clean(getSourcePublishedTime(record));

  const publishedDate = new Date(published);

  if (Number.isNaN(publishedDate.getTime())) {
    return "Unverified";
  }

  const ageHours =
    (Date.now() - publishedDate.getTime()) /
    (1000 * 60 * 60);

  if (ageHours < 0) {
    return "Unverified";
  }

  if (ageHours < 3) {
    return "Fresh – less than 3 hours";
  }

  if (ageHours < 24) {
    return "Today – more than 3 hours";
  }

  if (ageHours < 48) {
    return "Previous day";
  }

  return "Older data";
}

function calculatePriceStatus(record) {
  const sourceDateText =
    clean(getSourcePublishedDate(record));

  if (!sourceDateText) {
    return "Source Unavailable";
  }

  const sourceDate = new Date(sourceDateText);

  if (Number.isNaN(sourceDate.getTime())) {
    return "Latest Available Price";
  }

  const today = new Date();

  const sourceDay =
    sourceDate.getFullYear() +
    "-" +
    String(sourceDate.getMonth() + 1)
      .padStart(2, "0") +
    "-" +
    String(sourceDate.getDate())
      .padStart(2, "0");

  const todayDay =
    today.getFullYear() +
    "-" +
    String(today.getMonth() + 1)
      .padStart(2, "0") +
    "-" +
    String(today.getDate())
      .padStart(2, "0");

  if (sourceDay === todayDay) {
    return "Updated Today";
  }

  return "Previous Working Day Price";
}

function matchesQuery(record, query) {
  const input = query || {};

  const commodity = normaliseName(
    input.commodity
  );

  const variety = normaliseName(
    input.variety
  );

  const district = normaliseName(
    input.district
  );

  const market =
