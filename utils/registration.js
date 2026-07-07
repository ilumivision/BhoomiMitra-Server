async function registrationModule(data) {
    const text = (data.text || "").trim().toLowerCase();
    if (["hi", "hello", "start", "hai", "ഹായ്"].includes(text)) {
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
6️⃣ Skip registration and continue chatting
You can register later anytime by typing:
REGISTER`
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
