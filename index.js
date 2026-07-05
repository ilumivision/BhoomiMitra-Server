const express = require("express");
const axios = require("axios");
require("dotenv").config();

const OpenAI = require("openai");
const { google } = require("googleapis");

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

const sessions = {};

const SHEETS = {
  farmers: "Farmer_Master",
  expertRegistration: "Expert_Registration",
  skilledWorkerRegistration: "Skilled_Worker_Registration",
  serviceProviderRegistration: "Service_Provider_Registration",

  conversation: "AI_Conversation_History",
  aiLog: "AI_Response_Log",
  farmerQueries: "Farmer_Queries",
  aiMemory: "AI_Memory",

  weatherData: "Weather_Data",
  weatherForecast: "Weather_Forecast",
  weatherStations: "Weather_Stations",
  weatherSettings: "Weather_Settings",
  weatherAdvisory: "Weather_Advisory",
  weatherApiLog: "Weather_API_Log",
  farmerWeatherSubscription: "Farmer_Weather_Subscription",

  districtMaster: "District_Master",
  locationMaster: "Location_Master"
};

const SYSTEM_PROMPT = `
You are BhoomiMitra, Kerala's trusted Agriculture AI Assistant, powered by IlumiVision.

MISSION:
Improve productivity, profitability, sustainability, climate resilience and quality of life of Kerala farmers.

STRICT SCOPE:
Operate only for Kerala.
Answer only agriculture and allied sector questions.

Supported sectors:
Agriculture, horticulture, plantation crops, coconut, arecanut, rubber, rice, banana, vegetables, fruits, spices, medicinal plants, protected cultivation, organic farming, natural farming, precision farming, livestock, dairy, goat, poultry, piggery, rabbit, fisheries, aquaculture, mushroom, apiculture, farm mechanization, food processing, value addition, agricultural marketing, weather, crop insurance, FPO, rural livelihood, government schemes and KVK services.

Knowledge priority:
1. BhoomiMitra Google Sheets database
2. KAU Package of Practices
3. ICAR institutes
4. KVK advisories
5. Kerala Government
6. Government of India
7. IMD and weather alerts

Rules:
Never guess.
Never fabricate.
Never invent references.
If uncertain, say clearly.
Keep answers short, practical and farmer-friendly.
Ask only one short clarification question when needed.
Reply in Malayalam if user writes Malayalam.
Reply in English if user writes English.

If question is outside agriculture, reply:
"I am BhoomiMitra, Kerala's Agriculture AI Assistant. Please ask only agriculture or allied sector questions."
`;

app.get("/", function (req, res) {
  res.status(200).send("BhoomiMitra AI Server v2.0 is running.");
});

