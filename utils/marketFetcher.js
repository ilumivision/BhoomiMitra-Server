"use strict";

down to:

module.exports = {
    fetchAllSources
};

Step 3 — Paste this complete replacement

"use strict";
const { fetchAgmarknet } = require("./fetchers/agmarknetFetcher");
/*
 * BhoomiMitra Market Fetcher
 *
 * Current live source:
 * - AGMARKNET / data.gov.in API
 *
 * Future sources:
 * - VFPCK
 * - Rubber Board
 * - Spices Board
 * - Coconut Development Board
 */
async function fetchSource(source) {
  if (source.name === "AGMARKNET") {
    return await fetchAgmarknet();
  }
  return [];
}
async function fetchAllSources(options) {
  const input = options || {};
  let prices = [];
  try {
    console.log("Checking source: AGMARKNET");
    const agmarknetRecords =
      await fetchAgmarknet({
        state: input.state || "Kerala",
        district: input.district || "",
        market: input.market || "",
        commodity: input.commodity || "",
        variety: input.variety || "",
        limit: input.limit || 1000
      });
    prices = prices.concat(
      agmarknetRecords
    );
    console.log(
      "AGMARKNET records added:",
      agmarknetRecords.length
    );
  } catch (error) {
    console.error(
      "AGMARKNET source failed:",
      error.response &&
      error.response.data
        ? error.response.data
        : error.message
    );
  }
  return prices;
}
module.exports = {
  fetchAllSources
};
