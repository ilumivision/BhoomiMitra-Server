function detectIntent(text) {
  const msg = (text || "").toLowerCase();

  if (msg.includes("weather") || msg.includes("rain") || msg.includes("മഴ") || msg.includes("കാലാവസ്ഥ")) return "weather";
  if (msg.includes("price") || msg.includes("rate") || msg.includes("വില") || msg.includes("market") || msg.includes("rubber")) return "market";
  if (msg.includes("soil") || msg.includes("ph") || msg.includes("മണ്ണ്")) return "soil";
  if (msg.includes("register") || msg.includes("registration") || msg.includes("രജിസ്റ്റർ")) return "registration";
  if (msg.includes("expert") || msg.includes("doctor") || msg.includes("വിദഗ്ധൻ")) return "expert";
  if (msg.includes("photo") || msg.includes("image") || msg.includes("ചിത്രം")) return "photo";
  if (msg.includes("voice") || msg.includes("audio") || msg.includes("ശബ്ദം")) return "voice";

  return "general_agriculture";
}

module.exports = detectIntent;