app.get("/webhook", function (req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully.");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/webhook", async function (req, res) {
  res.status(200).send("EVENT_RECEIVED");

  try {
    const body = req.body;

    if (body.object !== "whatsapp_business_account") return;

    const value =
      body.entry &&
      body.entry[0] &&
      body.entry[0].changes &&
      body.entry[0].changes[0] &&
      body.entry[0].changes[0].value;

    if (!value || value.statuses) return;

    const message = value.messages && value.messages[0];
    if (!message) return;

    const from = message.from;

    let userText = "";
    if (message.type === "text") {
      userText = message.text && message.text.body ? message.text.body.trim() : "";
    } else {
      userText = "User sent a non-text message.";
    }

    console.log("Message from:", from);
    console.log("User text:", userText);

    await appendSafe(SHEETS.conversation, [
      new Date().toISOString(),
      from,
      userText,
      "incoming"
    ]);

    const registrationReply = await handleRegistration(from, userText);
    if (registrationReply) {
      await sendWhatsAppMessage(from, registrationReply);
      await logAI(from, userText, registrationReply, "registration");
      return;
    }

    const weatherContext = await getLatestWeatherContext(userText);
    const forecastContext = await getWeatherForecastContext(userText);

    const aiReply = await getBhoomiMitraReply(
      userText,
      weatherContext,
      forecastContext
    );

    await sendWhatsAppMessage(from, aiReply);
    await logAI(from, userText, aiReply, "ai_reply");

    await appendSafe(SHEETS.farmerQueries, [
      new Date().toISOString(),
      from,
      userText,
      aiReply,
      "Open"
    ]);
  } catch (error) {
    console.error("Webhook error:");
    console.error(error.response && error.response.data ? error.response.data : error.message);
  }
});

async function handleRegistration(from, text) {
  const lower = text.toLowerCase();

  if (!sessions[from]) {
    if (
      lower.includes("register") ||
      lower.includes("registration") ||
      lower.includes("രജിസ്റ്റർ") ||
      lower.includes("രജിസ്ട്രേഷൻ")
    ) {
      sessions[from] = {
        type: "choose_category",
        step: "category",
        data: { whatsapp: from }
      };

      return "രജിസ്ട്രേഷൻ തുടങ്ങാം. ദയവായി വിഭാഗം മാത്രം അയക്കൂ:\n1 Farmer\n2 Expert\n3 Skilled Worker\n4 Service Provider";
    }

    return null;
  }

  const session = sessions[from];

  if (session.step === "category") {
    const category = detectCategory(text);
    session.type = category;
    session.data.category = category;
    session.step = "name";

    return "പേര് മാത്രം അയക്കൂ.";
  }

  if (session.step === "name") {
    session.data.name = text;
    session.step = "district";
    return "ജില്ല ഏതാണ്?";
  }

  if (session.step === "district") {
    session.data.district = text;
    session.step = "panchayath";
    return "പഞ്ചായത്ത് ഏതാണ്?";
  }

  if (session.step === "panchayath") {
    session.data.panchayath = text;

    if (session.type === "farmer") {
      session.step = "crop";
      return "പ്രധാന കൃഷി / വിള ഏതാണ്?";
    }

    session.step = "service";
    return "നിങ്ങളുടെ expertise / service / skill എന്താണ്?";
  }

  if (session.step === "crop") {
    session.data.mainCrop = text;
    await saveRegistration(session.type, session.data);
    delete sessions[from];

    return "നന്ദി. നിങ്ങളുടെ കർഷക രജിസ്ട്രേഷൻ BhoomiMitra ഡാറ്റാബേസിൽ സേവ് ചെയ്തു. ഇനി കൃഷിയുമായി ബന്ധപ്പെട്ട സംശയം ചോദിക്കാം.";
  }

  if (session.step === "service") {
    session.data.service = text;
    await saveRegistration(session.type, session.data);
    delete sessions[from];

    return "നന്ദി. നിങ്ങളുടെ രജിസ്ട്രേഷൻ സേവ് ചെയ്തു. പരിശോധനയ്ക്ക് ശേഷം approval നൽകും.";
  }

  return null;
}

function detectCategory(text) {
  const lower = text.toLowerCase();

  if (lower.includes("expert") || lower.includes("വിദഗ്ധ")) return "expert";
  if (lower.includes("worker") || lower.includes("skilled") || lower.includes("തൊഴിലാളി")) return "skilled_worker";
  if (lower.includes("service") || lower.includes("provider") || lower.includes("സേവനം")) return "service_provider";

  return "farmer";
}

async function saveRegistration(type, data) {
  const id = "BM-" + Date.now();

  if (type === "farmer") {
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
      data.mainCrop || "",
      "WhatsApp Registration",
      "Approved",
      new Date().toISOString()
    ]);
    return;
  }

  let sheetName = SHEETS.expertRegistration;

  if (type === "skilled_worker") sheetName = SHEETS.skilledWorkerRegistration;
  if (type === "service_provider") sheetName = SHEETS.serviceProviderRegistration;

  await appendSafe(sheetName, [
    id,
    data.name || "",
    data.whatsapp || "",
    data.district || "",
    data.panchayath || "",
    data.service || "",
    type,
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
    let selected = rows[0];

    if (district) {
      const found = rows.find(r => String(r[2] || "").toLowerCase() === district.toLowerCase());
      if (found) selected = found;
    }

    return `
Latest Weather from BhoomiMitra Database:
District: ${selected[2] || ""}
Date: ${selected[3] || ""}
Time: ${selected[4] || ""}
Temperature: ${selected[5] || ""} °C
Humidity: ${selected[6] || ""} %
Rainfall: ${selected[7] || ""} mm
Wind Speed: ${selected[8] || ""} km/h
Wind Direction: ${selected[9] || ""}
Pressure: ${selected[10] || ""} hPa
Weather Event: ${selected[13] || ""}
Source: ${selected[14] || ""}
Last Updated: ${selected[15] || ""}
`;
  } catch (error) {
    console.error("Weather read error:");
    console.error(error.response && error.response.data ? error.response.data : error.message);
    return "Weather data could not be read from BhoomiMitra database.";
  }
}

