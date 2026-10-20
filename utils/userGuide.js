"use strict";

const USER_GUIDE_ACTION_IDS = Object.freeze({
  OPEN: "PROFILE_HELP",
  PAGE_1: "GUIDE_PAGE_1",
  PAGE_2: "GUIDE_PAGE_2"
});

const USER_GUIDE_TOPIC_PREFIX = "GUIDE_TOPIC_";
const USER_GUIDE_PAGE_SIZE = 5;

const USER_GUIDE_TOPICS = Object.freeze([
  {
    id: "getting-started",
    titleEnglish: "Getting Started",
    titleMalayalam: "തുടങ്ങാം",
    textEnglish: "Choose a service from the Main Menu. You can type in English or Malayalam and use voice where the service offers it. Type MENU at any time to return home.",
    textMalayalam: "പ്രധാന മെനുവിൽ നിന്ന് സേവനം തിരഞ്ഞെടുക്കുക. ഇംഗ്ലീഷിലോ മലയാളത്തിലോ ടൈപ്പ് ചെയ്യാം; വോയ്സ് പിന്തുണയുള്ളിടത്ത് വോയ്സ് അയയ്ക്കാം. പ്രധാന മെനുവിലേക്ക് മടങ്ങാൻ MENU എന്ന് അയയ്ക്കുക."
  },
  {
    id: "farmer-registration",
    titleEnglish: "Farmer Registration",
    titleMalayalam: "കർഷക രജിസ്ട്രേഷൻ",
    textEnglish: "Open My BhoomiMitra → Membership and follow the prompts. Existing registrations are recovered when the saved WhatsApp identity matches safely.",
    textMalayalam: "എന്റെ BhoomiMitra → അംഗത്വം തുറന്ന് നിർദേശങ്ങൾ പാലിക്കുക. സേവ് ചെയ്ത WhatsApp തിരിച്ചറിയൽ സുരക്ഷിതമായി പൊരുത്തപ്പെടുമ്പോൾ നിലവിലെ രജിസ്ട്രേഷൻ കണ്ടെത്തും."
  },
  {
    id: "crop-animal-advisory",
    titleEnglish: "Crop & Animal Advisory",
    titleMalayalam: "വിള-മൃഗ ഉപദേശം",
    textEnglish: "Ask a crop or livestock question, or use the Animal Husbandry menu. Photo-based crop guidance and expert referral are available; recommendations should be verified before major action.",
    textMalayalam: "വിളയെയോ മൃഗസംരക്ഷണത്തെയോ കുറിച്ച് ചോദിക്കുക, അല്ലെങ്കിൽ മൃഗസംരക്ഷണ മെനു ഉപയോഗിക്കുക. വിളയുടെ ഫോട്ടോ അടിസ്ഥാനമാക്കിയ മാർഗനിർദേശവും വിദഗ്ധ സഹായവും ലഭ്യമാണ്; പ്രധാന നടപടി മുമ്പ് ശുപാർശ ഉറപ്പാക്കുക."
  },
  {
    id: "land-farm-records",
    titleEnglish: "Land & Farm Records",
    titleMalayalam: "ഭൂമി-ഫാം രേഖകൾ",
    textEnglish: "Use My Farm to register land, crops and animals, record farm operations, and view your own records. GPS and satellite features depend on saved land data and available imagery.",
    textMalayalam: "ഭൂമി, വിള, മൃഗങ്ങൾ എന്നിവ രജിസ്റ്റർ ചെയ്യാനും ഫാം പ്രവർത്തനങ്ങൾ രേഖപ്പെടുത്താനും സ്വന്തം രേഖകൾ കാണാനും My Farm ഉപയോഗിക്കുക. GPS, സാറ്റലൈറ്റ് സേവനങ്ങൾ സേവ് ചെയ്ത ഭൂവിവരത്തെയും ലഭ്യമായ ചിത്രങ്ങളെയും ആശ്രയിക്കുന്നു."
  },
  {
    id: "weather-market",
    titleEnglish: "Weather & Market",
    titleMalayalam: "കാലാവസ്ഥ-വിപണി",
    textEnglish: "Use Weather for available location or district information and Market for available price records. Missing or stale source data is shown as unavailable, not estimated.",
    textMalayalam: "ലഭ്യമായ സ്ഥലം/ജില്ലാ കാലാവസ്ഥയ്ക്ക് Weather-ഉം ലഭ്യമായ വിലരേഖകൾക്ക് Market-ഉം ഉപയോഗിക്കുക. ഉറവിടവിവരം ലഭ്യമല്ലെങ്കിൽ അല്ലെങ്കിൽ പഴയതാണെങ്കിൽ കണക്കുകൂട്ടാതെ ലഭ്യമല്ലെന്ന് കാണിക്കും."
  },
  {
    id: "expert-consultation",
    titleEnglish: "Expert Consultation",
    titleMalayalam: "വിദഗ്ധ സഹായം",
    textEnglish: "Open Expert & Services, describe the problem clearly, and confirm before it is sent. Assignment depends on a suitable available expert; keep the short Expert Question ID for follow-up.",
    textMalayalam: "Expert & Services തുറന്ന് പ്രശ്നം വ്യക്തമായി വിവരിച്ച് അയയ്ക്കുന്നതിന് മുമ്പ് സ്ഥിരീകരിക്കുക. അനുയോജ്യനായ വിദഗ്ധന്റെ ലഭ്യത അനുസരിച്ചാണ് നിയോഗം; തുടർചോദ്യങ്ങൾക്ക് ചെറിയ Expert Question ID സൂക്ഷിക്കുക."
  },
  {
    id: "training-programmes",
    titleEnglish: "Training Programmes",
    titleMalayalam: "പരിശീലന പരിപാടികൾ",
    textEnglish: "View published programmes or request a topic. A request is saved only after you review the summary and tap Submit Request; My Requests shows your saved requests.",
    textMalayalam: "പ്രസിദ്ധീകരിച്ച പരിപാടികൾ കാണുക അല്ലെങ്കിൽ ഒരു വിഷയം അഭ്യർത്ഥിക്കുക. സംഗ്രഹം പരിശോധിച്ച് Submit Request തിരഞ്ഞെടുക്കുമ്പോൾ മാത്രം അഭ്യർത്ഥന സേവ് ചെയ്യും; My Requests-ൽ സേവ് ചെയ്തവ കാണാം."
  },
  {
    id: "government-schemes",
    titleEnglish: "Government Schemes",
    titleMalayalam: "സർക്കാർ പദ്ധതികൾ",
    textEnglish: "Browse Central or Kerala records, search by topic, and open the official source. Verify current status, eligibility and application dates before applying; BhoomiMitra does not guarantee eligibility.",
    textMalayalam: "കേന്ദ്ര/കേരള രേഖകൾ കാണുക, വിഷയം തിരയുക, ഔദ്യോഗിക ഉറവിടം തുറക്കുക. അപേക്ഷയ്ക്ക് മുമ്പ് നിലവിലെ നില, യോഗ്യത, തീയതികൾ എന്നിവ പരിശോധിക്കുക; BhoomiMitra യോഗ്യത ഉറപ്പുനൽകുന്നില്ല."
  },
  {
    id: "alerts-reminders",
    titleEnglish: "Alerts & Reminders",
    titleMalayalam: "അറിയിപ്പുകളും ഓർമ്മപ്പെടുത്തലുകളും",
    textEnglish: "My Alerts shows verified current alerts and your saved farm plans. Fertilizer reminders are under pilot testing and require an eligible planned operation plus explicit opt-in.",
    textMalayalam: "My Alerts-ൽ സ്ഥിരീകരിച്ച നിലവിലെ അറിയിപ്പുകളും സേവ് ചെയ്ത ഫാം പദ്ധതികളും കാണാം. വള ഓർമ്മപ്പെടുത്തലുകൾ പൈലറ്റ് പരിശോധനയിലാണ്; യോഗ്യമായ മുൻകൂട്ടി രേഖപ്പെടുത്തിയ പ്രവർത്തനവും വ്യക്തമായ സമ്മതവും വേണം."
  },
  {
    id: "faq",
    titleEnglish: "Frequently Asked Questions",
    titleMalayalam: "പതിവുചോദ്യങ്ങൾ",
    textEnglish: "Change language in My BhoomiMitra → Account and Privacy. Type MENU to restart navigation or CANCEL to stop a supported form. If current data is unavailable, try later or contact KVK through the shown service path.",
    textMalayalam: "My BhoomiMitra → അക്കൗണ്ടും സ്വകാര്യതയും വഴി ഭാഷ മാറ്റാം. നാവിഗേഷൻ പുനരാരംഭിക്കാൻ MENU, പിന്തുണയുള്ള ഫോം നിർത്താൻ CANCEL എന്ന് അയയ്ക്കുക. നിലവിലെ വിവരം ലഭ്യമല്ലെങ്കിൽ പിന്നീട് ശ്രമിക്കുക അല്ലെങ്കിൽ കാണിച്ചിരിക്കുന്ന സേവനപാത വഴി KVK-യെ ബന്ധപ്പെടുക."
  }
]);

