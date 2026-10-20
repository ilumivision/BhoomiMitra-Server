"use strict";

const ABOUT_ACTION_IDS = Object.freeze({
  OPEN: "PROFILE_ABOUT",
  TEAM: "ABOUT_TEAM",
  TEAM_PAGE_1: "ABOUT_TEAM_PAGE_1",
  TEAM_PAGE_2: "ABOUT_TEAM_PAGE_2"
});

const TEAM_MEMBER_ACTION_PREFIX = "ABOUT_MEMBER_";
const TEAM_PAGE_SIZE = 5;

const TEAM_MEMBERS = Object.freeze([
  {
    id: "robert",
    name: "Dr. C. P. Robert",
    designationEnglish: "Senior Scientist & Head",
    designationMalayalam: "സീനിയർ സയന്റിസ്റ്റ് & ഹെഡ്",
    roleEnglish: "Project Director & Strategic Leadership",
    roleMalayalam: "പ്രോജക്ട് ഡയറക്ടർ & തന്ത്രപരമായ നേതൃത്വം",
    responsibilitiesEnglish: "Project direction, strategic leadership and institutional oversight.",
    responsibilitiesMalayalam: "പദ്ധതി ദിശാനിർദേശം, തന്ത്രപരമായ നേതൃത്വം, സ്ഥാപന മേൽനോട്ടം."
  },
  {
    id: "sindhu-sadanandan",
    name: "Dr. Sindhu Sadanandan",
    designationEnglish: "Subject Matter Specialist – Agricultural Extension",
    designationMalayalam: "വിഷയവിദഗ്ധ – കാർഷിക വിജ്ഞാനവ്യാപനം",
    roleEnglish: "Project Coordinator & Farmer Outreach",
    roleMalayalam: "പ്രോജക്ട് കോർഡിനേറ്റർ & കർഷക സമ്പർക്കം",
    responsibilitiesEnglish: "Project coordination, agricultural extension and farmer outreach.",
    responsibilitiesMalayalam: "പദ്ധതി ഏകോപനം, കാർഷിക വിജ്ഞാനവ്യാപനം, കർഷക സമ്പർക്കം."
  },
  {
    id: "binu-john",
    name: "Sri Binu John",
    designationEnglish: "Programme Assistant (Computer)",
    designationMalayalam: "പ്രോഗ്രാം അസിസ്റ്റന്റ് (കമ്പ്യൂട്ടർ)",
    roleEnglish: "Digital Operations & Training Coordination",
    roleMalayalam: "ഡിജിറ്റൽ പ്രവർത്തനങ്ങൾ & പരിശീലന ഏകോപനം",
    responsibilitiesEnglish: "Digital operations, training coordination and technical support.",
    responsibilitiesMalayalam: "ഡിജിറ്റൽ പ്രവർത്തനങ്ങൾ, പരിശീലന ഏകോപനം, സാങ്കേതിക പിന്തുണ."
  },
  {
    id: "gayathri",
    name: "Smt. Gayathri",
    designationEnglish: "Programme Assistant (Lab)",
    designationMalayalam: "പ്രോഗ്രാം അസിസ്റ്റന്റ് (ലാബ്)",
    roleEnglish: "Field Coordination & Farmer Engagement",
    roleMalayalam: "ഫീൽഡ് ഏകോപനം & കർഷക പങ്കാളിത്തം",
    responsibilitiesEnglish: "Field coordination, farmer engagement and laboratory support.",
    responsibilitiesMalayalam: "ഫീൽഡ് ഏകോപനം, കർഷക പങ്കാളിത്തം, ലബോറട്ടറി പിന്തുണ."
  },
  {
    id: "vinod-mathew",
    name: "Dr. Vinod Mathew",
    designationEnglish: "Subject Matter Specialist – Agronomy",
    designationMalayalam: "വിഷയവിദഗ്ധൻ – അഗ്രോണമി",
    roleEnglish: "Crop Production & Nutrient Management",
    roleMalayalam: "വിള ഉൽപ്പാദനം & പോഷക പരിപാലനം",
    responsibilitiesEnglish: "Crop production, agronomy and nutrient management.",
    responsibilitiesMalayalam: "വിള ഉൽപ്പാദനം, അഗ്രോണമി, പോഷക പരിപാലനം."
  },
  {
    id: "rincy-abraham",
    name: "Dr. Rincy K. Abraham",
    designationEnglish: "Subject Matter Specialist – Horticulture",
    designationMalayalam: "വിഷയവിദഗ്ധൻ – ഹോർട്ടികൾച്ചർ",
    roleEnglish: "Horticultural Crops & Orchard Advisory",
    roleMalayalam: "ഹോർട്ടികൾച്ചർ വിളകൾ & തോട്ടവിള ഉപദേശം",
    responsibilitiesEnglish: "Horticultural crops, orchards and crop-specific advisory.",
    responsibilitiesMalayalam: "ഹോർട്ടികൾച്ചർ വിളകൾ, തോട്ടവിളകൾ, വിളവിശേഷ ഉപദേശം."
  },
  {
    id: "sency-mathew",
    name: "Dr. Sency Mathew",
    designationEnglish: "Subject Matter Specialist – Animal Science",
    designationMalayalam: "വിഷയവിദഗ്ധ – അനിമൽ സയൻസ്",
    roleEnglish: "Livestock, Poultry & Veterinary Advisory Coordination",
    roleMalayalam: "കന്നുകാലി, കോഴി & വെറ്ററിനറി ഉപദേശ ഏകോപനം",
    responsibilitiesEnglish: "Livestock, poultry and veterinary advisory coordination.",
    responsibilitiesMalayalam: "കന്നുകാലി, കോഴി, വെറ്ററിനറി ഉപദേശ ഏകോപനം."
  },
  {
    id: "alex-john",
    name: "Dr. Alex John",
    designationEnglish: "Subject Matter Specialist – Plant Protection",
    designationMalayalam: "വിഷയവിദഗ്ധൻ – പ്ലാന്റ് പ്രൊട്ടക്ഷൻ",
    roleEnglish: "Crop Health & Pest-Disease Management",
    roleMalayalam: "വിളാരോഗ്യം & കീട-രോഗ പരിപാലനം",
    responsibilitiesEnglish: "Crop health, pest identification and disease management.",
    responsibilitiesMalayalam: "വിളാരോഗ്യം, കീട തിരിച്ചറിയൽ, രോഗ പരിപാലനം."
  },
  {
    id: "shana-harshan",
    name: "Dr. Shana Harshan",
    designationEnglish: "Subject Matter Specialist – Home Science",
    designationMalayalam: "വിഷയവിദഗ്ധ – ഹോം സയൻസ്",
    roleEnglish: "Value Addition & Agri-Enterprise Development",
    roleMalayalam: "മൂല്യവർധന & കാർഷിക സംരംഭ വികസനം",
    responsibilitiesEnglish: "Value addition, food processing and agri-enterprise development.",
    responsibilitiesMalayalam: "മൂല്യവർധന, ഭക്ഷ്യസംസ്കരണം, കാർഷിക സംരംഭ വികസനം."
  },
  {
    id: "ambily-varughese",
    name: "Smt. Ambily Varughese",
    designationEnglish: "Farm Manager",
    designationMalayalam: "ഫാം മാനേജർ",
    roleEnglish: "Farm Operations & Technology Demonstration",
    roleMalayalam: "ഫാം പ്രവർത്തനങ്ങൾ & സാങ്കേതിക പ്രദർശനം",
    responsibilitiesEnglish: "Farm operations and practical technology demonstration.",
    responsibilitiesMalayalam: "ഫാം പ്രവർത്തനങ്ങളും പ്രായോഗിക സാങ്കേതിക പ്രദർശനവും."
  }
]);

function isMalayalam(language) {
  return String(language || "").toLowerCase() !== "english";
}

function buildAboutText(language) {
  if (isMalayalam(language)) {
    return [
      "🌱 BhoomiMitra – ഭൂമിമിത്ര",
      "",
      "ICAR–കൃഷി വിജ്ഞാന കേന്ദ്രം,",
      "CARD, പത്തനംതിട്ടയുടെ ഒരു പദ്ധതി",
      "",
      "സാങ്കേതിക പിന്തുണ: IlumiVision"
    ].join("\n");
  }

  return [
    "🌱 BhoomiMitra – ഭൂമിമിത്ര",
    "",
    "A Project of ICAR–Krishi Vigyan Kendra,",
    "CARD, Pathanamthitta",
    "",
    "Powered by IlumiVision"
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
