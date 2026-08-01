"use strict";

const {
  fetchSoilGridsData,
  extractSoilProfile,
  formatEstimatedSoilProfile
} = require("./soilModule");

async function runSoilTest() {
  const latitude = 9.3835;
  const longitude = 76.5741;

  console.log("Testing SoilGrids...");

  const result = await fetchSoilGridsData(
    latitude,
    longitude
  );

  if (!result.success) {
    console.error(
      "Soil test failed:",
      result.error
    );
    return;
  }

  const profile = extractSoilProfile(
    result.data,
    "0-5cm"
  );

  console.log(
    formatEstimatedSoilProfile(profile)
  );
}

runSoilTest().catch(function (error) {
  console.error(
    "Unexpected soil test error:",
    error.message
  );
});
