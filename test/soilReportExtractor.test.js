"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_REPORT_BYTES,
  createSoilReportExtractor
} = require("../utils/soilReportExtractor");

function extractedJson() {
  return JSON.stringify({
    laboratory: "District Soil Testing Laboratory",
    testDate: "2026-10-01",
    reportReference: "R-101",
    parameters: {
      ph: { value: 5.6, unit: "", method: "1:2.5 water", interpretation: "Acidic" },
      ec: null,
      organicCarbon: null,
      nitrogen: { value: 210, unit: "kg/ha", method: "Alkaline KMnO4", interpretation: "Low" },
      phosphorus: null,
      potassium: null,
      calcium: null,
      magnesium: null,
      sulphur: null,
      zinc: null,
      boron: null,
      iron: null,
      manganese: null,
      copper: null
    }
  });
}

function harness(mimeType, bytes) {
  const calls = [];
  const extractor = createSoilReportExtractor({
    env: { WHATSAPP_TOKEN: "token", OPENAI_API_KEY: "key", OPENAI_SOIL_REPORT_MODEL: "test-model" },
    httpClient: {
      get: async function (url) {
        calls.push(url);
        if (url.includes("graph.facebook.com")) return { data: { url: "https://media.invalid/report", mime_type: mimeType } };
        return { data: Buffer.alloc(bytes || 128, 1), headers: { "content-type": mimeType } };
      }
    },
    openaiClient: {
      responses: {
        create: async function (request) {
          calls.push(request);
          return { output_text: extractedJson() };
        }
      }
    }
  });
  return { extractor: extractor, calls: calls };
}

test("soil report image extraction is structured, unconfirmed and keeps printed metadata", async function () {
  const target = harness("image/jpeg");
  const result = await target.extractor({
    mediaId: "media-1", mimeType: "image/jpeg", farmerId: "BM-F-1", landId: "BM-L-1"
  });
  assert.equal(result.success, true);
  assert.equal(result.code, "EXTRACTED_CONFIRMATION_REQUIRED");
  assert.equal(result.observation.sourceName, "District Soil Testing Laboratory");
  assert.equal(result.observation.parameters.nitrogen.unit, "kg/ha");
  const request = target.calls.find(function (call) { return call && call.model; });
  assert.equal(request.model, "test-model");
  assert.equal(request.input[0].content[1].type, "input_image");
  assert.equal(request.text.format.strict, true);
});

test("soil report PDF uses input_file without writing a temporary file", async function () {
  const target = harness("application/pdf");
  const result = await target.extractor({ mediaId: "media-2", mimeType: "application/pdf", filename: "soil.pdf" });
  assert.equal(result.success, true);
  const request = target.calls.find(function (call) { return call && call.model; });
  assert.equal(request.input[0].content[1].type, "input_file");
  assert.equal(request.input[0].content[1].filename, "soil.pdf");
  assert.match(request.input[0].content[1].file_data, /^data:application\/pdf;base64,/);
});

test("unsupported report types are rejected before any network or AI call", async function () {
  const target = harness("application/msword");
  const result = await target.extractor({ mediaId: "media-3", mimeType: "application/msword" });
  assert.equal(result.success, false);
  assert.equal(result.code, "UNSUPPORTED_REPORT_TYPE");
  assert.equal(target.calls.length, 0);
});

test("oversized downloads are rejected before AI extraction", async function () {
  const target = harness("image/png", MAX_REPORT_BYTES + 1);
  const result = await target.extractor({ mediaId: "media-4", mimeType: "image/png" });
  assert.equal(result.success, false);
  assert.equal(result.code, "REPORT_TOO_LARGE");
  assert.equal(target.calls.some(function (call) { return call && call.model; }), false);
});
