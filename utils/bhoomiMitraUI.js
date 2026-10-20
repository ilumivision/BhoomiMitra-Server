"use strict";

const {
  EXPERT_ADVICE_ACTION_IDS
} = require("./expertAdviceFlow");
const {
  TRAINING_ACTION_IDS,
  TRAINING_DYNAMIC_PREFIXES
} = require("./training");
const {
  SCHEME_ACTION_IDS,
  SCHEME_DYNAMIC_PREFIXES
} = require("./schemes");
const {
  FARM_ALERT_ACTION_IDS,
  FARM_ALERT_PREFIXES
} = require("./farmAlerts");
const {
  ANIMAL_ACTION_IDS
} = require("./animalHusbandry");
const {
  CROP_FARM_ACTION_IDS
} = require("./cropFarmRecords");
const {
  ABOUT_ACTION_IDS,
  buildAboutText,
  buildTeamDirectoryText,
  buildTeamMemberText,
  buildTeamRows
} = require("./aboutBhoomiMitra");
const {
  USER_GUIDE_ACTION_IDS,
  buildUserGuideIntro,
  buildUserGuideRows,
  buildUserGuideTopicText
} = require("./userGuide");

// =====================================================
// BhoomiMitra UI
// ICAR-KVK, CARD Pathanamthitta
// Technology powered by IlumiVision
// =====================================================

function createBhoomiMitraUI(options) {
  const {
    axios,
    phoneNumberId,
    whatsappToken,
    welcomeMediaUrl,
    welcomeMediaType,
    policyUrl,
    organisationContact
  } = options || {};

  if (!axios) {
    throw new Error("axios is required.");
  }

  if (!phoneNumberId) {
    throw new Error(
      "WhatsApp phoneNumberId is required."
    );
  }

  if (!whatsappToken) {
    throw new Error(
      "WhatsApp token is required."
    );
  }

  const apiUrl =
    "https://graph.facebook.com/v25.0/" +
    phoneNumberId +
    "/messages";

  // ===================================================
  // GENERIC INTERACTIVE MESSAGE SENDER
  // ===================================================

  async function sendInteractiveMessage(
    to,
    interactive
  ) {
    return axios.post(
      apiUrl,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "interactive",
        interactive: interactive
      },
      {
        headers: {
          Authorization:
            "Bearer " + whatsappToken,
          "Content-Type": "application/json"
        }
      }
    );
  }

  async function sendOptionalWelcomeMedia(to) {
    const url = String(welcomeMediaUrl || "").trim();
    const type = String(welcomeMediaType || "video")
      .trim()
      .toLowerCase();

    if (!/^https:\/\//i.test(url) || !["image", "video"].includes(type)) {
      return { sent: false, code: "NOT_CONFIGURED" };
    }

    try {
      await axios.post(
        apiUrl,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: type,
          [type]: {
            link: url,
            caption:
              "പ്രകൃതിയുടെ അനുഗ്രഹം — Blessings of Nature\n\n" +
              "ഭൂമിമിത്രയിലേക്ക് സ്വാഗതം!\n" +
              "മണ്ണിന്റെ നന്മയ്ക്ക്, കർഷകന്റെ കൂട്ടായി."
          }
        },
        {
          headers: {
            Authorization: "Bearer " + whatsappToken,
            "Content-Type": "application/json"
          }
        }
      );

      return { sent: true, code: "SENT" };
    } catch (error) {
      return { sent: false, code: "DELIVERY_FAILED" };
    }
  }

  // ===================================================
  // LANGUAGE SELECTION
  // ===================================================

  async function sendLanguageSelection(to) {
    return sendInteractiveMessage(
      to,
      {
        type: "button",

        body: {
          text:
            "🌱 ഭൂമിമിത്രയിലേക്ക് സ്വാഗതം!\n" +
            "മണ്ണിന്റെ നന്മയ്ക്ക്, കർഷകന്റെ കൂട്ടായി.\n\n" +
            "കൃഷി, മൃഗസംരക്ഷണം, കാലാവസ്ഥ, വിപണിവില, പരിശീലനം, സർക്കാർ പദ്ധതികൾ എന്നിവയിൽ സഹായം. ചോദിക്കാം, സംസാരിക്കാം, ഫോട്ടോ അയയ്ക്കാം.\n\n" +
            "Welcome to BhoomiMitra, your farming companion. Ask by text or voice, or send a crop photo.\n\n" +
            "🌐 ഭാഷ തിരഞ്ഞെടുക്കുക / Choose language"
        },

        action: {
          buttons: [
            {
  type: "reply",
  reply: {
    id: "LANG_ENGLISH",
    title: "🌐 English"
  }
},
{
  type: "reply",
  reply: {
    id: "LANG_MALAYALAM",
    title: "🌴 മലയാളം"
  }
}
          ]
        }
      }
    );
  }

  async function sendConsentPrompt(to) {
    const configuredPolicyUrl = /^https:\/\//i.test(String(policyUrl || "").trim())
      ? "\nPolicy: " + String(policyUrl).trim()
      : "";
    const configuredContact = String(organisationContact || "").trim()
      ? "\nContact: " + String(organisationContact).trim()
      : "\nContact details: not configured; ask authorised BhoomiMitra/KVK staff.";

    return sendInteractiveMessage(to, {
      type: "button",
      body: {
        text: (
          "🔐 സ്വകാര്യതയും സമ്മതവും\n\n" +
          "പേര്, ഫോൺ, ഭാഷ, കൃഷി/മൃഗം/ഭൂമി വിവരങ്ങൾ, നിങ്ങൾ നൽകുന്ന GPS, ചിത്രം, ശബ്ദം എന്നിവ സേവനത്തിനായി ഉപയോഗിക്കാം. ആവശ്യമായ അംഗീകൃത സാങ്കേതിക സേവനദാതാക്കളോ വിദഗ്ധരോ ഇത് പ്രോസസ് ചെയ്തേക്കാം. AI, കാലാവസ്ഥ, വിപണി, സാറ്റലൈറ്റ് വിവരം തീരുമാനസഹായം മാത്രമാണ്. വിവരങ്ങൾ കാണാനും തിരുത്തലോ ഇല്ലാതാക്കലോ അഭ്യർത്ഥിക്കാനും സമ്മതം പിൻവലിക്കാനും കഴിയും.\n\n" +
          "BhoomiMitra uses the personal and farm information you provide to deliver its services. Authorised technology providers or experts may process relevant data. AI and data services are decision support. You may request access, correction, deletion, or consent withdrawal.\n\n" +
          "Project attribution: ICAR–Krishi Vigyan Kendra, CARD, Pathanamthitta. Technology provider: IlumiVision." +
          configuredPolicyUrl + configuredContact
        ).slice(0, 1024)
      },
      action: {
        buttons: [
          { type: "reply", reply: { id: "CONSENT_AGREE", title: "I Agree" } },
          { type: "reply", reply: { id: "CONSENT_POLICY", title: "Terms & Privacy" } },
          { type: "reply", reply: { id: "CONSENT_DECLINE", title: "Not Now" } }
        ]
      }
    });
  }

 // ===================================================
// READ INTERACTIVE BUTTON / LIST SELECTION
// ===================================================

function getInteractiveSelection(message) {
  if (
    !message ||
    message.type !== "interactive" ||
    !message.interactive
  ) {
    return null;
  }

  const buttonReply =
    message.interactive.button_reply;

  if (buttonReply) {
    return {
      id: buttonReply.id || "",
      title: buttonReply.title || ""
    };
  }

  const listReply =
    message.interactive.list_reply;

  if (listReply) {
    return {
      id: listReply.id || "",
      title: listReply.title || ""
    };
  }

  return null;
}

// ===================================================
// CONVERT LANGUAGE BUTTON TO EXISTING LANGUAGE VALUE
// ===================================================

function getLanguageFromSelection(message) {
  const selection =
    getInteractiveSelection(message);

  if (!selection) {
    return "";
  }

  if (selection.id === "LANG_ENGLISH") {
    return "English";
  }

  if (selection.id === "LANG_MALAYALAM") {
    return "Malayalam";
  }

    return "";
}
// ===================================================
// MAIN MENU
// ===================================================

async function sendMainMenu(
  to,
  language
) {
  const lang =
    String(language || "English")
      .toLowerCase();

  const isMalayalam =
    lang === "malayalam";

  const bodyText =
    isMalayalam
      ? (
          "🌱 BhoomiMitra\n\n" +
          "ഇന്ന് നിങ്ങളുടെ കൃഷിക്ക് എന്ത് സഹായമാണ് വേണ്ടത്?\n\n" +
          "ചോദ്യം ടൈപ്പ് ചെയ്യുകയോ, " +
          "വോയ്സ് നോട്ട്/ഫോട്ടോ അയയ്ക്കുകയോ ചെയ്യാം."
        )
      : (
          "🌱 BhoomiMitra\n\n" +
          "How can I help your farm today?\n\n" +
          "You can also type a question, " +
          "send a voice note or upload a photo."
        );

  return sendInteractiveMessage(
    to,
    {
      type: "list",

      body: {
        text: bodyText
      },

      action: {
        button:
          isMalayalam
            ? "☰ പ്രധാന മെനു"
            : "☰ Main Menu",

        sections: [
          {
            title:
              isMalayalam
                ? "BhoomiMitra സേവനങ്ങൾ"
                : "BhoomiMitra Services",

            rows: [
              {
                id: "HOME_ASK",

                title:
                  isMalayalam
                    ? "🌱 ചോദിക്കൂ / രോഗനിർണയം"
                    : "🌱 Ask & Diagnose",

                description:
                  isMalayalam
                    ? "ചോദ്യം, ഫോട്ടോ, വിള പ്രശ്നം"
                    : "Questions, photos and crop problems"
              },

              {
                id: "HOME_FARM",

                title:
                  isMalayalam
                    ? "🌾 എന്റെ കൃഷിയിടം"
                    : "🌾 My Farm",

                description:
                  isMalayalam
                    ? "മണ്ണ്, കാലാവസ്ഥ, കൃഷിരേഖകൾ"
                    : "Soil, weather and farm records"
              },

              {
                id: "HOME_EXPERT",

                title:
                  isMalayalam
                    ? "👨‍🌾 വിദഗ്ധ സഹായം"
                    : "👨‍🌾 Expert & Services",

                description:
                  isMalayalam
                    ? "വിദഗ്ധൻ, തൊഴിലാളി, യന്ത്രസേവനം"
                    : "Experts, workers and machinery"
              },

              {
                id: "HOME_MARKET",

                title:
                  isMalayalam
                    ? "📈 വിപണി"
                    : "📈 Market",

                description:
                  isMalayalam
                    ? "കാർഷിക വിപണി വില"
                    : "Agricultural market prices"
              },

              {
                id: "HOME_PROFILE",

                title:
                  isMalayalam
                    ? "👤 എന്റെ BhoomiMitra"
                    : "👤 My BhoomiMitra",

                description:
                  isMalayalam
                    ? "രേഖകൾ, അംഗത്വം, ഭാഷ"
                    : "Records, membership and language"
              }
            ]
          }
        ]
      }
    }
  );
}
// ===================================================
// ANIMAL HUSBANDRY MENU
// ===================================================

async function sendAnimalHusbandryMenu(to, language) {
  const ml =
    String(language || "").toLowerCase() ===
    "malayalam";

  const rows = [
    [ANIMAL_ACTION_IDS.REGISTER, "Register Animal", "മൃഗ രജിസ്ട്രേഷൻ", "Add an animal to your Farmer ID", "Farmer ID-യിൽ മൃഗത്തെ ചേർക്കുക"],
    [ANIMAL_ACTION_IDS.MY_ANIMALS, "My Animals", "എന്റെ മൃഗങ്ങൾ", "View animals linked to your Farmer ID", "Farmer ID-യുമായി ബന്ധിപ്പിച്ച മൃഗങ്ങൾ"],
    [ANIMAL_ACTION_IDS.HEALTH, "Health Diary", "ആരോഗ്യ ഡയറി", "Record illness, symptoms or treatment", "രോഗം, ലക്ഷണം, ചികിത്സ രേഖപ്പെടുത്തുക"],
    [ANIMAL_ACTION_IDS.PREVENTIVE, "Vaccination / Deworm", "വാക്സിൻ / വിരമരുന്ന്", "Record preventive animal care", "പ്രതിരോധ പരിചരണം രേഖപ്പെടുത്തുക"],
    [ANIMAL_ACTION_IDS.PRODUCTION, "Breeding / Production", "പ്രജനനം / ഉൽപ്പാദനം", "Record breeding, milk, egg or weight data", "പ്രജനനം, പാൽ, മുട്ട, ഭാരം രേഖപ്പെടുത്തുക"],
    [ANIMAL_ACTION_IDS.HISTORY, "View Animal Records", "മൃഗരേഖകൾ കാണുക", "View recent health and production records", "ആരോഗ്യ, ഉൽപ്പാദന രേഖകൾ കാണുക"],
    [ANIMAL_ACTION_IDS.ADVISORY, "Veterinary Advisory", "വെറ്ററിനറി ഉപദേശം", "Ask a natural-language animal question", "മൃഗപരിചരണ ചോദ്യം നേരിട്ട് ചോദിക്കുക"],
    [ANIMAL_ACTION_IDS.EXPERT, "Veterinary Expert", "വെറ്ററിനറി വിദഗ്ധൻ", "Request the existing expert consultation", "നിലവിലെ വിദഗ്ധ സഹായം അഭ്യർത്ഥിക്കുക"],
    [ANIMAL_ACTION_IDS.ALERTS, "Disease Alerts", "മൃഗരോഗ അലർട്ടുകൾ", "Verified active official alerts only", "സ്ഥിരീകരിച്ച ഔദ്യോഗിക അലർട്ടുകൾ മാത്രം"],
    [ANIMAL_ACTION_IDS.MAIN_MENU, "Main Menu", "പ്രധാന മെനു", "Return to BhoomiMitra home", "BhoomiMitra പ്രധാന മെനുവിലേക്ക്"]
  ].map(function (item) {
    return {
      id: item[0],
      title: ml ? item[2] : item[1],
      description: ml ? item[4] : item[3]
    };
  });

  return sendInteractiveMessage(to, {
    type: "list",
    body: {
      text: ml
        ? "🐄 മൃഗസംരക്ഷണം\nആവശ്യമായ സേവനം തിരഞ്ഞെടുക്കുക. മൃഗങ്ങളെ Farmer ID ഉപയോഗിച്ച് സുരക്ഷിതമായി ബന്ധിപ്പിക്കുന്നു."
        : "🐄 Animal Husbandry\nChoose a service. Animal records are securely linked through your Farmer ID."
    },
    action: {
      button: ml ? "മൃഗ സേവനങ്ങൾ" : "Animal Services",
      sections: [{
        title: ml ? "മൃഗസംരക്ഷണ സേവനങ്ങൾ" : "Animal Husbandry",
        rows: rows
      }]
    }
  });
}

// ===================================================
// ASK & DIAGNOSE MENU
// Existing services: 1 and 2
// ===================================================

