const express = require("express");
const axios = require("axios");
require("dotenv").config();

const OpenAI = require("openai");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

app.get("/", function (req, res) {
  res.status(200).send("BhoomiMitra AI Server is running.");
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

    if (body.object !== "whatsapp_business_account") {
      return;
    }

    const value = body.entry &&
      body.entry[0] &&
      body.entry[0].changes &&
      body.entry[0].changes[0] &&
      body.entry[0].changes[0].value;

    if (!value) {
      return;
    }

    if (value.statuses) {
      console.log("Status update received. Ignored.");
      return;
    }

    const message = value.messages && value.messages[0];

    if (!message) {
      return;
    }

    const from = message.from;

    let userText = "";

    if (message.type === "text") {
      userText = message.text && message.text.body ? message.text.body : "";
    } else {
      userText = "User sent a non-text message. Please ask them to send the question as text.";
    }

    console.log("Message from: " + from);
    console.log("User text: " + userText);

    const aiReply = await getBhoomiMitraReply(userText);

    await sendWhatsAppMessage(from, aiReply);

    console.log("AI reply sent successfully.");

  } catch (error) {
    console.error("Webhook error:");
    console.error(error.response && error.response.data ? error.response.data : error.message);
  }
});

async function getBhoomiMitraReply(userText) {
  try {
    const systemPrompt =
      "You are BhoomiMitra AI, an agriculture assistant for Indian farmers, especially Kerala farmers. " +
      "Give practical, safe, field-level advice in simple language. " +
      "If the farmer asks in Malayalam, reply in Malayalam. If the farmer asks in English, reply in English. " +
      "For crop disease or pest questions, give likely cause, immediate action, preventive steps, and when to contact KVK or agriculture officer. " +
      "Do not give unsafe pesticide overdose advice. Mention that exact chemical recommendation should follow local agriculture department/KVK guidance. " +
      "Keep WhatsApp replies concise, useful, and farmer-friendly.";

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userText
        }
      ],
      
    });

    const reply = completion &&
      completion.choices &&
      completion.choices[0] &&
      completion.choices[0].message &&
      completion.choices[0].message.content
      ? completion.choices[0].message.content
      : "Sorry, I could not generate a reply now. Please try again.";

    return limitWhatsAppText(reply);

  } catch (error) {
    console.error("OpenAI error:");
    console.error(error.response && error.response.data ? error.response.data : error.message);

    return "Sorry, BhoomiMitra AI could not process your question now. Please try again after some time.";
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
        body: text
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

function limitWhatsAppText(text) {
  if (!text) {
    return "Sorry, I could not generate a reply.";
  }

  const cleanText = String(text).trim();

  if (cleanText.length <= 3500) {
    return cleanText;
  }

  return cleanText.substring(0, 3400) + "\n\nReply shortened for WhatsApp. Please ask follow-up questions for more details.";
}

app.listen(PORT, "0.0.0.0", function () {
  console.log("Server running on port " + PORT);
});
