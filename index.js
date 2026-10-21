const express = require("express");
const axios = require("axios");
const path = require("path");
require("dotenv").config();
const SERVER_VERSION = require("./package.json").version;

const OpenAI = require("openai");
const { google } = require("googleapis");
const detectIntent = require("./utils/detectIntent");
const voiceModule = require("./utils/voice");
const photoVision = require("./utils/photoVision");
const {
  captureRawBody,
  createMessageLedger,
  createRedisMessageLedger,
  safeErrorDetails,
  safeMessageMetadata,
  verifyMetaSignature
} = require("./utils/webhookSecurity");
const soilModule = require("./utils/soil");
const weatherModule = require("./utils/weather");
const detectKeralaDistrict = require("./utils/keralaDistricts");
const {
  buildWeatherSheetReply,
  getWeatherDistrictPrompt,
  getWeatherUnavailableReply
} = require("./utils/weatherSheetReply");

const {
  createBhoomiMitraUI
} = require("./utils/bhoomiMitraUI");

const {
  registerLand,
  getFarmerLands,
  parseLandUpdateDetails,
  updateLandDetails
} = require("./utils/landRegistration");
const {
  registerAnimal
} = require("./utils/animalRegistration");
const {
  ANIMAL_ACTION_IDS,
  formatAnimalRecords,
  formatDiseaseAlerts,
  formatOwnedAnimals,
  getAnimalRecords,
  getOwnedAnimals,
  getVerifiedDiseaseAlerts,
  isAnimalNaturalLanguageQuery,
  parseAnimalAction,
  saveBreedingProductionRecord,
  saveHealthRecord,
  verifyAnimalOwnership
} = require("./utils/animalHusbandry");

const {
  startBoundarySession,
  addBoundaryPoint,
  getBoundaryPoints,
  completeBoundary,
  verifyBoundary,
  cancelBoundary,
  getLandBoundaryMapData,
  getLandMapDataByAccessToken,
  getAccessibleLandBoundaryStatus,
  createLandMapAccessToken,
  handleBoundaryStatusSelection,
  handleGpsDetailsSelection
} = require("./utils/landBoundary");
const {
  getAccessibleLand
} = require("./utils/accessibleLand");
const {
  getLatestSatelliteObservation,
  getSatelliteObservationHistory,
  getCopernicusAccessToken,
  getLatestSentinel2Scene,
  getSentinel2Ndvi,
  saveSatelliteObservation,
  isValidLandId,
  isSatelliteExitCommand,
  getSatelliteDiagnosticAccess,
  getSatelliteDiagnosticLandConfig,
  formatSatelliteSelectionPrompt,
  formatSatelliteCancelMessage,
  formatSatelliteValidationMessage,
  formatSatelliteAccessMessage,
  formatSatelliteFailureMessage,
  formatSatelliteHealthReply,
  formatSatelliteHistoryReply
} = require("./utils/satellite");
const {
  checkLandAccess,
  grantLandAccess,
  revokeLandAccess,
  getLandAuthorizedUsers
} = require("./utils/landAccess");
const {
  AGREEMENT_VERSION,
  PRIVACY_POLICY_VERSION,
  getLatestConsent,
  saveConsent
} = require("./utils/privacy");
const {
  formatPrivacyPolicy
} = require("./utils/privacySelfService");
const {
  createFeatureDiscovery,
  createRedisFeatureDiscovery,
  shouldShowWhatsNew
} = require("./utils/whatsNew");
const {
  createRedisRestClient,
  resolveStateConfiguration
} = require("./utils/redisState");
const {
  createMemoryPhotoQuota,
  createRedisPhotoQuota,
  photoLimitMessage,
  photoQuotaUnavailableMessage
} = require("./utils/photoQuota");
const {
  getMissingPreferenceAction,
  shouldSendRegisteredHelpPrompt
} = require("./utils/greetingPolicy");
const {
  createAiSheetLogger
} = require("./utils/aiSheetLogging");
const {
  hasCurrentConsent
} = require("./utils/onboarding");
const {
  parseAboutAction
} = require("./utils/aboutBhoomiMitra");
const {
  parseUserGuideAction
} = require("./utils/userGuide");
const {
  handlePersonalRecords
} = require("./utils/personalRecords");
const {
  USER_REGISTRATION_STATES,
  resolveUserRegistrationStatus,
  validateRegistrationIdentityHeaders,
  isFarmerRegistrationEligible,
  isServiceMemberEligible,
  isGuestAllowedAction,
  isLimitedAccessState,
  formatRestrictedAccess
} = require("./utils/userRegistrationStatus");
const {
  closeRegistrationSessionForNavigation,
  clearCompletedRegistrationSession
} = require("./utils/registrationSession");
const {
  getRegistrationResumePlan,
  isResumeConfirmation,
  registrationResumePrompt
} = require("./utils/registrationResume");
const {
  routeRegistrationWebhookResult
} = require("./utils/registrationWebhook");

const registrationModule =
  require("./utils/registration");
const {
  FARMER_HEADER_ALIASES,
  normalizeRegistrationHeader,
  getFarmerPreferredLanguage,
  resolveFarmerPreferredLanguageWrite,
  setFarmerPreferredLanguage,
  applyNewFarmerStatuses,
  readFarmerStatuses,
  formatRegistrationServiceLine,
  formatFarmerRegistrationConfirmation,
  withPreferredLanguage
} = require("./utils/registrationFields");
const {
  syncFarmerRegistration
} = require("./utils/masterMemberRegistry");
const {
  createRegistrationCoordinator
} = require("./utils/registrationIntegrity");

const {
  createServiceFinder,
  resolveRequestedService,
  isServiceRequest
} = require("./utils/services");
const {
  isMenuCommand,
  getNaturalFeatureEntry,
  getWelcomeMessage,
  getServicePrompt,
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
  assignExpertCase,
  buildSheetCellUpdates,
  consumeRecentExpertProblem,
  getRecentExpertProblem,
  getHeaderValue: getExpertCaseHeaderValue,
  isDetailedFarmerProblem,
  isEscalationOnlyMessage,
  makeHeaderMap: makeExpertCaseHeaderMap,
  parseExpertReplyText,
  rememberRecentExpertProblem,
  resolveExpertProblemContext
} = require("./utils/expertAssignment");
const {
  buildExpertCaseSelectionRows,
  buildFarmerCaseView,
  buildFarmerFollowUpPrompt,
  buildFarmerAssignmentCard,
  findFarmerCases,
  getExpertAdviceAction,
  parseExpertCaseAction,
  processExpertReply,
  processFarmerFollowUp,
  shouldCreateExpertCase
} = require("./utils/expertAdviceFlow");
const {
  TRAINING_PROGRAM_SHEET,
  TRAINING_REGISTRATION_SHEET,
  TRAINING_REQUEST_SHEET,
  buildPromotedTrainingDetails,
  buildPromotedTrainingListRows,
  buildTrainingDetails,
  buildTrainingListRows,
  captureTrainingRequestDate,
  captureTrainingRequestLocation,
  captureTrainingRequest,
  changeTrainingRequest,
  createTrainingRequestSession,
  filterTrainingPrograms,
  findTrainingProgram,
  getMyTrainings,
  getPromotedTrainingPrograms,
  parseTrainingAction,
  readTrainingRequests,
  readTrainingPrograms,
  registerFarmerForTraining,
  isTrainingRequestCancellation,
  selectTrainingRequestDateChoice,
  selectTrainingRequestMode,
  selectTrainingRequestTime,
  sendTrainingRequestAlertForSubmission,
  submitTrainingRequest
} = require("./utils/training");
const {
  ADVISORY_SHEET,
  SCHEME_ANIMAL_SHEET,
  SCHEME_CATALOG_SHEET,
  SCHEME_LAND_SHEET,
  SCHEME_REQUEST_SHEET,
  activeSchemes,
  buildAdvisoryText,
  buildFarmerSchemeProfile,
  buildSchemeDetails,
  buildSchemeListRows,
  buildSchemeSearchRows,
  currentAdvisories,
  filterSchemesByCategory,
  filterSchemesByGovernment,
  findScheme,
  parseSchemeAction,
  readSchemeInterests,
  relevantSchemes,
  saveSchemeInterest,
  searchAdvisories,
  searchSchemes
} = require("./utils/schemes");
const {
  FARM_ALERT_ACTION_IDS,
  LAND_SHEET: FARM_LAND_SHEET,
  NOTIFICATION_SHEET: FARM_NOTIFICATION_SHEET,
  buildAlertDetail,
  buildAlertRows,
  buildCropSelectionRows,
  buildLandSelectionRows,
  buildMyAlerts,
  buildOperationConfirmation,
  cropsForLand,
  findAlert,
  parseFarmAlertAction,
  parseOperationInput,
  readFarmerLands,
  readNotificationRecords,
  saveFarmOperation,
  selectedOperationDate,
  updateFarmOperation,
  validateOperationDate
} = require("./utils/farmAlerts");
const {
  CROP_FARM_ACTION_IDS,
  CROP_FARM_PREFIXES,
  CROP_HISTORY_SHEET,
  CROP_SHEET,
  OPERATION_SHEET,
  OPERATION_TYPES,
  VERIFIED_ALERT_SHEET,
  appendCropStatus,
  buildMyFarmAlerts,
  cropRowsForOperation,
  cropRowsForStatus,
  formatCropSummary,
  formatFarmAlerts,
  formatFarmSummary,
  formatOperationSummary,
  isCurrentCrop,
  landRowsForAction,
  latestCropStates,
  operationTypeRows,
  ownedLand,
  parseCropFarmAction,
  parseCropFarmNaturalLanguage,
  parseCropRegistrationDetails,
  parseCropStatusDetails,
  parseOperationDetails,
  readCropHistory,
  readCrops,
  readFarmOperations,
  recordFarmOperation,
  registerCrop,
  relevantOperations
} = require("./utils/cropFarmRecords");
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

app.use(express.json({ verify: captureRawBody }));
app.use(soilTestRoute);

function requireSatelliteDiagnosticAccess(
  req,
  res,
  next
) {
  const access = getSatelliteDiagnosticAccess({
    nodeEnv: process.env.NODE_ENV,
    enabled:
      process.env.ENABLE_SATELLITE_DIAGNOSTICS,
    expectedToken:
      process.env.SATELLITE_DIAGNOSTIC_TOKEN,
    providedToken:
      req.get("x-bhoomimitra-diagnostic-token")
  });

  if (!access.allowed) {
    return res.sendStatus(access.status);
  }

  return next();
}

app.get(
  "/test-copernicus",
  requireSatelliteDiagnosticAccess,
  async (req, res) => {
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
    logSafeError("Copernicus test error.", error);

    res.status(500).json({
      success: false,
      message: "Copernicus authentication test failed."
    });
  }
  }
);
app.get(
  "/test-sentinel2",
  requireSatelliteDiagnosticAccess,
  async (req, res) => {
  try {
    const diagnosticLand =
      getSatelliteDiagnosticLandConfig(
        process.env
      );

    if (!diagnosticLand.ready) {
      return res.status(503).json({
        success: false,
        message: "Approved diagnostic land identity is not configured."
      });
    }

    const landResult =
      await getLandBoundaryMapData({
        sheets,
        spreadsheetId:
          GOOGLE_SHEET_ID,
        landId:
          diagnosticLand.landId,
        farmerId:
          diagnosticLand.farmerId,
        whatsapp:
          diagnosticLand.whatsapp
      });

    if (
      !landResult ||
      !landResult.success
    ) {
      return res.status(400).json({
        success: false,
        message: "Land boundary could not be loaded."
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
    logSafeError("Sentinel-2 test error.", error);

    res.status(500).json({
      success: false,
      message: "Sentinel-2 test failed."
    });
  }
  }
);
app.get(
  "/test-sentinel2-ndvi",
  requireSatelliteDiagnosticAccess,
  async (req, res) => {
  try {
    const diagnosticLand =
      getSatelliteDiagnosticLandConfig(
        process.env
      );

    if (!diagnosticLand.ready) {
      return res.status(503).json({
        success: false,
        message: "Approved diagnostic land identity is not configured."
      });
    }

    const landResult =
      await getLandBoundaryMapData({
        sheets,
        spreadsheetId:
          GOOGLE_SHEET_ID,
        landId:
          diagnosticLand.landId,
        farmerId:
          diagnosticLand.farmerId,
        whatsapp:
          diagnosticLand.whatsapp
      });

    if (
      !landResult ||
      !landResult.success
    ) {
      return res.status(400).json({
        success: false,
        message: "Land boundary could not be loaded."
      });
    }

    const ndviResult =
      await getSentinel2Ndvi({
        geometry:
          landResult.geoJSON
      });
    res.json({
      success: true,
      landId:
        landResult.landId,
      farmName:
        landResult.farmName,
     ndvi:
  ndviResult,

readOnly: true
    });
  } catch (error) {
    logSafeError("Sentinel-2 NDVI test error.", error);

    res.status(500).json({
      success: false,
      message: "Sentinel-2 NDVI test failed."
    });
  }
  }
);
const PORT = process.env.PORT || 10000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const META_APP_SECRET =
  process.env.META_APP_SECRET ||
  process.env.APP_SECRET ||
  "";
const LAND_MAP_ACCESS_SECRET =
  process.env.LAND_MAP_ACCESS_SECRET ||
  META_APP_SECRET;
const WHATSAPP_MESSAGE_STATE_FILE =
  process.env.WHATSAPP_MESSAGE_STATE_FILE ||
  path.join(
    process.cwd(),
    ".runtime",
    "whatsapp-message-state.json"
  );
const WHATS_NEW_STATE_FILE = path.join(
  path.dirname(WHATSAPP_MESSAGE_STATE_FILE),
  "whats-new-state.json"
);

const durableStateConfig = resolveStateConfiguration(process.env);
const durableStateRedis = durableStateConfig.configured
  ? createRedisRestClient(durableStateConfig)
  : null;

const webhookMessageLedger = durableStateRedis
  ? createRedisMessageLedger({
    redis: durableStateRedis,
    hmacSecret: durableStateConfig.hmacSecret
  })
  : createMessageLedger({
    filePath: WHATSAPP_MESSAGE_STATE_FILE,
    ttlMs: process.env.WHATSAPP_MESSAGE_DEDUP_TTL_MS,
    maxCompleted:
      process.env.WHATSAPP_MESSAGE_DEDUP_MAX_COMPLETED
  });

const photoAnalysisQuota = durableStateRedis
  ? createRedisPhotoQuota({
    redis: durableStateRedis,
    hmacSecret: durableStateConfig.hmacSecret
  })
  : createMemoryPhotoQuota();

function logSafeError(context, error, metadata) {
  console.error(
    context,
    Object.assign({}, metadata || {}, {
      error: safeErrorDetails(error)
    })
  );
}

const bhoomiMitraUI =
  createBhoomiMitraUI({
    axios: axios,
    phoneNumberId: PHONE_NUMBER_ID,
    whatsappToken: WHATSAPP_TOKEN,
    welcomeMediaUrl:
      process.env.BHOOMIMITRA_WELCOME_MEDIA_URL,
    welcomeMediaType:
      process.env.BHOOMIMITRA_WELCOME_MEDIA_TYPE,
    policyUrl:
      process.env.BHOOMIMITRA_POLICY_URL,
    organisationContact:
      process.env.BHOOMIMITRA_ORGANISATION_CONTACT
  });

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
      await getLandMapDataByAccessToken({
        sheets,
        spreadsheetId:
          GOOGLE_SHEET_ID,
        landId:
          requestedLandId,
        accessToken:
          req.query.access,
        secret:
          LAND_MAP_ACCESS_SECRET
      });

    if (
      !mapResult ||
      !mapResult.success
    ) {
      return res
        .status(
          mapResult && mapResult.accessDenied
            ? 403
            : 404
        )
        .send(
          "<h2>Land map not available</h2>"
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
    logSafeError("Land map page error.", error);

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
const recentExpertProblems = {};
const expertAdviceSessions = {};
const trainingRequestSessions = {};
const schemeSearchSessions = {};
const farmAlertSessions = {};
const cropFarmSessions = {};
const animalHusbandrySessions = {};
const whatsNewSelections = {};
const featureDiscovery = durableStateRedis
  ? createRedisFeatureDiscovery({
    redis: durableStateRedis,
    hmacSecret: durableStateConfig.hmacSecret
  })
  : createFeatureDiscovery({
    filePath: WHATS_NEW_STATE_FILE
  });
const registrationCoordinator =
  createRegistrationCoordinator();
let sheetMetadataCache = null;
let sheetMetadataCacheTime = 0;

const SHEET_METADATA_CACHE_MS =
  10 * 60 * 1000;
const EXPERT_PROBLEM_CONTEXT_MS =
  6 * 60 * 60 * 1000;

async function resolveCurrentUserRegistration(from) {
  return resolveUserRegistrationStatus({
    sender: from,
    readSheetRows,
    hasRegistrationSession: Boolean(sessions[from])
  });
}

function hasRegisteredFarmerAccess(status) {
  return Boolean(
    status &&
    status.state === USER_REGISTRATION_STATES.REGISTERED_FARMER &&
    status.canAccessPersonalRecords
  );
}

function isFarmerOnlyAction(selectionId) {
  const id = String(selectionId || "").trim();
  return Boolean(
    ["HOME_FARM", "HOME_PROFILE", "SERVICE_9", "SERVICE_10"].includes(id) ||
    id.startsWith("PERSONAL_") ||
    id.startsWith("LAND_") ||
    id.startsWith("SAT_GPS_") ||
    id.startsWith("CROP_FARM_") ||
    id.startsWith("FARM_ALERTS_") ||
    id.startsWith("ANIMAL_")
  );
}

async function sendStatusAwareHome(from, language, status, includeNotice) {
  const access = status || await resolveCurrentUserRegistration(from);
  const selectedLanguage = language || userLanguagePreferences[from] || "Malayalam";

  if (access.state === USER_REGISTRATION_STATES.REGISTERED_SERVICE_MEMBER) {
    await bhoomiMitraUI.sendServiceMemberMenu(
      from,
      selectedLanguage,
      access.roles
    );
    return access;
  }

  if (isLimitedAccessState(access)) {
    if (includeNotice) {
      await sendWhatsAppMessage(
        from,
        formatRestrictedAccess(access, selectedLanguage),
        { skipPreferredLanguageConversion: true }
      );
    }
    await bhoomiMitraUI.sendGuestMenu(from, selectedLanguage, access);
    return access;
  }

  await bhoomiMitraUI.sendMainMenu(from, selectedLanguage);
  return access;
}

async function showWhatsNew(from, language, explicit) {
  const feature = explicit
    ? featureDiscovery.firstAvailable({ userCategory: "FARMER" })
    : await featureDiscovery.claim(from, { userCategory: "FARMER" });

  if (feature) {
    whatsNewSelections[from] = feature;
  } else if (!explicit) {
    return false;
  }

  try {
    await bhoomiMitraUI.sendWhatsNewAnnouncement(
      from,
      language,
      feature,
      Boolean(explicit)
    );
  } catch (error) {
    if (!explicit && feature) {
      try {
        await featureDiscovery.releaseClaim(from, feature.id);
      } catch (releaseError) {
        logSafeError("Feature announcement claim release failed.", releaseError);
      }
    }
    throw error;
  }

  if (feature) {
    await featureDiscovery.markShown(from, feature.id);
  }

  return Boolean(feature);
}

async function claimPhotoAnalysis(from, messageId) {
  const access = await resolveCurrentUserRegistration(from);
  const language = userLanguagePreferences[from] || "Malayalam";

  if (!hasRegisteredFarmerAccess(access)) {
    await sendStatusAwareHome(
      from,
      language,
      access,
      isLimitedAccessState(access)
    );
    return { allowed: false, code: "FARMER_REGISTRATION_REQUIRED" };
  }

  const farmerId = access.farmer && (access.farmer.id || access.farmer.memberId) || "";
  try {
    const claim = await photoAnalysisQuota.claim(farmerId, messageId);
    if (claim.accepted) {
      return {
        allowed: true,
        farmerId,
        messageId,
        token: claim.token,
        dayKey: claim.dayKey
      };
    }

    if (claim.code === "LIMIT_REACHED") {
      await sendWhatsAppMessage(from, photoLimitMessage(language), {
        skipPreferredLanguageConversion: true
      });
    } else if (claim.code === "IN_FLIGHT") {
      await sendWhatsAppMessage(
        from,
        language === "Malayalam"
          ? "ഈ ഫോട്ടോ ഇതിനകം വിശകലനം ചെയ്യുന്നു. ദയവായി കാത്തിരിക്കുക."
          : "This photo is already being analysed. Please wait.",
        { skipPreferredLanguageConversion: true }
      );
    }
    return { allowed: false, code: claim.code };
  } catch (error) {
    logSafeError("Photo quota check failed.", error);
    await sendWhatsAppMessage(from, photoQuotaUnavailableMessage(language), {
      skipPreferredLanguageConversion: true
    });
    return { allowed: false, code: "PHOTO_QUOTA_UNAVAILABLE" };
  }
}

async function settlePhotoAnalysis(claim, accepted) {
  if (!claim || !claim.allowed) return;
  if (accepted) {
    const result = await photoAnalysisQuota.complete(
      claim.farmerId,
      claim.messageId,
      claim.token,
      claim.dayKey
    );
    if (!result.success) {
      const error = new Error("The photo quota claim could not be completed.");
      error.code = "PHOTO_QUOTA_LEASE_LOST";
      throw error;
    }
    return;
  }

  try {
    await photoAnalysisQuota.release(
      claim.farmerId,
      claim.messageId,
      claim.token,
      claim.dayKey
    );
  } catch (error) {
    logSafeError("Photo quota claim release failed.", error);
  }
}

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

const aiSheetLogger = createAiSheetLogger({
  readSheetRows,
  appendSafe,
  sheets: SHEETS,
  model: OPENAI_MODEL
});

const SYSTEM_PROMPT = [
  "You are BhoomiMitra, Kerala's Agriculture and Allied Sector AI Assistant, developed by IlumiVision.",

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
  res.status(200).send("BhoomiMitra AI Server v" + SERVER_VERSION + " is running.");
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
function expertAdviceLanguage(from) {
  return userLanguagePreferences[from] === "Malayalam"
    ? "Malayalam"
    : "English";
}

function expertProblemPrompt(language) {
  return language === "Malayalam"
    ? "നിങ്ങളുടെ വിള/മൃഗ പ്രശ്നം വിവരിക്കുക. ടൈപ്പ് ചെയ്യാം, ശബ്ദസന്ദേശമോ ഫോട്ടോയോ അയയ്ക്കാം."
    : "Please describe your crop/animal problem. You may type, speak, or send a photo.";
}

async function resolveExpertAdviceLanguage(from) {
  const remembered = expertAdviceLanguage(from);

  if (userLanguagePreferences[from]) {
    return remembered;
  }

  try {
    const profile = await findRegistrationByPhone("farmer", from);
    const preferred = profile && profile.preferredLanguage;

    if (preferred === "Malayalam" || preferred === "English") {
      userLanguagePreferences[from] = preferred;
      return preferred;
    }
  } catch (error) {
    logSafeError(
      "Farmer language lookup failed during expert workflow.",
      error
    );
  }

  return remembered;
}

async function loadFarmerExpertCases(from, openOnly) {
  const rows = await readSheetRows("Expert_Cases", "A:AD");
  return findFarmerCases(rows, from, openOnly);
}

async function sendFarmerExpertCaseView(from, language, record) {
  return bhoomiMitraUI.sendExpertAssignmentCard(
    from,
    language,
    buildFarmerCaseView(record, language)
  );
}

async function beginFarmerExpertCaseAction(options) {
  const input = options || {};
  const from = input.from;
  const language = await resolveExpertAdviceLanguage(from);
  const isFollowUp = input.action === "FOLLOW_UP";
  const cases = await loadFarmerExpertCases(from, isFollowUp);

  if (cases.length === 0) {
    await sendWhatsAppMessage(
      from,
      language === "Malayalam"
        ? (
            isFollowUp
              ? "തുടർ ചോദ്യം അയയ്ക്കാൻ തുറന്ന വിദഗ്ധ കേസ് ഇല്ല."
              : "വിദഗ്ധ കേസ് കണ്ടെത്താനായില്ല."
          )
        : (
            isFollowUp
              ? "There is no open expert case for a follow-up."
              : "No expert case was found."
          )
    );
    return true;
  }

  if (cases.length > 1) {
    await bhoomiMitraUI.sendExpertCaseList(
      from,
      language,
      input.action,
      buildExpertCaseSelectionRows(cases, input.action)
    );
    return true;
  }

  if (isFollowUp) {
    expertAdviceSessions[from] = {
      step: "awaiting_follow_up",
      caseId: cases[0].caseId,
      updatedAt: Date.now()
    };
    await sendWhatsAppMessage(
      from,
      buildFarmerFollowUpPrompt(language)
    );
    return true;
  }

  await sendFarmerExpertCaseView(from, language, cases[0]);
  return true;
}

async function handleExpertCaseSelection(options) {
  const input = options || {};
  const from = input.from;
  const selection = input.selection;
  const language = await resolveExpertAdviceLanguage(from);
  const openOnly = selection.action === "FOLLOW_UP_CASE";
  const cases = await loadFarmerExpertCases(from, openOnly);
  const selectedCase = cases.find(function (record) {
    return record.caseId.toUpperCase() === selection.caseId.toUpperCase();
  });

  if (!selectedCase) {
    await sendWhatsAppMessage(
      from,
      language === "Malayalam"
        ? "ഈ വിദഗ്ധ കേസ് ലഭ്യമല്ല."
        : "That expert case is not available."
    );
    return true;
  }

  if (selection.action === "FOLLOW_UP_CASE") {
    expertAdviceSessions[from] = {
      step: "awaiting_follow_up",
      caseId: selectedCase.caseId,
      updatedAt: Date.now()
    };
    await sendWhatsAppMessage(
      from,
      buildFarmerFollowUpPrompt(language)
    );
    return true;
  }

  await sendFarmerExpertCaseView(from, language, selectedCase);
  return true;
}

async function assignClickFirstExpertCase(options) {
  const input = options || {};
  const from = input.from;
  const session = input.session || {};
  let farmerProfile = null;

  try {
    farmerProfile = await findRegistrationByPhone(
      "farmer",
      from
    );
  } catch (profileError) {
    logSafeError(
      "Farmer profile lookup failed during click-first expert escalation.",
      profileError
    );
  }

  return assignExpertCase({
    caseData: {
      sourceMessageId: input.sourceMessageId,
      from: from,
      whatsapp: from,
      farmerId:
        farmerProfile && farmerProfile.memberId
          ? farmerProfile.memberId
          : "",
      farmerName:
        farmerProfile && farmerProfile.name
          ? farmerProfile.name
          : "",
      district:
        farmerProfile && farmerProfile.district
          ? farmerProfile.district
          : "",
      panchayath:
        farmerProfile && farmerProfile.panchayath
          ? farmerProfile.panchayath
          : "",
      crop: session.crop || "",
      problem: session.problem,
      farmerMessage: session.problem,
      caseSummary: "",
      aiDiagnosis: session.aiReply || "",
      aiConfidence: 60,
      priority: "High",
      imageIds: Array.isArray(session.mediaIds)
        ? session.mediaIds.join(", ")
        : "",
      mediaAvailable: Boolean(
        Array.isArray(session.mediaIds) &&
        session.mediaIds.length > 0
      ),
      source: "WhatsApp",
      expertRequested: true,
      escalationReason:
        "Farmer confirmed click-first expert assistance"
    },
    readSheetRows: readSheetRows,
    appendRow: function (sheetName, row) {
      return appendSafe(
        sheetName,
        row,
        { returnDetails: true }
      );
    },
    updateCase: updateExpertCaseByHeaders,
    sendExpertMessage: sendWhatsAppMessage
  });
}

async function handleExpertAdviceAction(options) {
  const input = options || {};
  const action = input.action;
  const from = input.from;
  const language = expertAdviceLanguage(from);
  let session = expertAdviceSessions[from];

  if (action === "START") {
    expertAdviceSessions[from] = {
      step: "choose_mode",
      updatedAt: Date.now()
    };
    await bhoomiMitraUI.sendExpertAdviceChoice(
      from,
      language
    );
    return true;
  }

  if (
    action === "AI_FIRST" ||
    action === "DIRECT" ||
    action === "ASK_ANOTHER"
  ) {
    expertAdviceSessions[from] = {
      step: "awaiting_problem",
      mode: action === "DIRECT"
        ? "direct"
        : "ai_first",
      updatedAt: Date.now()
    };
    await sendWhatsAppMessage(
      from,
      expertProblemPrompt(language)
    );
    return true;
  }

  if (action === "MAIN_MENU") {
    delete expertAdviceSessions[from];
    await bhoomiMitraUI.sendMainMenu(from, language);
    return true;
  }

  if (action === "FOLLOW_UP") {
    return beginFarmerExpertCaseAction({
      action: "FOLLOW_UP",
      from: from,
      language: language
    });
  }

  if (action === "VIEW_CASE") {
    return beginFarmerExpertCaseAction({
      action: "VIEW_CASE",
      from: from,
      language: language
    });
  }

  if (!session) {
    await sendWhatsAppMessage(
      from,
      language === "Malayalam"
        ? "സജീവമായ വിദഗ്ധ അഭ്യർത്ഥന കണ്ടെത്താനായില്ല. വിദഗ്ധ സഹായം വീണ്ടും തിരഞ്ഞെടുക്കുക."
        : "No active expert request was found. Please choose Expert Advice again."
    );
    return true;
  }

  if (action === "CONFIRM_NO") {
    if (session.recentProblemTimestamp !== undefined) {
      consumeRecentExpertProblem(
        recentExpertProblems,
        from,
        session.recentProblemTimestamp
      );
    }
    session.step = "completed_without_expert";
    session.problem = "";
    session.updatedAt = Date.now();
    await bhoomiMitraUI.sendExpertDeclinedMenu(
      from,
      language
    );
    return true;
  }

  if (action === "CONFIRM_YES") {
    if (!shouldCreateExpertCase(action, session)) {
      await sendWhatsAppMessage(
        from,
        expertProblemPrompt(language)
      );
      return true;
    }

    session.step = "assigning";
    session.updatedAt = Date.now();

    let assignmentResult;
    try {
      assignmentResult = await assignClickFirstExpertCase({
        from: from,
        sourceMessageId: input.sourceMessageId,
        session: session
      });
    } catch (assignmentError) {
      assignmentResult = {
        success: false,
        error: assignmentError && assignmentError.message
          ? assignmentError.message
          : String(assignmentError || "Expert assignment failed."),
        farmerMessage:
          "We could not complete your expert request right now. Please try again shortly."
      };
    }

    if (!assignmentResult.success) {
      session.step = "awaiting_confirmation";
      session.updatedAt = Date.now();
      await sendWhatsAppMessage(
        from,
        assignmentResult.farmerMessage ||
          "Your expert request is awaiting assignment."
      );
      return true;
    }

    const card = buildFarmerAssignmentCard(
      assignmentResult,
      {
        problem: session.problem,
        category: session.category,
        crop: session.crop,
        language: language
      }
    );

    session.step = "assigned";
    session.caseId = assignmentResult.caseId;
    session.expert = assignmentResult.expert;
    session.card = card;
    session.updatedAt = Date.now();

    if (session.recentProblemTimestamp !== undefined) {
      consumeRecentExpertProblem(
        recentExpertProblems,
        from,
        session.recentProblemTimestamp
      );
    }

    await bhoomiMitraUI.sendExpertAssignmentCard(
      from,
      language,
      card.text
    );
    return true;
  }

  return false;
}

async function sendTrainingHome(from, language) {
  await bhoomiMitraUI.sendTrainingMenu(from, language);
  await bhoomiMitraUI.sendTrainingRequestShortcuts(from, language);
}

async function completeTrainingRequestInput(from, value, inputType) {
  const session = trainingRequestSessions[from];

  if (!session) return false;

  const language = session.language || "English";
  const isMalayalam = language === "Malayalam";
  let captured;

  if (isTrainingRequestCancellation(value)) {
    delete trainingRequestSessions[from];
    await sendWhatsAppMessage(
      from,
      isMalayalam
        ? "പരിശീലന അഭ്യർത്ഥന റദ്ദാക്കി. ഒന്നും സമർപ്പിച്ചിട്ടില്ല."
        : "Training request cancelled. Nothing was submitted."
    );
    await sendTrainingHome(from, language);
    return true;
  }

  if (session.step === "awaiting_request") {
    captured = captureTrainingRequest(session, value, inputType, new Date());
    if (!captured.success) {
      await bhoomiMitraUI.sendTrainingRequestPrompt(from, language);
      return true;
    }
    trainingRequestSessions[from] = captured.session;
    await bhoomiMitraUI.sendTrainingModePreference(from, language);
    return true;
  }

  if (session.step === "awaiting_location") {
    captured = captureTrainingRequestLocation(session, value, new Date());
    if (!captured.success) return false;
    trainingRequestSessions[from] = captured.session;
    await bhoomiMitraUI.sendTrainingRequestConfirmation(
      from,
      language,
      captured.session.topic,
      captured.session.mode,
      captured.session.preferredTime,
      captured.session.preferredLocation,
      captured.session.preferredDate,
      captured.session.remarks
    );
    return true;
  }

  if (session.step === "awaiting_date") {
    captured = captureTrainingRequestDate(session, value, new Date());
    if (!captured.success) return false;
    trainingRequestSessions[from] = captured.session;
    if (captured.session.step === "awaiting_location") {
      await bhoomiMitraUI.sendTrainingLocationPrompt(from, language);
    } else {
      await bhoomiMitraUI.sendTrainingRequestConfirmation(
        from,
        language,
        captured.session.topic,
        captured.session.mode,
        captured.session.preferredTime,
        captured.session.preferredLocation,
        captured.session.preferredDate,
        captured.session.remarks
      );
    }
    return true;
  }

  return false;
}

async function handleTrainingAction(options) {
  const input = options || {};
  const action = input.trainingAction || {};
  const from = input.from;
  const language = await resolveExpertAdviceLanguage(from);
  const isMalayalam = language === "Malayalam";

  if (action.action === "OPEN") {
    delete trainingRequestSessions[from];
    await sendTrainingHome(from, language);
    return true;
  }

  if (action.action === "MAIN_MENU") {
    delete trainingRequestSessions[from];
    await bhoomiMitraUI.sendMainMenu(from, language);
    return true;
  }

  if (action.action === "INFORMATION") {
    delete trainingRequestSessions[from];
    await bhoomiMitraUI.sendTrainingInformation(from, language);
    return true;
  }

  if (action.action === "REQUEST_START") {
    const farmer = await findRegistrationByPhone("farmer", from);

    if (!farmer || !farmer.memberId) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "പരിശീലനം ആവശ്യപ്പെടാൻ ആദ്യം BhoomiMitra കർഷക രജിസ്ട്രേഷൻ പൂർത്തിയാക്കുക."
          : "Please complete BhoomiMitra farmer registration before requesting a training."
      );
      await bhoomiMitraUI.sendProfileMenu(from, language);
      return true;
    }

    trainingRequestSessions[from] = createTrainingRequestSession(
      farmer,
      language,
      new Date()
    );
    await bhoomiMitraUI.sendTrainingRequestPrompt(from, language);
    return true;
  }

  if (action.action === "REQUEST_MODE") {
    const session = trainingRequestSessions[from];
    const selected = selectTrainingRequestMode(
      session,
      action.mode,
      new Date()
    );

    if (!selected.success) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "ഈ പരിശീലന അഭ്യർത്ഥനയുടെ സമയം കഴിഞ്ഞു. ദയവായി പുതിയ അഭ്യർത്ഥന ആരംഭിക്കുക."
          : "That training request has expired. Please start a new request."
      );
      await bhoomiMitraUI.sendTrainingRequestShortcuts(from, language);
      return true;
    }

    trainingRequestSessions[from] = selected.session;

    if (selected.session.step === "awaiting_time") {
      await bhoomiMitraUI.sendTrainingTimePreference(from, language);
    } else {
      await bhoomiMitraUI.sendTrainingDateChoice(from, language);
    }
    return true;
  }

  if (action.action === "REQUEST_TIME") {
    const session = trainingRequestSessions[from];
    const selected = selectTrainingRequestTime(
      session,
      action.preferredTime,
      new Date()
    );

    if (!selected.success) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "ഈ ഓൺലൈൻ പരിശീലന സമയ തിരഞ്ഞെടുപ്പിന്റെ സമയം കഴിഞ്ഞു. വീണ്ടും പരിശീലനം അഭ്യർത്ഥിക്കുക."
          : "That online training time selection has expired. Please request the training again."
      );
      await bhoomiMitraUI.sendTrainingRequestShortcuts(from, language);
      return true;
    }

    trainingRequestSessions[from] = selected.session;
    await bhoomiMitraUI.sendTrainingDateChoice(from, language);
    return true;
  }

  if (action.action === "REQUEST_DATE_CHOICE") {
    const session = trainingRequestSessions[from];
    const selected = selectTrainingRequestDateChoice(
      session,
      action.dateChoice,
      new Date()
    );

    if (!selected.success) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "ഈ തീയതി തിരഞ്ഞെടുപ്പിന്റെ സമയം കഴിഞ്ഞു. വീണ്ടും പരിശീലനം അഭ്യർത്ഥിക്കുക."
          : "That date selection has expired. Please request the training again."
      );
      await bhoomiMitraUI.sendTrainingRequestShortcuts(from, language);
      return true;
    }

    trainingRequestSessions[from] = selected.session;
    if (selected.session.step === "awaiting_date") {
      await bhoomiMitraUI.sendTrainingDatePrompt(from, language);
    } else if (selected.session.step === "awaiting_location") {
      await bhoomiMitraUI.sendTrainingLocationPrompt(from, language);
    } else {
      await bhoomiMitraUI.sendTrainingRequestConfirmation(
        from,
        language,
        selected.session.topic,
        selected.session.mode,
        selected.session.preferredTime,
        selected.session.preferredLocation,
        selected.session.preferredDate,
        selected.session.remarks
      );
    }
    return true;
  }

  if (action.action === "REQUEST_CHANGE") {
    const session = trainingRequestSessions[from];

    if (!session || session.step !== "awaiting_confirmation") {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "ഈ പരിശീലന അഭ്യർത്ഥനയുടെ സമയം കഴിഞ്ഞു. ദയവായി പുതിയ അഭ്യർത്ഥന ആരംഭിക്കുക."
          : "That training request has expired. Please start a new request."
      );
      await bhoomiMitraUI.sendTrainingRequestShortcuts(from, language);
      return true;
    }

    trainingRequestSessions[from] = changeTrainingRequest(
      session,
      new Date()
    );
    await bhoomiMitraUI.sendTrainingRequestPrompt(from, language);
    return true;
  }

  if (action.action === "REQUEST_CANCEL") {
    delete trainingRequestSessions[from];
    await sendWhatsAppMessage(
      from,
      isMalayalam
        ? "പരിശീലന അഭ്യർത്ഥന റദ്ദാക്കി. ഒന്നും സമർപ്പിച്ചിട്ടില്ല."
        : "Training request cancelled. Nothing was submitted."
    );
    await sendTrainingHome(from, language);
    return true;
  }

  if (action.action === "REQUEST_SUBMIT") {
    const session = trainingRequestSessions[from];

    if (
      !session ||
      session.step !== "awaiting_confirmation" ||
      !session.topic
    ) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "ഈ പരിശീലന അഭ്യർത്ഥനയുടെ സമയം കഴിഞ്ഞു. ദയവായി പുതിയ അഭ്യർത്ഥന ആരംഭിക്കുക."
          : "That training request has expired. Please start a new request."
      );
      await bhoomiMitraUI.sendTrainingRequestShortcuts(from, language);
      return true;
    }

    const farmer = await findRegistrationByPhone("farmer", from);

    if (!farmer || !farmer.memberId) {
      delete trainingRequestSessions[from];
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "കർഷക രജിസ്ട്രേഷൻ കണ്ടെത്താനായില്ല. അഭ്യർത്ഥന സമർപ്പിച്ചിട്ടില്ല."
          : "Your farmer registration could not be verified. The request was not submitted."
      );
      return true;
    }

    const requestRows = await readSheetRows(
      TRAINING_REQUEST_SHEET,
      "A:AZ"
    );

    if (!requestRows || !requestRows[0]) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "പരിശീലന അഭ്യർത്ഥന ഇപ്പോൾ സമർപ്പിക്കാനായില്ല. ദയവായി പിന്നീട് വീണ്ടും ശ്രമിക്കുക."
          : "The training request could not be submitted right now. Please try again later."
      );
      return true;
    }

    const requestResult = await submitTrainingRequest({
      farmer: farmer,
      farmerWhatsApp: from,
      topic: session.topic,
      mode: session.mode,
      preferredTime: session.preferredTime,
      preferredLocation: session.preferredLocation,
      preferredDate: session.preferredDate,
      remarks: session.remarks,
      language: language,
      sourceMessageId: input.sourceMessageId,
      requestRows: requestRows,
      now: new Date(),
      appendRegistration: function (sheetName, row) {
        return appendSafe(sheetName, row, { returnDetails: true });
      }
    });

    if (!requestResult.success) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "പരിശീലന അഭ്യർത്ഥന സേവ് ചെയ്യാനായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക."
          : "The training request could not be saved. Please try again."
      );
      return true;
    }

    const trainingAlertResult = await sendTrainingRequestAlertForSubmission({
      requestResult: requestResult,
      destination: process.env.KVK_TRAINING_ALERT_WHATSAPP,
      farmer: farmer,
      sendAlert: function (to, text) {
        return sendWhatsAppMessage(to, text, {
          skipPreferredLanguageConversion: true
        });
      }
    });

    if (
      trainingAlertResult.code === "ALERT_FAILED" &&
      trainingAlertResult.error
    ) {
      logSafeError(
        "Training coordinator notification failed.",
        trainingAlertResult.error
      );
    }

    delete trainingRequestSessions[from];

    await bhoomiMitraUI.sendTrainingRequestSubmitted(
      from,
      language,
      requestResult.topic,
      requestResult.requestId
    );
    return true;
  }

  if (action.action === "MY_REQUESTS") {
    delete trainingRequestSessions[from];
    const farmer = await findRegistrationByPhone("farmer", from);

    if (!farmer || !farmer.memberId) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "എന്റെ പരിശീലന അഭ്യർത്ഥനകൾ കാണാൻ ആദ്യം കർഷക രജിസ്ട്രേഷൻ പൂർത്തിയാക്കുക."
          : "Please complete farmer registration to view My Training Requests."
      );
      await bhoomiMitraUI.sendProfileMenu(from, language);
      return true;
    }

    const requestRows = await readSheetRows(
      TRAINING_REQUEST_SHEET,
      "A:AZ"
    );

    if (!requestRows || !requestRows[0]) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "നിങ്ങളുടെ പരിശീലന അഭ്യർത്ഥനകൾ ഇപ്പോൾ ലഭ്യമല്ല."
          : "Your training requests are temporarily unavailable."
      );
      return true;
    }

    const requests = readTrainingRequests(
      requestRows,
      farmer.memberId
    );

    if (requests.length === 0) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "നിങ്ങൾ ഇതുവരെ പരിശീലനമൊന്നും ആവശ്യപ്പെട്ടിട്ടില്ല."
          : "You have not submitted any training requests yet."
      );
      await bhoomiMitraUI.sendTrainingRequestShortcuts(from, language);
      return true;
    }

    await bhoomiMitraUI.sendMyTrainingRequests(
      from,
      language,
      requests
    );
    return true;
  }

  if (action.action === "PROMOTED") {
    delete trainingRequestSessions[from];
    const programRows = await readSheetRows(
      TRAINING_PROGRAM_SHEET,
      "A:Z"
    );

    if (!programRows || !programRows[0]) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "ജനപ്രിയ പരിശീലന വിവരങ്ങൾ ഇപ്പോൾ ലഭ്യമല്ല."
          : "Popular training information is temporarily unavailable."
      );
      return true;
    }

    const promoted = getPromotedTrainingPrograms(
      readTrainingPrograms(programRows),
      new Date(),
      5
    );

    if (promoted.length === 0) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "വരാനിരിക്കുന്ന ജനപ്രിയ പരിശീലനങ്ങളൊന്നും ഇപ്പോൾ പ്രസിദ്ധീകരിച്ചിട്ടില്ല."
          : "No upcoming popular trainings are currently published."
      );
      await sendTrainingHome(from, language);
      return true;
    }

    await bhoomiMitraUI.sendPromotedTrainingList(
      from,
      language,
      buildPromotedTrainingListRows(promoted, language, { now: new Date() })
    );
    return true;
  }

  if (action.action === "PROMOTED_VIEW") {
    delete trainingRequestSessions[from];
    const programRows = await readSheetRows(
      TRAINING_PROGRAM_SHEET,
      "A:Z"
    );
    const program = programRows && programRows[0]
      ? findTrainingProgram(programRows, action.programId)
      : null;

    if (!program) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "ഈ പരിശീലന പരിപാടി കണ്ടെത്താനായില്ല."
          : "That training programme is no longer available."
      );
      return true;
    }

    const promotedDetails = buildPromotedTrainingDetails(
      program,
      language,
      { now: new Date() }
    );
    await bhoomiMitraUI.sendPromotedTrainingCard(
      from,
      language,
      promotedDetails.text,
      program.id,
      promotedDetails.canRegister
    );
    return true;
  }

  if (action.action === "LIST") {
    delete trainingRequestSessions[from];
    const programRows = await readSheetRows(
      TRAINING_PROGRAM_SHEET,
      "A:Z"
    );

    if (!programRows || !programRows[0]) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "പരിശീലന വിവരങ്ങൾ ഇപ്പോൾ ലഭ്യമല്ല. ദയവായി പിന്നീട് വീണ്ടും ശ്രമിക്കുക."
          : "Training information is temporarily unavailable. Please try again later."
      );
      return true;
    }

    const programs = filterTrainingPrograms(
      readTrainingPrograms(programRows),
      action.filter,
      new Date()
    );

    if (programs.length === 0) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "ഈ വിഭാഗത്തിൽ വരാനിരിക്കുന്ന പരിശീലനങ്ങളൊന്നും ഇപ്പോൾ പ്രസിദ്ധീകരിച്ചിട്ടില്ല."
          : "No upcoming trainings are currently published in this category."
      );
      await sendTrainingHome(from, language);
      return true;
    }

    await bhoomiMitraUI.sendTrainingProgramList(
      from,
      language,
      buildTrainingListRows(programs, language),
      false
    );
    return true;
  }

  if (action.action === "VIEW") {
    delete trainingRequestSessions[from];
    const programRows = await readSheetRows(
      TRAINING_PROGRAM_SHEET,
      "A:Z"
    );
    const program = programRows && programRows[0]
      ? findTrainingProgram(programRows, action.programId)
      : null;

    if (!program) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "ഈ പരിശീലന പരിപാടി കണ്ടെത്താനായില്ല."
          : "That training programme is no longer available."
      );
      return true;
    }

    const details = buildTrainingDetails(
      program,
      language,
      { now: new Date() }
    );
    await bhoomiMitraUI.sendTrainingDetails(
      from,
      language,
      details.text,
      program.id,
      details.canRegister
    );
    return true;
  }

  if (action.action === "REGISTER") {
    delete trainingRequestSessions[from];
    const farmer = await findRegistrationByPhone("farmer", from);

    if (!farmer || !farmer.memberId) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "പരിശീലനത്തിന് രജിസ്റ്റർ ചെയ്യാൻ ആദ്യം BhoomiMitra കർഷക രജിസ്ട്രേഷൻ പൂർത്തിയാക്കുക."
          : "Please complete BhoomiMitra farmer registration before registering for training."
      );
      await bhoomiMitraUI.sendProfileMenu(from, language);
      return true;
    }

    const results = await Promise.all([
      readSheetRows(TRAINING_PROGRAM_SHEET, "A:Z"),
      readSheetRows(TRAINING_REGISTRATION_SHEET, "A:AD")
    ]);

    if (
      !results[0] ||
      !results[0][0] ||
      !results[1] ||
      !results[1][0]
    ) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "പരിശീലന രജിസ്ട്രേഷൻ ഇപ്പോൾ ലഭ്യമല്ല. ദയവായി പിന്നീട് വീണ്ടും ശ്രമിക്കുക."
          : "Training registration is temporarily unavailable. Please try again later."
      );
      return true;
    }

    const registrationResult = await registerFarmerForTraining({
      programId: action.programId,
      programRows: results[0],
      registrationRows: results[1],
      farmer: farmer,
      farmerWhatsApp: from,
      now: new Date(),
      appendRegistration: function (sheetName, row) {
        return appendSafe(
          sheetName,
          row,
          { returnDetails: true }
        );
      }
    });

    if (registrationResult.success) {
      await bhoomiMitraUI.sendTrainingRegistrationConfirmation(
        from,
        language,
        registrationResult.program,
        registrationResult.duplicate
      );
      return true;
    }

    const unavailable = [
      "CLOSED",
      "FULL",
      "DEADLINE_PASSED",
      "PAST"
    ].includes(registrationResult.code);
    await sendWhatsAppMessage(
      from,
      isMalayalam
        ? (
            unavailable
              ? "ഈ പരിശീലനത്തിനുള്ള രജിസ്ട്രേഷൻ അടച്ചിരിക്കുന്നു അല്ലെങ്കിൽ സീറ്റുകൾ നിറഞ്ഞു."
              : "പരിശീലന രജിസ്ട്രേഷൻ പൂർത്തിയാക്കാനായില്ല. ദയവായി പിന്നീട് വീണ്ടും ശ്രമിക്കുക."
          )
        : (
            unavailable
              ? "Registration for this training is closed or full."
              : "Training registration could not be completed. Please try again later."
          )
    );
    return true;
  }

  if (action.action === "MY_TRAININGS") {
    delete trainingRequestSessions[from];
    const farmer = await findRegistrationByPhone("farmer", from);

    if (!farmer || !farmer.memberId) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "എന്റെ പരിശീലനങ്ങൾ കാണാൻ ആദ്യം കർഷക രജിസ്ട്രേഷൻ പൂർത്തിയാക്കുക."
          : "Please complete farmer registration to view My Trainings."
      );
      await bhoomiMitraUI.sendProfileMenu(from, language);
      return true;
    }

    const results = await Promise.all([
      readSheetRows(TRAINING_PROGRAM_SHEET, "A:Z"),
      readSheetRows(TRAINING_REGISTRATION_SHEET, "A:AD")
    ]);

    if (
      !results[0] ||
      !results[0][0] ||
      !results[1] ||
      !results[1][0]
    ) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "പരിശീലന ചരിത്രം ഇപ്പോൾ ലഭ്യമല്ല."
          : "Your training history is temporarily unavailable."
      );
      return true;
    }

    const registrations = getMyTrainings(
      results[0],
      results[1],
      farmer.memberId
    );

    if (registrations.length === 0) {
      await sendWhatsAppMessage(
        from,
        isMalayalam
          ? "നിങ്ങൾ ഇതുവരെ പരിശീലന പരിപാടികളിൽ രജിസ്റ്റർ ചെയ്തിട്ടില്ല."
          : "You have not registered for any training programmes yet."
      );
      await sendTrainingHome(from, language);
      return true;
    }

    await bhoomiMitraUI.sendTrainingProgramList(
      from,
      language,
      buildTrainingListRows(
        registrations,
        language,
        { myTrainings: true }
      ),
      true
    );
    return true;
  }

  return false;
}

