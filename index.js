const express = require("express");
const axios = require("axios");
require("dotenv").config();

const OpenAI = require("openai");
const { google } = require("googleapis");
const detectIntent = require("./utils/detectIntent");
const voiceModule = require("./utils/voice");
const photoVision = require("./utils/photoVision");
const soilModule = require("./utils/soil");
const weatherModule = require("./utils/weather");
const {
  registerLand,
  getFarmerLands
} = require("./utils/landRegistration");

const {
  startBoundarySession,
  addBoundaryPoint,
  getBoundaryPoints,
  completeBoundary,
  verifyBoundary,
  cancelBoundary,
  getLandBoundaryMapData
} = require("./utils/landBoundary");
const {
  getLatestSatelliteObservation,
  getSatelliteObservationHistory,
  getCopernicusAccessToken,
  getLatestSentinel2Scene,
  getSentinel2Ndvi,
  saveSatelliteObservation
} = require("./utils/satellite");
const {
  handlePersonalRecords
} = require("./utils/personalRecords");

const registrationModule =
  require("./utils/registration");

const {
  createServiceFinder,
  resolveRequestedService,
  isServiceRequest
} = require("./utils/services");
const {
  isMenuCommand,
  getWelcomeMessage,
  parseServiceSelections,
  isPureMenuSelection,
  createMenuSession,
  isMenuSessionExpired,
  startSelectedServices,
  formatSelectionResponse
} = require("./utils/menu");

const {
  detectLanguage,
  getLanguageInstruction,
  parseLanguageSelection,
  getLanguageSelectionMessage,
  normalizePreferredLanguage
} = require("./utils/language");

const caseManager = require("./utils/caseManager");
 
const soilTestRoute = require("./soilTestRoute");
const {
  createExpertCaseManager
} = require("./utils/expertCaseManager");
const {
  assignExpertCase
} = require("./utils/expertAssignment");
const {
  fetchAllSources
} = require("./utils/marketFetcher");
const {
  resolveCommodity
} = require("./utils/commodityResolver");
const {
  getMarketPrice
} = require("./utils/market");

const app = express();

app.use(express.json());
app.use(soilTestRoute);

app.get("/test-copernicus", async (req, res) => {
  try {
    const token =
      await getCopernicusAccessToken();

    res.json({
      success: true,
      message:
        "Copernicus authentication successful",
      tokenReceived:
        Boolean(token)
    });
  } catch (error) {
    console.error(
      "Copernicus test error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        error.message
    });
  }
});
app.get("/test-sentinel2", async (req, res) => {
  try {
    const landResult =
      await getLandBoundaryMapData({
        sheets,
        spreadsheetId:
          GOOGLE_SHEET_ID,
        landId:
          "BM-L-000003",
        farmerId: "",
        whatsapp: ""
      });

    if (
      !landResult ||
      !landResult.success
    ) {
      return res.status(400).json({
        success: false,
        message:
          landResult &&
          landResult.error
            ? landResult.error
            : "Land boundary could not be loaded."
      });
    }

    const sentinelResult =
      await getLatestSentinel2Scene({
        geometry:
          landResult.geoJSON
      });

    res.json({
      success: true,
      landId:
        landResult.landId,
      farmName:
        landResult.farmName,
      sentinel:
        sentinelResult
    });
  } catch (error) {
    console.error(
      "Sentinel-2 test error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        error.message
    });
  }
});
app.get("/test-sentinel2-ndvi", async (req, res) => {
  try {
    const landResult =
      await getLandBoundaryMapData({
        sheets,
        spreadsheetId:
          GOOGLE_SHEET_ID,
        landId:
          "BM-L-000003",
        farmerId: "",
        whatsapp: ""
      });

    if (
      !landResult ||
      !landResult.success
    ) {
      return res.status(400).json({
        success: false,
        message:
          landResult &&
          landResult.error
            ? landResult.error
            : "Land boundary could not be loaded."
      });
    }

    const ndviResult =
      await getSentinel2Ndvi({
        geometry:
          landResult.geoJSON
      });
   const saveResult =
  await saveSatelliteObservation({
    sheets,
    spreadsheetId:
      GOOGLE_SHEET_ID,

    landId:
      landResult.landId,

    farmerId: "",

    farmName:
      landResult.farmName || "",

    observationDate:
      new Date().toISOString(),

    satelliteSource:
      "Sentinel-2 L2A",

    ndvi:
      ndviResult &&
      ndviResult.averageNdvi !== undefined
        ? ndviResult.averageNdvi
        : "",

    vegetationStatus:
      ndviResult &&
      ndviResult.vegetationStatus
        ? ndviResult.vegetationStatus
        : "",

    cloudCover: "",

    areaSqM:
      landResult.measurements
        ? landResult.measurements.areaSqM || ""
        : "",

    areaCent:
      landResult.measurements
        ? landResult.measurements.cents || ""
        : "",

    areaAcre:
      landResult.measurements
        ? landResult.measurements.acres || ""
        : "",

    perimeterM:
      landResult.measurements
        ? landResult.measurements.perimeterM || ""
        : "",

    remarks:
      "Sentinel-2 NDVI observation"
  });
    res.json({
      success: true,
      landId:
        landResult.landId,
      farmName:
        landResult.farmName,
     ndvi:
  ndviResult,

savedObservation:
  saveResult
    });
  } catch (error) {
    console.error(
      "Sentinel-2 NDVI test error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        error.message
    });
  }
});
const PORT = process.env.PORT || 10000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || "")
  .replace(/^"|"$/g, "")
  .replace(/\\n/g, "\n")
  .trim();

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const googleAuth = new google.auth.JWT({
  email: GOOGLE_CLIENT_EMAIL,
  key: GOOGLE_PRIVATE_KEY,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets({ version: "v4", auth: googleAuth });
// =====================================================
// BHOOMIMITRA COMBINED LAND MAP
// =====================================================

app.get("/land-map/:landId", async (req, res) => {
  try {
    const requestedLandId =
      String(req.params.landId || "")
        .trim()
        .toUpperCase();

    const mapResult =
      await getLandBoundaryMapData({
        sheets,
        spreadsheetId:
          GOOGLE_SHEET_ID,
        landId:
          requestedLandId,
        farmerId: "",
        whatsapp: ""
      });

    if (
      !mapResult ||
      !mapResult.success
    ) {
      return res
        .status(404)
        .send(
          "<h2>Land map not available</h2><p>" +
          (
            mapResult &&
            mapResult.error
              ? mapResult.error
              : "Boundary data was not found."
          ) +
          "</p>"
        );
    }

    const boundaryPoints =
      mapResult.points.slice(
        0,
        mapResult.pointCount
      );

    if (!boundaryPoints.length) {
      return res
        .status(404)
        .send(
          "<h2>No GPS boundary points found.</h2>"
        );
    }

    const centerLatitude =
      boundaryPoints.reduce(
        (sum, point) =>
          sum +
          Number(point.latitude),
        0
      ) / boundaryPoints.length;

    const centerLongitude =
      boundaryPoints.reduce(
        (sum, point) =>
          sum +
          Number(point.longitude),
        0
      ) / boundaryPoints.length;

    const googleMapUrl =
      "https://www.google.com/maps/search/?api=1&query=" +
      centerLatitude +
      "," +
      centerLongitude;

    const leafletPoints =
      boundaryPoints.map(
        function (point) {
          return [
            Number(point.latitude),
            Number(point.longitude)
          ];
        }
      );

    const pointRows =
      boundaryPoints
        .map(
          function (point, index) {
            return (
              "<tr>" +
              "<td>Point " +
              (index + 1) +
              "</td>" +
              "<td>" +
              Number(
                point.latitude
              ).toFixed(7) +
              "</td>" +
              "<td>" +
              Number(
                point.longitude
              ).toFixed(7) +
              "</td>" +
              "</tr>"
            );
          }
        )
        .join("");

    const pageTitle =
      mapResult.farmName ||
      mapResult.landId;

    res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <title>BhoomiMitra Land Map</title>

  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  >

  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      background: #f4f7f2;
      color: #222;
    }

    .container {
      max-width: 900px;
      margin: auto;
      padding: 18px;
    }

    .card {
      background: white;
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 16px;
      box-shadow:
        0 2px 10px
        rgba(0,0,0,0.08);
    }

    h1 {
      margin-top: 0;
      font-size: 25px;
    }

    h2 {
      font-size: 19px;
    }

    #map {
      height: 430px;
      width: 100%;
      border-radius: 12px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      border-bottom:
        1px solid #ddd;
      padding: 9px;
      text-align: left;
    }

    .mapButton {
      display: inline-block;
      padding: 12px 18px;
      background: #2e7d32;
      color: white;
      text-decoration: none;
      border-radius: 9px;
      margin-top: 10px;
    }

    .landSketch {
      width: 100%;
      height: 320px;
      background: #fafafa;
      border-radius: 12px;
    }

    .small {
      color: #666;
      font-size: 14px;
    }
  </style>
</head>

<body>

<div class="container">

  <div class="card">
    <h1>🗺️ BhoomiMitra Land Map</h1>

    <p>
      <strong>🌱 Land:</strong>
      ${pageTitle}
    </p>

    <p>
      <strong>🆔 Land ID:</strong>
      ${mapResult.landId}
    </p>

    <p>
      <strong>📍 Boundary points:</strong>
      ${mapResult.pointCount}
    </p>
  </div>

  <div class="card">
    <h2>🛰️ Interactive Land Boundary Map</h2>

    <div id="map"></div>

    <a
      class="mapButton"
      href="${googleMapUrl}"
      target="_blank"
    >
      🌍 Open location in Google Maps
    </a>
  </div>

  <div class="card">
    <h2>📐 Land Boundary Sketch</h2>

    <svg
      id="landSketch"
      class="landSketch"
      viewBox="0 0 500 320"
    ></svg>

    <p class="small">
      Sketch is generated from the saved GPS boundary coordinates.
    </p>
  </div>

  <div class="card">
    <h2>📍 GPS Boundary Points</h2>

    <table>
      <thead>
        <tr>
          <th>Point</th>
          <th>Latitude</th>
          <th>Longitude</th>
        </tr>
      </thead>

      <tbody>
        ${pointRows}
      </tbody>
    </table>
  </div>

</div>

<script
  src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js">
</script>

<script>
  const points =
    ${JSON.stringify(leafletPoints)};

  const map =
    L.map("map");

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 22,
      attribution:
        "&copy; OpenStreetMap contributors"
    }
  ).addTo(map);

  const polygon =
    L.polygon(points)
      .addTo(map);

  points.forEach(
    function (point, index) {
      L.marker(point)
        .addTo(map)
        .bindPopup(
          "Boundary Point " +
          (index + 1)
        );
    }
  );

  map.fitBounds(
    polygon.getBounds(),
    {
      padding: [30, 30]
    }
  );

  const svg =
    document.getElementById(
      "landSketch"
    );

  const latitudes =
    points.map(
      p => p[0]
    );

  const longitudes =
    points.map(
      p => p[1]
    );

  const minLat =
    Math.min(...latitudes);

  const maxLat =
    Math.max(...latitudes);

  const minLng =
    Math.min(...longitudes);

  const maxLng =
    Math.max(...longitudes);

  function scaleX(lng) {
    const range =
      maxLng - minLng || 1;

    return (
      60 +
      (
        (lng - minLng) /
        range
      ) * 380
    );
  }

  function scaleY(lat) {
    const range =
      maxLat - minLat || 1;

    return (
      260 -
      (
        (lat - minLat) /
        range
      ) * 200
    );
  }

  const svgPoints =
    points.map(
      function (point) {
        return (
          scaleX(point[1]) +
          "," +
          scaleY(point[0])
        );
      }
    ).join(" ");

  const polygonElement =
    document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polygon"
    );

  polygonElement.setAttribute(
    "points",
    svgPoints
  );

  polygonElement.setAttribute(
    "fill",
    "rgba(76,175,80,0.20)"
  );

  polygonElement.setAttribute(
    "stroke",
    "#2e7d32"
  );

  polygonElement.setAttribute(
    "stroke-width",
    "4"
  );

  svg.appendChild(
    polygonElement
  );

  points.forEach(
    function (point, index) {
      const x =
        scaleX(point[1]);

      const y =
        scaleY(point[0]);

      const circle =
        document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle"
        );

      circle.setAttribute(
        "cx",
        x
      );

      circle.setAttribute(
        "cy",
        y
      );

      circle.setAttribute(
        "r",
        "7"
      );

      circle.setAttribute(
        "fill",
        "#d32f2f"
      );

      svg.appendChild(
        circle
      );

      const label =
        document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text"
        );

      label.setAttribute(
        "x",
        x + 10
      );

      label.setAttribute(
        "y",
        y - 10
      );

      label.setAttribute(
        "font-size",
        "16"
      );

      label.textContent =
        "Point " +
        (index + 1);

      svg.appendChild(
        label
      );
    }
  );
</script>

