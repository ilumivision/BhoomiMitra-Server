const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("BhoomiMitra Server is running.");
});

app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/webhook", (req, res) => {
  console.log("Incoming webhook:");
  console.log(JSON.stringify(req.body, null, 2));

  res.sendStatus(200);
});

const PORT = process.env.PORT || 10000;


app.listen(PORT, "0.0.0.0", () => {
    console.log("Server started on port", PORT);
});
