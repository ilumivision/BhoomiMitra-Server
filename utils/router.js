const detectIntent = require("./detectIntent");
const weatherModule = require("./weather");

async function routeMessage(text, data = {}) {
    const intent = detectIntent(text);

    switch (intent) {
        case "weather":
            return await weatherModule({
                ...data,
                text,
                intent
            });

        case "market":
            return {
                success: true,
                module: "MARKET",
                reply: "📈 Market price module is ready for integration."
            };

        case "soil":
            return {
                success: true,
                module: "SOIL",
                reply: "🌱 Soil prediction module is ready for integration."
            };

        case "registration":
            return {
                success: true,
                module: "REGISTRATION",
                reply: "📝 Registration module is ready. Please send: Farmer / Expert / Worker / Service Provider."
            };

        case "expert":
            return {
                success: true,
                module: "EXPERT",
                reply: "👨‍🔬 Expert support module is ready for integration."
            };

        case "photo":
            return {
                success: true,
                module: "PHOTO",
                reply: "📷 Photo diagnosis module is ready for integration."
            };

        case "voice":
            return {
                success: true,
                module: "VOICE",
                reply: "🎙️ Voice module is ready for integration."
            };

        default:
            return {
                success: false,
                module: "GENERAL",
                reply: null
            };
    }
}

module.exports = routeMessage;
