"use strict";

function weatherCodeText(code) {
  const value = Number(code);

  if (value === 0) return "Clear sky";
  if ([1, 2].includes(value)) {
    return "Partly cloudy";
  }
  if (value === 3) {
    return "Cloudy";
  }
  if ([45, 48].includes(value)) {
    return "Fog";
  }
  if ([51, 53, 55].includes(value)) {
    return "Drizzle";
  }
  if ([56, 57].includes(value)) {
    return "Freezing drizzle";
  }
  if ([61, 63, 65].includes(value)) {
    return "Rain";
  }
  if ([66, 67].includes(value)) {
    return "Freezing rain";
  }
  if ([71, 73, 75, 77].includes(value)) {
    return "Snow";
  }
  if ([80, 81, 82].includes(value)) {
    return "Rain showers";
  }
  if ([85, 86].includes(value)) {
    return "Snow showers";
  }
  if ([95, 96, 99].includes(value)) {
    return "Thunderstorm";
  }

  return "Weather condition unavailable";
}

function safeValue(
  value,
  fallback = "-"
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  return value;
}

function getNext24HourSummary(
  hourly
) {
  if (
    !hourly ||
    !Array.isArray(hourly.time)
  ) {
    return null;
  }

  const now = Date.now();

  const rows = [];

  hourly.time.forEach(
    function (time, index) {
      const timestamp =
        new Date(time).getTime();

      if (
        timestamp >= now &&
        timestamp <=
          now +
            24 * 60 * 60 * 1000
      ) {
        rows.push({
          time,
          temperature:
            hourly.temperature_2m
              ? hourly.temperature_2m[
                  index
                ]
              : null,
          rainProbability:
            hourly
              .precipitation_probability
              ? hourly
                  .precipitation_probability[
                    index
                  ]
              : null,
          precipitation:
            hourly.precipitation
              ? hourly.precipitation[
                  index
                ]
              : null,
          weatherCode:
            hourly.weather_code
              ? hourly.weather_code[
                  index
                ]
              : null,
          wind:
            hourly.wind_speed_10m
              ? hourly.wind_speed_10m[
                  index
                ]
              : null
        });
      }
    }
  );

  if (rows.length === 0) {
    return null;
  }

  const temperatures =
    rows
      .map(function (row) {
        return Number(
          row.temperature
        );
      })
      .filter(Number.isFinite);

  const rainProbabilities =
    rows
      .map(function (row) {
        return Number(
          row.rainProbability
        );
      })
      .filter(Number.isFinite);

  const rainfall =
    rows
      .map(function (row) {
        return Number(
          row.precipitation
        );
      })
      .filter(Number.isFinite)
      .reduce(
        function (total, value) {
          return total + value;
        },
        0
      );

  const winds =
    rows
      .map(function (row) {
        return Number(row.wind);
      })
      .filter(Number.isFinite);

  return {
    minTemperature:
      temperatures.length
        ? Math.min(
            ...temperatures
          )
        : null,

    maxTemperature:
      temperatures.length
        ? Math.max(
            ...temperatures
          )
        : null,

    maxRainProbability:
      rainProbabilities.length
        ? Math.max(
            ...rainProbabilities
          )
        : null,

    totalRainfall:
      Number(
        rainfall.toFixed(1)
      ),

    maxWind:
      winds.length
        ? Math.max(...winds)
        : null
  };
}

function createFarmAdvisory(
  current,
  next24
) {
  const advice = [];

  const humidity =
    Number(
      current &&
      current.relative_humidity_2m
    );

  const rainProbability =
    Number(
      next24 &&
      next24.maxRainProbability
    );

  const rainfall =
    Number(
      next24 &&
      next24.totalRainfall
    );

  const wind =
    Number(
      next24 &&
      next24.maxWind
    );

  if (
    Number.isFinite(humidity) &&
    humidity >= 85
  ) {
    advice.push(
      "• High humidity: monitor crops for fungal and bacterial diseases."
    );
  }

  if (
    Number.isFinite(
      rainProbability
    ) &&
    rainProbability >= 60
  ) {
    advice.push(
      "• Rain is likely: avoid unnecessary pesticide or fertiliser spraying before rain."
    );
  }

  if (
    Number.isFinite(rainfall) &&
    rainfall >= 20
  ) {
    advice.push(
      "• Moderate/heavy rainfall is possible: ensure field drainage and avoid waterlogging."
    );
  }

  if (
    Number.isFinite(wind) &&
    wind >= 30
  ) {
    advice.push(
      "• Strong winds are possible: support banana and other vulnerable crops."
    );
  }

  if (advice.length === 0) {
    advice.push(
      "• Continue normal crop management while monitoring local weather changes."
    );
  }

  return advice.join("\n");
}

