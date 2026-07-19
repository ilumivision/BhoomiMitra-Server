"use strict";

/*
=========================================================
BhoomiMitra Market Intelligence Engine
AGMARKNET Fetcher Version 3.0
Official Government of India Market Data
=========================================================
*/

const axios = require("axios");

const {
  resolveCommodity
} = require("../commodityResolver");

/*
=========================================================
AGMARKNET API
=========================================================
*/

const RESOURCE_ID =
  "9ef84268-d588-465a-a308-a864a43d0070";

const API_URL =
  "https://api.data.gov.in/resource/" +
  RESOURCE_ID;

/*
=========================================================
COMMON UTILITIES
=========================================================
*/

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
 query = query
    .replace(/\bmrket\b/g, "market")
    .replace(/\bmaket\b/g, "market")
    .replace(/\bprie\b/g, "price")
    .replace(/\bprise\b/g, "price")
    .replace(/\byesterday\b/g, "")
    .replace(/\btoday\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

  startWords.forEach(function(word){

    if(query.startsWith(word + " ")){

      query =
        query.substring(word.length)
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

  endWords.forEach(function(word){

    if(query.endsWith(" " + word)){

      query =
        query.substring(
          0,
          query.length -
          word.length
        ).trim();

    }

  });

  return query;

}

/*
=========================================================
PRICE UTILITIES
=========================================================
*/

function normalisePrice(value){

  const number =
    Number(

      clean(value)

      .replace(/,/g,"")

      .replace(/[^\d.-]/g,"")

    );

  return Number.isFinite(number)

    ? number

    : null;

}

function convertQuintalToKg(price){

  const number =
    normalisePrice(price);

  if(number == null){

    return null;

  }

  return Number(

    (number / 100).toFixed(2)

  );

}

/*
=========================================================
MAP AGMARKNET RECORD
=========================================================
*/

function mapRecord(record){

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

    price:
      modalPrice,

    unit:
      "kg",

    originalUnit:
      "quintal",

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

    source:
      "AGMARKNET",

    sourceDate:
      clean(record.arrival_date),

    sourceTime:
      "",

    checkedAt:
      new Date().toISOString(),

    status:
      "Latest Available Price",

    verificationStatus:
      "Official Source",

    sourceUrl:
      "https://www.data.gov.in"

  };

}
/*
=========================================================
COMMODITY ALIASES
=========================================================
*/

const COMMODITY_ALIASES = {

  coconut:["coconut"],

  "tender coconut":[
    "tender coconut"
  ],

  pepper:[
    "pepper",
    "black pepper"
  ],

  "black pepper":[
    "black pepper",
    "pepper"
  ],

  cardamom:["cardamom"],

  nutmeg:["nutmeg"],

  clove:["clove"],

  cinnamon:["cinnamon"],

  vanilla:["vanilla"],

  ginger:[
    "ginger",
    "ginger green",
    "green ginger"
  ],

  turmeric:["turmeric"],

  arecanut:[
    "arecanut",
    "betel nut"
  ],

  rubber:["rubber"],

  latex:[
    "latex",
    "rubber latex"
  ],

  cocoa:["cocoa"],

  coffee:["coffee"],

  tea:["tea"],

  cashew:[
    "cashew",
    "cashew nut"
  ],

  banana:[
    "banana",
    "plantain"
  ],

  nendran:[
    "nendran",
    "banana",
    "plantain"
  ],

  poovan:[
    "poovan",
    "banana",
    "plantain"
  ],

  robusta:[
    "robusta",
    "banana",
    "plantain"
  ],

  mango:["mango"],

  jackfruit:["jackfruit"],

  pineapple:["pineapple"],

  papaya:["papaya"],

  rambutan:["rambutan"],

  mangosteen:["mangosteen"],

  "dragon fruit":[
    "dragon fruit",
    "dragonfruit"
  ],

  dragonfruit:[
    "dragonfruit",
    "dragon fruit"
  ],

  avocado:["avocado"],

  tapioca:[
    "tapioca",
    "cassava"
  ],

  cassava:[
    "cassava",
    "tapioca"
  ],

  yam:["yam"],

  potato:["potato"],

  tomato:["tomato"],

  onion:["onion"],

  garlic:["garlic"],

  chilli:[
    "chilli",
    "dry chilli"
  ],

  "green chilli":[
    "green chilli"
  ],

  brinjal:["brinjal"],

  okra:[
    "okra",
    "bhindi"
  ],

  cabbage:["cabbage"],

  cauliflower:[
    "cauliflower"
  ],

  beans:["beans"],

  cucumber:["cucumber"],

  pumpkin:["pumpkin"],

  carrot:["carrot"],

  beetroot:["beetroot"],

  radish:["radish"],

  spinach:["spinach"],

  paddy:[
    "paddy",
    "paddy dhan common",
    "paddy dhan fine"
  ],

  rice:["rice"],

  maize:[
    "maize",
    "corn"
  ],

  ragi:[
    "ragi",
    "finger millet"
  ],

  millet:["millet"],

  groundnut:[
    "groundnut",
    "peanut"
  ],

  sesame:["sesame"],

  mustard:["mustard"]

};

function commodityMatchesAliases(
  recordCommodity,
  aliases
){

  const commodity =
    normaliseText(
      recordCommodity
    );

  return aliases.some(function(alias){

    return commodity === alias;

  });

}

/*
=========================================================
DATE UTILITIES
=========================================================
*/

function parseSourceDate(value){

  const text =
    clean(value);

  if(!text){

    return null;

  }

  const parts =
    text.split("/");

  if(parts.length===3){

    const parsed =
      new Date(

        Number(parts[2]),

        Number(parts[1])-1,

        Number(parts[0])

      );

    if(
      !Number.isNaN(
        parsed.getTime()
      )
    ){

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
  a,
  b
){

  if(
    !a ||
    !b
  ){

    return false;

  }

  return (

    a.getFullYear()===b.getFullYear()

    &&

    a.getMonth()===b.getMonth()

    &&

    a.getDate()===b.getDate()

  );

}

function latestDateRecords(
  records
){

  if(
    !records ||
    records.length===0
  ){

    return [];

  }

  const sorted =
    records

    .slice()

    .sort(function(a,b){

      return (

        parseSourceDate(
          b.sourceDate
        ).getTime()

        -

        parseSourceDate(
          a.sourceDate
        ).getTime()

      );

    });

  const latest =
    parseSourceDate(
      sorted[0].sourceDate
    );

  return sorted.filter(function(record){

    return isSameCalendarDay(

      parseSourceDate(
        record.sourceDate
      ),

      latest

    );

  });

}

function uniqueStates(records){

  return Array.from(

    new Set(

      records.map(function(r){

        return clean(r.state);

      })

    )

  ).sort();

}

function getTodayInIndia(){

  const today =
    new Date().toLocaleDateString(
      "en-CA",
      {
        timeZone:
          "Asia/Kolkata"
      }
    );

  return new Date(
    today +
    "T00:00:00+05:30"
  );

}

/*
=========================================================
KERALA DISTRICT PRIORITY
=========================================================
*/

const KERALA_DISTRICT_PRIORITY={

  thiruvananthapuram:["kollam","pathanamthitta","alappuzha","kottayam","idukki","ernakulam","thrissur","palakkad","malappuram","kozhikode","wayanad","kannur","kasaragod"],

  kollam:["pathanamthitta","thiruvananthapuram","alappuzha","kottayam","idukki","ernakulam","thrissur","palakkad","malappuram","kozhikode","wayanad","kannur","kasaragod"],

  pathanamthitta:["kollam","kottayam","alappuzha","idukki","thiruvananthapuram","ernakulam","thrissur","palakkad","malappuram","kozhikode","wayanad","kannur","kasaragod"],

  alappuzha:["kottayam","pathanamthitta","kollam","ernakulam","idukki","thrissur","thiruvananthapuram","palakkad","malappuram","kozhikode","wayanad","kannur","kasaragod"],

  kottayam:["idukki","alappuzha","pathanamthitta","ernakulam","kollam","thrissur","thiruvananthapuram","palakkad","malappuram","kozhikode","wayanad","kannur","kasaragod"],

  idukki:["kottayam","ernakulam","pathanamthitta","thrissur","alappuzha","palakkad","kollam","malappuram","kozhikode","thiruvananthapuram","wayanad","kannur","kasaragod"],

  ernakulam:["thrissur","kottayam","idukki","alappuzha","palakkad","pathanamthitta","malappuram","kozhikode","kollam","wayanad","thiruvananthapuram","kannur","kasaragod"],

  thrissur:["palakkad","ernakulam","malappuram","idukki","kottayam","kozhikode","alappuzha","wayanad","pathanamthitta","kollam","kannur","thiruvananthapuram","kasaragod"],

  palakkad:["thrissur","malappuram","ernakulam","kozhikode","wayanad","idukki","kottayam","kannur","alappuzha","pathanamthitta","kasaragod","kollam","thiruvananthapuram"],

  malappuram:["kozhikode","palakkad","thrissur","wayanad","kannur","ernakulam","kasaragod","idukki","kottayam","alappuzha","pathanamthitta","kollam","thiruvananthapuram"],

  kozhikode:["wayanad","malappuram","kannur","palakkad","kasaragod","thrissur","ernakulam","idukki","kottayam","alappuzha","pathanamthitta","kollam","thiruvananthapuram"],

  wayanad:["kozhikode","kannur","malappuram","kasaragod","palakkad","thrissur","ernakulam","idukki","kottayam","alappuzha","pathanamthitta","kollam","thiruvananthapuram"],

  kannur:["kasaragod","wayanad","kozhikode","malappuram","palakkad","thrissur","ernakulam","idukki","kottayam","alappuzha","pathanamthitta","kollam","thiruvananthapuram"],

  kasaragod:["kannur","wayanad","kozhikode","malappuram","palakkad","thrissur","ernakulam","idukki","kottayam","alappuzha","pathanamthitta","kollam","thiruvananthapuram"]

};
/*
=========================================================
KERALA MARKET INTELLIGENCE
=========================================================
*/

function getKeralaRecords(records) {

  return records.filter(function(record) {

    return normaliseText(record.state) === "kerala";

  });

}

function getOutsideKeralaRecords(records) {

  return records.filter(function(record) {

    return normaliseText(record.state) !== "kerala";

  });

}

function findDistrictRecords(records, district) {

  const wanted =
    normaliseText(district);

  return records.filter(function(record) {

    return normaliseText(record.district) === wanted;

  });

}

function getHighestPriceRecord(records) {

  const valid = records.filter(function(r) {

    return r.price != null;

  });

  if (!valid.length) {

    return null;

  }

  return valid.reduce(function(best, current) {

    return current.price > best.price
      ? current
      : best;

  });

}

function getLowestPriceRecord(records) {

  const valid = records.filter(function(r) {

    return r.price != null;

  });

  if (!valid.length) {

    return null;

  }

  return valid.reduce(function(best, current) {

    return current.price < best.price
      ? current
      : best;

  });

}

function getAveragePrice(records) {

  const values =
    records

      .map(function(r) {

        return r.price;

      })

      .filter(function(price) {

        return price != null;

      });

  if (!values.length) {

    return null;

  }

  const total =
    values.reduce(function(a, b) {

      return a + b;

    }, 0);

  return Number(

    (total / values.length)

      .toFixed(2)

  );

}

function getPriceSpread(records) {

  const highest =
    getHighestPriceRecord(records);

  const lowest =
    getLowestPriceRecord(records);

  if (!highest || !lowest) {

    return null;

  }

  return Number(

    (highest.price - lowest.price)

      .toFixed(2)

  );

}

/*
=========================================================
BEST NEARBY MARKET
=========================================================
*/

function getBestNearbyMarket(

  keralaRecords,

  requestedDistrict

) {

  const priority =

    KERALA_DISTRICT_PRIORITY[
      normaliseText(requestedDistrict)
    ] || [];

  for (

    let i = 0;

    i < priority.length;

    i++

  ) {

    const district =
      priority[i];

    const matches =

      keralaRecords.filter(function(record) {

        return (

          normaliseText(
            record.district
          ) === district

        );

      });

    if (matches.length) {

      return getHighestPriceRecord(

        matches

      );

    }

  }

  return null;

}

/*
=========================================================
OUTSIDE KERALA REFERENCE
=========================================================
*/

function getOutsideKeralaReference(records) {

  if (!records.length) {

    return null;

  }

  const best =
    getHighestPriceRecord(records);

  if (!best) {

    return null;

  }

  return {

    state:
      best.state,

    district:
      best.district,

    market:
      best.market,

    price:
      best.price,

    date:
      best.sourceDate

  };

}

/*
=========================================================
BUILD MARKET INTELLIGENCE
=========================================================
*/

function buildMarketIntelligence(

  allRecords,

  requestedDistrict

) {

  const keralaRecords =
    getKeralaRecords(allRecords);

  const outsideRecords =
    getOutsideKeralaRecords(allRecords);

  const districtRecords =
    findDistrictRecords(

      keralaRecords,

      requestedDistrict

    );

  const districtBest =
    getHighestPriceRecord(

      districtRecords

    );

  const nearbyBest =
    getBestNearbyMarket(

      keralaRecords,

      requestedDistrict

    );

  const highest =
    getHighestPriceRecord(

      keralaRecords

    );

  const lowest =
    getLowestPriceRecord(

      keralaRecords

    );

  return {

    districtBest,

    nearbyBest,

    highest,

    lowest,

    average:

      getAveragePrice(

        keralaRecords

      ),

    spread:

      getPriceSpread(

        keralaRecords

      ),

    outsideReference:

      getOutsideKeralaReference(

        outsideRecords

      )

  };

}
/*
=========================================================
REMOVE DUPLICATES
=========================================================
*/

function removeDuplicateMarkets(records) {

  const seen = new Set();

  return records.filter(function(record) {

    const key = [

      normaliseText(record.state),

      normaliseText(record.district),

      normaliseText(record.market),

      normaliseText(record.commodity),

      normaliseText(record.variety),

      record.sourceDate

    ].join("|");

    if (seen.has(key)) {

      return false;

    }

    seen.add(key);

    return true;

  });

}

/*
=========================================================
MATCH COMMODITY
=========================================================
*/

function filterCommodityRecords(

  records,

  commodityQuery

) {

  const resolved =
    resolveCommodity(

      commodityQuery

    );

  let aliases = [];

  if (

    resolved &&

    resolved.canonical

  ) {

    aliases.push(

      normaliseText(

        resolved.canonical

      )

    );

  }

  aliases.push(

    normaliseCommodityQuery(

      commodityQuery

    )

  );

  aliases =

    aliases.concat(

      COMMODITY_ALIASES[
        normaliseCommodityQuery(
          commodityQuery
        )
      ] || []

    );

  aliases =

    Array.from(

      new Set(

        aliases.map(

          normaliseText

        )

      )

    );

  return records.filter(function(record) {

    return commodityMatchesAliases(

      record.commodity,

      aliases

    );

  });

}

/*
=========================================================
LATEST RECORDS ONLY
=========================================================
*/

function getLatestCommodityRecords(

  records,

  commodity

) {

  const matched =

    filterCommodityRecords(

      records,

      commodity

    );

  if (!matched.length) {

    return [];

  }

  return latestDateRecords(

    matched

  );

}

/*
=========================================================
SMART RECORD SELECTION
=========================================================
*/

function selectBestRecords(

  allRecords,

  commodity,

  district

) {

  let records =

    getLatestCommodityRecords(

      allRecords,

      commodity

    );

  records =

    removeDuplicateMarkets(

      records

    );

  const keralaRecords =

    getKeralaRecords(

      records

    );

  const districtRecords =

    findDistrictRecords(

      keralaRecords,

      district

    );

  const intelligence =

    buildMarketIntelligence(

      records,

      district

    );

  let selected = null;

  /*
  Priority 1
  Requested District
  */

  if (

    districtRecords.length

  ) {

    selected =

      getHighestPriceRecord(

        districtRecords

      );

  }

  /*
  Priority 2
  Nearby District
  */

  if (

    !selected &&

    intelligence.nearbyBest

  ) {

    selected =

      intelligence.nearbyBest;

  }

  /*
  Priority 3
  Highest Kerala Market
  */

  if (

    !selected &&

    intelligence.highest

  ) {

    selected =

      intelligence.highest;

  }

  /*
  Priority 4
  Outside Kerala
  */

  if (

    !selected &&

    intelligence.outsideReference

  ) {

    selected =

      intelligence.outsideReference;

  }

  if (

    selected

  ) {

    selected.marketIntelligence =

      intelligence;

  }

  console.log(

    "AGMARKNET selection:",

    {

      commodity,

      district,

      selectedMarket:

        selected

          ? selected.market

          : null,

      selectedDistrict:

        selected

          ? selected.district

          : null,

      selectedState:

        selected

          ? selected.state

          : null

    }

  );

 return selected ? [selected] : [];

}
/*
=========================================================
AGMARKNET API FETCH ENGINE
=========================================================
*/

async function fetchAgmarknet(params) {

  params = params || {};

  const commodity =
    clean(params.commodity);

  if (!commodity) {

  return [];

  }

  const district =
    clean(params.district);

  const state =
    clean(params.state || "Kerala");

  const apiKey =
    process.env.DATA_GOV_API_KEY ||
    process.env.DATA_GOV_IN_API_KEY ||
    process.env.AGMARKNET_API_KEY ||
    "";

  const requestParams = {
  "api-key": apiKey,
  format: "json",
  limit: 100,
  offset: 0,
  commodity: commodity
};

  if (state) {

    requestParams.state = state;

  }

  try {

    console.log(
      "AGMARKNET Request:",
      requestParams
    );

    const response =
  await axios.get(
    API_URL,
    {
      params: requestParams,
      timeout: 60000
    }
  );

    const records =

      response.data &&
      response.data.records

        ? response.data.records

        : [];

    if (!records.length) {

      console.log(
        "AGMARKNET: No records returned."
      );

      return null;

    }

    const mappedRecords =

      records.map(mapRecord);

    console.log(
  "AGMARKNET commodities:",
  [...new Set(mappedRecords.map(r => r.commodity))].slice(0, 50)
);

    const selected =

      selectBestRecords(

        mappedRecords,

        commodity,

        district

      );

    if (!selected) {

      console.log(
        "AGMARKNET: No matching commodity found."
      );

      return null;

    }

    return selected;

  } catch (error) {

    console.error(

      "AGMARKNET API Error:",

      error.response

        ? error.response.data

        : error.message

    );

    return null;

  }

}
/*
=========================================================
PUBLIC EXPORTS
=========================================================
*/

module.exports = {

  fetchAgmarknet,

  mapRecord,

  normaliseCommodityQuery,

  normaliseText,

  normalisePrice,

  convertQuintalToKg,

  latestDateRecords,

  removeDuplicateMarkets,

  filterCommodityRecords,

  buildMarketIntelligence,

  selectBestRecords

};
