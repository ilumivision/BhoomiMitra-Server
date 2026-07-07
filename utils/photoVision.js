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
            "https://graph.facebook.com/v20.0/" + mediaId,
            {
                headers: {
                    Authorization: "Bearer " + whatsappToken
                }
            }
        );
        const mediaUrl = mediaInfo.data.url;
        const imageResponse = await axios.get(mediaUrl, {
            responseType: "arraybuffer",
            headers: {
                Authorization: "Bearer " + whatsappToken
            }
        });
        const base64Image = Buffer.from(imageResponse.data).toString("base64");
        const mimeType = imageResponse.headers["content-type"] || "image/jpeg";
        const prompt = [
            "You are BhoomiMitra, Kerala's agriculture AI assistant.",
            "Analyse this farmer photo carefully.",
            "Focus only on agriculture, livestock, fisheries, farm machinery, nursery, input, or allied sector issues.",
            "If the image is a crop, identify crop if possible.",
            "If disease, pest, nutrient deficiency, water stress, nursery issue, or field problem is visible, explain likely cause.",
            "Give Kerala-specific practical advice.",
            "Use KAU, ICAR, KVK and Kerala agriculture context.",
            "Do not overclaim. If confidence is low, say close-up photo and field details are needed.",
            "Ask for district, crop age/stage, symptoms, recent fertilizer/pesticide use, and weather if needed.",
            "Reply in simple farmer-friendly English.",
            "Keep the answer short and practical."
        ].join("\n");
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
            max_tokens: 500
        });
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