async function sendAskMenu(
  to,
  language
) {
  const isMalayalam =
    String(language || "")
      .toLowerCase() ===
    "malayalam";

  return sendInteractiveMessage(
    to,
    {
      type: "button",

      body: {
        text:
          isMalayalam
            ? (
                "🌱 ചോദിക്കൂ / രോഗനിർണയം\n\n" +
                "എങ്ങനെ സഹായിക്കണം?"
              )
            : (
                "🌱 Ask & Diagnose\n\n" +
                "How would you like BhoomiMitra to help?"
              )
      },

      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "SERVICE_1",
              title:
                isMalayalam
                  ? "💬 ചോദിക്കൂ"
                  : "💬 Ask Question"
            }
          },

          {
            type: "reply",
            reply: {
              id: "SERVICE_2",
              title:
                isMalayalam
                  ? "📷 വിള രോഗനിർണയം"
                  : "📷 Diagnose Crop"
            }
          },

          {
            type: "reply",
            reply: {
              id: "NAV_HOME",
              title:
                isMalayalam
                  ? "↩️ പ്രധാന മെനു"
                  : "↩️ Main Menu"
            }
          }
        ]
      }
    }
  );
}
// ===================================================
// MY FARM MENU
// Existing services: 3, 4 and 9
// ===================================================

async function sendFarmMenu(
  to,
  language
) {
  const isMalayalam =
    String(language || "")
      .toLowerCase() ===
    "malayalam";

  return sendInteractiveMessage(
    to,
    {
      type: "list",

      body: {
        text:
          isMalayalam
            ? (
                "🌾 എന്റെ കൃഷിയിടം\n\n" +
                "നിങ്ങളുടെ കൃഷിയിടവുമായി ബന്ധപ്പെട്ട സേവനം തിരഞ്ഞെടുക്കുക."
              )
            : (
                "🌾 My Farm\n\n" +
                "Choose the farm information or service you need."
              )
      },

      action: {
        button:
          isMalayalam
            ? "☰ കൃഷി സേവനങ്ങൾ"
            : "☰ Farm Services",

        sections: [
          {
            title:
              isMalayalam
                ? "കൃഷിയിട വിവരം"
                : "Farm Intelligence",

            rows: [
              {
                id: CROP_FARM_ACTION_IDS.OPEN,

                title:
                  isMalayalam
                    ? "🌱 വിള കൃഷി"
                    : "🌱 Crop Farming",

                description:
                  isMalayalam
                    ? "വിളകൾ, കൃഷിപ്പണി, ചരിത്രം, അലർട്ടുകൾ"
                    : "Crops, activities, history and alerts"
              },

              {
                id: ANIMAL_ACTION_IDS.OPEN,

                title:
                  isMalayalam
                    ? "🐄 മൃഗസംരക്ഷണം"
                    : "🐄 Animal Husbandry",

                description:
                  isMalayalam
                    ? "മൃഗങ്ങൾ, ആരോഗ്യം, ഉൽപ്പാദനം, വിദഗ്ധർ"
                    : "Animals, health, production and experts"
              },

              {
                id: "SERVICE_9",

                title:
                  isMalayalam
                    ? "🛰️ ഭൂമി & GPS"
                    : "🛰️ Land, GPS & Satellite",

                description:
                  isMalayalam
                    ? "ഭൂമി, അതിർത്തി, GPS, നിരീക്ഷണം"
                    : "Land, boundaries, GPS and monitoring"
              },

              {
                id: "FARM_WEATHER_ALERTS",

                title:
                  isMalayalam
                    ? "🌦️ കാലാവസ്ഥ & അലർട്ടുകൾ"
                    : "🌦️ Weather & Alerts",

                description:
                  isMalayalam
                    ? "മഴ, പ്രവചനം, വിള/മൃഗ മുന്നറിയിപ്പുകൾ"
                    : "Rain, forecast, crop and animal alerts"
              },

              {
                id: "SERVICE_3",

                title:
                  isMalayalam
                    ? "🧪 മണ്ണ് വിവരം"
                    : "🧪 Soil Information",

                description:
                  isMalayalam
                    ? "സ്ഥലാധിഷ്ഠിത മണ്ണ് വിവരവും നിർദേശവും"
                    : "Location-based soil information"
              },

              {
                id: "NAV_HOME",

                title:
                  isMalayalam
                    ? "↩️ പ്രധാന മെനു"
                    : "↩️ Main Menu",

                description:
                  isMalayalam
                    ? "BhoomiMitra പ്രധാന മെനുവിലേക്ക്"
                    : "Return to BhoomiMitra home"
              }
            ]
          }
        ]
      }
    }
  );
}

async function sendWeatherAlertsMenu(to, language) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  const items = [
    ["SERVICE_4", "Current Weather", "ഇപ്പോഴത്തെ കാലാവസ്ഥ", "Weather, rainfall and available forecast", "കാലാവസ്ഥ, മഴ, ലഭ്യമായ പ്രവചനം"],
    [CROP_FARM_ACTION_IDS.ALERTS, "Farm & Crop Alerts", "കൃഷി/വിള അലർട്ടുകൾ", "Verified crop alerts and farmer-recorded plans", "സ്ഥിരീകരിച്ച വിള അലർട്ടുകളും കർഷകന്റെ പദ്ധതികളും"],
    [ANIMAL_ACTION_IDS.ALERTS, "Animal Disease Alerts", "മൃഗരോഗ അലർട്ടുകൾ", "Verified active official alerts only", "സ്ഥിരീകരിച്ച ഔദ്യോഗിക അലർട്ടുകൾ മാത്രം"],
    [FARM_ALERT_ACTION_IDS.OPEN, "Fertilizer Diary", "വളപ്രയോഗ ഡയറി", "Completed and planned fertilizer records", "പൂർത്തിയായതും ആസൂത്രിതവുമായ രേഖകൾ"],
    ["HOME_FARM", "Back to My Farm", "എന്റെ കൃഷിയിടത്തിലേക്ക്", "Return to the My Farm menu", "എന്റെ കൃഷിയിടം മെനുവിലേക്ക്"],
    ["NAV_HOME", "Main Menu", "പ്രധാന മെനു", "Return to BhoomiMitra home", "BhoomiMitra പ്രധാന മെനുവിലേക്ക്"]
  ];

  return sendInteractiveMessage(to, {
    type: "list",
    body: {
      text: ml
        ? "🌦️ കാലാവസ്ഥയും കൃഷി അലർട്ടുകളും\nലഭ്യമായ വിവരം തിരഞ്ഞെടുക്കുക. സ്ഥിരീകരിച്ച അലർട്ടുകൾ മാത്രമാണ് അലർട്ടായി കാണിക്കുന്നത്."
        : "🌦️ Weather and Farm Alerts\nChoose available information. Only verified records are presented as alerts."
    },
    action: {
      button: ml ? "വിവരം തിരഞ്ഞെടുക്കുക" : "Choose information",
      sections: [{
        title: ml ? "കാലാവസ്ഥയും അലർട്ടുകളും" : "Weather and alerts",
        rows: items.map(function (item) {
          return {
            id: item[0],
            title: (ml ? item[2] : item[1]).slice(0, 24),
            description: (ml ? item[4] : item[3]).slice(0, 72)
          };
        })
      }]
    }
  });
}

// ===================================================
// CROP & LAND MANAGEMENT MENU
// ===================================================

async function sendLandManagementMenu(
  to,
  language
) {
  const isMalayalam =
    String(language || "")
      .toLowerCase() !==
    "english";

  return sendInteractiveMessage(
    to,
    {
      type: "list",

      body: {
        text:
          isMalayalam
            ? "🌾 വിള & ഭൂമി മാനേജ്മെന്റ്\nഒരു ഓപ്ഷൻ തിരഞ്ഞെടുക്കുക."
            : "🌾 Crop & Land Management\nSelect an option."
      },

      action: {
        button:
          isMalayalam
            ? "ഭൂമി ഓപ്ഷനുകൾ"
            : "Land Options",

        sections: [
          {
            title:
              isMalayalam
                ? "വിള & ഭൂമി"
                : "Crop & Land",

            rows: [
              {
                id: "LAND_REGISTER",
                title:
                  isMalayalam
                    ? "🌱 പുതിയ ഭൂമി"
                    : "🌱 Register New Land",
                description:
                  isMalayalam
                    ? "പുതിയ ഭൂമി രജിസ്റ്റർ ചെയ്യുക"
                    : "Register a new land parcel"
              },
              {
                id: "LAND_VIEW",
                title:
                  isMalayalam
                    ? "🌾 എന്റെ ഭൂമികൾ"
                    : "🌾 My Registered Lands",
                description:
                  isMalayalam
                    ? "എന്റെ രജിസ്റ്റർ ചെയ്ത ഭൂമികൾ"
                    : "View registered land parcels"
              },
              {
                id: "LAND_UPDATE",
                title:
                  isMalayalam
                    ? "✏️ ഭൂമി പുതുക്കുക"
                    : "✏️ Update Land Details",
                description:
                  isMalayalam
                    ? "ഭൂമിയുടെ വിവരങ്ങൾ പുതുക്കുക"
                    : "Update saved land information"
              },
              {
                id: "LAND_ADD_CROP",
                title:
                  isMalayalam
                    ? "🌱 വിള ചേർക്കുക"
                    : "🌱 Add Crop / Activity",
                description:
                  isMalayalam
                    ? "കൃഷി / വിള ചേർക്കുക"
                    : "Add a crop or farm activity"
              },
              {
                id: "LAND_CROP_HISTORY",
                title:
                  isMalayalam
                    ? "📚 വിള ചരിത്രം"
                    : "📚 Crop History",
                description:
                  isMalayalam
                    ? "കൃഷി ചരിത്രം കാണുക"
                    : "View crop and activity history"
              },
              {
                id: "LAND_USAGE_HISTORY",
                title:
                  isMalayalam
                    ? "📋 ഉപയോഗ ചരിത്രം"
                    : "📋 BhoomiMitra History",
                description:
                  isMalayalam
                    ? "BhoomiMitra ഉപയോഗ ചരിത്രം"
                    : "View advisory and usage history"
              },
              {
                id: "LAND_SUMMARY",
                title:
                  isMalayalam
                    ? "📄 ഭൂമി സംഗ്രഹം"
                    : "📄 Land Summary",
                description:
                  isMalayalam
                    ? "ഭൂമിയുടെ സംഗ്രഹം കാണുക"
                    : "View the saved land summary"
              },
              {
                id: "LAND_SOIL",
                title:
                  isMalayalam
                    ? "🧪 മണ്ണ് പരിശോധന"
                    : "🧪 Soil Test / Info",
                description:
                  isMalayalam
                    ? "മണ്ണ് പരിശോധന / മണ്ണ് വിവരങ്ങൾ"
                    : "Open the existing soil-information flow"
              }
            ]
          },
          {
            title:
              isMalayalam
                ? "കൂടുതൽ ഓപ്ഷനുകൾ"
                : "More Options",

            rows: [
              {
                id: "LAND_SATELLITE_GPS",
                title:
                  isMalayalam
                    ? "🛰️ സാറ്റലൈറ്റ് & GPS"
                    : "🛰️ Satellite & GPS",
                description:
                  isMalayalam
                    ? "സാറ്റലൈറ്റ്, GPS & ഭൂമി നിരീക്ഷണം"
                    : "Boundary, GPS and satellite monitoring"
              },
              {
                id: "LAND_BACK",
                title:
                  isMalayalam
                    ? "↩️ പിന്നോട്ട്"
                    : "↩️ Back",
                description:
                  isMalayalam
                    ? "എന്റെ കൃഷിയിടം മെനുവിലേക്ക്"
                    : "Return to the My Farm menu"
              }
            ]
          }
        ]
      }
    }
  );
}

async function sendSatelliteGpsMenu(
  to,
  language
) {
  const isMalayalam =
    String(language || "")
      .toLowerCase() !==
    "english";

  return sendInteractiveMessage(
    to,
    {
      type: "list",

      body: {
        text:
          isMalayalam
            ? "🛰️ സാറ്റലൈറ്റ് & GPS\nഒരു ഓപ്ഷൻ തിരഞ്ഞെടുക്കുക."
            : "🛰️ Satellite & GPS\nSelect an option."
      },

      action: {
        button:
          isMalayalam
            ? "GPS ഓപ്ഷനുകൾ"
            : "GPS Options",

        sections: [
          {
            title:
              isMalayalam
                ? "സാറ്റലൈറ്റ് & GPS"
                : "Satellite & GPS",

            rows: [
              {
                id: "SAT_GPS_BOUNDARY_MAP",
                title:
                  isMalayalam
                    ? "🗺️ ഭൂപടം / അതിർത്തി"
                    : "🗺️ Map / Boundary",
                description:
                  isMalayalam
                    ? "ഭൂമിയുടെ അതിർത്തി മാപ്പ് ചെയ്യുക"
                    : "Map or update the land boundary"
              },
              {
                id: "SAT_GPS_MAP",
                title:
                  isMalayalam
                    ? "🗺️ ഭൂമിയുടെ ഭൂപടം"
                    : "🗺️ View Land Map",
                description:
                  isMalayalam
                    ? "നിലവിലുള്ള ഭൂമി ഭൂപടം കാണുക"
                    : "View the existing land map"
              },
              {
                id: "SAT_GPS_BOUNDARY_STATUS",
                title:
                  isMalayalam
                    ? "📍 അതിർത്തി നില"
                    : "📍 Boundary Status",
                description:
                  isMalayalam
                    ? "അതിർത്തി മാപ്പിംഗ് നില കാണുക"
                    : "View boundary-mapping status"
              },
              {
                id: "SAT_GPS_DETAILS",
                title:
                  isMalayalam
                    ? "📍 GPS വിവരങ്ങൾ"
                    : "📍 GPS Details",
                description:
                  isMalayalam
                    ? "സംരക്ഷിച്ച GPS പോയിന്റുകൾ കാണുക"
                    : "View saved boundary GPS points"
              },
              {
                id: "SAT_GPS_CURRENT_STATUS",
                title:
                  isMalayalam
                    ? "🛰️ സാറ്റലൈറ്റ് നില"
                    : "🛰️ Satellite Status",
                description:
                  isMalayalam
                    ? "നിലവിലെ സാറ്റലൈറ്റ് ഫാം നില കാണുക"
                    : "View current satellite farm status"
              },
              {
                id: "SAT_GPS_HISTORY",
                title:
                  isMalayalam
                    ? "📊 സാറ്റലൈറ്റ് ചരിത്രം"
                    : "📊 Satellite History",
                description:
                  isMalayalam
                    ? "സാറ്റലൈറ്റ് നിരീക്ഷണ ചരിത്രം കാണുക"
                    : "View satellite monitoring history"
              },
              {
                id: "SAT_GPS_ACCESS",
                title:
                  isMalayalam
                    ? "👥 ഭൂമി പ്രവേശനം"
                    : "👥 Land Access",
                description:
                  isMalayalam
                    ? "ഭൂമിയിലേക്കുള്ള പ്രവേശനം നിയന്ത്രിക്കുക"
                    : "Manage access to registered land"
              },
              {
                id: "SAT_GPS_BACK",
                title:
                  isMalayalam
                    ? "↩️ പിന്നോട്ട്"
                    : "↩️ Back",
                description:
                  isMalayalam
                    ? "ഭൂമി മാനേജ്മെന്റ് മെനുവിലേക്ക്"
                    : "Return to Land Management"
              }
            ]
          }
        ]
      }
    }
  );
}
// ===================================================
// EXPERT & SERVICES MENU
// Existing services: 6, 7 and 8
// ===================================================

