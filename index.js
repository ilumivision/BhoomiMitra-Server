const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

// Environment Variables
const PORT = process.env.PORT || 10000;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Home Route
app.get('/', (req, res) => {
    res.send('BhoomiMitra AI Server is running.');
});

// Webhook Verification
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('Webhook verified successfully.');
            return res.status(200).send(challenge);
        } else {
            return res.sendStatus(403);
        }
    }

    res.sendStatus(400);
});

// Receive WhatsApp Messages
app.post('/webhook', async (req, res) => {

    // Respond immediately to Meta
    res.status(200).send('EVENT_RECEIVED');

    try {

        const body = req.body;

        if (body.object !== 'whatsapp_business_account') {
            return;
        }

        const change = body.entry?.[0]?.changes?.[0]?.value;

        // Ignore status updates
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

        await axios.post(
            "https://graph.facebook.com/v23.0/" + PHONE_NUMBER_ID + "/messages",
            {
                messaging_product: "whatsapp",
                to: from,
                type: "text",
                text: {
                    body:
                        "🌱 Welcome to BhoomiMitra AI!\n\nThank you for your message.\n\nOur AI assistant is now connected successfully."
                }
            },
            {
                headers: {
                    Authorization: "Bearer " + WHATSAPP_TOKEN,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("Reply sent.");

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
