"use strict";

const axios = require("axios");
const OpenAI = require("openai");
const { normalizeExtractedSoilReport } = require("./soilFertilizerAdvisory");
const { safeErrorDetails } = require("./webhookSecurity");

const ALLOWED_MIME_TYPES = Object.freeze([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);
const MAX_REPORT_BYTES = 10 * 1024 * 1024;

const EXTRACTION_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["laboratory", "testDate", "reportReference", "parameters"],
  properties: {
    laboratory: { type: "string" },
    testDate: { type: "string", description: "YYYY-MM-DD, or empty when not printed" },
    reportReference: { type: "string" },
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["ph", "ec", "organicCarbon", "nitrogen", "phosphorus", "potassium", "calcium", "magnesium", "sulphur", "zinc", "boron", "iron", "manganese", "copper"],
      properties: Object.fromEntries([
        "ph", "ec", "organicCarbon", "nitrogen", "phosphorus", "potassium",
        "calcium", "magnesium", "sulphur", "zinc", "boron", "iron", "manganese", "copper"
      ].map(function (name) {
        return [name, {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              additionalProperties: false,
              required: ["value", "unit", "method", "interpretation"],
              properties: {
                value: { type: "number" },
                unit: { type: "string" },
                method: { type: "string" },
                interpretation: { type: "string" }
              }
            }
          ]
        }];
      }))
    }
  }
});

function clean(value) {
  return value == null ? "" : String(value).trim();
}

function responseText(response) {
  if (response && clean(response.output_text)) return clean(response.output_text);
  const chunks = [];
  ((response && response.output) || []).forEach(function (item) {
    (item.content || []).forEach(function (content) {
      if (content && typeof content.text === "string") chunks.push(content.text);
    });
  });
  return chunks.join("").trim();
}

function createSoilReportExtractor(options) {
  const input = options || {};
  const httpClient = input.httpClient || axios;
  const environment = input.env || process.env;
  let openaiClient = input.openaiClient || null;

  return async function extractSoilReport(data) {
    const request = data || {};
    const mediaId = clean(request.mediaId);
    const declaredMime = clean(request.mimeType).toLowerCase();
    if (!mediaId) return { success: false, code: "MEDIA_ID_REQUIRED" };
    if (declaredMime && !ALLOWED_MIME_TYPES.includes(declaredMime)) {
      return { success: false, code: "UNSUPPORTED_REPORT_TYPE" };
    }
    if (!clean(environment.WHATSAPP_TOKEN)) return { success: false, code: "WHATSAPP_CONFIGURATION_MISSING" };
    if (!clean(environment.OPENAI_API_KEY) && !openaiClient) return { success: false, code: "EXTRACTION_CONFIGURATION_MISSING" };
    try {
      const metadataResponse = await httpClient.get(
        "https://graph.facebook.com/v20.0/" + encodeURIComponent(mediaId) + "?fields=url,mime_type",
        { headers: { Authorization: "Bearer " + environment.WHATSAPP_TOKEN }, timeout: 15000 }
      );
      const mediaUrl = metadataResponse && metadataResponse.data && metadataResponse.data.url;
      const mimeType = clean(declaredMime || (metadataResponse && metadataResponse.data && metadataResponse.data.mime_type)).toLowerCase();
      if (!mediaUrl || !ALLOWED_MIME_TYPES.includes(mimeType)) return { success: false, code: "UNSUPPORTED_REPORT_TYPE" };
      const download = await httpClient.get(mediaUrl, {
        responseType: "arraybuffer",
        headers: { Authorization: "Bearer " + environment.WHATSAPP_TOKEN },
        timeout: 25000,
        maxContentLength: MAX_REPORT_BYTES,
        maxBodyLength: MAX_REPORT_BYTES
      });
      const buffer = Buffer.from(download && download.data ? download.data : []);
      if (!buffer.length) return { success: false, code: "EMPTY_REPORT" };
      if (buffer.length > MAX_REPORT_BYTES) return { success: false, code: "REPORT_TOO_LARGE" };
      if (!openaiClient) openaiClient = new OpenAI({ apiKey: environment.OPENAI_API_KEY });
      const base64 = buffer.toString("base64");
      const mediaPart = mimeType === "application/pdf"
        ? { type: "input_file", filename: clean(request.filename) || "soil-test-report.pdf", file_data: "data:" + mimeType + ";base64," + base64 }
        : { type: "input_image", image_url: "data:" + mimeType + ";base64," + base64, detail: "high" };
      const response = await openaiClient.responses.create({
        model: clean(environment.OPENAI_SOIL_REPORT_MODEL) || "gpt-4.1-mini",
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: [
              "Extract only values visibly printed in this soil-test report.",
              "Do not infer a missing number, unit, laboratory method, date, source or interpretation.",
              "Use null for a parameter that is not present. Keep printed nutrient units and extraction methods exactly as shown.",
              "A human farmer must confirm the result before agronomic use."
            ].join(" ") },
            mediaPart
          ]
        }],
        text: {
          format: {
            type: "json_schema",
            name: "soil_test_report",
            strict: true,
            schema: EXTRACTION_SCHEMA
          }
        }
      });
      const normalized = normalizeExtractedSoilReport(responseText(response), {
        farmerId: request.farmerId,
        landId: request.landId
      });
      return Object.assign({ module: "SOIL_REPORT_EXTRACTION", mimeType: mimeType }, normalized);
    } catch (error) {
      console.error("[SOIL_REPORT_EXTRACTION] Failed.", safeErrorDetails(error));
      return { success: false, code: "REPORT_EXTRACTION_FAILED" };
    }
  };
}

const soilReportExtractor = createSoilReportExtractor();
module.exports = soilReportExtractor;
module.exports.ALLOWED_MIME_TYPES = ALLOWED_MIME_TYPES;
module.exports.EXTRACTION_SCHEMA = EXTRACTION_SCHEMA;
module.exports.MAX_REPORT_BYTES = MAX_REPORT_BYTES;
module.exports.createSoilReportExtractor = createSoilReportExtractor;