async function sendExpertMenu(
  to,
  language
) {
  const isMalayalam =
    String(language || "")
      .toLowerCase() ===
    "malayalam";

  return sendInteractiveMessage(
    to,
    {
      type: "list",

      body: {
        text:
          isMalayalam
            ? (
                "👨‍🔬 വിദഗ്ധ സഹായവും സേവനങ്ങളും\n\n" +
                "നിങ്ങൾക്ക് ആവശ്യമായ സഹായം തിരഞ്ഞെടുക്കുക."
              )
            : (
                "👨‍🔬 Expert & Farm Services\n\n" +
                "Choose the support you need."
              )
      },

      action: {
        button:
          isMalayalam
            ? "☰ സഹായ സേവനങ്ങൾ"
            : "☰ Support Services",

        sections: [
          {
            title:
              isMalayalam
                ? "കാർഷിക സഹായം"
                : "Agricultural Support",

            rows: [
              {
                id: "SERVICE_6",

                title:
                  isMalayalam
                    ? "🌾 വിള വിദഗ്ധർ"
                    : "🌾 Crop Experts",

                description:
                  isMalayalam
                    ? "വിള കൃഷിക്കായി വിദഗ്ധ സഹായം തേടുക"
                    : "Request crop farming expert advice"
              },

              {
                id: ANIMAL_ACTION_IDS.EXPERT,

                title:
                  isMalayalam
                    ? "🐄 വെറ്ററിനറി വിദഗ്ധർ"
                    : "🐄 Animal & Vet Experts",

                description:
                  isMalayalam
                    ? "മൃഗസംരക്ഷണ വിദഗ്ധ സഹായം തേടുക"
                    : "Request animal or veterinary advice"
              },

              {
                id: "SERVICE_7",

                title:
                  isMalayalam
                    ? "👷 കൃഷിത്തൊഴിലാളികൾ"
                    : "👷 Farm Workers",

                description:
                  isMalayalam
                    ? "നൈപുണ്യമുള്ള കൃഷിത്തൊഴിലാളികളെ കണ്ടെത്തുക"
                    : "Find skilled farm workers"
              },

              {
                id: "SERVICE_8",

                title:
                  isMalayalam
                    ? "🚜 യന്ത്രം / സേവനം"
                    : "🚜 Machinery & Services",

                description:
                  isMalayalam
                    ? "യന്ത്രങ്ങളും സേവനദാതാക്കളും കണ്ടെത്തുക"
                    : "Find machinery and service providers"
              },

              {
                id: SCHEME_ACTION_IDS.OPEN,

                title:
                  isMalayalam
                    ? "🏛️ സർക്കാർ പദ്ധതികൾ"
                    : "🏛️ Government Schemes",

                description:
                  isMalayalam
                    ? "പരിശോധിച്ച സർക്കാർ സഹായ വിവരങ്ങൾ"
                    : "View verified government support"
              },

              {
                id: TRAINING_ACTION_IDS.OPEN,

                title:
                  isMalayalam
                    ? "🎓 പരിശീലന പരിപാടികൾ"
                    : "🎓 Training Programmes",

                description:
                  isMalayalam
                    ? "പരിശീലനങ്ങൾ കാണുക അല്ലെങ്കിൽ അഭ്യർത്ഥിക്കുക"
                    : "View or request farm training"
              },

              {
                id: "NAV_HOME",

                title:
                  isMalayalam
                    ? "↩️ പ്രധാന മെനു"
                    : "↩️ Main Menu",

                description:
                  isMalayalam
                    ? "BhoomiMitra പ്രധാന മെനുവിലേക്ക്"
                    : "Return to BhoomiMitra home"
              }
            ]
          }
        ]
      }
    }
  );
}
// ===================================================
// MARKET MENU
// Existing service: 5
// ===================================================

async function sendMarketMenu(
  to,
  language
) {
  const isMalayalam =
    String(language || "")
      .toLowerCase() ===
    "malayalam";

  return sendInteractiveMessage(
    to,
    {
      type: "button",

      body: {
        text:
          isMalayalam
            ? (
                "💹 കാർഷിക വിപണി\n\n" +
                "വിപണി വില പരിശോധിക്കുക."
              )
            : (
                "💹 Agricultural Market\n\n" +
                "Check agricultural market prices."
              )
      },

      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "SERVICE_5",
              title:
                isMalayalam
                  ? "💹 വിപണി വില"
                  : "💹 Market Price"
            }
          },

          {
            type: "reply",
            reply: {
              id: "NAV_HOME",
              title:
                isMalayalam
                  ? "↩️ പ്രധാന മെനു"
                  : "↩️ Main Menu"
            }
          }
        ]
      }
    }
  );
}


// ===================================================
// MY BHOOMIMITRA MENU
// Existing services: 10 and 11
// Plus language change
// ===================================================

async function sendProfileMenu(
  to,
  language
) {
  const isMalayalam =
    String(language || "")
      .toLowerCase() !==
    "english";

  return sendInteractiveMessage(
    to,
    {
      type: "list",

      body: {
        text:
          isMalayalam
            ? (
                "👤 എന്റെ BhoomiMitra\n\n" +
                "രേഖകൾ, അംഗത്വം, ഭാഷ എന്നിവ നിയന്ത്രിക്കുക."
              )
            : (
                "👤 My BhoomiMitra\n\n" +
                "Manage records, membership and language."
              )
      },

      action: {
        button:
          isMalayalam
            ? "☰ എന്റെ അക്കൗണ്ട്"
            : "☰ My Account",

        sections: [
          {
            title:
              isMalayalam
                ? "എന്റെ സേവനങ്ങൾ"
                : "My Services",

            rows: [
              {
                id: "PERSONAL_DETAILS",

                title:
                  isMalayalam
                    ? "👤 എന്റെ പ്രൊഫൈൽ"
                    : "👤 My Profile",

                description:
                  isMalayalam
                    ? "രജിസ്റ്റർ ചെയ്ത പ്രൊഫൈൽ കാണുക"
                    : "View your registered profile"
              },

              {
                id: "PERSONAL_FARMER_ID",

                title:
                  isMalayalam
                    ? "🪪 എന്റെ കർഷക ഐഡി"
                    : "🪪 My Farmer ID",

                description:
                  isMalayalam
                    ? "WhatsApp നമ്പറുമായി ബന്ധിപ്പിച്ച ഐഡി"
                    : "ID linked to this WhatsApp number"
              },

              {
                id: "PERSONAL_LANDS",

                title:
                  isMalayalam
                    ? "🌾 എന്റെ ഭൂമി / ഫാം"
                    : "🌾 My Lands / Farms",

                description:
                  isMalayalam
                    ? "ഈ കർഷക ഐഡിയിലെ ഭൂമികൾ"
                    : "Lands linked to your Farmer ID"
              },

              {
                id: "PERSONAL_ANIMALS",
                title: isMalayalam ? "🐄 എന്റെ മൃഗങ്ങൾ" : "🐄 My Animals",
                description: isMalayalam
                  ? "ഈ കർഷക ഐഡിയിലെ മൃഗങ്ങൾ"
                  : "Animals linked to your Farmer ID"
              },

              {
                id: "SERVICE_10",
                title: isMalayalam ? "📋 എന്റെ രേഖകൾ" : "📋 My Records",
                description: isMalayalam
                  ? "എല്ലാ വ്യക്തിഗത രേഖാ ഓപ്ഷനുകളും"
                  : "Open all personal record options"
              },

              {
                id: "PROFILE_HELP",
                title: isMalayalam ? "❓ ഉപയോഗ സഹായം" : "❓ Help / How to Use",
                description: isMalayalam
                  ? "ഭൂമിമിത്ര എങ്ങനെ ഉപയോഗിക്കാം"
                  : "Simple BhoomiMitra guidance"
              },

              {
                id: "PROFILE_WHATS_NEW",
                title: isMalayalam ? "✨ പുതിയ സേവനങ്ങൾ" : "✨ What's New",
                description: isMalayalam
                  ? "ലഭ്യമായ പുതിയ സൗകര്യം അറിയുക"
                  : "Discover an available new feature"
              },

              {
                id: ABOUT_ACTION_IDS.OPEN,
                title: isMalayalam ? "🌱 ഭൂമിമിത്രയെക്കുറിച്ച്" : "🌱 About BhoomiMitra",
                description: isMalayalam
                  ? "പദ്ധതി, സ്ഥാപനങ്ങൾ, ടീം"
                  : "Project, institutions and team"
              },

              {
                id: "PROFILE_SETTINGS",
                title: isMalayalam ? "⚙️ അംഗത്വം & ഭാഷ" : "⚙️ Membership & Language",
                description: isMalayalam
                  ? "രജിസ്ട്രേഷൻ അല്ലെങ്കിൽ ഭാഷ മാറ്റം"
                  : "Registration and language settings"
              },

              {
                id: "NAV_HOME",

                title:
                  isMalayalam
                    ? "↩️ പ്രധാന മെനു"
                    : "↩️ Main Menu",

                description:
                  isMalayalam
                    ? "BhoomiMitra പ്രധാന മെനുവിലേക്ക്"
                    : "Return to BhoomiMitra home"
              }
            ]
          }
        ]
      }
    }
  );
}

async function sendProfileSettingsMenu(to, language) {
  const ml = String(language || "").toLowerCase() !== "english";
  const items = [
    ["SERVICE_11", "Membership", "അംഗത്വം", "Register or recover an existing registration", "രജിസ്റ്റർ ചെയ്യുക അല്ലെങ്കിൽ നിലവിലെ രജിസ്ട്രേഷൻ കണ്ടെത്തുക"],
    ["CHANGE_LANGUAGE", "Change Language", "ഭാഷ മാറ്റുക", "English / Malayalam", "English / മലയാളം"],
    ["PROFILE_TERMS_PRIVACY", "Terms & Privacy", "സ്വകാര്യത & നിബന്ധന", "Policy, consent and farmer rights", "നയം, സമ്മതം, കർഷക അവകാശങ്ങൾ"],
    ["HOME_PROFILE", "Back", "പിന്നോട്ട്", "Return to My BhoomiMitra", "എന്റെ BhoomiMitra-യിലേക്ക്"],
    ["NAV_HOME", "Main Menu", "പ്രധാന മെനു", "Return to BhoomiMitra home", "BhoomiMitra പ്രധാന മെനുവിലേക്ക്"]
  ];

  return sendInteractiveMessage(to, {
    type: "list",
    body: { text: ml ? "⚙️ അക്കൗണ്ടും സ്വകാര്യതയും" : "⚙️ Account and Privacy" },
    action: {
      button: ml ? "ഓപ്ഷൻ തിരഞ്ഞെടുക്കുക" : "Choose option",
      sections: [{
        title: ml ? "അക്കൗണ്ട് ക്രമീകരണം" : "Account settings",
        rows: items.map(function (item) {
          return {
            id: item[0],
            title: (ml ? item[2] : item[1]).slice(0, 24),
            description: (ml ? item[4] : item[3]).slice(0, 72)
          };
        })
      }]
    }
  });
}

async function sendAboutMenu(to, language) {
  const ml = String(language || "").toLowerCase() !== "english";
  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: buildAboutText(language).slice(0, 1024) },
    action: {
      buttons: [
        { type: "reply", reply: { id: ABOUT_ACTION_IDS.TEAM, title: ml ? "👥 ഞങ്ങളുടെ ടീം" : "👥 Our Team" } },
        { type: "reply", reply: { id: "HOME_PROFILE", title: ml ? "↩️ പിന്നോട്ട്" : "↩️ Back" } },
        { type: "reply", reply: { id: "NAV_HOME", title: ml ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu" } }
      ]
    }
  });
}

async function sendTeamDirectory(to, language, page) {
  const safePage = Number(page) === 2 ? 2 : 1;
  const ml = String(language || "").toLowerCase() !== "english";
  const directoryRows = buildTeamRows(language, safePage);
  if (safePage === 1) {
    directoryRows.push({
      id: ABOUT_ACTION_IDS.TEAM_PAGE_2,
      title: ml ? "➡️ അടുത്ത പേജ്" : "➡️ Next Page",
      description: ml ? "ടീം അംഗങ്ങൾ 6–10" : "Team members 6–10"
    });
  } else {
    directoryRows.push({
      id: ABOUT_ACTION_IDS.TEAM_PAGE_1,
      title: ml ? "⬅️ മുൻ പേജ്" : "⬅️ Previous Page",
      description: ml ? "ടീം അംഗങ്ങൾ 1–5" : "Team members 1–5"
    });
  }
  directoryRows.push(
    {
      id: ABOUT_ACTION_IDS.OPEN,
      title: ml ? "↩️ പദ്ധതിയെക്കുറിച്ച്" : "↩️ About",
      description: ml ? "ഭൂമിമിത്ര വിവരത്തിലേക്ക്" : "Return to About BhoomiMitra"
    },
    {
      id: "NAV_HOME",
      title: ml ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu",
      description: ml ? "ഭൂമിമിത്ര പ്രധാന മെനു" : "BhoomiMitra home"
    }
  );

  return sendInteractiveMessage(to, {
    type: "list",
    body: { text: buildTeamDirectoryText(language, safePage) },
    action: {
      button: ml ? "ടീം അംഗത്തെ കാണുക" : "View team member",
      sections: [{
        title: ml ? "ഭൂമിമിത്ര ടീം" : "BhoomiMitra Team",
        rows: directoryRows
      }]
    }
  });
}

async function sendTeamMemberProfile(to, language, member, page) {
  const ml = String(language || "").toLowerCase() !== "english";
  const backId = Number(page) === 2
    ? ABOUT_ACTION_IDS.TEAM_PAGE_2
    : ABOUT_ACTION_IDS.TEAM_PAGE_1;
  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: buildTeamMemberText(member, language).slice(0, 1024) },
    action: {
      buttons: [
        { type: "reply", reply: { id: backId, title: ml ? "↩️ ടീം" : "↩️ Team" } },
        { type: "reply", reply: { id: ABOUT_ACTION_IDS.OPEN, title: ml ? "🌱 പദ്ധതിയെക്കുറിച്ച്" : "🌱 About" } },
        { type: "reply", reply: { id: "NAV_HOME", title: ml ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu" } }
      ]
    }
  });
}

async function sendHelpMenu(to, language) {
  const ml = String(language || "").toLowerCase() !== "english";
  const rows = buildUserGuideRows(language, 1);
  rows.push(
    {
      id: USER_GUIDE_ACTION_IDS.PAGE_2,
      title: ml ? "➡️ അടുത്ത പേജ്" : "➡️ Next Page",
      description: ml ? "വിഷയങ്ങൾ 6–10" : "Topics 6–10"
    },
    {
      id: "HOME_PROFILE",
      title: ml ? "↩️ പിന്നോട്ട്" : "↩️ Back",
      description: ml ? "എന്റെ BhoomiMitra-യിലേക്ക്" : "Return to My BhoomiMitra"
    },
    {
      id: "NAV_HOME",
      title: ml ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu",
      description: ml ? "BhoomiMitra പ്രധാന മെനു" : "BhoomiMitra home"
    }
  );
  return sendInteractiveMessage(to, {
    type: "list",
    body: { text: buildUserGuideIntro(language, 1) },
    action: {
      button: ml ? "വിഷയം തിരഞ്ഞെടുക്കുക" : "Choose topic",
      sections: [{
        title: ml ? "ഉപയോക്തൃ മാർഗനിർദേശം" : "User Guide",
        rows: rows
      }]
    }
  });
}

async function sendUserGuidePage(to, language, page) {
  const safePage = Number(page) === 2 ? 2 : 1;
  if (safePage === 1) return sendHelpMenu(to, language);
  const ml = String(language || "").toLowerCase() !== "english";
  const rows = buildUserGuideRows(language, safePage);
  rows.push(
    {
      id: USER_GUIDE_ACTION_IDS.PAGE_1,
      title: ml ? "⬅️ മുൻ പേജ്" : "⬅️ Previous Page",
      description: ml ? "വിഷയങ്ങൾ 1–5" : "Topics 1–5"
    },
    {
      id: "HOME_PROFILE",
      title: ml ? "↩️ പിന്നോട്ട്" : "↩️ Back",
      description: ml ? "എന്റെ BhoomiMitra-യിലേക്ക്" : "Return to My BhoomiMitra"
    },
    {
      id: "NAV_HOME",
      title: ml ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu",
      description: ml ? "BhoomiMitra പ്രധാന മെനു" : "BhoomiMitra home"
    }
  );
  return sendInteractiveMessage(to, {
    type: "list",
    body: { text: buildUserGuideIntro(language, safePage) },
    action: {
      button: ml ? "വിഷയം തിരഞ്ഞെടുക്കുക" : "Choose topic",
      sections: [{
        title: ml ? "ഉപയോക്തൃ മാർഗനിർദേശം" : "User Guide",
        rows: rows
      }]
    }
  });
}

