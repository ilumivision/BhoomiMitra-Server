"use strict";
const axios = require("axios");
const RESOURCE_ID =
  "9ef84268-d588-465a-a308-a864a43d0070";
const API_URL =
  "https://api.data.gov.in/resource/" +
  RESOURCE_ID;
function clean(value) {
  return String(
    value == null ? "" : value
  ).trim();
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
  return Number(
    (number / 100).toFixed(2)
  );
}
function mapRecord(record) {
  const minimumPrice =
    convertQuintalToKg(
      record.min_price
    );
  const maximumPrice =
    convertQuintalToKg(
      record.max_price
    );
  const modalPrice =
    convertQuintalToKg(
      record.modal_price
    );
  return {
    commodity:
      clean(record.commodity),
    variety:
      clean(record.variety),
    grade:
      clean(record.grade),
    state:
      clean(record.state),
    district:
      clean(record.district),
    market:
      clean(record.market),
    minimumPrice,
    maximumPrice,
    price: modalPrice,
    unit: "kg",
    originalUnit: "quintal",
    originalMinimumPrice:
      normalisePrice(
        record.min_price
      ),
    originalMaximumPrice:
      normalisePrice(
        record.max_price
      ),
    originalModalPrice:
      normalisePrice(
        record.modal_price
      ),
    source: "AGMARKNET",
    sourceDate:
      clean(record.arrival_date),
    sourceTime: "",
    checkedAt:
      new Date().toISOString(),
    status:
      "Latest Available Price",
    verificationStatus:
      "Official Source",
    sourceUrl:
      "https://www.data.gov.in/resource/" +
      "current-daily-price-various-" +
      "commodities-various-markets-mandi"
  };
}
async function fetchAgmarknet(options) {
  const input = options || {};
  const apiKey = clean(
    input.apiKey ||
    process.env.AGMARKNET_API_KEY
  );
  if (!apiKey) {
    throw new Error(
      "AGMARKNET_API_KEY is not configured."
    );
  }
  const limit = Math.min(
    Number(input.limit || 1000),
    10000
  );
  const params = {
    "api-key": apiKey,
    format: "json",
    offset:
      Number(input.offset || 0),
    limit
  };
  /*
   * State and commodity API filters are
   * intentionally not used here.
   *
   * AGMARKNET exact filters can return
   * zero records because commodity names
   * vary between markets.
   *
   * BhoomiMitra fetches available records
   * and performs flexible matching below.
   */
  if (clean(input.district)) {
    params["filters[district]"] =
      clean(input.district);
  }
  if (clean(input.market)) {
    params["filters[market]"] =
      clean(input.market);
  }
  if (clean(input.variety)) {
    params["filters[variety]"] =
      clean(input.variety);
  }
  console.log(
    "AGMARKNET Request Params:",
    {
      ...params,
      "api-key": apiKey
        ? "**configured**"
        : "**missing**"
    }
  );
  console.log(
    "AGMARKNET URL:",
    API_URL
  );
  const response =
    await axios.get(
      API_URL,
      {
        params,
        timeout: 90000,
        headers: {
          Accept:
            "application/json",
          "User-Agent":
            "BhoomiMitra-" +
            "Market-Engine/1.0"
        }
      }
    );
  const records =
    response &&
    response.data &&
    Array.isArray(
      response.data.records
    )
      ? response.data.records
      : [];
  console.log(
    "AGMARKNET response summary:",
    {
      status:
        response &&
        response.data
          ? response.data.status
          : "",
      total:
        response &&
        response.data
          ? response.data.total
          : 0,
      count:
        response &&
        response.data
          ? response.data.count
          : 0,
      receivedRecords:
        records.length
    }
  );
  console.log(
    "First 10 records:",
    records
      .slice(0, 10)
      .map(function (record) {
        return {
          state:
            record.state,
          commodity:
            record.commodity,
          variety:
            record.variety,
          market:
            record.market,
          district:
            record.district
        };
      })
  );
  const requestedCommodity =
    clean(
      input.commodity
    ).toLowerCase();
  const requestedState =
    clean(
      input.state || "Kerala"
    ).toLowerCase();
  const commodityAliases = {
    coconut: [
      "coconut"
    ],
    "tender coconut": [
      "tender coconut"
    ],
    "black pepper": [
      "black pepper",
      "pepper"
    ],
    pepper: [
      "pepper",
      "black pepper"
    ],
    ginger: [
      "ginger",
      "ginger(green)",
      "ginger green",
      "green ginger"
    ],
    banana: [
      "banana",
      "plantain",
      "nendran"
    ],
    tapioca: [
      "tapioca",
      "cassava"
    ],
    arecanut: [
      "arecanut",
      "betel nut"
    ],
    turmeric: [
      "turmeric"
    ],
    mango: [
      "mango"
    ],
    pineapple: [
      "pineapple"
    ],
    jackfruit: [
      "jackfruit"
    ],
    nutmeg: [
      "nutmeg"
    ],
    cocoa: [
      "cocoa"
    ]
  };
  const aliases =
    commodityAliases[
      requestedCommodity
    ] || [
      requestedCommodity
    ];
  const mappedRecords =
    records
      .map(mapRecord)
      .filter(
        function (record) {
          return (
            record.commodity &&
            record.market &&
            record.district &&
            record.price != null
          );
        }
      );
  const commodityMatchedRecords =
    mappedRecords.filter(
      function (record) {
        if (!requestedCommodity) {
          return true;
        }
        const recordCommodity =
          clean(
            record.commodity
          ).toLowerCase();
        return aliases.some(
          function (alias) {
            const cleanAlias =
              clean(
                alias
              ).toLowerCase();
            return (
              recordCommodity ===
                cleanAlias ||
              recordCommodity.includes(
                cleanAlias
              ) ||
              cleanAlias.includes(
                recordCommodity
              )
            );
          }
        );
      }
    );
  const stateMatchedRecords =
    commodityMatchedRecords.filter(
      function (record) {
        return (
          clean(
            record.state
          ).toLowerCase() ===
          requestedState
        );
      }
    );
  const selectedRecords =
    stateMatchedRecords.length > 0
      ? stateMatchedRecords
      : commodityMatchedRecords;
  console.log(
    "AGMARKNET requested commodity:",
    requestedCommodity
  );
  console.log(
    "AGMARKNET requested state:",
    requestedState
  );
  console.log(
    "AGMARKNET commodity matches:",
    commodityMatchedRecords.length
  );
  console.log(
    "AGMARKNET preferred-state matches:",
    stateMatchedRecords.length
  );
  console.log(
    "AGMARKNET records selected:",
    selectedRecords.length
  );
  if (selectedRecords.length > 0) {
    console.log(
      "AGMARKNET first selected record:",
      selectedRecords[0]
    );
  }
  return selectedRecords;
}
module.exports = {
  fetchAgmarknet,
  mapRecord,
  convertQuintalToKg
};
