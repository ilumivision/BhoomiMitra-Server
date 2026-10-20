"use strict";
/*
 * BhoomiMitra Market Scheduler
 *
 * This file coordinates one market-check cycle.
 * The actual hourly schedule will later be triggered
 * by Render Cron or another external scheduler.
 */
const {
  fetchAllSources
} = require("./marketFetcher");
const {
  updateMarketRecords
} = require("./marketUpdater");
function getKeralaHour() {
  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false
    }
  ).formatToParts(new Date());
  const hourPart = parts.find(function (part) {
    return part.type === "hour";
  });
  return Number(
    hourPart ? hourPart.value : 0
  );
}
function isWithinMarketCheckTime(
  startHour,
  endHour
) {
  const currentHour = getKeralaHour();
  return (
    currentHour >= startHour &&
    currentHour <= endHour
  );
}
async function runMarketCheck(options) {
  const input = options || {};
  const readSheetRows =
    input.readSheetRows;
  const appendRow =
    input.appendRow;
  const updateRow =
    input.updateRow;
  const forceRun =
    input.forceRun === true;
  const fetchPrices =
    typeof input.fetchAllSources === "function"
      ? input.fetchAllSources
      : fetchAllSources;
  const startHour =
    Number(input.startHour || 6);
  const endHour =
    Number(input.endHour || 22);
  if (
    !forceRun &&
    !isWithinMarketCheckTime(
      startHour,
      endHour
    )
  ) {
    return {
      success: true,
      skipped: true,
      reason:
        "Outside configured market-check time.",
      currentKeralaHour:
        getKeralaHour()
    };
  }
  console.log(
    "BhoomiMitra market check started:",
    new Date().toISOString()
  );
  const fetchedRecords =
    await fetchPrices(input.fetchOptions || {});
  console.log(
    "Market records fetched:",
    fetchedRecords.length
  );
  if (!Array.isArray(fetchedRecords) || fetchedRecords.length === 0) {
    return {
      success: false,
      skipped: false,
      reason: "NO_OFFICIAL_MARKET_RECORDS",
      checkedAt: new Date().toISOString(),
      fetchedCount: 0,
      updateResult: null
    };
  }

  const updateResult =
    await updateMarketRecords({
      fetchedRecords,
      readSheetRows,
      appendRow,
      updateRow
    });
  console.log(
    "BhoomiMitra market check completed:",
    updateResult
  );
  return {
    success: true,
    skipped: false,
    checkedAt:
      new Date().toISOString(),
    fetchedCount:
      fetchedRecords.length,
    updateResult
  };
}
module.exports = {
  getKeralaHour,
  isWithinMarketCheckTime,
  runMarketCheck
};
