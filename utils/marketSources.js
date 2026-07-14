"use strict";
/*
 * BhoomiMitra Market Source Registry
 *
 * This file contains source configuration only.
 * Actual price collection will be handled by separate fetchers.
 */
const MARKET_SOURCES = {
  VFPCK: {
    id: "VFPCK",
    name: "VFPCK",
    type: "Official",
    priority: 1,
    enabled: true,
    frequency: "Daily",
    url: "https://www.vfpck.org/market_price.asp",
    commodities: [
      "Vegetables",
      "Fruits",
      "Banana",
      "Pineapple",
      "Tuber Crops"
    ]
  },
  AGMARKNET: {
    id: "AGMARKNET",
    name: "AGMARKNET",
    type: "Official",
    priority: 2,
    enabled: true,
    frequency: "As submitted by markets",
    url: "https://agmarknet.gov.in/",
    commodities: ["All Agricultural Commodities"]
  },
  RUBBER_BOARD: {
    id: "RUBBER_BOARD",
    name: "Rubber Board",
    type: "Official",
    priority: 3,
    enabled: true,
    frequency: "Daily",
    url: "https://rubberboard.gov.in/",
    commodities: [
      "Rubber",
      "RSS4",
      "RSS5",
      "Latex",
      "Cup Lump"
    ]
  },
  SPICES_BOARD: {
    id: "SPICES_BOARD",
    name: "Spices Board",
    type: "Official",
    priority: 4,
    enabled: true,
    frequency: "Daily / Auction",
    url:
      "https://www.indianspices.com/marketing/price/domestic/daily-price.html",
    commodities: [
      "Cardamom",
      "Pepper",
      "Turmeric",
      "Ginger",
      "Nutmeg",
      "Mace",
      "Clove"
    ]
  },
  COCONUT_DEVELOPMENT_BOARD: {
    id: "COCONUT_DEVELOPMENT_BOARD",
    name: "Coconut Development Board",
    type: "Official",
    priority: 5,
    enabled: true,
    frequency: "Daily / Periodic",
    url: "https://coconutboard.gov.in/",
    commodities: [
      "Coconut",
      "Tender Coconut",
      "Copra",
      "Coconut Oil"
    ]
  },
  HORTICORP: {
    id: "HORTICORP",
    name: "Horticorp",
    type: "Government",
    priority: 6,
    enabled: true,
    frequency: "Daily / Periodic",
    url: "https://horticorp.org/",
    commodities: ["Vegetables", "Fruits"]
  },
  MALAYALA_MANORAMA: {
    id: "MALAYALA_MANORAMA",
    name: "Malayala Manorama",
    type: "Newspaper",
    priority: 8,
    enabled: true,
    frequency: "Daily",
    url: "",
    commodities: ["Multiple Commodities"],
    role: "Secondary verification and market signals"
  },
  REGISTERED_BUYERS: {
    id: "REGISTERED_BUYERS",
    name: "Registered Buyers",
    type: "BhoomiMitra",
    priority: 9,
    enabled: true,
    frequency: "Near Real Time",
    url: "",
    commodities: ["Buyer Offers"]
  },
  FARMER_LISTINGS: {
    id: "FARMER_LISTINGS",
    name: "Farmer Listings",
    type: "BhoomiMitra",
    priority: 10,
    enabled: true,
    frequency: "Near Real Time",
    url: "",
    commodities: ["Farmer Produce Listings"]
  }
};
function getEnabledSources() {
  return Object.values(MARKET_SOURCES)
    .filter(function (source) {
      return source.enabled === true;
    })
    .sort(function (a, b) {
      return a.priority - b.priority;
    });
}
function getSource(sourceId) {
  return MARKET_SOURCES[sourceId] || null;
}
function getSourcesForCommodity(commodity) {
  const searchText =
    String(commodity || "").toLowerCase();
  return getEnabledSources().filter(function (source) {
    return source.commodities.some(function (item) {
      const sourceCommodity =
        String(item || "").toLowerCase();
      return (
        sourceCommodity.includes(searchText) ||
        searchText.includes(sourceCommodity) ||
        sourceCommodity.includes("all agricultural") ||
        sourceCommodity.includes("multiple commodities")
      );
    });
  });
}
module.exports = {
  MARKET_SOURCES,
  getEnabledSources,
  getSource,
  getSourcesForCommodity
};
