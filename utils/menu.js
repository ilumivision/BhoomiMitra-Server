"use strict";

/*
 * BhoomiMitra Welcome and Service Menu
 *
 * Supports:
 * - First-contact welcome
 * - Manual menu request
 * - Single service selection
 * - Multiple service selection
 * - Malayalam and English menu commands
 */

const MENU_SESSION_TIMEOUT_MS =
  30 * 60 * 1000;

const SERVICE_OPTIONS = {
    "1": {
    key: "question",
    label:
      "Ask an agriculture question"
  },

  "2": {
    key: "photo",
    label:
      "Crop problem photo diagnosis"
  },

  "3": {
    key: "soil",
    label:
      "Location-based soil information"
  },

  "4": {
    key: "weather",
    label:
      "Weather and rainfall information"
  },

  "5": {
    key: "market",
    label:
      "Agricultural market prices"
  },

  "6": {
    key: "expert",
    label:
      "Agricultural expert advice"
  },

  "7": {
    key: "worker",
    label:
      "Find skilled farm workers"
  },

  "8": {
    key: "provider",
    label:
      "Find service providers or machinery operators"
  },

  "9": {
  key: "farm",
  label:
    "Manage farm/land, activities and advisory history"
},

"10": {
  key: "personal_records",
  label: "My Personal Records"
}
};

