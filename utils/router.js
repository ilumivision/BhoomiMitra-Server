const detectIntent = require("./detectIntent");

function routeMessage(text) {

    const intent = detectIntent(text);

    switch (intent) {

        case "weather":
            return "WEATHER";

        case "market":
            return "MARKET";

        case "soil":
            return "SOIL";

        case "registration":
            return "REGISTRATION";

        case "expert":
            return "EXPERT";

        case "photo":
            return "PHOTO";

        case "voice":
            return "VOICE";

        default:
            return "GENERAL";
    }

}

module.exports = routeMessage;
