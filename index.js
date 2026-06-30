const express = require("express");

const app = express();

app.use(express.json());

const VERIFY_TOKEN = "BHOOMIMITRA2026";

const GAS_URL = "https://script.google.com/macros/s/AKfycbxlgnztAqKZVihwYoUCwkJdJIOTLCVUiZnQyAuTxMLO84aPy9GnC56D5TU4MNe1-5XQqw/exec";

app.get("/", (req, res) => {
    res.send("BhoomiMitra AI Server Running");
});

// WhatsApp Webhook Verification
app.get("/webhook", (req, res) => {

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
});

