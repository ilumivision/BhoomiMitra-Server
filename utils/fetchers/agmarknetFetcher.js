"use strict";
const axios = require("axios");
const RESOURCE_ID =
  "9ef84268-d588-465a-a308-a864a43d0070";
const API_URL =
  "https://api.data.gov.in/resource/" +
  RESOURCE_ID;
function clean(value) {
  return String(value == null ? "" : value).trim();
}
function normalisePrice(value) {
  const number = Number(
    clean(value)
      .replace(/,/g, "")
      .replace(/[^\d.-]/g, "")
  );
  return Number.isFinite(number)
    ? number
    : null;
}
function convertQuintalToKg(price) {
  const number = normalisePrice(price);
  if (number == null) {
    return null;
  }
  return Number((number / 100).toFixed(2));
}
function mapRecord(record) {
  const minimumPrice =
    convertQuintalToKg(record.min_price);
  const maximumPrice =
    convertQuintalToKg(record.max_price);
  const modalPrice =
    convertQuintalToKg(record.modal_price);
  return {
    commodity: clean(record.commodity),
    variety: clean(record.variety),
    grade: clean(record.grade),
    state: clean(record.state),
    district: clean(record.district),
    market: clean(record.market),
    minimumPrice,
    maximumPrice,
    price: modalPrice,
    unit: "kg",
    originalUnit: "quintal",
    originalMinimumPrice:
      normalisePrice(record.min_price),
    originalMaximumPrice:
      normalisePrice(record.max_price),
    originalModalPrice:
      normalisePrice(record.modal_price),
    source: "AGMARKNET",
    sourceDate: clean(record.arrival_date),
    sourceTime: "",
    checkedAt: new Date().toISOString(),
    status: "Latest Available Price",
    verificationStatus: "Official Source",
    sourceUrl:
      "https://www.data.gov.in/resource/" +
      "current-daily-price-various-" +
      "commodities-various-markets-mandi"
  };
}
async function fetchAgmarknet(options) {
  const input = options || {};
  const apiKey =
    clean(
      input.apiKey ||
      process.env.AGMARKNET_API_KEY
    );
  if (!apiKey) {
    throw new Error(
      "AGMARKNET_API_KEY is not configured."
    );
  }
  const limit =
    Math.min(
      Number(input.limit || 1000),
      10000
    );
const response = await axios.get(

console.log("AGMARKNET Request Params:", {
  ...params,
  "api-key": apiKey
    ? "**configured**"
    : "**missing**"
});

  const response = await axios.get(
    API_URL,
    {
      params,
     timeout: 90000,
      headers: {
        Accept: "application/json",
        "User-Agent":
          "BhoomiMitra-Market-Engine/1.0"
      }
    }
  );
  const records =
    response &&
    response.data &&
    Array.isArray(response.data.records)
      ? response.data.records
      : [];
  console.log(
  "First 10 records:",
  records.slice(0, 10).map(function (r) {
    return {
      commodity: r.commodity,
      variety: r.variety,
      market: r.market,
      district: r.district
    };
  })
);
const uniqueCommodities = [
  ...new Set(
    records
      .map(function (record) {
        return clean(record.commodity);
      })
      .filter(Boolean)
  )
].sort();

console.log(
  "AGMARKNET unique commodities:",
  uniqueCommodities
);  
  const mapped = records
    .map(mapRecord)
    .filter(function (record) {
      return (
        record.commodity &&
        record.market &&
        record.district &&
        record.price != null
      );
    });
  console.log(
    "AGMARKNET records fetched:",
    mapped.length
  );
  return mapped;
}
module.exports = {
  fetchAgmarknet,
  mapRecord,
  convertQuintalToKg
};