async function sendUserGuideTopic(to, language, topic, page) {
  const ml = String(language || "").toLowerCase() !== "english";
  const backId = Number(page) === 2
    ? USER_GUIDE_ACTION_IDS.PAGE_2
    : USER_GUIDE_ACTION_IDS.PAGE_1;
  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: buildUserGuideTopicText(topic, language).slice(0, 1024) },
    action: { buttons: [
      { type: "reply", reply: { id: backId, title: ml ? "↩️ ഗൈഡിലേക്ക്" : "↩️ User Guide" } },
      { type: "reply", reply: { id: "NAV_HOME", title: ml ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu" } }
    ] }
  });
}

async function sendTermsPrivacyMenu(to, language) {
  const ml = String(language || "").toLowerCase() !== "english";
  const url = /^https:\/\//i.test(String(policyUrl || "").trim())
    ? "\n" + String(policyUrl).trim()
    : "\n" + (ml ? "അംഗീകൃത നയ URL ക്രമീകരിച്ചിട്ടില്ല." : "An approved policy URL is not configured.");
  const contact = String(organisationContact || "").trim()
    ? "\n" + (ml ? "ബന്ധപ്പെടുക: " : "Contact: ") + String(organisationContact).trim()
    : "\n" + (ml ? "സ്ഥാപനത്തിന്റെ ബന്ധപ്പെടൽ വിവരം ക്രമീകരിച്ചിട്ടില്ല." : "Organisation contact details are not configured.");

  return sendInteractiveMessage(to, {
    type: "button",
    body: {
      text: ((ml
        ? "🔐 നിബന്ധനകളും സ്വകാര്യതയും\n\nവിവരങ്ങൾ കാണാനും തിരുത്തലോ ഇല്ലാതാക്കലോ അഭ്യർത്ഥിക്കാനും സമ്മതം പിൻവലിക്കാനും കഴിയും. പൂർണ്ണ നയം വായിക്കുക.\n\nപദ്ധതി: ICAR–കൃഷി വിജ്ഞാന കേന്ദ്രം, CARD, പത്തനംതിട്ട. സാങ്കേതിക പിന്തുണ: IlumiVision"
        : "🔐 Terms & Privacy\n\nYou may access your information and request correction, deletion, or consent withdrawal. Read the complete policy.\n\nA Project of ICAR–Krishi Vigyan Kendra, CARD, Pathanamthitta. Powered by IlumiVision.") + url + contact).slice(0, 1024)
    },
    action: { buttons: [
      { type: "reply", reply: { id: "PRIVACY_READ_POLICY", title: ml ? "📄 പൂർണ്ണ നയം" : "📄 Full Policy" } },
      { type: "reply", reply: { id: "HOME_PROFILE", title: ml ? "↩️ പിന്നോട്ട്" : "↩️ Back" } },
      { type: "reply", reply: { id: "NAV_HOME", title: ml ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu" } }
    ] }
  });
}

async function sendWhatsNewAnnouncement(to, language, feature, explicit) {
  const ml = String(language || "").toLowerCase() !== "english";
  const item = feature || {};
  const title = ml ? item.titleMalayalam : item.titleEnglish;
  const description = ml ? item.descriptionMalayalam : item.descriptionEnglish;
  const instructions = ml ? item.instructionsMalayalam : item.instructionsEnglish;
  const text = item.id
    ? [
        ml ? "🌱 ഭൂമിമിത്രയിൽ പുതിയ സേവനം!" : "🌱 What's New in BhoomiMitra!",
        "",
        title,
        "",
        description,
        "",
        ml ? "ഉപയോഗിക്കാൻ:" : "How to use:",
        instructions
      ].join("\n")
    : (ml ? "ഇപ്പോൾ പ്രഖ്യാപിക്കാനുള്ള പുതിയ ലഭ്യമായ സേവനം ഇല്ല." : "There is no newly available feature to announce right now.");
  const buttons = item.id
    ? [
        { type: "reply", reply: { id: "WHATS_NEW_TRY", title: ml ? "തുറക്കുക" : "Try Now" } },
        { type: "reply", reply: { id: "WHATS_NEW_DISMISS", title: ml ? "ഒഴിവാക്കുക" : "Dismiss" } },
        { type: "reply", reply: { id: explicit ? "NAV_HOME" : "WHATS_NEW_OPEN", title: explicit ? (ml ? "പ്രധാന മെനു" : "Main Menu") : (ml ? "പുതിയ സേവനങ്ങൾ" : "What's New") } }
      ]
    : [
        { type: "reply", reply: { id: "HOME_PROFILE", title: ml ? "↩️ പിന്നോട്ട്" : "↩️ Back" } },
        { type: "reply", reply: { id: "NAV_HOME", title: ml ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu" } }
      ];

  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: text.slice(0, 1024) },
    action: { buttons: buttons }
  });
}
 async function sendPersonalRecordsMenu(
  to,
  language
) {
  const isMalayalam =
    String(language || "")
      .toLowerCase() !==
    "english";

  return sendInteractiveMessage(
    to,
    {
      type: "list",

      body: {
        text:
          isMalayalam
            ? "👤 എന്റെ രേഖകൾ\nഒരു ഓപ്ഷൻ തിരഞ്ഞെടുക്കുക."
            : "👤 My Records\nSelect an option."
      },

      action: {
        button:
          isMalayalam
            ? "📋 രേഖകൾ"
            : "📋 My Records",

        sections: [
          {
            title:
              isMalayalam
                ? "എന്റെ രേഖകൾ"
                : "My Records",

            rows: [
              {
                id: "PERSONAL_DETAILS",
                title:
                  isMalayalam
                    ? "👤 എന്റെ പ്രൊഫൈൽ"
                    : "👤 My Profile"
              },
              {
                id: "PERSONAL_LANDS",
                title:
                  isMalayalam
                    ? "🌾 എന്റെ ഭൂമി / ഫാം"
                    : "🌾 My Lands / Farms"
              },
              {
                id: "PERSONAL_ANIMALS",
                title:
                  isMalayalam
                    ? "🐄 എന്റെ മൃഗങ്ങൾ"
                    : "🐄 My Animals"
              },
              {
                id: "PERSONAL_FARMER_ID",
                title:
                  isMalayalam
                    ? "🪪 കർഷക ഐഡി"
                    : "🪪 My Farmer ID"
              },
              {
                id: "NAV_HOME",
                title:
                  isMalayalam
                    ? "↩️ പിന്നോട്ട്"
                    : "↩️ Back"
              }
            ]
          }
        ]
      }
    }
  );
}

async function sendExpertAdviceChoice(
  to,
  language
) {
  const isMalayalam =
    String(language || "").toLowerCase() ===
    "malayalam";

  return sendInteractiveMessage(to, {
    type: "list",
    body: {
      text: isMalayalam
        ? (
            "👨‍🌾 വിദഗ്ധ സഹായം\n\n" +
            "എങ്ങനെ തുടരണമെന്ന് തിരഞ്ഞെടുക്കുക."
          )
        : (
            "👨‍🌾 Expert Advice\n\n" +
            "Choose how you would like to continue."
          )
    },
    action: {
      buttons: [
        {
          type: "reply",
          reply: {
            id: EXPERT_ADVICE_ACTION_IDS.AI_FIRST,
            title: isMalayalam
              ? "🤖 AI മറുപടി ആദ്യം"
              : "🤖 AI Answer First"
          }
        },
        {
          type: "reply",
          reply: {
            id: EXPERT_ADVICE_ACTION_IDS.DIRECT,
            title: isMalayalam
              ? "👨‍🌾 നേരിട്ട്"
              : "👨‍🌾 Direct Expert"
          }
        },
        {
          type: "reply",
          reply: {
            id: EXPERT_ADVICE_ACTION_IDS.MAIN_MENU,
            title: isMalayalam
              ? "🏠 പ്രധാന മെനു"
              : "🏠 Main Menu"
          }
        }
      ]
    }
  });
}

async function sendExpertConfirmation(
  to,
  language,
  directMode
) {
  const isMalayalam =
    String(language || "").toLowerCase() ===
    "malayalam";
  const direct = Boolean(directMode);

  return sendInteractiveMessage(to, {
    type: "button",
    body: {
      text: isMalayalam
        ? (
            direct
              ? "ഈ ചോദ്യം അനുയോജ്യനായ വിദഗ്ധന് അയയ്ക്കണോ?"
              : "ഈ ചോദ്യം അനുയോജ്യനായ വിദഗ്ധന് അയയ്ക്കാൻ ആഗ്രഹിക്കുന്നുണ്ടോ?"
          )
        : (
            direct
              ? "Send this question to a suitable expert?"
              : "Would you like this question to be sent to a suitable expert?"
          )
    },
    action: {
      buttons: [
        {
          type: "reply",
          reply: {
            id: EXPERT_ADVICE_ACTION_IDS.CONFIRM_YES,
            title: isMalayalam
              ? "✅ അതെ, അയയ്ക്കുക"
              : "✅ Yes, Ask Expert"
          }
        },
        {
          type: "reply",
          reply: {
            id: EXPERT_ADVICE_ACTION_IDS.CONFIRM_NO,
            title: isMalayalam
              ? "❌ വേണ്ട"
              : "❌ No, AI is Enough"
          }
        },
        {
          type: "reply",
          reply: {
            id: EXPERT_ADVICE_ACTION_IDS.MAIN_MENU,
            title: isMalayalam
              ? "🏠 പ്രധാന മെനു"
              : "🏠 Main Menu"
          }
        }
      ]
    }
  });
}

async function sendExpertDeclinedMenu(
  to,
  language
) {
  const isMalayalam =
    String(language || "").toLowerCase() ===
    "malayalam";

  return sendInteractiveMessage(to, {
    type: "button",
    body: {
      text: isMalayalam
        ? "ശരി. ഭൂമിമിത്ര AI ഉപയോഗിച്ച് തുടരാം."
        : "Okay. You can continue with BhoomiMitra AI."
    },
    action: {
      buttons: [
        {
          type: "reply",
          reply: {
            id: EXPERT_ADVICE_ACTION_IDS.ASK_ANOTHER,
            title: isMalayalam
              ? "🤖 മറ്റൊരു ചോദ്യം"
              : "🤖 Ask Another"
          }
        },
        {
          type: "reply",
          reply: {
            id: EXPERT_ADVICE_ACTION_IDS.MAIN_MENU,
            title: isMalayalam
              ? "🏠 പ്രധാന മെനു"
              : "🏠 Main Menu"
          }
        }
      ]
    }
  });
}

async function sendExpertAssignmentCard(
  to,
  language,
  cardText
) {
  const isMalayalam =
    String(language || "").toLowerCase() ===
    "malayalam";

  return sendInteractiveMessage(to, {
    type: "button",
    body: {
      text: String(cardText || "").trim()
    },
    action: {
      buttons: [
        {
          type: "reply",
          reply: {
            id: EXPERT_ADVICE_ACTION_IDS.FOLLOW_UP,
            title: isMalayalam
              ? "💬 തുടർ ചോദ്യം"
              : "💬 Send Follow-up"
          }
        },
        {
          type: "reply",
          reply: {
            id: EXPERT_ADVICE_ACTION_IDS.VIEW_CASE,
            title: isMalayalam
              ? "📄 കേസ് കാണുക"
              : "📄 View Case"
          }
        },
        {
          type: "reply",
          reply: {
            id: EXPERT_ADVICE_ACTION_IDS.MAIN_MENU,
            title: isMalayalam
              ? "🏠 പ്രധാന മെനു"
              : "🏠 Main Menu"
          }
        }
      ]
    }
  });
}

async function sendExpertCaseList(
  to,
  language,
  mode,
  rows
) {
  const isMalayalam =
    String(language || "").toLowerCase() ===
    "malayalam";
  const isView = mode === "VIEW_CASE";

  return sendInteractiveMessage(to, {
    type: "list",
    body: {
      text: isMalayalam
        ? (
            isView
              ? "കാണേണ്ട വിദഗ്ധ കേസ് തിരഞ്ഞെടുക്കുക."
              : "തുടർ ചോദ്യം അയയ്ക്കേണ്ട വിദഗ്ധ കേസ് തിരഞ്ഞെടുക്കുക."
          )
        : (
            isView
              ? "Choose the expert case you want to view."
              : "Choose the expert case for your follow-up."
          )
    },
    action: {
      button: isMalayalam ? "കേസുകൾ കാണുക" : "Choose case",
      sections: [
        {
          title: isMalayalam ? "വിദഗ്ധ കേസുകൾ" : "Expert cases",
          rows: Array.isArray(rows) ? rows.slice(0, 10) : []
        }
      ]
    }
  });
}

async function sendTrainingMenu(to, language) {
  const isMalayalam =
    String(language || "").toLowerCase() === "malayalam";
  const rows = [
    [TRAINING_ACTION_IDS.UPCOMING, "Upcoming Trainings", "വരാനിരിക്കുന്നവ"],
    [TRAINING_ACTION_IDS.CROP_PRODUCTION, "Crop Production", "വിള ഉൽപ്പാദനം"],
    [TRAINING_ACTION_IDS.ANIMAL_HUSBANDRY, "Animal Husbandry", "മൃഗസംരക്ഷണം"],
    [TRAINING_ACTION_IDS.ENTREPRENEURSHIP, "Entrepreneurship", "സംരംഭകത്വം"],
    [TRAINING_ACTION_IDS.VALUE_ADDITION, "Value Addition", "മൂല്യവർധന"],
    [TRAINING_ACTION_IDS.REQUEST_START, "Request Training", "പരിശീലനം അഭ്യർത്ഥിക്കുക"],
    [TRAINING_ACTION_IDS.MY_REQUESTS, "My Training Requests", "എന്റെ അഭ്യർത്ഥനകൾ"],
    [TRAINING_ACTION_IDS.MAIN_MENU, "Main Menu", "പ്രധാന മെനു"]
  ].map(function (entry) {
    return {
      id: entry[0],
      title: isMalayalam ? entry[2] : entry[1]
    };
  });

  return sendInteractiveMessage(to, {
    type: "list",
    body: {
      text: isMalayalam
        ? "🎓 പരിശീലന പരിപാടികൾ\nഒരു വിഭാഗം തിരഞ്ഞെടുക്കുക."
        : "🎓 Training Programmes\nChoose a category."
    },
    action: {
      button: isMalayalam ? "പരിശീലനങ്ങൾ" : "View trainings",
      sections: [
        {
          title: isMalayalam ? "പരിശീലന വിഭാഗങ്ങൾ" : "Training categories",
          rows: rows
        }
      ]
    }
  });
}

async function sendTrainingInformation(to, language) {
  const isMalayalam =
    String(language || "").toLowerCase() === "malayalam";
  const text = isMalayalam
    ? [
        "ℹ️ പരിശീലന വിവരങ്ങൾ",
        "",
        "പരിശോധിച്ച Training_Events_ രേഖകളിൽ പ്രസിദ്ധീകരിച്ച പരിപാടികൾ മാത്രമാണ് BhoomiMitra കാണിക്കുന്നത്.",
        "തീയതി, സ്ഥലം, രീതി, രജിസ്ട്രേഷൻ വിവരങ്ങൾ എന്നിവ പരിപാടിയുടെ വിശദാംശങ്ങളിൽ പരിശോധിക്കുക.",
        "പരിപാടി ലഭ്യമല്ലെങ്കിൽ നിങ്ങൾക്ക് പരിശീലന അഭ്യർത്ഥന സമർപ്പിക്കാം."
      ].join("\n")
    : [
        "ℹ️ Training Information",
        "",
        "BhoomiMitra shows only programmes published in the verified Training_Events_ records.",
        "Open a programme to check its date, location, mode, registration information and contact details.",
        "If no suitable programme is available, you can submit a training request."
      ].join("\n");

  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: text },
    action: {
      buttons: [
        { type: "reply", reply: { id: TRAINING_ACTION_IDS.MY_TRAININGS, title: isMalayalam ? "📅 എന്റെ പരിശീലനം" : "📅 My Trainings" } },
        { type: "reply", reply: { id: TRAINING_ACTION_IDS.OPEN, title: isMalayalam ? "🎓 പരിശീലനങ്ങൾ" : "🎓 Trainings" } },
        { type: "reply", reply: { id: TRAINING_ACTION_IDS.MAIN_MENU, title: isMalayalam ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu" } }
      ]
    }
  });
}

