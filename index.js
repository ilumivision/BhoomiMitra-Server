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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Home
app.get("/", (req, res) => {
  res.send("BhoomiMitra AI Server Running");
});

// Verify Webhook
app.get("/webhook", (req, res) => {

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook Verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);

});

// Receive WhatsApp Messages
app.post("/webhook", async (req, res) => {

  res.sendStatus(200);

  try {

    const body = req.body;

    if (body.object !== "whatsapp_business_account") {
      return;
    }

    const change = body.entry?.[0]?.changes?.[0]?.value;

    if (change?.statuses) {
      return;
    }

    const message = change?.messages?.[0];

    if (!message) {
      return;
    }

    const from = message.from;
    const text = message.text?.body || "";

    console.log("User:", from);
    console.log("Message:", text);

    // Ask OpenAI
    const completion = await openai.chat.completions.create({

      model: "gpt-5.5",

      messages: [
        {
          role: "system",
          content:
            "You are BhoomiMitra AI, an agriculture assistant helping Indian farmers with accurate, practical and simple advice."
        },
        {
          role: "user",
          content: text
        }
      ]

    });

   // Send reply through WhatsApp

await axios.post(
  https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages,
  {
    messaging_product: "whatsapp",
    to: from,
    text: {
      body: reply
    }
  },
  {
    headers: {
      Authorization: "Bearer " + WHATSAPP_TOKEN,
      "Content-Type": "application/json"
    }
  }
);

console.log("Reply Sent");

  } catch (err) {

    console.error(
      err.response?.data || err.message
    );

  }

});

// Start Server
app.listen(PORT, "0.0.0.0", () => {

 console.log("Server running on port " + PORT);

});
