"use strict";

const ABOUT_ACTION_IDS = Object.freeze({
  OPEN: "PROFILE_ABOUT",
  TEAM: "ABOUT_TEAM",
  TEAM_PAGE_1: "ABOUT_TEAM_PAGE_1",
  TEAM_PAGE_2: "ABOUT_TEAM_PAGE_2"
});

const TEAM_MEMBER_ACTION_PREFIX = "ABOUT_MEMBER_";
const TEAM_PAGE_SIZE = 7;

const TEAM_MEMBERS = Object.freeze([
  {
    id: "robert",
    name: "Dr. C. P. Robert",
    designationEnglish: "Senior Scientist & Head",
    designationMalayalam: "സീനിയർ സയന്റിസ്റ്റ് & ഹെഡ്",
    roleEnglish: "Project Leader",
    roleMalayalam: "പ്രോജക്ട് ലീഡർ",
    responsibilitiesEnglish: "Overall project leadership, strategic planning, institutional coordination, scientific oversight, development guidance, and implementation monitoring and evaluation.",
    responsibilitiesMalayalam: "പദ്ധതിയുടെ സമഗ്ര നേതൃത്വം, തന്ത്രപരമായ ആസൂത്രണം, സ്ഥാപന ഏകോപനം, ശാസ്ത്രീയ മേൽനോട്ടം, വികസന മാർഗനിർദേശം, നടപ്പാക്കൽ നിരീക്ഷണവും വിലയിരുത്തലും."
  },
  {
    id: "vinod-mathew",
    name: "Dr. Vinod Mathew",
    designationEnglish: "Subject Matter Specialist – Agronomy",
    designationMalayalam: "വിഷയവിദഗ്ധൻ – അഗ്രോണമി",
    roleEnglish: "Crop Production & Agronomy Coordinator",
    roleMalayalam: "വിള ഉൽപ്പാദന & അഗ്രോണമി കോർഡിനേറ്റർ",
    responsibilitiesEnglish: "Crop production, cropping systems, nutrient management, fertilizer recommendations, farm operations, agronomic validation, and farmer training.",
    responsibilitiesMalayalam: "വിള ഉൽപ്പാദനം, കൃഷിരീതികൾ, പോഷക നിയന്ത്രണം, വള ശുപാർശകൾ, ഫാം പ്രവർത്തനങ്ങൾ, അഗ്രോണമി പരിശോധന, കർഷക പരിശീലനം."
  },
  {
    id: "shana-harshan",
    name: "Dr. Shana Harshan",
    designationEnglish: "Subject Matter Specialist – Home Science",
    designationMalayalam: "വിഷയവിദഗ്ധൻ – ഹോം സയൻസ്",
    roleEnglish: "Farm Family Welfare & Value Addition Coordinator",
    roleMalayalam: "കർഷക കുടുംബക്ഷേമ & മൂല്യവർധന കോർഡിനേറ്റർ",
    responsibilitiesEnglish: "Food processing, agricultural value addition, nutrition, farm family welfare, women-focused agricultural enterprises, entrepreneurship training, and advisories.",
    responsibilitiesMalayalam: "ഭക്ഷ്യസംസ്കരണം, കാർഷിക മൂല്യവർധന, പോഷണം, കർഷക കുടുംബക്ഷേമം, വനിതാ കാർഷിക സംരംഭങ്ങൾ, സംരംഭകത്വ പരിശീലനം, ഉപദേശം."
  },
  {
    id: "sency-mathew",
    name: "Dr. Sency Mathew",
    designationEnglish: "Subject Matter Specialist – Animal Science",
    designationMalayalam: "വിഷയവിദഗ്ധൻ – അനിമൽ സയൻസ്",
    roleEnglish: "Animal Husbandry & Livestock Advisory Coordinator",
    roleMalayalam: "മൃഗസംരക്ഷണ & ലൈവ്‌സ്റ്റോക്ക് ഉപദേശ കോർഡിനേറ്റർ",
    responsibilitiesEnglish: "Livestock and poultry management, animal nutrition, breeding, animal-health guidance, veterinary referral coordination, livestock disease alerts, and farmer training.",
    responsibilitiesMalayalam: "കന്നുകാലി-കോഴി പരിപാലനം, മൃഗപോഷണം, പ്രജനനം, മൃഗാരോഗ്യ മാർഗനിർദേശം, വെറ്ററിനറി റഫറൽ, രോഗ മുന്നറിയിപ്പുകൾ, കർഷക പരിശീലനം."
  },
  {
    id: "sindhu-sadanandan",
    name: "Dr. Sindhu Sadanandan",
    designationEnglish: "Subject Matter Specialist – Agricultural Extension",
    designationMalayalam: "വിഷയവിദഗ്ധൻ – അഗ്രികൾച്ചറൽ എക്സ്റ്റൻഷൻ",
    roleEnglish: "Overall Field Implementation & Farmer Outreach Coordinator",
    roleMalayalam: "ഫീൽഡ് നടപ്പാക്കൽ & കർഷക സമ്പർക്ക കോർഡിനേറ്റർ",
    responsibilitiesEnglish: "Farmer registration coordination, farmer mobilisation, awareness programmes, field demonstrations, farmer feedback, adoption monitoring, extension activities, pilot evaluation, and implementation team coordination.",
    responsibilitiesMalayalam: "കർഷക രജിസ്ട്രേഷൻ ഏകോപനം, ജനപങ്കാളിത്തം, ബോധവൽക്കരണം, ഫീൽഡ് പ്രദർശനം, പ്രതികരണം, സ്വീകരണ നിരീക്ഷണം, വിജ്ഞാനവ്യാപനം, പൈലറ്റ് വിലയിരുത്തൽ, ടീം ഏകോപനം."
  },
  {
    id: "rincy-abraham",
    name: "Dr. Rincy K. Abraham",
    designationEnglish: "Subject Matter Specialist – Horticulture",
    designationMalayalam: "വിഷയവിദഗ്ധൻ – ഹോർട്ടികൾച്ചർ",
    roleEnglish: "Horticulture Coordinator",
    roleMalayalam: "ഹോർട്ടികൾച്ചർ കോർഡിനേറ്റർ",
    responsibilitiesEnglish: "Fruit crops, vegetables, spices, plantation crops, nursery management, horticultural technologies, crop-specific recommendations, horticulture training, and scientific validation.",
    responsibilitiesMalayalam: "പഴം, പച്ചക്കറി, സുഗന്ധവിള, തോട്ടവിള, നഴ്സറി പരിപാലനം, ഹോർട്ടികൾച്ചർ സാങ്കേതികവിദ്യ, വിള ശുപാർശകൾ, പരിശീലനം, ശാസ്ത്രീയ പരിശോധന."
  },
  {
    id: "alex-john",
    name: "Dr. Alex John",
    designationEnglish: "Subject Matter Specialist – Plant Protection",
    designationMalayalam: "വിഷയവിദഗ്ധൻ – പ്ലാന്റ് പ്രൊട്ടക്ഷൻ",
    roleEnglish: "Plant Health & Technical Validation Coordinator",
    roleMalayalam: "സസ്യാരോഗ്യ & സാങ്കേതിക പരിശോധന കോർഡിനേറ്റർ",
    responsibilitiesEnglish: "Pest identification, plant disease diagnosis, photograph-based crop diagnosis, plant-protection recommendations, crop disease alerts, scientific validation, technical testing support, and farmer training.",
    responsibilitiesMalayalam: "കീട തിരിച്ചറിയൽ, രോഗനിർണയം, ഫോട്ടോ പരിശോധന, സസ്യസംരക്ഷണ ശുപാർശകൾ, മുന്നറിയിപ്പുകൾ, സാങ്കേതിക പരിശോധന, ടെസ്റ്റിംഗ് പിന്തുണ, പരിശീലനം."
  },
  {
    id: "binu-john",
    name: "Sri Binu John",
    designationEnglish: "Programme Assistant – Computer",
    designationMalayalam: "പ്രോഗ്രാം അസിസ്റ്റന്റ് – കമ്പ്യൂട്ടർ",
    roleEnglish: "Digital Operations & Training Coordinator",
    roleMalayalam: "ഡിജിറ്റൽ പ്രവർത്തന & പരിശീലന കോർഡിനേറ്റർ",
    responsibilitiesEnglish: "Digital farmer registration support, training-request coordination, database support, farmer guidance, technical troubleshooting, staff orientation, training records, documentation, and pilot testing support.",
    responsibilitiesMalayalam: "ഡിജിറ്റൽ രജിസ്ട്രേഷൻ പിന്തുണ, പരിശീലന അഭ്യർത്ഥന ഏകോപനം, ഡാറ്റാബേസ് പിന്തുണ, കർഷക മാർഗനിർദേശം, പ്രശ്നപരിഹാരം, സ്റ്റാഫ് പരിശീലനം, രേഖകളും പൈലറ്റ് പിന്തുണയും."
  },
  {
    id: "ambily-varughese",
    name: "Smt. Ambily Varughese",
    designationEnglish: "Farm Manager",
    designationMalayalam: "ഫാം മാനേജർ",
    roleEnglish: "Farm Demonstration & Field Operations Coordinator",
    roleMalayalam: "ഫാം പ്രദർശന & ഫീൽഡ് പ്രവർത്തന കോർഡിനേറ്റർ",
    responsibilitiesEnglish: "Farm demonstrations, demonstration plots, farm operations, field-level technology validation, crop and farm records, practical testing of farm services, and support for farmer adoption.",
    responsibilitiesMalayalam: "ഫാം പ്രദർശനങ്ങൾ, പ്രദർശന പ്ലോട്ടുകൾ, ഫീൽഡ് പ്രവർത്തനങ്ങൾ, പരിശോധന, രേഖകൾ, പ്രായോഗിക ടെസ്റ്റിംഗ്, സാങ്കേതികവിദ്യ സ്വീകരിക്കൽ പിന്തുണ."
  },
  {
    id: "gayatri-s",
    name: "Smt. Gayatri S",
    designationEnglish: "Programme Assistant – Lab Technician",
    designationMalayalam: "പ്രോഗ്രാം അസിസ്റ്റന്റ് – ലാബ് ടെക്നീഷ്യൻ",
    roleEnglish: "Laboratory Information & Data Support Coordinator",
    roleMalayalam: "ലബോറട്ടറി വിവര & ഡാറ്റാ പിന്തുണ കോർഡിനേറ്റർ",
    responsibilitiesEnglish: "Soil-testing information, laboratory records, data verification, farmer-record support, laboratory documentation, soil-information coordination, and pilot testing support.",
    responsibilitiesMalayalam: "മണ്ണ് പരിശോധന വിവരം, ലാബ് രേഖകൾ, ഡാറ്റാ പരിശോധന, കർഷക രേഖകൾ, ഡോക്യുമെന്റേഷൻ, മണ്ണ് വിവര ഏകോപനം, പൈലറ്റ് പിന്തുണ."
  },
  {
    id: "anu-john",
    name: "Smt. Anu John",
    designationEnglish: "Junior Stenographer",
    designationMalayalam: "ജൂനിയർ സ്റ്റെനോഗ്രാഫർ",
    roleEnglish: "Administrative Support",
    roleMalayalam: "ഭരണപരമായ പിന്തുണ",
    responsibilitiesEnglish: "",
    responsibilitiesMalayalam: ""
  }
]);

