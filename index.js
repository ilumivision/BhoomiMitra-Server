const express = require("express");
const axios = require("axios");
require("dotenv").config();

const OpenAI = require("openai");
const { google } = require("googleapis");
const detectIntent = require("./utils/detectIntent");
const voiceModule = require("./utils/voice");
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
const processedMessages = new Set();

const SHEETS = {
  farmers: "Farmer_Master",
  expertRegistration: "Expert_Registration",
  skilledWorkerRegistration: "Skilled_Worker_Registration",
  serviceProviderRegistration: "Service_Provider_Registration",
  conversation: "AI_Conversation_History",
  aiLog: "AI_Response_Log",
  farmerQueries: "Farmer_Queries",
  weatherData: "Weather_Data",
  weatherForecast: "Weather_Forecast",
  aiMemory: "AI_Memory"
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
} else {
    userText = "User sent a non-text message.";
}

const detectedIntent = detectIntent(userText);
console.log("Detected Intent:", detectedIntent);
await appendSafe(SHEETS.conversation, [
      new Date().toISOString(),
      from,
      userText,
      "incoming"
    ]);

    const regReply = await handleRegistration(from, userText);
    if (regReply) {
      await sendWhatsAppMessage(from, regReply);
      await logAI(from, userText, regReply, "registration");
      return;
    }

    const weatherContext = await getLatestWeatherContext(userText);
    const forecastContext = await getForecastContext(userText);
    const aiReply = await getAIReply(userText, weatherContext, forecastContext);

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
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: SHEETS.weatherForecast + "!A2:M"
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return "No forecast data available.";

    const district = detectKeralaDistrict(userText);
    let filtered = rows;

    if (district) {
      filtered = rows.filter(function (r) {
        return String(r[2] || "").toLowerCase() === district.toLowerCase();
      });
    }

    filtered = filtered.slice(0, 7);

    return filtered.map(function (r) {
      return (
        (r[3] || "") +
        ": Max " + (r[4] || "") + " C, Min " + (r[5] || "") +
        " C, Rain " + (r[6] || "") + " mm, Rain Chance " + (r[7] || "") +
        "%, Wind " + (r[8] || "") + " km/h, Event " + (r[9] || "") +
        ", Advisory: " + (r[10] || "")
      );
    }).join("\n");

  } catch (error) {
    console.error("Forecast read error:", error.response && error.response.data ? error.response.data : error.message);
    return "Forecast data could not be read from BhoomiMitra database.";
  }
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
