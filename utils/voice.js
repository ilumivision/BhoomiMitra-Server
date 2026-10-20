const fs = require("fs");
const path = require("path");
const axios = require("axios");
const OpenAI = require("openai");
const {
    hashIdentifier,
    safeErrorDetails
} = require("./webhookSecurity");

function createVoiceModule(options) {
  const input = options || {};
  const fileSystem = input.fileSystem || fs;
  const httpClient = input.httpClient || axios;
  const environment = input.env || process.env;
  let openaiClient = input.openaiClient || null;

return async function voiceModule(data) {
    let audioPath = "";

    try {
        const mediaId = data.mediaId;
        const whatsappToken = environment.WHATSAPP_TOKEN;

        if (!mediaId) {
            return {
                success: false,
                module: "VOICE",
                reply: "Voice media not found."
            };
        }

        const mediaInfo = await httpClient.get(
            "https://graph.facebook.com/v20.0/" + mediaId,
            {
                headers: {
                    Authorization: "Bearer " + whatsappToken
                }
            }
        );

        const mediaUrl = mediaInfo.data.url;

        const audioResponse = await httpClient.get(mediaUrl, {
            responseType: "arraybuffer",
            headers: {
                Authorization: "Bearer " + whatsappToken
            }
        });

        const tempDir = input.tempDir || path.join(__dirname, "../tmp");

        if (!fileSystem.existsSync(tempDir)) {
            fileSystem.mkdirSync(tempDir, { recursive: true });
        }

        audioPath = path.join(tempDir, hashIdentifier(mediaId) + ".ogg");

        fileSystem.writeFileSync(audioPath, audioResponse.data);

        if (!openaiClient) {
            openaiClient = new OpenAI({
                apiKey: environment.OPENAI_API_KEY
            });
        }

        const transcription = await openaiClient.audio.transcriptions.create({
            file: fileSystem.createReadStream(audioPath),
            model: "gpt-4o-mini-transcribe",
            response_format: "text"
        });

        fileSystem.unlinkSync(audioPath);
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
                fileSystem.unlinkSync(audioPath);
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
};
}

const voiceModule = createVoiceModule();

module.exports = voiceModule;
module.exports.createVoiceModule = createVoiceModule;