function isMalayalam(language) {
  return String(language || "").toLowerCase() !== "english";
}

function buildAboutText(language) {
  if (isMalayalam(language)) {
    return [
      "🌱 ഭൂമിമിത്ര / BhoomiMitra",
      "AI സഹായത്തോടെ പ്രവർത്തിക്കുന്ന കാർഷിക സഹായ പ്ലാറ്റ്ഫോം",
      "",
      "ഒരു പദ്ധതി:",
      "ICAR–കൃഷി വിജ്ഞാന കേന്ദ്രം, CARD, പത്തനംതിട്ട",
      "",
      "സാങ്കേതിക പിന്തുണ:",
      "Ilumivision, മഞ്ഞാടി, തിരുവല്ല",
      "",
      "മണ്ണിന്റെ നന്മയ്ക്ക്, കർഷകന്റെ കൂട്ടായി",
      "",
      "പൊതുവായ സ്ഥാപന അംഗീകാരം വിന്യാസത്തിന് മുമ്പ് ബന്ധപ്പെട്ട സ്ഥാപനത്തിന്റെ അനുമതിക്ക് വിധേയമാണ്."
    ].join("\n");
  }

  return [
    "🌱 BhoomiMitra",
    "AI-Powered Agricultural Assistance Platform",
    "",
    "A Project of:",
    "ICAR–Krishi Vigyan Kendra, CARD, Pathanamthitta",
    "",
    "Powered by:",
    "Ilumivision, Manjadi, Thiruvalla",
    "",
    "മണ്ണിന്റെ നന്മയ്ക്ക്, കർഷകന്റെ കൂട്ടായി",
    "",
    "Public institutional attribution is subject to institutional approval before deployment."
  ].join("\n");
}