</body>
</html>
    `);

  } catch (error) {
    console.error(
      "Land map page error:",
      error
    );

    res
      .status(500)
      .send(
        "<h2>Unable to load land map.</h2>"
      );
  }
});
const serviceFinder = createServiceFinder({
  readSheetRows,
  sheets: {
    serviceProviderRegistration:
      "Workforce Providers",

    skilledWorkerRegistration:
      "Skilled Workers",

    expertRegistration:
      "Expert_Directory"
  }
});
const expertCaseManager = createExpertCaseManager({
  appendSafe,
  readSheetRows,
  sendWhatsAppMessage
});
const sessions = {};
const userMenus = {};
const pendingLanguageSelections = {};
const userLanguagePreferences = {};
const pendingServiceSearches = {};
const boundarySessions = {};
const processedMessages = new Set();
let sheetMetadataCache = null;
let sheetMetadataCacheTime = 0;

const SHEET_METADATA_CACHE_MS =
  10 * 60 * 1000;

const SHEETS = {
  farmers: "Farmers",
  expertRegistration: "Expert_Directory",
  skilledWorkerRegistration: "Skilled Workers",
  serviceProviderRegistration: "Workforce Providers",
  conversation: "AI_Conversation_History",
  aiLog: "AI_Response_Log",
  farmerQueries: "Farmer_Queries",
  weatherData: "Weather_Data",
weatherForecast: "Weather_Forecast",
aiMemory: "AI_Memory",
expertCases: "Expert_Cases",

soilLocationProfile: "Soil_Location_Profile",
soilTestRepository: "Soil_Test_Repository",
soilRecommendationRules: "Soil_Recommendation_Rules",
soilDataLog: "Soil_Data_Log"
};

const SYSTEM_PROMPT = [
  "You are BhoomiMitra, Kerala's Agriculture and Allied Sector AI Assistant, developed by Ilumivision.",

  "MISSION:",
  "Provide accurate, practical, Kerala-specific agricultural assistance to farmers, farm families, agricultural workers, experts and service providers.",

  "SCOPE:",
  "Operate primarily for Kerala agriculture and allied sectors including crops, horticulture, spices, plantation crops, livestock, poultry, fisheries, beekeeping, soil, weather, irrigation, plant protection, farm machinery, agricultural markets, farm management and related services.",

  "AUTHORITATIVE BASIS:",

  "Use recommendations and verified information from recognised scientific and government institutions relevant to Kerala agriculture and allied sectors.",

  "Priority sources include Kerala Agricultural University (KAU), Kerala Veterinary and Animal Sciences University (KVASU), Kerala University of Fisheries and Ocean Studies (KUFOS), ICAR, Krishi Vigyan Kendras (KVKs), Kerala Government departments and recognised Government of India institutions.",

  "For crop and horticultural recommendations, consider KAU Package of Practices and relevant ICAR institutes including ICAR-CPCRI for coconut, arecanut and cocoa; ICAR-CTCRI for cassava, sweet potato and other tropical tuber crops; and ICAR-IISR for spices such as black pepper, cardamom, ginger, turmeric and related spice crops.",

  "For fisheries and aquaculture, use appropriate recommendations from KUFOS, ICAR-CMFRI, ICAR-CIFT and other competent ICAR fisheries institutes and Kerala Government fisheries authorities.",

  "For livestock, dairy, poultry and animal health, use appropriate recommendations from KVASU, ICAR institutes, Kerala Animal Husbandry Department, Dairy Development Department and other competent veterinary authorities.",

  "For coconut and plantation-related advice, use the appropriate recommendations of ICAR-CPCRI, KAU and relevant Kerala and Government of India agencies.",

  "For weather, rainfall and agrometeorological advice, prefer IMD and verified agrometeorological information available to BhoomiMitra.",

  "For soil and nutrient management, use recognised soil-test principles, KAU recommendations, ICAR guidance and verified laboratory or location-based data available to BhoomiMitra.",

  "For marine fisheries, inland fisheries and aquaculture, distinguish between the production systems and use recommendations from the institution competent for that sector.",

  "Select the scientific source according to the crop, animal, fishery or agricultural problem being discussed rather than relying on one institution for every subject.",

  "Where recommendations differ between national and Kerala-specific sources, prefer scientifically valid Kerala-specific recommendations when appropriate to Kerala conditions.",

  "Never claim that a recommendation comes from a particular institution unless that recommendation is actually supported by the information available to BhoomiMitra.",

  "DO NOT FABRICATE:",
  "Never invent crop recommendations, pesticide doses, fertiliser doses, market prices, weather values, soil-test values, expert details, worker details or service-provider details.",
  "If reliable information is unavailable, clearly say that it is unavailable or requires verification.",

  "MENU AND SERVICE CONTEXT:",
  "BhoomiMitra has dedicated services for agriculture questions, crop photo diagnosis, soil information, weather and rainfall, market prices, expert advice, skilled workers, service providers, farm and land management, personal records and member registration.",
  "When a user is already inside a selected service, answer according to that service context and do not unnecessarily redirect the user to the general agriculture question service.",

  "SOIL:",
  "Clearly distinguish location-based estimated soil information from laboratory soil-test results.",
  "Never present SoilGrids or other modelled soil values as laboratory measurements.",
  "For precise fertiliser recommendations, prefer laboratory soil-test values.",
  "When estimated soil information is provided, the user may subsequently ask for crop-based nutrient guidance.",
  "Crop nutrient recommendations must follow Kerala recommendations and should clearly distinguish general crop recommendation from soil-test-based adjustment.",

  "FERTILISER AND NUTRIENTS:",
  "When giving crop-based nutrient advice, state the crop, stage or age when relevant, recommended N, P and K basis, organic manure requirements and important secondary or micronutrients when applicable.",
  "Do not infer micronutrient deficiency solely from estimated soil data.",
  "Where micronutrient correction requires soil or plant analysis, say so clearly.",

  "WEATHER:",
  "When dedicated weather data is supplied in the conversation context, use that data as the factual weather source.",
  "For weather requests, provide current conditions, relevant short-term forecast, rainfall risk and practical farm advisory when available.",
  "Do not replace supplied live weather values with invented values.",

  "PHOTO DIAGNOSIS:",
  "For crop photographs, identify likely problems cautiously.",
  "If the image alone is insufficient, ask for crop name, age, symptoms, affected plant part, duration and relevant field conditions.",
  "Do not claim certainty when visual evidence is insufficient.",

  "PLANT PROTECTION:",
  "Prefer integrated pest and disease management.",
  "Mention cultural, mechanical and biological measures where appropriate before or along with chemical control.",
  "For pesticides, use only recognised agricultural recommendations and provide dose, formulation and application guidance carefully.",
  "Avoid recommending banned or inappropriate pesticides.",

  "MARKET:",
  "Market prices must come from available verified market data.",
  "If today's price is unavailable, state the most recent available date rather than presenting an old value as today's price.",

  "EXPERT AND SERVICE NETWORK:",
  "Do not invent experts, workers, machinery operators or service providers.",
  "Use only verified directory information supplied by BhoomiMitra.",
  "If no verified match exists, say so and offer to record or escalate the request when the system supports it.",

  "FARM RECORDS:",
  "Treat registered farm, land, animal, activity, advisory and personal-record information as user-specific data.",
  "Do not fabricate missing records.",

  "LANGUAGE:",
"The user's saved preferred language is the primary and controlling language for all BhoomiMitra replies.",
"If the saved preference is Malayalam, ALWAYS reply in Malayalam even when the user types the question in English, Manglish, or another language.",
"If the saved preference is English, ALWAYS reply in English even when the user types the question in Malayalam.",
"If the saved preference is Bilingual, provide concise Malayalam and English together.",
"Never infer or change the reply language from the language or script of the current message when a saved language preference is available.",
"The saved language preference overrides automatic language detection.",
"Only change the preferred language when the user explicitly requests a language change or changes it through the language setting.",

  "CONVERSATION:",
  "Understand follow-up questions in context.",
  "If the farmer asks a follow-up about the crop, soil profile, weather, diagnosis or recommendation just discussed, continue that same subject instead of restarting the conversation.",
  "Allow the farmer to move naturally between BhoomiMitra services without requiring MENU after every completed service.",

  "STYLE:",
  "Keep farmer-facing answers practical, clear and concise.",
  "Use simple units and actionable steps.",
  "Avoid unnecessary technical jargon, but provide scientific detail when the user asks for it.",

  "SAFETY:",
  "For severe weather, poisoning, pesticide exposure, animal emergencies or other urgent safety situations, clearly advise appropriate professional or emergency assistance.",
  "Do not give unsafe instructions.",

  "OUT-OF-SCOPE:",
  "If the question is clearly unrelated to agriculture or allied sectors, reply politely that BhoomiMitra is intended for agriculture and allied sector assistance and invite the user to ask an agriculture-related question."
].join("\n");

app.get("/", function (req, res) {
  res.status(200).send("BhoomiMitra AI Server v2.0 is running.");
});

app.get("/webhook", function (req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/webhook", async function (req, res) {
  res.status(200).send("EVENT_RECEIVED");

 try {
    const body = req.body;
    if (!body || body.object !== "whatsapp_business_account") return;

    const value =
      body.entry &&
      body.entry[0] &&
      body.entry[0].changes &&
      body.entry[0].changes[0] &&
      body.entry[0].changes[0].value;

    if (!value || value.statuses) return;

    const message = value.messages && value.messages[0];
    if (!message) return;

    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);

    const from = message.from;

console.log("[TEXT TEST] type =", message.type, "text =", message.text && message.text.body);

let userText = "";

const activeFarmMenu =
  userMenus[from];

if (message.type === "text") {
    userText = message.text && message.text.body
        ? message.text.body.trim()
        : "";
  // =====================================================
// LAND BOUNDARY - COMPLETE WITH DONE
// =====================================================

const activeBoundaryForDone =
  boundarySessions[from];

if (
  activeBoundaryForDone &&
  activeBoundaryForDone.sessionId &&
  activeBoundaryForDone.landId &&
  String(userText || "")
    .trim()
    .toUpperCase() === "DONE"
) {
  try {
    const boundaryCompleteResult =
      await completeBoundary({
        sheets,
        spreadsheetId:
          GOOGLE_SHEET_ID,

        landId:
          activeBoundaryForDone.landId,

        farmerId:
          activeBoundaryForDone.farmerId || "",

        whatsapp:
          from,

        sessionId:
          activeBoundaryForDone.sessionId
      });

    if (
      !boundaryCompleteResult ||
      !boundaryCompleteResult.success
    ) {
      const pointCount =
        boundaryCompleteResult &&
        boundaryCompleteResult.pointCount !== undefined
          ? boundaryCompleteResult.pointCount
          : activeBoundaryForDone.pointCount || 0;

      await sendWhatsAppMessage(
        from,
        [
          "⚠️ Land boundary could not be completed.",
          "",
          boundaryCompleteResult &&
          boundaryCompleteResult.error
            ? boundaryCompleteResult.error
            : "Please check the captured boundary points.",
          "",
          "Points currently captured: " +
            pointCount,
          "",
          "Please send more boundary locations if required, then type DONE again."
        ].join("\n")
      );

      return;
    }

    const completedLandId =
      boundaryCompleteResult.landId ||
      activeBoundaryForDone.landId;

    const completedPointCount =
      boundaryCompleteResult.pointCount || 0;

    delete boundarySessions[from];

    if (userMenus[from]) {
      userMenus[from].step =
        "completed";

      userMenus[from].updatedAt =
        Date.now();
    }

    await sendWhatsAppMessage(
      from,
      [
        "✅ Land Boundary Mapping Completed",
        "",
        "🆔 Land ID: " +
          completedLandId,
        "",
        "📍 Boundary points: " +
          completedPointCount,
        "",
        "🗺️ Land boundary polygon has been created and saved.",
        "",
        "The registered land is now ready for the next stage of GPS and satellite monitoring.",
        "",
        "You can type MENU to continue."
      ].join("\n")
    );

    return;

  } catch (boundaryCompleteError) {
    console.error(
      "Boundary completion error:",
      boundaryCompleteError &&
      boundaryCompleteError.message
        ? boundaryCompleteError.message
        : boundaryCompleteError
    );

    await sendWhatsAppMessage(
      from,
      "Boundary completion failed. Your captured points have been retained. Please type DONE again or try later."
    );

    return;
  }
}
} else if (message.type === "audio" || message.type === "voice") {
    const mediaId = message.audio && message.audio.id
        ? message.audio.id
        : null;

    const voiceResult = await voiceModule({
        mediaId,
        from
    });

    userText = voiceResult && voiceResult.text
        ? voiceResult.text
        : "Voice transcription failed.";

    console.log("Voice Transcription:", userText);
} else if (message.type === "image") {
    const mediaId = message.image && message.image.id
        ? message.image.id
        : null;

    if (!mediaId) {
        await sendWhatsAppMessage(from, "ചിത്രം ലഭിച്ചു, പക്ഷേ മീഡിയ ഫയൽ കണ്ടെത്താനായില്ല. ദയവായി വീണ്ടും അയക്കുക.");
        return;
    }

  const caption = message.image && message.image.caption
  ? message.image.caption
  : "";

const captionCrop =
  caseManager.extractRecognisedCrop(caption);

let activeCase =
  caseManager.getActiveCase(from);

const startsNewCase =
  caseManager.messageStartsNewCase(caption);

const isDifferentCrop =
  activeCase &&
  captionCrop &&
  activeCase.crop &&
  captionCrop.toLowerCase() !==
    activeCase.crop.toLowerCase();

if (
  !activeCase ||
  startsNewCase ||
  isDifferentCrop
) {
  const createdCase =
    caseManager.createCase(from, {
      crop: captionCrop || "",
      subject: caption || "Photo diagnosis"
    });

  activeCase = createdCase.case;
} else if (
  captionCrop &&
  !activeCase.crop
) {
  activeCase.crop = captionCrop;
}

const photoContext =
  caseManager.buildPhotoContext(
    activeCase,
    caption
  );

const photoResult = await photoVision({
  mediaId,
  from,
  caption: photoContext
});

const photoReply =
  photoResult &&
  (photoResult.reply || photoResult.text)
    ? (photoResult.reply || photoResult.text)
    : "ചിത്രം ലഭിച്ചു, പക്ഷേ വിശകലനം ചെയ്യാൻ കഴിഞ്ഞില്ല.";

if (activeCase) {
  caseManager.addPhoto(
    activeCase,
    mediaId,
    caption
  );

  caseManager.updateDiagnosis(
    activeCase,
    photoReply
  );

  if (!activeCase.crop) {
    const replyCrop =
      caseManager.extractRecognisedCrop(
        photoReply
      );

    if (replyCrop) {
      activeCase.crop = replyCrop;
    }
  }
}

await sendWhatsAppMessage(
  from,
  photoReply
);

logAI(
  from,
  "<image>",
  photoReply,
  "photo_diagnosis"
).catch(function (error) {
  console.error(
    "Background photo logging error:",
    error && error.message
      ? error.message
      : error
  );
});

return;
} else if (message.type === "document") {
    const mimeType = message.document && message.document.mime_type
        ? message.document.mime_type
        : "";

    if (!mimeType.startsWith("image/")) {
        userText = "User sent a non-image document.";
    } else {
        const mediaId = message.document && message.document.id
            ? message.document.id
            : null;

        if (!mediaId) {
            await sendWhatsAppMessage(from, "ചിത്രം ലഭിച്ചു, പക്ഷേ മീഡിയ ഫയൽ കണ്ടെത്താനായില്ല. ദയവായി വീണ്ടും അയക്കുക.");
            return;
        }

        const caption = message.document && message.document.caption
            ? message.document.caption
            : "";

        const photoResult = await photoVision({
            mediaId,
            from,
            caption
        });

        const photoReply =
            photoResult && (photoResult.reply || photoResult.text)
                ? (photoResult.reply || photoResult.text)
                : "ചിത്രം ലഭിച്ചു, പക്ഷേ വിശകലനം ചെയ്യാൻ കഴിഞ്ഞില്ല.";

        await sendWhatsAppMessage(from, photoReply);
        await logAI(from, "<image>", photoReply, "photo_diagnosis");
        return;
    }



} else if (message.type === "location") {
  const latitude =
    message.location &&
    message.location.latitude;

  const longitude =
    message.location &&
    message.location.longitude;

  const activeFarmMenu =
    userMenus[from];
 // =====================================================
  // LAND BOUNDARY GPS POINT CAPTURE
  // =====================================================

  const activeBoundarySession =
    boundarySessions[from];

  if (
    activeBoundarySession &&
    activeBoundarySession.sessionId &&
    activeBoundarySession.landId
  ) {
    try {
      const boundaryPointResult =
        await addBoundaryPoint({
          sheets,
          spreadsheetId:
            GOOGLE_SHEET_ID,

          landId:
            activeBoundarySession.landId,

          farmerId:
            activeBoundarySession.farmerId || "",

          whatsapp:
            from,

          sessionId:
            activeBoundarySession.sessionId,

          latitude,
          longitude,

          gpsSource:
            "WhatsApp"
        });

      if (
        !boundaryPointResult ||
        !boundaryPointResult.success
      ) {
        await sendWhatsAppMessage(
          from,
          boundaryPointResult &&
          boundaryPointResult.error
            ? boundaryPointResult.error
            : "Boundary point could not be saved. Please try again."
        );

        return;
      }

      activeBoundarySession.pointCount =
        boundaryPointResult.totalPoints;

      activeBoundarySession.updatedAt =
        Date.now();

      boundarySessions[from] =
        activeBoundarySession;

      await sendWhatsAppMessage(
        from,
        [
          "✅ Boundary point " +
            boundaryPointResult.pointNo +
            " saved.",
          "",
          "📍 Latitude: " +
            boundaryPointResult.latitude,
          "📍 Longitude: " +
            boundaryPointResult.longitude,
          "",
          "Move to the next corner of the land and send your current location again.",
          "",
          "When all boundary points are completed, type DONE.",
          "",
          "To stop boundary capture, type CANCEL."
        ].join("\n")
      );

      return;

    } catch (boundaryError) {
      console.error(
        "Boundary GPS capture error:",
        boundaryError &&
        boundaryError.message
          ? boundaryError.message
          : boundaryError
      );

      await sendWhatsAppMessage(
        from,
        "Boundary point could not be saved. Please try again."
      );

      return;
    }
  }

  
  // =====================================================
  // LAND REGISTRATION GPS
  // =====================================================

  if (
    activeFarmMenu &&
    !isMenuSessionExpired(
      activeFarmMenu
    ) &&
    activeFarmMenu.step ===
      "land_registration_gps"
  ) {
    activeFarmMenu.landRegistration =
      activeFarmMenu.landRegistration || {};

    activeFarmMenu.landRegistration.latitude =
      latitude;

    activeFarmMenu.landRegistration.longitude =
      longitude;

    activeFarmMenu.step =
      "land_registration_confirm";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    const land =
      activeFarmMenu.landRegistration;

    await sendWhatsAppMessage(
      from,
      [
        "✅ GPS location saved.",
        "",
        "Please confirm the land details:",
        "",
        "Land name: " +
          (land.farmName || "-"),
        "District: " +
          (land.district || "-"),
        "Local body: " +
          (land.localBody || "-") +
          " " +
          (land.localBodyType || ""),
        "Area: " +
          (land.area || "-") +
          " " +
          (land.areaUnit || ""),
        "Crop details: " +
          (land.mainCrop || "-"),
        "",
        "1️⃣ Confirm and register",
        "2️⃣ Edit details",
        "3️⃣ Cancel",
        "",
        "Reply with 1, 2 or 3."
      ].join("\n")
    );

    return;
  }

  // =====================================================
  // WEATHER GPS LOCATION
  // =====================================================

  if (
    activeFarmMenu &&
    !isMenuSessionExpired(
      activeFarmMenu
    ) &&
    activeFarmMenu.currentService ===
      "weather"
  ) {
    try {
      const weatherResult =
        await weatherModule({
          latitude,
          longitude,
          from
        });

      await sendWhatsAppMessage(
        from,
        weatherResult &&
        weatherResult.reply
          ? weatherResult.reply
          : "Weather information is currently unavailable."
      );

      activeFarmMenu.currentService =
        null;

      activeFarmMenu.step =
        "completed";

      activeFarmMenu.updatedAt =
        Date.now();

      userMenus[from] =
        activeFarmMenu;

      return;

    } catch (weatherError) {
      console.error(
        "Weather location error:",
        weatherError &&
        weatherError.message
          ? weatherError.message
          : weatherError
      );

      await sendWhatsAppMessage(
        from,
        "Weather information is currently unavailable. Please try again."
      );

      return;
    }
  }

  // =====================================================
  // SOIL GPS LOCATION
  // =====================================================

  if (
    activeFarmMenu &&
    !isMenuSessionExpired(
      activeFarmMenu
    ) &&
    activeFarmMenu.currentService ===
      "soil"
  ) {
    try {
      const soilResult =
        await soilModule({
          latitude,
          longitude,
          from
        });

      await sendWhatsAppMessage(
        from,
        soilResult &&
        soilResult.reply
          ? soilResult.reply
          : "ക്ഷമിക്കണം, മണ്ണ് വിവരങ്ങൾ ലഭ്യമല്ല."
      );

      activeFarmMenu.currentService =
        null;

      activeFarmMenu.step =
        "completed";

      activeFarmMenu.updatedAt =
        Date.now();

      userMenus[from] =
        activeFarmMenu;

      return;

    } catch (soilError) {
      console.error(
        "Soil location error:",
        soilError &&
        soilError.message
          ? soilError.message
          : soilError
      );

      await sendWhatsAppMessage(
        from,
        "ക്ഷമിക്കണം, മണ്ണ് വിവരങ്ങൾ ഇപ്പോൾ ലഭ്യമല്ല."
      );

      return;
    }
  }

  // Location received without an active
  // weather / soil / land-registration request.
  await sendWhatsAppMessage(
    from,
    [
      "📍 Location received.",
      "",
      "Please select the required BhoomiMitra service from MENU."
    ].join("\n")
  );

  return;

} else {
  userText =
    "User sent a non-text message.";
}
 /*
 * Registration must be processed before
 * market, weather, case handling or AI.
 */
// =====================================================
// FIRST-CONTACT LANGUAGE PREFERENCE
// =====================================================

const languageChangeCommands = [
  "language",
  "change language",
  "preferred language",
  "ഭാഷ",
  "ഭാഷ മാറ്റണം",
  "bhasha",
  "bhasha mattanam"
];

const normalizedLanguageText =
  String(userText || "")
    .trim()
    .toLowerCase();

const languageChangeRequested =
  languageChangeCommands.includes(
    normalizedLanguageText
  );

if (languageChangeRequested) {
  pendingLanguageSelections[from] = true;

  await sendWhatsAppMessage(
    from,
    getLanguageSelectionMessage(
      "Bilingual"
    )
  );

  return;
}

if (pendingLanguageSelections[from]) {
  const selectedLanguage =
    parseLanguageSelection(
      userText
    );

  if (!selectedLanguage) {
    await sendWhatsAppMessage(
      from,
      getLanguageSelectionMessage(
        "Bilingual"
      )
    );

    return;
  }

 userLanguagePreferences[from] =
  selectedLanguage;

await updateFarmerPreferredLanguage(
  from,
  selectedLanguage
);

delete pendingLanguageSelections[from];

  let languageConfirmation = "";

  if (selectedLanguage === "English") {
    languageConfirmation =
      "✅ Preferred language saved as English.";
  } else if (
    selectedLanguage === "Malayalam"
  ) {
    languageConfirmation =
      "✅ ഇഷ്ടഭാഷ മലയാളമായി സേവ് ചെയ്തു.";
  } else {
    languageConfirmation = [
      "✅ Preferred language saved as English + Malayalam.",
      "✅ ഇഷ്ടഭാഷ English + മലയാളം ആയി സേവ് ചെയ്തു."
    ].join("\n");
  }

  await sendWhatsAppMessage(
    from,
    languageConfirmation +
      "\n\n" +
     getWelcomeMessage(selectedLanguage)
  );

  return;
}
if (!userLanguagePreferences[from]) {
  const existingFarmerForLanguage =
    await findRegistrationByPhone(
      "farmer",
      from
    );

  const savedPreferredLanguage =
    existingFarmerForLanguage &&
    existingFarmerForLanguage.preferredLanguage
      ? normalizePreferredLanguage(
          existingFarmerForLanguage
            .preferredLanguage
        )
      : "";

  if (savedPreferredLanguage) {
    userLanguagePreferences[from] =
      savedPreferredLanguage;
  } else {
    pendingLanguageSelections[from] = true;

    await sendWhatsAppMessage(
      from,
      getLanguageSelectionMessage(
        "Bilingual"
      )
    );

    return;
  }
}
const regReply =
  await handleRegistration(
    from,
    userText
  );

if (regReply) {
  await sendWhatsAppMessage(
    from,
    regReply
  );

  logAI(
    from,
    userText,
    regReply,
    "registration"
  ).catch(function (error) {
    console.error(
      "Background registration logging error:",
      error &&
      error.message
        ? error.message
        : error
    );
  });

  return;
}    
 const personalResult =
  await handlePersonalRecords({
    from,
    phone: from,
    userText,
    sheets,
    spreadsheetId:
      GOOGLE_SHEET_ID
  });

if (
  personalResult &&
  personalResult.handled
) {
  await sendWhatsAppMessage(
    from,
    personalResult.reply
  );

  return;
}   
 // =====================================================
// WELCOME AND SERVICE MENU
// =====================================================

const existingMenuSession =
  userMenus[from];

if (
  existingMenuSession &&
  isMenuSessionExpired(
    existingMenuSession
  )
) {
  delete userMenus[from];
}
if (
  ["language", "lang", "ഭാഷ"].includes(
    String(userText || "")
      .trim()
      .toLowerCase()
  )
) {
  pendingLanguageSelections[from] = true;

  await sendWhatsAppMessage(
    from,
    getLanguageSelectionMessage(
      "Bilingual"
    )
  );

  return;
}
if (isMenuCommand(userText)) {
  userMenus[from] =
    createMenuSession();

  await sendWhatsAppMessage(
    from,
  getWelcomeMessage(
  userLanguagePreferences[from] || "English"
)
  );

  return;
}

if (
  activeFarmMenu &&
  !isMenuSessionExpired(
    activeFarmMenu
  ) &&
  activeFarmMenu.step ===
    "land_registration_name"
) {
  const farmName =
    String(userText || "").trim();

  if (farmName.length < 2) {
    await sendWhatsAppMessage(
      from,
      "Please enter a valid short name for the land."
    );

    return;
  }

  activeFarmMenu.landRegistration =
    activeFarmMenu.landRegistration || {};

  activeFarmMenu.landRegistration.farmName =
    farmName;

  activeFarmMenu.step =
    "land_registration_district";

  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  await sendWhatsAppMessage(
    from,
    [
      "✅ Land name saved: " + farmName,
      "",
      "Please enter the district where this land is located.",
      "",
      "Example:",
      "Pathanamthitta"
    ].join("\n")
  );

  return;
}
if (
  activeFarmMenu &&
  !isMenuSessionExpired(
    activeFarmMenu
  ) &&
  activeFarmMenu.step ===
    "land_registration_local_body_type"
) {
  const localBodyTypeChoice =
    String(userText || "").trim();

  const localBodyTypes = {
    "1": "Grama Panchayat",
    "2": "Municipality",
    "3": "Municipal Corporation"
  };

  const localBodyType =
    localBodyTypes[
      localBodyTypeChoice
    ];

  if (!localBodyType) {
    await sendWhatsAppMessage(
      from,
      "Please reply with 1, 2 or 3."
    );

    return;
  }

  activeFarmMenu.landRegistration =
    activeFarmMenu.landRegistration || {};

  activeFarmMenu.landRegistration.localBodyType =
    localBodyType;

  activeFarmMenu.step =
    "land_registration_local_body";

  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  await sendWhatsAppMessage(
    from,
    [
      "✅ Local body type saved: " +
        localBodyType,
      "",
      "Please enter the name of the " +
        localBodyType +
        ".",
      "",
      "Example:",
      "Chenneerkara"
    ].join("\n")
  );

  return;
}    
 if (
  activeFarmMenu &&
  !isMenuSessionExpired(
    activeFarmMenu
  ) &&
  activeFarmMenu.step ===
    "land_registration_district"
) {
  const district =
    String(userText || "").trim();

  if (district.length < 3) {
    await sendWhatsAppMessage(
      from,
      "Please enter a valid district name."
    );

    return;
  }

  activeFarmMenu.landRegistration =
    activeFarmMenu.landRegistration || {};

  activeFarmMenu.landRegistration.district =
    district;

  activeFarmMenu.step =
    "land_registration_local_body_type";

  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  await sendWhatsAppMessage(
    from,
    [
      "✅ District saved: " + district,
      "",
      "Please select the local body type:",
      "",
      "1️⃣ Grama Panchayat",
      "2️⃣ Municipality",
      "3️⃣ Municipal Corporation",
      "",
      "Reply with 1, 2 or 3."
    ].join("\n")
  );

  return;
}   
if (
  activeFarmMenu &&
  !isMenuSessionExpired(
    activeFarmMenu
  ) &&
  activeFarmMenu.step ===
    "land_registration_local_body"
) {
  const localBody =
    String(userText || "").trim();

  if (localBody.length < 2) {
    await sendWhatsAppMessage(
      from,
      "Please enter a valid local body name."
    );

    return;
  }

  activeFarmMenu.landRegistration =
    activeFarmMenu.landRegistration || {};

  activeFarmMenu.landRegistration.localBody =
    localBody;

  activeFarmMenu.step =
    "land_registration_area";

  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  await sendWhatsAppMessage(
    from,
    [
      "✅ Local body saved: " + localBody,
      "",
      "Please enter the approximate area of this land.",
      "",
      "Enter only the number.",
      "",
      "Examples:",
      "50",
      "1.5",
      "3"
    ].join("\n")
  );

  return;
}  
 if (
  activeFarmMenu &&
  !isMenuSessionExpired(
    activeFarmMenu
  ) &&
  activeFarmMenu.step ===
    "land_registration_area"
) {
  const areaText =
    String(userText || "").trim();

  const areaMatch =
    areaText.match(
      /^(\d+(?:\.\d+)?)\s*(acre|acres|cent|cents|hectare|hectares|sqm|square metre|square metres|sqft|square feet)?$/i
    );

  if (!areaMatch) {
    await sendWhatsAppMessage(
      from,
      [
        "Please enter a valid land area.",
        "",
        "Examples:",
        "3",
        "3 acre",
        "50 cent",
        "1.5 hectare"
      ].join("\n")
    );

    return;
  }

  const areaValue =
    areaMatch[1];

  const enteredUnit =
    String(areaMatch[2] || "")
      .trim()
      .toLowerCase();

  let areaUnit = "";

  if (
    enteredUnit === "acre" ||
    enteredUnit === "acres"
  ) {
    areaUnit = "Acre";
  } else if (
    enteredUnit === "cent" ||
    enteredUnit === "cents"
  ) {
    areaUnit = "Cent";
  } else if (
    enteredUnit === "hectare" ||
    enteredUnit === "hectares"
  ) {
    areaUnit = "Hectare";
  } else if (
    enteredUnit === "sqm" ||
    enteredUnit === "square metre" ||
    enteredUnit === "square metres"
  ) {
    areaUnit = "Square metre";
  } else if (
    enteredUnit === "sqft" ||
    enteredUnit === "square feet"
  ) {
    areaUnit = "Square feet";
  }

  activeFarmMenu.landRegistration =
    activeFarmMenu.landRegistration || {};

  activeFarmMenu.landRegistration.area =
    areaValue;

  if (areaUnit) {
    activeFarmMenu.landRegistration.areaUnit =
      areaUnit;

    activeFarmMenu.step =
      "land_registration_main_crop";

    await sendWhatsAppMessage(
      from,
      [
        "✅ Land area saved: " +
          areaValue +
          " " +
          areaUnit,
        "",
        "Please enter the main crop grown or planned in this land.",
        "",
        "Examples:",
        "Rubber",
        "Rambutan",
        "Banana",
        "Mixed crops"
      ].join("\n")
    );
  } else {
    activeFarmMenu.step =
      "land_registration_area_unit";

    await sendWhatsAppMessage(
      from,
      [
        "✅ Area value saved: " +
          areaValue,
        "",
        "Please select the area unit:",
        "",
        "1️⃣ Cent",
        "2️⃣ Acre",
        "3️⃣ Hectare",
        "4️⃣ Square metre",
        "5️⃣ Square feet",
        "",
        "Reply with 1, 2, 3, 4 or 5."
      ].join("\n")
    );
  }

  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  return;
}
  if (
  activeFarmMenu &&
  !isMenuSessionExpired(
    activeFarmMenu
  ) &&
  activeFarmMenu.step ===
    "land_registration_area_unit"
) {
  const unitChoice =
    String(userText || "").trim();

  const areaUnits = {
    "1": "Cent",
    "2": "Acre",
    "3": "Hectare",
    "4": "Square metre",
    "5": "Square feet"
  };

  const areaUnit =
    areaUnits[unitChoice];

  if (!areaUnit) {
    await sendWhatsAppMessage(
      from,
      "Please reply with 1, 2, 3, 4 or 5."
    );

    return;
  }

  activeFarmMenu.landRegistration =
    activeFarmMenu.landRegistration || {};

  activeFarmMenu.landRegistration.areaUnit =
    areaUnit;

  activeFarmMenu.step =
    "land_registration_main_crop";

  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  const savedArea =
    activeFarmMenu.landRegistration.area ||
    "";

  await sendWhatsAppMessage(
    from,
    [
      "✅ Area saved: " +
        savedArea +
        " " +
        areaUnit,
      "",
      "Please enter the main crop grown or planned in this land.",
      "",
      "Examples:",
      "Rubber",
      "Rambutan",
      "Banana",
      "Mixed crops"
    ].join("\n")
  );

  return;
} 
 if (
  activeFarmMenu &&
  !isMenuSessionExpired(
    activeFarmMenu
  ) &&
  activeFarmMenu.step ===
    "land_registration_main_crop"
) {
  const cropText =
    String(userText || "").trim();

  if (cropText.length < 2) {
    await sendWhatsAppMessage(
      from,
      "Please enter the main crop grown or planned in this land."
    );

    return;
  }

  activeFarmMenu.landRegistration =
    activeFarmMenu.landRegistration || {};

  activeFarmMenu.landRegistration.mainCrop =
    cropText;

  activeFarmMenu.step =
    "land_registration_gps";

  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  await sendWhatsAppMessage(
    from,
    [
      "✅ Crop details saved: " +
        cropText,
      "",
      "Please share the WhatsApp location of this land.",
      "",
      "Open Attach → Location → Send current location.",
      "",
      "You may also type SKIP to add GPS later."
    ].join("\n")
  );

  return;
}   
  if (
  activeFarmMenu &&
  !isMenuSessionExpired(
    activeFarmMenu
  ) &&
  activeFarmMenu.step ===
    "land_registration_confirm"
) {
  const confirmationChoice =
    String(userText || "").trim();

 if (confirmationChoice === "1") {
  const landResult =
    await registerLand({
      sheets,
      spreadsheetId:
        GOOGLE_SHEET_ID,
      phone: from,
      land:
        activeFarmMenu
          .landRegistration
    });

  if (
    !landResult ||
    !landResult.success
  ) {
    await sendWhatsAppMessage(
      from,
      "Sorry, the land could not be registered. Please try again."
    );

    return;
  }

  await sendWhatsAppMessage(
    from,
    [
      "✅ Land registered successfully.",
      "",
      "Land ID: " +
        landResult.landId,
      "",
      "This Land ID can be used for future farm activities, advisories, soil tests and land summaries."
    ].join("\n")
  );

  delete userMenus[from];

  return;
}
   
  if (confirmationChoice === "2") {
    activeFarmMenu.step =
      "land_registration_name";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    await sendWhatsAppMessage(
      from,
      [
        "✏️ Edit land details",
        "",
        "Please enter the land name again."
      ].join("\n")
    );

    return;
  }

  if (confirmationChoice === "3") {
    delete userMenus[from];

    await sendWhatsAppMessage(
      from,
      "❌ Land registration cancelled."
    );

    return;
  }

  await sendWhatsAppMessage(
    from,
    "Please reply with 1, 2 or 3."
  );

  return;
}  

 if (
  activeFarmMenu &&
  !isMenuSessionExpired(
    activeFarmMenu
  ) &&
 activeFarmMenu.currentService ===
  "farm" &&
activeFarmMenu.step !== "satellite_gps_menu" &&
activeFarmMenu.step !== "land_map_select_land" &&   
/^[1-9]$/.test(
  String(userText || "").trim()
)
) {
  const farmMenuChoice =
    String(userText || "").trim();

  if (farmMenuChoice === "1") {
    await sendWhatsAppMessage(
      from,
      [
        "🌱 Register a New Land Parcel",
        "",
        "Land registration will now begin.",
        "",
        "Please enter a short name for this land.",
        "",
        "Examples:",
        "Home Farm",
        "Elanthoor Farm",
        "Rambutan Plot"
      ].join("\n")
    );

    activeFarmMenu.step =
      "land_registration_name";

    activeFarmMenu.landRegistration = {};

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    return;
  }
if (farmMenuChoice === "2") {
  const landResult =
    await getFarmerLands({
      sheets,
      spreadsheetId:
        GOOGLE_SHEET_ID,
      phone: from
    });

  if (
    !landResult ||
    !landResult.success
  ) {
    await sendWhatsAppMessage(
      from,
      "Sorry, your registered lands could not be retrieved. Please try again."
    );

    return;
  }

  if (
    !Array.isArray(landResult.lands) ||
    landResult.lands.length === 0
  ) {
    await sendWhatsAppMessage(
      from,
      [
        "No registered land parcels were found for this WhatsApp number.",
        "",
        "Use option 1 to register a new land parcel."
      ].join("\n")
    );

    return;
  }

  const lines = [
    "🌾 My Registered Lands",
    ""
  ];

  landResult.lands.forEach(
    function (land, index) {
      lines.push(
        (index + 1) +
          ". " +
          (land.farmName || "Unnamed land")
      );

      lines.push(
        "Land ID: " +
          (land.landId || "-")
      );

      lines.push(
        "Location: " +
          [
            land.localBody,
            land.localBodyType,
            land.district
          ]
            .filter(Boolean)
            .join(", ")
      );

     const areaValue =
  land.area ||
  land.areaValue ||
  land.landArea ||
  land.totalArea ||
  land.Area ||
  "";

const areaUnit =
  land.areaUnit ||
  land.landAreaUnit ||
  land.unit ||
  land.Area_Unit ||
  "";

lines.push(
  "Area: " +
    [areaValue, areaUnit]
      .filter(Boolean)
      .join(" ")
);

      lines.push(
        "Main crop: " +
          (land.mainCrop || "-")
      );

      lines.push("");
    }
  );

  await sendWhatsAppMessage(
    from,
    lines.join("\n").trim()
  );

  return;
}
activeFarmMenu.step =
  "satellite_gps_menu";

activeFarmMenu.updatedAt =
  Date.now();

userMenus[from] =
  activeFarmMenu;

await sendWhatsAppMessage(
  from,
  [
    "🛰️ Satellite, GPS & Land Monitoring",
    "",
    "Please select an option:",
    "",
    "1️⃣ Map / update land boundary",
    "2️⃣ View land map",
    "3️⃣ View boundary status",
    "4️⃣ View GPS details",
    "5️⃣ Satellite farm health",
    "6️⃣ Satellite observation history",
    "7️⃣ Back",
    "",
    "Reply with one number."
  ].join("\n")
);

return;
}
// =====================================================
// SATELLITE / GPS SUBMENU HANDLER
// =====================================================

if (
  activeFarmMenu &&
  !isMenuSessionExpired(
    activeFarmMenu
  ) &&
  activeFarmMenu.step ===
    "satellite_gps_menu"
) {
  const satelliteChoice =
    String(userText || "")
      .trim();

  // 1 - MAP / UPDATE LAND BOUNDARY
  if (satelliteChoice === "1") {
    activeFarmMenu.step =
      "land_boundary_select_land";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    await sendWhatsAppMessage(
      from,
      [
        "🗺️ Land Boundary Mapping",
        "",
        "Please enter the Land ID of the registered land for which you want to map the boundary.",
        "",
        "Example:",
        "BM-L-000001",
        "",
        "You can view your Land IDs using My Registered Lands.",
        "",
        "Type CANCEL to stop."
      ].join("\n")
    );

    return;
  }

 // 2 - VIEW LAND MAP
if (satelliteChoice === "2") {
  try {
   const landsResult =
  await getFarmerLands({
    sheets,
    spreadsheetId:
      GOOGLE_SHEET_ID,
    phone:
      from
  });

    const lands =
      landsResult &&
      Array.isArray(landsResult.lands)
        ? landsResult.lands
        : Array.isArray(landsResult)
          ? landsResult
          : [];

    if (!lands.length) {
      await sendWhatsAppMessage(
        from,
        [
          "🌾 My Registered Lands",
          "",
          "No registered lands were found.",
          "",
          "Please register a land first."
        ].join("\n")
      );

      return;
    }

    activeFarmMenu.step =
      "land_map_select_land";

    activeFarmMenu.landMapLands =
      lands;

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    const landLines =
      [];

    lands.forEach(
      function (land, index) {
        const landName =
          land.farmName ||
          land.landName ||
          land.Farm_Name ||
          land.Land_Name ||
          "Registered land";

        const landId =
          land.landId ||
          land.Land_ID ||
          land["Land ID"] ||
          "";

        landLines.push(
          (index + 1) +
            ". " +
            landName
        );

        if (landId) {
          landLines.push(
            "Land ID: " +
              landId
          );
        }

        landLines.push("");
      }
    );

    await sendWhatsAppMessage(
      from,
      [
        "🌾 My Registered Lands",
        "",
        ...landLines,
        "Reply with:",
        "• Serial number",
        "• Land ID",
        "• Land name",
        "",
        "Examples:",
        "2",
        "BM-L-000003",
        "Manjadi home land",
        "",
        "Type CANCEL to stop."
      ].join("\n")
    );

    return;

  } catch (landListError) {
    console.error(
      "View land list error:",
      landListError &&
      landListError.message
        ? landListError.message
        : landListError
    );

    await sendWhatsAppMessage(
      from,
      "⚠️ Registered lands could not be loaded. Please try again."
    );

    return;
  }
}

 // 3 - VIEW BOUNDARY STATUS
if (satelliteChoice === "3") {
  activeFarmMenu.step =
    "boundary_status_select_land";

  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  await sendWhatsAppMessage(
    from,
    [
      "📍 Boundary Status",
      "",
      "Please enter the Land ID.",
      "",
      "Example:",
      "BM-L-000003",
      "",
      "Type CANCEL to stop."
    ].join("\n")
  );

  return;
}

  // 4 - VIEW GPS DETAILS
if (satelliteChoice === "4") {
  activeFarmMenu.step =
    "gps_details_select_land";

  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  await sendWhatsAppMessage(
    from,
    [
      "📍 GPS Details",
      "",
      "Please enter the Land ID.",
      "",
      "Example:",
      "BM-L-000003",
      "",
      "Type CANCEL to stop."
    ].join("\n")
  );

  return;
}
 // 5 - SATELLITE FARM HEALTH
if (satelliteChoice === "5") {
  activeFarmMenu.step =
    "satellite_health_select_land";

  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  await sendWhatsAppMessage(
    from,
    [
      "🛰️ Satellite Farm Health",
      "",
      "Please enter the Land ID.",
      "",
      "Example:",
      "BM-L-000003",
      "",
      "Type CANCEL to stop."
    ].join("\n")
  );

  return;
}

  // 6 - SATELLITE OBSERVATION HISTORY
if (satelliteChoice === "6") {
  activeFarmMenu.step =
    "satellite_history_select_land";

  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  await sendWhatsAppMessage(
    from,
    [
      "📊 Satellite Observation History",
      "",
      "Please enter the Land ID.",
      "",
      "Example:",
      "BM-L-000003",
      "",
      "Type CANCEL to stop."
    ].join("\n")
  );

  return;
}

  // 7 - BACK
  if (satelliteChoice === "7") {
    activeFarmMenu.step =
      "completed";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    await sendWhatsAppMessage(
      from,
      getServiceMessage("farm")
    );

    return;
  }

  await sendWhatsAppMessage(
    from,
    [
      "Please select a valid option.",
      "",
      "1️⃣ Map / update land boundary",
      "2️⃣ View land map",
      "3️⃣ View boundary status",
      "4️⃣ View GPS details",
      "5️⃣ Satellite farm health",
      "6️⃣ Satellite observation history",
      "7️⃣ Back"
    ].join("\n")
  );

return;
}

// ============================================================
// BOUNDARY STATUS - SELECT LAND
// ============================================================

if (
  activeFarmMenu &&
  !isMenuSessionExpired(activeFarmMenu) &&
  activeFarmMenu.step ===
    "boundary_status_select_land"
) {
  const selectedLandId =
    String(userText || "")
      .trim()
      .toUpperCase();

  if (selectedLandId === "CANCEL") {
    activeFarmMenu.step =
      "satellite_gps_menu";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    await sendWhatsAppMessage(
      from,
      "❌ Boundary status check cancelled."
    );

    return;
  }

  if (
    !selectedLandId ||
    !selectedLandId.startsWith("BM-L-")
  ) {
    await sendWhatsAppMessage(
      from,
      [
        "Please enter a valid registered Land ID.",
        "",
        "Example:",
        "BM-L-000003",
        "",
        "Type CANCEL to stop."
      ].join("\n")
    );

    return;
  }

  try {
    const statusResult =
      await getLandBoundaryMapData({
        sheets,
        spreadsheetId:
          GOOGLE_SHEET_ID,
        landId:
          selectedLandId,
        farmerId:
          activeFarmMenu.farmerId || "",
        whatsapp:
          from
      });

    if (
      !statusResult ||
      !statusResult.success
    ) {
      await sendWhatsAppMessage(
        from,
        statusResult &&
        statusResult.error
          ? "⚠️ " +
            statusResult.error
          : "⚠️ Boundary status could not be loaded."
      );

      return;
    }

    await sendWhatsAppMessage(
      from,
      [
        "📍 Boundary Status",
        "",
        "🆔 Land ID: " +
          statusResult.landId,
        "",
        statusResult.farmName
          ? "🌱 Land: " +
            statusResult.farmName
          : "",
        "",
        "✅ Boundary mapping: Completed",
        "📍 Boundary points: " +
          statusResult.pointCount,

        statusResult.measurements
          ? "📐 GPS calculated area: " +
            statusResult.measurements.cents +
            " Cent"
          : "",

        statusResult.measurements
          ? "📏 Perimeter: " +
            statusResult.measurements.perimeterMetres +
            " m"
          : "",

        statusResult.mappedAt
          ? "🕒 Last updated: " +
            statusResult.mappedAt
          : ""
      ]
        .filter(Boolean)
        .join("\n")
    );

    activeFarmMenu.step =
      "satellite_gps_menu";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    return;
  } catch (statusError) {
    console.error(
      "Boundary status error:",
      statusError &&
      statusError.message
        ? statusError.message
        : statusError
    );

    await sendWhatsAppMessage(
      from,
      "⚠️ Boundary status could not be loaded. Please try again."
    );

    return;
  }
}
// ============================================================
// SATELLITE FARM HEALTH - SELECT LAND
// ============================================================

if (
  activeFarmMenu &&
  !isMenuSessionExpired(activeFarmMenu) &&
  activeFarmMenu.step ===
    "satellite_health_select_land"
) {
  const selectedLandId =
    String(userText || "")
      .trim()
      .toUpperCase();

  if (selectedLandId === "CANCEL") {
    activeFarmMenu.step =
      "satellite_gps_menu";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    await sendWhatsAppMessage(
      from,
      "❌ Satellite farm health check cancelled."
    );

    return;
  }

  if (
    !selectedLandId ||
    !selectedLandId.startsWith("BM-L-")
  ) {
    await sendWhatsAppMessage(
      from,
      [
        "Please enter a valid registered Land ID.",
        "",
        "Example:",
        "BM-L-000003",
        "",
        "Type CANCEL to stop."
      ].join("\n")
    );

    return;
  }

  try {
    const healthResult =
      await getLandBoundaryMapData({
        sheets,
        spreadsheetId:
          GOOGLE_SHEET_ID,
        landId:
          selectedLandId,
        farmerId:
          activeFarmMenu.farmerId || "",
        whatsapp:
          from
      });

    if (
      !healthResult ||
      !healthResult.success
    ) {
      await sendWhatsAppMessage(
        from,
        healthResult &&
        healthResult.error
          ? "⚠️ " +
            healthResult.error
          : "⚠️ Land information could not be loaded."
      );

      return;
    }
const latestSatellite =
  await getLatestSatelliteObservation({
    sheets,
    spreadsheetId:
      GOOGLE_SHEET_ID,
    landId:
      selectedLandId,
    farmerId:
      activeFarmMenu.farmerId || ""
  });
   await sendWhatsAppMessage(
  from,
  [
    "🛰️ Satellite Farm Health",
    "",
    "🆔 Land ID: " +
      healthResult.landId,

    healthResult.farmName
      ? "🌱 Land: " +
        healthResult.farmName
      : "",

    healthResult.measurements
      ? "📐 GPS area: " +
        healthResult.measurements.cents +
        " Cent"
      : "",

    "",

    latestSatellite &&
    latestSatellite.success &&
    latestSatellite.found
      ? "✅ Latest satellite observation available"
      : "ℹ️ No satellite observation available yet.",

    latestSatellite &&
    latestSatellite.success &&
    latestSatellite.found &&
    latestSatellite.observation.observationDate
      ? "📅 Observation: " +
        latestSatellite.observation.observationDate
      : "",

    latestSatellite &&
    latestSatellite.success &&
    latestSatellite.found &&
    latestSatellite.observation.satelliteSource
      ? "🛰️ Source: " +
        latestSatellite.observation.satelliteSource
      : "",

    latestSatellite &&
    latestSatellite.success &&
    latestSatellite.found &&
    latestSatellite.observation.ndvi !== ""
      ? "🌿 NDVI: " +
        latestSatellite.observation.ndvi
      : "",

    latestSatellite &&
    latestSatellite.success &&
    latestSatellite.found &&
    latestSatellite.observation.vegetationStatus
      ? "🌱 Vegetation: " +
        latestSatellite.observation.vegetationStatus
      : "",

    latestSatellite &&
    latestSatellite.success &&
    latestSatellite.found &&
    latestSatellite.observation.moistureStatus
      ? "💧 Moisture: " +
        latestSatellite.observation.moistureStatus
      : "",

    latestSatellite &&
    latestSatellite.success &&
    latestSatellite.found &&
    latestSatellite.observation.waterloggingStatus
      ? "🌧️ Waterlogging: " +
        latestSatellite.observation.waterloggingStatus
      : "",

    latestSatellite &&
    latestSatellite.success &&
    latestSatellite.found &&
    latestSatellite.observation.stressStatus
      ? "⚠️ Stress: " +
        latestSatellite.observation.stressStatus
      : "",

    latestSatellite &&
    latestSatellite.success &&
    latestSatellite.found &&
    latestSatellite.observation.cloudCover !== ""
      ? "☁️ Cloud cover: " +
        latestSatellite.observation.cloudCover
      : "",

    latestSatellite &&
    latestSatellite.success &&
    latestSatellite.found &&
    latestSatellite.observation.remarks
      ? "📝 Remarks: " +
        latestSatellite.observation.remarks
      : ""
  ]
    .filter(Boolean)
    .join("\n")
);

    activeFarmMenu.step =
      "satellite_gps_menu";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    return;
  } catch (healthError) {
    console.error(
      "Satellite farm health error:",
      healthError &&
      healthError.message
        ? healthError.message
        : healthError
    );

    await sendWhatsAppMessage(
      from,
      "⚠️ Satellite farm health could not be loaded. Please try again."
    );

    return;
  }
}   
// ============================================================
// SATELLITE OBSERVATION HISTORY - SELECT LAND
// ============================================================

if (
  activeFarmMenu &&
  !isMenuSessionExpired(activeFarmMenu) &&
  activeFarmMenu.step ===
    "satellite_history_select_land"
) {
  const selectedLandId =
    String(userText || "")
      .trim()
      .toUpperCase();

  if (selectedLandId === "CANCEL") {
    activeFarmMenu.step =
      "satellite_gps_menu";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    await sendWhatsAppMessage(
      from,
      "❌ Satellite observation history cancelled."
    );

    return;
  }

  if (
    !selectedLandId ||
    !selectedLandId.startsWith("BM-L-")
  ) {
    await sendWhatsAppMessage(
      from,
      [
        "Please enter a valid registered Land ID.",
        "",
        "Example:",
        "BM-L-000003",
        "",
        "Type CANCEL to stop."
      ].join("\n")
    );

    return;
  }

  try {
    const historyLandResult =
      await getLandBoundaryMapData({
        sheets,
        spreadsheetId:
          GOOGLE_SHEET_ID,
        landId:
          selectedLandId,
        farmerId:
          activeFarmMenu.farmerId || "",
        whatsapp:
          from
      });

    if (
      !historyLandResult ||
      !historyLandResult.success
    ) {
      await sendWhatsAppMessage(
        from,
        historyLandResult &&
        historyLandResult.error
          ? "⚠️ " +
            historyLandResult.error
          : "⚠️ Land information could not be loaded."
      );

      return;
    }

const historyResult =
  await getSatelliteObservationHistory({
    sheets,
    spreadsheetId:
      GOOGLE_SHEET_ID,
    landId:
      selectedLandId,
    farmerId:
      activeFarmMenu.farmerId || "",
    limit: 5
  });


    await sendWhatsAppMessage(
  from,
  [
    "📊 Satellite Observation History",
    "",
    "🆔 Land ID: " +
      historyLandResult.landId,

    historyLandResult.farmName
      ? "🌱 Land: " +
        historyLandResult.farmName
      : "",

    historyLandResult.measurements
      ? "📐 GPS area: " +
        historyLandResult.measurements.cents +
        " Cent"
      : "",

    "",

    historyResult &&
    historyResult.success &&
    historyResult.found
      ? "✅ Satellite observation records found: " +
        historyResult.count
      : "ℹ️ No satellite observation records are available yet.",

    historyResult &&
    historyResult.success &&
    historyResult.found
      ? historyResult.observations
          .map(function (observation, index) {
            return [
              "",
              "📌 Observation " + (index + 1),

              observation.observationDate
                ? "📅 Date: " +
                  observation.observationDate
                : "",

              observation.satelliteSource
                ? "🛰️ Source: " +
                  observation.satelliteSource
                : "",

              observation.ndvi !== ""
                ? "🌿 NDVI: " +
                  observation.ndvi
                : "",

              observation.vegetationStatus
                ? "🌱 Vegetation: " +
                  observation.vegetationStatus
                : "",

              observation.moistureStatus
                ? "💧 Moisture: " +
                  observation.moistureStatus
                : "",

              observation.waterloggingStatus
                ? "🌧️ Waterlogging: " +
                  observation.waterloggingStatus
                : "",

              observation.stressStatus
                ? "⚠️ Stress: " +
                  observation.stressStatus
                : "",

              observation.cloudCover !== ""
                ? "☁️ Cloud cover: " +
                  observation.cloudCover
                : "",

              observation.remarks
                ? "📝 Remarks: " +
                  observation.remarks
                : ""
            ]
              .filter(Boolean)
              .join("\n");
          })
          .join("\n")
      : ""
  ]
    .filter(Boolean)
    .join("\n")
);

    activeFarmMenu.step =
      "satellite_gps_menu";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    return;
  } catch (historyError) {
    console.error(
      "Satellite observation history error:",
      historyError &&
      historyError.message
        ? historyError.message
        : historyError
    );

    await sendWhatsAppMessage(
      from,
      "⚠️ Satellite observation history could not be loaded. Please try again."
    );

    return;
  }
}   
// ============================================================
// VIEW LAND MAP - SELECT REGISTERED LAND
// ============================================================

if (
  activeFarmMenu &&
  !isMenuSessionExpired(
    activeFarmMenu
  ) &&
  activeFarmMenu.step ===
    "land_map_select_land"
) {
  const rawSelection =
  String(userText || "")
    .trim();

let selectedLandId = "";

if (
  rawSelection.toUpperCase() ===
  "CANCEL"
) {
  selectedLandId = "CANCEL";

} else {
  const savedLands =
    Array.isArray(
      activeFarmMenu.landMapLands
    )
      ? activeFarmMenu.landMapLands
      : [];

  // Selection by serial number
  if (/^\d+$/.test(rawSelection)) {
    const selectedIndex =
      Number(rawSelection) - 1;

    if (
      selectedIndex >= 0 &&
      selectedIndex <
        savedLands.length
    ) {
      const selectedLand =
        savedLands[selectedIndex];

      selectedLandId =
        String(
          selectedLand.landId ||
          selectedLand.Land_ID ||
          selectedLand["Land ID"] ||
          ""
        )
          .trim()
          .toUpperCase();
    }
  }

  // Selection by Land ID
  if (!selectedLandId) {
    const landById =
      savedLands.find(
        function (land) {
          const savedLandId =
            String(
              land.landId ||
              land.Land_ID ||
              land["Land ID"] ||
              ""
            )
              .trim()
              .toUpperCase();

          return (
            savedLandId ===
            rawSelection.toUpperCase()
          );
        }
      );

    if (landById) {
      selectedLandId =
        String(
          landById.landId ||
          landById.Land_ID ||
          landById["Land ID"] ||
          ""
        )
          .trim()
          .toUpperCase();
    }
  }

  // Selection by land name
  if (!selectedLandId) {
    const normalizedName =
      rawSelection
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

    const landByName =
      savedLands.find(
        function (land) {
          const savedName =
            String(
              land.farmName ||
              land.landName ||
              land.Farm_Name ||
              land.Land_Name ||
              ""
            )
              .toLowerCase()
              .replace(/\s+/g, " ")
              .trim();

          return (
            savedName ===
            normalizedName
          );
        }
      );

    if (landByName) {
      selectedLandId =
        String(
          landByName.landId ||
          landByName.Land_ID ||
          landByName["Land ID"] ||
          ""
        )
          .trim()
          .toUpperCase();
    }
  }

  if (!selectedLandId) {
    await sendWhatsAppMessage(
      from,
      [
        "⚠️ Land not found.",
        "",
        "Please reply with:",
        "• Serial number",
        "• Land ID",
        "• Land name",
        "",
        "Example:",
        "2",
        "BM-L-000003",
        "Manjadi home land"
      ].join("\n")
    );

    return;
  }
}
  if (selectedLandId === "CANCEL") {
    activeFarmMenu.step =
      "satellite_gps_menu";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    await sendWhatsAppMessage(
      from,
      [
        "🛰️ Satellite, GPS & Land Monitoring",
        "",
        "1️⃣ Map / update land boundary",
        "2️⃣ View land map",
        "3️⃣ View boundary status",
        "4️⃣ View GPS details",
        "5️⃣ Satellite farm health",
        "6️⃣ Satellite observation history",
        "7️⃣ Back",
        "",
        "Reply with one number."
      ].join("\n")
    );

    return;
  }

  try {
    const mapResult =
      await getLandBoundaryMapData({
        sheets,
        spreadsheetId:
          GOOGLE_SHEET_ID,

        landId:
          selectedLandId,

        farmerId:
          activeFarmMenu.farmerId || "",

        whatsapp:
          from
      });

    if (
      !mapResult ||
      !mapResult.success
    ) {
      await sendWhatsAppMessage(
        from,
        mapResult &&
        mapResult.error
          ? "⚠️ " + mapResult.error
          : "⚠️ Land map could not be loaded."
      );

      return;
    }

   const googleMapUrl =
  "https://www.google.com/maps/search/?api=1&query=" +
  mapResult.points[0].latitude +
  "," +
  mapResult.points[0].longitude;

const baseUrl =
  process.env.RENDER_EXTERNAL_HOSTNAME
    ? "https://" +
      process.env.RENDER_EXTERNAL_HOSTNAME
    : "";

const bhoomiMitraMapUrl =
  baseUrl
    ? baseUrl +
      "/land-map/" +
      encodeURIComponent(
        mapResult.landId
      )
    : "";

    await sendWhatsAppMessage(
      from,
      [
        "🗺️ Land Map",
        "",
        "🆔 Land ID: " +
          mapResult.landId,
        "",
        mapResult.farmName
          ? "🌱 Land: " +
            mapResult.farmName
          : "",
        "",
        mapResult.measurements
  ? "📐 GPS calculated area: " +
    mapResult.measurements.cents +
    " Cent"
  : "",

mapResult.measurements
  ? "📐 Area: " +
    mapResult.measurements.squareMetres +
    " m²"
  : "",

mapResult.measurements
  ? "🌾 Acres: " +
    mapResult.measurements.acres
  : "",

mapResult.measurements
  ? "📏 Perimeter: " +
    mapResult.measurements.perimeterMetres +
    " m"
  : "",

"",
"🌍 Open location in Google Maps:",
googleMapUrl,

"",
bhoomiMitraMapUrl
  ? "🗺️ View Complete BhoomiMitra Land Map:"
  : "",
bhoomiMitraMapUrl,
"",
"✅ Boundary polygon and land sketch are available."
      ]
        .filter(Boolean)
        .join("\n")
    );

    activeFarmMenu.step =
      "satellite_gps_menu";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    return;

  } catch (mapError) {
    console.error(
      "View land map error:",
      mapError &&
      mapError.message
        ? mapError.message
        : mapError
    );

    await sendWhatsAppMessage(
      from,
      "⚠️ Land map could not be loaded. Please try again."
    );

    return;
  }
}  
// =====================================================
// GPS DETAILS - SELECT LAND
// =====================================================

if (
  activeFarmMenu &&
  !isMenuSessionExpired(activeFarmMenu) &&
  activeFarmMenu.step ===
    "gps_details_select_land"
) {
  const selectedLandId =
    String(userText || "")
      .trim()
      .toUpperCase();

  if (selectedLandId === "CANCEL") {
    activeFarmMenu.step =
      "satellite_gps_menu";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    await sendWhatsAppMessage(
      from,
      "GPS details cancelled."
    );

    return;
  }

  try {
    const gpsResult =
      await getLandBoundaryMapData({
        sheets,
        spreadsheetId:
          GOOGLE_SHEET_ID,
        landId:
          selectedLandId,
        farmerId:
          activeFarmMenu.farmerId || "",
        whatsapp:
          from
      });

    if (
      !gpsResult ||
      !gpsResult.success
    ) {
      await sendWhatsAppMessage(
        from,
        gpsResult &&
        gpsResult.error
          ? "⚠️ " + gpsResult.error
          : "⚠️ GPS details could not be loaded."
      );

      return;
    }

    const uniquePoints =
      gpsResult.points.slice(
        0,
        gpsResult.pointCount
      );

    const gpsLines =
      uniquePoints.map(
        function (point, index) {
          return (
            "📍 Point " +
            (index + 1) +
            ": " +
            Number(
              point.latitude
            ).toFixed(7) +
            ", " +
            Number(
              point.longitude
            ).toFixed(7)
          );
        }
      );

    await sendWhatsAppMessage(
      from,
      [
        "📍 Land GPS Details",
        "",
        "🆔 Land ID: " +
          gpsResult.landId,
        "",
        gpsResult.farmName
          ? "🌱 Land: " +
            gpsResult.farmName
          : "",
        "",
        "Total boundary points: " +
          gpsResult.pointCount,
        "",
        ...gpsLines
      ]
        .filter(Boolean)
        .join("\n")
    );

    activeFarmMenu.step =
      "satellite_gps_menu";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    return;

  } catch (gpsError) {
    console.error(
      "GPS details error:",
      gpsError &&
      gpsError.message
        ? gpsError.message
        : gpsError
    );

    await sendWhatsAppMessage(
      from,
      "⚠️ GPS details could not be loaded."
    );

    return;
  }
}  
// =====================================================
// LAND BOUNDARY - SELECT REGISTERED LAND
// =====================================================

if (
  activeFarmMenu &&
  !isMenuSessionExpired(
    activeFarmMenu
  ) &&
  activeFarmMenu.step ===
    "land_boundary_select_land"
) {
  const selectedLandId =
    String(userText || "")
      .trim()
      .toUpperCase();

  if (selectedLandId === "CANCEL") {
    activeFarmMenu.step =
      "completed";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    delete boundarySessions[from];

    await sendWhatsAppMessage(
      from,
      "❌ Land boundary mapping cancelled."
    );

    return;
  }

  if (
    !selectedLandId ||
    !selectedLandId.startsWith(
      "BM-L-"
    )
  ) {
    await sendWhatsAppMessage(
      from,
      [
        "Please enter a valid registered Land ID.",
        "",
        "Example:",
        "BM-L-000001",
        "",
        "Type CANCEL to stop."
      ].join("\n")
    );

    return;
  }

  try {
    const boundaryStartResult =
      await startBoundarySession({
        sheets,
        spreadsheetId:
          GOOGLE_SHEET_ID,

        landId:
          selectedLandId,

        farmerId:
          activeFarmMenu.farmerId || "",

        whatsapp:
          from
      });

    if (
      !boundaryStartResult ||
      !boundaryStartResult.success
    ) {
      await sendWhatsAppMessage(
        from,
        boundaryStartResult &&
        boundaryStartResult.error
          ? boundaryStartResult.error
          : "Boundary mapping could not be started."
      );

      return;
    }

    boundarySessions[from] = {
      sessionId:
        boundaryStartResult.sessionId,

      landId:
        selectedLandId,

      farmerId:
        activeFarmMenu.farmerId || "",

      pointCount:
        0,

      startedAt:
        Date.now(),

      updatedAt:
        Date.now()
    };

    activeFarmMenu.step =
      "land_boundary_capture";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    const selectedLand =
      boundaryStartResult.land || {};

    await sendWhatsAppMessage(
      from,
      [
        "🗺️ Land Boundary Mapping Started",
        "",
        "Land ID: " +
          selectedLandId,
        "",
        selectedLand.farmName
          ? "Land: " +
            selectedLand.farmName
          : "",
        "",
        "📍 Go to the first corner / boundary point of the land.",
        "",
        "From WhatsApp, tap:",
        "📎 → Location → Send your current location",
        "",
        "After the first point is saved, move to the next boundary point and send location again.",
        "",
        "Capture all important corners of the land.",
        "",
        "When finished, type DONE.",
        "",
        "To stop without completing, type CANCEL."
      ]
        .filter(Boolean)
        .join("\n")
    );

    return;

  } catch (boundaryStartError) {
    console.error(
      "Boundary start error:",
      boundaryStartError &&
      boundaryStartError.message
        ? boundaryStartError.message
        : boundaryStartError
    );

    await sendWhatsAppMessage(
      from,
      "Boundary mapping could not be started. Please try again."
    );

    return;
  }
}   
if (
  activeFarmMenu &&
  !isMenuSessionExpired(
    activeFarmMenu
  ) &&
  activeFarmMenu.currentService ===
    "personal_records" &&
  /^[1-5]$/.test(
    String(userText || "").trim()
  )
) {
  const personalChoice =
    String(userText || "").trim();

  if (personalChoice === "5") {
    userMenus[from] =
      createMenuSession();

    await sendWhatsAppMessage(
      from,
      getWelcomeMessage()
    );

    return;
  }

  const personalCommands = {
    "1": "my details",
    "2": "my farmer id",
    "3": "my land",
    "4": "my animals"
  };

  const personalCommand =
    personalCommands[
      personalChoice
    ];

  const personalResult =
    await handlePersonalRecords({
      from,
      phone: from,
      userText:
        personalCommand,
      sheets,
      spreadsheetId:
        GOOGLE_SHEET_ID
    });

  if (
    personalResult &&
    personalResult.handled
  ) {
    await sendWhatsAppMessage(
      from,
      personalResult.reply
    );

    return;
  }

  await sendWhatsAppMessage(
    from,
    "Sorry, your personal records could not be retrieved."
  );

  return;
}    
if (
  isPureMenuSelection(
    userText
  )
) {
  const selections =
    parseServiceSelections(
      userText
    );
const registrationSelected =
  selections.find(
    function (selection) {
      return (
        selection.key ===
        "registration"
      );
    }
  );

if (registrationSelected) {
 const regReply =
  await registrationModule({
    text: "start",
    from,
    sheets,
    spreadsheetId:
      GOOGLE_SHEET_ID,
    language:
      userLanguagePreferences[from] || "English"
  });

  if (
    regReply &&
    regReply.reply
  ) {
    await sendWhatsAppMessage(
      from,
      regReply.reply
    );

    return;
  }
}
  if (
    selections.length === 0
  ) {
    await sendWhatsAppMessage(
      from,
      getWelcomeMessage()
    );

    return;
  }

  let menuSession =
    userMenus[from];

  if (
    !menuSession ||
    isMenuSessionExpired(
      menuSession
    )
  ) {
    menuSession =
      createMenuSession();
  }

  menuSession =
    startSelectedServices(
      menuSession,
      selections
    );

  userMenus[from] =
    menuSession;

  const menuReply =
    formatSelectionResponse(
      selections,
      menuSession
    );

  await sendWhatsAppMessage(
    from,
    menuReply
  );

  return;
}   
// =====================================================
// WEATHER - TYPED LOCATION HANDLING
// =====================================================

const activeWeatherMenu = userMenus[from];

if (
  activeWeatherMenu &&
  !isMenuSessionExpired(activeWeatherMenu) &&
  activeWeatherMenu.currentService === "weather"
) {
  const weatherText =
    String(userText || "").trim();

  const weatherContext =
    await getLatestWeatherContext(
      weatherText
    );

  const forecastContext =
    await getForecastContext(
      weatherText
    );

  const preferredLanguage =
    userLanguagePreferences[from] ||
    "English";

  const weatherReply =
    await getAIReply(
      [
        "This is BhoomiMitra Weather service.",
        "The user has already selected Weather.",
        "Do NOT ask what help is needed.",
        "Do NOT show another service menu.",
        "Immediately provide weather information for the supplied location.",
        "Show Current Weather first.",
        "Then show Forecast if available.",
        "Then give a short farmer advisory based only on the supplied weather data.",
        "Do not invent any weather values.",
        "Reply strictly in saved language: " +
          preferredLanguage,
        "",
        "Location:",
        weatherText
      ].join("\n"),
      weatherContext,
      forecastContext
    );

  await sendWhatsAppMessage(
    from,
    weatherReply
  );

  activeWeatherMenu.currentService =
    null;

  activeWeatherMenu.step =
    "completed";

  activeWeatherMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeWeatherMenu;

  return;
}
// =====================================================
// VERIFIED SERVICE / WORKER / EXPERT SEARCH
// =====================================================

/*
 * Continue a service search when BhoomiMitra
 * previously asked the farmer for location.
 */
if (pendingServiceSearches[from]) {
  const pending =
    pendingServiceSearches[from];

  const districtFromReply =
    detectKeralaDistrict(userText) || "";

  const locationQuery = {
    service: pending.service,
    district:
      districtFromReply ||
      pending.district ||
      "",
    localBody:
      String(userText || "").trim()
  };

  const serviceResults =
    await serviceFinder.searchServices(
      locationQuery
    );

  const serviceReply =
    serviceFinder.formatServiceResults(
      serviceResults,
      locationQuery
    );

  delete pendingServiceSearches[from];

  await sendWhatsAppMessage(
    from,
    serviceReply
  );

  logAI(
    from,
    userText,
    serviceReply,
    "service_search"
  ).catch(function (error) {
    console.error(
      "Service search logging error:",
      error &&
      error.message
        ? error.message
        : error
    );
  });

  return;
}

/*
 * Detect a new request such as:
 * Coconut climber
 * Need tractor service
 * Find a service provider
 */
if (isServiceRequest(userText)) {
  const requestedService =
    resolveRequestedService(
      userText
    );

  /*
   * First use the registered farmer's
   * saved district and local body.
   */
  const farmerProfile =
    await findRegistrationByPhone(
      "farmer",
      from
    );

  const districtFromMessage =
    detectKeralaDistrict(
      userText
    ) || "";

  const serviceQuery = {
    service:
      requestedService,

    district:
      districtFromMessage ||
      (
        farmerProfile &&
        farmerProfile.district
          ? farmerProfile.district
          : ""
      ),

    localBody:
      farmerProfile &&
      farmerProfile.panchayath
        ? farmerProfile.panchayath
        : ""
  };

  /*
   * Ask location only when it cannot
   * be obtained from the farmer profile
   * or the current message.
   */
  if (
  !serviceQuery.district &&
  !serviceQuery.localBody
) {
  pendingServiceSearches[from] = {
    service:
      requestedService,
    district: ""
  };

  const serviceReplyLanguage =
  detectLanguage(
    userText,
    "Malayalam"
  );

  let locationRequestMessage = "";

  if (
    serviceReplyLanguage ===
    "English"
  ) {
    locationRequestMessage = [
      "🔎 Searching for " +
        requestedService +
        " service.",
      "",
      "Please send your District and Local Body.",
      "",
      "Local Body can be:",
      "• Grama Panchayat",
      "• Municipality",
      "• Municipal Corporation",
      "",
      "Example:",
      "Pathanamthitta, Thiruvalla Municipality"
    ].join("\n");

  } else if (
    serviceReplyLanguage ===
    "Bilingual"
  ) {
    locationRequestMessage = [
      "🔎 Searching for " +
        requestedService +
        " service.",
      "",
      "Please send your District and Local Body.",
      "ജില്ലയും തദ്ദേശസ്വയംഭരണ സ്ഥാപനവും അയയ്ക്കുക.",
      "",
      "Local Body can be:",
      "• Grama Panchayat",
      "• Municipality",
      "• Municipal Corporation",
      "",
      "ഉദാഹരണം / Example:",
      "Pathanamthitta, Thiruvalla Municipality"
    ].join("\n");

  } else {
    locationRequestMessage = [
      "🔎 " +
        requestedService +
        " സേവനം തിരയുന്നു.",
      "",
      "നിങ്ങളുടെ ജില്ലയും തദ്ദേശസ്വയംഭരണ സ്ഥാപനവും അയയ്ക്കുക.",
      "",
      "തദ്ദേശസ്വയംഭരണ സ്ഥാപനം:",
      "• ഗ്രാമ പഞ്ചായത്ത്",
      "• മുനിസിപ്പാലിറ്റി",
      "• മുനിസിപ്പൽ കോർപ്പറേഷൻ",
      "",
      "ഉദാഹരണം:",
      "Pathanamthitta, Thiruvalla Municipality"
    ].join("\n");
  }

  await sendWhatsAppMessage(
    from,
    locationRequestMessage
  );

  return;
}
  const serviceResults =
    await serviceFinder.searchServices(
      serviceQuery
    );

  const serviceReply =
    serviceFinder.formatServiceResults(
      serviceResults,
      serviceQuery
    );

  await sendWhatsAppMessage(
    from,
    serviceReply
  );

  logAI(
    from,
    userText,
    serviceReply,
    "service_search"
  ).catch(function (error) {
    console.error(
      "Service search logging error:",
      error &&
      error.message
        ? error.message
        : error
    );
  });

  return;
}    
const detectedIntent = detectIntent(userText);
console.log("Detected Intent:", detectedIntent);

// ================= MARKET MODULE =================
if (detectedIntent === "market") {
  let finalReply = "";

  try {
    const resolvedCommodity =
      await resolveCommodity(
        userText
      );

    if (!resolvedCommodity) {
      console.log(
        "Market commodity could not be resolved:",
        userText
      );

      finalReply =
        "ക്ഷമിക്കണം, നിങ്ങൾ ചോദിച്ച ഉൽപ്പന്നം തിരിച്ചറിയാനായില്ല. " +
        "വിളയുടെ പേര് മാത്രം വീണ്ടും അയക്കുക.";
    } else {
      const commodity =
        resolvedCommodity
          .bhoomiMitraName;

      const officialCommodity =
        resolvedCommodity
          .agmarknetName;
const districtNames = [
  "thiruvananthapuram",
  "kollam",
  "pathanamthitta",
  "alappuzha",
  "kottayam",
  "idukki",
  "ernakulam",
  "thrissur",
  "palakkad",
  "malappuram",
  "kozhikode",
  "wayanad",
  "kannur",
  "kasaragod"
];

const normalisedUserText =
  String(userText || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const detectedDistrict =
  districtNames.find(
    function (district) {
      return normalisedUserText.includes(
        district
      );
    }
  ) || "";

console.log(
  "Market district detected:",
  detectedDistrict ||
    "not specified"
);
      console.log(
        "Market commodity resolved:",
        {
          userMessage:
            userText,

          bhoomiMitraName:
            commodity,

          officialCommodity
        }
      );

      /*
       * Check saved price only for the
       * correctly resolved commodity.
       */
      const savedResult =
  await getMarketPrice({
    readSheetRows,

    query: {
      commodity: commodity,
      district: detectedDistrict
    }
  });

      let savedReplyIsValid =
        false;

      if (
        savedResult &&
        savedResult.success &&
        savedResult.reply
      ) {
        const replyText =
          String(
            savedResult.reply
          ).toLowerCase();

        const requestedName =
          String(
            commodity
          ).toLowerCase();

        const officialName =
          String(
            officialCommodity
          ).toLowerCase();

        savedReplyIsValid =
          replyText.includes(
            requestedName
          ) ||
          replyText.includes(
            officialName
          );

        if (
          !savedReplyIsValid
        ) {
          console.log(
            "Rejected unrelated saved market result:",
            {
              requested:
                commodity,

              official:
                officialCommodity,

              savedReply:
                savedResult.reply
            }
          );
        }
      }

      if (
        savedReplyIsValid
      ) {
        finalReply =
          savedResult.reply;
      } else {
        console.log(
          "Checking AGMARKNET:",
          officialCommodity
        );

   const liveRecords =
  await fetchAllSources({
    state: "Keralam",
    district: detectedDistrict || "",
    market: "",
    commodity: officialCommodity,
    limit: 200
  });

        /*
         * Final safety check:
         * remove records belonging to
         * another commodity.
         */
        const validRecords =
          Array.isArray(
            liveRecords
          )
            ? liveRecords.filter(
                function (
                  record
                ) {
                  const returnedCommodity =
                    String(
                      record &&
                      record.commodity
                        ? record.commodity
                        : ""
                    )
                      .trim()
                      .toLowerCase();

                  const acceptedNames = [
                    commodity,
                    officialCommodity,
                    ...(
                      resolvedCommodity
                        .aliases || []
                    )
                  ]
                    .map(
                      function (
                        value
                      ) {
                        return String(
                          value || ""
                        )
                          .trim()
                          .toLowerCase();
                      }
                    )
                    .filter(Boolean);

                return acceptedNames.some(
  function (
    acceptedName
  ) {
    const normalisedReturned =
      returnedCommodity
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const normalisedAccepted =
      acceptedName
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    return (
      normalisedReturned ===
        normalisedAccepted ||
      normalisedReturned.startsWith(
        normalisedAccepted + " "
      ) ||
      normalisedAccepted.startsWith(
        normalisedReturned + " "
      )
    );
  }
);
                }
              )
            : [];

        console.log(
          "Valid live market records:",
          validRecords.length
        );

        if (
          validRecords.length >
          0
        ) {
         finalReply =
  formatLiveMarketReply(
    validRecords[0]
  );
        }
      }
    }
  } catch (marketError) {
    console.error(
      "Market module error:",
      marketError &&
      marketError.message
        ? marketError.message
        : marketError
    );
  }

  if (!finalReply) {
    finalReply =
      "ക്ഷമിക്കണം, ഈ ഉൽപ്പന്നത്തിനായുള്ള " +
      "ഔദ്യോഗിക മാർക്കറ്റ് വില ഇപ്പോൾ ലഭ്യമല്ല.";
  }

  await sendWhatsAppMessage(
    from,
    finalReply
  );

 logAI(
  from,
  userText,
  finalReply,
  "market"
).catch(function (error) {
  console.error(
    "Background market logging error:",
    error && error.message
      ? error.message
      : error
  );
});

return;
}
// =============== END MARKET MODULE ===============



        let activeCase = caseManager.getActiveCase(from);
    const textCrop = caseManager.extractRecognisedCrop(userText);
    const startsNewCase = caseManager.messageStartsNewCase(userText);
    const refersToCurrentCase =
      caseManager.messageRefersToCurrentCase(userText);

    if (startsNewCase) {
      const createdCase = caseManager.createCase(from, {
        crop: textCrop || "",
        subject: userText || "Agricultural query"
      });

      activeCase = createdCase.case;
    } else if (activeCase && textCrop) {
      const lowerText = String(userText || "").toLowerCase();

      const looksLikeCropCorrection =
        lowerText.includes("it is") ||
        lowerText.includes("it's") ||
        lowerText.includes("this is") ||
        lowerText.includes("crop is") ||
        lowerText.includes("ഇത്") ||
        lowerText.includes("വിള") ||
        lowerText.includes("ആണ്");

      if (
        looksLikeCropCorrection ||
        !activeCase.crop ||
        refersToCurrentCase
      ) {
        activeCase.crop = textCrop;
        activeCase.updatedAt = Date.now();
      } else if (
        activeCase.crop.toLowerCase() !==
        textCrop.toLowerCase()
      ) {
        const createdCase = caseManager.createCase(from, {
          crop: textCrop,
          subject: userText
        });

        activeCase = createdCase.case;
      }
    }

    if (activeCase) {
      caseManager.addMessage(
        activeCase,
        message.type === "audio" ||
        message.type === "voice"
          ? "voice"
          : "text",
        userText
      );
    }

    let caseContext = "";

    if (activeCase) {
      caseContext =
        "\n\nCURRENT AGRICULTURAL CASE CONTEXT:\n" +
        "Crop: " +
        (activeCase.crop || "Not yet confirmed") +
        "\nSubject: " +
        (activeCase.subject || "Crop problem") +
        "\nPrevious image diagnosis or case summary: " +
        (activeCase.summary || activeCase.latestDiagnosis || "Not available") +
        "\n\nUse this context when answering short follow-up replies such as 1, 2, 3, YES, control, symptoms, or crop-name corrections. Do not treat such replies as unrelated questions.";
    }

   const [
  weatherContext,
  forecastContext
] = await Promise.all([
  getLatestWeatherContext(userText),
  getForecastContext(userText)
]);

const preferredLanguage =
  userLanguagePreferences[from] ||
  "English";

const aiReply = await getAIReply(
  "Saved preferred reply language: " +
    preferredLanguage +
    "\n" +
    "IMPORTANT: Follow this saved language preference even if the user's current message is written in another language." +
    "\n\n" +
    userText +
    caseContext,
  weatherContext,
  forecastContext
);
    // ---------------- Expert Escalation ----------------
const lowerUserText =
  String(userText || "")
    .trim()
    .toLowerCase();

const needExpert =
  detectedIntent === "expert" ||
  lowerUserText.includes("expert advice") ||
  lowerUserText.includes("talk to expert") ||
  lowerUserText.includes("connect expert") ||
  lowerUserText.includes("visit my farm") ||
  lowerUserText.includes("field visit") ||
  lowerUserText.includes("വിദഗ്ധനെ വേണം") ||
  lowerUserText.includes("വിദഗ്ധ സഹായം വേണം") ||
  lowerUserText.includes("ഫീൽഡ് വിസിറ്റ് വേണം");
  let expertConfirmation = "";  
 if (needExpert) {
  const assignmentResult = await assignExpertCase({
    caseData: {
      from: from,
      whatsapp: from,
      farmerPhone: from,
      farmerWhatsapp: from,

      crop:
        activeCase && activeCase.crop
          ? activeCase.crop
          : "",

      problem: userText,
      farmerMessage: userText,
      aiDiagnosis: aiReply,
      aiConfidence: 60,
      priority: "High",
      source: "WhatsApp",
      expertRequested: true,
      escalationReason:
        "Farmer requested expert assistance"
    },

    readSheetRows: readSheetRows,
    appendRow: appendSafe
  });

  if (assignmentResult.success) {
    const selectedExpert =
      assignmentResult.expert || {};

    const expertPhone =
      selectedExpert.phone ||
      selectedExpert.whatsappNumber ||
      selectedExpert.mobileNumber ||
      "";

   expertConfirmation =
  "📋 Expert Case Registered\n" +
  "Case ID: " +
  assignmentResult.caseId +
  "\n" +
  (
    selectedExpert.expertId
      ? "Expert ID: " + selectedExpert.expertId + "\n"
      : ""
  ) +
  (
    selectedExpert.expertName
      ? "Assigned Expert: " + selectedExpert.expertName + "\n"
      : ""
  ) +
  "\n" +
  (
    selectedExpert.expertId
      ? "Your query has been assigned to a BhoomiMitra expert."
      : "Your query has been registered. An appropriate expert will be assigned."
  );

    if (
      expertPhone &&
      assignmentResult.expertMessage
    ) {
      await sendWhatsAppMessage(
        expertPhone,
        assignmentResult.expertMessage
      );
    }
  } else {
    console.error(
      "Expert assignment failed:",
      assignmentResult.error
    );
  }
}

 // -------------- End Expert Escalation --------------
   const responseText =
  expertConfirmation || aiReply;

await sendWhatsAppMessage(
  from,
  responseText
);

Promise.all([
  logAI(
    from,
    userText,
    responseText,
    activeCase
      ? "case_followup"
      : "ai_reply"
  ),

  appendSafe(
    SHEETS.farmerQueries,
    [
      new Date().toISOString(),
      from,
      userText,
      responseText,
      "Open"
    ]
  )
])
.catch(function (error) {
  console.error(
    "Background AI logging error:",
    error
  );
});

} catch (error) {
  console.error(
    "Webhook error:",
    error && error.message
      ? error.message
      : error
  );
}
});
// =====================================================
// BHOOMIMITRA REGISTRATION SYSTEM
// Farmer | Expert | Skilled Worker | Service Provider
// =====================================================

function registrationPhoneKey(value) {
  const digits =
    String(value || "")
      .replace(/\D/g, "");

  if (digits.length > 10) {
    return digits.slice(-10);
  }

  return digits;
}

function normalizeRegistrationHeader(value) {
  return String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function makeRegistrationHeaderMap(headers) {
  const map = {};

  headers.forEach(function (header, index) {
    const key =
      normalizeRegistrationHeader(header);

    if (key && map[key] === undefined) {
      map[key] = index;
    }
  });

  return map;
}

function findRegistrationColumn(
  headerMap,
  aliases
) {
  for (const alias of aliases) {
    const key =
      normalizeRegistrationHeader(alias);

    if (
      Object.prototype.hasOwnProperty.call(
        headerMap,
        key
      )
    ) {
      return headerMap[key];
    }
  }

  return -1;
}

function getRegistrationValue(
  row,
  headerMap,
  aliases
) {
  const index =
    findRegistrationColumn(
      headerMap,
      aliases
    );

  if (index < 0) {
    return "";
  }

  return row[index] || "";
}

function setRegistrationValue(
  row,
  headerMap,
  aliases,
  value
) {
  const index =
    findRegistrationColumn(
      headerMap,
      aliases
    );

  if (index < 0) {
    return false;
  }

  while (row.length <= index) {
    row.push("");
  }

  row[index] =
    value == null
      ? ""
      : value;

  return true;
}

function getRegistrationConfig(category) {
  if (category === "farmer") {
    return {
      category: "farmer",
      categoryLabel: "Farmer",
      malayalamLabel: "കർഷകൻ",
      idLabel: "Farmer ID",
      idPrefix: "BM-",
      sheetName: SHEETS.farmers,

      idHeaders: [
        "Farmer_ID",
        "Farmer ID"
      ],

      nameHeaders: [
        "Name",
        "Farmer Name"
      ],

      mobileHeaders: [
        "Mobile",
        "Mobile No",
        "Mob No"
      ],

      whatsappHeaders: [
        "WhatsApp",
        "WhatsApp No",
        "WhatsApp_No"
      ],

      districtHeaders: [
        "District"
      ],

      panchayathHeaders: [
        "Panchayath",
        "Panchayat"
      ],

serviceHeaders: [
  "Main Crop",
  "Main_Crop",
  "Crop"
],

languageHeaders: [
  "Preferred_Language",
  "Preferred Language"
],

statusHeaders: [
  "Status",
  "Verification_Status"
]
    };
  }

  if (category === "expert") {
    return {
      category: "expert",
      categoryLabel: "Expert",
      malayalamLabel: "വിദഗ്ധൻ",
      idLabel: "Expert ID",
      idPrefix: "BM-EX-",
      sheetName:
        SHEETS.expertRegistration,

      idHeaders: [
        "Expert_ID",
        "Expert ID"
      ],

      nameHeaders: [
        "Name",
        "Expert Name"
      ],

      mobileHeaders: [
        "Mobile_No",
        "Mobile No",
        "Mobile",
        "Mob No"
      ],

      whatsappHeaders: [
        "WhatsApp_No",
        "WhatsApp No",
        "WhatsApp"
      ],

      districtHeaders: [
        "District"
      ],

      panchayathHeaders: [
        "Panchayath",
        "Panchayat"
      ],

      serviceHeaders: [
        "Specialization",
        "Expert_Group",
        "Expert Group",
        "Expertise"
      ],

      statusHeaders: [
        "Status",
        "Verification_Status",
        "Verification Status"
      ]
    };
  }

  if (category === "skilled_worker") {
    return {
      category: "skilled_worker",
      categoryLabel: "Skilled Worker",
      malayalamLabel: "വിദഗ്ധ തൊഴിലാളി",
      idLabel: "Worker ID",
      idPrefix: "BM-SW-",
      sheetName:
        SHEETS.skilledWorkerRegistration,

      idHeaders: [
        "Worker_ID",
        "Worker ID"
      ],

      nameHeaders: [
        "Name",
        "Worker Name"
      ],

      mobileHeaders: [
        "Mobile",
        "Mobile No",
        "Mob No"
      ],

      whatsappHeaders: [
        "WhatsApp",
        "WhatsApp No",
        "WhatsApp_No"
      ],

      districtHeaders: [
        "District",
        "Working District"
      ],

      panchayathHeaders: [
        "Panchayath",
        "Panchayat"
      ],

      serviceHeaders: [
        "Skill Category",
        "Skill_Category",
        "Sub Skill",
        "Worker Type"
      ],

      statusHeaders: [
        "Status",
        "Live Status",
        "Verification_Status",
        "Verification Status"
      ]
    };
  }

  if (category === "service_provider") {
    return {
      category: "service_provider",
      categoryLabel: "Service Provider",
      malayalamLabel: "സേവനദാതാവ്",
      idLabel: "Provider ID",
      idPrefix: "BM-SP-",
      sheetName:
        SHEETS.serviceProviderRegistration,

      idHeaders: [
        "Provider_ID",
        "Provider ID",
        "ID"
      ],

      nameHeaders: [
        "Provider Name",
        "Contact Person",
        "Name"
      ],

      mobileHeaders: [
        "Mob No",
        "Mobile No",
        "Mobile"
      ],

      whatsappHeaders: [
        "WhatsApp No",
        "WhatsApp_No",
        "WhatsApp"
      ],

      districtHeaders: [
        "District",
        "Districts Served"
      ],

      panchayathHeaders: [
        "Panchayath",
        "Panchayat"
      ],

      serviceHeaders: [
        "Service Category",
        "Service name",
        "Service Name",
        "Specialization",
        "Provider Type"
      ],

      statusHeaders: [
        "Status",
        "Verification_Status",
        "Verification Status"
      ]
    };
  }

  return null;
}

async function loadRegistrationSheet(
  category
) {
  const config =
    getRegistrationConfig(category);

  if (!config) {
    return null;
  }

  const rows =
    await readSheetRows(
      config.sheetName,
      "A:BK"
    );

  if (!rows || rows.length === 0) {
    console.error(
      "No header row found in registration sheet:",
      config.sheetName
    );

    return null;
  }

  const headers = rows[0];
  const headerMap =
    makeRegistrationHeaderMap(
      headers
    );

  return {
    config,
    rows,
    headers,
    headerMap
  };
}

async function findRegistrationByPhone(
  category,
  phone
) {
  const sheetData =
    await loadRegistrationSheet(
      category
    );

  if (!sheetData) {
    return null;
  }

  const incomingPhone =
    registrationPhoneKey(phone);

  if (!incomingPhone) {
    return null;
  }

  const {
    config,
    rows,
    headerMap
  } = sheetData;

  const matchedRow =
    rows.slice(1).find(function (row) {
      const savedMobile =
        registrationPhoneKey(
          getRegistrationValue(
            row,
            headerMap,
            config.mobileHeaders
          )
        );

      const savedWhatsApp =
        registrationPhoneKey(
          getRegistrationValue(
            row,
            headerMap,
            config.whatsappHeaders
          )
        );

      return (
        savedMobile === incomingPhone ||
        savedWhatsApp === incomingPhone
      );
    });

  if (!matchedRow) {
    return null;
  }

  return {
    success: true,
    alreadyRegistered: true,

    category:
      config.category,

    categoryLabel:
      config.categoryLabel,

    malayalamLabel:
      config.malayalamLabel,

    idLabel:
      config.idLabel,

    memberId:
      getRegistrationValue(
        matchedRow,
        headerMap,
        config.idHeaders
      ),

    name:
      getRegistrationValue(
        matchedRow,
        headerMap,
        config.nameHeaders
      ),

    mobile:
      getRegistrationValue(
        matchedRow,
        headerMap,
        config.mobileHeaders
      ),

    whatsapp:
      getRegistrationValue(
        matchedRow,
        headerMap,
        config.whatsappHeaders
      ),

    district:
      getRegistrationValue(
        matchedRow,
        headerMap,
        config.districtHeaders
      ),

    panchayath:
      getRegistrationValue(
        matchedRow,
        headerMap,
        config.panchayathHeaders
      ),

    service:
      getRegistrationValue(
        matchedRow,
        headerMap,
        config.serviceHeaders
      ),
preferredLanguage:
  getRegistrationValue(
    matchedRow,
    headerMap,
    config.languageHeaders || []
  ),
    status:
      getRegistrationValue(
        matchedRow,
        headerMap,
        config.statusHeaders
      ) || "Pending"
  };
}
async function updateFarmerPreferredLanguage(
  phone,
  preferredLanguage
) {
  try {
    const sheetData =
      await loadRegistrationSheet(
        "farmer"
      );

    if (!sheetData) {
      return false;
    }

    const {
      rows,
      headers,
      headerMap,
      config
    } = sheetData;

    const incomingPhone =
      registrationPhoneKey(phone);

    const rowIndex =
      rows.findIndex(function (row) {
        const savedMobile =
          registrationPhoneKey(
            getRegistrationValue(
              row,
              headerMap,
              config.mobileHeaders
            )
          );

        const savedWhatsApp =
          registrationPhoneKey(
            getRegistrationValue(
              row,
              headerMap,
              config.whatsappHeaders
            )
          );

        return (
          savedMobile === incomingPhone ||
          savedWhatsApp === incomingPhone
        );
      });

    if (rowIndex === -1) {
      return false;
    }

    const languageHeaders =
      config.languageHeaders || [
        "Preferred_Language",
        "Preferred Language"
      ];

    let languageColumnIndex = -1;

    languageHeaders.some(function (header) {
    const normalizedHeader =
  String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

      if (
        Object.prototype.hasOwnProperty.call(
          headerMap,
          normalizedHeader
        )
      ) {
        languageColumnIndex =
          headerMap[normalizedHeader];

        return true;
      }

      return false;
    });

    if (languageColumnIndex === -1) {
      console.error(
        "Preferred language column not found."
      );

      return false;
    }

    function columnNumberToLetter(
      columnNumber
    ) {
      let number = columnNumber + 1;
      let letters = "";

      while (number > 0) {
        const remainder =
          (number - 1) % 26;

        letters =
          String.fromCharCode(
            65 + remainder
          ) + letters;

        number =
          Math.floor(
            (number - 1) / 26
          );
      }

      return letters;
    }

    const sheetRowNumber =
      rowIndex + 2;

    const columnLetter =
      columnNumberToLetter(
        languageColumnIndex
      );

    await sheets.spreadsheets.values.update({
      spreadsheetId:
        GOOGLE_SHEET_ID,

      range:
        config.sheetName +
        "!" +
        columnLetter +
        sheetRowNumber,

      valueInputOption: "RAW",

      requestBody: {
        values: [
          [preferredLanguage]
        ]
      }
    });

    return true;
  } catch (error) {
    console.error(
      "Preferred language update error:",
      error && error.message
        ? error.message
        : error
    );

    return false;
  }
}
function formatExistingRegistration(
  result,
  fallbackPhone
) {
  return (
    "✅ നിങ്ങൾ ഇതിനകം BhoomiMitraയിൽ " +
    (result.malayalamLabel ||
      result.categoryLabel ||
      "അംഗം") +
    " ആയി രജിസ്റ്റർ ചെയ്തിട്ടുണ്ട്.\n\n" +

    (result.idLabel || "ID") +
    ": " +
    (result.memberId || "-") +

    "\nName: " +
    (result.name || "-") +

    "\nMobile/WhatsApp: " +
    (
      result.whatsapp ||
      result.mobile ||
      fallbackPhone ||
      "-"
    ) +

    "\nDistrict: " +
    (result.district || "-") +

    "\nPanchayath: " +
    (result.panchayath || "-") +

    (
      result.service
        ? "\nExpertise/Skill/Service: " +
          result.service
        : ""
    ) +

    "\nStatus: " +
    (result.status || "Pending") +

    "\n\nവീണ്ടും അതേ വിഭാഗത്തിൽ രജിസ്റ്റർ ചെയ്യേണ്ടതില്ല."
  );
}

function formatNewRegistration(
  result,
  fallbackPhone
) {
  return (
    "✅ " +
    (result.categoryLabel || "Member") +
    " രജിസ്ട്രേഷൻ വിജയകരമായി സേവ് ചെയ്തു.\n\n" +

    (result.idLabel || "ID") +
    ": " +
    (result.memberId || "-") +

    "\nName: " +
    (result.name || "-") +

    "\nMobile/WhatsApp: " +
    (
      result.whatsapp ||
      result.mobile ||
      fallbackPhone ||
      "-"
    ) +

    "\nDistrict: " +
    (result.district || "-") +

    "\nPanchayath: " +
    (result.panchayath || "-") +

    (
      result.service
        ? "\nExpertise/Skill/Service: " +
          result.service
        : ""
    ) +

    "\nStatus: " +
    (result.status || "Pending") +

    (
      result.category === "farmer"
        ? ""
        : "\n\nപരിശോധനയ്ക്ക് ശേഷം അംഗീകാരം നൽകും."
    )
  );
}

function detectCategory(text) {
  const t =
    String(text || "")
      .trim()
      .toLowerCase();

  if (
    t === "1" ||
    t.includes("farmer") ||
    t.includes("കർഷ")
  ) {
    return "farmer";
  }

  if (
    t === "2" ||
    t.includes("expert") ||
    t.includes("വിദഗ്ധ")
  ) {
    return "expert";
  }

  if (
    t === "3" ||
    t.includes("skilled worker") ||
    t.includes("skilled") ||
    t.includes("worker") ||
    t.includes("തൊഴിലാള")
  ) {
    return "skilled_worker";
  }

  if (
    t === "4" ||
    t.includes("service provider") ||
    t.includes("service") ||
    t.includes("provider") ||
    t.includes("സേവനദാത")
  ) {
    return "service_provider";
  }

  return "";
}

async function handleRegistration(
  from,
  text
) {
  const lower =
    String(text || "")
      .trim()
      .toLowerCase();

  /*
   * Start registration only when the
   * user asks for registration.
   */
  if (!sessions[from]) {
    const isRegistrationRequest =
      lower.includes("register") ||
      lower.includes("registration") ||
      lower.includes("രജിസ്റ്റർ") ||
      lower.includes("രജിസ്ട്രേഷൻ");

    if (!isRegistrationRequest) {
      return null;
    }

    sessions[from] = {
      step: "category",

      data: {
        whatsapp: from,
        mobile: from
      }
    };

    return (
      "രജിസ്ട്രേഷൻ തുടങ്ങാം. വിഭാഗം അയക്കൂ:\n\n" +
      "1 Farmer\n" +
      "2 Expert\n" +
      "3 Skilled Worker\n" +
      "4 Service Provider"
    );
  }

  const s = sessions[from];

  /*
   * Allow user to cancel an active
   * registration session.
   */
  if (
    lower === "cancel" ||
    lower === "stop" ||
    lower === "റദ്ദാക്കുക"
  ) {
    delete sessions[from];

    return (
      "രജിസ്ട്രേഷൻ റദ്ദാക്കി. " +
      "വീണ്ടും തുടങ്ങാൻ Registration എന്ന് അയക്കുക."
    );
  }

  /*
   * CATEGORY
   */
  if (s.step === "category") {
    const category =
      detectCategory(text);

    if (!category) {
      return (
        "ശരിയായ വിഭാഗം തിരഞ്ഞെടുക്കുക:\n\n" +
        "1 Farmer\n" +
        "2 Expert\n" +
        "3 Skilled Worker\n" +
        "4 Service Provider"
      );
    }

    s.data.category = category;

    /*
     * Check duplicate immediately,
     * before asking the person's name.
     */
    const existing =
      await findRegistrationByPhone(
        category,
        from
      );

    if (existing) {
      delete sessions[from];

      return formatExistingRegistration(
        existing,
        from
      );
    }

    s.step = "name";

    return "പേര് മാത്രം അയക്കൂ.";
  }

  /*
   * NAME
   */
  if (s.step === "name") {
    const name =
      String(text || "").trim();

    if (!name || name.length < 2) {
      return "ശരിയായ പേര് അയക്കൂ.";
    }

    s.data.name = name;
    s.step = "district";

    return "ജില്ല ഏതാണ്?";
  }

  /*
   * DISTRICT
   */
  if (s.step === "district") {
    s.data.district =
      String(text || "").trim();

    s.step = "panchayath";

    return "പഞ്ചായത്ത് ഏതാണ്?";
  }

  /*
   * PANCHAYATH
   */
  if (s.step === "panchayath") {
    s.data.panchayath =
      String(text || "").trim();

    if (
      s.data.category === "farmer"
    ) {
      s.step = "crop";

      return "പ്രധാന കൃഷി / വിള ഏതാണ്?";
    }

    if (
      s.data.category === "expert"
    ) {
      s.step = "service";

      return (
        "നിങ്ങളുടെ പ്രധാന expertise / " +
        "specialization എന്താണ്?"
      );
    }

    if (
      s.data.category ===
      "skilled_worker"
    ) {
      s.step = "service";

      return (
        "നിങ്ങളുടെ പ്രധാന skill എന്താണ്?\n" +
        "ഉദാ: Coconut climber, Machine operator, " +
        "Electrician"
      );
    }

    s.step = "service";

    return (
      "നിങ്ങൾ നൽകുന്ന പ്രധാന agricultural " +
      "service എന്താണ്?"
    );
  }

  /*
   * FARMER CROP
   */
  if (s.step === "crop") {
    s.data.crop =
      String(text || "").trim();

    const registrationData = {
      ...s.data,
      service: s.data.crop
    };

    const result =
      await saveRegistration(
        registrationData
      );

    delete sessions[from];

    if (!result || !result.success) {
      return (
        "ക്ഷമിക്കണം, കർഷക രജിസ്ട്രേഷൻ " +
        "പൂർത്തിയാക്കാൻ കഴിഞ്ഞില്ല. " +
        "കുറച്ച് കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക."
      );
    }

    if (result.alreadyRegistered) {
      return formatExistingRegistration(
        result,
        from
      );
    }

    return formatNewRegistration(
      result,
      from
    );
  }

  /*
   * EXPERT / SKILLED WORKER /
   * SERVICE PROVIDER FINAL FIELD
   */
  if (s.step === "service") {
    s.data.service =
      String(text || "").trim();

    const result =
      await saveRegistration(
        s.data
      );

    delete sessions[from];

    if (!result || !result.success) {
      return (
        "ക്ഷമിക്കണം, രജിസ്ട്രേഷൻ " +
        "പൂർത്തിയാക്കാൻ കഴിഞ്ഞില്ല. " +
        "കുറച്ച് കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക."
      );
    }

    if (result.alreadyRegistered) {
      return formatExistingRegistration(
        result,
        from
      );
    }

    return formatNewRegistration(
      result,
      from
    );
  }

  return null;
}

async function saveRegistration(data) {
  const category =
    data.category || "farmer";

  /*
   * Final duplicate check immediately
   * before saving.
   */
  const existing =
    await findRegistrationByPhone(
      category,
      data.whatsapp ||
      data.mobile ||
      ""
    );

  if (existing) {
    return existing;
  }

  const sheetData =
    await loadRegistrationSheet(
      category
    );

  if (!sheetData) {
    return {
      success: false,
      error:
        "Registration sheet or header row not found."
    };
  }

  const {
    config,
    headers,
    headerMap
  } = sheetData;

  const timestamp =
    new Date().toISOString();

  const id =
    config.idPrefix +
    Date.now();

  /*
   * Create a row having the same number
   * of columns as the Google Sheet.
   */
  const row =
    new Array(headers.length)
      .fill("");

  /*
   * COMMON FIELDS
   */
  setRegistrationValue(
    row,
    headerMap,
    config.idHeaders,
    id
  );

  setRegistrationValue(
    row,
    headerMap,
    config.nameHeaders,
    data.name || ""
  );

  setRegistrationValue(
    row,
    headerMap,
    config.mobileHeaders,
    data.mobile ||
      data.whatsapp ||
      ""
  );

  setRegistrationValue(
    row,
    headerMap,
    config.whatsappHeaders,
    data.whatsapp || ""
  );

  setRegistrationValue(
    row,
    headerMap,
    ["Email"],
    data.email || ""
  );

  setRegistrationValue(
    row,
    headerMap,
    ["Country"],
    "India"
  );

  setRegistrationValue(
    row,
    headerMap,
    ["State"],
    "Kerala"
  );

  setRegistrationValue(
    row,
    headerMap,
    config.districtHeaders,
    data.district || ""
  );

  setRegistrationValue(
    row,
    headerMap,
    ["Block"],
    data.block || ""
  );

  setRegistrationValue(
    row,
    headerMap,
    config.panchayathHeaders,
    data.panchayath || ""
  );

  setRegistrationValue(
    row,
    headerMap,
    config.serviceHeaders,
    data.service ||
      data.crop ||
      ""
  );

  /*
   * COMMON REGISTRATION METADATA
   */
  setRegistrationValue(
    row,
    headerMap,
    [
      "Registration date",
      "Registration Date",
      "Registration_Date",
      "Created date"
    ],
    timestamp
  );

  setRegistrationValue(
    row,
    headerMap,
    [
      "AI_Registration",
      "AI Registration"
    ],
    "WhatsApp"
  );

  setRegistrationValue(
    row,
    headerMap,
    [
      "Verification_Status",
      "Verification Status",
      "Verification Level"
    ],
    category === "farmer"
      ? "Approved"
      : "Pending"
  );

  setRegistrationValue(
    row,
    headerMap,
    ["Last_Updated", "Last Updated"],
    timestamp
  );

  setRegistrationValue(
    row,
    headerMap,
    ["Active_Status", "Active Status"],
    "Active"
  );

  setRegistrationValue(
    row,
    headerMap,
    ["Expert_Assigned", "Expert Assigned"],
    "Not Assigned"
  );

  setRegistrationValue(
    row,
    headerMap,
    ["Remarks"],
    "WhatsApp Registration"
  );

  /*
   * FARMER-SPECIFIC FIELDS
   */
  if (category === "farmer") {
    setRegistrationValue(
      row,
      headerMap,
      [
        "Main Crop",
        "Main_Crop",
        "Crop"
      ],
      data.crop ||
        data.service ||
        ""
    );

    setRegistrationValue(
      row,
      headerMap,
      ["Source"],
      "WhatsApp Registration"
    );

    setRegistrationValue(
      row,
      headerMap,
      ["Status"],
      "Approved"
    );
  }

  /*
   * EXPERT-SPECIFIC FIELDS
   */
  if (category === "expert") {
    setRegistrationValue(
      row,
      headerMap,
      ["Organization"],
      data.organization ||
        "BhoomiMitra External Expert"
    );

    setRegistrationValue(
      row,
      headerMap,
      ["Designation"],
      data.designation ||
        "External Expert"
    );

    setRegistrationValue(
      row,
      headerMap,
      [
        "Expert_Source",
        "Expert Source"
      ],
      "WhatsApp Registration"
    );

    setRegistrationValue(
      row,
      headerMap,
      [
        "Expert_Type",
        "Expert Type"
      ],
      "External Expert"
    );

    setRegistrationValue(
      row,
      headerMap,
      [
        "Expert_Group",
        "Expert Group"
      ],
      data.service || ""
    );

    setRegistrationValue(
      row,
      headerMap,
      ["Specialization"],
      data.service || ""
    );

    setRegistrationValue(
      row,
      headerMap,
      [
        "Consultation_Type",
        "Consultation Type"
      ],
      "Phone; WhatsApp"
    );

    setRegistrationValue(
      row,
      headerMap,
      ["Consultation_Mode"],
      "Phone; WhatsApp"
    );

    setRegistrationValue(
      row,
      headerMap,
      ["Availability"],
      "Available"
    );

    setRegistrationValue(
      row,
      headerMap,
      ["Auto_Route", "Auto Route"],
      "No"
    );

    setRegistrationValue(
      row,
      headerMap,
      ["Status"],
      "Pending"
    );

    setRegistrationValue(
      row,
      headerMap,
      ["AI_Priority", "AI Priority"],
      "Normal"
    );
  }

  /*
   * SKILLED-WORKER-SPECIFIC FIELDS
   */
  if (
    category === "skilled_worker"
  ) {
    setRegistrationValue(
      row,
      headerMap,
      ["Worker Type"],
      "Skilled Worker"
    );

    setRegistrationValue(
      row,
      headerMap,
      [
        "Skill Category",
        "Skill_Category"
      ],
      data.service || ""
    );

    setRegistrationValue(
      row,
      headerMap,
      ["Sub Skill"],
      data.service || ""
    );

    setRegistrationValue(
      row,
      headerMap,
      ["Availability"],
      "Available"
    );

    setRegistrationValue(
      row,
      headerMap,
      ["Working District"],
      data.district || ""
    );

    setRegistrationValue(
      row,
      headerMap,
      ["Live Status", "Status"],
      "Pending"
    );
  }

  /*
   * SERVICE-PROVIDER-SPECIFIC FIELDS
   */
  if (
    category === "service_provider"
  ) {
    setRegistrationValue(
      row,
      headerMap,
      ["Provider Name"],
      data.name || ""
    );

    setRegistrationValue(
      row,
      headerMap,
      ["Contact Person"],
      data.name || ""
    );

    setRegistrationValue(
      row,
      headerMap,
      ["Provider Type"],
      "Service Provider"
    );

    setRegistrationValue(
      row,
      headerMap,
      [
        "Service Category",
        "Service name",
        "Service Name"
      ],
      data.service || ""
    );

    setRegistrationValue(
      row,
      headerMap,
      ["Specialization"],
      data.service || ""
    );

    setRegistrationValue(
      row,
      headerMap,
      ["Districts Served"],
      data.district || ""
    );

    setRegistrationValue(
      row,
      headerMap,
      ["Availability"],
      "Available"
    );

    setRegistrationValue(
      row,
      headerMap,
      ["Status"],
      "Pending"
    );
  }

  const saved =
    await appendSafe(
      config.sheetName,
      row
    );

  if (!saved) {
    return {
      success: false,
      error:
        "Google Sheet append failed."
    };
  }

  return {
    success: true,
    alreadyRegistered: false,

    category:
      config.category,

    categoryLabel:
      config.categoryLabel,

    malayalamLabel:
      config.malayalamLabel,

    idLabel:
      config.idLabel,

    memberId: id,

    farmerId:
      category === "farmer"
        ? id
        : "",

    name:
      data.name || "",

    mobile:
      data.mobile ||
      data.whatsapp ||
      "",

    whatsapp:
      data.whatsapp || "",

    district:
      data.district || "",

    panchayath:
      data.panchayath || "",

    service:
      data.service ||
      data.crop ||
      "",

    status:
      category === "farmer"
        ? "Approved"
        : "Pending"
  };
}
async function getLatestWeatherContext(userText) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: SHEETS.weatherData + "!A2:P"
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return "No live weather data available.";

    const district = detectKeralaDistrict(userText);
    let row = rows[0];

    if (district) {
      const found = rows.find(function (r) {
        return String(r[2] || "").toLowerCase() === district.toLowerCase();
      });
      if (found) row = found;
    }

    return [
      "Latest BhoomiMitra Weather:",
      "District: " + (row[2] || ""),
      "Date: " + (row[3] || ""),
      "Time: " + (row[4] || ""),
      "Temperature: " + (row[5] || "") + " C",
      "Humidity: " + (row[6] || "") + " %",
      "Rainfall: " + (row[7] || "") + " mm",
      "Wind Speed: " + (row[8] || "") + " km/h",
      "Wind Direction: " + (row[9] || ""),
      "Pressure: " + (row[10] || "") + " hPa",
      "Weather Event: " + (row[13] || ""),
      "Source: " + (row[14] || ""),
      "Last Updated: " + (row[15] || "")
    ].join("\n");

  } catch (error) {
  console.error(
    "Weather read error:",
    error.response && error.response.data
      ? error.response.data
      : error.message
  );

  return "Weather data could not be read from BhoomiMitra database.";
}
}

const WEATHER_CACHE_MS = 10 * 60 * 1000;

const weatherCache = {
  currentRows: null,
  currentTime: 0
};

async function getForecastContext(userText) {
  try {
    const now = Date.now();
let rows = weatherCache.currentRows;

if (
  !rows ||
  now - weatherCache.currentTime >
    WEATHER_CACHE_MS
) {
  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId:
        GOOGLE_SHEET_ID,
      range:
        SHEETS.weatherData + "!A2:P"
    });

  rows =
    response.data.values || [];

  weatherCache.currentRows = rows;
  weatherCache.currentTime = now;

  console.log(
    "Current weather cache refreshed."
  );
}

    if (rows.length === 0) {
      return "No forecast data available.";
    }

    const district =
      detectKeralaDistrict(userText);

    let filtered = rows;

    if (district) {
      filtered = rows.filter(
        function (r) {
          return (
            String(r[2] || "")
              .trim()
              .toLowerCase() ===
            district.toLowerCase()
          );
        }
      );
    }

    function normaliseForecastDate(value) {
      const text =
        String(value || "").trim();

      if (!text) {
        return "";
      }

      // YYYY-MM-DD
      let match = text.match(
        /^(\d{4})-(\d{1,2})-(\d{1,2})/
      );

      if (match) {
        return (
          match[1] +
          "-" +
          String(match[2]).padStart(
            2,
            "0"
          ) +
          "-" +
          String(match[3]).padStart(
            2,
            "0"
          )
        );
      }

      // DD/MM/YYYY or DD-MM-YYYY
      match = text.match(
        /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/
      );

      if (match) {
        return (
          match[3] +
          "-" +
          String(match[2]).padStart(
            2,
            "0"
          ) +
          "-" +
          String(match[1]).padStart(
            2,
            "0"
          )
        );
      }

      return "";
    }

    const todayIndia =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }
      ).format(new Date());

    filtered = filtered
      .filter(function (r) {
        return Boolean(
          normaliseForecastDate(r[3])
        );
      })
      .sort(function (a, b) {
        return normaliseForecastDate(
          a[3]
        ).localeCompare(
          normaliseForecastDate(b[3])
        );
      });

    const currentAndFutureRows =
      filtered.filter(function (r) {
        return (
          normaliseForecastDate(
            r[3]
          ) >= todayIndia
        );
      });

    const selectedRows =
      (
        currentAndFutureRows.length > 0
          ? currentAndFutureRows
          : filtered.slice(-3)
      ).slice(0, 3);

    if (selectedRows.length === 0) {
      return "No current forecast data available.";
    }

    return selectedRows
      .map(function (r) {
        return (
          (r[3] || "") +
          ": Max " +
          (r[4] || "") +
          " C, Min " +
          (r[5] || "") +
          " C, Rain " +
          (r[6] || "") +
          " mm, Rain Chance " +
          (r[7] || "") +
          "%, Wind " +
          (r[8] || "") +
          " km/h, Event " +
          (r[9] || "") +
          ", Advisory: " +
          (r[10] || "")
        );
      })
      .join("\n");

  } catch (error) {
    console.error(
      "Forecast read error:",
      error.response &&
      error.response.data
        ? error.response.data
        : error.message
    );

    return "Forecast data could not be read from BhoomiMitra database.";
  }
}
function extractMarketCommodity(text) {
  const value = String(text || "").toLowerCase();
  const commodities = [
    {
      apiName: "Black pepper",
      keywords: [
        "black pepper",
        "pepper",
        "കുരുമുളക്"
      ]
    },
    {
      apiName: "Coconut",
      keywords: [
        "coconut",
        "തേങ്ങ",
        "നാളികേരം"
      ]
    },
    {
      apiName: "Banana",
      keywords: [
        "banana",
        "വാഴപ്പഴം",
        "വാഴ"
      ]
    },
    {
      apiName: "Cardamom",
      keywords: [
        "cardamom",
        "ഏലം"
      ]
    },
    {
      apiName: "Ginger",
      keywords: [
        "ginger",
        "ഇഞ്ചി"
      ]
    },
    {
      apiName: "Turmeric",
      keywords: [
        "turmeric",
        "മഞ്ഞൾ"
      ]
    },
    {
      apiName: "Arecanut",
      keywords: [
        "arecanut",
        "areca nut",
        "അടയ്ക്ക"
      ]
    },
    {
      apiName: "Paddy",
      keywords: [
        "paddy",
        "നെല്ല്"
      ]
    },
    {
      apiName: "Rice",
      keywords: [
        "rice",
        "അരി"
      ]
    },
    {
      apiName: "Copra",
      keywords: [
        "copra",
        "കൊപ്ര"
      ]
    }
  ];
  for (const item of commodities) {
    const matched = item.keywords.some(function (keyword) {
      return value.includes(keyword);
    });
    if (matched) {
      return item.apiName;
    }
  }
  return "";
}
function parseMarketDate(value) {
  const text = String(value || "").trim();

  if (!text) {
    return 0;
  }

  const parts = text.split(/[\/\-]/);

  if (parts.length === 3) {
    const first = Number(parts[0]);
    const second = Number(parts[1]);
    const third = Number(parts[2]);

    if (
      Number.isFinite(first) &&
      Number.isFinite(second) &&
      Number.isFinite(third)
    ) {
      if (third > 1900) {
        return new Date(
          third,
          second - 1,
          first
        ).getTime();
      }

      if (first > 1900) {
        return new Date(
          first,
          second - 1,
          third
        ).getTime();
      }
    }
  }

  const parsed = Date.parse(text);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function formatLiveMarketReply(record) {
  if (!record) {
    return "ക്ഷമിക്കണം, ഈ ഉൽപ്പന്നത്തിനായുള്ള മാർക്കറ്റ് വില ഇപ്പോൾ ലഭ്യമല്ല.";
  }

  const minimum =
    record.minimumPrice == null
      ? "-"
      : record.minimumPrice;

  const maximum =
    record.maximumPrice == null
      ? "-"
      : record.maximumPrice;

  const modal =
    record.price == null
      ? "-"
      : record.price;

  return [
    "📊 BhoomiMitra Market Intelligence",
    "",
    "Commodity: " +
      (record.commodity || "-"),
    "Variety: " +
      (record.variety || "-"),
    "Market: " +
      (record.market || "-"),
    "District: " +
      (record.district || "-"),
    "",
    "Modal Price: ₹" +
      modal +
      "/" +
      (record.unit || "kg"),
    "Price Range: ₹" +
      minimum +
      " - ₹" +
      maximum,
    "",
    "Source date: " +
      (record.sourceDate || "-"),
    "BhoomiMitra checked: " +
      (record.checkedAt || "-"),
    "Source: " +
      (record.source || "AGMARKNET"),
    "Status: Official source"
  ].join("\n");
}

function detectKeralaDistrict(text) {
  const districts = [
    "Thiruvananthapuram",
    "Kollam",
    "Pathanamthitta",
    "Alappuzha",
    "Kottayam",
    "Idukki",
    "Ernakulam",
    "Thrissur",
    "Palakkad",
    "Malappuram",
    "Kozhikode",
    "Wayanad",
    "Kannur",
    "Kasaragod"
  ];

  const lower = String(text || "").toLowerCase();

  for (const d of districts) {
    if (lower.includes(d.toLowerCase())) return d;
  }

  return null;
}

async function getAIReply(userText, weatherContext, forecastContext) {
  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            SYSTEM_PROMPT +
            "\n\nUse this live weather data only when relevant:\n" +
            weatherContext +
            "\n\n7-day forecast:\n" +
            forecastContext
        },
        {
          role: "user",
          content: userText
        }
      ]
    });

    const reply =
      completion &&
      completion.choices &&
      completion.choices[0] &&
      completion.choices[0].message &&
      completion.choices[0].message.content
        ? completion.choices[0].message.content
        : "ക്ഷമിക്കണം, ഇപ്പോൾ മറുപടി നൽകാൻ കഴിഞ്ഞില്ല. വീണ്ടും ശ്രമിക്കുക.";

    return limitWhatsAppText(reply);

  } catch (error) {
    console.error("OpenAI error:", error.response && error.response.data ? error.response.data : error.message);
    return "ക്ഷമിക്കണം, ഇപ്പോൾ BhoomiMitra മറുപടി നൽകാൻ കഴിഞ്ഞില്ല. കുറച്ച് കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക.";
  }
}

async function sendWhatsAppMessage(to, text) {
  const url = "https://graph.facebook.com/v25.0/" + PHONE_NUMBER_ID + "/messages";

  await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: "text",
      text: {
        preview_url: false,
        body: limitWhatsAppText(text)
      }
    },
    {
      headers: {
        Authorization: "Bearer " + WHATSAPP_TOKEN,
        "Content-Type": "application/json"
      }
    }
  );
}

async function appendSafe(sheetName, row) {
  try {
    if (
      !GOOGLE_SHEET_ID ||
      !GOOGLE_CLIENT_EMAIL ||
      !GOOGLE_PRIVATE_KEY
    ) {
      console.log("Google Sheets credentials missing.");
      return false;
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: "'" + String(sheetName).replace(/'/g, "''") + "'!A:BK",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [row]
      }
    });

    console.log(
      "Row successfully appended to:",
      sheetName
    );

    return true;

  } catch (error) {
    console.error(
      "Google Sheet append error for sheet:",
      sheetName
    );

    console.error(
      error.response && error.response.data
        ? error.response.data
        : error.message
    );

    return false;
  }
}
async function readSheetRows(sheetName, range) {
  try {
    const requestedName = String(sheetName || "").trim();
    const requestedRange = String(range || "A:Z").trim();

    const now = Date.now();

    if (
      !sheetMetadataCache ||
      now - sheetMetadataCacheTime > SHEET_METADATA_CACHE_MS
    ) {
      const spreadsheetInfo =
        await sheets.spreadsheets.get({
          spreadsheetId: GOOGLE_SHEET_ID,
          fields: "sheets(properties(sheetId,title))"
        });

      sheetMetadataCache =
        spreadsheetInfo.data.sheets || [];

      sheetMetadataCacheTime = now;

      console.log(
        "Google Sheet metadata cache refreshed."
      );
    }

    const availableSheets =
      sheetMetadataCache || [];

    console.log(
      "Tabs visible to server:",
      availableSheets.map(function (sheet) {
        return {
          sheetId: sheet.properties.sheetId,
          title: sheet.properties.title
        };
      })
    );

    function normalizeTitle(value) {
      return String(value || "")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .trim()
        .toLowerCase();
    }

    const targetSheet = availableSheets.find(function (sheet) {
      return (
        normalizeTitle(sheet.properties.title) ===
        normalizeTitle(requestedName)
      );
    });

    if (!targetSheet) {
      console.error(
        "Requested sheet was not found:",
        JSON.stringify(requestedName)
      );
      return [];
    }

    const actualSheetTitle =
      targetSheet.properties.title;

    const escapedSheetTitle =
      actualSheetTitle.replace(/'/g, "''");

    const fullRange =
      "'" + escapedSheetTitle + "'!" + requestedRange;

    console.log(
      "Resolved actual sheet title:",
      JSON.stringify(actualSheetTitle)
    );

    console.log(
      "Reading exact Google Sheet range:",
      JSON.stringify(fullRange)
    );

    const response =
      await sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: fullRange
      });

    return response.data.values || [];

  } catch (error) {
    console.error(
      "Google Sheet read error for sheet:",
      sheetName
    );

    console.error(
      error.response && error.response.data
        ? error.response.data
        : error.message
    );

    return [];
  }
}
async function logAI(from, userText, reply, type) {
  await appendSafe(SHEETS.aiLog, [
    new Date().toISOString(),
    from,
    type,
    userText,
    reply
  ]);

  await appendSafe(SHEETS.conversation, [
    new Date().toISOString(),
    from,
    reply,
    "outgoing"
  ]);
}

function limitWhatsAppText(text) {
  if (!text) {
    return "ക്ഷമിക്കണം, മറുപടി നൽകാൻ കഴിഞ്ഞില്ല.";
  }

  const cleanText = String(text).trim();

  if (cleanText.length <= 3500) {
    return cleanText;
  }

  return cleanText.substring(0, 3400) + "\n\nമറുപടി ചുരുക്കി നൽകി. കൂടുതൽ വിവരങ്ങൾക്ക് തുടർചോദ്യം ചോദിക്കാം.";
}

app.listen(PORT, "0.0.0.0", function () {
  console.log("BhoomiMitra Server v2.0 running on port " + PORT);
}); 
