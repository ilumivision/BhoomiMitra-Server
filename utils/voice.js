const fs = require("fs");
const path = require("path");
const axios = require("axios");
const OpenAI = require("openai");
const {
    hashIdentifier,
    safeErrorDetails
} = require("./webhookSecurity");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function voiceModule(data) {
    let audioPath = "";

    try {
        const mediaId = data.mediaId;
        const whatsappToken = process.env.WHATSAPP_TOKEN;

        if (!mediaId) {
            return {
                success: false,
                module: "VOICE",
                reply: "Voice media not found."
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

        const audioResponse = await axios.get(mediaUrl, {
            responseType: "arraybuffer",
            headers: {
                Authorization: "Bearer " + whatsappToken
            }
        });

        const tempDir = path.join(__dirname, "../tmp");

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        audioPath = path.join(tempDir, hashIdentifier(mediaId) + ".ogg");

        fs.writeFileSync(audioPath, audioResponse.data);

        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: "gpt-4o-mini-transcribe",
            response_format: "text"
        });

        fs.unlinkSync(audioPath);
        audioPath = "";

        return {
            success: true,
            module: "VOICE",
            text: transcription,
            reply: transcription
        };

    } catch (error) {
        console.error(
            "Voice transcription failed.",
            { error: safeErrorDetails(error) }
        );

        return {
            success: false,
            module: "VOICE",
            reply: "Voice message received, but transcription failed. Please type your question or send voice again."
        };
    } finally {
        if (audioPath) {
            try {
                fs.unlinkSync(audioPath);
            } catch (cleanupError) {
                if (!cleanupError || cleanupError.code !== "ENOENT") {
                    console.error(
                        "Voice temporary file cleanup failed.",
                        { error: safeErrorDetails(cleanupError) }
                    );
                }
            }
        }
    }
}

module.exports = voiceModule;
