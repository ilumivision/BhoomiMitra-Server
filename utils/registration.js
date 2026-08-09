async function registrationModule(data) {
  const text =
    String((data && data.text) || "")
      .trim()
      .toLowerCase();

  const language =
    String((data && data.language) || "English")
      .trim()
      .toLowerCase();

  if (
    ["hi", "hello", "start", "hai", "ഹായ്"]
      .includes(text)
  ) {
    if (language === "malayalam") {
      return {
        success: true,
        module: "REGISTRATION",
        reply:
`🌱 ഭൂമിമിത്ര AI-യിലേക്ക് സ്വാഗതം
കേരളത്തിന്റെ കാർഷിക-അനുബന്ധ മേഖലകൾക്കായുള്ള AI സഹായി.

മികച്ച സേവനങ്ങൾ ലഭിക്കുന്നതിനായി താങ്കൾക്ക് രജിസ്റ്റർ ചെയ്യാം.

ഒരു വിഭാഗം തിരഞ്ഞെടുക്കുക:

1️⃣ കർഷകൻ
2️⃣ വിദഗ്ധൻ
3️⃣ പ്രാവീണ്യമുള്ള തൊഴിലാളി
4️⃣ സേവനദാതാവ്
5️⃣ പൊതുജനം
6️⃣ രജിസ്ട്രേഷൻ ഒഴിവാക്കി തുടരുക

പിന്നീട് എപ്പോൾ വേണമെങ്കിലും REGISTER എന്ന് അയച്ച് രജിസ്റ്റർ ചെയ്യാം.`
      };
    }

    if (
      language === "bilingual" ||
      language === "english + malayalam" ||
      language === "english + മലയാളം"
    ) {
      return {
        success: true,
        module: "REGISTRATION",
        reply:
`🌱 Welcome to BhoomiMitra AI
🌱 ഭൂമിമിത്ര AI-യിലേക്ക് സ്വാഗതം

Kerala's Agriculture & Allied Sector AI Assistant.
കേരളത്തിന്റെ കാർഷിക-അനുബന്ധ മേഖലകൾക്കായുള്ള AI സഹായി.

To provide better services, you may register.
മികച്ച സേവനങ്ങൾ ലഭിക്കുന്നതിനായി താങ്കൾക്ക് രജിസ്റ്റർ ചെയ്യാം.

Choose one option / ഒരു വിഭാഗം തിരഞ്ഞെടുക്കുക:

1️⃣ Farmer / കർഷകൻ
2️⃣ Expert / വിദഗ്ധൻ
3️⃣ Skilled Worker / പ്രാവീണ്യമുള്ള തൊഴിലാളി
4️⃣ Service Provider / സേവനദാതാവ്
5️⃣ General Public / പൊതുജനം
6️⃣ Skip registration and continue / രജിസ്ട്രേഷൻ ഒഴിവാക്കി തുടരുക

You can register later anytime by typing REGISTER.
പിന്നീട് എപ്പോൾ വേണമെങ്കിലും REGISTER എന്ന് അയച്ച് രജിസ്റ്റർ ചെയ്യാം.`
      };
    }

    return {
      success: true,
      module: "REGISTRATION",
      reply:
`🌱 Welcome to BhoomiMitra AI
Kerala's Agriculture & Allied Sector AI Assistant.

To provide better services, you may register.

Choose one option:

1️⃣ Farmer
2️⃣ Expert
3️⃣ Skilled Worker
4️⃣ Service Provider
5️⃣ General Public
6️⃣ Skip registration and continue

You can register later anytime by typing REGISTER.`
    };
  }
    if (text === "6" || text.includes("skip")) {
        return {
            success: true,
            module: "REGISTRATION",
            reply:
`✅ No problem.
You can start asking your agriculture questions immediately.
You can register anytime by typing REGISTER.
How can I help you today?`
        };
    }
    if (["1", "farmer"].includes(text)) {
        return {
            success: true,
            module: "REGISTRATION",
            reply: "👨‍🌾 Farmer registration started. Please send your full name."
        };
    }
    if (["2", "expert"].includes(text)) {
        return {
            success: true,
            module: "REGISTRATION",
            reply: "👨‍🔬 Expert registration started. Please send your full name and specialization."
        };
    }
    if (["3", "skilled worker"].includes(text)) {
        return {
            success: true,
            module: "REGISTRATION",
            reply: "🛠️ Skilled Worker registration started. Please send your name and skill."
        };
    }
    if (["4", "service provider"].includes(text)) {
        return {
            success: true,
            module: "REGISTRATION",
            reply: "🏢 Service Provider registration started. Please send organisation/name and service."
        };
    }
    if (["5", "general public"].includes(text)) {
        return {
            success: true,
            module: "REGISTRATION",
            reply: "👥 General Public registration started. Please send your full name."
        };
    }
    return {
        success: false,
        module: "REGISTRATION",
        reply: null
    };
}
module.exports = registrationModule
