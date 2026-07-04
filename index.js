const express = require("express");
const axios = require("axios");
require("dotenv").config();

const OpenAI = require("openai");
const { google } = require("googleapis");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY =
  (process.env.GOOGLE_PRIVATE_KEY || "")
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n")
    .trim();

const openai = new OpenAI({
 apiKey: OPENAI_API_KEY
});

const googleAuth = new google.auth.JWT({
 email: GOOGLE_CLIENT_EMAIL,
 key: GOOGLE_PRIVATE_KEY,
 scopes: [
 "https://www.googleapis.com/auth/spreadsheets"
 ]
});

const sheets = google.sheets({
 version:"v4",
 auth:googleAuth
});

const sessions={};

const SHEETS={
 farmers:"Farmers",
 conversation:"Conversation_History",
 aiLog:"AI_Response_Log",
 farmerQueries:"Farmer_Queries"
};

const SYSTEM_PROMPT=`

You are BhoomiMitra,
Kerala's trusted Agriculture AI Assistant,
powered by IlumiVision.

MISSION

Improve productivity,
profitability,
sustainability,
climate resilience
and quality of life
of Kerala farmers.

Operate ONLY inside Kerala.

Answer ONLY agriculture and allied sector questions.

Supported sectors include:

Agriculture

Horticulture

Plantation Crops

Coconut

Arecanut

Rubber

Rice

Banana

Vegetables

Fruits

Spices

Medicinal Plants

Protected Cultivation

Organic Farming

Natural Farming

Precision Farming

Livestock

Dairy

Goat

Poultry

Piggery

Rabbit

Fisheries

Aquaculture

Mushroom

Apiculture

Farm Mechanization

Food Processing

Value Addition

Agricultural Marketing

Government Schemes

Weather

Crop Insurance

FPO

Rural Livelihood

KVK Services

Knowledge Priority

1 BhoomiMitra Knowledge Base

2 KAU Package of Practices

3 ICAR Institutes

4 KVK

5 Kerala Government

6 Government of India

7 IMD

Never guess.

Never fabricate.

Never invent references.

If uncertain,
clearly say so.

Reply in Malayalam if user writes Malayalam.

Reply in English if user writes English.

Keep answers short.

Practical.

Farmer friendly.

Ask only ONE short clarification question when absolutely necessary.

If question is outside agriculture reply:

"I am BhoomiMitra,
Kerala's Agriculture AI Assistant.
Please ask only agriculture or allied sector questions."

`;
app.get("/",function(req,res){
 res.status(200).send("BhoomiMitra AI Server is running.");
});

app.get("/webhook",function(req,res){
 const mode=req.query["hub.mode"];
 const token=req.query["hub.verify_token"];
 const challenge=req.query["hub.challenge"];

 if(mode==="subscribe" && token===VERIFY_TOKEN){
  console.log("Webhook verified successfully.");
  return res.status(200).send(challenge);
 }

 return res.sendStatus(403);
});

app.post("/webhook",async function(req,res){
 res.status(200).send("EVENT_RECEIVED");

 try{
  const body=req.body;

  if(body.object!=="whatsapp_business_account"){
   return;
  }

  const value=
   body.entry &&
   body.entry[0] &&
   body.entry[0].changes &&
   body.entry[0].changes[0] &&
   body.entry[0].changes[0].value;

  if(!value || value.statuses){
   return;
  }

  const message=value.messages && value.messages[0];

  if(!message){
   return;
  }

  const from=message.from;

  let userText="";

  if(message.type==="text"){
   userText=
    message.text && message.text.body
    ? message.text.body.trim()
    : "";
  }else{
   userText="User sent a non-text message.";
  }

  console.log("Message from: "+from);
  console.log("User text: "+userText);

  await appendSafe(SHEETS.conversation,[
   new Date().toISOString(),
   from,
   userText,
   "incoming"
  ]);

  const registrationReply=await handleRegistration(from,userText);

  if(registrationReply){
   await sendWhatsAppMessage(from,registrationReply);
   await logAI(from,userText,registrationReply,"registration");
   return;
  }

  const aiReply=await getBhoomiMitraReply(userText);

  await sendWhatsAppMessage(from,aiReply);

  await logAI(from,userText,aiReply,"ai_reply");

  await appendSafe(SHEETS.farmerQueries,[
   new Date().toISOString(),
   from,
   userText,
   aiReply,
   "Open"
  ]);

 }catch(error){
  console.error("Webhook error:");
  console.error(
   error.response && error.response.data
   ? error.response.data
   : error.message
  );
 }
});