async function sendTrainingProgramList(
  to,
  language,
  rows,
  myTrainings
) {
  const isMalayalam =
    String(language || "").toLowerCase() === "malayalam";

  return sendInteractiveMessage(to, {
    type: "list",
    body: {
      text: myTrainings
        ? (
            isMalayalam
              ? "🎓 എന്റെ പരിശീലനങ്ങൾ\nവിവരങ്ങൾ കാണാൻ ഒരു പരിശീലനം തിരഞ്ഞെടുക്കുക."
              : "🎓 My Trainings\nChoose a programme to view its details."
          )
        : (
            isMalayalam
              ? "🎓 ലഭ്യമായ പരിശീലനങ്ങൾ\nവിവരങ്ങൾ കാണാൻ ഒരു പരിശീലനം തിരഞ്ഞെടുക്കുക."
              : "🎓 Available Trainings\nChoose a programme to view its details."
          )
    },
    action: {
      button: isMalayalam ? "തിരഞ്ഞെടുക്കുക" : "Choose training",
      sections: [
        {
          title: myTrainings
            ? (isMalayalam ? "എന്റെ പരിശീലനങ്ങൾ" : "My Trainings")
            : (isMalayalam ? "പരിശീലനങ്ങൾ" : "Training Programmes"),
          rows: Array.isArray(rows) ? rows.slice(0, 10) : []
        }
      ]
    }
  });
}

async function sendPromotedTrainingList(to, language, rows) {
  const isMalayalam =
    String(language || "").toLowerCase() === "malayalam";

  return sendInteractiveMessage(to, {
    type: "list",
    body: {
      text: isMalayalam
        ? "⭐ ജനപ്രിയ / പ്രോത്സാഹിപ്പിക്കുന്ന പരിശീലനങ്ങൾ\nഒരു പരിശീലനം തിരഞ്ഞെടുക്കുക."
        : "⭐ Popular / Promoted Trainings\nChoose a training."
    },
    action: {
      button: isMalayalam ? "തിരഞ്ഞെടുക്കുക" : "Choose training",
      sections: [{
        title: isMalayalam ? "ജനപ്രിയ പരിശീലനങ്ങൾ" : "Popular trainings",
        rows: Array.isArray(rows) ? rows.slice(0, 5) : []
      }]
    }
  });
}

async function sendPromotedTrainingCard(
  to,
  language,
  detailText,
  programId,
  canRegister
) {
  const isMalayalam =
    String(language || "").toLowerCase() === "malayalam";
  const buttons = [];

  if (canRegister) {
    buttons.push({
      type: "reply",
      reply: {
        id: TRAINING_DYNAMIC_PREFIXES.REGISTER + programId,
        title: isMalayalam ? "✅ താൽപര്യമുണ്ട്" : "✅ I'm Interested"
      }
    });
  }

  buttons.push({
    type: "reply",
    reply: {
      id: TRAINING_DYNAMIC_PREFIXES.DETAILS + programId,
      title: isMalayalam ? "📄 വിശദാംശങ്ങൾ" : "📄 Details"
    }
  });
  buttons.push({
    type: "reply",
    reply: {
      id: TRAINING_ACTION_IDS.MAIN_MENU,
      title: isMalayalam ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu"
    }
  });

  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: String(detailText || "").trim() },
    action: { buttons: buttons }
  });
}

async function sendTrainingDetails(
  to,
  language,
  detailText,
  programId,
  canRegister
) {
  const isMalayalam =
    String(language || "").toLowerCase() === "malayalam";
  const buttons = [];

  if (canRegister) {
    buttons.push({
      type: "reply",
      reply: {
        id: TRAINING_DYNAMIC_PREFIXES.REGISTER + programId,
        title: isMalayalam ? "✅ രജിസ്റ്റർ" : "✅ Register"
      }
    });
  }

  buttons.push({
    type: "reply",
    reply: {
      id: TRAINING_ACTION_IDS.MORE,
      title: isMalayalam ? "📅 കൂടുതൽ" : "📅 More Trainings"
    }
  });
  buttons.push({
    type: "reply",
    reply: {
      id: TRAINING_ACTION_IDS.MAIN_MENU,
      title: isMalayalam ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu"
    }
  });

  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: String(detailText || "").trim() },
    action: { buttons: buttons }
  });
}

async function sendTrainingRegistrationConfirmation(
  to,
  language,
  program,
  alreadyRegistered
) {
  const isMalayalam =
    String(language || "").toLowerCase() === "malayalam";
  const text = isMalayalam
    ? [
        alreadyRegistered
          ? "✅ ഈ പരിപാടിക്ക് നിങ്ങൾ ഇതിനകം രജിസ്റ്റർ ചെയ്തിട്ടുണ്ട്."
          : "✅ പരിശീലന രജിസ്ട്രേഷൻ സ്ഥിരീകരിച്ചു",
        "",
        "പരിപാടി: " + program.title,
        "തീയതി: " + (program.date || "ലഭ്യമല്ല"),
        "വേദി: " + (program.venue || "ലഭ്യമല്ല"),
        "നില: Registered"
      ].join("\n")
    : [
        alreadyRegistered
          ? "✅ You are already registered for this programme."
          : "✅ Training Registration Confirmed",
        "",
        "Programme: " + program.title,
        "Date: " + (program.date || "Not provided"),
        "Venue: " + (program.venue || "Not provided"),
        "Status: Registered"
      ].join("\n");

  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: text },
    action: {
      buttons: [
        {
          type: "reply",
          reply: {
            id: TRAINING_ACTION_IDS.MY_TRAININGS,
            title: isMalayalam ? "📅 എന്റെ പരിശീലനം" : "📅 My Trainings"
          }
        },
        {
          type: "reply",
          reply: {
            id: TRAINING_ACTION_IDS.MORE,
            title: isMalayalam ? "🎓 കൂടുതൽ" : "🎓 More Trainings"
          }
        },
        {
          type: "reply",
          reply: {
            id: TRAINING_ACTION_IDS.MAIN_MENU,
            title: isMalayalam ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu"
          }
        }
      ]
    }
  });
}

async function sendTrainingRequestShortcuts(to, language) {
  const isMalayalam =
    String(language || "").toLowerCase() === "malayalam";

  return sendInteractiveMessage(to, {
    type: "button",
    body: {
      text: isMalayalam
        ? "രജിസ്റ്റർ ചെയ്തതും ജനപ്രിയവുമായ പരിശീലനങ്ങൾ ഇവിടെ കാണാം."
        : "You can also view your registrations and popular trainings."
    },
    action: {
      buttons: [
        {
          type: "reply",
          reply: {
            id: TRAINING_ACTION_IDS.MY_TRAININGS,
            title: isMalayalam ? "📅 എന്റെ പരിശീലനം" : "📅 My Trainings"
          }
        },
        {
          type: "reply",
          reply: {
            id: TRAINING_ACTION_IDS.INFORMATION,
            title: isMalayalam ? "ℹ️ പരിശീലന വിവരം" : "ℹ️ Training Info"
          }
        },
        {
          type: "reply",
          reply: {
            id: TRAINING_ACTION_IDS.PROMOTED,
            title: isMalayalam ? "⭐ ജനപ്രിയ പരിശീലനം" : "⭐ Popular Trainings"
          }
        }
      ]
    }
  });
}

async function sendTrainingRequestPrompt(to, language) {
  const isMalayalam =
    String(language || "").toLowerCase() === "malayalam";

  return sendInteractiveMessage(to, {
    type: "button",
    body: {
      text: isMalayalam
        ? "നിങ്ങളുടെ പരിശീലന ആവശ്യം ടൈപ്പ് ചെയ്ത് അയയ്ക്കുക. പിന്തുണയുള്ള വോയ്സ് സന്ദേശവും അയയ്ക്കാം.\nനിർത്താൻ CANCEL എന്ന് ടൈപ്പ് ചെയ്യുക."
        : "Type your training requirement and send it. You may also send a supported voice message.\nType CANCEL to stop."
    },
    action: {
      buttons: [
        {
          type: "reply",
          reply: {
            id: TRAINING_ACTION_IDS.MY_REQUESTS,
            title: isMalayalam ? "📋 എന്റെ അഭ്യർത്ഥന" : "📋 My Requests"
          }
        },
        {
          type: "reply",
          reply: {
            id: TRAINING_ACTION_IDS.REQUEST_CANCEL,
            title: isMalayalam ? "❌ റദ്ദാക്കുക" : "❌ Cancel"
          }
        }
      ]
    }
  });
}

async function sendTrainingModePreference(to, language) {
  const isMalayalam =
    String(language || "").toLowerCase() === "malayalam";

  return sendInteractiveMessage(to, {
    type: "list",
    body: {
      text: isMalayalam
        ? "ഇഷ്ടപ്പെട്ട പരിശീലന രീതി തിരഞ്ഞെടുക്കുക:"
        : "Preferred training mode:"
    },
    action: {
      button: isMalayalam ? "രീതി തിരഞ്ഞെടുക്കുക" : "Choose mode",
      sections: [{
        title: isMalayalam ? "പരിശീലന രീതി" : "Training mode",
        rows: [
        {
          id: TRAINING_ACTION_IDS.REQUEST_MODE_ONLINE,
          title: isMalayalam ? "💻 ഓൺലൈൻ" : "💻 Online"
        },
        {
          id: TRAINING_ACTION_IDS.REQUEST_MODE_OFFLINE,
          title: isMalayalam ? "🏫 നേരിട്ട്" : "🏫 Offline / In-person"
        },
        {
          id: TRAINING_ACTION_IDS.REQUEST_MODE_EITHER,
          title: isMalayalam ? "🔄 ഏതും മതി" : "🔄 Either is fine"
        }
        ]
      }]
    }
  });
}

async function sendTrainingTimePreference(to, language) {
  const isMalayalam =
    String(language || "").toLowerCase() === "malayalam";

  return sendInteractiveMessage(to, {
    type: "button",
    body: {
      text: isMalayalam ? "ഇഷ്ടപ്പെട്ട സമയം:" : "Preferred time:"
    },
    action: {
      buttons: [
        {
          type: "reply",
          reply: {
            id: TRAINING_ACTION_IDS.REQUEST_TIME_AFTERNOON,
            title: "🕑 2:00–5:00 PM"
          }
        },
        {
          type: "reply",
          reply: {
            id: TRAINING_ACTION_IDS.REQUEST_TIME_EVENING,
            title: "🌙 7:00–10:00 PM"
          }
        },
        {
          type: "reply",
          reply: {
            id: TRAINING_ACTION_IDS.REQUEST_TIME_EITHER,
            title: isMalayalam ? "🔄 ഏതും മതി" : "🔄 Either is fine"
          }
        }
      ]
    }
  });
}

async function sendTrainingLocationPrompt(to, language) {
  const isMalayalam =
    String(language || "").toLowerCase() === "malayalam";

  return sendInteractiveMessage(to, {
    type: "button",
    body: {
      text: isMalayalam
        ? "ഓഫ്‌ലൈൻ പരിശീലനത്തിന് ഇഷ്ടപ്പെട്ട സ്ഥലം ടൈപ്പ് ചെയ്യുക. പ്രത്യേക മുൻഗണന ഇല്ലെങ്കിൽ SKIP എന്ന് അയയ്ക്കുക."
        : "Type the preferred location for offline training. Send SKIP if you have no location preference."
    },
    action: {
      buttons: [{
        type: "reply",
        reply: {
          id: TRAINING_ACTION_IDS.REQUEST_CANCEL,
          title: isMalayalam ? "❌ റദ്ദാക്കുക" : "❌ Cancel"
        }
      }]
    }
  });
}

async function sendTrainingDateChoice(to, language) {
  const isMalayalam = String(language || "").toLowerCase() === "malayalam";
  return sendInteractiveMessage(to, {
    type: "button",
    body: {
      text: isMalayalam
        ? "ഇഷ്ടപ്പെട്ട തീയതി തിരഞ്ഞെടുക്കുക:"
        : "Choose your preferred date:"
    },
    action: { buttons: [
      {
        type: "reply",
        reply: {
          id: TRAINING_ACTION_IDS.REQUEST_DATE_SPECIFIC,
          title: isMalayalam ? "📅 പ്രത്യേക തീയതി" : "📅 Specific date"
        }
      },
      {
        type: "reply",
        reply: {
          id: TRAINING_ACTION_IDS.REQUEST_DATE_ANY,
          title: isMalayalam ? "🔄 സൗകര്യപ്രദമായത്" : "🔄 Any convenient"
        }
      },
      {
        type: "reply",
        reply: {
          id: TRAINING_ACTION_IDS.REQUEST_CANCEL,
          title: isMalayalam ? "❌ റദ്ദാക്കുക" : "❌ Cancel"
        }
      }
    ] }
  });
}

async function sendTrainingDatePrompt(to, language) {
  const isMalayalam =
    String(language || "").toLowerCase() === "malayalam";

  return sendInteractiveMessage(to, {
    type: "button",
    body: {
      text: isMalayalam
        ? "ഇഷ്ടപ്പെട്ട പ്രത്യേക തീയതി അല്ലെങ്കിൽ തീയതി പരിധി ടൈപ്പ് ചെയ്യുക. നിർത്താൻ CANCEL എന്ന് അയയ്ക്കുക."
        : "Type your specific preferred date or date range. Type CANCEL to stop."
    },
    action: {
      buttons: [{
        type: "reply",
        reply: {
          id: TRAINING_ACTION_IDS.REQUEST_CANCEL,
          title: isMalayalam ? "❌ റദ്ദാക്കുക" : "❌ Cancel"
        }
      }]
    }
  });
}

async function sendTrainingRemarksPrompt(to, language) {
  const isMalayalam =
    String(language || "").toLowerCase() === "malayalam";

  return sendInteractiveMessage(to, {
    type: "button",
    body: {
      text: isMalayalam
        ? "കൂടുതൽ ആവശ്യങ്ങളോ കുറിപ്പുകളോ ടൈപ്പ് ചെയ്യുക. ഒന്നുമില്ലെങ്കിൽ SKIP എന്ന് അയക്കുക."
        : "Type any additional needs or remarks. Send SKIP if you have none."
    },
    action: {
      buttons: [{
        type: "reply",
        reply: {
          id: TRAINING_ACTION_IDS.REQUEST_CANCEL,
          title: isMalayalam ? "❌ റദ്ദാക്കുക" : "❌ Cancel"
        }
      }]
    }
  });
}

