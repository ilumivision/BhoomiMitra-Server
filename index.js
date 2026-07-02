const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

app.get("/", (req, res) => {
  res.send("BhoomiMitra AI Server is running.");
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  console.log(JSON.stringify(req.body, null, 2));

  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body || "";

      console.log("Message:", text);

      await axios.post(
        https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages,
        {
          messaging_product: "whatsapp",
          to: from,
          text: {
            body: "🌱 Welcome to BhoomiMitra AI!\n\nThank you for your message.\n\nOur AI assistant is now connected successfully."
          }
        },
        {
          headers: {
            Authorization: Bearer ${WHATSAPP_TOKEN},
            "Content-Type": "application/json"
          }
        }
      );

      console.log("Reply sent.");
    }

    res.sendStatus(200);

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(Server running on port ${PORT});
});