async function loadFarmerSchemeProfile(farmer) {
  if (!farmer || !farmer.memberId) return farmer || {};

  const contextRows = await Promise.all([
    readSheetRows(SCHEME_LAND_SHEET, "A:AZ"),
    readSheetRows(SCHEME_ANIMAL_SHEET, "A:AZ")
  ]);

  return buildFarmerSchemeProfile(
    farmer,
    contextRows[0] || [],
    contextRows[1] || []
  );
}

async function handleSchemeAction(options) {
  const input = options || {};
  const action = input.schemeAction || {};
  const from = input.from;
  const language = await resolveExpertAdviceLanguage(from);
  const ml = language === "Malayalam";

  if (action.action === "OPEN") {
    delete schemeSearchSessions[from];
    await bhoomiMitraUI.sendSchemesMenu(from, language);
    return true;
  }

  if (action.action === "MAIN_MENU") {
    delete schemeSearchSessions[from];
    await bhoomiMitraUI.sendMainMenu(from, language);
    return true;
  }

  if (action.action === "MORE_CATEGORIES") {
    delete schemeSearchSessions[from];
    await bhoomiMitraUI.sendSchemeMoreMenu(from, language);
    return true;
  }

  if (action.action === "APPLICATION_GUIDANCE") {
    delete schemeSearchSessions[from];
    await bhoomiMitraUI.sendSchemeApplicationGuidance(from, language);
    return true;
  }

  if (action.action === "SEARCH") {
    schemeSearchSessions[from] = {
      step: "awaiting_query",
      language: language,
      updatedAt: Date.now()
    };
    await bhoomiMitraUI.sendSchemeSearchPrompt(from, language);
    return true;
  }

  if (action.action === "RELEVANT") {
    delete schemeSearchSessions[from];
    const farmer = await findRegistrationByPhone("farmer", from);

    if (!farmer || !farmer.memberId) {
      await sendWhatsAppMessage(
        from,
        ml
          ? "നിങ്ങൾക്ക് പ്രസക്തമായ പദ്ധതികൾ കണ്ടെത്താൻ ആദ്യം കർഷക രജിസ്ട്രേഷൻ പൂർത്തിയാക്കുക."
          : "Please complete farmer registration so BhoomiMitra can find potentially relevant schemes."
      );
      await bhoomiMitraUI.sendProfileMenu(from, language);
      return true;
    }

    const relevantData = await Promise.all([
      readSheetRows(SCHEME_CATALOG_SHEET, "A:Z"),
      loadFarmerSchemeProfile(farmer)
    ]);
    const rows = relevantData[0];
    if (!rows || !rows[0]) {
      await sendWhatsAppMessage(
        from,
        ml ? "പദ്ധതി വിവരങ്ങൾ ഇപ്പോൾ ലഭ്യമല്ല." : "Scheme information is temporarily unavailable."
      );
      return true;
    }

    const matches = relevantSchemes(
      activeSchemes(rows, new Date()),
      relevantData[1]
    );
    if (matches.length === 0) {
      await sendWhatsAppMessage(
        from,
        ml
          ? "നിങ്ങളുടെ വിവരങ്ങളുമായി പൊരുത്തപ്പെടുന്ന സജീവ പദ്ധതികളൊന്നും നിലവിലെ രേഖകളിൽ കണ്ടെത്തിയില്ല. യോഗ്യത ഉറപ്പാക്കാൻ KVK അല്ലെങ്കിൽ ബന്ധപ്പെട്ട വകുപ്പുമായി പരിശോധിക്കുക."
          : "No active schemes matching your stored profile were found in the current records. Check with KVK or the relevant department to verify available support."
      );
      await bhoomiMitraUI.sendSchemesMenu(from, language);
      return true;
    }

    await bhoomiMitraUI.sendSchemeList(
      from,
      language,
      buildSchemeListRows(matches, language),
      true
    );
    return true;
  }

  if (action.action === "LIST") {
    delete schemeSearchSessions[from];
    const rows = await readSheetRows(SCHEME_CATALOG_SHEET, "A:Z");
    if (!rows || !rows[0]) {
      await sendWhatsAppMessage(
        from,
        ml ? "പദ്ധതി വിവരങ്ങൾ ഇപ്പോൾ ലഭ്യമല്ല." : "Scheme information is temporarily unavailable."
      );
      return true;
    }
    const matches = filterSchemesByCategory(
      activeSchemes(rows, new Date()),
      action.category
    );
    if (matches.length === 0) {
      await sendWhatsAppMessage(
        from,
        ml
          ? "ഈ വിഭാഗത്തിൽ നിലവിൽ സജീവമായ പദ്ധതികളൊന്നും പ്രസിദ്ധീകരിച്ചിട്ടില്ല."
          : "No active schemes are currently published in this category."
      );
      await bhoomiMitraUI.sendSchemesMenu(from, language);
      return true;
    }
    await bhoomiMitraUI.sendSchemeList(
      from,
      language,
      buildSchemeListRows(matches, language),
      false
    );
    return true;
  }

  if (action.action === "GOVERNMENT") {
    delete schemeSearchSessions[from];
    const rows = await readSheetRows(SCHEME_CATALOG_SHEET, "A:Z");
    if (!rows || !rows[0]) {
      await sendWhatsAppMessage(
        from,
        ml ? "പദ്ധതി വിവരങ്ങൾ ഇപ്പോൾ ലഭ്യമല്ല." : "Scheme information is temporarily unavailable."
      );
      return true;
    }
    const matches = filterSchemesByGovernment(
      activeSchemes(rows, new Date()),
      action.level
    );
    if (matches.length === 0) {
      await sendWhatsAppMessage(
        from,
        ml
          ? "ഈ സർക്കാർ വിഭാഗത്തിൽ പരിശോധിച്ച സജീവ പദ്ധതികളൊന്നും നിലവിലെ രേഖകളിൽ ലഭ്യമല്ല."
          : "No verified active schemes are available in the current records for that government level."
      );
      await bhoomiMitraUI.sendSchemesMenu(from, language);
      return true;
    }
    await bhoomiMitraUI.sendSchemeList(
      from,
      language,
      buildSchemeListRows(matches, language),
      false
    );
    return true;
  }

  if (action.action === "VIEW" || action.action === "MORE") {
    delete schemeSearchSessions[from];
    const rows = await readSheetRows(SCHEME_CATALOG_SHEET, "A:Z");
    const scheme = rows && rows[0] ? findScheme(rows, action.schemeId) : null;
    const active = scheme && activeSchemes(rows, new Date()).some(function (record) {
      return record.id.toUpperCase() === scheme.id.toUpperCase();
    });
    if (!scheme || !active) {
      await sendWhatsAppMessage(
        from,
        ml
          ? "ഈ പദ്ധതി സജീവമായ നിലവിലെ രേഖകളിൽ ലഭ്യമല്ല."
          : "That scheme is not available in the current active records."
      );
      return true;
    }
    await bhoomiMitraUI.sendSchemeDetails(
      from,
      language,
      buildSchemeDetails(
        scheme,
        language,
        action.action === "MORE",
        { now: new Date() }
      ),
      scheme.id,
      action.action === "MORE"
    );
    return true;
  }

  if (action.action === "ADVISORY_VIEW") {
    delete schemeSearchSessions[from];
    const farmer = await findRegistrationByPhone("farmer", from);
    const results = await Promise.all([
      readSheetRows(ADVISORY_SHEET, "A:X"),
      loadFarmerSchemeProfile(farmer)
    ]);
    const advisories = results[0] && results[0][0]
      ? currentAdvisories(results[0], results[1], new Date(), 14)
      : [];
    const advisory = advisories.find(function (record) {
      return record.id.toUpperCase() === String(action.schemeId || "").toUpperCase();
    });

    if (!advisory) {
      await sendWhatsAppMessage(
        from,
        ml
          ? "ഈ അറിയിപ്പ് നിലവിലെ സജീവ രേഖകളിൽ ലഭ്യമല്ല."
          : "That advisory is not available in the current active records."
      );
      return true;
    }

    await bhoomiMitraUI.sendSchemeAdvisories(
      from,
      language,
      buildAdvisoryText([advisory], language)
    );
    return true;
  }

  if (action.action === "INTEREST" || action.action === "HELP") {
    delete schemeSearchSessions[from];
    const farmer = await findRegistrationByPhone("farmer", from);
    if (!farmer || !farmer.memberId) {
      await sendWhatsAppMessage(
        from,
        ml
          ? "പദ്ധതി താൽപര്യം രേഖപ്പെടുത്താൻ ആദ്യം കർഷക രജിസ്ട്രേഷൻ പൂർത്തിയാക്കുക."
          : "Please complete farmer registration before recording scheme interest."
      );
      await bhoomiMitraUI.sendProfileMenu(from, language);
      return true;
    }
    const results = await Promise.all([
      readSheetRows(SCHEME_CATALOG_SHEET, "A:Z"),
      readSheetRows(SCHEME_REQUEST_SHEET, "A:AD")
    ]);
    const scheme = results[0] && results[0][0]
      ? findScheme(results[0], action.schemeId)
      : null;
    const active = scheme && activeSchemes(results[0], new Date()).some(function (record) {
      return record.id.toUpperCase() === scheme.id.toUpperCase();
    });
    if (!scheme || !active || !results[1] || !results[1][0]) {
      await sendWhatsAppMessage(
        from,
        ml
          ? "ഈ പദ്ധതി അഭ്യർത്ഥന ഇപ്പോൾ രേഖപ്പെടുത്താനായില്ല."
          : "This scheme request could not be recorded right now."
      );
      return true;
    }
    const result = await saveSchemeInterest({
      farmer: farmer,
      farmerWhatsApp: from,
      scheme: scheme,
      helpRequested: action.action === "HELP",
      language: language,
      sourceMessageId: input.sourceMessageId,
      requestRows: results[1],
      now: new Date(),
      appendRequest: function (sheetName, row) {
        return appendSafe(sheetName, row, { returnDetails: true });
      }
    });
    if (!result.success) {
      await sendWhatsAppMessage(
        from,
        ml ? "പദ്ധതി അഭ്യർത്ഥന സേവ് ചെയ്യാനായില്ല." : "The scheme request could not be saved."
      );
      return true;
    }
    await bhoomiMitraUI.sendSchemeInterestConfirmation(
      from,
      language,
      scheme,
      result.status,
      result.duplicate
    );
    return true;
  }

  if (action.action === "MY_INTERESTS") {
    delete schemeSearchSessions[from];
    const farmer = await findRegistrationByPhone("farmer", from);
    if (!farmer || !farmer.memberId) {
      await sendWhatsAppMessage(
        from,
        ml
          ? "എന്റെ പദ്ധതി താൽപര്യങ്ങൾ കാണാൻ ആദ്യം കർഷക രജിസ്ട്രേഷൻ പൂർത്തിയാക്കുക."
          : "Please complete farmer registration to view My Scheme Interests."
      );
      await bhoomiMitraUI.sendProfileMenu(from, language);
      return true;
    }
    const rows = await readSheetRows(SCHEME_REQUEST_SHEET, "A:AD");
    if (!rows || !rows[0]) {
      await sendWhatsAppMessage(
        from,
        ml ? "പദ്ധതി താൽപര്യ ചരിത്രം ഇപ്പോൾ ലഭ്യമല്ല." : "Scheme-interest history is temporarily unavailable."
      );
      return true;
    }
    const interests = readSchemeInterests(rows, farmer.memberId);
    if (interests.length === 0) {
      await sendWhatsAppMessage(
        from,
        ml ? "നിങ്ങൾ ഇതുവരെ പദ്ധതി താൽപര്യം രേഖപ്പെടുത്തിയിട്ടില്ല." : "You have not recorded any scheme interests yet."
      );
      await bhoomiMitraUI.sendSchemesMenu(from, language);
      return true;
    }
    await bhoomiMitraUI.sendMySchemeInterests(from, language, interests);
    return true;
  }

  if (action.action === "ADVISORIES") {
    delete schemeSearchSessions[from];
    const farmer = await findRegistrationByPhone("farmer", from);
    const advisoryData = await Promise.all([
      readSheetRows(ADVISORY_SHEET, "A:X"),
      loadFarmerSchemeProfile(farmer)
    ]);
    const rows = advisoryData[0];
    if (!rows || !rows[0]) {
      await sendWhatsAppMessage(
        from,
        ml ? "കാർഷിക അറിയിപ്പുകൾ ഇപ്പോൾ ലഭ്യമല്ല." : "Agricultural advisories are temporarily unavailable."
      );
      return true;
    }
    const advisories = currentAdvisories(
      rows,
      advisoryData[1],
      new Date(),
      14
    );
    if (advisories.length === 0) {
      await sendWhatsAppMessage(
        from,
        ml
          ? "നിലവിലെ രേഖകളിൽ പുതിയ സജീവ കാർഷിക അറിയിപ്പുകളൊന്നുമില്ല. പഴയ അറിയിപ്പുകൾ നിലവിലുള്ളതായി കാണിക്കുന്നില്ല."
          : "There are no recent active agricultural advisories in the current records. Older advisories are not shown as current."
      );
      await bhoomiMitraUI.sendSchemesMenu(from, language);
      return true;
    }
    await bhoomiMitraUI.sendSchemeAdvisories(
      from,
      language,
      buildAdvisoryText(advisories, language)
    );
    return true;
  }

  return false;
}