async function sendTrainingRequestConfirmation(
  to,
  language,
  topic,
  mode,
  preferredTime,
  preferredLocation,
  preferredDate,
  remarks
) {
  const isMalayalam =
    String(language || "").toLowerCase() === "malayalam";
  const modeValue = String(mode || "Either").trim();
  const timeValue = String(preferredTime || "Not applicable").trim();
  const displayedMode = isMalayalam
    ? ({
        "Online": "ഓൺലൈൻ",
        "Offline / In-person": "ഓഫ്‌ലൈൻ / നേരിട്ട്",
        "Either": "ഏതും മതി"
      }[modeValue] || modeValue)
    : modeValue;
  const displayedTime = isMalayalam
    ? ({
        "Either": "ഏതും മതി",
        "Not applicable": "ബാധകമല്ല"
      }[timeValue] || timeValue)
    : timeValue;
  const locationValue = String(preferredLocation || "").trim();
  const dateValue = String(preferredDate || "").trim();
  const remarksValue = String(remarks || "").trim();
  const text = isMalayalam
    ? [
        "🎓 പരിശീലന അഭ്യർത്ഥന",
        "",
        "ആവശ്യപ്പെട്ട പരിശീലനം:",
        String(topic || "").trim(),
        "",
        "ഇഷ്ടപ്പെട്ട രീതി: " + displayedMode,
        "ഇഷ്ടപ്പെട്ട സമയം: " + displayedTime,
        "ഇഷ്ടപ്പെട്ട സ്ഥലം: " + (locationValue || "നൽകിയിട്ടില്ല"),
        "ഇഷ്ടപ്പെട്ട തീയതി: " + (dateValue || "നൽകിയിട്ടില്ല"),
        "കുറിപ്പുകൾ: " + (remarksValue || "ഒന്നുമില്ല"),
        "",
        "ഈ അഭ്യർത്ഥന KVK-യിലേക്ക് സമർപ്പിക്കണോ?"
      ].join("\n")
    : [
        "🎓 Training Request",
        "",
        "Requested training:",
        String(topic || "").trim(),
        "",
        "Preferred mode: " + displayedMode,
        "Preferred time: " + displayedTime,
        "Preferred location: " + (locationValue || "Not provided"),
        "Preferred date: " + (dateValue || "Not provided"),
        "Remarks: " + (remarksValue || "None"),
        "",
        "Submit this request to KVK?"
      ].join("\n");

  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: text },
    action: {
      buttons: [
        {
          type: "reply",
          reply: {
            id: TRAINING_ACTION_IDS.REQUEST_SUBMIT,
            title: isMalayalam ? "✅ അഭ്യർത്ഥന നൽകുക" : "✅ Submit Request"
          }
        },
        {
          type: "reply",
          reply: {
            id: TRAINING_ACTION_IDS.REQUEST_CHANGE,
            title: isMalayalam ? "✏️ തിരുത്തുക" : "✏️ Edit Request"
          }
        },
        {
          type: "reply",
          reply: {
            id: TRAINING_ACTION_IDS.REQUEST_CANCEL,
            title: isMalayalam ? "❌ റദ്ദാക്കുക" : "❌ Cancel"
          }
        }
      ]
    }
  });
}

async function sendTrainingRequestSubmitted(to, language, topic, requestId) {
  const isMalayalam =
    String(language || "").toLowerCase() === "malayalam";
  const text = isMalayalam
    ? [
        "✅ പരിശീലന അഭ്യർത്ഥന സമർപ്പിച്ചു",
        "",
        "ആവശ്യപ്പെട്ട പരിശീലനം:",
        String(topic || "").trim(),
        "അഭ്യർത്ഥന ഐഡി: " + String(requestId || "").trim(),
        "",
        "നിങ്ങളുടെ അഭ്യർത്ഥന ICAR-KVK പത്തനംതിട്ടയിലേക്ക് അയച്ചു. പരിപാടി നിശ്ചയിച്ചാൽ നിങ്ങളെ അറിയിക്കും."
      ].join("\n")
    : [
        "✅ Training Request Submitted",
        "",
        "Requested training:",
        String(topic || "").trim(),
        "Request ID: " + String(requestId || "").trim(),
        "",
        "Your request has been sent to ICAR-KVK Pathanamthitta. You will be informed if a programme is scheduled."
      ].join("\n");

  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: text },
    action: {
      buttons: [
        {
          type: "reply",
          reply: {
            id: TRAINING_ACTION_IDS.MY_REQUESTS,
            title: isMalayalam ? "📋 എന്റെ അഭ്യർത്ഥന" : "📋 My Requests"
          }
        },
        {
          type: "reply",
          reply: {
            id: TRAINING_ACTION_IDS.OPEN,
            title: isMalayalam ? "🎓 പരിശീലനങ്ങൾ" : "🎓 Programmes"
          }
        },
        {
          type: "reply",
          reply: {
            id: TRAINING_ACTION_IDS.MAIN_MENU,
            title: isMalayalam ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu"
          }
        }
      ]
    }
  });
}

async function sendMyTrainingRequests(to, language, requests) {
  const isMalayalam =
    String(language || "").toLowerCase() === "malayalam";
  const records = Array.isArray(requests) ? requests.slice(0, 5) : [];
  const lines = [
    isMalayalam ? "📋 എന്റെ പരിശീലന അഭ്യർത്ഥനകൾ" : "📋 My Training Requests"
  ];

  records.forEach(function (request, index) {
    const requestedDate = String(request.requestedAt || "").slice(0, 10) ||
      (isMalayalam ? "തീയതി ലഭ്യമല്ല" : "Date unavailable");
    const storedMode = String(request.mode || "").trim();
    const storedTime = String(request.preferredTime || "").trim();
    const storedLocation = String(request.preferredLocation || "").trim();
    const storedDate = String(request.preferredDate || "").trim();
    const storedCategory = String(request.category || "").trim();
    const storedCoordinator = String(request.assignedCoordinator || "").trim();
    const mode = isMalayalam
      ? ({
          "Online": "ഓൺലൈൻ",
          "Offline / In-person": "ഓഫ്‌ലൈൻ / നേരിട്ട്",
          "Either": "ഏതും മതി"
        }[storedMode] || storedMode)
      : storedMode;
    const preferredTime = isMalayalam
      ? ({
          "Either": "ഏതും മതി",
          "Not applicable": "ബാധകമല്ല"
        }[storedTime] || storedTime)
      : storedTime;
    lines.push(
      "",
      String(index + 1) + ". " + String(request.topic || "").trim().slice(0, 120),
      (isMalayalam ? "തീയതി: " : "Requested: ") + requestedDate,
      (isMalayalam ? "നില: " : "Status: ") + (request.status || "Requested")
    );

    if (mode) {
      lines.push((isMalayalam ? "രീതി: " : "Mode: ") + mode);
    }
    if (preferredTime) {
      lines.push((isMalayalam ? "സമയം: " : "Time: ") + preferredTime);
    }
    if (storedCategory) {
      lines.push((isMalayalam ? "വിഭാഗം: " : "Category: ") + storedCategory);
    }
    if (storedLocation) {
      lines.push((isMalayalam ? "സ്ഥലം: " : "Location: ") + storedLocation);
    }
    if (storedDate) {
      lines.push((isMalayalam ? "ഇഷ്ടപ്പെട്ട തീയതി: " : "Preferred date: ") + storedDate);
    }
    if (storedCoordinator) {
      lines.push((isMalayalam ? "കോർഡിനേറ്റർ: " : "Coordinator: ") + storedCoordinator);
    }
  });

  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: lines.join("\n").slice(0, 1000) },
    action: {
      buttons: [
        {
          type: "reply",
          reply: {
            id: TRAINING_ACTION_IDS.REQUEST_START,
            title: isMalayalam ? "🎓 പുതിയ അഭ്യർത്ഥന" : "🎓 New Request"
          }
        },
        {
          type: "reply",
          reply: {
            id: TRAINING_ACTION_IDS.OPEN,
            title: isMalayalam ? "🎓 പരിശീലനങ്ങൾ" : "🎓 Programmes"
          }
        },
        {
          type: "reply",
          reply: {
            id: TRAINING_ACTION_IDS.MAIN_MENU,
            title: isMalayalam ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu"
          }
        }
      ]
    }
  });
}

async function sendSchemesMenu(to, language) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  const rows = [
    [SCHEME_ACTION_IDS.CROP, "Crop & Agriculture", "വിള / കാർഷിക പദ്ധതികൾ"],
    [SCHEME_ACTION_IDS.LIVESTOCK, "Animal & Dairy", "മൃഗ / ക്ഷീര പദ്ധതികൾ"],
    [SCHEME_ACTION_IDS.FISHERIES, "Fisheries & Allied", "മത്സ്യ / അനുബന്ധം"],
    [SCHEME_ACTION_IDS.ENTERPRISE, "Agricultural Enterprise", "കാർഷിക സംരംഭ പദ്ധതികൾ"],
    [SCHEME_ACTION_IDS.RELEVANT, "Relevant Schemes for Me", "എനിക്ക് പ്രസക്തമായവ"],
    [SCHEME_ACTION_IDS.CENTRAL, "Central Government", "കേന്ദ്ര സർക്കാർ പദ്ധതികൾ"],
    [SCHEME_ACTION_IDS.KERALA, "Kerala Government", "കേരള സർക്കാർ പദ്ധതികൾ"],
    [SCHEME_ACTION_IDS.SEARCH, "Search by Topic", "വിഷയം തിരയുക"],
    [SCHEME_ACTION_IDS.APPLICATION_GUIDANCE, "Details / Application", "വിശദാംശം / അപേക്ഷ"],
    [SCHEME_ACTION_IDS.MAIN_MENU, "Main Menu", "പ്രധാന മെനു"]
  ].map(function (entry) {
    return { id: entry[0], title: ml ? entry[2] : entry[1] };
  });

  return sendInteractiveMessage(to, {
    type: "list",
    body: {
      text: ml
        ? "🏛️ സർക്കാർ പദ്ധതികളും കാർഷിക അറിയിപ്പുകളും\nഒരു ഓപ്ഷൻ തിരഞ്ഞെടുക്കുക."
        : "🏛️ Government Schemes & Advisories\nChoose an option."
    },
    action: {
      button: ml ? "പദ്ധതികൾ കാണുക" : "View schemes",
      sections: [{
        title: ml ? "പദ്ധതികളും അറിയിപ്പുകളും" : "Schemes and advisories",
        rows: rows
      }]
    }
  });
}

async function sendSchemeMoreMenu(to, language) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  const rows = [
    [SCHEME_ACTION_IDS.MACHINERY, "Machinery / Irrigation", "യന്ത്രം / ജലസേചനം"],
    [SCHEME_ACTION_IDS.FINANCIAL, "Subsidies & Support", "സബ്സിഡിയും സഹായവും"],
    [SCHEME_ACTION_IDS.INSURANCE, "Insurance / Risk", "ഇൻഷുറൻസ് / നഷ്ടസഹായം"],
    [SCHEME_ACTION_IDS.ADVISORIES, "Current Advisories", "നിലവിലെ അറിയിപ്പുകൾ"],
    [SCHEME_ACTION_IDS.SEARCH, "Search by Topic", "വിഷയം തിരയുക"],
    [SCHEME_ACTION_IDS.MY_INTERESTS, "My Scheme Interests", "എന്റെ പദ്ധതി താൽപര്യങ്ങൾ"],
    [SCHEME_ACTION_IDS.OPEN, "Back to Schemes", "പദ്ധതികളിലേക്ക് മടങ്ങുക"],
    [SCHEME_ACTION_IDS.MAIN_MENU, "Main Menu", "പ്രധാന മെനു"]
  ].map(function (entry) {
    return { id: entry[0], title: ml ? entry[2] : entry[1] };
  });

  return sendInteractiveMessage(to, {
    type: "list",
    body: {
      text: ml
        ? "🏛️ കൂടുതൽ പദ്ധതി വിഭാഗങ്ങളും നിലവിലെ അറിയിപ്പുകളും"
        : "🏛️ More scheme categories and current advisories"
    },
    action: {
      button: ml ? "വിഭാഗം തിരഞ്ഞെടുക്കുക" : "Choose category",
      sections: [{
        title: ml ? "കൂടുതൽ ഓപ്ഷനുകൾ" : "More options",
        rows: rows
      }]
    }
  });
}

async function sendSchemeApplicationGuidance(to, language) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  const text = ml
    ? [
        "📝 പദ്ധതി അപേക്ഷാ മാർഗനിർദേശം",
        "",
        "പദ്ധതിയുടെ വിശദാംശങ്ങൾ തുറന്ന് ഔദ്യോഗിക ലിങ്ക്, നിലവിലെ യോഗ്യത, അപേക്ഷാ കാലയളവ്, ആവശ്യമായ രേഖകൾ എന്നിവ പരിശോധിക്കുക.",
        "",
        "BhoomiMitra അപേക്ഷ സമർപ്പിക്കുകയോ യോഗ്യത ഉറപ്പുനൽകുകയോ ചെയ്യുന്നില്ല. ഔദ്യോഗിക പോർട്ടൽ അല്ലെങ്കിൽ ബന്ധപ്പെട്ട സർക്കാർ ഓഫീസ് വഴിയാണ് അപേക്ഷിക്കേണ്ടത്."
      ].join("\n")
    : [
        "📝 Scheme Application Guidance",
        "",
        "Open a scheme's details and verify its official link, current eligibility, application period and required documents.",
        "",
        "BhoomiMitra does not submit applications or guarantee eligibility. Apply only through the official portal or the responsible government office."
      ].join("\n");

  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: text },
    action: {
      buttons: [
        { type: "reply", reply: { id: SCHEME_ACTION_IDS.OPEN, title: ml ? "🏛️ പദ്ധതികൾ" : "🏛️ Schemes" } },
        { type: "reply", reply: { id: SCHEME_ACTION_IDS.MORE_CATEGORIES, title: ml ? "📋 കൂടുതൽ" : "📋 More Options" } },
        { type: "reply", reply: { id: SCHEME_ACTION_IDS.MAIN_MENU, title: ml ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu" } }
      ]
    }
  });
}

async function sendSchemeList(to, language, rows, relevant) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  return sendInteractiveMessage(to, {
    type: "list",
    body: {
      text: relevant
        ? (ml
            ? "🏛️ നിങ്ങൾക്ക് പ്രസക്തമായിരിക്കാവുന്ന പദ്ധതികൾ\nഅപേക്ഷിക്കുന്നതിന് മുമ്പ് യോഗ്യത പരിശോധിക്കുക."
            : "🏛️ Schemes that may be relevant to you\nPlease verify eligibility before applying.")
        : (ml
            ? "🏛️ സജീവ സർക്കാർ പദ്ധതികൾ\nവിവരങ്ങൾ കാണാൻ ഒരു പദ്ധതി തിരഞ്ഞെടുക്കുക."
            : "🏛️ Active government schemes\nChoose a scheme to view details.")
    },
    action: {
      button: ml ? "പദ്ധതി എടുക്കുക" : "Choose scheme",
      sections: [{
        title: ml ? "സർക്കാർ പദ്ധതികൾ" : "Government schemes",
        rows: Array.isArray(rows) ? rows.slice(0, 10) : []
      }]
    }
  });
}

