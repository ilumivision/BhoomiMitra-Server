"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createVoiceModule } = require("../utils/voice");
const { createPhotoVision } = require("../utils/photoVision");

test("voice assistance downloads authenticated media, transcribes it and cleans up", async function () {
  const calls = [];
  const removed = [];
  const voice = createVoiceModule({
    env: { WHATSAPP_TOKEN: "fixture-token" },
    tempDir: "fixture-temp",
    httpClient: {
      async get(url, options) {
        calls.push({ url, options });
        return calls.length === 1
          ? { data: { url: "https://media.example.invalid/audio" } }
          : { data: Buffer.from("audio") };
      }
    },
    fileSystem: {
      existsSync() { return true; },
      mkdirSync() {},
      writeFileSync() {},
      createReadStream(file) { return { file }; },
      unlinkSync(file) { removed.push(file); }
    },
    openaiClient: {
      audio: {
        transcriptions: {
          async create(request) {
            assert.equal(request.model, "gpt-4o-mini-transcribe");
            return "എന്റെ വാഴയുടെ ഇലയിൽ പാടുകൾ ഉണ്ട്";
          }
        }
      }
    }
  });

  const result = await voice({ mediaId: "media-1" });
  assert.equal(result.success, true);
  assert.match(result.text, /വാഴ/);
  assert.equal(calls.length, 2);
  assert.match(calls[0].options.headers.Authorization, /^Bearer /);
  assert.equal(removed.length, 1);
});

test("voice assistance fails safely without media and makes no external call", async function () {
  let calls = 0;
  const voice = createVoiceModule({
    env: {},
    httpClient: { async get() { calls += 1; } },
    openaiClient: { audio: { transcriptions: { async create() {} } } }
  });
  const result = await voice({});
  assert.equal(result.success, false);
  assert.equal(calls, 0);
});

test("photo assistance uses authenticated media and returns the bounded model reply", async function () {
  const calls = [];
  let modelRequest;
  const photo = createPhotoVision({
    env: {
      WHATSAPP_TOKEN: "fixture-token",
      OPENAI_MODEL: "fixture-vision-model"
    },
    httpClient: {
      async get(url, options) {
        calls.push({ url, options });
        return calls.length === 1
          ? { data: { url: "https://media.example.invalid/image", mime_type: "image/jpeg" } }
          : { data: Buffer.from("image"), headers: { "content-type": "image/jpeg" } };
      }
    },
    openaiClient: {
      chat: {
        completions: {
          async create(request) {
            modelRequest = request;
            return {
              choices: [{ message: { content: "Low-confidence leaf symptom. Send a whole-plant photo and consult an expert." } }]
            };
          }
        }
      }
    }
  });

  const result = await photo({ mediaId: "image-1", caption: "Banana leaf" });
  assert.equal(result.success, true);
  assert.match(result.reply, /Low-confidence/);
  assert.equal(modelRequest.model, "fixture-vision-model");
  const imagePart = modelRequest.messages[1].content[1];
  assert.match(imagePart.image_url.url, /^data:image\/jpeg;base64,/);
  assert.equal(calls.length, 2);
});

test("photo assistance refuses media download when WhatsApp configuration is missing", async function () {
  let calls = 0;
  const photo = createPhotoVision({
    env: {},
    httpClient: { async get() { calls += 1; } },
    openaiClient: { chat: { completions: { async create() {} } } }
  });
  const result = await photo({ mediaId: "image-1" });
  assert.equal(result.success, false);
  assert.equal(calls, 0);
});