async function completeSchemeSearch(from, query, language) {
  const ml = language === "Malayalam";
  const searchText = String(query || "").trim().slice(0, 300);
  if (!searchText) {
    await bhoomiMitraUI.sendSchemeSearchPrompt(from, language);
    return true;
  }
  const farmer = await findRegistrationByPhone("farmer", from);
  const searchData = await Promise.all([
    readSheetRows(SCHEME_CATALOG_SHEET, "A:Z"),
    readSheetRows(ADVISORY_SHEET, "A:X"),
    loadFarmerSchemeProfile(farmer)
  ]);
  const schemeRows = searchData[0];
  const advisoryRows = searchData[1];
  if (
    (!schemeRows || !schemeRows[0]) &&
    (!advisoryRows || !advisoryRows[0])
  ) {
    await sendWhatsAppMessage(
      from,
      ml
        ? "പദ്ധതി, അറിയിപ്പ് വിവരങ്ങൾ ഇപ്പോൾ ലഭ്യമല്ല."
        : "Scheme and advisory information is temporarily unavailable."
    );
    return true;
  }
  const now = new Date();
  const schemeMatches = searchSchemes(
    activeSchemes(schemeRows || [], now),
    searchText
  );
  const advisoryMatches = searchAdvisories(
    currentAdvisories(advisoryRows || [], searchData[2], now, 14),
    searchText
  );
  const resultRows = buildSchemeSearchRows(
    schemeMatches,
    advisoryMatches,
    language
  );
  delete schemeSearchSessions[from];
  if (resultRows.length === 0) {
    await sendWhatsAppMessage(
      from,
      ml
        ? "ഈ വിഷയവുമായി പൊരുത്തപ്പെടുന്ന സജീവ പദ്ധതികളോ നിലവിലെ അറിയിപ്പുകളോ കണ്ടെത്തിയില്ല."
        : "No active schemes or current advisories matching that topic were found."
    );
    await bhoomiMitraUI.sendSchemesMenu(from, language);
    return true;
  }
  await bhoomiMitraUI.sendSchemeSearchResults(
    from,
    language,
    resultRows
  );
  return true;
}

async function loadFarmAlertContext(from) {
  const farmer = await findRegistrationByPhone("farmer", from);
  if (!farmer || !farmer.memberId) return { farmer: null };
  const results = await Promise.all([
    readSheetRows(FARM_LAND_SHEET, "A:AS"),
    readSheetRows(FARM_NOTIFICATION_SHEET, "A:J")
  ]);
  const landRows = results[0] || [];
  const notificationRows = results[1] || [];
  const lands = readFarmerLands(landRows, farmer.memberId);
  const records = readNotificationRecords(notificationRows, farmer.memberId);
  const alerts = buildMyAlerts(records, lands, new Date());
  return {
    farmer: farmer,
    landRows: landRows,
    notificationRows: notificationRows,
    lands: lands,
    records: records,
    alerts: alerts
  };
}

async function updateNotificationLogRow(rowNumber, row) {
  try {
    if (!Number.isInteger(Number(rowNumber)) || Number(rowNumber) < 2) return false;
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: "'" + FARM_NOTIFICATION_SHEET + "'!A" + Number(rowNumber) + ":J" + Number(rowNumber),
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] }
    });
    return true;
  } catch (error) {
    logSafeError("Farm alert update error.", error);
    return false;
  }
}

async function sendCurrentFarmAlerts(from, language, context) {
  const data = context || await loadFarmAlertContext(from);
  if (!data.farmer) {
    await sendWhatsAppMessage(
      from,
      "വളപ്രയോഗ ഡയറിയും ഓർമ്മപ്പെടുത്തലും ഉപയോഗിക്കാൻ ആദ്യം BhoomiMitra കർഷക രജിസ്ട്രേഷൻ പൂർത്തിയാക്കുക.\n\nPlease complete BhoomiMitra farmer registration before using the fertilizer diary and reminders."
    );
    await bhoomiMitraUI.sendProfileMenu(from, language);
    return true;
  }
  if (!data.landRows || !data.notificationRows) {
    await sendWhatsAppMessage(
      from,
      "വളപ്രയോഗ രേഖകൾ ഇപ്പോൾ വായിക്കാനായില്ല.\n\nFertilizer records are temporarily unavailable."
    );
    return true;
  }
  await bhoomiMitraUI.sendFarmAlertList(
    from,
    language,
    buildAlertRows(data.alerts),
    data.lands.length === 0
        ? "നിങ്ങളുടെ Farmer ID-യുമായി ബന്ധിപ്പിച്ച കൃഷിയിടം കണ്ടെത്തിയില്ല. ഉടമസ്ഥത പരിശോധിച്ച് Land_Parcels-ലെ Farmer_ID കൈമാറി ചേർക്കണം; BhoomiMitra ഇത് സ്വയം അനുമാനിക്കില്ല.\n\nNo farm is linked to your Farmer ID. Ownership must be manually verified before Land_Parcels.Farmer_ID is filled; BhoomiMitra will not infer it."
        : "ആസൂത്രണം ചെയ്ത വളപ്രയോഗങ്ങളില്ല.\n\nThere are no planned fertilizer applications."
  );
  return true;
}

function farmAlertResultText(result, language) {
  if (!result || !result.success) {
    return "വളപ്രയോഗ രേഖ പുതുക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുക.\n\nThe fertilizer entry could not be updated. Please try again.";
  }
  return "✅ വളപ്രയോഗം പൂർത്തിയായതായി രേഖപ്പെടുത്തി.\n\n✅ Fertilizer application marked as completed.";
}

async function handleFarmAlertAction(options) {
  const input = options || {};
  const action = input.farmAlertAction || {};
  const from = input.from;
  const language = await resolveExpertAdviceLanguage(from);

  if (action.action === "OPEN") {
    delete farmAlertSessions[from];
    await bhoomiMitraUI.sendFarmAlertsMenu(from, language);
    return true;
  }
  if (action.action === "MAIN_MENU") {
    delete farmAlertSessions[from];
    await bhoomiMitraUI.sendMainMenu(from, language);
    return true;
  }
  if (action.action === "FARM_MENU") {
    delete farmAlertSessions[from];
    await bhoomiMitraUI.sendFarmMenu(from, language);
    return true;
  }

  const context = await loadFarmAlertContext(from);
  if (!context.farmer) return sendCurrentFarmAlerts(from, language, context);

  if (action.action === "ACTIVE") {
    delete farmAlertSessions[from];
    return sendCurrentFarmAlerts(from, language, context);
  }

  if (action.action === "HISTORY") {
    delete farmAlertSessions[from];
    const completed = context.alerts.completed.slice(-5).reverse();
    const lines = ["📖 വളപ്രയോഗ ഡയറി", "Fertilizer application diary"];
    completed.forEach(function (record) {
      lines.push("", "✅ " + [record.farmName, record.crop, record.dueDate].filter(Boolean).join(" • "));
    });
    if (completed.length === 0) {
      lines.push("", "പൂർത്തിയായ വളപ്രയോഗങ്ങൾ രേഖപ്പെടുത്തിയിട്ടില്ല.\nNo completed fertilizer applications are recorded yet.");
    }
    await bhoomiMitraUI.sendFarmAlertHistory(from, language, lines.join("\n"));
    return true;
  }

  if (action.action === "ADD" || action.action === "PLAN") {
    if (!context.lands.length) {
      await sendWhatsAppMessage(
        from,
        "ഉടമസ്ഥത പരിശോധിച്ച് Land_Parcels-ലെ Farmer_ID കൈമാറി ചേർത്ത ശേഷമേ ഈ സൗകര്യം ഉപയോഗിക്കാനാകൂ. BhoomiMitra ഉടമസ്ഥത സ്വയം അനുമാനിക്കില്ല.\n\nThis feature requires a manually verified Farmer_ID in Land_Parcels. BhoomiMitra will not infer ownership."
      );
      await bhoomiMitraUI.sendLandManagementMenu(from, language);
      return true;
    }
    farmAlertSessions[from] = {
      step: "choose_land",
      language: language,
      status: action.action === "PLAN" ? "Planned" : "Completed",
      reminderOptIn: action.action === "PLAN",
      updatedAt: Date.now()
    };
    await bhoomiMitraUI.sendFarmAlertLandList(from, language, buildLandSelectionRows(context.lands));
    return true;
  }

  if (action.action === "LAND") {
    const session = farmAlertSessions[from];
    if (!session || session.step !== "choose_land") {
      await bhoomiMitraUI.sendFarmAlertsMenu(from, language);
      return true;
    }
    const land = context.lands.find(function (candidate) { return candidate.landId === action.landId; });
    if (!land) {
      await sendWhatsAppMessage(from, "ആ കൃഷിയിടം നിങ്ങളുടെ സജീവ രേഖകളിൽ കണ്ടെത്തിയില്ല.\n\nThat farm was not found in your active records.");
      return true;
    }
    const cropRows = buildCropSelectionRows(land);
    if (!cropRows.length) {
      await sendWhatsAppMessage(from, "ഈ കൃഷിയിടത്തിൽ രജിസ്റ്റർ ചെയ്ത വിള കണ്ടെത്തിയില്ല. ആദ്യം ഭൂമി രേഖയിലെ വിള പരിശോധിക്കുക.\n\nNo registered crop was found for this farm. Verify the crop in the land record first.");
      return true;
    }
    session.land = land;
    session.step = "choose_crop";
    session.updatedAt = Date.now();
    await bhoomiMitraUI.sendFarmCropList(from, language, cropRows);
    return true;
  }

  if (action.action === "CROP") {
    const session = farmAlertSessions[from];
    if (!session || session.step !== "choose_crop" || !session.land) {
      await bhoomiMitraUI.sendFarmAlertsMenu(from, language);
      return true;
    }
    const crop = cropsForLand(session.land).find(function (candidate) {
      return candidate.toLowerCase() === String(action.crop || "").toLowerCase();
    });
    if (!crop) {
      await sendWhatsAppMessage(from, "ഈ വിള തിരഞ്ഞെടുത്ത കൃഷിയിടത്തിന്റെ രേഖയിൽ ഇല്ല.\n\nThat crop is not registered for the selected farm.");
      return true;
    }
    session.crop = crop;
    session.step = "choose_date";
    session.updatedAt = Date.now();
    await bhoomiMitraUI.sendFarmOperationDateChoices(from, language, session.status);
    return true;
  }

  if (["DATE_TODAY", "DATE_YESTERDAY", "DATE_TOMORROW", "DATE_IN_TWO_DAYS"].includes(action.action)) {
    const session = farmAlertSessions[from];
    if (!session || session.step !== "choose_date" || !session.land || !session.crop) {
      await bhoomiMitraUI.sendFarmAlertsMenu(from, language);
      return true;
    }
    const operationDate = selectedOperationDate(action.action, new Date());
    if (!validateOperationDate(session.status, operationDate, new Date())) {
      await bhoomiMitraUI.sendFarmOperationDateChoices(from, language, session.status);
      return true;
    }
    session.operationDate = operationDate;
    session.step = "confirm";
    session.updatedAt = Date.now();
    await bhoomiMitraUI.sendFarmOperationConfirmation(from, language, buildOperationConfirmation(session));
    return true;
  }

  if (action.action === "DATE_CHOOSE") {
    const session = farmAlertSessions[from];
    if (!session || session.step !== "choose_date") {
      await bhoomiMitraUI.sendFarmAlertsMenu(from, language);
      return true;
    }
    session.step = "awaiting_operation_date";
    session.updatedAt = Date.now();
    await bhoomiMitraUI.sendFarmOperationPrompt(from, language, session.status);
    return true;
  }

  if (action.action === "CHANGE") {
    const session = farmAlertSessions[from];
    if (!session) return false;
    farmAlertSessions[from] = {
      step: "choose_land",
      language: language,
      status: session.status,
      reminderOptIn: session.reminderOptIn === true,
      updatedAt: Date.now()
    };
    await bhoomiMitraUI.sendFarmAlertLandList(from, language, buildLandSelectionRows(context.lands));
    return true;
  }

  if (action.action === "CANCEL") {
    delete farmAlertSessions[from];
    await bhoomiMitraUI.sendFarmAlertsMenu(from, language);
    return true;
  }

  if (action.action === "SAVE") {
    const session = farmAlertSessions[from];
    if (!session || session.step !== "confirm") {
      await bhoomiMitraUI.sendFarmAlertsMenu(from, language);
      return true;
    }
    const ownedLand = context.lands.find(function (land) {
      return land.landId === session.land.landId && land.farmerId === context.farmer.memberId;
    });
    const result = await saveFarmOperation({
      farmer: context.farmer,
      land: ownedLand || {},
      crop: session.crop,
      status: session.status,
      operationDate: session.operationDate,
      reminderOptIn: session.reminderOptIn === true,
      notificationRows: context.notificationRows,
      readNotificationRows: function () { return readSheetRows(FARM_NOTIFICATION_SHEET, "A:J"); },
      now: new Date(),
      appendNotification: function (sheetName, row) { return appendSafe(sheetName, row); }
    });
    if (!result.success) {
      await sendWhatsAppMessage(from, "വളപ്രയോഗ രേഖ സേവ് ചെയ്യാനായില്ല. ഉടമസ്ഥത, വിള, തീയതി എന്നിവ പരിശോധിക്കുക.\n\nThe fertilizer entry could not be saved. Check ownership, crop and date.");
      return true;
    }
    delete farmAlertSessions[from];
    const resultText = result.duplicate
      ? "ഇതേ വളപ്രയോഗ രേഖ ഇതിനകം ഉണ്ട്.\n\nThe same fertilizer entry already exists."
      : session.status === "Planned"
        ? "✅ വളപ്രയോഗം ആസൂത്രണം ചെയ്തു. തീയതിക്ക് 2 ദിവസം മുമ്പ് അംഗീകൃത WhatsApp ടെംപ്ലേറ്റ് ലഭ്യമെങ്കിൽ ഒരൊറ്റ ഓർമ്മപ്പെടുത്തൽ അയയ്ക്കും.\n\n✅ Fertilizer application planned. One reminder will be sent 2 days before only when an approved WhatsApp template is available."
        : "✅ വളപ്രയോഗം ഡയറിയിൽ പൂർത്തിയായതായി രേഖപ്പെടുത്തി.\n\n✅ Completed fertilizer application saved to the diary.";
    await bhoomiMitraUI.sendFarmOperationResult(from, language, resultText);
    return true;
  }

  if (action.action === "VIEW") {
    const alert = findAlert(context.alerts, action.alertId);
    if (!alert) {
      await sendWhatsAppMessage(from, "ഈ ഓർമ്മപ്പെടുത്തൽ ഇപ്പോൾ സജീവമല്ല.\n\nThis reminder is no longer active.");
      return sendCurrentFarmAlerts(from, language, context);
    }
    await bhoomiMitraUI.sendFarmAlertDetails(from, language, buildAlertDetail(alert, language), alert);
    return true;
  }

  if (action.action === "DONE") {
    const result = await updateFarmOperation({
      records: context.records,
      lands: context.lands,
      notificationId: action.notificationId,
      farmerId: context.farmer.memberId,
      action: "DONE",
      now: new Date(),
      writeNotification: updateNotificationLogRow
    });
    await bhoomiMitraUI.sendFarmOperationResult(from, language, farmAlertResultText(result, language));
    return true;
  }

  return false;
}

async function completeFarmAlertTextInput(from, userText, sourceMessageId) {
  const session = farmAlertSessions[from];
  if (!session || session.step !== "awaiting_operation_date") return false;
  const language = session.language || "English";
  const parsed = parseOperationInput(userText);
  if (!parsed.success || !validateOperationDate(session.status, parsed.operationDate, new Date())) {
    await bhoomiMitraUI.sendFarmOperationPrompt(from, language, session.status);
    return true;
  }
  session.operationDate = parsed.operationDate;
  session.step = "confirm";
  session.updatedAt = Date.now();
  await bhoomiMitraUI.sendFarmOperationConfirmation(from, language, buildOperationConfirmation(session));
  return true;
}

function cropFarmLanguage(from) {
  return userLanguagePreferences[from] === "Malayalam" ? "Malayalam" : "English";
}

function cropFarmText(language, english, malayalam) {
  return language === "Malayalam" ? malayalam : english;
}

async function loadCropFarmContext(from) {
  const farmerResult = await findRegistrationByPhone("farmer", from, { requireUnique: true });
  const farmer = farmerResult && farmerResult.success && farmerResult.memberId ? farmerResult : null;
  if (!farmer) return { farmer: null, lands: [], crops: [], history: [], operations: [] };
  const values = await Promise.all([
    readSheetRows(FARM_LAND_SHEET, "A:AZ"),
    readSheetRows(CROP_SHEET, "A:Z"),
    readSheetRows(CROP_HISTORY_SHEET, "A:AF"),
    readSheetRows(OPERATION_SHEET, "A:Z"),
    readSheetRows(VERIFIED_ALERT_SHEET, "A:Z")
  ]);
  const landRows = values[0];
  const cropRows = values[1];
  const historyRows = values[2];
  const operationRows = values[3];
  const alertRows = values[4];
  const lands = readFarmerLands(landRows, farmer.memberId);
  const crops = readCrops(cropRows, farmer.memberId).filter(function (crop) {
    return Boolean(ownedLand(lands, farmer.memberId, crop.landId));
  });
  const history = readCropHistory(historyRows, farmer.memberId).filter(function (event) {
    return crops.some(function (crop) {
      return crop.cropId === event.cropId && crop.landId === event.landId;
    });
  });
  const operations = readFarmOperations(operationRows, farmer.memberId);
  return {
    farmer: farmer,
    landRows: landRows,
    cropRows: cropRows,
    historyRows: historyRows,
    operationRows: operationRows,
    alertRows: alertRows,
    lands: lands,
    crops: crops,
    history: history,
    operations: operations
  };
}

async function sendCropFarmUnavailable(from, language, message) {
  await bhoomiMitraUI.sendCropFarmMessage(from, language, message || cropFarmText(
    language,
    "Crop and farm records are temporarily unavailable. The required Google Sheets headers must be added manually before this function can save records.",
    "വിള-കൃഷി രേഖകൾ ഇപ്പോൾ ലഭ്യമല്ല. രേഖകൾ സേവ് ചെയ്യുന്നതിന് മുമ്പ് ആവശ്യമായ Google Sheets തലക്കെട്ടുകൾ മാനുവലായി ചേർക്കണം."
  ));
  return true;
}

async function handleCropFarmAction(options) {
  const input = options || {};
  const action = input.cropFarmAction || {};
  const from = input.from;
  const language = cropFarmLanguage(from);

  if (action.action === "OPEN") {
    delete cropFarmSessions[from];
    await bhoomiMitraUI.sendCropFarmMenu(from, language);
    return true;
  }
  if (action.action === "MAIN_MENU") {
    delete cropFarmSessions[from];
    await bhoomiMitraUI.sendMainMenu(from, language);
    return true;
  }
  if (action.action === "FARM_MENU") {
    delete cropFarmSessions[from];
    await bhoomiMitraUI.sendFarmMenu(from, language);
    return true;
  }
  if (action.action === "FERTILIZER") {
    delete cropFarmSessions[from];
    return handleFarmAlertAction({ farmAlertAction: { action: "OPEN" }, from: from, sourceMessageId: input.sourceMessageId });
  }
  if (action.action === "CANCEL") {
    delete cropFarmSessions[from];
    await bhoomiMitraUI.sendCropFarmMenu(from, language);
    return true;
  }

  const context = await loadCropFarmContext(from);
  if (!context.farmer) {
    await bhoomiMitraUI.sendCropFarmMessage(from, language, cropFarmText(
      language,
      "Please complete BhoomiMitra farmer registration before using crop and farm records.",
      "വിള-കൃഷി രേഖകൾ ഉപയോഗിക്കുന്നതിന് മുമ്പ് BhoomiMitra കർഷക രജിസ്ട്രേഷൻ പൂർത്തിയാക്കുക."
    ));
    return true;
  }

  if (action.action === "UPDATE_LAND") {
    if (!context.landRows || !context.lands.length) {
      return sendCropFarmUnavailable(from, language, cropFarmText(
        language,
        "No active land linked to your verified Farmer ID is available to update.",
        "നിങ്ങളുടെ സ്ഥിരീകരിച്ച Farmer ID-യുമായി ബന്ധിപ്പിച്ച സജീവ ഭൂമി പുതുക്കാൻ ലഭ്യമല്ല."
      ));
    }
    cropFarmSessions[from] = {
      step: "choose_land_update",
      language,
      updatedAt: Date.now()
    };
    await bhoomiMitraUI.sendCropFarmLandList(
      from,
      language,
      landRowsForAction(context.lands, CROP_FARM_PREFIXES.LAND_UPDATE),
      "update"
    );
    return true;
  }

  if (action.action === "LAND_UPDATE") {
    const session = cropFarmSessions[from];
    const land = ownedLand(context.lands, context.farmer.memberId, action.landId);
    if (!session || session.step !== "choose_land_update" || !land) {
      await bhoomiMitraUI.sendCropFarmMenu(from, language);
      return true;
    }
    session.land = land;
    session.step = "awaiting_land_update";
    session.updatedAt = Date.now();
    await sendWhatsAppMessage(from, cropFarmText(
      language,
      "Enter: farm name or - | main crop or - | other crops or -. A dash keeps the existing value. Registered Crop IDs and history are not changed.",
      "നൽകുക: കൃഷിയിടത്തിന്റെ പേര് അല്ലെങ്കിൽ - | പ്രധാന വിള അല്ലെങ്കിൽ - | മറ്റ് വിളകൾ അല്ലെങ്കിൽ -. - നൽകിയാൽ നിലവിലെ വിവരം മാറ്റില്ല. രജിസ്റ്റർ ചെയ്ത Crop ID-കളും ചരിത്രവും മാറില്ല."
    ));
    return true;
  }

  if (action.action === "REGISTER") {
    if (!context.landRows || !context.cropRows) return sendCropFarmUnavailable(from, language);
    if (!context.lands.length) {
      await bhoomiMitraUI.sendCropFarmMessage(from, language, cropFarmText(
        language,
        "No land with a verified Farmer_ID is linked to your account. Crop registration cannot continue.",
        "സ്ഥിരീകരിച്ച Farmer_ID ഉള്ള ഭൂമി നിങ്ങളുടെ അക്കൗണ്ടുമായി ബന്ധിപ്പിച്ചിട്ടില്ല. വിള രജിസ്ട്രേഷൻ തുടരാനാകില്ല."
      ));
      return true;
    }
    cropFarmSessions[from] = {
      step: "choose_crop_land", language: language,
      cropName: String(action.cropName || "").trim(),
      sourceMessageId: input.sourceMessageId || "", updatedAt: Date.now()
    };
    await bhoomiMitraUI.sendCropFarmLandList(
      from, language, landRowsForAction(context.lands, CROP_FARM_PREFIXES.CROP_LAND), "crop"
    );
    return true;
  }

  if (action.action === "CROP_LAND") {
    const session = cropFarmSessions[from];
    const land = ownedLand(context.lands, context.farmer.memberId, action.landId);
    if (!session || session.step !== "choose_crop_land" || !land) {
      await bhoomiMitraUI.sendCropFarmMenu(from, language);
      return true;
    }
    session.land = land;
    session.step = session.cropName ? "awaiting_crop_details" : "awaiting_crop_name";
    session.updatedAt = Date.now();
    await sendWhatsAppMessage(from, session.cropName
      ? cropFarmText(language,
        "Enter: variety or - | planting date YYYY-MM-DD or - | cultivated area | unit | Annual/Perennial/Intercrop/Mixed | crop status | optional remarks",
        "നൽകുക: ഇനം അല്ലെങ്കിൽ - | നടീൽ തീയതി YYYY-MM-DD അല്ലെങ്കിൽ - | കൃഷി വിസ്തീർണം | യൂണിറ്റ് | Annual/Perennial/Intercrop/Mixed | വിള നില | കുറിപ്പ് (ഐച്ഛികം)")
      : cropFarmText(language, "Type the crop name.", "വിളയുടെ പേര് ടൈപ്പ് ചെയ്യുക."));
    return true;
  }

  if (action.action === "MY_CROPS" || action.action === "HISTORY") {
    if (!context.cropRows) return sendCropFarmUnavailable(from, language);
    const states = latestCropStates(context.crops, context.history);
    const view = action.action === "MY_CROPS" ? states.filter(isCurrentCrop) : states;
    const text = formatCropSummary(view, context.lands, context.history, language);
    await bhoomiMitraUI.sendCropFarmMessage(from, language, text);
    return true;
  }

  if (action.action === "UPDATE_STATUS") {
    if (!context.cropRows || !context.historyRows) return sendCropFarmUnavailable(from, language);
    const currentCrops = latestCropStates(context.crops, context.history).filter(isCurrentCrop);
    if (!currentCrops.length) {
      await bhoomiMitraUI.sendCropFarmMessage(from, language, cropFarmText(
        language, "No current registered crop is available for a status update.",
        "നില പുതുക്കാൻ നിലവിലെ രജിസ്റ്റർ ചെയ്ത വിളയില്ല."
      ));
      return true;
    }
    cropFarmSessions[from] = {
      step: "choose_status_crop", language: language,
      sourceMessageId: input.sourceMessageId || "", updatedAt: Date.now()
    };
    await bhoomiMitraUI.sendCropStatusList(from, language, cropRowsForStatus(currentCrops));
    return true;
  }

  if (action.action === "STATUS_CROP") {
    const session = cropFarmSessions[from];
    const selectedCrop = context.crops.find(function (crop) {
      return crop.cropId === action.cropId && Boolean(ownedLand(context.lands, context.farmer.memberId, crop.landId));
    });
    if (!session || session.step !== "choose_status_crop" || !selectedCrop) {
      await bhoomiMitraUI.sendCropFarmMenu(from, language);
      return true;
    }
    session.statusCrop = selectedCrop;
    session.step = "awaiting_crop_status";
    session.updatedAt = Date.now();
    await sendWhatsAppMessage(from, cropFarmText(
      language,
      "Enter: event type (Completed/Harvested/Removed/Replanted) | event date YYYY-MM-DD | new crop status | optional remarks",
      "നൽകുക: സംഭവം (Completed/Harvested/Removed/Replanted) | തീയതി YYYY-MM-DD | പുതിയ വിള നില | കുറിപ്പ് (ഐച്ഛികം)"
    ));
    return true;
  }

  if (action.action === "RECORD_OPERATION") {
    if (!context.landRows || !context.operationRows || !context.cropRows) return sendCropFarmUnavailable(from, language);
    if (!context.lands.length) return sendCropFarmUnavailable(from, language, cropFarmText(
      language, "A verified owned land is required before recording a farm activity.",
      "കൃഷിപ്പണി രേഖപ്പെടുത്തുന്നതിന് മുമ്പ് സ്ഥിരീകരിച്ച സ്വന്തം ഭൂമി ആവശ്യമാണ്."
    ));
    cropFarmSessions[from] = {
      step: "choose_operation_land", language: language,
      sourceMessageId: input.sourceMessageId || "", updatedAt: Date.now()
    };
    await bhoomiMitraUI.sendCropFarmLandList(
      from, language, landRowsForAction(context.lands, CROP_FARM_PREFIXES.OPERATION_LAND), "operation"
    );
    return true;
  }

  if (action.action === "OPERATION_LAND") {
    const session = cropFarmSessions[from];
    const land = ownedLand(context.lands, context.farmer.memberId, action.landId);
    if (!session || session.step !== "choose_operation_land" || !land) {
      await bhoomiMitraUI.sendCropFarmMenu(from, language);
      return true;
    }
    session.land = land;
    session.step = "choose_operation_type";
    session.updatedAt = Date.now();
    await bhoomiMitraUI.sendCropFarmOperationTypes(from, language, operationTypeRows());
    return true;
  }

  if (action.action === "OPERATION_TYPE") {
    const session = cropFarmSessions[from];
    if (!session || session.step !== "choose_operation_type" || !session.land) {
      await bhoomiMitraUI.sendCropFarmMenu(from, language);
      return true;
    }
    if (/fertili[sz]er/i.test(action.operationType)) {
      delete cropFarmSessions[from];
      return handleFarmAlertAction({ farmAlertAction: { action: "OPEN" }, from: from, sourceMessageId: input.sourceMessageId });
    }
    if (action.operationType === "Other") {
      session.step = "awaiting_operation_type_text";
      session.updatedAt = Date.now();
      await sendWhatsAppMessage(from, cropFarmText(
        language,
        "Type the activity: Post-Harvest Operation or Other.",
        "പ്രവർത്തനം ടൈപ്പ് ചെയ്യുക: Post-Harvest Operation അല്ലെങ്കിൽ Other."
      ));
      return true;
    }
    session.operationType = action.operationType;
    session.step = "choose_operation_crop";
    session.updatedAt = Date.now();
    await bhoomiMitraUI.sendCropFarmCropList(from, language, cropRowsForOperation(context.crops, session.land.landId));
    return true;
  }

  if (action.action === "OPERATION_CROP") {
    const session = cropFarmSessions[from];
    if (!session || session.step !== "choose_operation_crop" || !session.land || !session.operationType) {
      await bhoomiMitraUI.sendCropFarmMenu(from, language);
      return true;
    }
    if (action.cropId !== "NONE" && !context.crops.some(function (crop) {
      return crop.cropId === action.cropId && crop.landId === session.land.landId;
    })) {
      await bhoomiMitraUI.sendCropFarmMenu(from, language);
      return true;
    }
    session.cropId = action.cropId === "NONE" ? "" : action.cropId;
    session.step = "awaiting_operation_details";
    session.updatedAt = Date.now();
    await sendWhatsAppMessage(from, cropFarmText(
      language,
      "Enter: operation date YYYY-MM-DD | Completed or Planned | input/material or - | quantity or - | unit or - | cost or - | optional remarks",
      "നൽകുക: പണി തീയതി YYYY-MM-DD | Completed അല്ലെങ്കിൽ Planned | വസ്തു അല്ലെങ്കിൽ - | അളവ് അല്ലെങ്കിൽ - | യൂണിറ്റ് അല്ലെങ്കിൽ - | ചെലവ് അല്ലെങ്കിൽ - | കുറിപ്പ് (ഐച്ഛികം)"
    ));
    return true;
  }

  if (action.action === "SAVE_CROP") {
    const session = cropFarmSessions[from];
    if (!session || session.step !== "confirm_crop" || !session.land || !session.cropDetails) {
      await bhoomiMitraUI.sendCropFarmMenu(from, language);
      return true;
    }
    const currentLand = ownedLand(context.lands, context.farmer.memberId, session.land.landId);
    const result = await registerCrop(Object.assign({}, session.cropDetails, {
      farmerId: context.farmer.memberId, land: currentLand || {}, cropName: session.cropName,
      cropRows: context.cropRows, sourceMessageId: session.sourceMessageId,
      appendRow: function (sheetName, row) { return appendSafe(sheetName, row); }
    }));
    if (result.success) delete cropFarmSessions[from];
    await bhoomiMitraUI.sendCropFarmMessage(from, language, result.success
      ? (result.duplicate
        ? cropFarmText(language, "This crop registration already exists. Crop ID: ", "ഈ വിള രജിസ്ട്രേഷൻ ഇതിനകം നിലവിലുണ്ട്. Crop ID: ") + result.cropId
        : cropFarmText(language, "✅ Crop registered. Crop ID: ", "✅ വിള രജിസ്റ്റർ ചെയ്തു. Crop ID: ") + result.cropId)
      : cropFarmText(language, "The crop was not saved (", "വിള സേവ് ചെയ്തില്ല (") + result.code + ").");
    return true;
  }

  if (action.action === "SAVE_STATUS") {
    const session = cropFarmSessions[from];
    if (!session || session.step !== "confirm_status" || !session.statusCrop || !session.statusDetails) {
      await bhoomiMitraUI.sendCropFarmMenu(from, language);
      return true;
    }
    const result = await appendCropStatus(Object.assign({}, session.statusDetails, {
      farmerId: context.farmer.memberId, cropId: session.statusCrop.cropId,
      crops: context.crops, lands: context.lands, historyRows: context.historyRows,
      sourceMessageId: session.sourceMessageId,
      appendRow: function (sheetName, row) { return appendSafe(sheetName, row); }
    }));
    if (result.success) delete cropFarmSessions[from];
    await bhoomiMitraUI.sendCropFarmMessage(from, language, result.success
      ? (result.duplicate
        ? cropFarmText(language, "This crop status event already exists.", "ഈ വിള നില സംഭവം ഇതിനകം നിലവിലുണ്ട്.")
        : cropFarmText(language, "✅ Crop status history recorded.", "✅ വിള നില ചരിത്രത്തിൽ രേഖപ്പെടുത്തി."))
      : cropFarmText(language, "The crop status was not saved (", "വിള നില സേവ് ചെയ്തില്ല (") + result.code + ").");
    return true;
  }

  if (action.action === "SAVE_OPERATION") {
    const session = cropFarmSessions[from];
    if (!session || session.step !== "confirm_operation" || !session.land || !session.operationDetails) {
      await bhoomiMitraUI.sendCropFarmMenu(from, language);
      return true;
    }
    const currentLand = ownedLand(context.lands, context.farmer.memberId, session.land.landId);
    const result = await recordFarmOperation(Object.assign({}, session.operationDetails, {
      farmerId: context.farmer.memberId, land: currentLand || {}, cropId: session.cropId,
      operationType: session.operationType, crops: context.crops,
      operationRows: context.operationRows, sourceMessageId: session.sourceMessageId,
      appendRow: function (sheetName, row) { return appendSafe(sheetName, row); }
    }));
    if (result.success) delete cropFarmSessions[from];
    await bhoomiMitraUI.sendCropFarmMessage(from, language, result.success
      ? (result.duplicate
        ? cropFarmText(language, "This farm activity already exists. Operation ID: ", "ഈ കൃഷിപ്പണി ഇതിനകം നിലവിലുണ്ട്. Operation ID: ") + result.operationId
        : cropFarmText(language, "✅ Farm activity recorded. Operation ID: ", "✅ കൃഷിപ്പണി രേഖപ്പെടുത്തി. Operation ID: ") + result.operationId)
      : cropFarmText(language, "The farm activity was not saved (", "കൃഷിപ്പണി സേവ് ചെയ്തില്ല (") + result.code + ").");
    return true;
  }

  if (action.action === "SAVE_LAND_UPDATE") {
    const session = cropFarmSessions[from];
    if (!session || session.step !== "confirm_land_update" || !session.land || !session.landUpdateDetails) {
      await bhoomiMitraUI.sendCropFarmMenu(from, language);
      return true;
    }
    const currentLand = ownedLand(context.lands, context.farmer.memberId, session.land.landId);
    if (!currentLand) {
      await sendCropFarmUnavailable(from, language, cropFarmText(
        language,
        "Land ownership could not be verified. No land record was changed.",
        "ഭൂമിയുടെ ഉടമസ്ഥത സ്ഥിരീകരിക്കാൻ കഴിഞ്ഞില്ല. ഭൂമി രേഖയിൽ മാറ്റമൊന്നും വരുത്തിയിട്ടില്ല."
      ));
      return true;
    }
    const result = await updateLandDetails({
      sheets,
      spreadsheetId: GOOGLE_SHEET_ID,
      farmerId: context.farmer.memberId,
      landId: currentLand.landId,
      updates: session.landUpdateDetails
    });
    if (result.success) delete cropFarmSessions[from];
    await bhoomiMitraUI.sendCropFarmMessage(from, language, result.success
      ? (result.noChanges
        ? cropFarmText(language, "The submitted land details already match the saved record.", "നൽകിയ ഭൂമി വിവരങ്ങൾ നിലവിലെ രേഖയുമായി ഇതിനകം പൊരുത്തപ്പെടുന്നു.")
        : cropFarmText(language, "✅ Land details updated. Land ID: ", "✅ ഭൂമി വിവരങ്ങൾ പുതുക്കി. Land ID: ") + currentLand.landId)
      : cropFarmText(language, "The land details were not updated (", "ഭൂമി വിവരങ്ങൾ പുതുക്കിയില്ല (") + (result.code || "UNKNOWN_ERROR") + ").");
    return true;
  }

  if (action.action === "CHANGE") {
    const session = cropFarmSessions[from];
    if (!session) return handleCropFarmAction({ cropFarmAction: { action: "OPEN" }, from: from });
    if (session.landUpdateDetails && session.land) {
      session.step = "awaiting_land_update";
      await sendWhatsAppMessage(from, cropFarmText(
        language,
        "Enter the land details again: farm name or - | main crop or - | other crops or -.",
        "ഭൂമി വിവരങ്ങൾ വീണ്ടും നൽകുക: കൃഷിയിടത്തിന്റെ പേര് അല്ലെങ്കിൽ - | പ്രധാന വിള അല്ലെങ്കിൽ - | മറ്റ് വിളകൾ അല്ലെങ്കിൽ -."
      ));
    } else if (session.statusCrop) {
      session.step = "awaiting_crop_status";
      await sendWhatsAppMessage(from, cropFarmText(language, "Enter the crop status event again.", "വിള നില സംഭവം വീണ്ടും നൽകുക."));
    } else if (session.cropName) {
      session.step = "awaiting_crop_name";
      await sendWhatsAppMessage(from, cropFarmText(language, "Type the crop name again.", "വിളയുടെ പേര് വീണ്ടും ടൈപ്പ് ചെയ്യുക."));
    } else {
      delete cropFarmSessions[from];
      await bhoomiMitraUI.sendCropFarmMenu(from, language);
    }
    return true;
  }

  if (action.action === "ACTIVITIES" || action.action === "PLANNED") {
    if (!context.operationRows) return sendCropFarmUnavailable(from, language);
    const operations = relevantOperations(context.operations, context.lands, context.crops, {
      farmerId: context.farmer.memberId,
      status: action.action === "PLANNED" ? "Planned" : ""
    });
    await bhoomiMitraUI.sendCropFarmMessage(
      from, language, formatOperationSummary(operations, context.lands, context.crops, language)
    );
    return true;
  }

  if (action.action === "FARM_SUMMARY") {
    await bhoomiMitraUI.sendCropFarmMessage(
      from,
      language,
      formatFarmSummary(context.lands, context.crops, context.history, context.operations, language)
    );
    return true;
  }

  if (action.action === "ALERTS") {
    const alerts = buildMyFarmAlerts({
      farmerId: context.farmer.memberId, district: context.farmer.district,
      lands: context.lands, crops: context.crops, operations: context.operations,
      alertRows: context.alertRows, now: new Date()
    });
    const notificationRows = await readSheetRows(FARM_NOTIFICATION_SHEET, "A:J");
    const fertilizerRecords = readNotificationRecords(notificationRows, context.farmer.memberId);
    const fertilizerAlerts = buildMyAlerts(fertilizerRecords, context.lands, new Date());
    alerts.planned = alerts.planned.concat((fertilizerAlerts.due || []).map(function (record) {
      return Object.assign({}, record, {
        operationType: "Fertilizer Application",
        operationDate: record.dueDate
      });
    }));
    await bhoomiMitraUI.sendCropFarmMessage(from, language, formatFarmAlerts(alerts, language));
    return true;
  }
  return false;
}