function normalizeMenuText(value) {
  return String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isMenuCommand(text) {
  const normalized =
    normalizeMenuText(text);

  const commands = [
    "menu",
    "main menu",
    "services",
    "service",
    "help",
    "start",
    "hi",
    "hello",
    "hai",
    "മെനു",
    "സേവനങ്ങൾ",
    "സഹായം",
    "തുടങ്ങുക",
    "ഹായ്",
    "ഹലോ"
  ];

  return commands.includes(
    normalized
  );
}

function getWelcomeMessage() {
  return [
    "🌱 Welcome to BhoomiMitra",
    "Kerala’s Agriculture AI Assistant",
    "Developed by Ilumivision",
    "",
    "Please select the service you need:",
    "",
    "1️⃣ Ask an agriculture question",
    "2️⃣ Diagnose a crop problem using a photo",
    "3️⃣ Get location-based soil information",
    "4️⃣ Get weather and rainfall information",
    "5️⃣ Check agricultural market prices",
    "6️⃣ Request agricultural expert advice",
    "7️⃣ Find skilled farm workers",
    "8️⃣ Find service providers or machinery operators",
    "9️⃣ Manage farm/land, activities and advisory history",
    "🔟 My Personal Records",
"",
"Reply with one number or multiple numbers.",
    "",
    "Examples:",
    "2",
    "5",
    "7,8",
    "1 3 5",
    "",
    "You can send MENU at any time."
  ].join("\n");
}

function parseServiceSelections(text) {
  const normalized =
    normalizeMenuText(text);

  if (!normalized) {
    return [];
  }

  const matches =
   normalized.match(/10|[1-9]/g)

  if (!matches) {
    return [];
  }

  const unique =
    Array.from(
      new Set(matches)
    );

  return unique
    .filter(function (number) {
      return Boolean(
        SERVICE_OPTIONS[number]
      );
    })
    .map(function (number) {
      return {
        number,
        ...SERVICE_OPTIONS[number]
      };
    });
}

function isPureMenuSelection(text) {
  const normalized =
    normalizeMenuText(text);

  if (!normalized) {
    return false;
  }

  return /^(10|[1-9])(?:[,\s]+(10|[1-9]))*$/.test(
    normalized
  );
}

function createMenuSession() {
  return {
    step: "main_menu",
    selectedServices: [],
    pendingServices: [],
    currentService: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function isMenuSessionExpired(session) {
  if (!session) {
    return true;
  }

  const lastActivity =
    Number(
      session.updatedAt ||
      session.createdAt ||
      0
    );

  return (
    !lastActivity ||
    Date.now() - lastActivity >
      MENU_SESSION_TIMEOUT_MS
  );
}

function formatSelectedServices(
  selections
) {
  if (
    !Array.isArray(selections) ||
    selections.length === 0
  ) {
    return "";
  }

  const lines = [
    "✅ You selected:"
  ];

  selections.forEach(function (
    selection
  ) {
    lines.push(
      selection.number +
        "️⃣ " +
        selection.label
    );
  });

  return lines.join("\n");
}

function getServicePrompt(serviceKey) {
  if (serviceKey === "question") {
    return (
      "🌾 Please type your agriculture or " +
      "allied-sector question."
    );
  }

  if (serviceKey === "photo") {
    return [
      "📷 Please send a clear photograph of the affected crop.",
      "",
      "Also mention:",
      "• Crop name",
      "• Plant age",
      "• Symptoms noticed"
    ].join("\n");
  }

  if (serviceKey === "soil") {
    return [
      "🌱 Please share the WhatsApp location of the land.",
      "",
      "BhoomiMitra will provide a location-based estimated soil profile.",
      "",
      "⚠️ Exact nutrient and fertiliser recommendations require a laboratory soil-test report."
    ].join("\n");
  }

  if (serviceKey === "weather") {
    return [
      "🌦️ Please send either:",
      "• District + Local Body",
      "or",
      "• WhatsApp location"
    ].join("\n");
  }

  if (serviceKey === "market") {
    return [
      "📊 Please send the commodity name.",
      "",
      "Examples:",
      "Pepper price Pathanamthitta",
      "Banana price",
      "Coconut price Kottayam"
    ].join("\n");
  }

  if (serviceKey === "expert") {
    return [
      "👨‍🌾 Please describe the crop and problem.",
      "",
      "BhoomiMitra will register the case and assign an appropriate verified agricultural expert."
    ].join("\n");
  }

  if (serviceKey === "worker") {
    return [
      "🧑‍🌾 Please type the required skilled worker.",
      "",
      "Examples:",
      "• Coconut climber",
      "• Grafter or budding worker",
      "• Pruning worker",
      "• Harvesting worker",
      "• Machine operator",
      "• Agricultural labour"
    ].join("\n");
  }

  if (serviceKey === "provider") {
    return [
      "🚜 Please type the required service or machinery.",
      "",
      "Examples:",
      "• Tractor or rotavator",
      "• Spraying or drone spraying",
      "• Irrigation installation",
      "• Nursery or seedlings",
      "• Soil testing",
      "• Fencing",
      "• Pump or motor service"
    ].join("\n");
  }

if (serviceKey === "farm") {
  return [
    "🌾 Farm & Land Management",
    "",
    "Please select an option:",
    "",
    "1️⃣ Register a new land parcel",
    "2️⃣ View my registered lands",
    "3️⃣ Update land details",
    "4️⃣ Record a farm activity",
    "5️⃣ View farm activity history",
    "6️⃣ View BhoomiMitra advisory history",
    "7️⃣ View land summary",
    "8️⃣ Add or update soil-test details",
    "9️⃣ View satellite and GPS observations",
    "",
    "Reply with one number."
  ].join("\n");
}
if (serviceKey === "personal_records") {
  return [
    "👤 My Personal Records",
    "",
    "1️⃣ My details",
    "2️⃣ My BhoomiMitra Farmer ID",
    "3️⃣ My registered lands",
    "4️⃣ My registered animals",
    "5️⃣ Back to Main Menu",
    "",
    "Reply with 1, 2, 3, 4 or 5."
  ].join("\n");
}
  return getWelcomeMessage();
}

function startSelectedServices(
  session,
  selections
) {
  const safeSession =
    session ||
    createMenuSession();

  const selectedKeys =
    selections.map(
      function (selection) {
        return selection.key;
      }
    );

  safeSession.step =
    "processing_services";

  safeSession.selectedServices =
    selectedKeys.slice();

  safeSession.pendingServices =
    selectedKeys.slice();

  safeSession.currentService =
    safeSession.pendingServices.shift() ||
    null;

  safeSession.updatedAt =
    Date.now();

  return safeSession;
}

function advanceMenuSession(
  session
) {
  if (!session) {
    return null;
  }

  session.currentService =
    session.pendingServices.shift() ||
    null;

  session.updatedAt =
    Date.now();

  if (!session.currentService) {
    session.step = "completed";
  }

  return session;
}

function getCurrentServicePrompt(
  session
) {
  if (
    !session ||
    !session.currentService
  ) {
    return "";
  }

  return getServicePrompt(
    session.currentService
  );
}

function formatSelectionResponse(
  selections,
  session
) {
  const selectedText =
    formatSelectedServices(
      selections
    );

  const prompt =
    getCurrentServicePrompt(
      session
    );

  if (selections.length === 1) {
    return prompt;
  }

  return [
    selectedText,
    "",
    "We will complete the selected services one by one.",
    "",
    "Starting with:",
    prompt
  ].join("\n");
}

module.exports = {
  MENU_SESSION_TIMEOUT_MS,
  SERVICE_OPTIONS,
  normalizeMenuText,
  isMenuCommand,
  getWelcomeMessage,
  parseServiceSelections,
  isPureMenuSelection,
  createMenuSession,
  isMenuSessionExpired,
  formatSelectedServices,
  getServicePrompt,
  startSelectedServices,
  advanceMenuSession,
  getCurrentServicePrompt,
  formatSelectionResponse
};
