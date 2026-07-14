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
    await fetchAllSources();
  console.log(
    "Market records fetched:",
    fetchedRecords.length
  );
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