async function completeCropFarmTextInput(from, userText, sourceMessageId) {
  const session = cropFarmSessions[from];
  if (!session) return false;
  const language = session.language || cropFarmLanguage(from);
  const text = String(userText || "").trim();
  if (/^(cancel|back|menu|റദ്ദാക്കുക|പിന്നോട്ട്|മെനു)$/i.test(text)) {
    delete cropFarmSessions[from];
    await bhoomiMitraUI.sendCropFarmMenu(from, language);
    return true;
  }
  if (session.step === "awaiting_land_update") {
    const parsed = parseLandUpdateDetails(text);
    if (!parsed.success) {
      await sendWhatsAppMessage(from, cropFarmText(
        language,
        "Use exactly: farm name or - | main crop or - | other crops or -. Provide at least one change.",
        "ഇങ്ങനെ കൃത്യമായി നൽകുക: കൃഷിയിടത്തിന്റെ പേര് അല്ലെങ്കിൽ - | പ്രധാന വിള അല്ലെങ്കിൽ - | മറ്റ് വിളകൾ അല്ലെങ്കിൽ -. കുറഞ്ഞത് ഒരു മാറ്റമെങ്കിലും നൽകണം."
      ));
      return true;
    }
    session.landUpdateDetails = parsed.updates;
    session.sourceMessageId = session.sourceMessageId || sourceMessageId;
    session.step = "confirm_land_update";
    session.updatedAt = Date.now();
    await bhoomiMitraUI.sendCropFarmConfirmation(from, language, [
      cropFarmText(language, "Confirm land update", "ഭൂമി വിവരങ്ങളുടെ മാറ്റം സ്ഥിരീകരിക്കുക"),
      "Land ID: " + session.land.landId,
      "Farm name: " + (parsed.updates.farmName || "Keep existing"),
      "Main crop: " + (parsed.updates.mainCrop || "Keep existing"),
      "Other crops: " + (parsed.updates.otherCrops || "Keep existing")
    ].join("\n"), "land");
    return true;
  }
  if (session.step === "awaiting_crop_name") {
    if (text.length < 2) {
      await sendWhatsAppMessage(from, cropFarmText(language, "Type a valid crop name.", "ശരിയായ വിളയുടെ പേര് ടൈപ്പ് ചെയ്യുക."));
      return true;
    }
    session.cropName = text;
    session.step = "awaiting_crop_details";
    session.sourceMessageId = session.sourceMessageId || sourceMessageId;
    await sendWhatsAppMessage(from, cropFarmText(language,
      "Enter: variety or - | planting date YYYY-MM-DD or - | cultivated area | unit | Annual/Perennial/Intercrop/Mixed | crop status | optional remarks",
      "നൽകുക: ഇനം അല്ലെങ്കിൽ - | നടീൽ തീയതി YYYY-MM-DD അല്ലെങ്കിൽ - | കൃഷി വിസ്തീർണം | യൂണിറ്റ് | Annual/Perennial/Intercrop/Mixed | വിള നില | കുറിപ്പ് (ഐച്ഛികം)"));
    return true;
  }
  if (session.step === "awaiting_crop_details") {
    const parsed = parseCropRegistrationDetails(text);
    if (!parsed.success) {
      await sendWhatsAppMessage(from, cropFarmText(language, "Those crop details are incomplete or invalid. Use the requested | separated format.", "വിള വിവരങ്ങൾ അപൂർണ്ണമോ തെറ്റോ ആണ്. ആവശ്യപ്പെട്ട | വേർതിരിച്ച രൂപം ഉപയോഗിക്കുക."));
      return true;
    }
    session.cropDetails = parsed;
    session.sourceMessageId = session.sourceMessageId || sourceMessageId;
    session.step = "confirm_crop";
    await bhoomiMitraUI.sendCropFarmConfirmation(from, language, [
      cropFarmText(language, "Confirm crop registration", "വിള രജിസ്ട്രേഷൻ സ്ഥിരീകരിക്കുക"),
      "Land: " + session.land.landId,
      "Crop: " + session.cropName,
      "Variety: " + (parsed.variety || "-"),
      "Planting: " + (parsed.plantingDate || "-"),
      "Area: " + parsed.cultivatedArea + " " + parsed.areaUnit,
      "Type: " + parsed.cropType,
      "Status: " + parsed.cropStatus
    ].join("\n"), "crop");
    return true;
  }
  if (session.step === "awaiting_crop_status") {
    const parsed = parseCropStatusDetails(text);
    if (!parsed.success) {
      await sendWhatsAppMessage(from, cropFarmText(language, "That crop status event is incomplete or invalid. Use the requested | separated format.", "വിള നില സംഭവം അപൂർണ്ണമോ തെറ്റോ ആണ്. ആവശ്യപ്പെട്ട | വേർതിരിച്ച രൂപം ഉപയോഗിക്കുക."));
      return true;
    }
    session.statusDetails = parsed;
    session.sourceMessageId = session.sourceMessageId || sourceMessageId;
    session.step = "confirm_status";
    await bhoomiMitraUI.sendCropFarmConfirmation(from, language, [
      cropFarmText(language, "Confirm crop status", "വിള നില സ്ഥിരീകരിക്കുക"),
      "Crop: " + session.statusCrop.cropName,
      "Crop ID: " + session.statusCrop.cropId,
      "Event: " + parsed.eventType,
      "Date: " + parsed.eventDate,
      "Status: " + parsed.cropStatus
    ].join("\n"), "status");
    return true;
  }
  if (session.step === "awaiting_operation_type_text") {
    const chosen = OPERATION_TYPES.find(function (type) {
      return type !== "Fertilizer Application" && type.toLowerCase() === text.toLowerCase();
    });
    if (!chosen) {
      await sendWhatsAppMessage(from, cropFarmText(language, "Type Post-Harvest Operation or Other.", "Post-Harvest Operation അല്ലെങ്കിൽ Other ടൈപ്പ് ചെയ്യുക."));
      return true;
    }
    session.operationType = chosen;
    session.step = "choose_operation_crop";
    const context = await loadCropFarmContext(from);
    await bhoomiMitraUI.sendCropFarmCropList(from, language, cropRowsForOperation(context.crops, session.land.landId));
    return true;
  }
  if (session.step === "awaiting_operation_details") {
    const parsed = parseOperationDetails(text);
    if (!parsed.success) {
      await sendWhatsAppMessage(from, cropFarmText(language, "Those activity details are incomplete or invalid. Use the requested | separated format.", "കൃഷിപ്പണി വിവരങ്ങൾ അപൂർണ്ണമോ തെറ്റോ ആണ്. ആവശ്യപ്പെട്ട | വേർതിരിച്ച രൂപം ഉപയോഗിക്കുക."));
      return true;
    }
    session.operationDetails = parsed;
    session.sourceMessageId = session.sourceMessageId || sourceMessageId;
    session.step = "confirm_operation";
    await bhoomiMitraUI.sendCropFarmConfirmation(from, language, [
      cropFarmText(language, "Confirm farm activity", "കൃഷിപ്പണി സ്ഥിരീകരിക്കുക"),
      "Land: " + session.land.landId,
      "Crop ID: " + (session.cropId || "-"),
      "Operation: " + session.operationType,
      "Date: " + parsed.operationDate,
      "Status: " + parsed.operationStatus
    ].join("\n"), "operation");
    return true;
  }
  return false;
}

function animalFlowLanguage(from) {
  return userLanguagePreferences[from] === "Malayalam"
    ? "Malayalam"
    : "English";
}

function animalFlowMessage(language, english, malayalam) {
  return language === "Malayalam" ? malayalam : english;
}

async function loadAnimalFarmer(from) {
  const farmer = await findRegistrationByPhone(
    "farmer",
    from,
    { requireUnique: true }
  );
  return farmer && farmer.success && farmer.memberId
    ? farmer
    : null;
}

async function appendAnimalRow(sheetName, row) {
  return appendSafe(sheetName, row);
}

async function handleAnimalHusbandryAction(options) {
  const input = options || {};
  const action = input.action && input.action.action;
  const from = input.from;
  const language = animalFlowLanguage(from);
  delete animalHusbandrySessions[from];

  if (action === "OPEN") {
    delete animalHusbandrySessions[from];
    await bhoomiMitraUI.sendAnimalHusbandryMenu(from, language);
    return true;
  }

  if (action === "MAIN_MENU") {
    delete animalHusbandrySessions[from];
    await bhoomiMitraUI.sendMainMenu(from, language);
    return true;
  }

  if (action === "EXPERT") {
    delete animalHusbandrySessions[from];
    await handleExpertAdviceAction({
      action: "DIRECT",
      from: from,
      sourceMessageId: input.sourceMessageId
    });
    return true;
  }

  if (action === "ADVISORY") {
    animalHusbandrySessions[from] = {
      flow: "advisory",
      step: "awaiting_advisory",
      language: language,
      updatedAt: Date.now()
    };
    await sendWhatsAppMessage(
      from,
      animalFlowMessage(
        language,
        "Describe your animal-health or husbandry question in your own words. Include the animal type, age, symptoms, duration and any recent treatment. For an emergency, contact a veterinarian immediately.",
        "മൃഗത്തിന്റെ ഇനം, പ്രായം, ലക്ഷണങ്ങൾ, എത്ര ദിവസമായി, നൽകിയ ചികിത്സ എന്നിവ ഉൾപ്പെടുത്തി ചോദ്യം എഴുതുക. അടിയന്തരാവസ്ഥയിൽ ഉടൻ വെറ്ററിനറി ഡോക്ടറെ ബന്ധപ്പെടുക."
      )
    );
    return true;
  }

  const farmer = await loadAnimalFarmer(from);
  if (!farmer) {
    await sendWhatsAppMessage(
      from,
      animalFlowMessage(
        language,
        "Please complete an unambiguous BhoomiMitra Farmer registration before using linked animal records.",
        "ബന്ധിപ്പിച്ച മൃഗരേഖകൾ ഉപയോഗിക്കുന്നതിന് മുമ്പ് BhoomiMitra കർഷക രജിസ്ട്രേഷൻ പൂർത്തിയാക്കുക."
      )
    );
    return true;
  }

  if (action === "MY_ANIMALS") {
    const result = await getOwnedAnimals({
      readSheetRows: readSheetRows,
      farmerId: farmer.memberId
    });
    await sendWhatsAppMessage(
      from,
      result.success
        ? formatOwnedAnimals(result.animals, language)
        : animalFlowMessage(language, "Animal records could not be loaded.", "മൃഗരേഖകൾ ലഭ്യമാക്കാനായില്ല.")
    );
    return true;
  }

  if (action === "ALERTS") {
    const result = await getVerifiedDiseaseAlerts({
      readSheetRows: readSheetRows,
      district: farmer.district,
      now: new Date()
    });
    await sendWhatsAppMessage(from, formatDiseaseAlerts(result.alerts, language));
    return true;
  }

  if (action === "HISTORY") {
    const result = await getAnimalRecords({
      readSheetRows: readSheetRows,
      farmerId: farmer.memberId
    });
    await sendWhatsAppMessage(
      from,
      result.success
        ? formatAnimalRecords(result.records, language)
        : animalFlowMessage(language, "Animal records could not be loaded.", "മൃഗരേഖകൾ ലഭ്യമാക്കാനായില്ല.")
    );
    return true;
  }

  if (action === "REGISTER") {
    animalHusbandrySessions[from] = {
      flow: "register",
      step: "animal_type",
      language: language,
      farmerId: farmer.memberId,
      data: {},
      updatedAt: Date.now()
    };
    await sendWhatsAppMessage(
      from,
      animalFlowMessage(language, "What type of animal are you registering? Example: dairy cow, goat or chicken.", "ഏത് മൃഗത്തെയാണ് രജിസ്റ്റർ ചെയ്യുന്നത്? ഉദാ: കറവപ്പശു, ആട്, കോഴി.")
    );
    return true;
  }

  const flowByAction = {
    HEALTH: "health",
    PREVENTIVE: "preventive",
    PRODUCTION: "production"
  };
  const flow = flowByAction[action];
  if (flow) {
    const animals = await getOwnedAnimals({
      readSheetRows: readSheetRows,
      farmerId: farmer.memberId
    });
    if (!animals.success || !animals.animals.length) {
      await sendWhatsAppMessage(from, formatOwnedAnimals([], language));
      return true;
    }
    animalHusbandrySessions[from] = {
      flow: flow,
      step: "animal_id",
      language: language,
      farmerId: farmer.memberId,
      data: {},
      updatedAt: Date.now()
    };
    await sendWhatsAppMessage(
      from,
      formatOwnedAnimals(animals.animals, language) + "\n\n" +
        animalFlowMessage(language, "Reply with the Animal ID for this record.", "ഈ രേഖയ്ക്കുള്ള Animal ID അയയ്ക്കുക.")
    );
    return true;
  }

  return false;
}

