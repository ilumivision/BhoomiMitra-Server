const INDIA_OFFSET_MS = 330 * 60 * 1000;
const FRESHNESS_MS = 2 * 60 * 60 * 1000;

function dateParts(text) {
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return [Number(match[1]), Number(match[2]), Number(match[3])];

  match = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  return match
    ? [Number(match[3]), Number(match[2]), Number(match[1])]
    : null;
}

function validDate(year, month, day, hour, minute, second) {
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second;
}

function parseIndiaTimestamp(dateValue, timeValue) {
  const text = [dateValue, timeValue]
    .filter((part) => String(part ?? "").trim())
    .join(" ")
    .trim();

  if (!text) return NaN;
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) return Date.parse(text);

  const parts = dateParts(text);
  if (!parts) return NaN;

  const time = text.match(/(?:T|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  let hour = time ? Number(time[1]) : 0;
  const minute = time ? Number(time[2]) : 0;
  const second = time && time[3] ? Number(time[3]) : 0;

  if (time && time[4]) {
    if (hour < 1 || hour > 12) return NaN;
    hour %= 12;
    if (time[4].toUpperCase() === "PM") hour += 12;
  }

  if (!validDate(parts[0], parts[1], parts[2], hour, minute, second)) return NaN;
  return Date.UTC(parts[0], parts[1] - 1, parts[2], hour, minute, second) - INDIA_OFFSET_MS;
}

function dateKey(value) {
  const parts = dateParts(String(value ?? "").trim());
  if (!parts || !validDate(parts[0], parts[1], parts[2], 0, 0, 0)) return "";
  return parts[0] + "-" + String(parts[1]).padStart(2, "0") + "-" +
    String(parts[2]).padStart(2, "0");
}

function districtRows(rows, district) {
  const wanted = String(district).trim().toLowerCase();
  return (Array.isArray(rows) ? rows : []).filter((row) =>
    String(row[2] ?? "").trim().toLowerCase() === wanted
  );
}

function selectCurrent(rows, district, now) {
  const matching = districtRows(rows, district);
  const timestamped = matching.map((row) => {
    const updated = parseIndiaTimestamp(row[15]);
    return {
      row,
      timestamp: Number.isFinite(updated)
        ? updated
        : parseIndiaTimestamp(row[3], row[4])
    };
  }).filter((item) => Number.isFinite(item.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp);

  if (!timestamped.length) {
    return { status: matching.length ? "invalid" : "missing", row: null };
  }

  const latest = timestamped[0];
  const age = now - latest.timestamp;
  return {
    status: age >= 0 && age <= FRESHNESS_MS ? "fresh" : age > FRESHNESS_MS ? "stale" : "invalid",
    row: latest.row
  };
}

function selectForecast(rows, district, now) {
  const today = new Date(now + INDIA_OFFSET_MS).toISOString().slice(0, 10);
  const seen = new Set();

  return districtRows(rows, district).map((row) => ({ row, key: dateKey(row[3]) }))
    .filter((item) => item.key && item.key >= today)
    .sort((a, b) => a.key.localeCompare(b.key))
    .filter((item) => !seen.has(item.key) && seen.add(item.key))
    .slice(0, 3);
}

function value(input) {
  return String(input ?? "").trim() || "-";
}

function currentTime(row) {
  return Number.isFinite(parseIndiaTimestamp(row[15]))
    ? value(row[15])
    : value([row[3], row[4]].filter(Boolean).join(" "));
}

function getWeatherDistrictPrompt(language) {
  const preferredLanguage = String(language).toLowerCase();
  const english = "Please send the Kerala district name for weather information.\nExample: Pathanamthitta";
  const malayalam = "കാലാവസ്ഥ അറിയാൻ കേരളത്തിലെ ജില്ലയുടെ പേര് അയയ്ക്കുക.\nഉദാഹരണം: Pathanamthitta";

  if (preferredLanguage === "malayalam") return malayalam;
  if (preferredLanguage === "bilingual") return english + "\n\n" + malayalam;
  return english;
}

function getWeatherUnavailableReply(language) {
  const preferredLanguage = String(language).toLowerCase();
  const english = "Weather information is temporarily unavailable. Please try again later.";
  const malayalam = "കാലാവസ്ഥ വിവരങ്ങൾ താൽക്കാലികമായി ലഭ്യമല്ല. ദയവായി കുറച്ച് കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക.";

  if (preferredLanguage === "malayalam") return malayalam;
  if (preferredLanguage === "bilingual") return english + "\n\n" + malayalam;
  return english;
}

function buildWeatherSection(district, current, forecasts, ml) {
  const lines = ml
    ? ["🌦️ ഭൂമിമിത്ര കാലാവസ്ഥ", "📍 ജില്ല: " + district, ""]
    : ["🌦️ BhoomiMitra Weather", "📍 District: " + district, ""];

  if (current.status === "fresh") {
    const row = current.row;
    lines.push(ml ? "നിലവിലെ കാലാവസ്ഥ:" : "Current weather:",
      (ml ? "• താപനില: " : "• Temperature: ") + value(row[5]) + " °C",
      (ml ? "• ഈർപ്പം: " : "• Humidity: ") + value(row[6]) + " %",
      (ml ? "• മഴ: " : "• Rainfall: ") + value(row[7]) + " mm",
      (ml ? "• കാറ്റിന്റെ വേഗം: " : "• Wind speed: ") + value(row[8]) + " km/h",
      (ml ? "• കാലാവസ്ഥ: " : "• Weather event: ") + value(row[13]),
      (ml ? "• അവസാനം പുതുക്കിയത്: " : "• Last updated: ") + currentTime(row));
  } else if (current.status === "stale") {
    lines.push(ml
      ? "നിലവിലെ കാലാവസ്ഥ ലഭ്യമല്ല. അവസാന നിരീക്ഷണം പഴയതാണ്: " + currentTime(current.row)
      : "Current weather is unavailable. Last observation is stale: " + currentTime(current.row));
  } else {
    lines.push(ml
      ? "സമയം സ്ഥിരീകരിക്കാനാകാത്തതിനാൽ നിലവിലെ കാലാവസ്ഥ ലഭ്യമല്ല."
      : "Current weather is unavailable because no valid recent timestamp was found.");
  }

  lines.push("", ml ? "അടുത്ത 3 ദിവസത്തെ പ്രവചനം:" : "Next 3 forecast days:");
  if (!forecasts.length) {
    lines.push(ml ? "ഭാവിയിലെ സാധുവായ പ്രവചനം ലഭ്യമല്ല." : "No valid non-past forecast is available.");
  }

  forecasts.forEach(({ row, key }) => lines.push("", "📅 " + key,
    (ml ? "• കൂടിയ താപനില: " : "• Maximum temperature: ") + value(row[4]) + " °C",
    (ml ? "• കുറഞ്ഞ താപനില: " : "• Minimum temperature: ") + value(row[5]) + " °C",
    (ml ? "• മഴ: " : "• Rainfall: ") + value(row[6]) + " mm",
    (ml ? "• മഴസാധ്യത: " : "• Rain probability: ") + value(row[7]) + " %",
    (ml ? "• പരമാവധി കാറ്റ്: " : "• Maximum wind: ") + value(row[8]) + " km/h",
    (ml ? "• കാലാവസ്ഥ: " : "• Weather event: ") + value(row[9]),
    (ml ? "• കൃഷി നിർദേശം: " : "• Farm advisory: ") + value(row[10])));

  return lines.join("\n");
}

function buildWeatherSheetReply(options) {
  const district = String(options.district || "").trim();
  if (!district) return getWeatherDistrictPrompt(options.preferredLanguage);

  const now = options.now instanceof Date ? options.now.getTime() : Number(options.now);
  const current = selectCurrent(options.currentRows, district, now);
  const forecasts = selectForecast(options.forecastRows, district, now);
  const preferredLanguage = String(options.preferredLanguage).toLowerCase();

  if (preferredLanguage === "bilingual") {
    return buildWeatherSection(district, current, forecasts, false) +
      "\n\n──────────\n\n" +
      buildWeatherSection(district, current, forecasts, true);
  }

  return buildWeatherSection(
    district,
    current,
    forecasts,
    preferredLanguage === "malayalam"
  );
}

module.exports = {
  buildWeatherSheetReply,
  getWeatherDistrictPrompt,
  getWeatherUnavailableReply
};
