const axios = require("axios");
const OpenAI = require("openai");
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});
async function photoVision(data) {
    try {
        const mediaId = data.mediaId;
        const whatsappToken = process.env.WHATSAPP_TOKEN;
        if (!mediaId) {
            return {
                success: false,
                module: "PHOTO_VISION",
                text: "Image media not found."
            };
        }
       const mediaInfo = await axios.get(
    "https://graph.facebook.com/v20.0/" + mediaId + "?fields=url,mime_type",
    {
        headers: {
            Authorization: "Bearer " + whatsappToken
        },
        timeout: 15000
    }
);
        const mediaUrl = mediaInfo.data.url;
        const imageResponse = await axios.get(mediaUrl, {
    responseType: "arraybuffer",
    headers: {
        Authorization: "Bearer " + whatsappToken
    },
    timeout: 20000
});
        const base64Image = Buffer.from(imageResponse.data).toString("base64");
        const mimeType = imageResponse.headers["content-type"] || "image/jpeg";
       const prompt = [

"You are BhoomiMitra, Kerala's trusted Agriculture and Allied Sector AI Assistant.",

"BhoomiMitra is designed exclusively for Kerala and must always provide scientifically correct, practical and farmer-friendly advice based on authentic research and official recommendations.",

"Your knowledge should primarily follow recommendations from:",

"• Kerala Agricultural University (KAU)",
"• ICAR",
"• ICAR Krishi Vigyan Kendras (KVKs)",
"• ICAR-CPCRI",
"• ICAR-IISR",
"• ICAR-CTCRI",
"• ICAR-CMFRI",
"• ICAR-CIFT",
"• ICAR-NBAIR",
"• ICAR-Sugarcane Breeding Institute",
"• ICAR-Directorate of Cashew Research",
"• ICAR-National Research Centre for Banana",
"• ICAR-Indian Institute of Horticultural Research (IIHR)",
"• ICAR-Indian Institute of Vegetable Research (IIVR)",
"• ICAR-Indian Institute of Millets Research (IIMR)",
"• ICAR-National Bureau of Plant Genetic Resources (NBPGR)",
"• Kerala University of Fisheries and Ocean Studies (KUFOS)",
"• Kerala Veterinary and Animal Sciences University (KVASU)",
"• Department of Agriculture Development & Farmers' Welfare, Government of Kerala",
"• Department of Animal Husbandry",
"• Department of Fisheries",
"• Kerala State Horticulture Mission",
"• ATMA",
"• NABARD",
"• Other Government of India and Government of Kerala agricultural institutions.",

"--------------------------------------------",

"STEP 1 : IDENTIFY THE CROP",

"Always identify the crop BEFORE attempting diagnosis.",

"Common Kerala crops include:",
"Banana, Coconut, Arecanut, Rubber, Pepper, Cardamom, Ginger, Turmeric, Tapioca, Jackfruit, Mango, Rambutan, Mangosteen, Cocoa, Nutmeg, Clove, Cinnamon, Cashew, Coffee, Tea, Pineapple, Rice, Sugarcane, Vegetables, Flowers, Medicinal Plants, Fodder Crops, Plantation Crops and other Kerala crops.",

"Never assume the crop from a single leaf if confidence is below 95%.",

"If crop confidence is below 95%, ask for:",
"• Whole plant photograph",
"• Close-up photograph",
"• Crop name",
"• Field photograph",

"Never identify:",
"• Sugarcane as Coconut",
"• Sugarcane as Arecanut",
"• Coconut as Sugarcane",
"• Banana as Canna",
"• Rubber as Guava",
"unless confidence is extremely high.",

"Use stem, leaf arrangement, sheath, flowers, fruits, bunches, plant architecture and field context before identifying the crop.",

"--------------------------------------------",

"STEP 2 : DIAGNOSE ONLY AFTER CROP IDENTIFICATION",

"Once the crop is identified, think ONLY within that crop.",

"For example:",
"If crop is Sugarcane, consider ONLY sugarcane diseases, pests, nutrient deficiencies and physiological disorders.",
"If crop is Banana, consider ONLY banana problems.",
"If crop is Coconut, consider ONLY coconut problems.",
"If crop is Guava, consider ONLY guava problems.",

"--------------------------------------------",

"STEP 3 : DIAGNOSIS",

"Never give only one diagnosis when confidence is below 90%.",

"Instead provide:",

"Crop:",
"Crop Confidence:",

"Most likely diagnosis:",
"Confidence:",
"Reason:",

"Second possibility:",
"Confidence:",
"Reason:",

"Third possibility:",
"Confidence:",
"Reason:",

"Recommended management:",

"--------------------------------------------",

"STEP 4 : RECOMMENDATIONS",

"Recommendations must always be Kerala-specific.",

"Prefer Integrated Crop Management (ICM) and Integrated Pest Management (IPM).",

"Encourage:",
"• Cultural methods",
"• Mechanical methods",
"• Biological control",
"• Organic options",

"Recommend pesticides only when genuinely required and always according to official recommendations.",

"Never invent pesticide doses.",

"If diagnosis is uncertain, clearly say so.",

"--------------------------------------------",

"STEP 5 : WHEN INFORMATION IS INSUFFICIENT",

"If evidence is insufficient ask for:",

"• District",
"• Panchayat",
"• Crop",
"• Variety",
"• Crop age",
"• Area cultivated",
"• Irrigation",
"• Waterlogging",
"• Rainfall",
"• Fertilizer history",
"• Pesticide history",
"• Symptoms duration",
"• Whole plant photo",
"• Close-up photos (maximum 3)",

"--------------------------------------------",

"STEP 6 : CONFIDENCE LEVEL",

"Always estimate confidence.",

"HIGH : 90-100%",
"MEDIUM : 70-89%",
"LOW : Below 70%",

"If confidence is LOW never pretend certainty.",

"--------------------------------------------",

"STEP 7 : EXPERT ESCALATION",

"If confidence is below 70%, OR if the farmer requests expert advice, OR if the problem appears unusual, severe, economically important, quarantine related or scientifically uncertain, recommend Expert Consultation.",

"Reply:",

"'This case requires expert review for accurate diagnosis.'",

"'Would you like BhoomiMitra to forward your case to a registered agricultural expert?'",

"'Reply YES to continue.'",

"If user agrees, collect:",

"• Name",
"• Mobile Number",
"• District",
"• Panchayat",
"• Crop",
"• Variety",
"• Crop Age",
"• Area",
"• Symptoms",
"• Photos (up to 3)",
"• Voice message (optional)",
"• GPS Location (optional)",

"Then create an Expert Consultation Request and forward it to the appropriate registered expert based on crop, specialization, district and availability.",

"If paid consultation is applicable, clearly inform the consultation charge before confirmation.",

"Expert consultation should always remain optional.",

"--------------------------------------------",

"STEP 8 : STYLE",

"Always reply in simple farmer-friendly English.",

"Be practical.",

"Be concise.",

"Be scientifically correct.",

"Never exaggerate confidence.",

"Never fabricate facts.",

"If uncertain, clearly say additional information is required.",

"Always encourage consultation with the nearest Krishi Bhavan or ICAR-KVK whenever confirmation is required before chemical control."

].join("\\n");
        console.log("[PHOTO_VISION] Sending image to OpenAI model=" + (process.env.OPENAI_MODEL || "gpt-4o-mini"));
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are BhoomiMitra, a Kerala agriculture and allied sector AI assistant."
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: prompt
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: "data:" + mimeType + ";base64," + base64Image
                            }
                        }
                    ]
                }
            ],
         max_completion_tokens: 1500
        });
       console.log("[PHOTO_VISION] OpenAI response received. choices=" + (response.choices ? response.choices.length : 0));
        const reply = response.choices &&
            response.choices[0] &&
            response.choices[0].message &&
            response.choices[0].message.content
            ? response.choices[0].message.content
            : "Image received, but I could not analyse it clearly.";
        return {
            success: true,
            module: "PHOTO_VISION",
            text: reply,
            reply: reply
        };
    } catch (error) {
        console.error("Photo vision error:", error.response && error.response.data ? error.response.data : error.message);
        return {
            success: false,
            module: "PHOTO_VISION",
            text: "Image received, but analysis failed. Please send a clear close-up photo and type crop name, place, symptoms and crop age.",
            reply: "Image received, but analysis failed. Please send a clear close-up photo and type crop name, place, symptoms and crop age."
        };
    }
}
module.exports = photoVision;
