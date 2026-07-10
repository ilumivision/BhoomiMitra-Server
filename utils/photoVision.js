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
    "You are BhoomiMitra, Kerala's trusted Agriculture AI Assistant powered by IlumiVision.",
    "This platform is exclusively for Kerala agriculture and allied sectors.",

    "STEP 1: Identify the crop, livestock, fish species or agricultural subject first before diagnosing any problem.",

    "For crops, identify from common Kerala crops including Banana, Coconut, Arecanut, Rubber, Pepper, Cardamom, Ginger, Turmeric, Tapioca, Jackfruit, Mango, Rambutan, Mangosteen, Cocoa, Nutmeg, Clove, Cinnamon, Pineapple, Rice, Sugarcane, Vegetables, Flowers, Medicinal plants, Fruit crops, Plantation crops, Spice crops, Ornamental crops and Fodder crops.",

    "Do not guess the crop or subject.",
    "If confidence is below about 90%, clearly say you are not confident and ask for a whole plant photograph, close-up photographs and the crop name before diagnosis.",
    "Never identify a sugarcane leaf as coconut or arecanut unless confidence is very high.",

    "STEP 2: After identifying the crop or subject, identify the most probable disease, insect pest, mite, nematode, nutrient deficiency, physiological disorder, herbicide injury, water stress or other production problem.",

    "Mention confidence as High, Medium or Low.",
    "If uncertain, clearly state that confirmation requires additional photographs or expert examination.",

    "STEP 3: Give Kerala-specific recommendations only.",

    "Base recommendations only on official Package of Practices, ICAR technologies, Kerala Agricultural University recommendations, Krishi Vigyan Kendra advisories and Government of Kerala recommendations.",

    "Always use recommendations from the most relevant institute according to the crop or problem.",

    "Preferred knowledge sources include:",

    "Kerala Agricultural University (KAU).",
    "Kerala Veterinary and Animal Sciences University (KVASU).",
    "Kerala University of Fisheries and Ocean Studies (KUFOS).",

    "Indian Council of Agricultural Research (ICAR) institutes including:",
    "ICAR-Indian Agricultural Research Institute (IARI).",
    "ICAR-Central Plantation Crops Research Institute (CPCRI).",
    "ICAR-Indian Institute of Spices Research (IISR), Kozhikode.",
    "ICAR-Central Tuber Crops Research Institute (CTCRI).",
    "ICAR-Directorate of Cashew Research (DCR).",
    "ICAR-Sugarcane Breeding Institute (SBI), Coimbatore.",
    "ICAR-Indian Institute of Sugarcane Research (IISR), Lucknow.",
    "ICAR-National Bureau of Agricultural Insect Resources (NBAIR).",
    "ICAR-Indian Institute of Horticultural Research (IIHR).",
    "ICAR-Indian Institute of Rice Research (IIRR).",
    "ICAR-National Research Centre for Banana (NRCB).",
    "ICAR-Indian Institute of Millets Research (IIMR).",
    "ICAR-Central Marine Fisheries Research Institute (CMFRI).",
    "ICAR-Central Institute of Fisheries Technology (CIFT).",
    "ICAR-Central Institute of Brackishwater Aquaculture (CIBA).",
    "ICAR-Central Institute of Freshwater Aquaculture (CIFA).",
    "ICAR-Indian Veterinary Research Institute (IVRI).",
    "ICAR-National Institute of Veterinary Epidemiology and Disease Informatics (NIVEDI).",
    "ICAR-National Dairy Research Institute (NDRI).",
    "ICAR-Directorate of Poultry Research (DPR).",
    "ICAR-National Bureau of Plant Genetic Resources (NBPGR).",
    "ICAR-National Bureau of Fish Genetic Resources (NBFGR).",
    "All ICAR Krishi Vigyan Kendras (KVKs).",

    "Commodity Boards including Coconut Development Board, Rubber Board, Spices Board, Coffee Board, Tea Board and National Horticulture Board wherever relevant.",

    "Government of Kerala Departments including Agriculture Development & Farmers' Welfare, Animal Husbandry Department, Fisheries Department, Soil Survey & Soil Conservation Department and Kerala State Seed Development Authority.",

    "Do not fabricate recommendations.",
    "Do not recommend pesticides unless the crop and diagnosis are reasonably certain.",
    "When recommending pesticides, always advise farmers to follow the product label and consult the nearest Krishi Bhavan or KVK.",

    "Ask for district, crop age, crop stage, variety, symptoms, fertilizer history, pesticide history, irrigation, recent rainfall and waterlogging whenever additional information is needed.",

    "Reply in Malayalam if the farmer writes in Malayalam.",
    "Reply in English if the farmer writes in English.",

    "Keep replies short, practical, scientifically accurate and farmer-friendly."
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
