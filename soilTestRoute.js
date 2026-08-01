"use strict";

const express = require("express");

const {
  fetchSoilGridsData,
  extractSoilProfile,
  formatEstimatedSoilProfile
} = require("./soilModule");

const router = express.Router();

router.get("/soil-test", async function (req, res) {
  const latitude = req.query.lat;
  const longitude = req.query.lon;

  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      error:
        "Please provide latitude and longitude. Example: /soil-test?lat=9.3835&lon=76.5741"
    });
  }

  const result = await fetchSoilGridsData(
    latitude,
    longitude
  );

  if (!result.success) {
    return res.status(503).json({
      success: false,
      source: result.source,
      error: result.error
    });
  }

  const profile = extractSoilProfile(
    result.data,
    "0-5cm"
  );

 return res.json({
  success: true,
  source: result.source,
  retrievedAt: result.retrievedAt,
  latitude: Number(latitude),
  longitude: Number(longitude),
    profile,
  formattedText:
    formatEstimatedSoilProfile(profile)
});
});

module.exports = router;
