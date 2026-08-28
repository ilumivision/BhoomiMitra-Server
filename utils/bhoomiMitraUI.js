"use strict";

// =====================================================
// BhoomiMitra UI
// ICAR-KVK, CARD Pathanamthitta
// Technology powered by Ilumivision
// =====================================================

function createBhoomiMitraUI(options) {
  const {
    axios,
    phoneNumberId,
    whatsappToken
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
            "🌱 Welcome to BhoomiMitra\n" +
            "Your Digital Farming Companion\n\n" +
            "🌐 Choose your preferred language\n" +
            "നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക"
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
                    ? "👨‍🔬 വിദഗ്ധ സഹായം"
                    : "👨‍🔬 Expert & Services",

                description:
                  isMalayalam
                    ? "വിദഗ്ധൻ, തൊഴിലാളി, യന്ത്രസേവനം"
                    : "Experts, workers and machinery"
              },

              {
                id: "HOME_MARKET",

                title:
                  isMalayalam
                    ? "💹 വിപണി"
                    : "💹 Market",

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
                id: "SERVICE_4",

                title:
                  isMalayalam
                    ? "🌦️ കാലാവസ്ഥ & മഴ"
                    : "🌦️ Weather & Rain",

                description:
                  isMalayalam
                    ? "ഇപ്പോഴത്തെ കാലാവസ്ഥയും പ്രവചനവും"
                    : "Current weather and forecast"
              },

              {
                id: "SERVICE_9",

                title:
                  isMalayalam
                    ? "🗺️ ഭൂമി & കൃഷിരേഖ"
                    : "🗺️ Farm & Land",

                description:
                  isMalayalam
                    ? "ഭൂമി, വിള, പ്രവർത്തനം, ഉപദേശം"
                    : "Land, crops, activities and advisory history"
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
                    ? "👨‍🔬 വിദഗ്ധ സഹായം"
                    : "👨‍🔬 Expert Advice",

                description:
                  isMalayalam
                    ? "KVK വിദഗ്ധന്റെ സഹായം തേടുക"
                    : "Request assistance from an expert"
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
                    : "🚜 Machinery & Service",

                description:
                  isMalayalam
                    ? "യന്ത്രങ്ങളും സേവനദാതാക്കളും കണ്ടെത്തുക"
                    : "Find machinery and service providers"
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
                id: "SERVICE_10",

                title:
                  isMalayalam
                    ? "📋 വ്യക്തിഗത രേഖകൾ"
                    : "📋 Personal Records",

                description:
                  isMalayalam
                    ? "സംരക്ഷിച്ച വ്യക്തിഗത രേഖകൾ"
                    : "View and manage saved records"
              },

              {
                id: "SERVICE_11",

                title:
                  isMalayalam
                    ? "✅ അംഗത്വം"
                    : "✅ Membership",

                description:
                  isMalayalam
                    ? "BhoomiMitra അംഗമായി രജിസ്റ്റർ ചെയ്യുക"
                    : "Register as a BhoomiMitra member"
              },

              {
                id: "CHANGE_LANGUAGE",

                title:
                  isMalayalam
                    ? "🌐 ഭാഷ മാറ്റുക"
                    : "🌐 Change Language",

                description:
                  isMalayalam
                    ? "English / മലയാളം / രണ്ട് ഭാഷ"
                    : "English / Malayalam / Bilingual"
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
    SERVICE_11: "11"
  };

  return serviceMap[selectionId] || "";
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
  sendLanguageSelection,
  sendMainMenu,
  sendAskMenu,
  sendFarmMenu,
  sendExpertMenu,
  sendMarketMenu,
  sendProfileMenu,
  getInteractiveSelection,
  getLanguageFromSelection,
  getLegacyServiceCommand,
  getNavigationAction
};
}

module.exports = {
  createBhoomiMitraUI
};