async function sendSchemeDetails(to, language, detailText, schemeId, expanded) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  return sendInteractiveMessage(to, {
    type: "list",
    body: { text: String(detailText || "").trim() },
    action: {
      button: ml ? "ഒരു നടപടി തിരഞ്ഞെടുക്കുക" : "Choose action",
      sections: [{
        title: ml ? "പദ്ധതി നടപടികൾ" : "Scheme actions",
        rows: [
        {
          id: SCHEME_DYNAMIC_PREFIXES.INTEREST + schemeId,
          title: ml ? "✅ താൽപര്യമുണ്ട്" : "✅ I'm Interested"
        },
        {
          id: SCHEME_DYNAMIC_PREFIXES.HELP + schemeId,
          title: ml ? "🆘 അപേക്ഷാ സഹായം" : "🆘 Need Help to Apply"
        },
        {
          id: SCHEME_ACTION_IDS.OPEN,
          title: ml ? "📄 കൂടുതൽ പദ്ധതികൾ" : "📄 More Schemes"
        },
        {
          id: SCHEME_ACTION_IDS.MAIN_MENU,
          title: ml ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu"
        }
        ]
      }]
    }
  });
}

async function sendSchemeSearchResults(to, language, rows) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  return sendInteractiveMessage(to, {
    type: "list",
    body: {
      text: ml
        ? "🔎 ലഭ്യമായ സജീവ പദ്ധതികളും നിലവിലെ അറിയിപ്പുകളും\nഒരു ഫലം തിരഞ്ഞെടുക്കുക."
        : "🔎 Matching active schemes and current advisories\nChoose a result."
    },
    action: {
      button: ml ? "ഫലം തിരഞ്ഞെടുക്കുക" : "Choose result",
      sections: [{
        title: ml ? "തിരയൽ ഫലങ്ങൾ" : "Search results",
        rows: Array.isArray(rows) ? rows.slice(0, 10) : []
      }]
    }
  });
}

async function sendSchemeInterestConfirmation(to, language, scheme, status, duplicate) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  const displayedStatus = ml
    ? ({
        "Interested": "താൽപര്യം രേഖപ്പെടുത്തി",
        "Help Requested": "അപേക്ഷാ സഹായം അഭ്യർത്ഥിച്ചു"
      }[status] || status)
    : status;
  const text = ml
    ? [
        duplicate ? "✅ ഈ അഭ്യർത്ഥന മുമ്പേ രേഖപ്പെടുത്തിയിട്ടുണ്ട്" : "✅ പദ്ധതി താൽപര്യം രേഖപ്പെടുത്തി",
        "",
        "പദ്ധതി: " + scheme.name,
        "നില: " + displayedStatus,
        "",
        "നിലവിലെ യോഗ്യതയും അപേക്ഷാ നിബന്ധനകളും ഔദ്യോഗിക ഉറവിടത്തിൽ പരിശോധിക്കുക."
      ].join("\n")
    : [
        duplicate ? "✅ This request is already recorded" : "✅ Scheme interest recorded",
        "",
        "Scheme: " + scheme.name,
        "Status: " + status,
        "",
        "Please verify current eligibility and application conditions with the official source."
      ].join("\n");
  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: text },
    action: {
      buttons: [
        { type: "reply", reply: { id: SCHEME_ACTION_IDS.MY_INTERESTS, title: ml ? "📋 എന്റെ താൽപര്യങ്ങൾ" : "📋 My Interests" } },
        { type: "reply", reply: { id: SCHEME_ACTION_IDS.OPEN, title: ml ? "🏛️ പദ്ധതികൾ" : "🏛️ Schemes" } },
        { type: "reply", reply: { id: SCHEME_ACTION_IDS.MAIN_MENU, title: ml ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu" } }
      ]
    }
  });
}

async function sendSchemeSearchPrompt(to, language) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  return sendInteractiveMessage(to, {
    type: "button",
    body: {
      text: ml
        ? "ഏത് പദ്ധതി അല്ലെങ്കിൽ സഹായമാണ് തിരയേണ്ടത്? വിഷയം ടൈപ്പ് ചെയ്യുകയോ വോയ്സ് സന്ദേശം അയയ്ക്കുകയോ ചെയ്യാം."
        : "What scheme or support are you looking for? Type a topic or send a voice message."
    },
    action: {
      buttons: [
        { type: "reply", reply: { id: SCHEME_ACTION_IDS.MY_INTERESTS, title: ml ? "📋 എന്റെ താൽപര്യങ്ങൾ" : "📋 My Interests" } },
        { type: "reply", reply: { id: SCHEME_ACTION_IDS.OPEN, title: ml ? "❌ റദ്ദാക്കുക" : "❌ Cancel" } }
      ]
    }
  });
}

async function sendMySchemeInterests(to, language, interests) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  const lines = [ml ? "📋 എന്റെ പദ്ധതി താൽപര്യങ്ങൾ" : "📋 My Scheme Interests"];
  (interests || []).slice(0, 5).forEach(function (interest, index) {
    const status = ml
      ? ({
          "Interested": "താൽപര്യം രേഖപ്പെടുത്തി",
          "Help Requested": "അപേക്ഷാ സഹായം അഭ്യർത്ഥിച്ചു"
        }[interest.status] || interest.status)
      : interest.status;
    lines.push(
      "",
      String(index + 1) + ". " + String(interest.schemeName || "").slice(0, 120),
      (ml ? "തീയതി: " : "Date: ") + (String(interest.requestedAt || "").slice(0, 10) || "-"),
      (ml ? "നില: " : "Status: ") + status
    );
  });
  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: lines.join("\n").slice(0, 1000) },
    action: {
      buttons: [
        { type: "reply", reply: { id: SCHEME_ACTION_IDS.OPEN, title: ml ? "🏛️ പദ്ധതികൾ" : "🏛️ Schemes" } },
        { type: "reply", reply: { id: SCHEME_ACTION_IDS.MAIN_MENU, title: ml ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu" } }
      ]
    }
  });
}

async function sendSchemeAdvisories(to, language, text) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: String(text || "").trim() },
    action: {
      buttons: [
        { type: "reply", reply: { id: SCHEME_ACTION_IDS.OPEN, title: ml ? "🏛️ പദ്ധതികൾ" : "🏛️ Schemes" } },
        { type: "reply", reply: { id: SCHEME_ACTION_IDS.MAIN_MENU, title: ml ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu" } }
      ]
    }
  });
}

async function sendFarmAlertsMenu(to, language) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  return sendInteractiveMessage(to, {
    type: "list",
    body: {
      text: "🌿 വളപ്രയോഗ ഡയറിയും ഓർമ്മപ്പെടുത്തലും\n\nരേഖപ്പെടുത്തിയതും ആസൂത്രണം ചെയ്തതുമായ വളപ്രയോഗങ്ങൾ കാണുക.\n\n🌿 Fertilizer diary and reminders\n\nView completed and planned fertilizer applications."
    },
    action: {
      button: ml ? "അലർട്ടുകൾ തിരഞ്ഞെടുക്കുക" : "Choose alerts",
      sections: [{
        title: ml ? "വളപ്രയോഗം" : "Fertilizer application",
        rows: [
          { id: FARM_ALERT_ACTION_IDS.ACTIVE, title: ml ? "🔔 ആസൂത്രണം ചെയ്തത്" : "🔔 Planned", description: ml ? "വരാനിരിക്കുന്ന വളപ്രയോഗങ്ങൾ" : "Upcoming fertilizer applications" },
          { id: FARM_ALERT_ACTION_IDS.ADD, title: ml ? "✅ പൂർത്തിയായത് ചേർക്കുക" : "✅ Record completed", description: ml ? "ചെയ്ത വളപ്രയോഗം രേഖപ്പെടുത്തുക" : "Add a fertilizer diary entry" },
          { id: FARM_ALERT_ACTION_IDS.PLAN, title: ml ? "📅 ഓർമ്മപ്പെടുത്തൽ" : "📅 Plan reminder", description: ml ? "2 ദിവസം മുമ്പ് ഓർമ്മിപ്പിക്കുക" : "Opt in to a 2-day reminder" },
          { id: FARM_ALERT_ACTION_IDS.HISTORY, title: ml ? "📖 ഡയറി ചരിത്രം" : "📖 Diary history", description: ml ? "പൂർത്തിയായ വളപ്രയോഗങ്ങൾ" : "Completed fertilizer applications" },
          { id: FARM_ALERT_ACTION_IDS.FARM_MENU, title: ml ? "↩️ എന്റെ കൃഷിയിടം" : "↩️ My Farm", description: ml ? "കൃഷി മെനുവിലേക്ക്" : "Return to farm menu" },
          { id: FARM_ALERT_ACTION_IDS.MAIN_MENU, title: ml ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu", description: ml ? "BhoomiMitra ഹോം" : "BhoomiMitra home" }
        ]
      }]
    }
  });
}

async function sendCropFarmMenu(to, language) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  const labels = [
    [CROP_FARM_ACTION_IDS.REGISTER, "Register Crop", "വിള രജിസ്റ്റർ", "Add a crop to a verified land", "സ്ഥിരീകരിച്ച ഭൂമിയിൽ വിള ചേർക്കുക"],
    [CROP_FARM_ACTION_IDS.MY_CROPS, "My Crops", "എന്റെ വിളകൾ", "View current registered crops", "നിലവിലെ വിളകൾ കാണുക"],
    [CROP_FARM_ACTION_IDS.HISTORY, "Crop History", "വിള ചരിത്രം", "Current and previous crops", "നിലവിലെയും പഴയതുമായ വിളകൾ"],
    [CROP_FARM_ACTION_IDS.RECORD_OPERATION, "Record Farm Activity", "കൃഷിപ്പണി രേഖ", "Completed or planned operation", "പൂർത്തിയായതോ ആസൂത്രണം ചെയ്തതോ"],
    [CROP_FARM_ACTION_IDS.ACTIVITIES, "My Farm Activities", "എന്റെ കൃഷിപ്പണികൾ", "Recent operation history", "സമീപകാല പ്രവർത്തന ചരിത്രം"],
    [CROP_FARM_ACTION_IDS.PLANNED, "Planned Operations", "ആസൂത്രിത പണികൾ", "View farmer-recorded plans", "ആസൂത്രണം ചെയ്ത പണികൾ"],
    [CROP_FARM_ACTION_IDS.ALERTS, "Farm & Crop Alerts", "കൃഷി മുന്നറിയിപ്പുകൾ", "Verified and scheduled alerts", "സ്ഥിരീകരിച്ചതും ആസൂത്രിതവും"],
    [CROP_FARM_ACTION_IDS.FERTILIZER, "Fertilizer Diary", "വളപ്രയോഗ ഡയറി", "Existing diary and reminders", "നിലവിലെ ഡയറിയും ഓർമ്മപ്പെടുത്തലും"],
    [CROP_FARM_ACTION_IDS.MAIN_MENU, "Main Menu", "പ്രധാന മെനു", "BhoomiMitra home", "BhoomiMitra ഹോം"]
  ];
  return sendInteractiveMessage(to, {
    type: "list",
    body: { text: ml
      ? "🌱 വിളകളും കൃഷിരേഖകളും\n\nഒരു പ്രവർത്തനം തിരഞ്ഞെടുക്കുക."
      : "🌱 Crop and Farm Records\n\nChoose an action." },
    action: {
      button: ml ? "പ്രവർത്തനങ്ങൾ" : "Choose action",
      sections: [{ title: ml ? "കൃഷിരേഖകൾ" : "Crop and farm records", rows: labels.map(function (item) {
        return { id: item[0], title: (ml ? item[2] : item[1]).slice(0, 24), description: (ml ? item[4] : item[3]).slice(0, 72) };
      }) }]
    }
  });
}

async function sendCropFarmLandList(to, language, rows, purpose) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  return sendInteractiveMessage(to, {
    type: "list",
    body: { text: purpose === "operation"
      ? (ml ? "കൃഷിപ്പണി രേഖപ്പെടുത്തേണ്ട നിങ്ങളുടെ ഭൂമി തിരഞ്ഞെടുക്കുക." : "Choose your land for this farm activity.")
      : (ml ? "വിള രജിസ്റ്റർ ചെയ്യേണ്ട നിങ്ങളുടെ ഭൂമി തിരഞ്ഞെടുക്കുക." : "Choose your land for crop registration.") },
    action: { button: ml ? "ഭൂമി തിരഞ്ഞെടുക്കുക" : "Choose land", sections: [{ title: ml ? "എന്റെ ഭൂമികൾ" : "My verified lands", rows: rows }] }
  });
}

async function sendCropFarmOperationTypes(to, language, rows) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  return sendInteractiveMessage(to, {
    type: "list",
    body: { text: ml ? "കൃഷിപ്പണിയുടെ തരം തിരഞ്ഞെടുക്കുക." : "Choose the farm activity type. Use Fertilizer Diary for fertilizer applications." },
    action: { button: ml ? "പണി തിരഞ്ഞെടുക്കുക" : "Choose activity", sections: [{ title: ml ? "കൃഷിപ്പണികൾ" : "Farm activities", rows: rows }] }
  });
}

async function sendCropFarmCropList(to, language, rows) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  return sendInteractiveMessage(to, {
    type: "list",
    body: { text: ml ? "ഈ പണി ഏത് രജിസ്റ്റർ ചെയ്ത വിളയ്ക്കാണ്?" : "Which registered crop is this activity for?" },
    action: { button: ml ? "വിള തിരഞ്ഞെടുക്കുക" : "Choose crop", sections: [{ title: ml ? "വിളകൾ" : "Registered crops", rows: rows }] }
  });
}

async function sendCropStatusList(to, language, rows) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  return sendInteractiveMessage(to, {
    type: "list",
    body: { text: ml ? "നില പുതുക്കേണ്ട വിള തിരഞ്ഞെടുക്കുക." : "Choose the crop whose status should be updated." },
    action: { button: ml ? "വിള തിരഞ്ഞെടുക്കുക" : "Choose crop", sections: [{ title: ml ? "നിലവിലെ വിളകൾ" : "Current crops", rows: rows }] }
  });
}

async function sendCropFarmMessage(to, language, text) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: String(text || "").slice(0, 4000) },
    action: { buttons: [
      { type: "reply", reply: { id: CROP_FARM_ACTION_IDS.OPEN, title: ml ? "🌱 കൃഷിരേഖകൾ" : "🌱 Farm Records" } },
      { type: "reply", reply: { id: CROP_FARM_ACTION_IDS.FARM_MENU, title: ml ? "↩️ എന്റെ കൃഷിയിടം" : "↩️ My Farm" } },
      { type: "reply", reply: { id: CROP_FARM_ACTION_IDS.MAIN_MENU, title: ml ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu" } }
    ] }
  });
}

async function sendCropFarmConfirmation(to, language, text, kind) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  const saveId = kind === "operation" ? CROP_FARM_ACTION_IDS.SAVE_OPERATION
    : kind === "status" ? CROP_FARM_ACTION_IDS.SAVE_STATUS : CROP_FARM_ACTION_IDS.SAVE_CROP;
  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: String(text || "").slice(0, 1000) },
    action: { buttons: [
      { type: "reply", reply: { id: saveId, title: ml ? "✅ സേവ്" : "✅ Save" } },
      { type: "reply", reply: { id: CROP_FARM_ACTION_IDS.CHANGE, title: ml ? "✏️ മാറ്റുക" : "✏️ Change" } },
      { type: "reply", reply: { id: CROP_FARM_ACTION_IDS.CANCEL, title: ml ? "❌ റദ്ദാക്കുക" : "❌ Cancel" } }
    ] }
  });
}

async function sendFarmAlertLandList(to, language, rows) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  return sendInteractiveMessage(to, {
    type: "list",
    body: { text: "ഏത് രജിസ്റ്റർ ചെയ്ത കൃഷിയിടത്തിലാണ് വളപ്രയോഗം?\n\nWhich registered farm is this fertilizer application for?" },
    action: {
      button: ml ? "കൃഷിയിടം തിരഞ്ഞെടുക്കുക" : "Choose farm",
      sections: [{ title: ml ? "എന്റെ കൃഷിയിടങ്ങൾ" : "My farms", rows: rows }]
    }
  });
}

