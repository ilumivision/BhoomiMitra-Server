const DISTRICTS = [
  {
    canonical: "Thiruvananthapuram",
    aliases: ["Thiruvananthapuram", "Trivandrum", "തിരുവനന്തപുരം"]
  },
  {
    canonical: "Kollam",
    aliases: ["Kollam", "കൊല്ലം"]
  },
  {
    canonical: "Pathanamthitta",
    aliases: ["Pathanamthitta", "പത്തനംതിട്ട"]
  },
  {
    canonical: "Alappuzha",
    aliases: ["Alappuzha", "Alleppey", "ആലപ്പുഴ"]
  },
  {
    canonical: "Kottayam",
    aliases: ["Kottayam", "കോട്ടയം"]
  },
  {
    canonical: "Idukki",
    aliases: ["Idukki", "ഇടുക്കി"]
  },
  {
    canonical: "Ernakulam",
    aliases: ["Ernakulam", "എറണാകുളം"]
  },
  {
    canonical: "Thrissur",
    aliases: ["Thrissur", "തൃശ്ശൂർ"]
  },
  {
    canonical: "Palakkad",
    aliases: ["Palakkad", "പാലക്കാട്"]
  },
  {
    canonical: "Malappuram",
    aliases: ["Malappuram", "മലപ്പുറം"]
  },
  {
    canonical: "Kozhikode",
    aliases: ["Kozhikode", "Calicut", "കോഴിക്കോട്"]
  },
  {
    canonical: "Wayanad",
    aliases: ["Wayanad", "വയനാട്"]
  },
  {
    canonical: "Kannur",
    aliases: ["Kannur", "കണ്ണൂർ"]
  },
  {
    canonical: "Kasaragod",
    aliases: ["Kasaragod", "Kasargod", "കാസർഗോഡ്"]
  }
];

function normalize(value) {
  return String(value || "")
    .normalize("NFC")
    .toLowerCase();
}

function detectKeralaDistrict(text) {
  const normalizedText = normalize(text);

  for (const district of DISTRICTS) {
    const found = district.aliases.some(function (alias) {
      return normalizedText.includes(normalize(alias));
    });

    if (found) {
      return district.canonical;
    }
  }

  return null;
}

module.exports = detectKeralaDistrict;
