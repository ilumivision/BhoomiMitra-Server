const express = require("express");
const axios = require("axios");
require("dotenv").config();

const OpenAI = require("openai");
const { google } = require("googleapis");
const detectIntent = require("./utils/detectIntent");
const voiceModule = require("./utils/voice");
const photoVision = require("./utils/photoVision");
const caseManager = require("./utils/caseManager");
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
const expertCaseManager = createExpertCaseManager({
  appendSafe,
  readSheetRows,
  sendWhatsAppMessage
});
const sessions = {};
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
  "You are BhoomiMitra, Kerala's trusted Agriculture AI Assistant powered by IlumiVision.",
  "Operate only for Kerala.",
  "Answer only agriculture and allied sector questions.",
  "Use Kerala context, KAU Package of Practices, ICAR, KVK, Kerala Government and IMD-style safety advice.",
  "Never guess. Never fabricate. If unsure, say clearly.",
  "Reply in Malayalam if the user writes Malayalam. Reply in English if the user writes English.",
  "Keep answers short, practical and farmer-friendly.",
  "If outside agriculture, reply: I am BhoomiMitra, Kerala's Agriculture AI Assistant. Please ask only agriculture or allied sector questions."
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
    let userText = "";
if (message.type === "text") {
    userText = message.text && message.text.body
        ? message.text.body.trim()
        : "";
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
} else {
    userText = "User sent a non-text message.";
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



    const regReply = await handleRegistration(from, userText);
    if (regReply) {
      await sendWhatsAppMessage(from, regReply);
      await logAI(from, userText, regReply, "registration");
      return;
    }

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
    const aiReply = await getAIReply(
      userText + caseContext,
      weatherContext,
      forecastContext
    );
    // ---------------- Expert Escalation ----------------
const needExpert =
  detectedIntent === "expert" ||
  userText.toLowerCase().includes("expert") ||
  userText.toLowerCase().includes("expert advice") ||
  userText.toLowerCase().includes("field visit") ||
  userText.toLowerCase().includes("visit my farm") ||
  userText.toLowerCase().includes("krishi bhavan") ||
  userText.toLowerCase().includes("consultant") ||
  userText.toLowerCase().includes("വിദഗ്ധ") ||
  userText.toLowerCase().includes("വിദഗ്ധന്റെ") ||
  userText.toLowerCase().includes("സഹായം") ||
  userText.toLowerCase().includes("ഫീൽഡ് വിസിറ്റ്") ||
  aiReply.toLowerCase().includes("expert") ||
  aiReply.toLowerCase().includes("krishi bhavan") ||
  aiReply.toLowerCase().includes("field visit");
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
]).catch(function (error) {
  console.error(
    "Background AI logging error:",
    error && error.message
      ? error.message
      : error
  );
});

  } catch (error) {
    console.error("Webhook error:", error.response && error.response.data ? error.response.data : error.message);
  }
});

async function handleRegistration(from, text) {
  const lower = String(text || "").toLowerCase();

  if (!sessions[from]) {
    if (
      lower.includes("register") ||
      lower.includes("registration") ||
      lower.includes("രജിസ്റ്റർ") ||
      lower.includes("രജിസ്ട്രേഷൻ")
    ) {
      sessions[from] = {
        step: "category",
        data: { whatsapp: from }
      };

      return "രജിസ്ട്രേഷൻ തുടങ്ങാം. വിഭാഗം അയക്കൂ:\n1 Farmer\n2 Expert\n3 Skilled Worker\n4 Service Provider";
    }

    return null;
  }

  const s = sessions[from];

  if (s.step === "category") {
    s.data.category = detectCategory(text);
    s.step = "name";
    return "പേര് മാത്രം അയക്കൂ.";
  }

  if (s.step === "name") {
    s.data.name = text;
    s.step = "district";
    return "ജില്ല ഏതാണ്?";
  }

  if (s.step === "district") {
    s.data.district = text;
    s.step = "panchayath";
    return "പഞ്ചായത്ത് ഏതാണ്?";
  }

  if (s.step === "panchayath") {
    s.data.panchayath = text;

    if (s.data.category === "farmer") {
      s.step = "crop";
      return "പ്രധാന കൃഷി / വിള ഏതാണ്?";
    }

    s.step = "service";
    return "നിങ്ങളുടെ expertise / skill / service എന്താണ്?";
  }

  if (s.step === "crop") {
    s.data.crop = text;
    await saveRegistration(s.data);
    delete sessions[from];
    return "നന്ദി. കർഷക രജിസ്ട്രേഷൻ BhoomiMitra ഡാറ്റാബേസിൽ സേവ് ചെയ്തു.";
  }

  if (s.step === "service") {
    s.data.service = text;
    await saveRegistration(s.data);
    delete sessions[from];
    return "നന്ദി. രജിസ്ട്രേഷൻ സേവ് ചെയ്തു. പരിശോധനയ്ക്ക് ശേഷം approval നൽകും.";
  }

  return null;
}

function detectCategory(text) {
  const t = String(text || "").toLowerCase();

  if (t.includes("2") || t.includes("expert")) return "expert";
  if (t.includes("3") || t.includes("worker") || t.includes("skilled")) return "skilled_worker";
  if (t.includes("4") || t.includes("service")) return "service_provider";

  return "farmer";
}

async function saveRegistration(data) {
  const id = "BM-" + Date.now();
  const category = data.category || "farmer";

  if (category === "farmer") {
    await appendSafe(SHEETS.farmers, [
      id,
      data.name || "",
      "",
      "",
      data.whatsapp || "",
      "",
      data.district || "",
      "",
      data.panchayath || "",
      "",
      "",
      "",
      data.crop || "",
      "WhatsApp Registration",
      "Approved",
      new Date().toISOString()
    ]);
    return;
  }

  let sheetName = SHEETS.expertRegistration;
  if (category === "skilled_worker") sheetName = SHEETS.skilledWorkerRegistration;
  if (category === "service_provider") sheetName = SHEETS.serviceProviderRegistration;

  await appendSafe(sheetName, [
    id,
    data.name || "",
    data.whatsapp || "",
    data.district || "",
    data.panchayath || "",
    data.service || "",
    category,
    "Pending",
    "WhatsApp Registration",
    new Date().toISOString()
  ]);
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
    console.error("Weather read error:", error.response && error.response.data ? error.response.data : error.message);
    return "Weather data could not be read from BhoomiMitra database.";
  }
}

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
    if (!GOOGLE_SHEET_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
      console.log("Google Sheets credentials missing.");
      return;
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: sheetName + "!A:Z",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [row]
      }
    });

  } catch (error) {
    console.error("Google Sheet append error for sheet:", sheetName);
    console.error(error.response && error.response.data ? error.response.data : error.message);
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