function isMalayalam(language) {
  return String(language || "").trim().toLowerCase() === "malayalam";
}

function buildUserGuideIntro(language, page) {
  const safePage = Number(page) === 2 ? 2 : 1;
  return isMalayalam(language)
    ? "❓ സഹായവും ഉപയോക്തൃ മാർഗനിർദേശവും\n\nചുരുക്കമായ സഹായത്തിന് ഒരു വിഷയം തിരഞ്ഞെടുക്കുക. പേജ് " + safePage + "/2"
    : "❓ Help & User Guide\n\nChoose a topic for short, practical guidance. Page " + safePage + "/2";
}

function buildUserGuideRows(language, page) {
  const safePage = Number(page) === 2 ? 2 : 1;
  const start = (safePage - 1) * USER_GUIDE_PAGE_SIZE;
  const ml = isMalayalam(language);
  return USER_GUIDE_TOPICS.slice(start, start + USER_GUIDE_PAGE_SIZE).map(function (topic) {
    return {
      id: USER_GUIDE_TOPIC_PREFIX + topic.id,
      title: (ml ? topic.titleMalayalam : topic.titleEnglish).slice(0, 24)
    };
  });
}

function getUserGuideTopic(topicId) {
  const target = String(topicId || "").trim().toLowerCase();
  return USER_GUIDE_TOPICS.find(function (topic) {
    return topic.id === target;
  }) || null;
}

