"use strict";
/*
 * BhoomiMitra Market Updater
 *
 * Responsibilities:
 * - Read Commodity_Market
 * - Convert sheet rows to objects using headers
 * - Compare fetched records with existing records
 * - Insert genuine changes
 * - Record check-only events without pretending prices changed
 */
const {
  findLatestExistingRecord,
  compareMarketRecord,
  removeDuplicateFetchedRecords,
  normalisePrice
} = require("./marketValidator");
const MARKET_SHEET = "Commodity_Market";
function clean(value) {
  return String(value == null ? "" : value).trim();
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
  const headers = rows[0].map(function (item) {
    return clean(item);
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
  for (const name of possibleNames || []) {
    const key = headerKey(name);
    if (
      Object.prototype.hasOwnProperty.call(record, key) &&
      clean(record[key]) !== ""
    ) {
      return record[key];
    }
  }
  return "";
}
function mapExistingRecord(record) {
  return {
    rowNumber: record.__rowNumber,
    commodity: getValue(record, [
      "Commodity_Name",
      "Commodity"
    ]),
    variety: getValue(record, [
      "Variety"
    ]),
    district: getValue(record, [
      "District"
    ]),
    market: getValue(record, [
      "Market"
    ]),
    unit: getValue(record, [
      "Unit"
    ]),
    source: getValue(record, [
      "Source_Name",
      "Primary_Source",
      "Source"
    ]),
    price: normalisePrice(
      getValue(record, [
        "Modal_Price",
        "Current_Price",
        "Average_Price",
        "Expected_Price"
      ])
    ),
    modalPrice: normalisePrice(
      getValue(record, [
        "Modal_Price"
      ])
    ),
    currentPrice: normalisePrice(
      getValue(record, [
        "Current_Price"
      ])
    ),
    sourceDate: getValue(record, [
      "Source_Published_Date",
      "Price_Date",
      "Date"
    ]),
    sourceTime: getValue(record, [
      "Source_Published_Time"
    ]),
    checkedAt: getValue(record, [
      "Last_Checked_At"
    ]),
    lastChangedAt: getValue(record, [
      "Last_Changed_At"
    ])
  };
}
function makeRecordId(record) {
  const timestamp = Date.now();
  const commodity =
    clean(record.commodity)
      .replace(/\s+/g, "-")
      .toUpperCase();
  return (
    "BM-MKT-" +
    commodity +
    "-" +
    timestamp
  );
}
function buildInsertObject(
  fetchedRecord,
  comparison
) {
  const now =
    new Date().toISOString();
  return {
    Commodity_ID:
      makeRecordId(fetchedRecord),
    Commodity_Name:
      fetchedRecord.commodity,
    Variety:
      fetchedRecord.variety || "",
    Grade:
      fetchedRecord.grade || "",
    District:
      fetchedRecord.district,
    Market:
      fetchedRecord.market,
    Unit:
      fetchedRecord.unit,
    Current_Price:
      fetchedRecord.price,
    Minimum_Price:
      fetchedRecord.minimumPrice == null
        ? ""
        : fetchedRecord.minimumPrice,
    Maximum_Price:
      fetchedRecord.maximumPrice == null
        ? ""
        : fetchedRecord.maximumPrice,
    Modal_Price:
      fetchedRecord.price,
    Source_Name:
      fetchedRecord.source,
    Primary_Source:
      fetchedRecord.source,
    Source_Published_Date:
      fetchedRecord.sourceDate || "",
    Source_Published_Time:
      fetchedRecord.sourceTime || "",
    Last_Checked_At:
      fetchedRecord.checkedAt || now,
    Last_Changed_At:
      now,
    Update_Frequency:
      "Hourly Check",
    Price_Status:
      fetchedRecord.status ||
      "Latest Available Price",
    Previous_Price:
      comparison.previousPrice == null
        ? ""
        : comparison.previousPrice,
    Price_Change:
      comparison.priceChange == null
        ? ""
        : comparison.priceChange,
    Price_Change_Percent:
      comparison.priceChangePercent == null
        ? ""
        : comparison.priceChangePercent,
    Verification_Status:
      "Pending Verification",
    Cross_Verified:
      "No",
    Data_Freshness:
      "Fresh – less than 3 hours",
    Market_Trend:
      comparison.trend || "Unknown",
    Date:
      fetchedRecord.sourceDate || now,
    Created_At:
      now,
    Updated_At:
      now
  };
}
function objectToRow(headers, object) {
  return headers.map(function (header) {
    const key = clean(header);
    return Object.prototype.hasOwnProperty.call(
      object,
      key
    )
      ? object[key]
      : "";
  });
}
async function updateLastCheckedOnly(
  existingRecord,
  fetchedRecord,
  headers,
  updateRow
) {
  if (
    !existingRecord ||
    !existingRecord.rowNumber ||
    typeof updateRow !== "function"
  ) {
    return {
      success: false,
      action: "CHECK_ONLY_SKIPPED",
      reason:
        "No row update function or row number available."
    };
  }
  const updatedObject = {};
  headers.forEach(function (header) {
    updatedObject[header] = "";
  });
  updatedObject.Last_Checked_At =
    fetchedRecord.checkedAt ||
    new Date().toISOString();
  updatedObject.Updated_At =
    new Date().toISOString();
  await updateRow(
    MARKET_SHEET,
    existingRecord.rowNumber,
    updatedObject,
    headers
  );
  return {
    success: true,
    action: "CHECK_ONLY",
    rowNumber: existingRecord.rowNumber
  };
}
async function updateMarketRecords(options) {
  const input = options || {};
  const readSheetRows =
    input.readSheetRows;
  const appendRow =
    input.appendRow;
  const updateRow =
    input.updateRow;
  const fetchedRecords =
    removeDuplicateFetchedRecords(
      input.fetchedRecords || []
    );
  if (typeof readSheetRows !== "function") {
    throw new Error(
      "readSheetRows function is required."
    );
  }
  if (typeof appendRow !== "function") {
    throw new Error(
      "appendRow function is required."
    );
  }
  const rows = await readSheetRows(
    MARKET_SHEET,
    "A:ZZ"
  );
  const parsed = rowsToObjects(rows);
  if (parsed.headers.length === 0) {
    throw new Error(
      "Commodity_Market header row is missing."
    );
  }
  const existingRecords =
    parsed.records.map(mapExistingRecord);
  const results = [];
  for (const fetchedRecord of fetchedRecords) {
    const latestExisting =
      findLatestExistingRecord(
        existingRecords,
        fetchedRecord
      );
    const comparison =
      compareMarketRecord(
        latestExisting,
        fetchedRecord
      );
    if (comparison.action === "CHECK_ONLY") {
      const checkResult =
        await updateLastCheckedOnly(
          latestExisting,
          fetchedRecord,
          parsed.headers,
          updateRow
        );
      results.push({
        commodity:
          fetchedRecord.commodity,
        market:
          fetchedRecord.market,
        source:
          fetchedRecord.source,
        ...checkResult
      });
      continue;
    }
    const insertObject =
      buildInsertObject(
        fetchedRecord,
        comparison
      );
    const row =
      objectToRow(
        parsed.headers,
        insertObject
      );
    await appendRow(
      MARKET_SHEET,
      row
    );
    results.push({
      success: true,
      action: "INSERT",
      commodity:
        fetchedRecord.commodity,
      market:
        fetchedRecord.market,
      source:
        fetchedRecord.source,
      previousPrice:
        comparison.previousPrice,
      currentPrice:
        fetchedRecord.price,
      priceChange:
        comparison.priceChange,
      priceChangePercent:
        comparison.priceChangePercent,
      trend:
        comparison.trend
    });
  }
  return {
    success: true,
    fetchedCount:
      fetchedRecords.length,
    processedCount:
      results.length,
    results
  };
}
module.exports = {
  rowsToObjects,
  mapExistingRecord,
  buildInsertObject,
  objectToRow,
  updateMarketRecords
};
