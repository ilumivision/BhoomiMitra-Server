"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createAiSheetLogger
} = require("../utils/aiSheetLogging");

const AI_RESPONSE_HEADERS = [
  "Log_ID", "DateTime", "Phone", "Member_ID", "Member_Name", "Language",
  "Farmer_Message", "AI_Reply", "Source", "Knowledge_Source",
  "Confidence_Score", "AI_Model", "Response_Time_ms", "Escalated",
  "Assigned_Expert", "Followup_Needed", "Feedback_Rating", "Conversation_ID",
  "WhatsApp_Message_ID", "Created_On", "Updated_On"
];

const CONVERSATION_HEADERS = [
  "Conversation_ID", "Session_ID", "User_ID", "Farmer_ID", "WhatsApp_No",
  "Date_Time", "Language", "Question", "Intent", "Crop", "Variety",
  "Growth_Stage", "Livestock", "Fishery", "State", "District", "Block",
  "Panchayat", "Village", "Latitude", "Longitude", "Weather_Event",
  "Weather_Condition", "Weather_Source", "Temperature_C", "Humidity_Percent",
  "Rainfall_mm", "Soil_Type", "AI_Response", "Expert_Correction",
  "Final_Response", "Action_Taken", "Source_Institute", "Reference_Document",
  "Reference_Link", "AI_Confidence", "Escalated_To_Expert", "Expert_Name",
  "Response_Time_Seconds", "User_Feedback", "Feedback_Rating",
  "Conversation_Status", "Created_On", "Last_Updated", "Remarks"
];

const QUERY_HEADERS = [
  "Query_ID", "Date", "Farmer_ID", "Farmer_Name", "Category", "Question",
  "Answer", "Answered_By", "Status", "Remarks"
];

test("AI and farmer-query writers map values to audited production headers", async function () {
  const headersBySheet = {
    AI_Response_Log: AI_RESPONSE_HEADERS,
    AI_Conversation_History: CONVERSATION_HEADERS,
    Farmer_Queries: QUERY_HEADERS
  };
  const appended = [];
  let id = 0;
  const logger = createAiSheetLogger({
    async readSheetRows(sheetName, range) {
      assert.equal(range, "1:1");
      return [headersBySheet[sheetName]];
    },
    async appendSafe(sheetName, row) {
      appended.push({ sheetName, row });
      return true;
    },
    sheets: {
      aiLog: "AI_Response_Log",
      conversation: "AI_Conversation_History",
      farmerQueries: "Farmer_Queries"
    },
    model: "fixture-model",
    now: function () { return new Date("2026-10-21T05:00:00.000Z"); },
    randomUUID: function () {
      id += 1;
      return "00000000-0000-4000-8000-" + String(id).padStart(12, "0");
    }
  });

  await logger.logAI("919000000000", "Pepper question", "Use safe advice", "ai_reply");
  await logger.logFarmerQuery(
    "919000000000",
    "Pepper question",
    "Use safe advice",
    "ai_reply"
  );

  const response = appended[0].row;
  assert.equal(response.length, AI_RESPONSE_HEADERS.length);
  assert.match(response[0], /^BM-AIL-/);
  assert.equal(response[1], "2026-10-21T05:00:00.000Z");
  assert.equal(response[2], "919000000000");
  assert.equal(response[6], "Pepper question");
  assert.equal(response[7], "Use safe advice");
  assert.equal(response[8], "WhatsApp");
  assert.equal(response[11], "fixture-model");

  const conversation = appended[1].row;
  assert.equal(conversation.length, CONVERSATION_HEADERS.length);
  assert.match(conversation[0], /^BM-CONV-/);
  assert.equal(conversation[4], "919000000000");
  assert.equal(conversation[7], "Pepper question");
  assert.equal(conversation[8], "ai_reply");
  assert.equal(conversation[28], "Use safe advice");
  assert.equal(conversation[30], "Use safe advice");
  assert.equal(conversation[41], "Answered");

  const query = appended[2].row;
  assert.equal(query.length, QUERY_HEADERS.length);
  assert.match(query[0], /^BM-QRY-/);
  assert.equal(query[4], "ai_reply");
  assert.equal(query[5], "Pepper question");
  assert.equal(query[6], "Use safe advice");
  assert.equal(query[7], "BhoomiMitra AI");
  assert.equal(query[8], "Open");
});

test("logging refuses missing or duplicate required headers instead of shifting data", async function () {
  const logger = createAiSheetLogger({
    async readSheetRows() {
      return [["Log_ID", "DateTime", "Phone", "Farmer_Message", "Farmer_Message", "AI_Reply"]];
    },
    async appendSafe() {
      assert.fail("append must not run for an ambiguous header row");
    }
  });

  await assert.rejects(
    logger.logAI("919000000000", "question", "answer", "ai_reply"),
    /duplicated: Farmer_Message/
  );
});