async function weatherModule(
  data = {}
) {
  try {
    const latitude =
      Number(
        data.latitude ??
        data.lat
      );

    const longitude =
      Number(
        data.longitude ??
        data.lon ??
        data.lng
      );

    if (
      !Number.isFinite(
        latitude
      ) ||
      !Number.isFinite(
        longitude
      )
    ) {
      return {
        success: false,
        module: "WEATHER",
        reply: [
          "🌦️ Please send your WhatsApp location.",
          "",
          "📎 Attach → Location → Send current location"
        ].join("\n")
      };
    }

    const params =
      new URLSearchParams({
        latitude:
          String(latitude),

        longitude:
          String(longitude),

        timezone:
          "Asia/Kolkata",

        forecast_days:
          "4",

        current: [
          "temperature_2m",
          "relative_humidity_2m",
          "precipitation",
          "weather_code",
          "pressure_msl",
          "wind_speed_10m"
        ].join(","),

        hourly: [
          "temperature_2m",
          "relative_humidity_2m",
          "precipitation_probability",
          "precipitation",
          "weather_code",
          "wind_speed_10m"
        ].join(","),

        daily: [
          "weather_code",
          "temperature_2m_max",
          "temperature_2m_min",
          "precipitation_sum",
          "precipitation_probability_max",
          "wind_speed_10m_max"
        ].join(",")
      });

    const url =
      "https://api.open-meteo.com/v1/forecast?" +
      params.toString();

    const response =
      await fetch(url);

    if (!response.ok) {
      throw new Error(
        "Weather API HTTP " +
          response.status
      );
    }

    const result =
      await response.json();

    const current =
      result.current || {};

    const daily =
      result.daily || {};

    const next24 =
      getNext24HourSummary(
        result.hourly
      );

    const lines = [
      "🌦️ BhoomiMitra Weather",
      "",
      "📍 GPS: " +
        latitude.toFixed(4) +
        ", " +
        longitude.toFixed(4),
      "",
      "Current weather:",
      "• Temperature: " +
        safeValue(
          current.temperature_2m
        ) +
        "°C",
      "• Humidity: " +
        safeValue(
          current.relative_humidity_2m
        ) +
        "%",
      "• Condition: " +
        weatherCodeText(
          current.weather_code
        ),
      "• Rainfall: " +
        safeValue(
          current.precipitation
        ) +
        " mm",
      "• Wind: " +
        safeValue(
          current.wind_speed_10m
        ) +
        " km/h",
      "• Pressure: " +
        safeValue(
          current.pressure_msl
        ) +
        " hPa",
      ""
    ];

    if (next24) {
      lines.push(
        "⏱️ Next 24 hours:"
      );

      lines.push(
        "• Temperature: " +
          safeValue(
            next24.minTemperature
          ) +
          "°C to " +
          safeValue(
            next24.maxTemperature
          ) +
          "°C"
      );

      lines.push(
        "• Maximum rain probability: " +
          safeValue(
            next24.maxRainProbability
          ) +
          "%"
      );

      lines.push(
        "• Expected rainfall: " +
          safeValue(
            next24.totalRainfall
          ) +
          " mm"
      );

      lines.push(
        "• Maximum wind: " +
          safeValue(
            next24.maxWind
          ) +
          " km/h"
      );

      lines.push("");
    }

    if (
      Array.isArray(
        daily.time
      )
    ) {
      lines.push(
        "📅 3-day forecast:"
      );

      const daysToShow =
        Math.min(
          3,
          daily.time.length
        );

      for (
        let index = 0;
        index < daysToShow;
        index += 1
      ) {
        lines.push(
          ""
        );

        lines.push(
          "Day " +
            (index + 1) +
            " — " +
            safeValue(
              daily.time[
                index
              ]
            )
        );

        lines.push(
          "• " +
            weatherCodeText(
              daily.weather_code
                ? daily.weather_code[
                    index
                  ]
                : null
            )
        );

        lines.push(
          "• Temperature: " +
            safeValue(
              daily.temperature_2m_min
                ? daily
                    .temperature_2m_min[
                      index
                    ]
                : null
            ) +
            "°C to " +
            safeValue(
              daily.temperature_2m_max
                ? daily
                    .temperature_2m_max[
                      index
                    ]
                : null
            ) +
            "°C"
        );

        lines.push(
          "• Rain probability: " +
            safeValue(
              daily
                .precipitation_probability_max
                ? daily
                    .precipitation_probability_max[
                      index
                    ]
                : null
            ) +
            "%"
        );

        lines.push(
          "• Rainfall: " +
            safeValue(
              daily.precipitation_sum
                ? daily
                    .precipitation_sum[
                      index
                    ]
                : null
            ) +
            " mm"
        );
      }
    }

    lines.push(
      "",
      "🌾 Farm advisory:",
      createFarmAdvisory(
        current,
        next24
      ),
      "",
      "Source: Open-Meteo forecast data"
    );

    return {
      success: true,
      module: "WEATHER",
      data: result,
      reply:
        lines.join("\n")
    };
  } catch (error) {
    console.error(
      "Weather module error:",
      error &&
      error.message
        ? error.message
        : error
    );

    return {
      success: false,
      module: "WEATHER",
      reply: [
        "🌦️ Weather information is temporarily unavailable.",
        "",
        "Please try again shortly."
      ].join("\n")
    };
  }
}

module.exports =
  weatherModule;