function buildTeamDirectoryText(language, page) {
  const safePage = Number(page) === 2 ? 2 : 1;
  if (isMalayalam(language)) {
    return "👥 BhoomiMitra\nശാസ്ത്രീയ, സാങ്കേതിക, ഫീൽഡ് നടപ്പാക്കൽ ടീം\n\nഅംഗത്തിന്റെ പേര് തിരഞ്ഞെടുക്കുക. പേജ് " + safePage + "/2";
  }
  return "👥 BhoomiMitra\nScientific, Technical and Field Implementation Team\n\nSelect a member to view their profile. Page " + safePage + "/2";
}

function buildTeamRows(language, page) {
  const safePage = Number(page) === 2 ? 2 : 1;
  const start = (safePage - 1) * TEAM_PAGE_SIZE;
  const ml = isMalayalam(language);

  return TEAM_MEMBERS.slice(start, start + TEAM_PAGE_SIZE).map(function (member) {
    return {
      id: TEAM_MEMBER_ACTION_PREFIX + member.id,
      title: member.name.slice(0, 24),
      description: (ml ? member.roleMalayalam : member.roleEnglish).slice(0, 72)
    };
  });
}

function getTeamMemberById(memberId) {
  const normalized = String(memberId || "").trim().toLowerCase();
  return TEAM_MEMBERS.find(function (member) {
    return member.id === normalized;
  }) || null;
}