function parseUserGuideAction(selectionId) {
  const id = String(selectionId || "").trim();
  if (id === USER_GUIDE_ACTION_IDS.OPEN || id === USER_GUIDE_ACTION_IDS.PAGE_1) {
    return { type: "GUIDE", page: 1 };
  }
  if (id === USER_GUIDE_ACTION_IDS.PAGE_2) return { type: "GUIDE", page: 2 };
  if (!id.startsWith(USER_GUIDE_TOPIC_PREFIX)) return null;
  const topic = getUserGuideTopic(id.slice(USER_GUIDE_TOPIC_PREFIX.length));
  if (!topic) return null;
  const index = USER_GUIDE_TOPICS.findIndex(function (item) { return item.id === topic.id; });
  return { type: "TOPIC", topic: topic, page: index < USER_GUIDE_PAGE_SIZE ? 1 : 2 };
}

function buildUserGuideTopicText(topic, language) {
  if (!topic) return "";
  return [
    "❓ " + (isMalayalam(language) ? topic.titleMalayalam : topic.titleEnglish),
    "",
    isMalayalam(language) ? topic.textMalayalam : topic.textEnglish
  ].join("\n");
}

module.exports = {
  USER_GUIDE_ACTION_IDS,
  USER_GUIDE_PAGE_SIZE,
  USER_GUIDE_TOPIC_PREFIX,
  USER_GUIDE_TOPICS,
  buildUserGuideIntro,
  buildUserGuideRows,
  buildUserGuideTopicText,
  getUserGuideTopic,
  parseUserGuideAction
};