async function completeAnimalHusbandryInput(from, userText, sourceMessageId) {
  const session = animalHusbandrySessions[from];
  if (!session) return false;
  const language = session.language || animalFlowLanguage(from);
  const text = String(userText || "").trim();
  const normalized = text.toLowerCase();

  if (["cancel", "back", "menu", "റദ്ദാക്കുക", "പിന്നോട്ട്", "മെനു"].includes(normalized)) {
    delete animalHusbandrySessions[from];
    await bhoomiMitraUI.sendAnimalHusbandryMenu(from, language);
    return true;
  }

  if (!text) {
    await sendWhatsAppMessage(from, animalFlowMessage(language, "Please enter a value or type CANCEL.", "വിവരം നൽകുക അല്ലെങ്കിൽ CANCEL ടൈപ്പ് ചെയ്യുക."));
    return true;
  }

  session.updatedAt = Date.now();

  if (session.flow === "advisory") {
    delete animalHusbandrySessions[from];
    const farmer = await loadAnimalFarmer(from);
    let animalContext = "No linked animal profile was supplied.";
    if (farmer) {
      const owned = await getOwnedAnimals({ readSheetRows: readSheetRows, farmerId: farmer.memberId });
      if (owned.success && owned.animals.length) {
        animalContext = owned.animals.map(function (animal) {
          return [animal.animalId, animal.animalType, animal.breed, animal.sex, animal.age].filter(Boolean).join(" | ");
        }).join("; ");
      }
    }
    const reply = await getAIReply(
      "Veterinary advisory request. Give cautious Kerala-relevant husbandry guidance, do not claim a diagnosis, do not prescribe restricted medicines or invent a dose, and clearly identify emergency signs requiring an immediate veterinarian. Saved animal context: " + animalContext + "\n\nFarmer question: " + text,
      "",
      ""
    );
    await sendWhatsAppMessage(from, reply);
    return true;
  }

  if (session.flow === "register") {
    if (session.step === "animal_type") {
      session.data.animalType = text;
      session.step = "breed";
      await sendWhatsAppMessage(from, animalFlowMessage(language, "Enter the breed, or type UNKNOWN.", "ഇനം (breed) നൽകുക; അറിയില്ലെങ്കിൽ UNKNOWN എന്ന് ടൈപ്പ് ചെയ്യുക."));
      return true;
    }
    if (session.step === "breed") {
      session.data.breed = /^unknown$/i.test(text) ? "" : text;
      session.step = "sex";
      await sendWhatsAppMessage(from, animalFlowMessage(language, "Enter sex: Female, Male or Unknown.", "ലിംഗം നൽകുക: Female, Male അല്ലെങ്കിൽ Unknown."));
      return true;
    }
    if (session.step === "sex") {
      session.data.sex = text;
      session.step = "age";
      await sendWhatsAppMessage(from, animalFlowMessage(language, "Enter age or date of birth. Example: 3 years or 2023-06-15.", "പ്രായമോ ജനനത്തീയതിയോ നൽകുക. ഉദാ: 3 years അല്ലെങ്കിൽ 2023-06-15."));
      return true;
    }
    if (session.step === "age") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) session.data.dateOfBirth = text;
      else session.data.age = text;
      session.step = "tag";
      await sendWhatsAppMessage(from, animalFlowMessage(language, "Enter the ear-tag/identification number, or type SKIP.", "ഇയർ ടാഗ്/തിരിച്ചറിയൽ നമ്പർ നൽകുക; ഇല്ലെങ്കിൽ SKIP ടൈപ്പ് ചെയ്യുക."));
      return true;
    }
    if (session.step === "tag") {
      session.data.tagNumber = /^skip$/i.test(text) ? "" : text;
      const result = await registerAnimal({
        sheets: sheets,
        spreadsheetId: GOOGLE_SHEET_ID,
        phone: from,
        animal: Object.assign({}, session.data, { farmerId: session.farmerId })
      });
      if (result.success) delete animalHusbandrySessions[from];
      await sendWhatsAppMessage(
        from,
        result.success
          ? animalFlowMessage(language, "Animal registered and linked to Farmer ID " + session.farmerId + ".\nAnimal ID: " + result.animalId, "മൃഗത്തെ Farmer ID " + session.farmerId + "-യുമായി ബന്ധിപ്പിച്ച് രജിസ്റ്റർ ചെയ്തു.\nAnimal ID: " + result.animalId)
          : animalFlowMessage(language, "Animal registration failed: " + (result.error || result.code || "unknown error"), "മൃഗ രജിസ്ട്രേഷൻ പരാജയപ്പെട്ടു: " + (result.error || result.code || "അജ്ഞാത പിശക്"))
      );
      return true;
    }
  }

  if (session.step === "animal_id") {
    const ownership = await verifyAnimalOwnership({
      readSheetRows: readSheetRows,
      farmerId: session.farmerId,
      animalId: text
    });
    if (!ownership.success) {
      await sendWhatsAppMessage(from, animalFlowMessage(language, "That Animal ID is not active under your Farmer ID. Try again or type CANCEL.", "ആ Animal ID നിങ്ങളുടെ Farmer ID-യിൽ സജീവമല്ല. വീണ്ടും ശ്രമിക്കുക അല്ലെങ്കിൽ CANCEL ടൈപ്പ് ചെയ്യുക."));
      return true;
    }
    session.data.animalId = ownership.animal.animalId;
    session.step = "details";
    const prompts = {
      health: "Enter: YYYY-MM-DD | symptom/observation | treatment or veterinarian notes",
      preventive: "Enter: vaccination or deworming | YYYY-MM-DD | product | dose/result | next due date | veterinarian/notes",
      production: "Enter: milk, egg, weight or breeding | YYYY-MM-DD | quantity/result | unit | details/notes"
    };
    await sendWhatsAppMessage(from, prompts[session.flow]);
    return true;
  }

  if (session.step === "details") {
    const parts = text.split("|").map(function (part) { return part.trim(); });
    let result;
    if (session.flow === "health") {
      result = await saveHealthRecord({
        readSheetRows: readSheetRows,
        appendRow: appendAnimalRow,
        farmerId: session.farmerId,
        animalId: session.data.animalId,
        phone: from,
        recordDate: parts[0],
        recordType: "Health observation",
        observation: parts[1] || parts[0],
        notes: parts.slice(2).join(" | "),
        sourceMessageId: sourceMessageId
      });
    } else if (session.flow === "preventive") {
      const type = (parts[0] || "").toLowerCase();
      if (!/vaccin|deworm/.test(type)) {
        await sendWhatsAppMessage(from, "Start with vaccination or deworming, followed by | and the record details.");
        return true;
      }
      result = await saveHealthRecord({
        readSheetRows: readSheetRows,
        appendRow: appendAnimalRow,
        farmerId: session.farmerId,
        animalId: session.data.animalId,
        phone: from,
        recordType: /deworm/.test(type) ? "Deworming" : "Vaccination",
        recordDate: parts[1],
        product: parts[2],
        doseOrResult: parts[3],
        nextDueDate: parts[4],
        veterinarian: parts[5],
        sourceMessageId: sourceMessageId
      });
    } else {
      result = await saveBreedingProductionRecord({
        readSheetRows: readSheetRows,
        appendRow: appendAnimalRow,
        farmerId: session.farmerId,
        animalId: session.data.animalId,
        phone: from,
        recordType: parts[0],
        recordDate: parts[1],
        quantityOrResult: parts[2],
        unit: parts[3],
        details: parts.slice(4).join(" | "),
        sourceMessageId: sourceMessageId
      });
    }
    if (result.success) delete animalHusbandrySessions[from];
    await sendWhatsAppMessage(
      from,
      result.success
        ? animalFlowMessage(language, "Animal record saved. Record ID: " + result.recordId, "മൃഗരേഖ സേവ് ചെയ്തു. Record ID: " + result.recordId)
        : animalFlowMessage(language, "The record was not saved (" + (result.code || "unknown error") + ").", "രേഖ സേവ് ചെയ്തില്ല (" + (result.code || "അജ്ഞാത പിശക്") + ").")
    );
    return true;
  }

  return false;
}
app.post("/webhook", async function (req, res) {
  let claimedMessageId = "";
  let claimedMessageToken = "";
  let processingError = null;

  try {
    const signature = verifyMetaSignature(
      req.rawBody,
      req.get("x-hub-signature-256"),
      META_APP_SECRET
    );

    if (!signature.valid) {
      console.warn("WhatsApp webhook rejected.", {
        reason: signature.code
      });
      return res
        .status(
          signature.code === "APP_SECRET_MISSING"
            ? 503
            : 401
        )
        .send("WEBHOOK_REJECTED");
    }

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

    const claim = await webhookMessageLedger.claim(message.id);
    if (!claim.accepted) {
      if (claim.duplicate) {
        console.log("Duplicate WhatsApp message skipped.",
          safeMessageMetadata(message));
      }
      if (claim.code === "ALREADY_IN_FLIGHT") {
        return res
          .status(503)
          .send("PROCESSING_IN_PROGRESS");
      }
      return;
    }
    claimedMessageId = message.id;
    claimedMessageToken = claim.token || "";

    const from = message.from;

console.log(
  "WhatsApp message processing started.",
  Object.assign(safeMessageMetadata(message), {
    recoveredAfterRestart: Boolean(claim.recovered)
  })
);

let userText = "";
let voiceTranscriptionSucceeded = true;

let activeFarmMenu =
  userMenus[from];

if (
  message.type === "text" ||
  message.type === "interactive"
) {

  // -----------------------------------------------
  // NORMAL TEXT MESSAGE
  // -----------------------------------------------

  if (message.type === "text") {
    userText =
      message.text &&
      message.text.body
        ? message.text.body.trim()
        : "";
  }

  // -----------------------------------------------
  // BHOOMIMITRA INTERACTIVE BUTTON / LIST MESSAGE
  // -----------------------------------------------

  if (message.type === "interactive") {
    const uiSelection =
      bhoomiMitraUI.getInteractiveSelection(
        message
      );

    if (uiSelection) {
      const registrationAccess =
        await resolveCurrentUserRegistration(from);

      if (
        isLimitedAccessState(registrationAccess) &&
        !isGuestAllowedAction(uiSelection.id)
      ) {
        await sendStatusAwareHome(
          from,
          userLanguagePreferences[from] || "English",
          registrationAccess,
          true
        );
        return;
      }

      if (
        registrationAccess.state ===
          USER_REGISTRATION_STATES.REGISTERED_SERVICE_MEMBER &&
        isFarmerOnlyAction(uiSelection.id)
      ) {
        await sendWhatsAppMessage(
          from,
          (userLanguagePreferences[from] === "Malayalam")
            ? "ഈ സേവനത്തിന് സജീവവും പൂർണ്ണവുമായ കർഷക രജിസ്ട്രേഷൻ ആവശ്യമാണ്. നിങ്ങളുടെ വിദഗ്ധൻ/തൊഴിലാളി/സേവനദാതാവ് രജിസ്ട്രേഷൻ മാറ്റിയിട്ടില്ല."
            : "This service requires a complete active farmer registration. Your expert, worker, or service-provider registration has not been changed.",
          { skipPreferredLanguageConversion: true }
        );
        await sendStatusAwareHome(
          from,
          userLanguagePreferences[from] || "English",
          registrationAccess,
          false
        );
        return;
      }

      closeRegistrationSessionForNavigation({
        userKey: from,
        selectionId: uiSelection.id,
        registrationSessions: sessions,
        menuSessions: userMenus
      });

      const cropFarmAction =
        parseCropFarmAction(uiSelection.id);

      if (cropFarmAction) {
        delete animalHusbandrySessions[from];
        delete farmAlertSessions[from];
        await handleCropFarmAction({
          cropFarmAction: cropFarmAction,
          from: from,
          sourceMessageId: message.id
        });
        return;
      }

      if (cropFarmSessions[from]) {
        delete cropFarmSessions[from];
      }

      const animalAction =
        parseAnimalAction(uiSelection.id);

      if (animalAction) {
        await handleAnimalHusbandryAction({
          action: animalAction,
          from: from,
          sourceMessageId: message.id
        });
        return;
      }

      delete animalHusbandrySessions[from];

      const farmAlertAction =
        parseFarmAlertAction(uiSelection.id);

      if (farmAlertAction) {
        delete trainingRequestSessions[from];
        delete schemeSearchSessions[from];
        await handleFarmAlertAction({
          farmAlertAction: farmAlertAction,
          from: from,
          sourceMessageId: message.id
        });
        return;
      }

      if (farmAlertSessions[from]) {
        delete farmAlertSessions[from];
      }

      const trainingAction =
        parseTrainingAction(uiSelection.id);

      if (trainingAction) {
        delete schemeSearchSessions[from];
        await handleTrainingAction({
          trainingAction: trainingAction,
          from: from,
          sourceMessageId: message.id
        });
        return;
      }

      if (trainingRequestSessions[from]) {
        delete trainingRequestSessions[from];
      }

      const schemeAction =
        parseSchemeAction(uiSelection.id);

      if (schemeAction) {
        await handleSchemeAction({
          schemeAction: schemeAction,
          from: from,
          sourceMessageId: message.id
        });
        return;
      }

      if (schemeSearchSessions[from]) {
        delete schemeSearchSessions[from];
      }

      const expertCaseSelection =
        parseExpertCaseAction(uiSelection.id);

      if (expertCaseSelection) {
        await handleExpertCaseSelection({
          selection: expertCaseSelection,
          from: from
        });
        return;
      }

      const expertAdviceAction =
        getExpertAdviceAction(
          uiSelection.id,
          uiSelection.title
        );

      if (expertAdviceAction) {
        await handleExpertAdviceAction({
          action: expertAdviceAction,
          from: from,
          sourceMessageId: message.id
        });
        return;
      }

      const selectedLanguage =
        bhoomiMitraUI.getLanguageFromSelection(
          message
        );

      // Language button
      if (selectedLanguage) {
        userText = selectedLanguage;
      } else {
        const navigationAction =
          bhoomiMitraUI.getNavigationAction(
            uiSelection.id
          );

        const preferredUiLanguage =
          userLanguagePreferences[from] ||
          "Malayalam";

        const aboutAction =
          parseAboutAction(uiSelection.id);

        if (aboutAction) {
          if (aboutAction.type === "ABOUT") {
            await bhoomiMitraUI.sendAboutMenu(
              from,
              preferredUiLanguage
            );
          } else if (aboutAction.type === "TEAM") {
            await bhoomiMitraUI.sendTeamDirectory(
              from,
              preferredUiLanguage,
              aboutAction.page
            );
          } else if (aboutAction.type === "MEMBER") {
            await bhoomiMitraUI.sendTeamMemberProfile(
              from,
              preferredUiLanguage,
              aboutAction.member,
              aboutAction.page
            );
          }
          return;
        }

        const userGuideAction =
          parseUserGuideAction(uiSelection.id);

        if (userGuideAction) {
          if (userGuideAction.type === "GUIDE") {
            await bhoomiMitraUI.sendUserGuidePage(
              from,
              preferredUiLanguage,
              userGuideAction.page
            );
          } else if (userGuideAction.type === "TOPIC") {
            await bhoomiMitraUI.sendUserGuideTopic(
              from,
              preferredUiLanguage,
              userGuideAction.topic,
              userGuideAction.page
            );
          }
          return;
        }

        // -----------------------------------------
        // MAIN NAVIGATION
        // -----------------------------------------

        if (navigationAction === "WHATS_NEW_TRY") {
          const selectedFeature =
            whatsNewSelections[from] ||
            featureDiscovery.firstAvailable({ userCategory: "FARMER" });

          if (selectedFeature) {
            await featureDiscovery.acknowledge(from, selectedFeature.id, "opened");
          }
          delete whatsNewSelections[from];

          if (selectedFeature && selectedFeature.destination === "HOME_TRAINING") {
            await sendTrainingHome(from, preferredUiLanguage);
          } else if (
            selectedFeature &&
            selectedFeature.destination === "LAND_SATELLITE_GPS"
          ) {
            userMenus[from] = userMenus[from] || createMenuSession();
            userMenus[from].step = "satellite_gps_menu";
            userMenus[from].currentService = "farm";
            userMenus[from].updatedAt = Date.now();
            await bhoomiMitraUI.sendSatelliteGpsMenu(from, preferredUiLanguage);
          } else {
            await bhoomiMitraUI.sendMainMenu(from, preferredUiLanguage);
          }
          return;
        }

        if (navigationAction === "WHATS_NEW_DISMISS") {
          const selectedFeature =
            whatsNewSelections[from] ||
            featureDiscovery.firstAvailable({ userCategory: "FARMER" });
          if (selectedFeature) {
            await featureDiscovery.acknowledge(from, selectedFeature.id, "dismissed");
          }
          delete whatsNewSelections[from];
          await bhoomiMitraUI.sendMainMenu(from, preferredUiLanguage);
          return;
        }

        if (shouldShowWhatsNew(navigationAction)) {
          await showWhatsNew(from, preferredUiLanguage, true);
          return;
        }

        if (navigationAction === "HELP_MENU") {
          await bhoomiMitraUI.sendHelpMenu(from, preferredUiLanguage);
          return;
        }

        if (navigationAction === "TERMS_PRIVACY_MENU") {
          await bhoomiMitraUI.sendTermsPrivacyMenu(from, preferredUiLanguage);
          return;
        }

        if (navigationAction === "PRIVACY_POLICY") {
          await sendWhatsAppMessage(
            from,
            formatPrivacyPolicy(preferredUiLanguage),
            { skipPreferredLanguageConversion: true }
          );
          await bhoomiMitraUI.sendTermsPrivacyMenu(from, preferredUiLanguage);
          return;
        }

        if (navigationAction === "PROFILE_SETTINGS_MENU") {
          await bhoomiMitraUI.sendProfileSettingsMenu(from, preferredUiLanguage);
          return;
        }

        if (navigationAction === "WEATHER_ALERTS_MENU") {
          await bhoomiMitraUI.sendWeatherAlertsMenu(from, preferredUiLanguage);
          return;
        }

        if (navigationAction === "MAIN_MENU_MORE") {
          await bhoomiMitraUI.sendMainMenuMore(from, preferredUiLanguage);
          return;
        }

        if (navigationAction === "PUBLIC_SERVICES_MENU") {
          await bhoomiMitraUI.sendGuestExploreMenu(from, preferredUiLanguage);
          return;
        }

        if (navigationAction === "ENTERPRISE_SERVICES_MENU") {
          await bhoomiMitraUI.sendEnterpriseServicesMenu(from, preferredUiLanguage);
          return;
        }

        if (navigationAction === "ASK_MENU") {
          await bhoomiMitraUI.sendAskMenu(
            from,
            preferredUiLanguage
          );
          return;
        }

        if (navigationAction === "FARM_MENU") {
          await bhoomiMitraUI.sendFarmMenu(
            from,
            preferredUiLanguage
          );
          return;
        }

        if (
          navigationAction ===
          "SATELLITE_GPS_MENU"
        ) {
          userMenus[from] =
            userMenus[from] || createMenuSession();

          userMenus[from].step =
            "satellite_gps_menu";
          userMenus[from].currentService =
            "farm";
          userMenus[from].updatedAt =
            Date.now();

          await bhoomiMitraUI.sendSatelliteGpsMenu(
            from,
            preferredUiLanguage
          );

          return;
        }

        if (
          navigationAction === "EXPERT_MENU"
        ) {
          await bhoomiMitraUI.sendExpertsTrainingMenu(
            from,
            preferredUiLanguage
          );
          return;
        }

        if (
          navigationAction === "MARKET_MENU"
        ) {
          await bhoomiMitraUI.sendMarketMenu(
            from,
            preferredUiLanguage
          );
          return;
        }

        if (
          navigationAction === "PROFILE_MENU"
        ) {
          await bhoomiMitraUI.sendProfileMenu(
            from,
            preferredUiLanguage
          );
          return;
        }

        if (
          navigationAction === "MAIN_MENU"
        ) {
          await sendStatusAwareHome(
            from,
            preferredUiLanguage,
            registrationAccess,
            false
          );
          return;
        }

        if (
          navigationAction === "LANGUAGE_MENU"
        ) {
          pendingLanguageSelections[from] =
            { includeWelcome: false };

          await bhoomiMitraUI
            .sendLanguageSelection(
              from,
              { includeWelcome: false }
            );

          return;
        }

        // -----------------------------------------
        // EXISTING SERVICES 1–11
        // -----------------------------------------
if (uiSelection.id === "SERVICE_9") {
  userMenus[from] =
    userMenus[from] || createMenuSession();

  userMenus[from].step =
    "processing_services";
  userMenus[from].currentService =
    "farm";
  userMenus[from].farmerId =
    registrationAccess.farmer && registrationAccess.farmer.id || "";
  userMenus[from].updatedAt =
    Date.now();

  await bhoomiMitraUI.sendLandManagementMenu(
    from,
    userLanguagePreferences[from] || "English"
  );

  return;
}

if (uiSelection.id === "SERVICE_10") {
  userMenus[from] =
    userMenus[from] || createMenuSession();

  userMenus[from].currentService =
    "personal_records";

  userMenus[from].updatedAt =
    Date.now();

  await bhoomiMitraUI.sendPersonalRecordsMenu(
    from,
    userLanguagePreferences[from] || "English"
  );

  return;
}

const landManagementCommand =
  bhoomiMitraUI.getLandManagementCommand(
    uiSelection.id
  );
const satelliteGpsCommand =
  bhoomiMitraUI.getSatelliteGpsCommand(
    uiSelection.id
  );

if (landManagementCommand === "back") {
  userMenus[from] = createMenuSession();

  await bhoomiMitraUI.sendFarmMenu(
    from,
    userLanguagePreferences[from] || "English"
  );

  return;
} else if (landManagementCommand) {
  userMenus[from] =
    userMenus[from] || createMenuSession();

  userMenus[from].step =
    "processing_services";
  userMenus[from].currentService =
    "farm";
  userMenus[from].updatedAt =
    Date.now();

  userText = landManagementCommand;
} else if (satelliteGpsCommand) {
  userMenus[from] =
    userMenus[from] || createMenuSession();

  userMenus[from].step =
    "satellite_gps_menu";
  userMenus[from].currentService =
    "farm";
  userMenus[from].updatedAt =
    Date.now();

  userText = satelliteGpsCommand;
} else if (
  uiSelection.id === "PERSONAL_DETAILS" ||
  uiSelection.id === "PERSONAL_FARMER_ID" ||
  uiSelection.id === "PERSONAL_LANDS" ||
  uiSelection.id === "PERSONAL_ANIMALS"
) {
  const personalCommand =
    bhoomiMitraUI.getLegacyServiceCommand(
      uiSelection.id
    );

  const personalResult =
    await handlePersonalRecords({
      from,
      phone: from,
      userText: personalCommand,
      language:
        userLanguagePreferences[from] ||
        "Malayalam",
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

    if (
      personalResult.showRegistrationPath
    ) {
      await bhoomiMitraUI.sendProfileMenu(
        from,
        userLanguagePreferences[from] ===
          "English"
          ? "English"
          : "Malayalam"
      );
    }

    return;
  }

  await sendWhatsAppMessage(
    from,
    "Sorry, your personal records could not be retrieved."
  );

  return;
} else {
  const legacyCommand =
    bhoomiMitraUI.getLegacyServiceCommand(
      uiSelection.id
    );

  if (legacyCommand) {
    userText = legacyCommand;
  } else {
    userText =
      uiSelection.title || "";
  }
}
      }
    }
  }

  // Interactive routing can create a fresh menu session
  // (for example after a server restart). Refresh the local
  // reference so the selected Satellite/GPS command is handled
  // by its state-specific branch instead of falling through to
  // the legacy numeric main-menu router.
  activeFarmMenu = userMenus[from];

  if (
    message.type === "text" &&
    animalHusbandrySessions[from]
  ) {
    await completeAnimalHusbandryInput(
      from,
      userText,
      message.id
    );
    return;
  }

  if (
    message.type === "text" &&
    farmAlertSessions[from] &&
    farmAlertSessions[from].step === "awaiting_operation_date"
  ) {
    await completeFarmAlertTextInput(from, userText, message.id);
    return;
  }

  if (
    message.type === "text" &&
    cropFarmSessions[from]
  ) {
    const cropFarmHandled = await completeCropFarmTextInput(from, userText, message.id);
    if (cropFarmHandled) return;
  }

  const pendingTypedTrainingRequest = trainingRequestSessions[from];

  if (
    message.type === "text" &&
    pendingTypedTrainingRequest
  ) {
    const trainingInputHandled = await completeTrainingRequestInput(
      from,
      userText,
      "text"
    );
    if (trainingInputHandled) return;
  }

  const pendingTypedSchemeSearch = schemeSearchSessions[from];

  if (
    message.type === "text" &&
    pendingTypedSchemeSearch &&
    pendingTypedSchemeSearch.step === "awaiting_query"
  ) {
    await completeSchemeSearch(
      from,
      userText,
      pendingTypedSchemeSearch.language || "English"
    );
    return;
  }

  if (message.type === "text" && expertAdviceSessions[from]) {
    const typedExpertAdviceAction =
      getExpertAdviceAction("", userText);

    if (typedExpertAdviceAction) {
      await handleExpertAdviceAction({
        action: typedExpertAdviceAction,
        from: from,
        sourceMessageId: message.id
      });
      return;
    }
  }
  // =====================================================
// EXPERT WHATSAPP REPLY
// Format:
// REPLY BM-EXP-123456789
// Your recommendation here
// =====================================================

const pendingFarmerFollowUp = expertAdviceSessions[from];

if (
  message.type === "text" &&
  pendingFarmerFollowUp &&
  pendingFarmerFollowUp.step === "awaiting_follow_up"
) {
  const language = expertAdviceLanguage(from);
  let followUpResult;

  try {
    followUpResult = await processFarmerFollowUp({
      caseId: pendingFarmerFollowUp.caseId,
      farmerWhatsApp: from,
      followUp: userText,
      readSheetRows: readSheetRows,
      updateCase: updateExpertCaseByHeaders,
      sendExpertMessage: function (to, text) {
        return sendWhatsAppMessage(
          to,
          text,
          { skipPreferredLanguageConversion: true }
        );
      }
    });
  } catch (followUpError) {
    followUpResult = {
      success: false,
      code: "WORKFLOW_ERROR"
    };
    logSafeError(
      "Farmer expert follow-up failed.",
      followUpError
    );
  }

  if (followUpResult.success) {
    expertAdviceSessions[from] = {
      step: "assigned",
      caseId: followUpResult.record.caseId,
      updatedAt: Date.now()
    };
    await sendWhatsAppMessage(
      from,
      language === "Malayalam"
        ? "✅ നിങ്ങളുടെ തുടർ ചോദ്യം അതേ വിദഗ്ധ കേസിലേക്ക് അയച്ചു."
        : "✅ Your follow-up was sent to the same expert case."
    );
  } else {
    delete expertAdviceSessions[from];
    const unavailable = [
      "INVALID_CASE",
      "WRONG_FARMER",
      "CLOSED_CASE",
      "MISSING_EXPERT"
    ].includes(followUpResult.code);
    await sendWhatsAppMessage(
      from,
      language === "Malayalam"
        ? (
            unavailable
              ? "ഈ കേസിലേക്ക് തുടർ ചോദ്യം അയയ്ക്കാൻ കഴിയില്ല. കേസ് വീണ്ടും തിരഞ്ഞെടുക്കുക."
              : "തുടർ ചോദ്യം ഇപ്പോൾ അയയ്ക്കാനായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക."
          )
        : (
            unavailable
              ? "A follow-up cannot be sent to that case. Please choose the case again."
              : "The follow-up could not be sent right now. Please try again."
          )
    );
  }

  return;
}

const pilotParsedExpertReply = parseExpertReplyText(userText);

if (pilotParsedExpertReply) {
  if (!pilotParsedExpertReply.advice) {
    await sendWhatsAppMessage(
      from,
      "Please send your recommendation after the Case ID.\n\n" +
      "Example:\nREPLY " + pilotParsedExpertReply.caseId +
      "\nYour recommendation here."
    );
    return;
  }

  let expertReplyResult;

  try {
    expertReplyResult = await processExpertReply({
      caseId: pilotParsedExpertReply.caseId,
      advice: pilotParsedExpertReply.advice,
      expertWhatsApp: from,
      readSheetRows: readSheetRows,
      updateCase: updateExpertCaseByHeaders,
      sendFarmerMessage: async function (to, record) {
        const language = await resolveExpertAdviceLanguage(to);
        return sendFarmerExpertCaseView(to, language, record);
      }
    });
  } catch (expertReplyError) {
    expertReplyResult = {
      success: false,
      code: "WORKFLOW_ERROR"
    };
    logSafeError(
      "Expert reply workflow failed.",
      expertReplyError
    );
  }

  const expertReplyErrors = {
    INVALID_CASE: "❌ Case ID not found: " + pilotParsedExpertReply.caseId,
    CLOSED_CASE: "❌ This expert case is closed and cannot receive another reply.",
    WRONG_EXPERT: "❌ You are not the assigned expert for this case.",
    MISSING_FARMER: "❌ The farmer WhatsApp number is unavailable for this case.",
    UPDATE_FAILED: "❌ The recommendation could not be recorded. It was not sent to the farmer.",
    DELIVERY_FAILED: "❌ The recommendation was recorded, but delivery to the farmer failed.",
    WORKFLOW_ERROR: "❌ The recommendation could not be processed right now."
  };

  await sendWhatsAppMessage(
    from,
    expertReplyResult.success
      ? (
          "✅ Your recommendation for " +
          pilotParsedExpertReply.caseId +
          " has been recorded and sent to the farmer."
        )
      : (
          expertReplyErrors[expertReplyResult.code] ||
          "❌ The recommendation could not be processed."
        )
  );
  return;
}

// =====================================================
// ACTIVE REGISTRATION SESSION
// =====================================================
if (
  userText &&
  userMenus[from] &&
  userMenus[from].step === "registration_active"
) {
  const registrationReply =
    await handleRegistration(
      from,
      userText
    );

  if (registrationReply) {
    await sendWhatsAppMessage(
      from,
      registrationReply
    );

    if (!sessions[from]) {
      userMenus[from] = createMenuSession();
      await bhoomiMitraUI.sendMainMenu(
        from,
        userLanguagePreferences[from] || "Malayalam"
      );
    }
    return;
  }
}
  // ============================================================
// PRIVACY CONSENT - AGREE / DECLINE
// ============================================================
if (
  userMenus[from] &&
  userMenus[from].step ===
    "privacy_consent_pending"
) {
  const consentChoice =
    String(userText || "")
      .trim()
      .toUpperCase();

 if (
  consentChoice === "AGREE" ||
  consentChoice === "I AGREE" ||
  consentChoice === "I ACCEPT" ||
  consentChoice === "ACCEPT" ||
  consentChoice === "ഞാൻ അംഗീകരിക്കുന്നു" ||
  consentChoice === "സമ്മതിക്കുന്നു"
) {
    const saveResult =
      await saveConsent({
        sheets,
        spreadsheetId:
          GOOGLE_SHEET_ID,
        whatsapp:
          from,
        consentStatus:
          "AGREED",
        policyLanguage:
  "BILINGUAL-EN-ML",
          source:
          "WHATSAPP",
        remarks:
          "Pilot User Agreement and Privacy Notice accepted"
      });

    if (
      !saveResult ||
      !saveResult.success
    ) {
      await sendWhatsAppMessage(
        from,
        "⚠️ Your acceptance could not be recorded. Please try AGREE again."
      );
      return;
    }

    userMenus[from].step = "registration_active";
    userMenus[from].updatedAt =
      Date.now();

   const regReply =
  await handleRegistration(
    from,
    "register"
  );

if (regReply) {
  await sendWhatsAppMessage(
    from,
    regReply
  );
}

    return;
  }

  if (
  consentChoice === "DECLINE" ||
  consentChoice === "I DECLINE" ||
  consentChoice === "I DO NOT ACCEPT" ||
  consentChoice === "DO NOT ACCEPT" ||
  consentChoice === "ഞാൻ അംഗീകരിക്കുന്നില്ല" ||
  consentChoice === "സമ്മതിക്കുന്നില്ല"
) {
    await saveConsent({
      sheets,
      spreadsheetId:
        GOOGLE_SHEET_ID,
      whatsapp:
        from,
      consentStatus:
        "DECLINED",
      policyLanguage:
  "BILINGUAL-EN-ML",
      source:
        "WHATSAPP",
      remarks:
        "Pilot User Agreement and Privacy Notice declined"
    });

    userMenus[from].step = null;
    userMenus[from].updatedAt =
      Date.now();

    await sendWhatsAppMessage(
      from,
      [
        "❌ Registration not started.",
        "",
        "You have declined the BhoomiMitra User Agreement & Privacy Notice.",
        "",
        "You may start registration again later if you wish."
      ].join("\n")
    );

    return;
  }

if (consentChoice === "POLICY") {
  await sendWhatsAppMessage(
    from,
    [
      "📘 BhoomiMitra – Full User Agreement & Privacy Policy",
      "📘 ഭൂമിമിത്ര – പൂർണ്ണ ഉപയോക്തൃ കരാറും സ്വകാര്യതാ നയവും",
      "",
      "This policy applies to the BhoomiMitra pilot digital agricultural service. By choosing AGREE, you confirm that you have read and understood this policy and voluntarily consent to the processing of your information for the purposes stated below.",
      "",
      "ഈ നയം ഭൂമിമിത്ര പൈലറ്റ് ഡിജിറ്റൽ കാർഷിക സേവനത്തിന് ബാധകമാണ്. AGREE തിരഞ്ഞെടുക്കുന്നതിലൂടെ ഈ നയം വായിച്ച് മനസ്സിലാക്കിയതായും താഴെ പറയുന്ന ആവശ്യങ്ങൾക്കായി വിവരങ്ങൾ പ്രോസസ് ചെയ്യുന്നതിന് സ്വമേധയാ സമ്മതിക്കുന്നതായും നിങ്ങൾ സ്ഥിരീകരിക്കുന്നു.",
      "",
      "1️⃣ Information we may process / ശേഖരിക്കാവുന്ന വിവരങ്ങൾ",
      "",
      "Name, mobile/WhatsApp number, language, farmer and farm details, crop/livestock information, location/GPS, land and boundary information, soil-test information, photographs, voice messages, queries, advisory records, service history, satellite observations, device/service logs and other information voluntarily supplied by you.",
      "",
      "പേര്, മൊബൈൽ/WhatsApp നമ്പർ, ഭാഷ, കർഷക/ഫാം വിവരങ്ങൾ, വിള/മൃഗസംരക്ഷണ വിവരങ്ങൾ, സ്ഥലം/GPS, ഭൂമി/അതിർത്തി വിവരങ്ങൾ, മണ്ണ് പരിശോധനാ വിവരങ്ങൾ, ചിത്രങ്ങൾ, ശബ്ദ സന്ദേശങ്ങൾ, ചോദ്യങ്ങൾ, ഉപദേശ ചരിത്രം, സേവന ചരിത്രം, സാറ്റലൈറ്റ് നിരീക്ഷണങ്ങൾ, സാങ്കേതിക ലോഗുകൾ എന്നിവ പ്രോസസ് ചെയ്യാം.",
      "",
      "2️⃣ Purpose / ഉപയോഗത്തിന്റെ ഉദ്ദേശ്യം",
      "",
      "Information may be used only for providing and administering BhoomiMitra services, agricultural advisory, farm management, identification of authorised users, security, troubleshooting, service improvement, record keeping, lawful reporting and other purposes permitted by applicable law.",
      "",
      "ഭൂമിമിത്ര സേവനങ്ങൾ, കാർഷിക ഉപദേശം, ഫാം മാനേജ്മെന്റ്, അംഗീകൃത ഉപയോക്താക്കളെ തിരിച്ചറിയൽ, സുരക്ഷ, സാങ്കേതിക പരിഹാരം, സേവന മെച്ചപ്പെടുത്തൽ, രേഖസംരക്ഷണം, നിയമാനുസൃത റിപ്പോർട്ടിംഗ് എന്നിവയ്ക്കായി വിവരങ്ങൾ ഉപയോഗിക്കാം.",
      "",
      "3️⃣ Privacy and disclosure / സ്വകാര്യതയും വെളിപ്പെടുത്തലും",
      "",
      "Personal information will not be intentionally disclosed to unauthorised persons. Information may be processed by authorised service, technology, cloud, messaging, satellite or other providers where reasonably necessary for delivering BhoomiMitra, subject to applicable safeguards and law.",
      "",
      "അനുമതിയില്ലാത്ത വ്യക്തികൾക്ക് വ്യക്തിഗത വിവരങ്ങൾ ഉദ്ദേശപൂർവ്വം വെളിപ്പെടുത്തുകയില്ല. സേവനം നൽകാൻ ആവശ്യമായിടത്ത് അംഗീകൃത സാങ്കേതിക, ക്ലൗഡ്, മെസേജിംഗ്, സാറ്റലൈറ്റ് തുടങ്ങിയ സേവനദാതാക്കൾ വിവരങ്ങൾ പ്രോസസ് ചെയ്യാം."
    ].join("\n")
  );

  await sendWhatsAppMessage(
    from,
    [
      "4️⃣ Security & cyber risks / സുരക്ഷയും സൈബർ അപകടസാധ്യതകളും",
      "",
      "Reasonable technical and organisational safeguards will be used, including access restriction and appropriate security practices. However, no internet, mobile, cloud or third-party digital system can be guaranteed to be completely free from cyberattack, unauthorised intrusion, service disruption, technical failure or other security risk.",
      "",
      "യുക്തിസഹമായ സാങ്കേതികവും ഭരണപരവുമായ സുരക്ഷാ നടപടികൾ സ്വീകരിക്കും. എന്നിരുന്നാലും ഇന്റർനെറ്റ്, മൊബൈൽ, ക്ലൗഡ് അല്ലെങ്കിൽ മൂന്നാംകക്ഷി ഡിജിറ്റൽ സംവിധാനങ്ങൾ സൈബർ ആക്രമണം, അനധികൃത പ്രവേശനം, സേവന തടസം, സാങ്കേതിക തകരാർ തുടങ്ങിയ അപകടങ്ങളിൽ നിന്ന് പൂർണ്ണമായി മുക്തമാണെന്ന് ഉറപ്പുനൽകാനാവില്ല.",
      "",
      "Where a security incident is identified, reasonable protective, corrective, recovery, notification or reporting measures will be taken as required by applicable law.",
      "",
      "സുരക്ഷാ സംഭവം കണ്ടെത്തിയാൽ ബാധകമായ നിയമപ്രകാരം ആവശ്യമായ സംരക്ഷണ, തിരുത്തൽ, വീണ്ടെടുക്കൽ, അറിയിപ്പ് അല്ലെങ്കിൽ റിപ്പോർട്ടിംഗ് നടപടികൾ സ്വീകരിക്കും.",
      "",
      "5️⃣ AI & agricultural advisory / AIയും കാർഷിക ഉപദേശവും",
      "",
      "AI, agricultural, weather, market, pest/disease and other information is decision-support only. Information can be incomplete, delayed, estimated or affected by conditions outside BhoomiMitra's control. Important decisions should be verified with the appropriate expert, institution or field inspection.",
      "",
      "AI, കാർഷികം, കാലാവസ്ഥ, വിപണി, കീട/രോഗ വിവരങ്ങൾ തീരുമാനസഹായത്തിനായുള്ളതാണ്. പ്രധാന തീരുമാനങ്ങൾ ബന്ധപ്പെട്ട വിദഗ്ധൻ, സ്ഥാപനം അല്ലെങ്കിൽ ഫീൽഡ് പരിശോധന വഴി സ്ഥിരീകരിക്കണം.",
      "",
      "BhoomiMitra does not guarantee crop yield, profit, market price, weather outcome, disease cure, crop recovery, eligibility for benefits or prevention of loss.",
      "",
      "വിളവ്, ലാഭം, വിപണി വില, കാലാവസ്ഥാ ഫലം, രോഗശമനം, വിള പുനരുജ്ജീവനം, ആനുകൂല്യത്തിന് അർഹത, നഷ്ടം തടയൽ എന്നിവ ഭൂമിമിത്ര ഉറപ്പുനൽകുന്നില്ല.",
      "",
      "6️⃣ GPS, land & satellite information / GPS, ഭൂമി, സാറ്റലൈറ്റ് വിവരങ്ങൾ",
      "",
      "GPS points, digital farm boundaries, area calculations, maps, NDVI/NDMI and satellite observations are agricultural-management tools only. They are NOT legal surveys, title documents, possession records, boundary certificates, crop-loss certificates, valuation reports, insurance assessments or government records.",
      "",
      "GPS പോയിന്റുകൾ, ഡിജിറ്റൽ അതിർത്തികൾ, വിസ്തീർണ്ണ കണക്കുകൾ, മാപ്പുകൾ, NDVI/NDMI, സാറ്റലൈറ്റ് വിവരങ്ങൾ കാർഷിക മാനേജ്മെന്റിനായി മാത്രം. അവ നിയമപരമായ സർവേ, ഉടമസ്ഥാവകാശ രേഖ, കൈവശ രേഖ, അതിർത്തി സർട്ടിഫിക്കറ്റ്, വിളനഷ്ട സർട്ടിഫിക്കറ്റ്, ഇൻഷുറൻസ് വിലയിരുത്തൽ അല്ല.",
      "",
      "7️⃣ Authorised land access / ഭൂമി പ്രവേശനാനുമതി",
      "",
      "VIEW ONLY or FARM MANAGEMENT permission provides digital service access only. It does not create or transfer ownership, possession, tenancy, agency, title, inheritance or any other legal interest in land.",
      "",
      "VIEW ONLY അല്ലെങ്കിൽ FARM MANAGEMENT അനുമതി ഡിജിറ്റൽ സേവന പ്രവേശനം മാത്രമാണ് നൽകുന്നത്. അതിലൂടെ ഉടമസ്ഥാവകാശം, കൈവശാവകാശം, വാടകാവകാശം, അവകാശപാരമ്പര്യം തുടങ്ങിയ നിയമാവകാശങ്ങൾ സൃഷ്ടിക്കപ്പെടുകയോ കൈമാറുകയോ ചെയ്യില്ല."
    ].join("\n")
  );

  await sendWhatsAppMessage(
    from,
    [
      "8️⃣ User responsibilities / ഉപയോക്താവിന്റെ ഉത്തരവാദിത്വം",
      "",
      "Users must provide information honestly and must not impersonate another person, provide fraudulent land claims, misuse another person's information, bypass access controls, attempt unauthorised access, introduce malicious code, interfere with the service, use BhoomiMitra for unlawful activity or violate another person's rights.",
      "",
      "ഉപയോക്താക്കൾ യഥാർത്ഥ വിവരങ്ങൾ നൽകണം. വ്യാജ വ്യക്തിത്വം, വ്യാജ ഭൂമി അവകാശവാദം, അനധികൃത ഡാറ്റ പ്രവേശനം, ഹാക്കിംഗ് ശ്രമം, ദോഷകരമായ കോഡ്, സേവന തടസം, നിയമവിരുദ്ധ പ്രവർത്തനം എന്നിവ അനുവദനീയമല്ല.",
      "",
      "Suspected misuse, fraud, unauthorised access or unlawful activity may result in restriction or suspension of access and may be reported to competent authorities where required or permitted by law.",
      "",
      "9️⃣ Photos, voice and publicity / ചിത്രങ്ങൾ, ശബ്ദം, പ്രചാരണം",
      "",
      "Photos, voice messages and information submitted for advisory or diagnostic purposes are not automatically authorised for advertisements, publicity or social-media publication. Separate permission should be obtained where required.",
      "",
      "ഉപദേശത്തിനായി നൽകിയ ചിത്രങ്ങൾ, ശബ്ദസന്ദേശങ്ങൾ, വിവരങ്ങൾ എന്നിവ പരസ്യം, പ്രചാരണം, സോഷ്യൽ മീഡിയ പ്രസിദ്ധീകരണം എന്നിവയ്ക്കുള്ള സ്വയമേവയുള്ള അനുമതിയായി കണക്കാക്കില്ല.",
      "",
      "🔟 Correction, consent and deletion / തിരുത്തൽ, സമ്മതം, ഇല്ലാതാക്കൽ",
      "",
      "Subject to applicable law, identity verification, legitimate retention requirements and technical feasibility, users may request correction of inaccurate personal information, withdrawal of consent or deletion of eligible personal data.",
      "",
      "ബാധകമായ നിയമം, തിരിച്ചറിയൽ പരിശോധന, നിയമപരമായ രേഖസംരക്ഷണ ആവശ്യങ്ങൾ, സാങ്കേതിക സാധുത എന്നിവയ്ക്ക് വിധേയമായി വ്യക്തിഗത വിവരങ്ങൾ തിരുത്തൽ, സമ്മതം പിൻവലിക്കൽ, അനുവദനീയമായ വിവരങ്ങൾ ഇല്ലാതാക്കൽ എന്നിവ അഭ്യർത്ഥിക്കാം.",
      "",
      "Withdrawal of consent may prevent BhoomiMitra from continuing services that require the relevant information.",
      "",
      "1️⃣1️⃣ Retention / വിവരസംരക്ഷണ കാലയളവ്",
      "",
      "Information may be retained for as long as reasonably necessary for the stated purposes, service records, security, dispute prevention, legal compliance or other lawful requirements, and thereafter deleted or anonymised where appropriate.",
      "",
      "1️⃣2️⃣ Third-party services / മൂന്നാംകക്ഷി സേവനങ്ങൾ",
      "",
      "BhoomiMitra may depend on WhatsApp/Meta, cloud hosting, AI, maps, weather, market, satellite and other external systems. Their availability, accuracy, security and independent processing may also be governed by their own terms and policies.",
      "",
      "1️⃣3️⃣ Liability / ഉത്തരവാദിത്വപരിധി",
      "",
      "To the extent permitted by applicable law, BhoomiMitra and its authorised operating or technology participants shall not be responsible for indirect, consequential or business losses arising solely from reliance on advisory information, unavoidable third-party outages or circumstances beyond reasonable control.",
      "",
      "Nothing in this policy excludes any responsibility that cannot lawfully be excluded, including responsibility imposed by applicable law.",
      "",
      "1️⃣4️⃣ Applicable law / ബാധകമായ നിയമം",
      "",
      "This service is intended to operate in accordance with applicable laws of India, including data-protection, information-technology, cyber-security and other laws, rules, directions and lawful orders as applicable and as brought into force.",
      "",
      "ഈ സേവനം ഇന്ത്യയിൽ ബാധകമായ ഡാറ്റ സംരക്ഷണം, വിവരസാങ്കേതികവിദ്യ, സൈബർ സുരക്ഷ എന്നിവയുൾപ്പെടെയുള്ള നിയമങ്ങൾ, ചട്ടങ്ങൾ, നിർദ്ദേശങ്ങൾ, നിയമാനുസൃത ഉത്തരവുകൾ എന്നിവയ്ക്ക് വിധേയമാണ്.",
      "",
      "For the pilot, the formal operator/Data Fiduciary and technology-partner details will be finalised and published before public launch.",
      "",
      "പൈലറ്റ് ഘട്ടത്തിന് ശേഷം പൊതുവായ ലോഞ്ചിന് മുമ്പ് ഔദ്യോഗിക ഓപ്പറേറ്റർ/Data Fiduciary, സാങ്കേതിക പങ്കാളി വിവരങ്ങൾ പ്രസിദ്ധീകരിക്കും.",
      "",
      "1️⃣5️⃣ Consent / സമ്മതം",
      "",
      "Type AGREE if you have read and accept this User Agreement & Privacy Policy.",
      "ഈ നയം വായിച്ച് അംഗീകരിക്കുന്നുവെങ്കിൽ AGREE എന്ന് ടൈപ്പ് ചെയ്യുക.",
      "",
      "Type DECLINE if you do not accept.",
      "അംഗീകരിക്കുന്നില്ലെങ്കിൽ DECLINE എന്ന് ടൈപ്പ് ചെയ്യുക."
    ].join("\n")
  );

  await bhoomiMitraUI.sendConsentPrompt(from);
return;
}

await bhoomiMitraUI.sendConsentPrompt(from);
return;
}
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
    logSafeError(
      "Boundary completion error.",
      boundaryCompleteError
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

    voiceTranscriptionSucceeded = Boolean(
      voiceResult && voiceResult.success && voiceResult.text
    );

    userText = voiceResult && voiceResult.text
        ? voiceResult.text
        : "Voice transcription failed.";

    console.log("Voice transcription completed.", {
      success: voiceTranscriptionSucceeded
    });
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

const photoClaim = await claimPhotoAnalysis(from, message.id);
if (!photoClaim.allowed) return;

let photoResult;
try {
  photoResult = await photoVision({
    mediaId,
    from,
    caption: photoContext
  });
  await settlePhotoAnalysis(photoClaim, Boolean(photoResult && photoResult.success));
} catch (error) {
  await settlePhotoAnalysis(photoClaim, false);
  throw error;
}

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

const pendingPhotoExpertAdvice =
  expertAdviceSessions[from];

if (
  pendingPhotoExpertAdvice &&
  pendingPhotoExpertAdvice.step === "awaiting_problem"
) {
  const photoProblem = String(caption || "").trim() ||
    "Farmer submitted a crop or animal problem photo for expert review.";
  const rememberedPhotoProblem =
    rememberRecentExpertProblem(
      recentExpertProblems,
      from,
      {
        text: photoProblem,
        timestamp: Date.now(),
        crop: captionCrop || "",
        category: "Photo Diagnosis",
        detectedIntent: "general_agriculture"
      }
    );
  const language = expertAdviceLanguage(from);

  pendingPhotoExpertAdvice.problem = photoProblem;
  pendingPhotoExpertAdvice.crop = captionCrop || "";
  pendingPhotoExpertAdvice.category = "Photo Diagnosis";
  pendingPhotoExpertAdvice.aiReply = photoReply;
  pendingPhotoExpertAdvice.mediaIds = [mediaId];
  pendingPhotoExpertAdvice.recentProblemTimestamp =
    rememberedPhotoProblem
      ? rememberedPhotoProblem.timestamp
      : undefined;
  pendingPhotoExpertAdvice.step = "awaiting_confirmation";
  pendingPhotoExpertAdvice.updatedAt = Date.now();

  if (pendingPhotoExpertAdvice.mode !== "direct") {
    await sendWhatsAppMessage(from, photoReply);
  }

  await bhoomiMitraUI.sendExpertConfirmation(
    from,
    language,
    pendingPhotoExpertAdvice.mode === "direct"
  );
  return;
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
  logSafeError("Background photo logging error.", error);
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

        const photoClaim = await claimPhotoAnalysis(from, message.id);
        if (!photoClaim.allowed) return;

        let photoResult;
        try {
            photoResult = await photoVision({
                mediaId,
                from,
                caption
            });
            await settlePhotoAnalysis(photoClaim, Boolean(photoResult && photoResult.success));
        } catch (error) {
            await settlePhotoAnalysis(photoClaim, false);
            throw error;
        }

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
      logSafeError("Boundary GPS capture error.", boundaryError);

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
      logSafeError("Weather location error.", weatherError);

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
      logSafeError("Soil location error.", soilError);

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

const pendingTrainingRequest = trainingRequestSessions[from];

if (
  animalHusbandrySessions[from] &&
  (message.type === "audio" || message.type === "voice")
) {
  if (!voiceTranscriptionSucceeded) {
    await sendWhatsAppMessage(
      from,
      animalFlowMessage(
        animalHusbandrySessions[from].language,
        "The voice message could not be transcribed. Please send it again or type your answer.",
        "വോയ്സ് സന്ദേശം മനസ്സിലാക്കാനായില്ല. വീണ്ടും അയയ്ക്കുക അല്ലെങ്കിൽ മറുപടി ടൈപ്പ് ചെയ്യുക."
      )
    );
    return;
  }
  await completeAnimalHusbandryInput(from, userText, message.id);
  return;
}

if (
  farmAlertSessions[from] &&
  farmAlertSessions[from].step === "awaiting_operation_date" &&
  (message.type === "audio" || message.type === "voice")
) {
  await completeFarmAlertTextInput(from, userText, message.id);
  return;
}

if (
  pendingTrainingRequest &&
  (
    message.type === "audio" ||
    message.type === "voice"
  )
) {
  const language = pendingTrainingRequest.language || "English";
  const isMalayalam = language === "Malayalam";

  if (
    (message.type === "audio" || message.type === "voice") &&
    !voiceTranscriptionSucceeded
  ) {
    await sendWhatsAppMessage(
      from,
      isMalayalam
        ? "വോയ്സ് സന്ദേശം മനസ്സിലാക്കാനായില്ല. ദയവായി വീണ്ടും അയയ്ക്കുകയോ ആവശ്യം ടൈപ്പ് ചെയ്യുകയോ ചെയ്യുക."
        : "The voice message could not be transcribed. Please send it again or type your training need."
    );
    return;
  }

  const trainingInputHandled = await completeTrainingRequestInput(
    from,
    userText,
    "voice"
  );
  if (trainingInputHandled) return;
}

const pendingVoiceSchemeSearch = schemeSearchSessions[from];

if (
  pendingVoiceSchemeSearch &&
  pendingVoiceSchemeSearch.step === "awaiting_query" &&
  (message.type === "audio" || message.type === "voice")
) {
  const language = pendingVoiceSchemeSearch.language || "English";
  if (!voiceTranscriptionSucceeded) {
    await sendWhatsAppMessage(
      from,
      language === "Malayalam"
        ? "വോയ്സ് സന്ദേശം മനസ്സിലാക്കാനായില്ല. വീണ്ടും അയയ്ക്കുകയോ വിഷയം ടൈപ്പ് ചെയ്യുകയോ ചെയ്യുക."
        : "The voice message could not be transcribed. Please send it again or type the topic."
    );
    return;
  }
  await completeSchemeSearch(from, userText, language);
  return;
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
  pendingLanguageSelections[from] = {
    includeWelcome: false
  };

  await bhoomiMitraUI.sendLanguageSelection(
    from,
    { includeWelcome: false }
);

  return;
}

if (pendingLanguageSelections[from]) {
  const selectedLanguage =
    parseLanguageSelection(
      userText
    );

  if (!selectedLanguage) {
   await bhoomiMitraUI.sendLanguageSelection(
     from,
     { includeWelcome: false }
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
  }

  await sendWhatsAppMessage(
  from,
  languageConfirmation
);

const registrationAccessAfterLanguageSelection =
  await resolveCurrentUserRegistration(from);

await sendStatusAwareHome(
  from,
  selectedLanguage,
  registrationAccessAfterLanguageSelection,
  isLimitedAccessState(registrationAccessAfterLanguageSelection)
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
    const languageAccess =
      await resolveCurrentUserRegistration(from);
    const missingPreferenceAction =
      getMissingPreferenceAction(languageAccess);

    if (missingPreferenceAction === "INFER_WITHOUT_WELCOME") {
      userLanguagePreferences[from] =
        detectLanguage(userText, "Malayalam");
    } else {
      const includeWelcome =
        missingPreferenceAction === "WELCOME_AND_SELECT";

      pendingLanguageSelections[from] = {
        includeWelcome: includeWelcome
      };

      if (includeWelcome) {
        await bhoomiMitraUI.sendOptionalWelcomeMedia(from);
      }

     await bhoomiMitraUI.sendLanguageSelection(
       from,
       { includeWelcome: includeWelcome }
  );

      return;
    }
  }
}
const regReply =
  await handleRegistration(
    from,
    userText
  );

if (regReply) {
  await routeRegistrationWebhookResult({
    registrationResult: regReply,
    from,
    userText,
    language:
      userLanguagePreferences[from] ||
      "Malayalam",
    sendMessage: sendWhatsAppMessage,
    resolveRegistrationStatus:
      resolveCurrentUserRegistration,
    sendHome: sendStatusAwareHome,
    logRegistration: logAI,
    onLogError: function (error) {
      logSafeError(
        "Background registration logging error.",
        error
      );
    }
  });

  return;
}    
 const personalResult =
  await handlePersonalRecords({
    from,
    phone: from,
    userText,
    language:
      userLanguagePreferences[from] ||
      "Malayalam",
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

  if (
    personalResult.showRegistrationPath
  ) {
    await bhoomiMitraUI.sendProfileMenu(
      from,
      userLanguagePreferences[from] ===
        "English"
        ? "English"
        : "Malayalam"
    );
  }

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
  pendingLanguageSelections[from] = {
    includeWelcome: false
  };

  await bhoomiMitraUI.sendLanguageSelection(
    from,
    { includeWelcome: false }
);
  return;
}
if (isMenuCommand(userText)) {
  const menuAccess = await resolveCurrentUserRegistration(from);

  userMenus[from] =
    createMenuSession();

  const welcomeLanguage = userLanguagePreferences[from] || "Malayalam";
  if (
    shouldSendRegisteredHelpPrompt(
      menuAccess,
      userText,
      message.type
    )
  ) {
    await bhoomiMitraUI.sendRegisteredHelpPrompt(
      from,
      welcomeLanguage
    );
    return;
  }

  await sendStatusAwareHome(
    from,
    welcomeLanguage,
    menuAccess,
    isLimitedAccessState(menuAccess)
  );

  return;
}

const naturalFeatureEntry = getNaturalFeatureEntry(userText);

if (
  [
    "TRAINING",
    "SCHEMES",
    "MY_ANIMALS",
    "ANIMAL_REGISTRATION",
    "CROP_ALERTS",
    "SATELLITE",
    "FARM"
  ].includes(naturalFeatureEntry)
) {
  const naturalAccess = await resolveCurrentUserRegistration(from);
  if (
    !hasRegisteredFarmerAccess(naturalAccess)
  ) {
    if (naturalAccess.state === USER_REGISTRATION_STATES.REGISTERED_SERVICE_MEMBER) {
      await sendWhatsAppMessage(
        from,
        userLanguagePreferences[from] === "Malayalam"
          ? "ഈ സേവനത്തിന് സജീവവും പൂർണ്ണവുമായ കർഷക രജിസ്ട്രേഷൻ ആവശ്യമാണ്. നിങ്ങളുടെ നിലവിലെ സേവന അംഗത്വം മാറ്റിയിട്ടില്ല."
          : "This service requires a complete active farmer registration. Your existing service membership has not been changed.",
        { skipPreferredLanguageConversion: true }
      );
      await sendStatusAwareHome(
        from,
        userLanguagePreferences[from] || "English",
        naturalAccess,
        false
      );
    } else {
      await sendStatusAwareHome(
        from,
        userLanguagePreferences[from] || "English",
        naturalAccess,
        true
      );
    }
    return;
  }
}

if (naturalFeatureEntry === "TRAINING") {
  delete schemeSearchSessions[from];
  await sendTrainingHome(
    from,
    userLanguagePreferences[from] || "English"
  );
  return;
}

if (naturalFeatureEntry === "SCHEMES") {
  delete trainingRequestSessions[from];
  await bhoomiMitraUI.sendSchemesMenu(
    from,
    userLanguagePreferences[from] || "English"
  );
  return;
}

if (naturalFeatureEntry === "MY_ANIMALS") {
  await handleAnimalHusbandryAction({
    action: { action: "MY_ANIMALS" },
    from: from,
    sourceMessageId: message.id
  });
  return;
}

if (naturalFeatureEntry === "ANIMAL_REGISTRATION") {
  await handleAnimalHusbandryAction({
    action: { action: "REGISTER" },
    from: from,
    sourceMessageId: message.id
  });
  return;
}

if (naturalFeatureEntry === "CROP_ALERTS") {
  await handleCropFarmAction({
    cropFarmAction: { action: "ALERTS" },
    from: from,
    sourceMessageId: message.id
  });
  return;
}

if (naturalFeatureEntry === "SATELLITE") {
  userMenus[from] = userMenus[from] || createMenuSession();
  userMenus[from].step = "satellite_gps_menu";
  userMenus[from].currentService = "farm";
  userMenus[from].updatedAt = Date.now();
  await bhoomiMitraUI.sendSatelliteGpsMenu(
    from,
    userLanguagePreferences[from] || "English"
  );
  return;
}

if (naturalFeatureEntry === "MARKET") {
  await bhoomiMitraUI.sendMarketMenu(
    from,
    userLanguagePreferences[from] || "English"
  );
  return;
}

if (naturalFeatureEntry === "FARM") {
  await bhoomiMitraUI.sendFarmMenu(
    from,
    userLanguagePreferences[from] || "English"
  );
  return;
}

if (naturalFeatureEntry === "HELP") {
  await bhoomiMitraUI.sendHelpMenu(
    from,
    userLanguagePreferences[from] || "English"
  );
  return;
}

if (shouldShowWhatsNew(naturalFeatureEntry)) {
  await showWhatsNew(
    from,
    userLanguagePreferences[from] || "English",
    true
  );
  return;
}

if (["WEATHER", "SOIL"].includes(naturalFeatureEntry)) {
  const selectionText = naturalFeatureEntry === "WEATHER" ? "4" : "3";
  const selections = parseServiceSelections(selectionText);
  userMenus[from] = startSelectedServices(
    userMenus[from] || createMenuSession(),
    selections
  );
  await sendWhatsAppMessage(
    from,
    getServicePrompt(userMenus[from].currentService)
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
  const landRegistrationAccess =
    await resolveCurrentUserRegistration(from);

  if (!hasRegisteredFarmerAccess(landRegistrationAccess)) {
    await sendStatusAwareHome(
      from,
      userLanguagePreferences[from] || "English",
      landRegistrationAccess,
      true
    );
    return;
  }

  activeFarmMenu.landRegistration = {
    ...(activeFarmMenu.landRegistration || {}),
    farmerId: landRegistrationAccess.farmer.id
  };

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
  const farmAccess =
    await resolveCurrentUserRegistration(from);

  if (!hasRegisteredFarmerAccess(farmAccess)) {
    await sendStatusAwareHome(
      from,
      userLanguagePreferences[from] || "English",
      farmAccess,
      true
    );
    return;
  }

  activeFarmMenu.farmerId = farmAccess.farmer.id;

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

    activeFarmMenu.landRegistration = {
      farmerId: farmAccess.farmer.id
    };

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
      farmerId: farmAccess.farmer.id
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
if (farmMenuChoice === "4" || farmMenuChoice === "5") {
  await handleCropFarmAction({
    cropFarmAction: {
      action: farmMenuChoice === "4" ? "REGISTER" : "HISTORY"
    },
    from: from,
    sourceMessageId: message.id
  });
  return;
}
if (["3", "6", "7"].includes(farmMenuChoice)) {
  const actionByChoice = {
    "3": "UPDATE_LAND",
    "6": "ACTIVITIES",
    "7": "FARM_SUMMARY"
  };
  await handleCropFarmAction({
    cropFarmAction: { action: actionByChoice[farmMenuChoice] },
    from,
    sourceMessageId: message.id
  });
  return;
}
if (farmMenuChoice === "8") {
  activeFarmMenu.currentService =
    "soil";
  activeFarmMenu.step =
    "processing_services";
  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  await sendWhatsAppMessage(
    from,
    getServicePrompt("soil")
  );

  return;
}
if (String(userText || "").trim() === "9") { 
activeFarmMenu.step =
  "satellite_gps_menu";

activeFarmMenu.updatedAt =
  Date.now();

userMenus[from] =
  activeFarmMenu;

await bhoomiMitraUI.sendSatelliteGpsMenu(
  from,
  userLanguagePreferences[from] || "English"
);

return;
}
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
  const satelliteAccess =
    await resolveCurrentUserRegistration(from);

  if (!hasRegisteredFarmerAccess(satelliteAccess)) {
    await sendStatusAwareHome(
      from,
      userLanguagePreferences[from] || "English",
      satelliteAccess,
      true
    );
    return;
  }

  activeFarmMenu.farmerId = satelliteAccess.farmer.id;

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
    farmerId:
      satelliteAccess.farmer.id
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
    logSafeError("View land list error.", landListError);

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

  const boundaryStatusLanguage =
    userLanguagePreferences[from] ||
    "English";
  const boundaryStatusIsEnglish =
    String(boundaryStatusLanguage)
      .toLowerCase() ===
    "english";

  await sendWhatsAppMessage(
    from,
    boundaryStatusIsEnglish
      ? [
          "📍 Boundary Status",
          "",
          "Please enter the Land ID.",
          "",
          "Example:",
          "BM-L-000003",
          "",
          "Type CANCEL or BACK to return."
        ].join("\n")
      : [
          "📍 അതിർത്തി നില",
          "",
          "ഭൂമി ID നൽകുക.",
          "",
          "ഉദാഹരണം:",
          "BM-L-000003",
          "",
          "മടങ്ങാൻ CANCEL അല്ലെങ്കിൽ BACK നൽകുക."
        ].join("\n")
  );

  return;
}

  // 4 - VIEW GPS DETAILS
if (satelliteChoice === "4") {
  activeFarmMenu.step =
    "gps_details_select_land";
  activeFarmMenu.currentService = "farm";

  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  const gpsDetailsLanguage =
    userLanguagePreferences[from] || "English";
  const gpsDetailsIsEnglish =
    String(gpsDetailsLanguage).toLowerCase() ===
    "english";

  await sendWhatsAppMessage(
    from,
    gpsDetailsIsEnglish
      ? [
          "📍 GPS Details",
          "",
          "Please enter the registered Land ID.",
          "",
          "Example:",
          "BM-L-000003",
          "",
          "Type CANCEL or BACK to return."
        ].join("\n")
      : [
          "📍 GPS വിവരങ്ങൾ",
          "",
          "രജിസ്റ്റർ ചെയ്ത ഭൂമി ID നൽകുക.",
          "",
          "ഉദാഹരണം:",
          "BM-L-000003",
          "",
          "മടങ്ങാൻ CANCEL അല്ലെങ്കിൽ BACK നൽകുക."
        ].join("\n")
  );

  return;
}
// A - MANAGE LAND ACCESS
if (satelliteChoice === "A") {
  activeFarmMenu.step =
    "land_access_menu";

  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  await sendWhatsAppMessage(
    from,
    [
      "👥 Land Access Management",
      "",
      "A. Add authorized person",
      "B. View authorized persons",
      "C. Change permission",
      "D. Revoke access",
      "E. Back",
      "",
      "Reply with A, B, C, D or E."
    ].join("\n")
  );

  return;
}  
 // 5 - SATELLITE FARM HEALTH
if (satelliteChoice === "5") {
  activeFarmMenu.step =
    "satellite_health_select_land";
  activeFarmMenu.currentService = "farm";

  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  await sendWhatsAppMessage(
    from,
    formatSatelliteSelectionPrompt(
      userLanguagePreferences[from] || "English"
    )
  );

  return;
}

  // 6 - SATELLITE OBSERVATION HISTORY
if (satelliteChoice === "6") {
  activeFarmMenu.step =
    "satellite_history_select_land";
  activeFarmMenu.currentService = "farm";

  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  await sendWhatsAppMessage(
    from,
    formatSatelliteSelectionPrompt(
      userLanguagePreferences[from] || "English",
      true
    )
  );

  return;
}

  // 7 - BACK
  if (satelliteChoice === "7") {
    activeFarmMenu.step =
      "processing_services";

    activeFarmMenu.currentService =
      "farm";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    await bhoomiMitraUI.sendLandManagementMenu(
      from,
      userLanguagePreferences[from] || "English"
    );

    return;
  }

  await bhoomiMitraUI.sendSatelliteGpsMenu(
    from,
    userLanguagePreferences[from] || "English"
  );

return;
}

// =====================================================
// BOUNDARY STATUS - SELECT REGISTERED LAND
// =====================================================
if (
  activeFarmMenu &&
  !isMenuSessionExpired(activeFarmMenu) &&
  activeFarmMenu.step ===
    "boundary_status_select_land"
) {
  const preferredLanguage =
    userLanguagePreferences[from] ||
    "English";
  const mapBaseUrl =
    process.env.RENDER_EXTERNAL_HOSTNAME
      ? "https://" +
        process.env.RENDER_EXTERNAL_HOSTNAME
      : "";
  const boundaryStatusResult =
    await handleBoundaryStatusSelection({
      sheets,
      spreadsheetId:
        GOOGLE_SHEET_ID,
      landId: userText,
      farmerId:
        activeFarmMenu.farmerId ||
        "",
      whatsapp: from,
      language:
        preferredLanguage,
      mapBaseUrl,
      mapAccessToken:
        createLandMapAccessToken({
          secret: LAND_MAP_ACCESS_SECRET,
          landId: userText,
          farmerId:
            activeFarmMenu.farmerId || "",
          whatsapp: from
        })
    });

  await sendWhatsAppMessage(
    from,
    boundaryStatusResult.reply
  );

  if (
    boundaryStatusResult.returnToMenu
  ) {
    activeFarmMenu.step =
      "satellite_gps_menu";
    activeFarmMenu.updatedAt =
      Date.now();
    userMenus[from] =
      activeFarmMenu;

    await bhoomiMitraUI.sendSatelliteGpsMenu(
      from,
      preferredLanguage
    );
  }

  return;
}
// ============================================================
// LAND ACCESS MANAGEMENT MENU
// ============================================================
if (
  activeFarmMenu &&
  !isMenuSessionExpired(activeFarmMenu) &&
  activeFarmMenu.step ===
    "land_access_menu"
) {
  const accessChoice =
    String(userText || "")
      .trim()
      .toUpperCase();
  // A - ADD AUTHORIZED PERSON
if (accessChoice === "A") {
  activeFarmMenu.step =
    "land_access_add_select_land";

  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  await sendWhatsAppMessage(
    from,
    [
      "👤 Add Authorized Person",
      "",
      "Please enter your Land ID.",
      "",
      "Example:",
      "BM-L-000003",
      "",
      "Only the registered OWNER can add another person.",
      "Type CANCEL to stop."
    ].join("\n")
  );

  return;
}
  // E - BACK
  if (accessChoice === "E") {
    activeFarmMenu.step =
      "satellite_gps_menu";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    await bhoomiMitraUI.sendSatelliteGpsMenu(
      from,
      userLanguagePreferences[from] || "English"
    );

    return;
  }
}
 // ============================================================
// LAND ACCESS - ADD PERSON - SELECT LAND
// ============================================================

if (
  activeFarmMenu &&
  !isMenuSessionExpired(activeFarmMenu) &&
  activeFarmMenu.step ===
    "land_access_add_select_land"
) {
  const selectedLandId =
    String(userText || "")
      .trim()
      .toUpperCase();

  if (selectedLandId === "CANCEL") {
    activeFarmMenu.step =
      "land_access_menu";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    await sendWhatsAppMessage(
      from,
      "❌ Add authorized person cancelled."
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
        "⚠️ Please enter a valid Land ID.",
        "",
        "Example:",
        "BM-L-000003",
        "",
        "Type CANCEL to stop."
      ].join("\n")
    );

    return;
  }

  const ownerLand =
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
    !ownerLand ||
    !ownerLand.success
  ) {
    await sendWhatsAppMessage(
      from,
      "⚠️ This land was not found under your ownership. Only the registered OWNER can grant access."
    );

    return;
  }

  activeFarmMenu.accessLandId =
    selectedLandId;

  activeFarmMenu.step =
    "land_access_add_mobile";

  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  await sendWhatsAppMessage(
    from,
    [
      "👤 Authorized Person",
      "",
      "Land ID: " + selectedLandId,
      "",
      "Please enter the WhatsApp mobile number of the person you want to authorize.",
      "",
      "Example:",
      "1234567890",
      "",
      "Type CANCEL to stop."
    ].join("\n")
  );

  return;
}  
 // ============================================================
// LAND ACCESS - ADD PERSON - MOBILE
// ============================================================
if (
  activeFarmMenu &&
  !isMenuSessionExpired(activeFarmMenu) &&
  activeFarmMenu.step ===
    "land_access_add_mobile"
) {
  const rawMobile =
    String(userText || "")
      .trim();

  if (
    rawMobile.toUpperCase() === "CANCEL"
  ) {
    activeFarmMenu.step =
      "land_access_menu";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    await sendWhatsAppMessage(
      from,
      "❌ Add authorized person cancelled."
    );

    return;
  }

  const mobile =
    rawMobile
      .replace(/\D/g, "")
      .slice(-10);

  if (mobile.length !== 10) {
    await sendWhatsAppMessage(
      from,
      [
        "⚠️ Please enter a valid 10-digit WhatsApp mobile number.",
        "",
        "Example:",
        "1234567890",
        "",
        "Type CANCEL to stop."
      ].join("\n")
    );

    return;
  }

  activeFarmMenu.accessMobile =
    mobile;

  activeFarmMenu.step =
    "land_access_add_permission";

  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  await sendWhatsAppMessage(
    from,
    [
      "👤 Authorized person details",
      "",
      "Choose permission:",
      "",
      "VIEW",
      "MANAGE",
      "",
      "VIEW = can view permitted land information.",
      "MANAGE = can perform permitted farm operations.",
      "",
      "MANAGE does not give owner-level control.",
      "Only the OWNER can add, change or revoke access.",
      "",
      "Type CANCEL to stop."
    ].join("\n")
  );

  return;
}
// ============================================================
// LAND ACCESS - ADD PERSON - MOBILE
// ============================================================
if (
  activeFarmMenu &&
  !isMenuSessionExpired(activeFarmMenu) &&
  activeFarmMenu.step ===
    "land_access_add_mobile"
) {
  const rawMobile =
    String(userText || "")
      .trim();

  if (
    rawMobile.toUpperCase() === "CANCEL"
  ) {
    activeFarmMenu.step =
      "land_access_menu";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    await sendWhatsAppMessage(
      from,
      "❌ Add authorized person cancelled."
    );

    return;
  }

  const mobile =
    rawMobile
      .replace(/\D/g, "")
      .slice(-10);

  if (mobile.length !== 10) {
    await sendWhatsAppMessage(
      from,
      [
        "⚠️ Please enter a valid 10-digit WhatsApp mobile number.",
        "",
        "Example:",
        "1234567890",
        "",
        "Type CANCEL to stop."
      ].join("\n")
    );

    return;
  }

  activeFarmMenu.accessMobile =
    mobile;

  activeFarmMenu.step =
    "land_access_add_permission";

  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  await sendWhatsAppMessage(
    from,
    [
      "👤 Authorized person details",
      "",
      "Choose permission:",
      "",
      "VIEW",
      "MANAGE",
      "",
      "VIEW = can view permitted land information.",
      "MANAGE = can perform permitted farm operations.",
      "",
      "MANAGE does not give owner-level control.",
      "Only the OWNER can add, change or revoke access.",
      "",
      "Type CANCEL to stop."
    ].join("\n")
  );

  return;
}
 // ============================================================
// LAND ACCESS - ADD PERSON - PERMISSION
// ============================================================
if (
  activeFarmMenu &&
  !isMenuSessionExpired(activeFarmMenu) &&
  activeFarmMenu.step ===
    "land_access_add_permission"
) {
  const permissionInput =
    String(userText || "")
      .trim()
      .toUpperCase();

  if (permissionInput === "CANCEL") {
    activeFarmMenu.step =
      "land_access_menu";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    await sendWhatsAppMessage(
      from,
      "❌ Add authorized person cancelled."
    );

    return;
  }

  let accessLevel = "";

  if (
    permissionInput === "VIEW" ||
    permissionInput === "VIEW ONLY"
  ) {
    accessLevel = "VIEW";
  }

  if (
    permissionInput === "MANAGE" ||
    permissionInput === "FARM MANAGEMENT"
  ) {
    accessLevel = "MANAGE";
  }

  if (!accessLevel) {
    await sendWhatsAppMessage(
      from,
      [
        "⚠️ Please choose one permission:",
        "",
        "VIEW ONLY",
        "FARM MANAGEMENT",
        "",
        "Type CANCEL to stop."
      ].join("\n")
    );

    return;
  }

  const grantResult =
  await grantLandAccess({
    sheets,
    spreadsheetId:
      GOOGLE_SHEET_ID,
    landId:
      activeFarmMenu.accessLandId,
    ownerFarmerId:
      activeFarmMenu.farmerId || "",
    ownerWhatsapp:
      from,
    authorizedName:
      "",
    authorizedWhatsapp:
      activeFarmMenu.accessMobile,
    relationship:
      "",
    accessLevel:
      accessLevel,
    grantedBy:
      from,
    remarks:
      "Granted by land owner through BhoomiMitra"
  });

  if (
    !grantResult ||
    !grantResult.success
  ) {
    await sendWhatsAppMessage(
      from,
      grantResult &&
      grantResult.error
        ? "⚠️ " + grantResult.error
        : "⚠️ Access could not be granted."
    );

    return;
  }

  const maskedMobile =
    "**" +
    String(activeFarmMenu.accessMobile || "")
      .slice(-4);

  activeFarmMenu.accessLandId = null;
  activeFarmMenu.accessMobile = null;

  activeFarmMenu.step =
    "land_access_menu";

  activeFarmMenu.updatedAt =
    Date.now();

  userMenus[from] =
    activeFarmMenu;

  await sendWhatsAppMessage(
    from,
    [
      "✅ Land access granted.",
      "",
      "Mobile: " + maskedMobile,
      "Permission: " +
        (
          accessLevel === "VIEW"
            ? "VIEW ONLY"
            : "FARM MANAGEMENT"
        ),
      "",
      "Only the OWNER can change or revoke this access."
    ].join("\n")
  );

  return;
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
  const satelliteLanguage =
    userLanguagePreferences[from] ||
    "English";

  if (isSatelliteExitCommand(selectedLandId)) {
    activeFarmMenu.step =
      "satellite_gps_menu";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    await sendWhatsAppMessage(
      from,
      formatSatelliteCancelMessage(
        satelliteLanguage
      )
    );

    await bhoomiMitraUI.sendSatelliteGpsMenu(
      from,
      satelliteLanguage
    );

    return;
  }

  if (
    !isValidLandId(selectedLandId)
  ) {
    await sendWhatsAppMessage(
      from,
      formatSatelliteValidationMessage(
        satelliteLanguage
      )
    );

    return;
  }

  try {
  const accessibleHealth =
  await getAccessibleLand({
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
  !accessibleHealth ||
  !accessibleHealth.success
) {
  await sendWhatsAppMessage(
    from,
    formatSatelliteAccessMessage(
      satelliteLanguage
    )
  );

  return;
}

const healthResult =
  accessibleHealth.land;
const liveNdviResult =
  await getSentinel2Ndvi({
    geometry:
      healthResult.geoJSON
  });

if (
  !liveNdviResult ||
  !liveNdviResult.success
) {
  await sendWhatsAppMessage(
    from,
    formatSatelliteFailureMessage(
      liveNdviResult || {},
      satelliteLanguage
    )
  );

  return;
}

const saveResult =
  await saveSatelliteObservation({
    sheets,
    spreadsheetId:
      GOOGLE_SHEET_ID,

    landId:
      healthResult.landId,

    farmerId:
      activeFarmMenu.farmerId || "",

    farmName:
      healthResult.farmName || "",

    observationDate:
      liveNdviResult.observationDate,

    satelliteSource:
      liveNdviResult.satelliteSource ||
      "Sentinel-2 L2A",

    ndvi:
  liveNdviResult.averageNdvi !== undefined
    ? liveNdviResult.averageNdvi
    : "",

vegetationStatus:
  liveNdviResult.vegetationStatus || "",

moistureStatus:
  liveNdviResult.moistureStatus || "",

waterloggingStatus:
  liveNdviResult.waterloggingStatus || "",

stressStatus:
  liveNdviResult.stressStatus || "",

cloudCover:
  liveNdviResult.cloudCover !== undefined
    ? liveNdviResult.cloudCover
    : "",

    areaSqM:
      healthResult.measurements
        ? healthResult.measurements.squareMetres || ""
        : "",

    sceneId:
      liveNdviResult.sceneId || "",

    catalogCloudCover:
      liveNdviResult.catalogCloudCover !== undefined
        ? liveNdviResult.catalogCloudCover
        : "",

    validPixelPercent:
      liveNdviResult.validPixelPercent !== undefined
        ? liveNdviResult.validPixelPercent
        : "",

    averageNdmi:
      liveNdviResult.averageNdmi !== undefined &&
      liveNdviResult.averageNdmi !== null
        ? liveNdviResult.averageNdmi
        : "",

    imageQualityStatus:
      liveNdviResult.imageQualityStatus || "",

    healthSummary:
      liveNdviResult.healthSummary || "",

    areaCent:
      healthResult.measurements
        ? healthResult.measurements.cents || ""
        : "",

    areaAcre:
      healthResult.measurements
        ? healthResult.measurements.acres || ""
        : "",

    perimeterM:
      healthResult.measurements
        ? healthResult.measurements.perimeterMetres || ""
        : "",

    remarks:
      "Sentinel-2 farm health observation from WhatsApp"
  });

if (!saveResult || !saveResult.success) {
  throw new Error(
    saveResult && saveResult.error
      ? saveResult.error
      : "Satellite observation could not be saved."
  );
}

await sendWhatsAppMessage(
  from,
  formatSatelliteHealthReply({
    land: healthResult,
    result: liveNdviResult,
    language: satelliteLanguage,
    duplicate: Boolean(saveResult.duplicate)
  })
);

    activeFarmMenu.step =
      "satellite_gps_menu";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    await bhoomiMitraUI.sendSatelliteGpsMenu(
      from,
      satelliteLanguage
    );

    return;
  } catch (healthError) {
    logSafeError("Satellite farm health error.", healthError);

    await sendWhatsAppMessage(
      from,
      String(satelliteLanguage).toLowerCase() ===
        "english"
        ? "⚠️ Satellite crop health could not be loaded. Please try again."
        : "⚠️ സാറ്റലൈറ്റ് വിള ആരോഗ്യ വിവരം ലഭ്യമാക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുക."
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
  const historyLanguage =
    userLanguagePreferences[from] ||
    "English";

  if (isSatelliteExitCommand(selectedLandId)) {
    activeFarmMenu.step =
      "satellite_gps_menu";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    await sendWhatsAppMessage(
      from,
      formatSatelliteCancelMessage(
        historyLanguage,
        true
      )
    );

    await bhoomiMitraUI.sendSatelliteGpsMenu(
      from,
      historyLanguage
    );

    return;
  }

  if (
    !isValidLandId(selectedLandId)
  ) {
    await sendWhatsAppMessage(
      from,
      formatSatelliteValidationMessage(
        historyLanguage
      )
    );

    return;
  }

  try {
   const historyLandResult =
  await getAccessibleLandBoundaryStatus({
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
    formatSatelliteAccessMessage(
      historyLanguage
    )
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
    farmerId: "",
    limit: 5
  });


    if (!historyResult || !historyResult.success) {
      throw new Error(
        historyResult && historyResult.error
          ? historyResult.error
          : "Satellite history could not be loaded."
      );
    }

    await sendWhatsAppMessage(
      from,
      formatSatelliteHistoryReply({
        land: historyLandResult,
        history: historyResult,
        language: historyLanguage
      })
    );

    activeFarmMenu.step =
      "satellite_gps_menu";

    activeFarmMenu.updatedAt =
      Date.now();

    userMenus[from] =
      activeFarmMenu;

    await bhoomiMitraUI.sendSatelliteGpsMenu(
      from,
      historyLanguage
    );

    return;
  } catch (historyError) {
    logSafeError(
      "Satellite observation history error.",
      historyError
    );

    await sendWhatsAppMessage(
      from,
      String(historyLanguage).toLowerCase() ===
        "english"
        ? "⚠️ Satellite monitoring history could not be loaded. Please try again."
        : "⚠️ സാറ്റലൈറ്റ് നിരീക്ഷണ ചരിത്രം ലഭ്യമാക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുക."
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

    await bhoomiMitraUI.sendSatelliteGpsMenu(
      from,
      userLanguagePreferences[from] || "English"
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
  baseUrl && LAND_MAP_ACCESS_SECRET
    ? baseUrl +
      "/land-map/" +
      encodeURIComponent(
        mapResult.landId
      ) +
      "?access=" +
      encodeURIComponent(
        createLandMapAccessToken({
          secret: LAND_MAP_ACCESS_SECRET,
          landId: mapResult.landId,
          farmerId:
            activeFarmMenu.farmerId || "",
          whatsapp: from
        })
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

    await bhoomiMitraUI.sendSatelliteGpsMenu(
      from,
      userLanguagePreferences[from] || "English"
    );

    return;

  } catch (mapError) {
    logSafeError("View land map error.", mapError);

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
  const gpsDetailsLanguage =
    userLanguagePreferences[from] ||
    "English";
  const mapBaseUrl =
    process.env.RENDER_EXTERNAL_HOSTNAME
      ? "https://" +
        process.env.RENDER_EXTERNAL_HOSTNAME
      : "";
  const gpsDetailsResult =
    await handleGpsDetailsSelection({
      sheets,
      spreadsheetId: GOOGLE_SHEET_ID,
      landId: userText,
      farmerId:
        activeFarmMenu.farmerId || "",
      whatsapp: from,
      language: gpsDetailsLanguage,
      mapBaseUrl,
      mapAccessToken:
        createLandMapAccessToken({
          secret: LAND_MAP_ACCESS_SECRET,
          landId: userText,
          farmerId:
            activeFarmMenu.farmerId || "",
          whatsapp: from
        })
    });

  await sendWhatsAppMessage(
    from,
    gpsDetailsResult.reply
  );

  if (gpsDetailsResult.returnToMenu) {
    activeFarmMenu.step =
      "satellite_gps_menu";
    activeFarmMenu.currentService = "farm";
    activeFarmMenu.updatedAt =
      Date.now();
    userMenus[from] =
      activeFarmMenu;

    await bhoomiMitraUI.sendSatelliteGpsMenu(
      from,
      gpsDetailsLanguage
    );
  }

  return;
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
    logSafeError("Boundary start error.", boundaryStartError);

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

    await bhoomiMitraUI.sendMainMenu(
  from,
  userLanguagePreferences[from] || "English"
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
      language:
        userLanguagePreferences[from] ||
        "Malayalam",
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

    if (
      personalResult.showRegistrationPath
    ) {
      await bhoomiMitraUI.sendProfileMenu(
        from,
        userLanguagePreferences[from] ===
          "English"
          ? "English"
          : "Malayalam"
      );
    }

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

  const selectionAccess =
    await resolveCurrentUserRegistration(from);
  const guestSelectionKeys = new Set([
    "question",
    "photo",
    "soil",
    "weather",
    "market",
    "registration"
  ]);
  const containsRestrictedGuestSelection =
    selections.some(function (selection) {
      return !guestSelectionKeys.has(selection.key);
    });
  const containsFarmerOnlySelection =
    selections.some(function (selection) {
      return ["farm", "personal_records"].includes(selection.key);
    });

  if (
    (isLimitedAccessState(selectionAccess) && containsRestrictedGuestSelection) ||
    (
      selectionAccess.state === USER_REGISTRATION_STATES.REGISTERED_SERVICE_MEMBER &&
      containsFarmerOnlySelection
    )
  ) {
    if (selectionAccess.state === USER_REGISTRATION_STATES.REGISTERED_SERVICE_MEMBER) {
      await sendWhatsAppMessage(
        from,
        userLanguagePreferences[from] === "Malayalam"
          ? "ഈ സേവനത്തിന് സജീവവും പൂർണ്ണവുമായ കർഷക രജിസ്ട്രേഷൻ ആവശ്യമാണ്."
          : "This service requires a complete active farmer registration.",
        { skipPreferredLanguageConversion: true }
      );
      await sendStatusAwareHome(
        from,
        userLanguagePreferences[from] || "English",
        selectionAccess,
        false
      );
    } else {
      await sendStatusAwareHome(
        from,
        userLanguagePreferences[from] || "English",
        selectionAccess,
        true
      );
    }
    return;
  }

  if (
    selections.length === 1 &&
    selections[0].key === "expert"
  ) {
    await handleExpertAdviceAction({
      action: "START",
      from: from,
      sourceMessageId: message.id
    });
    return;
  }

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
  const consentResult =
    await getLatestConsent({
      sheets,
      spreadsheetId:
        GOOGLE_SHEET_ID,
      whatsapp:
        from
    });

  const hasAgreed =
    consentResult &&
    consentResult.success &&
    consentResult.found &&
    consentResult.consent &&
    consentResult.consent.consentStatus === "AGREED" &&
    consentResult.consent.agreementVersion === AGREEMENT_VERSION &&
    consentResult.consent.privacyPolicyVersion === PRIVACY_POLICY_VERSION;

  if (!hasAgreed) {
    userMenus[from] = {
      ...(userMenus[from] || {}),
      step:
        "privacy_consent_pending",
      updatedAt:
        Date.now()
    };

    await bhoomiMitraUI.sendConsentPrompt(from);
    return;
  }

 userMenus[from] = {
  ...(userMenus[from] || {}),
  step: "registration_active",
  updatedAt: Date.now()
};

const regReply =
  await handleRegistration(
    from,
    "register"
  );

if (regReply) {
  await sendWhatsAppMessage(
    from,
    regReply
  );

  return;
}
}
  if (
    selections.length === 0
  ) {
    await bhoomiMitraUI.sendMainMenu(
  from,
  userLanguagePreferences[from] || "English"
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
  const needsDistrict = await sendWeatherSheetReply(
    from,
    weatherText,
    userLanguagePreferences[from] || "English"
  );

  if (!needsDistrict) {
    activeWeatherMenu.currentService = null;
    activeWeatherMenu.step = "completed";
  }

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
    logSafeError("Service search logging error.", error);
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
    logSafeError("Service search logging error.", error);
  });

  return;
}    
const detectedIntent = detectIntent(userText);
console.log("Message intent detected.", {
  intent: detectedIntent || "unknown"
});

if (
  isDetailedFarmerProblem(userText) &&
  !isEscalationOnlyMessage(userText)
) {
  rememberRecentExpertProblem(
    recentExpertProblems,
    from,
    {
      text: userText,
      timestamp: Date.now(),
      crop:
        caseManager.extractRecognisedCrop(
          userText
        ),
      category: detectedIntent,
      detectedIntent: detectedIntent
    }
  );
}

const pendingExpertAdvice =
  expertAdviceSessions[from];

if (
  pendingExpertAdvice &&
  pendingExpertAdvice.step === "awaiting_problem"
) {
  const problemText = String(userText || "").trim();
  const language = expertAdviceLanguage(from);

  if (
    !isDetailedFarmerProblem(problemText) ||
    isEscalationOnlyMessage(problemText)
  ) {
    await sendWhatsAppMessage(
      from,
      language === "Malayalam"
        ? "വിദഗ്ധന് അയയ്ക്കേണ്ട വിള/മൃഗ പ്രശ്നം കുറച്ച് വിശദമായി വിവരിക്കുക."
        : "Please describe the crop or animal problem in a little more detail before it is sent to an expert."
    );
    return;
  }

  const recentProblem = getRecentExpertProblem(
    recentExpertProblems,
    from,
    EXPERT_PROBLEM_CONTEXT_MS
  );

  pendingExpertAdvice.problem = problemText;
  pendingExpertAdvice.crop =
    caseManager.extractRecognisedCrop(problemText) || "";
  pendingExpertAdvice.category = detectedIntent;
  pendingExpertAdvice.mediaIds = [];
  pendingExpertAdvice.recentProblemTimestamp =
    recentProblem && recentProblem.text === problemText
      ? recentProblem.timestamp
      : undefined;
  pendingExpertAdvice.updatedAt = Date.now();

  if (pendingExpertAdvice.mode === "direct") {
    pendingExpertAdvice.aiReply = "";
    pendingExpertAdvice.step = "awaiting_confirmation";
    await bhoomiMitraUI.sendExpertConfirmation(
      from,
      language,
      true
    );
    return;
  }

  const expertAiReply = await getAIReply(
    "The farmer's saved reply language is: " +
      language +
      ". Reply entirely in that language. Give a concise agricultural answer or summary in no more than five short sentences. Do not claim that an expert has already been assigned.\n\n" +
      problemText,
    "",
    ""
  );

  pendingExpertAdvice.aiReply = expertAiReply;
  pendingExpertAdvice.step = "awaiting_confirmation";
  pendingExpertAdvice.updatedAt = Date.now();

  await sendWhatsAppMessage(
    from,
    expertAiReply
  );
  await bhoomiMitraUI.sendExpertConfirmation(
    from,
    language,
    false
  );
  return;
}

const cropFarmNaturalLanguageAction = parseCropFarmNaturalLanguage(userText);

if (
  detectedIntent !== "weather" &&
  detectedIntent !== "market" &&
  cropFarmNaturalLanguageAction
) {
  await handleCropFarmAction({
    cropFarmAction: cropFarmNaturalLanguageAction,
    from: from,
    sourceMessageId: message.id
  });
  return;
}

if (
  detectedIntent !== "weather" &&
  detectedIntent !== "market" &&
  isAnimalNaturalLanguageQuery(userText)
) {
  const language = animalFlowLanguage(from);
  const farmer = await loadAnimalFarmer(from);
  let animalContext = "No verified linked animal record is available.";
  if (farmer) {
    const owned = await getOwnedAnimals({
      readSheetRows: readSheetRows,
      farmerId: farmer.memberId
    });
    if (owned.success && owned.animals.length) {
      animalContext = owned.animals.map(function (animal) {
        return [animal.animalId, animal.animalType, animal.breed, animal.sex, animal.age]
          .filter(Boolean)
          .join(" | ");
      }).join("; ");
    }
  }
  const animalReply = await getAIReply(
    "The farmer's saved reply language is " + language +
      ". Answer this direct animal-husbandry question entirely in that language. Use cautious Kerala-relevant veterinary guidance; do not claim a definitive diagnosis, do not invent medicine doses, and state urgent warning signs that require an immediate veterinarian when relevant. Linked animal context: " +
      animalContext + "\n\nQuestion: " + userText,
    "",
    ""
  );
  await sendWhatsAppMessage(from, animalReply);
  logAI(from, userText, animalReply, "animal_husbandry").catch(function (error) {
    logSafeError("Animal advisory logging error.", error);
  });
  return;
}

if (detectedIntent === "weather") {
  const needsDistrict = await sendWeatherSheetReply(
    from,
    userText,
    userLanguagePreferences[from] || "English"
  );
  if (needsDistrict) {
    userMenus[from] = {
      ...(userMenus[from] || createMenuSession()),
      currentService: "weather",
      updatedAt: Date.now()
    };
  }
  return;
}

// ================= MARKET MODULE =================
if (detectedIntent === "market") {
  let finalReply = "";

  try {
    const resolvedCommodity =
      await resolveCommodity(
        userText
      );

    if (!resolvedCommodity) {
      console.log("Market commodity could not be resolved.");

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

console.log("Market district detection completed.", {
  districtSpecified: Boolean(detectedDistrict)
});
      console.log("Market commodity resolved.");

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
          savedResult.usable === true &&
          (
            replyText.includes(
              requestedName
            ) ||
            replyText.includes(
              officialName
            )
          );

        if (
          !savedReplyIsValid
        ) {
          console.log(
            "Rejected unrelated saved market result."
          );
        }
      }

      if (
        savedReplyIsValid &&
        savedResult.isCurrent === true
      ) {
        finalReply =
          savedResult.reply;
      } else {
        console.log("Checking AGMARKNET.");

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
        } else if (savedReplyIsValid) {
          // The official source was unavailable or returned no matching
          // record. Preserve the last known price only with the stale-data
          // warning produced by the market module.
          finalReply = savedResult.reply;
        }
      }
    }
  } catch (marketError) {
    logSafeError("Market module error.", marketError);
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
  logSafeError("Background market logging error.", error);
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
  "The farmer's saved reply language is: " +
  preferredLanguage +
  ".\n" +
  "You MUST reply entirely in that saved language. " +
  "Ignore the language or script used in the current message. " +
  "If the saved language is Malayalam, reply in Malayalam script even when the farmer types English or Manglish. " +
  "If the saved language is English, reply entirely in English.\n\n" +
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
  let farmerProfile = null;

  try {
    farmerProfile =
      await findRegistrationByPhone(
        "farmer",
        from
      );
  } catch (profileError) {
    logSafeError(
      "Farmer profile lookup failed during expert escalation.",
      profileError
    );
  }

  const activePhotos =
    activeCase &&
    Array.isArray(activeCase.photos)
      ? activeCase.photos
      : [];
  const recentExpertProblem =
    getRecentExpertProblem(
      recentExpertProblems,
      from,
      EXPERT_PROBLEM_CONTEXT_MS
    );
  const expertProblemContext =
    resolveExpertProblemContext({
      currentText: userText,
      activeCase: activeCase,
      recentProblem:
        recentExpertProblem
          ? recentExpertProblem.text
          : ""
    });

  try {
    const assignmentResult =
      await assignExpertCase({
        caseData: {
          sourceMessageId: message.id,
          from: from,
          whatsapp: from,
          farmerId:
            farmerProfile && farmerProfile.memberId
              ? farmerProfile.memberId
              : "",
          farmerName:
            farmerProfile && farmerProfile.name
              ? farmerProfile.name
              : "",
          district:
            farmerProfile && farmerProfile.district
              ? farmerProfile.district
              : "",
          panchayath:
            farmerProfile && farmerProfile.panchayath
              ? farmerProfile.panchayath
              : "",
          crop:
            activeCase && activeCase.crop
              ? activeCase.crop
              : (
                  recentExpertProblem &&
                  recentExpertProblem.crop
                    ? recentExpertProblem.crop
                    :
                  farmerProfile && farmerProfile.service
                    ? farmerProfile.service
                    : ""
                ),
          problem:
            expertProblemContext.problem,
          farmerMessage: userText,
          caseSummary:
            expertProblemContext.caseSummary,
          aiDiagnosis: aiReply,
          aiConfidence: 60,
          priority: "High",
          imageIds: activePhotos
            .map(function (photo) {
              return photo && photo.mediaId
                ? photo.mediaId
                : "";
            })
            .filter(Boolean)
            .join(", "),
          mediaAvailable:
            activePhotos.length > 0,
          source: "WhatsApp",
          expertRequested: true,
          escalationReason:
            "Farmer requested expert assistance"
        },
        readSheetRows: readSheetRows,
        appendRow: function (sheetName, row) {
          return appendSafe(
            sheetName,
            row,
            { returnDetails: true }
          );
        },
        updateCase:
          updateExpertCaseByHeaders,
        sendExpertMessage:
          sendWhatsAppMessage
      });

    expertConfirmation =
      assignmentResult.farmerMessage ||
      "Your expert request is awaiting expert assignment.";

    if (
      assignmentResult.success &&
      recentExpertProblem &&
      (
        expertProblemContext.problemSource === "RECENT" ||
        recentExpertProblem.text ===
          expertProblemContext.problem
      )
    ) {
      consumeRecentExpertProblem(
        recentExpertProblems,
        from,
        recentExpertProblem.timestamp
      );
    }

    if (!assignmentResult.success) {
      console.error(
        "Expert assignment not completed.",
        { code: assignmentResult.code || "ASSIGNMENT_FAILED" }
      );
    }
  } catch (assignmentError) {
    logSafeError("Expert assignment failed.", assignmentError);

    expertConfirmation =
      "We could not complete your expert request right now. Please try again shortly.";
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

  aiSheetLogger.logFarmerQuery(
    from,
    userText,
    responseText,
    activeCase
      ? "case_followup"
      : "ai_reply"
  )
])
.catch(function (error) {
  logSafeError("Background AI logging error.", error);
});

} catch (error) {
  processingError = error;
  logSafeError("WhatsApp webhook processing failed.", error);
} finally {
  if (claimedMessageId) {
    try {
      if (processingError) {
        await webhookMessageLedger.release(claimedMessageId, claimedMessageToken);
      } else {
        await webhookMessageLedger.complete(claimedMessageId, claimedMessageToken);
      }
    } catch (ledgerError) {
      processingError = processingError || ledgerError;
      logSafeError(
        "WhatsApp message ledger update failed.",
        ledgerError
      );
    }
  }

  if (!res.headersSent) {
    res
      .status(processingError ? 500 : 200)
      .send(
        processingError
          ? "PROCESSING_FAILED"
          : "EVENT_RECEIVED"
      );
  }
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

      ...FARMER_HEADER_ALIASES
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
        "WhatsApp",
        "WhatsApp Number"
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
        "Status"
      ],

      verificationStatusHeaders: [
        "Verification_Status",
        "Verification Status",
        "Verification Level",
        "Verified"
      ],

      activeStatusHeaders: [
        "Active_Status",
        "Active Status",
        "Availability"
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
        "WhatsApp_No",
        "WhatsApp Number"
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
        "Status"
      ],

      verificationStatusHeaders: [
        "Verification_Status",
        "Verification Status",
        "Verification Level",
        "Verified"
      ],

      activeStatusHeaders: [
        "Active_Status",
        "Active Status",
        "Live Status",
        "Availability"
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
        "WhatsApp",
        "WhatsApp Number"
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
        "Status"
      ],

      verificationStatusHeaders: [
        "Verification_Status",
        "Verification Status",
        "Verification Level",
        "Verified"
      ],

      activeStatusHeaders: [
        "Active_Status",
        "Active Status",
        "Availability"
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
  phone,
  options
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
    headers,
    headerMap
  } = sheetData;

  const matchedRows =
    rows.slice(1).map(function (row, index) {
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

      return {
        row,
        rowNumber: index + 2,
        exactWhatsAppMatch:
          savedWhatsApp === incomingPhone,
        mobileMatch:
          savedMobile === incomingPhone
      };
    }).filter(function (match) {
      return (
        match.exactWhatsAppMatch ||
        Boolean(
          options &&
          options.allowMobileMatch &&
          match.mobileMatch
        )
      );
    });

  if (matchedRows.length > 1) {
    if (options && options.requireUnique) {
      return {
        success: false,
        alreadyRegistered: true,
        code: "REGISTRATION_PHONE_AMBIGUITY",
        matchCount: matchedRows.length
      };
    }
    return null;
  }

  const matchedEntry = matchedRows[0];
  const matchedRow = matchedEntry && matchedEntry.row;

  if (!matchedRow) {
    return null;
  }

  const memberId =
    getRegistrationValue(
      matchedRow,
      headerMap,
      config.idHeaders
    );
  const farmerStatuses =
    config.category === "farmer"
      ? readFarmerStatuses(
          matchedRow,
          headers,
          memberId
        )
      : null;
  const legacyStatus =
    getRegistrationValue(
      matchedRow,
      headerMap,
      config.statusHeaders
    );
  const verificationStatus = farmerStatuses
    ? farmerStatuses.verificationStatus
    : getRegistrationValue(
        matchedRow,
        headerMap,
        config.verificationStatusHeaders || []
      );
  const matchedName =
    getRegistrationValue(
      matchedRow,
      headerMap,
      config.nameHeaders
    );
  const matchedMobile =
    getRegistrationValue(
      matchedRow,
      headerMap,
      config.mobileHeaders
    );
  const matchedWhatsApp =
    getRegistrationValue(
      matchedRow,
      headerMap,
      config.whatsappHeaders
    );
  const activeStatus = farmerStatuses
    ? farmerStatuses.activeStatus
    : getRegistrationValue(
        matchedRow,
        headerMap,
        config.activeStatusHeaders || []
      );
  const registrationStatus = farmerStatuses
    ? farmerStatuses.registrationStatus
    : legacyStatus;
  const registrationComplete = Boolean(
    memberId &&
    matchedName &&
    registrationPhoneKey(matchedWhatsApp) === incomingPhone &&
    (
      config.category === "farmer"
        ? isFarmerRegistrationEligible({
            registrationStatus,
            verificationStatus,
            activeStatus
          })
        : isServiceMemberEligible({
            registrationStatus,
            verificationStatus,
            activeStatus,
            allowBlankActiveStatus: true
          })
    )
  );

  return {
    success: true,
    alreadyRegistered: true,
    registrationComplete,
    rowNumber: matchedEntry.rowNumber,
    exactWhatsAppMatch:
      matchedEntry.exactWhatsAppMatch,

    category:
      config.category,

    categoryLabel:
      config.categoryLabel,

    malayalamLabel:
      config.malayalamLabel,

    idLabel:
      config.idLabel,

    memberId,

    name: matchedName,

    mobile: matchedMobile,

    whatsapp: matchedWhatsApp,

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

    mainCrop:
      getRegistrationValue(
        matchedRow,
        headerMap,
        ["Main Crop", "Main_Crop", "Major_Crops", "Major Crops"]
      ),

    otherCrops:
      getRegistrationValue(
        matchedRow,
        headerMap,
        ["Other Crops", "Other_Crops", "Minor_Crops", "Minor Crops"]
      ),

    farmerCategory:
      getRegistrationValue(
        matchedRow,
        headerMap,
        ["Farmer Category", "Farmer_Category"]
      ),

    insurance:
      getRegistrationValue(
        matchedRow,
        headerMap,
        ["Insurance", "Insurance_Status", "Insurance Status"]
      ),

    mechanization:
      getRegistrationValue(
        matchedRow,
        headerMap,
        ["Mechanization", "Mechanisation"]
      ),

    service:
      getRegistrationValue(
        matchedRow,
        headerMap,
        config.serviceHeaders
      ),
    registrationDate:
      getRegistrationValue(
        matchedRow,
        headerMap,
        [
          "Registration date",
          "Registration Date",
          "Registration_Date",
          "Created date"
        ]
      ),
    source:
      getRegistrationValue(
        matchedRow,
        headerMap,
        [
          "Source",
          "AI_Registration_Source",
          "AI_Registration",
          "AI Registration"
        ]
      ),
    preferredLanguage:
      getFarmerPreferredLanguage(
        matchedRow,
        headers
      ),
    registrationStatus,
    verificationStatus:
      verificationStatus,
    activeStatus,
    status:
      registrationStatus
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

    const languageWrite =
      resolveFarmerPreferredLanguageWrite(
        headers,
        preferredLanguage
      );

    if (!languageWrite) {
      console.error(
        "Preferred language column missing or WhatsApp AI language unsupported."
      );

      return false;
    }

    const incomingPhone =
      registrationPhoneKey(phone);

    const matchingRowIndexes =
      rows.map(function (row, index) {
        const savedWhatsApp =
          registrationPhoneKey(
            getRegistrationValue(
              row,
              headerMap,
              config.whatsappHeaders
            )
          );

        return savedWhatsApp === incomingPhone ? index : -1;
      }).filter(function (index) {
        return index > 0;
      });

    if (matchingRowIndexes.length !== 1) {
      return false;
    }

    const rowIndex = matchingRowIndexes[0];

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

    // rows includes the header at index 0, so the one-based Sheet row is
    // exactly one greater than the matched array index.
    const sheetRowNumber =
      rowIndex + 1;

    const columnLetter =
      columnNumberToLetter(
        languageWrite.index
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
          [languageWrite.value]
        ]
      }
    });

    return true;
  } catch (error) {
    logSafeError("Preferred language update error.", error);

    return false;
  }
}
function formatExistingRegistration(
  result,
  fallbackPhone
) {
  if (result.category === "farmer") {
    const language =
      normalizePreferredLanguage(
        result.preferredLanguage ||
        userLanguagePreferences[fallbackPhone]
      ) || "English";

    if (language === "Bilingual") {
      return [
        formatFarmerRegistrationConfirmation({
          result,
          fallbackPhone,
          language: "English",
          existing: true
        }),
        formatFarmerRegistrationConfirmation({
          result,
          fallbackPhone,
          language: "Malayalam",
          existing: true
        })
      ].join("\n\n");
    }

    return formatFarmerRegistrationConfirmation({
      result,
      fallbackPhone,
      language,
      existing: true
    });
  }

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

    formatRegistrationServiceLine(
      result.category,
      result.service,
      "English"
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
  if (result.category === "farmer") {
    const language =
      normalizePreferredLanguage(
        result.preferredLanguage ||
        userLanguagePreferences[fallbackPhone]
      ) || "English";

    if (language === "Bilingual") {
      return [
        formatFarmerRegistrationConfirmation({
          result,
          fallbackPhone,
          language: "English",
          existing: false
        }),
        formatFarmerRegistrationConfirmation({
          result,
          fallbackPhone,
          language: "Malayalam",
          existing: false
        })
      ].join("\n\n");
    }

    return formatFarmerRegistrationConfirmation({
      result,
      fallbackPhone,
      language,
      existing: false
    });
  }

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

    formatRegistrationServiceLine(
      result.category,
      result.service,
      "English"
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
        mobile: from,
        preferredLanguage:
          userLanguagePreferences[from] || ""
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
  if (["menu", "home", "hi", "hello", "hai"].includes(lower)) {
    delete sessions[from];

    if (userMenus[from]) {
      userMenus[from].step = null;
      userMenus[from].updatedAt = Date.now();
    }

    return {
      handled: true,
      showHome: true
    };
  }
if (
  lower === "cancel" ||
  lower === "stop" ||
  lower === "നിറുത്തുക"
) {
  delete sessions[from];

  return (
    "രജിസ്ട്രേഷൻ റദ്ദാക്കി. " +
    "വീണ്ടും തുടങ്ങാൻ Registration എന്ന് അയയ്ക്കുക."
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
        from,
        {
          requireUnique: true,
          allowMobileMatch: true
        }
      );

    if (existing) {
      if (!existing.success) {
        const language = normalizePreferredLanguage(
          userLanguagePreferences[from] ||
          s.data.preferredLanguage
        );
        return language === "Malayalam"
          ? "ഈ WhatsApp നമ്പറുമായി ഒന്നിലധികം രജിസ്ട്രേഷനുകൾ ബന്ധിപ്പിച്ചിരിക്കുന്നു. തിരിച്ചറിയൽ പരിശോധിക്കാൻ KVK ടീമുമായി ബന്ധപ്പെടുക."
          : "More than one registration is linked to this WhatsApp number. Please contact the KVK team for identity verification.";
      }

      if (!existing.registrationComplete) {
        const resumePlan =
          getRegistrationResumePlan(
            existing,
            from
          );
        const resumeLanguage =
          normalizePreferredLanguage(
            userLanguagePreferences[from] ||
            existing.preferredLanguage ||
            s.data.preferredLanguage
          );

        if (resumePlan.eligible) {
          s.step = resumePlan.nextStep;
          s.data = {
            ...s.data,
            ...resumePlan.data,
            preferredLanguage:
              resumeLanguage ||
              resumePlan.data.preferredLanguage ||
              ""
          };

          return registrationResumePrompt(
            s.step,
            resumeLanguage
          );
        }

        clearCompletedRegistrationSession({
          registrationSessions: sessions,
          userKey: from,
          result: existing
        });
        const language = normalizePreferredLanguage(
          userLanguagePreferences[from] || s.data.preferredLanguage
        );
        return language === "Malayalam"
          ? "നിലവിലുള്ള രജിസ്ട്രേഷൻ അപൂർണ്ണമാണ്, സജീവമല്ല, അല്ലെങ്കിൽ ഈ WhatsApp തിരിച്ചറിയലുമായി സ്ഥിരീകരിച്ചിട്ടില്ല. പുതിയ രേഖയോ Farmer_ID-യോ സൃഷ്ടിച്ചിട്ടില്ല. പരിശോധനയ്ക്കായി KVK ടീമുമായി ബന്ധപ്പെടുക."
          : "The existing registration is incomplete, inactive, or not verified for this WhatsApp identity. No new record or Farmer_ID was created. Please contact the KVK team for verification.";
      }

      if (existing.category === "farmer") {
        existing.masterSync =
          await syncFarmerRegistration({
            sheets,
            spreadsheetId: GOOGLE_SHEET_ID,
            registration: existing
          });
        existing.masterSyncPending =
          !existing.masterSync.success;
      }

      clearCompletedRegistrationSession({
        registrationSessions: sessions,
        userKey: from,
        result: existing
      });

       return formatExistingRegistration(
        existing,
        from
      );
    }

    s.step = "name";

    return "പേര് മാത്രം അയക്കൂ.";
  }

  if (s.step === "resume_confirm") {
    if (!isResumeConfirmation(text)) {
      return registrationResumePrompt(
        "resume_confirm",
        userLanguagePreferences[from] ||
          s.data.preferredLanguage
      );
    }

    const result = await saveRegistration(
      withPreferredLanguage(
        s.data,
        userLanguagePreferences[from]
      )
    );

    if (!result || !result.success) {
      return "Registration could not be resumed safely. No new record or Farmer_ID was created. Please contact the KVK team.";
    }

    clearCompletedRegistrationSession({
      registrationSessions: sessions,
      userKey: from,
      result
    });

    return {
      handled: true,
      registrationCompleted: true,
      category: result.category,
      reply: formatExistingRegistration(result, from)
    };
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

    if (s.data.resumeMemberId) {
      s.step = ["district", "panchayath", "crop"]
        .find(function (field) {
          return !String(s.data[field] || "").trim();
        }) || "resume_confirm";

      return registrationResumePrompt(
        s.step,
        userLanguagePreferences[from] ||
          s.data.preferredLanguage
      );
    }

    s.step = "district";

    return "ജില്ല ഏതാണ്?";
  }

  /*
   * DISTRICT
   */
  if (s.step === "district") {
    s.data.district =
      String(text || "").trim();

    if (s.data.resumeMemberId) {
      s.step = ["panchayath", "crop"]
        .find(function (field) {
          return !String(s.data[field] || "").trim();
        }) || "resume_confirm";

      return registrationResumePrompt(
        s.step,
        userLanguagePreferences[from] ||
          s.data.preferredLanguage
      );
    }

    s.step = "panchayath";

    return "പഞ്ചായത്ത് ഏതാണ്?";
  }

  /*
   * PANCHAYATH
   */
  if (s.step === "panchayath") {
    s.data.panchayath =
      String(text || "").trim();

    if (s.data.resumeMemberId) {
      s.step = String(s.data.crop || "").trim()
        ? "resume_confirm"
        : "crop";

      return registrationResumePrompt(
        s.step,
        userLanguagePreferences[from] ||
          s.data.preferredLanguage
      );
    }

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

    const registrationData = withPreferredLanguage({
      ...s.data,
      service: s.data.crop
    }, userLanguagePreferences[from]);

    const result =
      await saveRegistration(
        registrationData
      );

    if (!result || !result.success) {
      return (
        "ക്ഷമിക്കണം, കർഷക രജിസ്ട്രേഷൻ " +
        "പൂർത്തിയാക്കാൻ കഴിഞ്ഞില്ല. " +
        "കുറച്ച് കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക."
      );
    }

    clearCompletedRegistrationSession({
      registrationSessions: sessions,
      userKey: from,
      result
    });

    return {
      handled: true,
      registrationCompleted: true,
      category: result.category,
      reply: result.alreadyRegistered
        ? formatExistingRegistration(result, from)
        : formatNewRegistration(result, from)
    };
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

    if (!result || !result.success) {
      return (
        "ക്ഷമിക്കണം, രജിസ്ട്രേഷൻ " +
        "പൂർത്തിയാക്കാൻ കഴിഞ്ഞില്ല. " +
        "കുറച്ച് കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക."
      );
    }

    clearCompletedRegistrationSession({
      registrationSessions: sessions,
      userKey: from,
      result
    });

    return {
      handled: true,
      registrationCompleted: true,
      category: result.category,
      reply: result.alreadyRegistered
        ? formatExistingRegistration(result, from)
        : formatNewRegistration(result, from)
    };
  }

  return null;
}

async function saveRegistration(data) {
  const input = data || {};
  const category = input.category || "farmer";
  const phone =
    input.whatsapp ||
    input.mobile ||
    "";

  return registrationCoordinator.runExclusive(
    category,
    phone,
    function () {
      return saveRegistrationLocked(input);
    }
  );
}

function registrationColumnLetter(index) {
  let number = Number(index) + 1;
  let letters = "";

  while (number > 0) {
    const remainder = (number - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    number = Math.floor((number - 1) / 26);
  }

  return letters;
}

function setRegistrationValueIfBlank(
  row,
  headerMap,
  aliases,
  value
) {
  const index = findRegistrationColumn(headerMap, aliases);
  if (index < 0 || String(row[index] || "").trim()) {
    return false;
  }
  return setRegistrationValue(row, headerMap, aliases, value);
}

async function resumeExistingFarmerRegistration(data, existing) {
  const resumePlan = getRegistrationResumePlan(
    existing,
    data.whatsapp || data.mobile || ""
  );

  if (
    !resumePlan.eligible ||
    !data.resumeMemberId ||
    String(data.resumeMemberId).trim() !==
      String(existing.memberId || "").trim()
  ) {
    return {
      success: false,
      code: "REGISTRATION_RESUME_NOT_AUTHORIZED"
    };
  }

  const sheetData = await loadRegistrationSheet("farmer");
  if (!sheetData) {
    return {
      success: false,
      code: "REGISTRATION_SHEET_UNAVAILABLE"
    };
  }

  const { config, rows, headers, headerMap } = sheetData;
  const matching = rows.map(function (row, index) {
    const id = getRegistrationValue(row, headerMap, config.idHeaders);
    const whatsapp = getRegistrationValue(
      row,
      headerMap,
      config.whatsappHeaders
    );
    return (
      index > 0 &&
      String(id || "").trim() === String(existing.memberId).trim() &&
      registrationPhoneKey(whatsapp) ===
        registrationPhoneKey(data.whatsapp || data.mobile)
    ) ? { row, index } : null;
  }).filter(Boolean);

  if (matching.length !== 1) {
    return {
      success: false,
      code: "REGISTRATION_RESUME_IDENTITY_CHANGED"
    };
  }

  const original = matching[0].row.slice();
  const updated = matching[0].row.slice();
  const timestamp = new Date().toISOString();

  setRegistrationValueIfBlank(
    updated,
    headerMap,
    config.nameHeaders,
    data.name || ""
  );
  setRegistrationValueIfBlank(
    updated,
    headerMap,
    config.mobileHeaders,
    data.mobile || data.whatsapp || ""
  );
  setRegistrationValueIfBlank(
    updated,
    headerMap,
    config.districtHeaders,
    data.district || ""
  );
  setRegistrationValueIfBlank(
    updated,
    headerMap,
    config.panchayathHeaders,
    data.panchayath || ""
  );
  setRegistrationValueIfBlank(
    updated,
    headerMap,
    config.serviceHeaders,
    data.crop || data.service || ""
  );

  const languageColumn = findRegistrationColumn(
    headerMap,
    config.languageHeaders || []
  );
  if (
    languageColumn >= 0 &&
    !String(updated[languageColumn] || "").trim() &&
    data.preferredLanguage
  ) {
    setFarmerPreferredLanguage(
      updated,
      headers,
      data.preferredLanguage
    );
  }

  applyNewFarmerStatuses(updated, headers);
  setRegistrationValue(
    updated,
    headerMap,
    ["Last_Updated", "Last Updated"],
    timestamp
  );

  const memberId = getRegistrationValue(
    updated,
    headerMap,
    config.idHeaders
  );
  const statuses = readFarmerStatuses(updated, headers, memberId);
  const name = getRegistrationValue(
    updated,
    headerMap,
    config.nameHeaders
  );
  const whatsapp = getRegistrationValue(
    updated,
    headerMap,
    config.whatsappHeaders
  );

  if (
    memberId !== existing.memberId ||
    !String(name || "").trim() ||
    registrationPhoneKey(whatsapp) !==
      registrationPhoneKey(data.whatsapp || data.mobile) ||
    !isFarmerRegistrationEligible(statuses)
  ) {
    return {
      success: false,
      code: "REGISTRATION_RESUME_REQUIRES_VERIFICATION"
    };
  }

  const sheetRowNumber = matching[0].index + 1;
  const updates = [];
  headers.forEach(function (_header, index) {
    if (String(original[index] || "") === String(updated[index] || "")) {
      return;
    }
    updates.push({
      range:
        "'" + String(config.sheetName).replace(/'/g, "''") + "'!" +
        registrationColumnLetter(index) + sheetRowNumber,
      values: [[updated[index] == null ? "" : updated[index]]]
    });
  });

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: {
        valueInputOption: "RAW",
        data: updates
      }
    });
  }

  const result = {
    success: true,
    alreadyRegistered: true,
    resumed: true,
    registrationComplete: true,
    category: "farmer",
    categoryLabel: config.categoryLabel,
    malayalamLabel: config.malayalamLabel,
    idLabel: config.idLabel,
    memberId,
    farmerId: memberId,
    name,
    mobile: getRegistrationValue(updated, headerMap, config.mobileHeaders),
    whatsapp,
    district: getRegistrationValue(updated, headerMap, config.districtHeaders),
    panchayath: getRegistrationValue(updated, headerMap, config.panchayathHeaders),
    mainCrop: getRegistrationValue(updated, headerMap, config.serviceHeaders),
    service: getRegistrationValue(updated, headerMap, config.serviceHeaders),
    preferredLanguage: getFarmerPreferredLanguage(updated, headers),
    registrationStatus: statuses.registrationStatus,
    verificationStatus: statuses.verificationStatus,
    activeStatus: statuses.activeStatus,
    status: statuses.registrationStatus
  };

  result.masterSync = await syncFarmerRegistration({
    sheets,
    spreadsheetId: GOOGLE_SHEET_ID,
    registration: result
  });
  result.masterSyncPending = !result.masterSync.success;

  return result;
}

async function saveRegistrationLocked(data) {
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
      "",
      {
        requireUnique: true,
        allowMobileMatch: true
      }
    );

  if (existing) {
    if (!existing.success) {
      return existing;
    }

    if (!existing.registrationComplete) {
      if (
        category === "farmer" &&
        data.resumeMemberId
      ) {
        return resumeExistingFarmerRegistration(
          data,
          existing
        );
      }

      return {
        ...existing,
        success: false,
        code: "EXISTING_REGISTRATION_REQUIRES_VERIFICATION"
      };
    }

    if (category === "farmer") {
      existing.masterSync =
        await syncFarmerRegistration({
          sheets,
          spreadsheetId: GOOGLE_SHEET_ID,
          registration: existing
        });
      existing.masterSyncPending =
        !existing.masterSync.success;
    }

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
    rows,
    headers,
    headerMap
  } = sheetData;

  const identitySchema =
    validateRegistrationIdentityHeaders(
      headers,
      config
    );

  if (!identitySchema.valid) {
    console.error(
      "Registration write blocked because required identity headers are missing.",
      {
        category: config.category,
        missing: identitySchema.missing
      }
    );
    return {
      success: false,
      code: "REGISTRATION_IDENTITY_HEADERS_MISSING",
      missingHeaders: identitySchema.missing
    };
  }

  const timestamp =
    new Date().toISOString();

  const id =
    registrationCoordinator.generateId(
      config.idPrefix,
      rows.slice(1).map(function (existingRow) {
        return getRegistrationValue(
          existingRow,
          headerMap,
          config.idHeaders
        );
      })
    );

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
    config.aiRegistrationHeaders || [
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
    "Pending"
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
    applyNewFarmerStatuses(
      row,
      headers
    );

    setFarmerPreferredLanguage(
      row,
      headers,
      data.preferredLanguage || ""
    );

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

  let masterSync = null;

  if (category === "farmer") {
    masterSync = await syncFarmerRegistration({
      sheets,
      spreadsheetId: GOOGLE_SHEET_ID,
      now: timestamp,
      registration: {
        farmerId: id,
        name: data.name || "",
        mobile:
          data.mobile ||
          data.whatsapp ||
          "",
        whatsapp: data.whatsapp || "",
        district: data.district || "",
        panchayath: data.panchayath || "",
        registrationDate: timestamp,
        verificationStatus: "Pending",
        activeStatus: "Active",
        source: "WhatsApp Registration",
        preferredLanguage:
          data.preferredLanguage || ""
      }
    });

    if (!masterSync.success) {
      console.error(
        "Master member sync pending after farmer save.",
        { code: masterSync.code }
      );
    }
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

    preferredLanguage:
      data.preferredLanguage || "",

    registrationStatus:
      category === "farmer"
        ? "Registered"
        : "Pending",

    verificationStatus: "Pending",

    activeStatus: "Active",

    status:
      category === "farmer"
        ? "Registered"
        : "Pending",

    masterSync,
    masterSyncPending:
      category === "farmer" &&
      Boolean(masterSync && !masterSync.success)
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
  logSafeError("Weather read error.", error);

  return "Weather data could not be read from BhoomiMitra database.";
}
}

async function sendWeatherSheetReply(from, userText, preferredLanguage) {
  const district = detectKeralaDistrict(userText);
  let reply = getWeatherDistrictPrompt(preferredLanguage);

  if (district) {
    try {
      const responses = await Promise.all([
        sheets.spreadsheets.values.get({ spreadsheetId: GOOGLE_SHEET_ID, range: SHEETS.weatherData + "!A2:P" }),
        sheets.spreadsheets.values.get({ spreadsheetId: GOOGLE_SHEET_ID, range: SHEETS.weatherForecast + "!A2:M" })
      ]);
      reply = buildWeatherSheetReply({
        currentRows: responses[0].data.values || [],
        forecastRows: responses[1].data.values || [],
        district,
        preferredLanguage,
        now: Date.now()
      });
    } catch (error) {
      logSafeError("Weather sheet reply error.", error);
      await sendWhatsAppMessage(
        from,
        getWeatherUnavailableReply(preferredLanguage),
        { skipPreferredLanguageConversion: true }
      );
      return false;
    }
  }

  await sendWhatsAppMessage(from, reply, { skipPreferredLanguageConversion: true });
  return !district;
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
        SHEETS.weatherForecast + "!A2:M"
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
    logSafeError("Forecast read error.", error);

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

  const sourceTimestamp = Date.parse(
    String(record.sourceDate || "") +
    " " +
    String(record.sourceTime || "")
  );
  const sourceAgeHours = Number.isFinite(sourceTimestamp)
    ? (Date.now() - sourceTimestamp) / (1000 * 60 * 60)
    : null;
  const sourceIsCurrent =
    sourceAgeHours !== null &&
    sourceAgeHours >= 0 &&
    sourceAgeHours < 48;

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
    sourceIsCurrent
      ? "Status: Recent official-source observation"
      : "Status: Historical or unverified official-source observation",
    ...(
      sourceIsCurrent
        ? []
        : [
            "Warning: This price is not being presented as today's price."
          ]
    )
  ].join("\n");
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
    logSafeError("OpenAI request failed.", error);
    return "ക്ഷമിക്കണം, ഇപ്പോൾ BhoomiMitra മറുപടി നൽകാൻ കഴിഞ്ഞില്ല. കുറച്ച് കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക.";
  }
}
async function applyPreferredReplyLanguage(
  to,
  text
) {
  const preferredLanguage =
    userLanguagePreferences[to] ||
    "English";

  if (
    String(preferredLanguage)
      .trim()
      .toLowerCase() !==
    "malayalam"
  ) {
    return text;
  }

  const originalText =
    String(text || "").trim();

  if (!originalText) {
    return originalText;
  }

  try {
    const completion =
      await openai.chat.completions.create({
        model: OPENAI_MODEL,

        messages: [
          {
            role: "system",
            content:
              "You are the Malayalam language layer for BhoomiMitra, " +
              "an agricultural extension assistant. " +
              "Convert the supplied farmer-facing message into clear, natural Malayalam. " +
              "Preserve all Case IDs, Farmer IDs, URLs, phone numbers, prices, quantities, " +
              "dates, units, scientific names, commands such as MENU, CLOSE and REPLY, " +
              "and technical abbreviations exactly. " +
              "Do not add new advice or alter the meaning. " +
              "Return only the final Malayalam message."
          },
          {
            role: "user",
            content: originalText
          }
        ]
      });

    const translated =
      completion &&
      completion.choices &&
      completion.choices[0] &&
      completion.choices[0].message &&
      completion.choices[0].message.content
        ? completion.choices[0].message.content.trim()
        : "";

    return translated || originalText;

  } catch (error) {
    logSafeError("Preferred language conversion error.", error);

    // Never stop BhoomiMitra because translation failed.
    return originalText;
  }
}
async function sendWhatsAppMessage(
  to,
  text,
  options = {}
) {
  const url =
    "https://graph.facebook.com/v25.0/" +
    PHONE_NUMBER_ID +
    "/messages";

  const localizedText = options.skipPreferredLanguageConversion
    ? text
    : await applyPreferredReplyLanguage(to, text);

  const response = await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: "text",

      text: {
        preview_url: false,
        body:
          limitWhatsAppText(
            localizedText
          )
      }
    },
    {
      headers: {
        Authorization:
          "Bearer " + WHATSAPP_TOKEN,

        "Content-Type":
          "application/json"
      }
    }
  );

  const messageId =
    response &&
    response.data &&
    response.data.messages &&
    response.data.messages[0] &&
    response.data.messages[0].id
      ? String(response.data.messages[0].id).trim()
      : "";

  return {
    accepted: Boolean(messageId),
    messageId: messageId,
    data: response ? response.data : null
  };
}
async function appendSafe(
  sheetName,
  row,
  options = {}
) {
  try {
    if (
      !GOOGLE_SHEET_ID ||
      !GOOGLE_CLIENT_EMAIL ||
      !GOOGLE_PRIVATE_KEY
    ) {
      console.log("Google Sheets credentials missing.");
      return false;
    }

    const response =
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

    if (!options.returnDetails) {
      return true;
    }

    const updatedRange =
      response &&
      response.data &&
      response.data.updates &&
      response.data.updates.updatedRange
        ? String(
            response.data.updates.updatedRange
          )
        : "";
    const rangeMatch =
      updatedRange.match(
        /![A-Z]+(\d+):[A-Z]+(\d+)$/i
      );

    return {
      success: true,
      rowNumber: rangeMatch
        ? Number(rangeMatch[2])
        : null,
      updatedRange: updatedRange
    };

  } catch (error) {
    logSafeError(
      "Google Sheet append error.",
      error,
      { sheetName: String(sheetName || "unknown") }
    );

    return false;
  }
}
async function updateExpertCaseByHeaders(input) {
  try {
    if (
      !GOOGLE_SHEET_ID ||
      !GOOGLE_CLIENT_EMAIL ||
      !GOOGLE_PRIVATE_KEY
    ) {
      console.log("Google Sheets credentials missing.");
      return false;
    }

    const update = input || {};
    const headers = Array.isArray(update.headers)
      ? update.headers
      : [];
    let headersForUpdate = headers;
    let rowNumber = Number(update.rowNumber);

    if (!Number.isInteger(rowNumber) || rowNumber < 2) {
      const rows = await readSheetRows(
        update.sheetName || "Expert_Cases",
        "A:AD"
      );
      const liveHeaders =
        rows && rows[0]
          ? rows[0]
          : headers;
      const liveHeaderMap =
        makeExpertCaseHeaderMap(
          liveHeaders
        );
      headersForUpdate = liveHeaders;
      const matchedIndex =
        (rows || []).findIndex(
          function (row, index) {
            if (index === 0) {
              return false;
            }

            const caseId =
              getExpertCaseHeaderValue(
                row,
                liveHeaderMap,
                "Case_ID"
              );
            const sourceMessageId =
              getExpertCaseHeaderValue(
                row,
                liveHeaderMap,
                "Source_Message_ID"
              );

            return (
              String(caseId || "").trim() ===
                String(update.caseId || "").trim() &&
              String(sourceMessageId || "").trim() ===
                String(update.sourceMessageId || "").trim()
            );
          }
        );

      if (matchedIndex < 1) {
        console.error(
          "Unable to locate appended Expert_Cases row for update."
        );
        return false;
      }

      rowNumber = matchedIndex + 1;
    }

    const valuesByHeader =
      update.valuesByHeader || {};
    const data = buildSheetCellUpdates(
      headersForUpdate,
      rowNumber,
      update.sheetName || "Expert_Cases",
      valuesByHeader
    );

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: data
      }
    });

    return true;
  } catch (error) {
    logSafeError("Expert_Cases update error.", error);

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

    console.log("Google Sheet tabs loaded.", {
      count: availableSheets.length
    });

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

    console.log("Google Sheet range resolved.");

    const response =
      await sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: fullRange
      });

    return response.data.values || [];

  } catch (error) {
    logSafeError(
      "Google Sheet read error.",
      error,
      { sheetName: String(sheetName || "unknown") }
    );

    return [];
  }
}
async function logAI(from, userText, reply, type) {
  return aiSheetLogger.logAI(
    from,
    userText,
    reply,
    type
  );
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

app.use(function (error, _req, res, _next) {
  logSafeError("HTTP request processing failed.", error);

  if (res.headersSent) return;

  const status =
    error && error.type === "entity.parse.failed"
      ? 400
      : error && error.type === "entity.too.large"
        ? 413
        : 500;

  res
    .status(status)
    .send(
      status === 400
        ? "INVALID_REQUEST"
        : status === 413
          ? "REQUEST_TOO_LARGE"
          : "REQUEST_FAILED"
    );
});

app.listen(PORT, "0.0.0.0", function () {
  console.log("BhoomiMitra Server v" + SERVER_VERSION + " running on port " + PORT);
}); 