async function sendFarmOperationTypes(to, language, rows) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  return sendInteractiveMessage(to, {
    type: "list",
    body: { text: ml ? "നിങ്ങൾ രേഖപ്പെടുത്താൻ ആഗ്രഹിക്കുന്ന കൃഷിപ്പണി തിരഞ്ഞെടുക്കുക." : "Choose the farm operation to record." },
    action: {
      button: ml ? "പണി തിരഞ്ഞെടുക്കുക" : "Choose operation",
      sections: [{ title: ml ? "കൃഷിപ്പണികൾ" : "Farm operations", rows: rows }]
    }
  });
}

async function sendFarmCropList(to, language, rows) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  return sendInteractiveMessage(to, {
    type: "list",
    body: { text: "ഏത് രജിസ്റ്റർ ചെയ്ത വിളയ്ക്കാണ് വളപ്രയോഗം?\n\nWhich registered crop is this fertilizer application for?" },
    action: {
      button: ml ? "വിള തിരഞ്ഞെടുക്കുക" : "Choose crop",
      sections: [{ title: ml ? "കൃഷിയിടത്തിലെ വിളകൾ" : "Crops on this farm", rows: rows }]
    }
  });
}

async function sendFarmOperationDateChoices(to, language, status) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  const completed = String(status || "").toLowerCase() === "completed";
  const buttons = completed ? [
    { type: "reply", reply: { id: FARM_ALERT_ACTION_IDS.DATE_TODAY, title: ml ? "ഇന്ന്" : "Today" } },
    { type: "reply", reply: { id: FARM_ALERT_ACTION_IDS.DATE_YESTERDAY, title: ml ? "ഇന്നലെ" : "Yesterday" } },
    { type: "reply", reply: { id: FARM_ALERT_ACTION_IDS.DATE_CHOOSE, title: ml ? "📅 തീയതി" : "📅 Choose date" } }
  ] : [
    { type: "reply", reply: { id: FARM_ALERT_ACTION_IDS.DATE_IN_TWO_DAYS, title: ml ? "2 ദിവസത്തിന് ശേഷം" : "In 2 days" } },
    { type: "reply", reply: { id: FARM_ALERT_ACTION_IDS.DATE_CHOOSE, title: ml ? "📅 തീയതി" : "📅 Choose date" } }
  ];
  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: completed
      ? "വളപ്രയോഗം ചെയ്ത തീയതി തിരഞ്ഞെടുക്കുക.\n\nChoose the completed fertilizer application date."
      : "ഇന്നുമുതൽ കുറഞ്ഞത് 2 ദിവസം കഴിഞ്ഞുള്ള വളപ്രയോഗ തീയതി തിരഞ്ഞെടുക്കുക. 2 ദിവസം മുമ്പുള്ള ഓർമ്മപ്പെടുത്തലിന് നിങ്ങൾ സമ്മതിക്കുന്നു.\n\nChoose a fertilizer date at least 2 days from today. You are opting in to one reminder 2 days before." },
    action: { buttons: buttons }
  });
}

async function sendFarmOperationNotePrompt(to, language) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: ml ? "ആവശ്യമെങ്കിൽ ഒരു ചുരുക്ക കുറിപ്പ് ടൈപ്പ് ചെയ്യുക അല്ലെങ്കിൽ വോയ്സ് അയയ്ക്കുക." : "Optionally type a short note or send it by voice." },
    action: { buttons: [
      { type: "reply", reply: { id: FARM_ALERT_ACTION_IDS.NOTE_SKIP, title: ml ? "കുറിപ്പില്ല" : "No note" } },
      { type: "reply", reply: { id: FARM_ALERT_ACTION_IDS.CANCEL, title: ml ? "റദ്ദാക്കുക" : "Cancel" } }
    ] }
  });
}

async function sendFarmOperationConfirmation(to, language, text) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: String(text || "").slice(0, 1000) },
    action: { buttons: [
      { type: "reply", reply: { id: FARM_ALERT_ACTION_IDS.SAVE, title: ml ? "✅ സേവ് ചെയ്യുക" : "✅ Save" } },
      { type: "reply", reply: { id: FARM_ALERT_ACTION_IDS.CHANGE, title: ml ? "✏️ മാറ്റുക" : "✏️ Change" } },
      { type: "reply", reply: { id: FARM_ALERT_ACTION_IDS.CANCEL, title: ml ? "❌ റദ്ദാക്കുക" : "❌ Cancel" } }
    ] }
  });
}

async function sendFarmOperationPrompt(to, language, status) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  const completed = String(status || "").toLowerCase() === "completed";
  const text = completed
    ? "വളപ്രയോഗം ചെയ്ത തീയതി YYYY-MM-DD രൂപത്തിൽ ടൈപ്പ് ചെയ്യുക.\n\nType the completed date as YYYY-MM-DD."
    : "ഇന്നുമുതൽ കുറഞ്ഞത് 2 ദിവസം കഴിഞ്ഞുള്ള വളപ്രയോഗ തീയതി YYYY-MM-DD രൂപത്തിൽ ടൈപ്പ് ചെയ്യുക. സ്ഥിരീകരിച്ചാൽ 2 ദിവസം മുമ്പുള്ള ഒരൊറ്റ ഓർമ്മപ്പെടുത്തലിന് നിങ്ങൾ സമ്മതിക്കുന്നു.\n\nType a fertilizer date at least 2 days from today as YYYY-MM-DD. Confirming opts you in to one reminder 2 days before.";
  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: text },
    action: { buttons: [{ type: "reply", reply: { id: FARM_ALERT_ACTION_IDS.OPEN, title: ml ? "റദ്ദാക്കുക" : "Cancel" } }] }
  });
}

async function sendFarmAlertList(to, language, rows, emptyText) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  if (!rows || rows.length === 0) {
    return sendInteractiveMessage(to, {
      type: "button",
      body: { text: emptyText || "ആസൂത്രണം ചെയ്ത വളപ്രയോഗങ്ങളില്ല.\n\nThere are no planned fertilizer applications." },
      action: { buttons: [
        { type: "reply", reply: { id: FARM_ALERT_ACTION_IDS.PLAN, title: ml ? "📅 ഓർമ്മപ്പെടുത്തൽ" : "📅 Plan reminder" } },
        { type: "reply", reply: { id: FARM_ALERT_ACTION_IDS.OPEN, title: ml ? "🔔 അലർട്ട് മെനു" : "🔔 Alerts menu" } }
      ] }
    });
  }
  return sendInteractiveMessage(to, {
    type: "list",
    body: { text: "🔔 ആസൂത്രണം ചെയ്ത വളപ്രയോഗങ്ങൾ\n\n🔔 Planned fertilizer applications" },
    action: {
      button: ml ? "അലർട്ട് കാണുക" : "View alert",
      sections: [{ title: ml ? "നിലവിലെ അലർട്ടുകൾ" : "Current alerts", rows: rows }]
    }
  });
}

async function sendFarmAlertDetails(to, language, text, alert) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  const rows = [
    { id: FARM_ALERT_PREFIXES.DONE + alert.notificationId, title: ml ? "✅ ചെയ്തു" : "✅ Done", description: ml ? "പൂർത്തിയായതായി രേഖപ്പെടുത്തുക" : "Mark this work completed" },
    { id: FARM_ALERT_ACTION_IDS.ACTIVE, title: ml ? "🔔 എല്ലാ അലർട്ടുകളും" : "🔔 All alerts", description: ml ? "പട്ടികയിലേക്ക് മടങ്ങുക" : "Return to the alerts list" }
  ];
  return sendInteractiveMessage(to, {
    type: "list",
    body: { text: String(text || "").slice(0, 1000) },
    action: { button: ml ? "നടപടി തിരഞ്ഞെടുക്കുക" : "Choose action", sections: [{ title: ml ? "നടപടികൾ" : "Actions", rows: rows }] }
  });
}

async function sendFarmOperationResult(to, language, text) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: String(text || "") },
    action: { buttons: [
      { type: "reply", reply: { id: FARM_ALERT_ACTION_IDS.ACTIVE, title: ml ? "🔔 അലർട്ടുകൾ" : "🔔 My Alerts" } },
      { type: "reply", reply: { id: FARM_ALERT_ACTION_IDS.ADD, title: ml ? "✅ ഡയറി ചേർക്കുക" : "✅ Add diary entry" } },
      { type: "reply", reply: { id: FARM_ALERT_ACTION_IDS.PLAN, title: ml ? "📅 ഓർമ്മപ്പെടുത്തൽ" : "📅 Plan reminder" } }
    ] }
  });
}

async function sendFarmAlertHistory(to, language, text) {
  const ml = String(language || "").toLowerCase() === "malayalam";
  return sendInteractiveMessage(to, {
    type: "button",
    body: { text: String(text || "").slice(0, 1000) },
    action: { buttons: [
      { type: "reply", reply: { id: FARM_ALERT_ACTION_IDS.OPEN, title: ml ? "🔔 അലർട്ട് മെനു" : "🔔 Alerts menu" } },
      { type: "reply", reply: { id: FARM_ALERT_ACTION_IDS.MAIN_MENU, title: ml ? "🏠 പ്രധാന മെനു" : "🏠 Main Menu" } }
    ] }
  });
}
// ===================================================
// INTERACTIVE SELECTION → EXISTING BHOOMIMITRA COMMAND
// ===================================================
//
// This preserves the present backend.
// Example:
// SERVICE_4 button → "4"
// SERVICE_6 button → "6"
//
// ===================================================

function getLegacyServiceCommand(selectionId) {
  const serviceMap = {
    SERVICE_1: "1",
    SERVICE_2: "2",
    SERVICE_3: "3",
    SERVICE_4: "4",
    SERVICE_5: "5",
    SERVICE_6: "6",
    SERVICE_7: "7",
    SERVICE_8: "8",
    SERVICE_9: "9",
    SERVICE_10: "10",
    SERVICE_11: "11",
    CONSENT_AGREE: "AGREE",
    CONSENT_POLICY: "POLICY",
    CONSENT_DECLINE: "DECLINE",

PERSONAL_DETAILS: "my details",
PERSONAL_FARMER_ID: "my farmer id",
PERSONAL_LANDS: "my land",
PERSONAL_ANIMALS: "my animals"
};

  return serviceMap[selectionId] || "";
}

function getLandManagementCommand(selectionId) {
  const landMap = {
    LAND_REGISTER: "1",
    LAND_VIEW: "2",
    LAND_UPDATE: "3",
    LAND_ADD_CROP: "4",
    LAND_CROP_HISTORY: "5",
    LAND_USAGE_HISTORY: "6",
    LAND_SUMMARY: "7",
    LAND_SOIL: "8",
    LAND_SATELLITE_GPS: "9",
    LAND_BACK: "back"
  };

  return landMap[selectionId] || "";
}

function getSatelliteGpsCommand(selectionId) {
  const satelliteGpsMap = {
    SAT_GPS_BOUNDARY_MAP: "1",
    SAT_GPS_MAP: "2",
    SAT_GPS_BOUNDARY_STATUS: "3",
    SAT_GPS_DETAILS: "4",
    SAT_GPS_CURRENT_STATUS: "5",
    SAT_GPS_HISTORY: "6",
    SAT_GPS_ACCESS: "A",
    SAT_GPS_BACK: "7"
  };

  return satelliteGpsMap[selectionId] || "";
}


// ===================================================
// IDENTIFY MAIN MENU NAVIGATION
// ===================================================

function getNavigationAction(selectionId) {
  const navigationMap = {
    HOME_ASK: "ASK_MENU",
    HOME_FARM: "FARM_MENU",
    HOME_EXPERT: "EXPERT_MENU",
    HOME_MARKET: "MARKET_MENU",
    HOME_PROFILE: "PROFILE_MENU",
    FARM_WEATHER_ALERTS: "WEATHER_ALERTS_MENU",
    PROFILE_HELP: "HELP_MENU",
    PROFILE_WHATS_NEW: "WHATS_NEW",
    PROFILE_ABOUT: "ABOUT_MENU",
    PROFILE_TERMS_PRIVACY: "TERMS_PRIVACY_MENU",
    PROFILE_SETTINGS: "PROFILE_SETTINGS_MENU",
    PRIVACY_READ_POLICY: "PRIVACY_POLICY",
    WHATS_NEW_OPEN: "WHATS_NEW",
    WHATS_NEW_TRY: "WHATS_NEW_TRY",
    WHATS_NEW_DISMISS: "WHATS_NEW_DISMISS",
    LAND_SATELLITE_GPS:
      "SATELLITE_GPS_MENU",

    NAV_HOME: "MAIN_MENU",

    CHANGE_LANGUAGE: "LANGUAGE_MENU"
  };

  return navigationMap[selectionId] || "";
}
// ===================================================
  // EXPORT PUBLIC UI FUNCTIONS
  // ===================================================

return {
  sendInteractiveMessage,
  sendOptionalWelcomeMedia,
  sendLanguageSelection,
  sendConsentPrompt,
  sendMainMenu,
  sendAskMenu,
  sendFarmMenu,
  sendWeatherAlertsMenu,
  sendAnimalHusbandryMenu,
  sendLandManagementMenu,
  sendSatelliteGpsMenu,
  sendExpertMenu,
  sendExpertAdviceChoice,
  sendExpertConfirmation,
  sendExpertDeclinedMenu,
  sendExpertAssignmentCard,
  sendExpertCaseList,
  sendTrainingMenu,
  sendTrainingInformation,
  sendTrainingProgramList,
  sendPromotedTrainingList,
  sendPromotedTrainingCard,
  sendTrainingDetails,
  sendTrainingRegistrationConfirmation,
  sendTrainingRequestShortcuts,
  sendTrainingRequestPrompt,
  sendTrainingModePreference,
  sendTrainingTimePreference,
  sendTrainingLocationPrompt,
  sendTrainingDateChoice,
  sendTrainingDatePrompt,
  sendTrainingRemarksPrompt,
  sendTrainingRequestConfirmation,
  sendTrainingRequestSubmitted,
  sendMyTrainingRequests,
  sendSchemesMenu,
  sendSchemeMoreMenu,
  sendSchemeApplicationGuidance,
  sendSchemeList,
  sendSchemeDetails,
  sendSchemeSearchResults,
  sendSchemeInterestConfirmation,
  sendSchemeSearchPrompt,
  sendMySchemeInterests,
  sendSchemeAdvisories,
  sendFarmAlertsMenu,
  sendFarmAlertLandList,
  sendFarmOperationTypes,
  sendFarmCropList,
  sendFarmOperationDateChoices,
  sendFarmOperationConfirmation,
  sendFarmOperationPrompt,
  sendFarmAlertList,
  sendFarmAlertDetails,
  sendFarmOperationResult,
  sendFarmAlertHistory,
  sendCropFarmMenu,
  sendCropFarmLandList,
  sendCropFarmOperationTypes,
  sendCropFarmCropList,
  sendCropStatusList,
  sendCropFarmMessage,
  sendCropFarmConfirmation,
  sendMarketMenu,
  sendProfileMenu,
  sendProfileSettingsMenu,
  sendAboutMenu,
  sendTeamDirectory,
  sendTeamMemberProfile,
  sendHelpMenu,
  sendUserGuidePage,
  sendUserGuideTopic,
  sendTermsPrivacyMenu,
  sendWhatsNewAnnouncement,
  sendPersonalRecordsMenu,
  getInteractiveSelection,
  getLanguageFromSelection,
  getLegacyServiceCommand,
  getLandManagementCommand,
  getSatelliteGpsCommand,
  getNavigationAction
};
}

module.exports = {
  createBhoomiMitraUI
};