async function getWeatherForecastContext(userText) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: SHEETS.weatherForecast + "!A2:M"
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return "No forecast data available.";

    const district = detectKeralaDistrict(userText);
    let filtered = rows;

    if (district) {
      filtered = rows.filter(r => String(r[2] || "").toLowerCase() === district.toLowerCase());
    }

    filtered = filtered.slice(0, 7);

    return filtered.map(r => {
      return ${r[3] || ""}: Max ${r[4] || ""}°C, Min ${r[5] || ""}°C, Rain ${r[6] || ""} mm, Rain Chance ${r[7] || ""}%, Wind ${r[8] || ""} km/h, Event ${r[9] || ""}, Advisory: ${r[10] || ""};
    }).join("\n");
  } catch (error) {
    console.error("Forecast read error:");
    console.error(error.response && error.response.data ? error.response.data : error.message);
    return "Forecast data could not be read from BhoomiMitra database.";
  }
}

function detectKeralaDistrict(text) {
  const districts = [
    "Thiruvananthapuram", "Kollam", "Pathanamthitta", "Alappuzha",
    "Kottayam", "Idukki", "Ernakulam", "Thrissur", "Palakkad",
    "Malappuram", "Kozhikode", "Wayanad", "Kannur", "Kasaragod"
  ];

  const lower = String(text || "").toLowerCase();

  for (const d of districts) {
    if (lower.includes(d.toLowerCase())) return d;
  }

  return null;
}

async function getBhoomiMitraReply(userText, weatherContext, forecastContext) {
  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            SYSTEM_PROMPT +
            "\n\nUse the following BhoomiMitra weather database only when the question involves weather, spraying, irrigation, rainfall, wind, disease risk or farm operations.\n\n" +
            weatherContext +
            "\n\n7-day forecast:\n" +
            forecastContext
        },
        { role: "user", content: userText }
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
    console.error("OpenAI error:");
    console.error(error.response && error.response.data ? error.response.data : error.message);
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
      console.log("Google Sheets credentials missing. Skipping append.");
      return;
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: sheetName + "!A:Z",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] }
    });
  } catch (error) {
    console.error("Google Sheet append error for sheet:", sheetName);
    console.error(error.response && error.response.data ? error.response.data : error.message);
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
  if (!text) return "ക്ഷമിക്കണം, മറുപടി നൽകാൻ കഴിഞ്ഞില്ല.";

  const cleanText = String(text).trim();

  if (cleanText.length <= 3500) return cleanText;

  return cleanText.substring(0, 3400) + "\n\nമറുപടി ചുരുക്കി നൽകി. കൂടുതൽ വിവരങ്ങൾക്ക് തുടർചോദ്യം ചോദിക്കാം.";
}

app.listen(PORT, "0.0.0.0", function () {
  console.log("BhoomiMitra Server v2.0 running on port " + PORT);
});