async function handleRegistration(from,text){
 const lower=text.toLowerCase();

 if(
  lower.includes("register") ||
  lower.includes("registration") ||
  lower.includes("farmer registration") ||
  lower.includes("രജിസ്റ്റർ") ||
  lower.includes("രജിസ്ട്രേഷൻ") ||
  lower.includes("പേര് ചേർക്ക")
 ){
  sessions[from]={
   type:"farmer",
   step:"name",
   data:{
    whatsapp:from
   }
  };

  return "കർഷക രജിസ്ട്രേഷൻ തുടങ്ങാം. നിങ്ങളുടെ പേര് മാത്രം അയക്കൂ.";
 }

 if(!sessions[from]){
  return null;
 }

 const session=sessions[from];

 if(session.type==="farmer"){
  if(session.step==="name"){
   session.data.name=text;
   session.step="district";
   return "ജില്ല ഏതാണ്?";
  }

  if(session.step==="district"){
   session.data.district=text;
   session.step="panchayath";
   return "പഞ്ചായത്ത് ഏതാണ്?";
  }

  if(session.step==="panchayath"){
   session.data.panchayath=text;
   session.step="main_crop";
   return "പ്രധാന കൃഷി / വിള ഏതാണ്?";
  }

  if(session.step==="main_crop"){
   session.data.mainCrop=text;

   await saveFarmer(session.data);

   delete sessions[from];

   return "നന്ദി. നിങ്ങളുടെ കർഷക രജിസ്ട്രേഷൻ BhoomiMitra ഡാറ്റാബേസിൽ സേവ് ചെയ്തു. ഇനി കൃഷിയുമായി ബന്ധപ്പെട്ട സംശയം ചോദിക്കാം.";
  }
 }

 return null;
}
async function saveFarmer(data){
 const bmId="BM-"+Date.now();

 await appendSafe(SHEETS.farmers,[
  bmId,
  data.name || "",
  "",
  "",
  data.whatsapp || "",
  "",
  data.district || "",
  "",
  data.panchayath || "",
  "",
  "",
  "",
  data.mainCrop || "",
  "WhatsApp Registration",
  new Date().toISOString()
 ]);
}

async function getBhoomiMitraReply(userText){
 try{
  const completion=await openai.chat.completions.create({
   model:OPENAI_MODEL,
   messages:[
    {role:"system",content:SYSTEM_PROMPT},
    {role:"user",content:userText}
   ]
  });

  const reply=
   completion &&
   completion.choices &&
   completion.choices[0] &&
   completion.choices[0].message &&
   completion.choices[0].message.content
   ? completion.choices[0].message.content
   : "ക്ഷമിക്കണം, ഇപ്പോൾ മറുപടി നൽകാൻ കഴിഞ്ഞില്ല. വീണ്ടും ശ്രമിക്കുക.";

  return limitWhatsAppText(reply);

 }catch(error){
  console.error("OpenAI error:");
  console.error(error.response && error.response.data ? error.response.data : error.message);
  return "ക്ഷമിക്കണം, ഇപ്പോൾ BhoomiMitra മറുപടി നൽകാൻ കഴിഞ്ഞില്ല. കുറച്ച് കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക.";
 }
}

async function sendWhatsAppMessage(to,text){
 const url="https://graph.facebook.com/v25.0/"+PHONE_NUMBER_ID+"/messages";

 await axios.post(
  url,
  {
   messaging_product:"whatsapp",
   recipient_type:"individual",
   to:to,
   type:"text",
   text:{
    preview_url:false,
    body:limitWhatsAppText(text)
   }
  },
  {
   headers:{
    Authorization:"Bearer "+WHATSAPP_TOKEN,
    "Content-Type":"application/json"
   }
  }
 );
}

async function appendSafe(sheetName,row){
 try{
  if(!GOOGLE_SHEET_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY){
   console.log("Google Sheets credentials missing. Skipping append.");
   return;
  }

  await sheets.spreadsheets.values.append({
   spreadsheetId:GOOGLE_SHEET_ID,
   range:sheetName+"!A:Z",
   valueInputOption:"USER_ENTERED",
   requestBody:{
    values:[row]
   }
  });

 }catch(error){
  console.error("Google Sheet append error for sheet: "+sheetName);
  console.error(error.response && error.response.data ? error.response.data : error.message);
 }
}

async function logAI(from,userText,reply,type){
 await appendSafe(SHEETS.aiLog,[
  new Date().toISOString(),
  from,
  type,
  userText,
  reply
 ]);

 await appendSafe(SHEETS.conversation,[
  new Date().toISOString(),
  from,
  reply,
  "outgoing"
 ]);
}

function limitWhatsAppText(text){
 if(!text){
  return "ക്ഷമിക്കണം, മറുപടി നൽകാൻ കഴിഞ്ഞില്ല.";
 }

 const cleanText=String(text).trim();

 if(cleanText.length<=3500){
  return cleanText;
 }

 return cleanText.substring(0,3400)+"\n\nമറുപടി ചുരുക്കി നൽകി. കൂടുതൽ വിവരങ്ങൾക്ക് തുടർചോദ്യം ചോദിക്കാം.";
}

app.listen(PORT,"0.0.0.0",function(){
 console.log("Server running on port "+PORT);
});
