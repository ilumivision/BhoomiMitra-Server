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
    ? "English / മലയാളം"
    : "English / Malayalam"
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
  sendLanguageSelection,
  sendMainMenu,
  sendAskMenu,
  sendFarmMenu,
  sendLandManagementMenu,
  sendSatelliteGpsMenu,
  sendExpertMenu,
  sendMarketMenu,
  sendProfileMenu,
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