function parseAboutAction(selectionId) {
  const id = String(selectionId || "").trim();
  if (id === ABOUT_ACTION_IDS.OPEN) return { type: "ABOUT" };
  if (id === ABOUT_ACTION_IDS.TEAM || id === ABOUT_ACTION_IDS.TEAM_PAGE_1) {
    return { type: "TEAM", page: 1 };
  }
  if (id === ABOUT_ACTION_IDS.TEAM_PAGE_2) return { type: "TEAM", page: 2 };
  if (!id.startsWith(TEAM_MEMBER_ACTION_PREFIX)) return null;

  const member = getTeamMemberById(id.slice(TEAM_MEMBER_ACTION_PREFIX.length));
  if (!member) return null;
  const index = TEAM_MEMBERS.findIndex(function (candidate) {
    return candidate.id === member.id;
  });
  return {
    type: "MEMBER",
    member: member,
    page: index < TEAM_PAGE_SIZE ? 1 : 2
  };
}

function buildTeamMemberText(member, language) {
  if (!member) return "";
  const ml = isMalayalam(language);
  const lines = ml
    ? [
        "👤 " + member.name,
        "",
        "പദവി: " + member.designationMalayalam,
        "പദ്ധതിയിലെ ചുമതല: " + member.roleMalayalam
      ]
    : [
        "👤 " + member.name,
        "",
        "Designation: " + member.designationEnglish,
        "Project role: " + member.roleEnglish
      ];
  const responsibilities = ml
    ? member.responsibilitiesMalayalam
    : member.responsibilitiesEnglish;
  if (responsibilities) {
    lines.push("", (ml ? "പ്രധാന ഉത്തരവാദിത്വങ്ങൾ: " : "Responsibilities: ") + responsibilities);
  }
  return lines.join("\n");
}

module.exports = {
  ABOUT_ACTION_IDS,
  TEAM_MEMBER_ACTION_PREFIX,
  TEAM_MEMBERS,
  TEAM_PAGE_SIZE,
  buildAboutText,
  buildTeamDirectoryText,
  buildTeamMemberText,
  buildTeamRows,
  getTeamMemberById,
  parseAboutAction
};
