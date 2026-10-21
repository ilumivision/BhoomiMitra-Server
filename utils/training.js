"use strict";

const crypto = require("crypto");

const TRAINING_PROGRAM_SHEET = "Training_Events_";
const TRAINING_REGISTRATION_SHEET = "Service_Request";
const TRAINING_REQUEST_SHEET = "Training_Requests";

const TRAINING_COORDINATION = Object.freeze({
  OVERALL: "Dr. Sindhu Sadanandan – KVK Administration",
  TRAINING: "Sri Binu John – Training Coordination"
});

const trainingRequestSubmissions = new Map();

const TRAINING_ACTION_IDS = Object.freeze({
  OPEN: "HOME_TRAINING",
  UPCOMING: "TRAINING_UPCOMING",
  CROP_PRODUCTION: "TRAINING_CAT_CROP",
  HORTICULTURE: "TRAINING_CAT_HORTICULTURE",
  ANIMAL_HUSBANDRY: "TRAINING_CAT_ANIMAL",
  ENTREPRENEURSHIP: "TRAINING_CAT_ENTREPRENEURSHIP",
  PLANT_PROTECTION: "TRAINING_CAT_PROTECTION",
  VALUE_ADDITION: "TRAINING_CAT_VALUE",
  FARM_MACHINERY: "TRAINING_CAT_MACHINERY",
  ALL: "TRAINING_ALL",
  PROMOTED: "TRAINING_PROMOTED",
  MY_TRAININGS: "TRAINING_MY",
  REQUEST_START: "TRAINING_REQUEST_START",
  REQUEST_MODE_ONLINE: "TRAINING_MODE_ONLINE",
  REQUEST_MODE_OFFLINE: "TRAINING_MODE_OFFLINE",
  REQUEST_MODE_EITHER: "TRAINING_MODE_EITHER",
  REQUEST_TIME_AFTERNOON: "TRAINING_TIME_2_5",
  REQUEST_TIME_EVENING: "TRAINING_TIME_7_10",
  REQUEST_TIME_EITHER: "TRAINING_TIME_EITHER",
  REQUEST_DATE_SPECIFIC: "TRAINING_DATE_SPECIFIC",
  REQUEST_DATE_ANY: "TRAINING_DATE_ANY",
  REQUEST_SUBMIT: "TRAINING_REQUEST_SUBMIT",
  REQUEST_CHANGE: "TRAINING_REQUEST_CHANGE",
  REQUEST_CANCEL: "TRAINING_REQUEST_CANCEL",
  MY_REQUESTS: "TRAINING_MY_REQUESTS",
  INFORMATION: "TRAINING_INFORMATION",
  MORE: "TRAINING_MORE",
  MAIN_MENU: "TRAINING_HOME"
});

const TRAINING_DYNAMIC_PREFIXES = Object.freeze({
  VIEW: "TRAINING_VIEW:",
  PROMOTED_VIEW: "TRAINING_PROMOTED_VIEW:",
  DETAILS: "TRAINING_DETAILS:",
  REGISTER: "TRAINING_REGISTER:"
});

const TRAINING_MODES = Object.freeze({
  ONLINE: "Online",
  OFFLINE: "Offline / In-person",
  EITHER: "Either"
});

const TRAINING_TIMES = Object.freeze({
  AFTERNOON: "2:00–5:00 PM",
  EVENING: "7:00–10:00 PM",
  EITHER: "Either",
  NOT_APPLICABLE: "Not applicable"
});

const TRAINING_DATES = Object.freeze({
  SPECIFIC: "Specific date",
  ANY: "Any convenient date"
});

