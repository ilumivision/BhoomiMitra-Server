"use strict";

const axios = require("axios");
const {
  resolveCommodity
} = require("../commodityResolver");
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

function normaliseText(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseCommodityQuery(value) {
  let query =
    normaliseText(value);

  const startWords = [
    "what is the",
    "what is",
    "tell me",
    "show me",
    "current market price of",
    "latest market price of",
    "market price of",
    "today market price of",
    "price of",
    "current price of",
    "latest price of"
  ];

  startWords.forEach(function (text) {
    if (
      query.startsWith(text + " ")
    ) {
      query = query
        .substring(text.length)
        .trim();
    }
  });

  const endWords = [
    "market price",
    "price today",
    "today",
    "price",
    "latest",
    "current"
  ];

  endWords.forEach(function (text) {
    if (
      query.endsWith(" " + text)
    ) {
      query = query
        .substring(
          0,
          query.length -
            text.length
        )
        .trim();
    }
  });

  return query;
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
  const number =
    normalisePrice(price);

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

const COMMODITY_ALIASES = {
  coconut: [
    "coconut"
  ],

  "tender coconut": [
    "tender coconut"
  ],

  pepper: [
    "pepper",
    "black pepper"
  ],

  "black pepper": [
    "black pepper",
    "pepper"
  ],

  cardamom: [
    "cardamom"
  ],

  nutmeg: [
    "nutmeg"
  ],

  clove: [
    "clove"
  ],

  cinnamon: [
    "cinnamon"
  ],

  vanilla: [
    "vanilla"
  ],

  ginger: [
    "ginger",
    "ginger green",
    "green ginger"
  ],

  turmeric: [
    "turmeric"
  ],

  arecanut: [
    "arecanut",
    "betel nut"
  ],

  rubber: [
    "rubber"
  ],

  "rubber latex": [
    "rubber latex",
    "latex"
  ],

  latex: [
    "latex",
    "rubber latex"
  ],

  cocoa: [
    "cocoa"
  ],

  coffee: [
    "coffee"
  ],

  tea: [
    "tea"
  ],

  cashew: [
    "cashew",
    "cashew nut"
  ],

  banana: [
    "banana",
    "plantain"
  ],

  nendran: [
    "nendran",
    "banana",
    "plantain"
  ],

  robusta: [
    "robusta",
    "banana",
    "plantain"
  ],

  poovan: [
    "poovan",
    "banana",
    "plantain"
  ],

  mango: [
    "mango"
  ],

  jackfruit: [
    "jackfruit"
  ],

  pineapple: [
    "pineapple"
  ],

  papaya: [
    "papaya"
  ],

  rambutan: [
    "rambutan"
  ],

  mangosteen: [
    "mangosteen"
  ],

  "dragon fruit": [
    "dragon fruit",
    "dragonfruit"
  ],

  dragonfruit: [
    "dragonfruit",
    "dragon fruit"
  ],

  avocado: [
    "avocado"
  ],

  guava: [
    "guava"
  ],

  sapota: [
    "sapota",
    "chikoo"
  ],

  chikoo: [
    "chikoo",
    "sapota"
  ],

  "passion fruit": [
    "passion fruit"
  ],

  orange: [
    "orange"
  ],

  lemon: [
    "lemon"
  ],

  lime: [
    "lime"
  ],

  "sweet lime": [
    "sweet lime",
    "mosambi"
  ],

  watermelon: [
    "watermelon"
  ],

  muskmelon: [
    "muskmelon"
  ]
};
const MORE_COMMODITY_ALIASES = {
  tapioca: [
    "tapioca",
    "cassava"
  ],

  cassava: [
    "cassava",
    "tapioca"
  ],

  yam: [
    "yam"
  ],

  "elephant foot yam": [
    "elephant foot yam",
    "elephant yam",
    "suran"
  ],

  colocasia: [
    "colocasia",
    "taro"
  ],

  potato: [
    "potato"
  ],

  "sweet potato": [
    "sweet potato"
  ],

  tomato: [
    "tomato"
  ],

  onion: [
    "onion"
  ],

  "small onion": [
    "small onion",
    "shallot",
    "shallots"
  ],

  garlic: [
    "garlic"
  ],

  chilli: [
    "chilli",
    "dry chilli"
  ],

  "green chilli": [
    "green chilli",
    "chilli green"
  ],

  brinjal: [
    "brinjal",
    "eggplant"
  ],

  okra: [
    "okra",
    "bhindi",
    "ladies finger"
  ],

  cabbage: [
    "cabbage"
  ],

  cauliflower: [
    "cauliflower"
  ],

  beans: [
    "beans"
  ],

  "french beans": [
    "french beans"
  ],

  "cluster beans": [
    "cluster beans"
  ],

  cowpea: [
    "cowpea"
  ],

  cucumber: [
    "cucumber"
  ],

  pumpkin: [
    "pumpkin"
  ],

  "ash gourd": [
    "ash gourd",
    "winter melon"
  ],

  "bitter gourd": [
    "bitter gourd"
  ],

  "snake gourd": [
    "snake gourd"
  ],

  "ridge gourd": [
    "ridge gourd"
  ],

  "bottle gourd": [
    "bottle gourd"
  ],

  chowchow: [
    "chowchow",
    "chayote"
  ],

  drumstick: [
    "drumstick",
    "moringa"
  ],

  beetroot: [
    "beetroot"
  ],

  carrot: [
    "carrot"
  ],

  radish: [
    "radish"
  ],

  spinach: [
    "spinach"
  ],

  amaranthus: [
    "amaranthus",
    "amaranth"
  ],

  coriander: [
    "coriander"
  ],

  mint: [
    "mint"
  ],

  paddy: [
    "paddy",
    "paddy dhan common",
    "paddy dhan fine"
  ],

  rice: [
    "rice"
  ],

  maize: [
    "maize",
    "corn"
  ],

  ragi: [
    "ragi",
    "finger millet"
  ],

  millet: [
    "millet"
  ],

  "green gram": [
    "green gram",
    "moong"
  ],

  "black gram": [
    "black gram",
    "urad"
  ],

  "bengal gram": [
    "bengal gram",
    "chana"
  ],

  "red gram": [
    "red gram",
    "tur"
  ],

  groundnut: [
    "groundnut",
    "peanut"
  ],

  sesame: [
    "sesame"
  ],

  mustard: [
    "mustard"
  ],

  jasmine: [
    "jasmine"
  ],

  marigold: [
    "marigold"
  ],

  rose: [
    "rose"
  ],

  tuberose: [
    "tuberose"
  ]
};

Object.assign(
  COMMODITY_ALIASES,
  MORE_COMMODITY_ALIASES
);

function getCommodityAliases(
  requestedCommodity
) {
  const aliases =
    COMMODITY_ALIASES[
      requestedCommodity
    ] || [
      requestedCommodity
    ];

  return aliases
    .map(normaliseText)
    .filter(Boolean);
}

function commodityMatchesAliases(
  recordCommodity,
  aliases
) {
  const normalisedRecord =
    normaliseText(
      recordCommodity
    );

  return aliases.some(
    function (alias) {
      return (
        normalisedRecord === alias
      );
    }
  );
}

function parseSourceDate(value) {
  const text = clean(value);

  if (!text) {
    return null;
  }

  const parts =
    text.split("/");

  if (parts.length === 3) {
    const day =
      Number(parts[0]);

    const month =
      Number(parts[1]) - 1;

    const year =
      Number(parts[2]);

    const parsed =
      new Date(
        year,
        month,
        day
      );

    if (
      !Number.isNaN(
        parsed.getTime()
      )
    ) {
      return parsed;
    }
  }

  const parsed =
    new Date(text);

  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;
}

function isSameCalendarDay(
  firstDate,
  secondDate
) {
  if (
    !firstDate ||
    !secondDate
  ) {
    return false;
  }

  return (
    firstDate.getFullYear() ===
      secondDate.getFullYear() &&
    firstDate.getMonth() ===
      secondDate.getMonth() &&
    firstDate.getDate() ===
      secondDate.getDate()
  );
}

function sortByLatestDate(
  records
) {
  return records
    .slice()
    .sort(
      function (a, b) {
        const first =
          parseSourceDate(
            a.sourceDate
          );

        const second =
          parseSourceDate(
            b.sourceDate
          );

        const firstTime =
          first
            ? first.getTime()
            : 0;

        const secondTime =
          second
            ? second.getTime()
            : 0;

        return (
          secondTime -
          firstTime
        );
      }
    );
}
function latestDateRecords(
  records
) {
  if (
    !records ||
    records.length === 0
  ) {
    return [];
  }

  const sorted =
    sortByLatestDate(
      records
    );

  const latestDate =
    parseSourceDate(
      sorted[0].sourceDate
    );

  if (!latestDate) {
    return sorted;
  }

  return sorted.filter(
    function (record) {
      const recordDate =
        parseSourceDate(
          record.sourceDate
        );

      return isSameCalendarDay(
        recordDate,
        latestDate
      );
    }
  );
}

function uniqueStates(records) {
  return Array.from(
    new Set(
      records
        .map(
          function (record) {
            return clean(
              record.state
            );
          }
        )
        .filter(Boolean)
    )
  ).sort();
}

function getTodayInIndia() {
  const indiaText =
    new Date().toLocaleDateString(
      "en-CA",
      {
        timeZone:
          "Asia/Kolkata"
      }
    );

  return new Date(
    indiaText +
      "T00:00:00+05:30"
  );
}

function addResultMetadata(
  records,
  details
) {
  return records.map(
    function (record) {
      return {
        ...record,

        isTodayPrice:
          details.isTodayPrice,

        todayPriceAvailable:
          details.isTodayPrice,

        todayPriceMessage:
          details.isTodayPrice
            ? "Today's official price is available."
            : "Today's official price is not available. Showing the latest available official price.",

        searchScope:
          details.searchScope,

        requestedMarket:
          details.requestedMarket,

        requestedDistrict:
          details.requestedDistrict,

        requestedState:
          details.requestedState,

        needsStateChoice:
          Boolean(
            details.needsStateChoice
          ),

        availableStates:
          details.availableStates ||
          []
      };
    }
  );
}

function selectBestRecords(
  commodityRecords,
  options
) {
  const input =
    options || {};

  const requestedMarket =
    normaliseText(
      input.market
    );

  const requestedDistrict =
    normaliseText(
      input.district
    );

  const requestedState =
    normaliseText(
      input.state || "Kerala"
    );

  const today =
    getTodayInIndia();

  function chooseFromScope(
    scopeRecords,
    searchScope
  ) {
    if (
      scopeRecords.length === 0
    ) {
      return null;
    }

    const todayRecords =
      scopeRecords.filter(
        function (record) {
          return isSameCalendarDay(
            parseSourceDate(
              record.sourceDate
            ),
            today
          );
        }
      );

    if (
      todayRecords.length > 0
    ) {
      return addResultMetadata(
        todayRecords.slice(0, 5),
        {
          isTodayPrice: true,
          searchScope,
          requestedMarket:
            clean(input.market),
          requestedDistrict:
            clean(input.district),
          requestedState:
            clean(
              input.state ||
              "Kerala"
            ),
          needsStateChoice: false,
          availableStates: []
        }
      );
    }

    const latestRecords =
      latestDateRecords(
        scopeRecords
      );

    return addResultMetadata(
      latestRecords.slice(0, 5),
      {
        isTodayPrice: false,
        searchScope,
        requestedMarket:
          clean(input.market),
        requestedDistrict:
          clean(input.district),
        requestedState:
          clean(
            input.state ||
            "Kerala"
          ),
        needsStateChoice: false,
        availableStates: []
      }
    );
  }

  /*
   * Priority 1:
   * Requested market in requested state.
   */
  if (requestedMarket) {
    const marketRecords =
      commodityRecords.filter(
        function (record) {
          return (
            normaliseText(
              record.market
            ) ===
              requestedMarket &&
            normaliseText(
              record.state
            ) ===
              requestedState
          );
        }
      );

    const selected =
      chooseFromScope(
        marketRecords,
        "Requested Market"
      );

    if (selected) {
      return selected;
    }
  }

  /*
   * Priority 2:
   * Requested district in requested state.
   */
  if (requestedDistrict) {
    const districtRecords =
      commodityRecords.filter(
        function (record) {
          return (
            normaliseText(
              record.district
            ) ===
              requestedDistrict &&
            normaliseText(
              record.state
            ) ===
              requestedState
          );
        }
      );

    const selected =
      chooseFromScope(
        districtRecords,
        "Requested District"
      );

    if (selected) {
      return selected;
    }
  }

  /*
   * Priority 3:
   * Any market in Kerala or other
   * specifically requested state.
   */
  const stateRecords =
    commodityRecords.filter(
      function (record) {
        return (
          normaliseText(
            record.state
          ) ===
          requestedState
        );
      }
    );

  const selectedStateRecords =
    chooseFromScope(
      stateRecords,
      requestedState === "kerala"
        ? "Any Kerala Market"
        : "Requested State"
    );

  if (selectedStateRecords) {
    return selectedStateRecords;
  }

  /*
   * Priority 4:
   * Same commodity exists only outside
   * Kerala/requested state.
   */
  const otherStateRecords =
    commodityRecords.filter(
      function (record) {
        return (
          normaliseText(
            record.state
          ) !==
          requestedState
        );
      }
    );

  if (
    otherStateRecords.length === 0
  ) {
    return [];
  }

  const availableStates =
    uniqueStates(
      otherStateRecords
    );

  /*
   * If the farmer already requested a
   * particular non-Kerala state, return
   * that state's latest records.
   */
  if (
    requestedState &&
    requestedState !== "kerala"
  ) {
    const selected =
      chooseFromScope(
        otherStateRecords,
        "Other State"
      );

    if (selected) {
      return selected;
    }
  }

  /*
   * For a normal Kerala request, return
   * latest same-commodity records from
   * another state and mark that a state
   * choice may be offered.
   */
  const latestOtherStateRecords =
    latestDateRecords(
      otherStateRecords
    ).slice(0, 5);

  return addResultMetadata(
    latestOtherStateRecords,
    {
      isTodayPrice:
        latestOtherStateRecords.some(
          function (record) {
            return isSameCalendarDay(
              parseSourceDate(
                record.sourceDate
              ),
              today
            );
          }
        ),

      searchScope:
        "Other State",

      requestedMarket:
        clean(input.market),

      requestedDistrict:
        clean(input.district),

      requestedState:
        clean(
          input.state ||
          "Kerala"
        ),

      needsStateChoice: true,

      availableStates
    }
  );
}
async function fetchAgmarknetPage(
  params,
  timeout
) {
  const response =
    await axios.get(
      API_URL,
      {
        params,
        timeout,

        headers: {
          Accept:
            "application/json",

          "User-Agent":
            "BhoomiMitra-" +
            "Market-Engine/2.0"
        }
      }
    );

  const data =
    response &&
    response.data
      ? response.data
      : {};

  return {
    records:
      Array.isArray(
        data.records
      )
        ? data.records
        : [],

    total:
      Number(
        data.total || 0
      ),

    count:
      Number(
        data.count || 0
      ),

    status:
      clean(
        data.status
      )
  };
}

async function fetchAgmarknet(
  options
) {
  const input =
    options || {};

  const apiKey =
    clean(
      input.apiKey ||
      process.env
        .AGMARKNET_API_KEY
    );

  if (!apiKey) {
    throw new Error(
      "AGMARKNET_API_KEY is not configured."
    );
  }

 const resolvedCommodity =
  await resolveCommodity(
    input.commodity
  );

if (!resolvedCommodity) {
  console.log(
    "Commodity_Master could not resolve:",
    clean(input.commodity)
  );

  return [];
}

const requestedCommodity =
  normaliseText(
    resolvedCommodity
      .bhoomiMitraName
  );

const officialCommodityName =
  clean(
    resolvedCommodity
      .agmarknetName
  );

if (!officialCommodityName) {
  console.log(
    "AGMARKNET name missing in Commodity_Master:",
    resolvedCommodity
      .bhoomiMitraName
  );

  return [];
}

console.log(
  "Commodity_Master selected:",
  {
    bhoomiMitraName:
      resolvedCommodity
        .bhoomiMitraName,

    malayalamName:
      resolvedCommodity
        .malayalamName,

    officialCommodityName
  }
);
const aliases =
  Array.from(
    new Set(
      [
        officialCommodityName,
        resolvedCommodity
          .bhoomiMitraName,
        ...(
          resolvedCommodity
            .aliases || []
        )
      ]
        .map(normaliseText)
        .filter(Boolean)
    )
  );

  const requestedState =
    normaliseText(
      input.state ||
      "Kerala"
    );

  const requestedDistrict =
    normaliseText(
      input.district
    );

  const requestedMarket =
    normaliseText(
      input.market
    );

  const pageSize =
    Math.min(
      Math.max(
        Number(
          input.limit ||
          1000
        ),
        1
      ),
      10000
    );

  const maxPages =
    Math.min(
      Math.max(
        Number(
          input.maxPages ||
          10
        ),
        1
      ),
      30
    );

  const timeout =
    Math.max(
      Number(
        input.timeout ||
        90000
      ),
      10000
    );

  console.log(
    "AGMARKNET original commodity input:",
    clean(
      input.commodity
    )
  );

  console.log(
    "AGMARKNET requested commodity:",
    requestedCommodity
  );

  console.log(
    "AGMARKNET aliases:",
    aliases
  );

  console.log(
    "AGMARKNET requested state:",
    requestedState
  );

  console.log(
    "AGMARKNET requested district:",
    requestedDistrict ||
    "not specified"
  );

  console.log(
    "AGMARKNET requested market:",
    requestedMarket ||
    "not specified"
  );

  const allMatchedRecords =
    [];

  let totalAvailable =
    0;

  const startingOffset =
    Math.max(
      Number(
        input.offset || 0
      ),
      0
    );

  for (
    let page = 0;
    page < maxPages;
    page += 1
  ) {
    const offset =
      startingOffset +
      page * pageSize;

  const params = {
  "api-key": apiKey,
  format: "json",
  offset,
  limit: pageSize,
  "filters[commodity]": officialCommodityName,
  "filters[state]": input.state || "Kerala"
};

    /*
 * Use the exact official AGMARKNET
 * commodity name resolved from the
 * Commodity_Master sheet.
 */

    if (
      clean(
        input.variety
      )
    ) {
      params[
        "filters[variety]"
      ] =
        clean(
          input.variety
        );
    }

    console.log(
  "AGMARKNET page request:",
  {
    page:
      page + 1,

    offset,

    limit:
      pageSize,

    commodity:
      officialCommodityName,

    "api-key":
      "**configured**"
  }
);

    let pageResult;

    try {
      pageResult =
        await fetchAgmarknetPage(
          params,
          timeout
        );
    } catch (error) {
      console.error(
        "AGMARKNET page request failed:",
        {
          page:
            page + 1,

          offset,

          message:
            error &&
            error.message
              ? error.message
              : String(
                  error
                )
        }
      );

      /*
       * If earlier pages already produced
       * correct records, continue using
       * those records.
       */
      if (
        allMatchedRecords
          .length > 0
      ) {
        break;
      }

      throw error;
    }

    totalAvailable =
      pageResult.total;

    console.log(
      "AGMARKNET page response:",
      {
        page:
          page + 1,

        status:
          pageResult.status,

        total:
          pageResult.total,

        count:
          pageResult.count,

        receivedRecords:
          pageResult.records
            .length
      }
    );
const uniqueCommodities =
  Array.from(
    new Set(
      pageResult.records
        .map(
          function (record) {
            return clean(
              record.commodity
            );
          }
        )
        .filter(Boolean)
    )
  ).sort();

console.log(
  "AGMARKNET unique commodities:",
  uniqueCommodities
);
    const pageMatches =
      pageResult.records
        .map(
          mapRecord
        )
        .filter(
          function (
            record
          ) {
            return (
              record.commodity &&
              record.market &&
              record.district &&
              record.price != null &&
              commodityMatchesAliases(
                record.commodity,
                aliases
              )
            );
          }
        );

    console.log(
      "AGMARKNET matches on page:",
      pageMatches.length
    );

    allMatchedRecords.push(
      ...pageMatches
    );

    /*
     * Stop when the API returns fewer
     * records than requested.
     */
    if (
      pageResult.records
        .length <
      pageSize
    ) {
      break;
    }

    /*
     * Stop when all available records
     * have been checked.
     */
    if (
      totalAvailable > 0 &&
      offset +
        pageSize >=
        totalAvailable
    ) {
      break;
    }
  }

  /*
   * Remove duplicate market records.
   */
  const deduplicatedRecords =
    Array.from(
      new Map(
        allMatchedRecords.map(
          function (
            record
          ) {
            const key = [
              normaliseText(
                record.commodity
              ),

              normaliseText(
                record.variety
              ),

              normaliseText(
                record.state
              ),

              normaliseText(
                record.district
              ),

              normaliseText(
                record.market
              ),

              clean(
                record.sourceDate
              ),

              record.price
            ].join("|");

            return [
              key,
              record
            ];
          }
        )
      ).values()
    );

  console.log(
    "AGMARKNET total commodity matches:",
    deduplicatedRecords
      .length
  );

  /*
   * Never return a record belonging to
   * another commodity.
   */
  if (
    deduplicatedRecords
      .length === 0
  ) {
    console.log(
      "AGMARKNET rejected unrelated fallback for:",
      requestedCommodity
    );

    return [];
  }

  const selectedRecords =
    selectBestRecords(
      deduplicatedRecords,
      {
        state:
          input.state ||
          "Kerala",

        district:
          input.district,

        market:
          input.market
      }
    );

  if (
    selectedRecords.length ===
    0
  ) {
    console.log(
      "AGMARKNET no suitable records selected."
    );

    return [];
  }

  console.log(
    "AGMARKNET selection scope:",
    selectedRecords[0]
      .searchScope
  );

  console.log(
    "AGMARKNET records selected:",
    selectedRecords.length
  );

  console.log(
    "AGMARKNET first selected record:",
    {
      commodity:
        selectedRecords[0]
          .commodity,

      variety:
        selectedRecords[0]
          .variety,

      state:
        selectedRecords[0]
          .state,

      district:
        selectedRecords[0]
          .district,

      market:
        selectedRecords[0]
          .market,

      price:
        selectedRecords[0]
          .price,

      sourceDate:
        selectedRecords[0]
          .sourceDate,

      isTodayPrice:
        selectedRecords[0]
          .isTodayPrice,

      searchScope:
        selectedRecords[0]
          .searchScope,

      needsStateChoice:
        selectedRecords[0]
          .needsStateChoice,

      availableStates:
        selectedRecords[0]
          .availableStates
    }
  );

  return selectedRecords;
}

module.exports = {
  fetchAgmarknet,
  mapRecord,
  convertQuintalToKg,
  normaliseCommodityQuery,
  normaliseText,
  parseSourceDate,
  isSameCalendarDay,
  COMMODITY_ALIASES
};
