"use strict";
/*
 * BhoomiMitra Market Validator
 *
 * Responsibilities:
 * - Validate fetched market-price records
 * - Standardise commodity, variety, market and unit
 * - Compare fetched prices with existing Commodity_Market records
 * - Detect genuine price changes
 * - Prevent duplicate entries
 */
function clean(value) {
  return String(value == null ? "" : value).trim();
}
function normaliseText(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function normaliseUnit(value) {
  const unit = normaliseText(value);
  const aliases = {
    kilogram: "kg",
    kilograms: "kg",
    kgs: "kg",
    kilo: "kg",
    kg: "kg",
    gram: "g",
    grams: "g",
    g: "g",
    quintals: "quintal",
    qtl: "quintal",
    quintal: "quintal",
    tonne: "tonne",
    tonnes: "tonne",
    ton: "tonne",
    tons: "tonne",
    number: "nos",
    numbers: "nos",
    piece: "nos",
    pieces: "nos",
    nos: "nos",
    dozen: "dozen",
    litres: "litre",
    liters: "litre",
    litre: "litre",
    liter: "litre"
  };
  return aliases[unit] || unit;
}
function normalisePrice(value) {
  const text = clean(value)
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");
  const price = Number(text);
  return Number.isFinite(price)
    ? price
    : null;
}
function createRecordKey(record) {
  return [
    normaliseText(record.commodity),
    normaliseText(record.variety),
    normaliseText(record.district),
    normaliseText(record.market),
    normaliseUnit(record.unit),
    normaliseText(record.source)
  ].join("|");
}
function validateMarketRecord(record) {
  const errors = [];
  const commodity = clean(record.commodity);
  const market = clean(record.market);
  const district = clean(record.district);
  const unit = normaliseUnit(record.unit);
  const price = normalisePrice(record.price);
  const source = clean(record.source);
  if (!commodity) {
    errors.push("Commodity is missing.");
  }
  if (!market) {
    errors.push("Market is missing.");
  }
  if (!district) {
    errors.push("District is missing.");
  }
  if (!unit) {
    errors.push("Unit is missing.");
  }
  if (price == null || price < 0) {
    errors.push("Price is invalid.");
  }
  if (!source) {
    errors.push("Source is missing.");
  }
  return {
    valid: errors.length === 0,
    errors,
    record: {
      commodity,
      variety: clean(record.variety),
      grade: clean(record.grade),
      district,
      market,
      unit,
      price,
      minimumPrice:
        normalisePrice(record.minimumPrice),
      maximumPrice:
        normalisePrice(record.maximumPrice),
      source,
      sourceDate: clean(record.sourceDate),
      sourceTime: clean(record.sourceTime),
      checkedAt:
        clean(record.checkedAt) ||
        new Date().toISOString(),
      status:
        clean(record.status) ||
        "Latest Available Price"
    }
  };
}
function findLatestExistingRecord(
  existingRecords,
  fetchedRecord
) {
  const fetchedKey =
    createRecordKey(fetchedRecord);
  const matches = (existingRecords || [])
    .filter(function (existing) {
      return (
        createRecordKey(existing) ===
        fetchedKey
      );
    })
    .sort(function (a, b) {
      const aTime = new Date(
        a.lastChangedAt ||
        a.sourceDate ||
        a.checkedAt ||
        0
      ).getTime();
      const bTime = new Date(
        b.lastChangedAt ||
        b.sourceDate ||
        b.checkedAt ||
        0
      ).getTime();
      return bTime - aTime;
    });
  return matches.length > 0
    ? matches[0]
    : null;
}
function calculatePriceChange(
  previousPrice,
  currentPrice
) {
  const previous =
    normalisePrice(previousPrice);
  const current =
    normalisePrice(currentPrice);
  if (
    previous == null ||
    current == null
  ) {
    return {
      change: null,
      changePercent: null,
      trend: "Unknown"
    };
  }
  const change = current - previous;
  const changePercent =
    previous === 0
      ? null
      : (change / previous) * 100;
  let trend = "Stable";
  if (change > 0) {
    trend = "Rising";
  } else if (change < 0) {
    trend = "Falling";
  }
  return {
    change:
      Number(change.toFixed(2)),
    changePercent:
      changePercent == null
        ? null
        : Number(
            changePercent.toFixed(2)
          ),
    trend
  };
}
function compareMarketRecord(
  existingRecord,
  fetchedRecord
) {
  if (!existingRecord) {
    return {
      action: "INSERT",
      reason: "No previous matching record.",
      changed: true,
      previousPrice: null,
      priceChange: null,
      priceChangePercent: null,
      trend: "New"
    };
  }
  const previousPrice =
    normalisePrice(
      existingRecord.price ||
      existingRecord.modalPrice ||
      existingRecord.currentPrice
    );
  const currentPrice =
    normalisePrice(fetchedRecord.price);
  const priceDetails =
    calculatePriceChange(
      previousPrice,
      currentPrice
    );
  const sourceDateChanged =
    clean(existingRecord.sourceDate) !==
    clean(fetchedRecord.sourceDate);
  const sourceTimeChanged =
    clean(existingRecord.sourceTime) !==
    clean(fetchedRecord.sourceTime);
  const priceChanged =
    previousPrice !== currentPrice;
  const genuineChange =
    priceChanged ||
    sourceDateChanged ||
    sourceTimeChanged;
  if (!genuineChange) {
    return {
      action: "CHECK_ONLY",
      reason:
        "Price and source publication details are unchanged.",
      changed: false,
      previousPrice,
      priceChange: 0,
      priceChangePercent: 0,
      trend: "Stable"
    };
  }
  return {
    action: "INSERT",
    reason:
      priceChanged
        ? "Price genuinely changed."
        : "Source publication date or time changed.",
    changed: true,
    previousPrice,
    priceChange:
      priceDetails.change,
    priceChangePercent:
      priceDetails.changePercent,
    trend:
      priceDetails.trend
  };
}
function removeDuplicateFetchedRecords(records) {
  const latestByKey = new Map();
  (records || []).forEach(function (record) {
    const validation =
      validateMarketRecord(record);
    if (!validation.valid) {
      console.error(
        "Invalid market record:",
        validation.errors,
        record
      );
      return;
    }
    const cleanRecord =
      validation.record;
    const key =
      createRecordKey(cleanRecord);
    latestByKey.set(
      key,
      cleanRecord
    );
  });
  return Array.from(
    latestByKey.values()
  );
}
module.exports = {
  clean,
  normaliseText,
  normaliseUnit,
  normalisePrice,
  createRecordKey,
  validateMarketRecord,
  findLatestExistingRecord,
  calculatePriceChange,
  compareMarketRecord,
  removeDuplicateFetchedRecords
};
