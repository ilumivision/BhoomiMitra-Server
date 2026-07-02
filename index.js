const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

// Environment Variables
const PORT = process.env.PORT || 10000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;

// Home Route
app.get("/", (req, res) => {
    res.send("BhoomiMitra AI Server is running.");
});

// Webhook Verification
app.get("/webhook", (req, res) => {

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {

        if (mode === "subscribe" && token === VERIFY_TOKEN) {

            console.log("Webhook verified successfully.");
            return res.status(200).send(challenge);

        } else {

            return res.sendStatus(403);

        }

    }

    res.sendStatus(400);

});

// Receive WhatsApp Messages
app.post("/webhook", async (req, res) => {

    // Reply immediately to Meta
    res.status(200).send("EVENT_RECEIVED");

    try {

        const body = req.body;

        if (body.object !== "whatsapp_business_account") {
            return;
        }

        const change = body.entry?.[0]?.changes?.[0]?.value;

        // Ignore delivery/read receipts
        if (change?.statuses) {
            return;
        }

        const message = change?.messages?.[0];

        if (!message) {
            return;
        }

        const from = message.from;
        const text = message.text?.body || "";

        console.log("Message from:", from);
        console.log("Text:", text);

        // Forward to Make.com
        await axios.post(MAKE_WEBHOOK_URL, {
            from: from,
            message: text
        });

        console.log("Message forwarded to Make.com");

    } catch (err) {

        console.error(
            "Error:",
            err.response?.data || err.message
        );

    }

});

// Start Server
app.listen(PORT, "0.0.0.0", () => {

    console.log("Server running on port " + PORT);

});
