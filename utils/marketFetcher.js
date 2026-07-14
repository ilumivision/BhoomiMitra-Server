"use strict";
/*
 * BhoomiMitra Market Fetcher
 *
 * Phase 1:
 * Returns standard market-price objects.
 *
 * Later:
 * VFPCK
 * AGMARKNET
 * Rubber Board
 * Spices Board
 * Coconut Board
 * etc.
 */
const {
    getEnabledSources
} = require("./marketSources");
async function fetchSource(source) {
    console.log(
        "Checking source:",
        source.name
    );
    /*
     * Temporary sample record.
     *
     * Later this block will be replaced
     * with live website/API reading.
     */
    return [{
        commodity: "Banana",
        variety: "Nendran",
        district: "Pathanamthitta",
        market: "Thiruvalla",
        price: 48,
        unit: "Kg",
        source: source.name,
        sourceDate:
            new Date().toISOString().substring(0,10),
        sourceTime:
            new Date().toLocaleTimeString(),
        checkedAt:
            new Date().toISOString(),
        status:
            "Live Update"
    }];
}
async function fetchAllSources() {
    const sources =
        getEnabledSources();
    let prices = [];
    for (const source of sources) {
        try {
            const result =
                await fetchSource(source);
            prices =
                prices.concat(result);
        }
        catch (error) {
            console.error(
                "Source failed:",
                source.name,
                error.message
            );
        }
    }
    return prices;
}
module.exports = {
    fetchAllSources
};