function clean(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeHeader(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function makeHeaderMap(headers) {
  const map = Object.create(null);

  (headers || []).forEach(function (header, index) {
    const key = normalizeHeader(header);

    if (key && map[key] === undefined) {
      map[key] = index;
    }
  });

  return map;
}

function getValue(row, headerMap, aliases) {
  for (const alias of aliases || []) {
    const index = headerMap[normalizeHeader(alias)];

    if (index !== undefined) {
      return row && row[index] != null ? row[index] : "";
    }
  }

  return "";
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 86400000);
  }

  const text = clean(value);

  if (!text) {
    return null;
  }

  const dayFirst = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);

  if (dayFirst) {
    const date = new Date(
      Number(dayFirst[3]),
      Number(dayFirst[2]) - 1,
      Number(dayFirst[1])
    );

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const timestamp = Date.parse(text);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

function startOfDay(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isUpcoming(program, now) {
  const status = clean(program && program.status).toLowerCase();

  if (/closed|completed|cancelled|canceled|past/.test(status)) {
    return false;
  }

  const date = parseDate(program && program.date);

  if (!date) {
    return /^(?:upcoming|open|active)$/i.test(clean(program && program.status));
  }

  return startOfDay(date).getTime() >= startOfDay(now || new Date()).getTime();
}

function readTrainingPrograms(sheetRows) {
  const rows = Array.isArray(sheetRows) ? sheetRows : [];
  const headers = rows[0] || [];
  const headerMap = makeHeaderMap(headers);

  return rows.slice(1).map(function (row, index) {
    return {
      rowNumber: index + 2,
      id: clean(getValue(row, headerMap, ["Event_ID", "Training_ID", "Programme_ID", "ID"])),
      title: clean(getValue(row, headerMap, ["Event_Name", "Training_Title", "Programme", "Title"])),
      date: clean(getValue(row, headerMap, ["Date", "Training_Date", "Event_Date"])),
      time: clean(getValue(row, headerMap, ["Time", "Training_Time", "Event_Time"])),
      venue: clean(getValue(row, headerMap, ["Venue", "Location", "Mode"])),
      mode: clean(getValue(row, headerMap, ["Mode", "Training_Mode", "Delivery_Mode"])),
      district: clean(getValue(row, headerMap, ["District"])),
      organizer: clean(getValue(row, headerMap, ["Organizer", "Organisation", "Organization"])),
      category: clean(getValue(row, headerMap, ["category", "Category", "Subject", "Topic"])),
      status: clean(getValue(row, headerMap, ["Status", "Availability"])),
      audience: clean(getValue(row, headerMap, ["Who_Can_Attend", "Target_Audience", "Audience"])),
      coordinator: clean(getValue(row, headerMap, ["Coordinator", "Contact_Person"])),
      contact: clean(getValue(row, headerMap, ["Contact", "Mobile", "Phone", "WhatsApp"])),
      fee: clean(getValue(row, headerMap, ["Fee", "Registration_Fee", "Training_Fee"])),
      promotion: clean(getValue(row, headerMap, [
        "Promoted",
        "Featured",
        "Promotion",
        "Is_Promoted",
        "Promotion_Status",
        "Priority"
      ])),
      seats: clean(getValue(row, headerMap, ["Seats", "Available_Seats", "Seats_Available"])),
      deadline: clean(getValue(row, headerMap, ["Registration_Deadline", "Closing_Date", "Last_Date"])),
      headers: headers,
      row: row
    };
  }).filter(function (program) {
    return Boolean(program.id && program.title);
  });
}

function findTrainingProgram(sheetRows, programId) {
  const target = clean(programId).toUpperCase();

  return readTrainingPrograms(sheetRows).find(function (program) {
    return program.id.toUpperCase() === target;
  }) || null;
}

function normalizedCategory(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function categoryMatches(programCategory, filter) {
  const category = normalizedCategory(programCategory);
  const knownPatterns = [
    /crop|agronomy|production/,
    /horticulture|fruit|vegetable|floriculture/,
    /animal|livestock|dairy|poultry|veterinary/,
    /plant protection|pest|disease|entomology|pathology/,
    /value addition|processing|post harvest|food/,
    /machinery|mechanization|mechanisation|equipment/,
    /entrepreneur|enterprise|business|startup|self employment/
  ];
  const patternsByFilter = {
    CROP_PRODUCTION: knownPatterns[0],
    HORTICULTURE: knownPatterns[1],
    ANIMAL_HUSBANDRY: knownPatterns[2],
    PLANT_PROTECTION: knownPatterns[3],
    VALUE_ADDITION: knownPatterns[4],
    FARM_MACHINERY: knownPatterns[5],
    ENTREPRENEURSHIP: knownPatterns[6]
  };

  if (filter === "ALL" || filter === "UPCOMING") {
    return true;
  }

  if (filter === "OTHER") {
    return !knownPatterns.some(function (pattern) {
      return pattern.test(category);
    });
  }

  return patternsByFilter[filter]
    ? patternsByFilter[filter].test(category)
    : true;
}

function filterTrainingPrograms(programs, filter, now) {
  return (programs || [])
    .filter(function (program) {
      return isUpcoming(program, now) && categoryMatches(program.category, filter);
    })
    .sort(function (left, right) {
      const leftDate = parseDate(left.date);
      const rightDate = parseDate(right.date);

      if (!leftDate && !rightDate) return 0;
      if (!leftDate) return 1;
      if (!rightDate) return -1;
      return leftDate.getTime() - rightDate.getTime();
    });
}

function isPromotedTraining(program) {
  const value = [program && program.promotion, program && program.status]
    .map(clean)
    .join(" ")
    .toLowerCase();

  return /(?:^|\s)(?:yes|true|promoted|featured|priority)(?:\s|$)/.test(value);
}

function getPromotedTrainingPrograms(programs, now, maximum) {
  const limit = Math.max(0, Math.min(Number(maximum) || 5, 5));

  return (programs || [])
    .filter(function (program) {
      return isUpcoming(program, now);
    })
    .sort(function (left, right) {
      const promotionDifference =
        Number(isPromotedTraining(right)) - Number(isPromotedTraining(left));

      if (promotionDifference) return promotionDifference;

      const leftDate = parseDate(left.date);
      const rightDate = parseDate(right.date);
      const dateDifference =
        (leftDate ? leftDate.getTime() : Number.MAX_SAFE_INTEGER) -
        (rightDate ? rightDate.getTime() : Number.MAX_SAFE_INTEGER);

      if (dateDifference) return dateDifference;

      const titleDifference = clean(left.title).localeCompare(clean(right.title));
      return titleDifference || clean(left.id).localeCompare(clean(right.id));
    })
    .slice(0, limit);
}

function parseTrainingAction(selectionId) {
  const id = clean(selectionId);
  const fixed = {};

  fixed[TRAINING_ACTION_IDS.OPEN] = { action: "OPEN" };
  fixed[TRAINING_ACTION_IDS.UPCOMING] = { action: "LIST", filter: "UPCOMING" };
  fixed[TRAINING_ACTION_IDS.CROP_PRODUCTION] = { action: "LIST", filter: "CROP_PRODUCTION" };
  fixed[TRAINING_ACTION_IDS.HORTICULTURE] = { action: "LIST", filter: "HORTICULTURE" };
  fixed[TRAINING_ACTION_IDS.ANIMAL_HUSBANDRY] = { action: "LIST", filter: "ANIMAL_HUSBANDRY" };
  fixed[TRAINING_ACTION_IDS.ENTREPRENEURSHIP] = { action: "LIST", filter: "ENTREPRENEURSHIP" };
  fixed[TRAINING_ACTION_IDS.PLANT_PROTECTION] = { action: "LIST", filter: "PLANT_PROTECTION" };
  fixed[TRAINING_ACTION_IDS.VALUE_ADDITION] = { action: "LIST", filter: "VALUE_ADDITION" };
  fixed[TRAINING_ACTION_IDS.FARM_MACHINERY] = { action: "LIST", filter: "FARM_MACHINERY" };
  fixed[TRAINING_ACTION_IDS.ALL] = { action: "LIST", filter: "ALL" };
  fixed[TRAINING_ACTION_IDS.PROMOTED] = { action: "PROMOTED" };
  fixed[TRAINING_ACTION_IDS.MY_TRAININGS] = { action: "MY_TRAININGS" };
  fixed[TRAINING_ACTION_IDS.REQUEST_START] = { action: "REQUEST_START" };
  fixed[TRAINING_ACTION_IDS.REQUEST_MODE_ONLINE] = {
    action: "REQUEST_MODE",
    mode: TRAINING_MODES.ONLINE
  };
  fixed[TRAINING_ACTION_IDS.REQUEST_MODE_OFFLINE] = {
    action: "REQUEST_MODE",
    mode: TRAINING_MODES.OFFLINE
  };
  fixed[TRAINING_ACTION_IDS.REQUEST_MODE_EITHER] = {
    action: "REQUEST_MODE",
    mode: TRAINING_MODES.EITHER
  };
  fixed[TRAINING_ACTION_IDS.REQUEST_TIME_AFTERNOON] = {
    action: "REQUEST_TIME",
    preferredTime: TRAINING_TIMES.AFTERNOON
  };
  fixed[TRAINING_ACTION_IDS.REQUEST_TIME_EVENING] = {
    action: "REQUEST_TIME",
    preferredTime: TRAINING_TIMES.EVENING
  };
  fixed[TRAINING_ACTION_IDS.REQUEST_TIME_EITHER] = {
    action: "REQUEST_TIME",
    preferredTime: TRAINING_TIMES.EITHER
  };
  fixed[TRAINING_ACTION_IDS.REQUEST_DATE_SPECIFIC] = {
    action: "REQUEST_DATE_CHOICE",
    dateChoice: TRAINING_DATES.SPECIFIC
  };
  fixed[TRAINING_ACTION_IDS.REQUEST_DATE_ANY] = {
    action: "REQUEST_DATE_CHOICE",
    dateChoice: TRAINING_DATES.ANY
  };
  fixed[TRAINING_ACTION_IDS.REQUEST_SUBMIT] = { action: "REQUEST_SUBMIT" };
  fixed[TRAINING_ACTION_IDS.REQUEST_CHANGE] = { action: "REQUEST_CHANGE" };
  fixed[TRAINING_ACTION_IDS.REQUEST_CANCEL] = { action: "REQUEST_CANCEL" };
  fixed[TRAINING_ACTION_IDS.MY_REQUESTS] = { action: "MY_REQUESTS" };
  fixed[TRAINING_ACTION_IDS.INFORMATION] = { action: "INFORMATION" };
  fixed[TRAINING_ACTION_IDS.MORE] = { action: "OPEN" };
  fixed[TRAINING_ACTION_IDS.MAIN_MENU] = { action: "MAIN_MENU" };

  if (fixed[id]) {
    return fixed[id];
  }

  if (id.startsWith(TRAINING_DYNAMIC_PREFIXES.VIEW)) {
    const programId = clean(id.slice(TRAINING_DYNAMIC_PREFIXES.VIEW.length));
    return programId ? { action: "VIEW", programId: programId } : null;
  }

  if (id.startsWith(TRAINING_DYNAMIC_PREFIXES.PROMOTED_VIEW)) {
    const programId = clean(id.slice(TRAINING_DYNAMIC_PREFIXES.PROMOTED_VIEW.length));
    return programId ? { action: "PROMOTED_VIEW", programId: programId } : null;
  }

  if (id.startsWith(TRAINING_DYNAMIC_PREFIXES.DETAILS)) {
    const programId = clean(id.slice(TRAINING_DYNAMIC_PREFIXES.DETAILS.length));
    return programId ? { action: "VIEW", programId: programId } : null;
  }

  if (id.startsWith(TRAINING_DYNAMIC_PREFIXES.REGISTER)) {
    const programId = clean(id.slice(TRAINING_DYNAMIC_PREFIXES.REGISTER.length));
    return programId ? { action: "REGISTER", programId: programId } : null;
  }

  return null;
}

function truncate(value, maximumLength) {
  const text = clean(value);
  return text.length <= maximumLength
    ? text
    : text.slice(0, Math.max(0, maximumLength - 1)).trimEnd() + "…";
}

function formatFee(value) {
  const fee = clean(value);

  if (!fee) return "";
  if (/^(?:free|no|nil|0|0\.00)$/i.test(fee)) return "Free";
  if (/^₹/.test(fee)) return fee;
  if (/^\d+(?:\.\d+)?$/.test(fee)) return "₹" + fee;
  return fee;
}

function hasChargeableFee(value) {
  const fee = clean(value);
  return Boolean(fee) && !/^(?:free|no|nil|0|0\.00)$/i.test(fee);
}

function pilotPaymentLines(value, language) {
  const fee = formatFee(value);

  if (!fee) return [];

  const isMalayalam = clean(language).toLowerCase() === "malayalam";
  const lines = [(isMalayalam ? "ഫീസ്: " : "Fee: ") + fee];

  if (hasChargeableFee(value)) {
    lines.push(
      isMalayalam
        ? "BhoomiMitra വഴി പൈലറ്റ് ഘട്ടത്തിൽ പണമടയ്ക്കൽ സ്വീകരിക്കുന്നില്ല."
        : "Payment is not collected through BhoomiMitra during the pilot.",
      isMalayalam
        ? "പരിപാടി സ്ഥിരീകരിച്ചാൽ ആവശ്യമായ പണമടയ്ക്കൽ നിർദ്ദേശങ്ങൾ നിങ്ങളെ അറിയിക്കും."
        : "You will receive payment instructions if/when the programme is confirmed."
    );
  }

  return lines;
}

function registrationAvailability(program, now) {
  const status = clean(program && program.status);
  const normalizedStatus = status.toLowerCase();
  const seats = clean(program && program.seats);

  if (/closed|cancelled|canceled/.test(normalizedStatus)) {
    return { allowed: false, label: status || "Closed", reason: "CLOSED" };
  }

  if (/completed|past/.test(normalizedStatus)) {
    return { allowed: false, label: status || "Completed", reason: "PAST" };
  }

  if (/full|no seats/.test(normalizedStatus) || (seats && Number(seats) === 0)) {
    return { allowed: false, label: "Full", reason: "FULL" };
  }

  const deadline = parseDate(program && program.deadline);

  if (deadline && startOfDay(deadline).getTime() < startOfDay(now || new Date()).getTime()) {
    return { allowed: false, label: "Registration closed", reason: "DEADLINE_PASSED" };
  }

  const eventDate = parseDate(program && program.date);

  if (eventDate && startOfDay(eventDate).getTime() < startOfDay(now || new Date()).getTime()) {
    return { allowed: false, label: "Completed", reason: "PAST" };
  }

  return {
    allowed: true,
    label: status || "Open",
    reason: "OPEN"
  };
}

function buildTrainingListRows(programs, language, options) {
  const input = options || {};
  const isMalayalam = clean(language).toLowerCase() === "malayalam";

  return (programs || []).slice(0, 10).map(function (program) {
    const availability = registrationAvailability(program, input.now);
    const fee = formatFee(program.fee);
    const details = [
      program.date || (isMalayalam ? "തീയതി പിന്നീട്" : "Date TBA"),
      program.venue || (isMalayalam ? "വേദി പിന്നീട്" : "Venue TBA"),
      fee,
      input.myTrainings ? program.registrationStatus : "",
      availability.allowed ? "" : availability.label
    ].filter(Boolean).join(" • ");

    return {
      id: TRAINING_DYNAMIC_PREFIXES.VIEW + program.id,
      title: truncate(program.title, 24),
      description: truncate(details, 72)
    };
  });
}

function buildTrainingDetails(program, language, options) {
  const isMalayalam = clean(language).toLowerCase() === "malayalam";
  const availability = registrationAvailability(program, options && options.now);
  const fee = formatFee(program && program.fee);
  const contact = [program && program.coordinator, program && program.contact]
    .filter(Boolean)
    .join(" — ");
  const lines = isMalayalam
    ? [
        "🎓 പരിശീലന വിവരങ്ങൾ",
        "",
        "പേര്: " + clean(program && program.title),
        "തീയതി: " + (clean(program && program.date) || "ലഭ്യമല്ല"),
        "സമയം: " + (clean(program && program.time) || "ലഭ്യമല്ല"),
        "വേദി: " + (clean(program && program.venue) || "ലഭ്യമല്ല"),
        "രീതി: " + (clean(program && program.mode) || "ലഭ്യമല്ല"),
        "സംഘാടകർ: " + (clean(program && program.organizer) || "ലഭ്യമല്ല"),
        "വിഷയം: " + (clean(program && program.category) || "ലഭ്യമല്ല"),
        "പങ്കെടുക്കാവുന്നവർ: " + (clean(program && program.audience) || "വിവരം ലഭ്യമല്ല")
      ]
    : [
        "🎓 Training Details",
        "",
        "Title: " + clean(program && program.title),
        "Date: " + (clean(program && program.date) || "Not provided"),
        "Time: " + (clean(program && program.time) || "Not provided"),
        "Venue: " + (clean(program && program.venue) || "Not provided"),
        "Mode: " + (clean(program && program.mode) || "Not provided"),
        "Organiser: " + (clean(program && program.organizer) || "Not provided"),
        "Topic: " + (clean(program && program.category) || "Not provided"),
        "Who can attend: " + (clean(program && program.audience) || "Not provided")
      ];

  if (contact) {
    lines.push((isMalayalam ? "കോഓർഡിനേറ്റർ/ബന്ധപ്പെടുക: " : "Coordinator/contact: ") + contact);
  }
  if (fee) lines.push.apply(lines, pilotPaymentLines(program && program.fee, language));
  if (clean(program && program.seats)) {
    lines.push((isMalayalam ? "ലഭ്യമായ സീറ്റുകൾ: " : "Seats/availability: ") + program.seats);
  }
  if (clean(program && program.deadline)) {
    lines.push((isMalayalam ? "രജിസ്ട്രേഷൻ അവസാന തീയതി: " : "Registration deadline: ") + program.deadline);
  }
  if (!availability.allowed) {
    lines.push(
      "",
      (isMalayalam ? "രജിസ്ട്രേഷൻ നില: " : "Registration status: ") + availability.label
    );
  }

  return {
    text: truncate(lines.join("\n"), 1000),
    canRegister: availability.allowed,
    availability: availability
  };
}

function buildPromotedTrainingListRows(programs, language, options) {
  const input = options || {};
  const isMalayalam = clean(language).toLowerCase() === "malayalam";

  return (programs || []).slice(0, 5).map(function (program) {
    const availability = registrationAvailability(program, input.now);
    const details = [
      program.date || (isMalayalam ? "തീയതി പിന്നീട്" : "Date TBA"),
      program.venue || (isMalayalam ? "വേദി പിന്നീട്" : "Venue TBA"),
      availability.label
    ].filter(Boolean).join(" • ");

    return {
      id: TRAINING_DYNAMIC_PREFIXES.PROMOTED_VIEW + program.id,
      title: truncate(program.title, 24),
      description: truncate(details, 72)
    };
  });
}

function buildPromotedTrainingDetails(program, language, options) {
  const isMalayalam = clean(language).toLowerCase() === "malayalam";
  const availability = registrationAvailability(program, options && options.now);
  const lines = [
    isMalayalam ? "⭐ ജനപ്രിയ പരിശീലനം" : "⭐ Popular Training",
    "",
    (isMalayalam ? "പേര്: " : "Title: ") + clean(program && program.title),
    (isMalayalam ? "തീയതി: " : "Date: ") +
      (clean(program && program.date) || (isMalayalam ? "ലഭ്യമല്ല" : "Not provided")),
    (isMalayalam ? "വേദി / രീതി: " : "Venue / mode: ") +
      (clean(program && program.venue) || (isMalayalam ? "ലഭ്യമല്ല" : "Not provided"))
  ];

  lines.push.apply(lines, pilotPaymentLines(program && program.fee, language));
  lines.push(
    (isMalayalam ? "നില: " : "Status: ") + availability.label
  );

  return {
    text: truncate(lines.join("\n"), 1000),
    canRegister: availability.allowed,
    availability: availability
  };
}

function buildRowFromHeaders(headers, valuesByHeader) {
  const normalizedValues = Object.create(null);

  Object.keys(valuesByHeader || {}).forEach(function (header) {
    normalizedValues[normalizeHeader(header)] = valuesByHeader[header];
  });

  return (headers || []).map(function (header) {
    const key = normalizeHeader(header);
    return Object.prototype.hasOwnProperty.call(normalizedValues, key)
      ? normalizedValues[key]
      : "";
  });
}

function requiredRegistrationHeadersPresent(headers) {
  const map = makeHeaderMap(headers);
  const required = [
    "Request_ID",
    "Request_Date",
    "Farmer_ID",
    "Farmer_Name",
    "Mobile_No",
    "Request_Category",
    "Service_Type",
    "Request_Description",
    "Status"
  ];

  return required.every(function (header) {
    return map[normalizeHeader(header)] !== undefined;
  });
}

function requiredTrainingRequestHeadersPresent(headers) {
  const map = makeHeaderMap(headers);
  const required = [
    "Request_ID",
    "Farmer_ID",
    "Mobile_No",
    "Farmer_Name",
    "District",
    "Training_Category",
    "Training_Topic",
    "Preferred_Mode",
    "Preferred_Time",
    "Preferred_Location",
    "Preferred_Date",
    "Remarks",
    "Request_Status",
    "Assigned_Coordinator",
    "Overall_Coordinator",
    "Training_Coordinator",
    "Created_At"
  ];

  return required.every(function (header) {
    return map[normalizeHeader(header)] !== undefined;
  });
}

function inferTrainingCategory(topic) {
  const value = normalizeTrainingRequestTopic(topic).toLowerCase();

  if (/animal|livestock|dairy|cattle|goat|poultry|veterinary|fish|fishery/.test(value)) {
    return "Animal Husbandry Training";
  }
  if (/value addition|processing|preserv|packag|post harvest|food product/.test(value)) {
    return "Value Addition Training";
  }
  if (/entrepreneur|enterprise|business|startup|marketing|self employment/.test(value)) {
    return "Agricultural Entrepreneurship Training";
  }
  if (/crop|cultivat|production|plant|soil|seed|nursery|orchard|fruit|vegetable|mushroom|pest|disease|prun/.test(value)) {
    return "Crop Production Training";
  }

  return "Other / Farmer requested";
}

function normalizeTrainingRequestTopic(value) {
  return clean(value).replace(/\s+/g, " ").slice(0, 500);
}

function trainingRequestSheetValue(value) {
  const topic = normalizeTrainingRequestTopic(value);
  return /^[=+\-@]/.test(topic) ? "'" + topic : topic;
}

function createTrainingRequestSession(farmer, language, now) {
  return {
    step: "awaiting_request",
    farmer: farmer || {},
    language: clean(language) || "English",
    topic: "",
    inputType: "",
    mode: "",
    preferredTime: "",
    preferredLocation: "",
    preferredDate: "",
    remarks: "",
    updatedAt: now instanceof Date ? now.getTime() : Date.now()
  };
}

function captureTrainingRequest(session, topic, inputType, now) {
  const normalizedTopic = normalizeTrainingRequestTopic(topic);

  if (!session || !normalizedTopic) {
    return { success: false, code: "REQUEST_REQUIRED", session: session || null };
  }

  const updated = Object.assign({}, session, {
    step: "awaiting_mode",
    topic: normalizedTopic,
    inputType: clean(inputType) || "text",
    updatedAt: now instanceof Date ? now.getTime() : Date.now()
  });

  return { success: true, session: updated, topic: normalizedTopic };
}

function selectTrainingRequestMode(session, mode, now) {
  const normalizedMode = Object.values(TRAINING_MODES).find(function (item) {
    return item.toLowerCase() === clean(mode).toLowerCase();
  });

  if (!session || session.step !== "awaiting_mode" || !normalizedMode) {
    return { success: false, code: "INVALID_MODE", session: session || null };
  }

  const online = normalizedMode === TRAINING_MODES.ONLINE;
  const updated = Object.assign({}, session, {
    step: online ? "awaiting_time" : "awaiting_date_choice",
    mode: normalizedMode,
    preferredTime: online ? "" : TRAINING_TIMES.NOT_APPLICABLE,
    updatedAt: now instanceof Date ? now.getTime() : Date.now()
  });

  return { success: true, session: updated };
}

function selectTrainingRequestTime(session, preferredTime, now) {
  const allowed = [
    TRAINING_TIMES.AFTERNOON,
    TRAINING_TIMES.EVENING,
    TRAINING_TIMES.EITHER
  ];
  const normalizedTime = allowed.find(function (item) {
    return item.toLowerCase() === clean(preferredTime).toLowerCase();
  });

  if (
    !session ||
    session.step !== "awaiting_time" ||
    session.mode !== TRAINING_MODES.ONLINE ||
    !normalizedTime
  ) {
    return { success: false, code: "INVALID_TIME", session: session || null };
  }

  return {
    success: true,
    session: Object.assign({}, session, {
      step: "awaiting_date_choice",
      preferredTime: normalizedTime,
      updatedAt: now instanceof Date ? now.getTime() : Date.now()
    })
  };
}

function trainingRequestNeedsLocation(session) {
  return Boolean(session && session.mode === TRAINING_MODES.OFFLINE);
}

function selectTrainingRequestDateChoice(session, dateChoice, now) {
  const normalizedChoice = Object.values(TRAINING_DATES).find(function (item) {
    return item.toLowerCase() === clean(dateChoice).toLowerCase();
  });

  if (!session || session.step !== "awaiting_date_choice" || !normalizedChoice) {
    return { success: false, code: "INVALID_DATE_CHOICE", session: session || null };
  }

  const specific = normalizedChoice === TRAINING_DATES.SPECIFIC;
  return {
    success: true,
    session: Object.assign({}, session, {
      step: specific
        ? "awaiting_date"
        : (trainingRequestNeedsLocation(session) ? "awaiting_location" : "awaiting_confirmation"),
      preferredDate: specific ? "" : TRAINING_DATES.ANY,
      updatedAt: now instanceof Date ? now.getTime() : Date.now()
    })
  };
}

function optionalTrainingRequestValue(value, maximum) {
  const text = clean(value);
  if (/^(?:skip|none|n\/a|not applicable|ഒഴിവാക്കുക|വേണ്ട)$/i.test(text)) {
    return "";
  }
  return trainingRequestSheetValue(text).slice(0, maximum || 300);
}

function captureTrainingRequestLocation(session, value, now) {
  if (!session || session.step !== "awaiting_location") {
    return { success: false, code: "INVALID_LOCATION_STATE", session: session || null };
  }
  return {
    success: true,
    session: Object.assign({}, session, {
      step: "awaiting_confirmation",
      preferredLocation: optionalTrainingRequestValue(value, 200),
      updatedAt: now instanceof Date ? now.getTime() : Date.now()
    })
  };
}

function captureTrainingRequestDate(session, value, now) {
  if (!session || session.step !== "awaiting_date") {
    return { success: false, code: "INVALID_DATE_STATE", session: session || null };
  }
  return {
    success: true,
    session: Object.assign({}, session, {
      step: trainingRequestNeedsLocation(session)
        ? "awaiting_location"
        : "awaiting_confirmation",
      preferredDate: optionalTrainingRequestValue(value, 100),
      updatedAt: now instanceof Date ? now.getTime() : Date.now()
    })
  };
}

function isTrainingRequestCancellation(value) {
  return /^cancel$/i.test(clean(value));
}

function captureTrainingRequestRemarks(session, value, now) {
  if (!session || session.step !== "awaiting_remarks") {
    return { success: false, code: "INVALID_REMARKS_STATE", session: session || null };
  }
  return {
    success: true,
    session: Object.assign({}, session, {
      step: "awaiting_confirmation",
      remarks: optionalTrainingRequestValue(value, 500),
      updatedAt: now instanceof Date ? now.getTime() : Date.now()
    })
  };
}

function changeTrainingRequest(session, now) {
  if (!session) {
    return null;
  }

  return Object.assign({}, session, {
    step: "awaiting_request",
    topic: "",
    inputType: "",
    mode: "",
    preferredTime: "",
    preferredLocation: "",
    preferredDate: "",
    remarks: "",
    updatedAt: now instanceof Date ? now.getTime() : Date.now()
  });
}

function formatTrainingRequestRemarks(mode, preferredTime) {
  const normalizedMode = clean(mode) || TRAINING_MODES.EITHER;
  const normalizedTime = normalizedMode === TRAINING_MODES.ONLINE
    ? (clean(preferredTime) || TRAINING_TIMES.EITHER)
    : TRAINING_TIMES.NOT_APPLICABLE;

  return [
    "WhatsApp farmer-requested training",
    "Training Mode: " + normalizedMode,
    "Preferred Time: " + normalizedTime
  ].join("\n");
}

function parseTrainingRequestPreferences(remarks) {
  const text = clean(remarks);
  const modeMatch = text.match(/(?:^|\n)Training Mode:\s*([^\n]+)/i);
  const timeMatch = text.match(/(?:^|\n)Preferred Time:\s*([^\n]+)/i);

  return {
    mode: modeMatch ? clean(modeMatch[1]) : "",
    preferredTime: timeMatch ? clean(timeMatch[1]) : ""
  };
}

function trainingRequestId(sourceMessageId) {
  const source = clean(sourceMessageId);

  if (!source) {
    return "BM-TRQ-" + crypto.randomUUID().toUpperCase();
  }

  return "BM-TRQ-" + crypto
    .createHash("sha256")
    .update(source)
    .digest("hex")
    .slice(0, 20)
    .toUpperCase();
}

function readTrainingRequests(registrationRows, farmerId) {
  const rows = Array.isArray(registrationRows) ? registrationRows : [];
  const headers = rows[0] || [];
  const headerMap = makeHeaderMap(headers);
  const targetFarmer = clean(farmerId).toUpperCase();
  const isDedicatedSheet =
    headerMap[normalizeHeader("Training_Topic")] !== undefined;

  return rows.slice(1).filter(function (row) {
    return (
      clean(getValue(row, headerMap, ["Farmer_ID"])).toUpperCase() === targetFarmer &&
      (
        isDedicatedSheet ||
        clean(getValue(row, headerMap, ["Request_Category"])).toLowerCase() === "training request"
      )
    );
  }).map(function (row) {
    const preferences = parseTrainingRequestPreferences(
      getValue(row, headerMap, ["Remarks"])
    );

    return {
      requestId: clean(getValue(row, headerMap, ["Request_ID"])),
      requestedAt: clean(getValue(row, headerMap, ["Created_At", "Request_Date"])),
      topic: clean(getValue(row, headerMap, ["Training_Topic", "Request_Description"])),
      status: clean(getValue(row, headerMap, ["Request_Status", "Status"])) || "Requested",
      mode: clean(getValue(row, headerMap, ["Preferred_Mode"])) || preferences.mode,
      preferredTime: clean(getValue(row, headerMap, ["Preferred_Time"])) || preferences.preferredTime,
      category: clean(getValue(row, headerMap, ["Training_Category"])),
      preferredLocation: clean(getValue(row, headerMap, ["Preferred_Location"])),
      preferredDate: clean(getValue(row, headerMap, ["Preferred_Date"])),
      remarks: clean(getValue(row, headerMap, ["Remarks"])),
      assignedCoordinator: clean(getValue(row, headerMap, ["Assigned_Coordinator"])),
      confirmedTrainingId: clean(getValue(row, headerMap, ["Confirmed_Training_ID"])),
      confirmedTrainingTitle: clean(getValue(row, headerMap, ["Confirmed_Training_Title"])),
      confirmedDate: clean(getValue(row, headerMap, ["Confirmed_Date"])),
      confirmedLocation: clean(getValue(row, headerMap, ["Confirmed_Location"]))
    };
  }).sort(function (left, right) {
    const leftTime = Date.parse(left.requestedAt) || 0;
    const rightTime = Date.parse(right.requestedAt) || 0;
    return rightTime - leftTime;
  });
}

async function submitTrainingRequest(options) {
  const input = options || {};
  const farmer = input.farmer || {};
  const topic = normalizeTrainingRequestTopic(input.topic);
  const mode = clean(input.mode) || TRAINING_MODES.EITHER;
  const preferredTime = mode === TRAINING_MODES.ONLINE
    ? clean(input.preferredTime)
    : TRAINING_TIMES.NOT_APPLICABLE;
  const preferredLocation = optionalTrainingRequestValue(
    input.preferredLocation,
    200
  );
  const preferredDate = optionalTrainingRequestValue(
    input.preferredDate,
    100
  );
  const remarks = optionalTrainingRequestValue(input.remarks, 500);
  const category = optionalTrainingRequestValue(
    input.category || inferTrainingCategory(topic),
    150
  );
  const assignedCoordinator = optionalTrainingRequestValue(
    input.programCoordinator || input.assignedCoordinator || TRAINING_COORDINATION.TRAINING,
    150
  );

  if (!clean(farmer.memberId)) {
    return { success: false, code: "FARMER_REQUIRED" };
  }

  if (!topic) {
    return { success: false, code: "REQUEST_REQUIRED" };
  }

  if (!Object.values(TRAINING_MODES).includes(mode)) {
    return { success: false, code: "INVALID_MODE" };
  }

  if (
    mode === TRAINING_MODES.ONLINE &&
    ![
      TRAINING_TIMES.AFTERNOON,
      TRAINING_TIMES.EVENING,
      TRAINING_TIMES.EITHER
    ].includes(preferredTime)
  ) {
    return { success: false, code: "TIME_REQUIRED" };
  }

  const rows = Array.isArray(input.requestRows)
    ? input.requestRows
    : Array.isArray(input.registrationRows)
      ? input.registrationRows
    : [];
  const headers = rows[0] || [];

  if (!requiredTrainingRequestHeadersPresent(headers)) {
    return { success: false, code: "TRAINING_REQUEST_SCHEMA_UNAVAILABLE" };
  }

  const requestId = trainingRequestId(input.sourceMessageId);
  const headerMap = makeHeaderMap(headers);
  const duplicate = rows.slice(1).find(function (row) {
    return clean(getValue(row, headerMap, ["Request_ID"])).toUpperCase() === requestId;
  });

  if (duplicate) {
    return {
      success: true,
      duplicate: true,
      requestId: requestId,
      topic: topic,
      mode: mode,
      preferredTime: preferredTime,
      category: category,
      assignedCoordinator: assignedCoordinator
    };
  }

  const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
  const row = buildRowFromHeaders(headers, {
    Request_ID: requestId,
    Farmer_ID: farmer.memberId,
    Mobile_No: farmer.whatsapp || farmer.mobile || input.farmerWhatsApp || "",
    Farmer_Name: farmer.name || "",
    District: farmer.district || "",
    Training_Category: category,
    Training_Topic: trainingRequestSheetValue(topic),
    Preferred_Mode: mode,
    Preferred_Time: preferredTime,
    Preferred_Location: preferredLocation,
    Preferred_Date: preferredDate,
    Remarks: remarks,
    Request_Status: "Requested",
    Assigned_Coordinator: assignedCoordinator,
    Created_At: now.toISOString(),
    Updated_At: now.toISOString(),
    Overall_Coordinator: TRAINING_COORDINATION.OVERALL,
    Training_Coordinator: TRAINING_COORDINATION.TRAINING,
    Source_Message_ID: clean(input.sourceMessageId)
  });
  if (trainingRequestSubmissions.has(requestId)) {
    const pendingResult = await trainingRequestSubmissions.get(requestId);
    return pendingResult && pendingResult.success
      ? Object.assign({}, pendingResult, { duplicate: true })
      : pendingResult;
  }

  const submission = (async function () {
    const appendResult = await input.appendRegistration(
      TRAINING_REQUEST_SHEET,
      row
    );
    const appended = appendResult === true ||
      Boolean(appendResult && appendResult.success === true);

    return appended ? {
        success: true,
        duplicate: false,
        requestId: requestId,
        topic: topic,
        mode: mode,
        preferredTime: preferredTime,
        preferredLocation: preferredLocation,
        preferredDate: preferredDate,
        remarks: remarks,
        category: category,
        assignedCoordinator: assignedCoordinator,
        row: row
      } : { success: false, code: "REQUEST_SAVE_FAILED", topic: topic };
  })();

  trainingRequestSubmissions.set(requestId, submission);
  try {
    return await submission;
  } finally {
    trainingRequestSubmissions.delete(requestId);
  }
}

function buildTrainingRequestAlert(farmer, topic, mode, preferredTime) {
  const profile = farmer || {};

  return [
    "🎓 New Training Request",
    "",
    "Farmer: " + (clean(profile.name) || "Not provided"),
    "Panchayat: " + (clean(profile.panchayath) || "Not provided"),
    "Training requested:",
    normalizeTrainingRequestTopic(topic),
    "Mode: " + (clean(mode) || TRAINING_MODES.EITHER),
    "Preferred time: " + (clean(preferredTime) || TRAINING_TIMES.NOT_APPLICABLE)
  ].join("\n");
}

function resolveTrainingAlertDestination(value) {
  const destination = clean(value).replace(/\D/g, "");
  return /^\d{10,15}$/.test(destination) ? destination : "";
}

async function sendTrainingRequestAlert(options) {
  const input = options || {};
  const destination = resolveTrainingAlertDestination(input.destination);

  if (!destination || typeof input.sendAlert !== "function") {
    return { sent: false, code: "NOT_CONFIGURED" };
  }

  try {
    const sendResult = await input.sendAlert(
      destination,
      buildTrainingRequestAlert(
        input.farmer,
        input.topic,
        input.mode,
        input.preferredTime
      )
    );

    if (
      sendResult === false ||
      (sendResult && sendResult.accepted === false)
    ) {
      return { sent: false, code: "ALERT_FAILED" };
    }

    return { sent: true, destination: destination };
  } catch (error) {
    return { sent: false, code: "ALERT_FAILED", error: error };
  }
}

async function sendTrainingRequestAlertForSubmission(options) {
  const input = options || {};
  const requestResult = input.requestResult;

  if (!requestResult || requestResult.success !== true) {
    return { sent: false, code: "REQUEST_NOT_SAVED" };
  }

  if (requestResult.duplicate === true) {
    return { sent: false, code: "DUPLICATE_REQUEST" };
  }

  return sendTrainingRequestAlert({
    destination: input.destination,
    farmer: input.farmer,
    topic: requestResult.topic || input.topic,
    mode: requestResult.mode || input.mode,
    preferredTime: requestResult.preferredTime || input.preferredTime,
    sendAlert: input.sendAlert
  });
}

function findTrainingRegistration(registrationRows, farmerId, programId) {
  const rows = Array.isArray(registrationRows) ? registrationRows : [];
  const headers = rows[0] || [];
  const headerMap = makeHeaderMap(headers);
  const targetFarmer = clean(farmerId).toUpperCase();
  const targetProgram = clean(programId).toUpperCase();

  return rows.slice(1).find(function (row) {
    return (
      clean(getValue(row, headerMap, ["Farmer_ID"])).toUpperCase() === targetFarmer &&
      clean(getValue(row, headerMap, ["Request_Category"])).toLowerCase() === "training" &&
      clean(getValue(row, headerMap, ["Service_Type"])).toUpperCase() === targetProgram
    );
  }) || null;
}

async function registerFarmerForTraining(options) {
  const input = options || {};
  const program = findTrainingProgram(input.programRows, input.programId);

  if (!program) {
    return { success: false, code: "INVALID_PROGRAM" };
  }

  const availability = registrationAvailability(program, input.now);

  if (!availability.allowed) {
    return {
      success: false,
      code: availability.reason,
      program: program,
      availability: availability
    };
  }

  const farmer = input.farmer || {};

  if (!clean(farmer.memberId)) {
    return { success: false, code: "FARMER_REQUIRED", program: program };
  }

  if (findTrainingRegistration(input.registrationRows, farmer.memberId, program.id)) {
    return { success: true, duplicate: true, program: program };
  }

  const headers = input.registrationRows && input.registrationRows[0]
    ? input.registrationRows[0]
    : [];

  if (!requiredRegistrationHeadersPresent(headers)) {
    return { success: false, code: "REGISTRATION_SCHEMA_UNAVAILABLE", program: program };
  }

  const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
  const requestId = "BM-TR-" + crypto.randomUUID().toUpperCase();
  const row = buildRowFromHeaders(headers, {
    Request_ID: requestId,
    Request_Date: now.toISOString(),
    BM_ID: farmer.memberId,
    Farmer_ID: farmer.memberId,
    Farmer_Name: farmer.name || "",
    Mobile_No: farmer.whatsapp || farmer.mobile || input.farmerWhatsApp || "",
    District: farmer.district || "",
    Panchayath: farmer.panchayath || "",
    Request_Category: "Training",
    Service_Type: program.id,
    Request_Description: program.title,
    Priority: "Normal",
    Preferred_Date: program.date,
    Assigned_To_Name:
      program.coordinator ||
      program.organizer ||
      TRAINING_COORDINATION.TRAINING,
    Status: "Registered",
    "Service Fee": program.fee || "",
    Remarks: "WhatsApp training registration"
  });
  const appendResult = await input.appendRegistration(
    TRAINING_REGISTRATION_SHEET,
    row
  );
  const appended = appendResult === true ||
    Boolean(appendResult && appendResult.success === true);

  return appended
    ? { success: true, duplicate: false, program: program, requestId: requestId }
    : { success: false, code: "REGISTRATION_SAVE_FAILED", program: program };
}

function getMyTrainings(programRows, registrationRows, farmerId) {
  const programs = readTrainingPrograms(programRows);
  const programById = Object.create(null);
  programs.forEach(function (program) {
    programById[program.id.toUpperCase()] = program;
  });

  const rows = Array.isArray(registrationRows) ? registrationRows : [];
  const headers = rows[0] || [];
  const headerMap = makeHeaderMap(headers);
  const targetFarmer = clean(farmerId).toUpperCase();

  return rows.slice(1).filter(function (row) {
    return (
      clean(getValue(row, headerMap, ["Farmer_ID"])).toUpperCase() === targetFarmer &&
      clean(getValue(row, headerMap, ["Request_Category"])).toLowerCase() === "training"
    );
  }).map(function (row) {
    const programId = clean(getValue(row, headerMap, ["Service_Type"]));
    const program = programById[programId.toUpperCase()] || {
      id: programId,
      title: clean(getValue(row, headerMap, ["Request_Description"])) || "Training programme",
      date: clean(getValue(row, headerMap, ["Preferred_Date"])),
      venue: "",
      category: "Training",
      status: ""
    };

    return Object.assign({}, program, {
      registrationStatus:
        clean(getValue(row, headerMap, ["Status"])) || "Registered"
    });
  });
}

module.exports = {
  TRAINING_ACTION_IDS,
  TRAINING_DYNAMIC_PREFIXES,
  TRAINING_MODES,
  TRAINING_COORDINATION,
  TRAINING_PROGRAM_SHEET,
  TRAINING_REGISTRATION_SHEET,
  TRAINING_REQUEST_SHEET,
  TRAINING_TIMES,
  TRAINING_DATES,
  buildPromotedTrainingDetails,
  buildPromotedTrainingListRows,
  buildTrainingRequestAlert,
  buildTrainingDetails,
  buildTrainingListRows,
  captureTrainingRequestDate,
  captureTrainingRequestLocation,
  captureTrainingRequestRemarks,
  captureTrainingRequest,
  categoryMatches,
  changeTrainingRequest,
  createTrainingRequestSession,
  filterTrainingPrograms,
  findTrainingProgram,
  findTrainingRegistration,
  formatFee,
  formatTrainingRequestRemarks,
  getMyTrainings,
  getPromotedTrainingPrograms,
  inferTrainingCategory,
  isTrainingRequestCancellation,
  isUpcoming,
  parseTrainingAction,
  parseTrainingRequestPreferences,
  readTrainingRequests,
  readTrainingPrograms,
  requiredTrainingRequestHeadersPresent,
  registerFarmerForTraining,
  registrationAvailability,
  resolveTrainingAlertDestination,
  sendTrainingRequestAlert,
  sendTrainingRequestAlertForSubmission,
  selectTrainingRequestMode,
  selectTrainingRequestDateChoice,
  selectTrainingRequestTime,
  trainingRequestNeedsLocation,
  submitTrainingRequest,
  trainingRequestId
};
