"use strict";
const axios = require("axios");
const OVERPASS_API_URL =
  "https://overpass-api.de/api/interpreter";
/*
 * BhoomiMitra Verified Service Finder
 *
 * Searches:
 * 1. Workforce Providers
 * 2. Skilled Workers
 * 3. Expert Directory
 *
 * Supports:
 * - Grama Panchayat
 * - Municipality
 * - Municipal Corporation
 *
 * Search priority:
 * 1. Same Local Body
 * 2. Same District
 * 3. Other locations in Kerala
 *
 * Only verified and active records are returned.
 */

// =====================================================
// TEXT NORMALISATION
// =====================================================

function normalizeText(value) {
  return String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0D00-\u0D7F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(value) {
  return String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function createHeaderMap(headers) {
  const map = {};

  (headers || []).forEach(function (
    header,
    index
  ) {
    const key =
      normalizeHeader(header);

    if (
      key &&
      map[key] === undefined
    ) {
      map[key] = index;
    }
  });

  return map;
}

function findColumn(
  headerMap,
  aliases
) {
  for (const alias of aliases || []) {
    const key =
      normalizeHeader(alias);

    if (
      Object.prototype.hasOwnProperty.call(
        headerMap,
        key
      )
    ) {
      return headerMap[key];
    }
  }

  return -1;
}

function getValue(
  row,
  headerMap,
  aliases
) {
  const index =
    findColumn(
      headerMap,
      aliases
    );

  if (index < 0) {
    return "";
  }

  return String(
    row[index] || ""
  ).trim();
}

function phoneKey(value) {
  const digits =
    String(value || "")
      .replace(/\D/g, "");

  if (digits.length > 10) {
    return digits.slice(-10);
  }

  return digits;
}

// =====================================================
// SERVICE NAME ALIASES
// =====================================================

const SERVICE_ALIASES = [
  {
    canonical: "Coconut climber",
    keywords: [
      "coconut climber",
      "coconut climbing",
      "coconut tree climber",
      "palm climber",
      "climber",
      "തെങ്ങുകയറ്റം",
      "തെങ്ങ് കയറ്റം",
      "തെങ്ങുകയറ്റ തൊഴിലാളി",
      "തെങ്ങ് കയറുന്ന ആളെ",
      "തെങ്ങ് കയറാൻ",
      "തെങ്ങ് കയറ്റക്കാരൻ",
      "തെങ്ങുകയറ്റക്കാരൻ"
    ]
  },

  {
    canonical: "Tractor service",
    keywords: [
      "tractor",
      "tractor service",
      "ploughing",
      "plowing",
      "cultivator",
      "rotavator",
      "rotavator service",
      "ട്രാക്ടർ",
      "ഉഴവ്",
      "റോട്ടവേറ്റർ"
    ]
  },

  {
    canonical: "Power tiller service",
    keywords: [
      "power tiller",
      "tiller",
      "tiller service",
      "പവർ ടില്ലർ",
      "ടില്ലർ"
    ]
  },

  {
    canonical: "Spraying service",
    keywords: [
      "spraying",
      "sprayer",
      "spray service",
      "pesticide spraying",
      "power sprayer",
      "സ്പ്രേയിംഗ്",
      "സ്പ്രേ",
      "മരുന്ന് തളിക്കൽ",
      "കീടനാശിനി തളിക്കൽ"
    ]
  },

  {
    canonical: "Drone spraying",
    keywords: [
      "drone",
      "drone spraying",
      "agriculture drone",
      "ഡ്രോൺ",
      "ഡ്രോൺ സ്പ്രേയിംഗ്"
    ]
  },

  {
    canonical: "Irrigation installation",
    keywords: [
      "irrigation",
      "drip irrigation",
      "sprinkler",
      "irrigation installation",
      "drip installation",
      "micro irrigation",
      "ഡ്രിപ്പ്",
      "ജലസേചനം",
      "സ്പ്രിങ്ക്ലർ"
    ]
  },

  {
    canonical: "Soil testing",
    keywords: [
      "soil test",
      "soil testing",
      "soil laboratory",
      "soil analysis",
      "മണ്ണ് പരിശോധന",
      "മണ്ണ് ടെസ്റ്റ്",
      "സോയിൽ ടെസ്റ്റ്"
    ]
  },

  {
    canonical: "Nursery and seedlings",
    keywords: [
      "nursery",
      "seedling",
      "seedlings",
      "planting material",
      "sapling",
      "saplings",
      "നഴ്സറി",
      "തൈ",
      "തൈകൾ",
      "നടീൽ വസ്തു"
    ]
  },

  {
    canonical: "Plantation development",
    keywords: [
      "plantation development",
      "farm development",
      "farm establishment",
      "land development",
      "orchard development",
      "plantation consultant",
      "പ്ലാന്റേഷൻ ഡെവലപ്മെന്റ്",
      "ഫാം ഡെവലപ്മെന്റ്",
      "തോട്ടം വികസനം"
    ]
  },

  {
    canonical: "Pruning service",
    keywords: [
      "pruning",
      "tree pruning",
      "branch cutting",
      "canopy management",
      "കൊമ്പ് മുറിക്കൽ",
      "പ്രൂണിംഗ്"
    ]
  },

  {
    canonical: "Harvesting service",
    keywords: [
      "harvesting",
      "harvester",
      "harvesting worker",
      "harvest labour",
      "കൊയ്ത്ത്",
      "വിളവെടുപ്പ്",
      "ഹാർവെസ്റ്റർ"
    ]
  },

  {
    canonical: "Paddy machinery service",
    keywords: [
      "paddy harvester",
      "paddy transplanter",
      "rice transplanter",
      "combine harvester",
      "നെൽ കൊയ്ത്ത് യന്ത്രം",
      "ഞാറ് നടീൽ യന്ത്രം",
      "നെൽ യന്ത്രം"
    ]
  },

  {
    canonical: "Agricultural labour",
    keywords: [
      "agricultural labour",
      "farm labour",
      "worker",
      "workers",
      "labour",
      "labour team",
      "agriculture worker",
      "കൃഷിത്തൊഴിലാളി",
      "തൊഴിലാളി",
      "പണിക്കാർ",
      "കൃഷിപ്പണി"
    ]
  },

  {
    canonical: "Electrician",
    keywords: [
      "electrician",
      "electrical work",
      "pump electrician",
      "motor electrician",
      "ഇലക്ട്രീഷ്യൻ",
      "വൈദ്യുതി പണി",
      "മോട്ടോർ റിപ്പയർ"
    ]
  },

  {
    canonical: "Pump and motor service",
    keywords: [
      "pump repair",
      "motor repair",
      "water pump",
      "pump installation",
      "motor service",
      "പമ്പ് റിപ്പയർ",
      "മോട്ടോർ റിപ്പയർ",
      "പമ്പ് സർവീസ്"
    ]
  },

  {
    canonical: "Fencing service",
    keywords: [
      "fencing",
      "solar fencing",
      "electric fence",
      "farm fencing",
      "വേലി",
      "സോളാർ ഫെൻസിംഗ്",
      "ഇലക്ട്രിക് ഫെൻസിംഗ്"
    ]
  },

  {
    canonical: "Veterinary service",
    keywords: [
      "veterinary",
      "veterinary doctor",
      "animal doctor",
      "cattle treatment",
      "vet",
      "വെറ്ററിനറി",
      "മൃഗഡോക്ടർ",
      "പശു ഡോക്ടർ"
    ]
  },

  {
    canonical: "Dairy service",
    keywords: [
      "dairy",
      "milking machine",
      "dairy equipment",
      "dairy consultant",
      "ഡയറി",
      "പാൽ ഉത്പാദനം",
      "മിൽക്കിംഗ് മെഷീൻ"
    ]
  },

  {
    canonical: "Aquaculture service",
    keywords: [
      "fish farming",
      "aquaculture",
      "fishery expert",
      "fish pond",
      "മത്സ്യകൃഷി",
      "ഫിഷ് ഫാം"
    ]
  },

  {
    canonical: "Beekeeping service",
    keywords: [
      "beekeeping",
      "bee keeping",
      "honey bee",
      "apiary",
      "തേനീച്ച വളർത്തൽ",
      "തേനീച്ച"
    ]
  },

  {
    canonical: "Mushroom service",
    keywords: [
      "mushroom",
      "mushroom spawn",
      "mushroom training",
      "കൂൺ",
      "കൂൺ വിത്ത്",
      "മഷ്റൂം"
    ]
  },

  {
    canonical: "Plant protection expert",
    keywords: [
      "plant protection",
      "pest expert",
      "disease expert",
      "entomologist",
      "plant pathologist",
      "കീടരോഗ വിദഗ്ധൻ",
      "സസ്യസംരക്ഷണം"
    ]
  },

  {
    canonical: "Agriculture expert",
    keywords: [
      "agriculture expert",
      "agriculture consultant",
      "crop expert",
      "agronomist",
      "horticulture expert",
      "വിദഗ്ധൻ",
      "കൃഷി വിദഗ്ധൻ",
      "കാർഷിക വിദഗ്ധൻ"
    ]
  }
];

// =====================================================
// SERVICE REQUEST DETECTION
// =====================================================

function resolveRequestedService(text) {
  const normalized =
    normalizeText(text);

  if (!normalized) {
    return "";
  }

  for (const item of SERVICE_ALIASES) {
    const matched =
      item.keywords.some(
        function (keyword) {
          const normalizedKeyword =
            normalizeText(keyword);

          return (
            normalized ===
              normalizedKeyword ||
            normalized.includes(
              normalizedKeyword
            ) ||
            normalizedKeyword.includes(
              normalized
            )
          );
        }
      );

    if (matched) {
      return item.canonical;
    }
  }

  return String(text || "").trim();
}

function isServiceRequest(text) {
  const normalized =
    normalizeText(text);

  if (!normalized) {
    return false;
  }

  const requestWords = [
    "need",
    "want",
    "looking for",
    "find",
    "get me",
    "required",
    "available",
    "contact",
    "service provider",
    "skilled worker",
    "worker",
    "provider",
    "വേണം",
    "ആവശ്യമുണ്ട്",
    "ലഭ്യമാണോ",
    "കണ്ടെത്തുക",
    "തരാമോ",
    "കോൺടാക്ട്",
    "സേവനദാതാവ്",
    "തൊഴിലാളി"
  ];

  const hasRequestWord =
    requestWords.some(
      function (word) {
        return normalized.includes(
          normalizeText(word)
        );
      }
    );

  const hasKnownService =
    SERVICE_ALIASES.some(
      function (item) {
        return item.keywords.some(
          function (keyword) {
            return normalized.includes(
              normalizeText(keyword)
            );
          }
        );
      }
    );

  return (
    hasKnownService &&
    (
      hasRequestWord ||
      normalized.split(" ").length <= 5
    )
  );
}

// =====================================================
// MATCHING AND STATUS VALIDATION
// =====================================================

function matchesService(
  requestedService,
  registeredService
) {
  const requested =
    normalizeText(
      requestedService
    );

  const registered =
    normalizeText(
      registeredService
    );

  if (
    !requested ||
    !registered
  ) {
    return false;
  }

  if (
    registered.includes(
      requested
    ) ||
    requested.includes(
      registered
    )
  ) {
    return true;
  }

  const canonicalRequested =
    normalizeText(
      resolveRequestedService(
        requestedService
      )
    );

  if (
    canonicalRequested &&
    (
      registered.includes(
        canonicalRequested
      ) ||
      canonicalRequested.includes(
        registered
      )
    )
  ) {
    return true;
  }

  const requestedWords =
    canonicalRequested
      .split(" ")
      .filter(function (word) {
        return word.length >= 4;
      });

  const registeredWords =
    registered
      .split(" ")
      .filter(Boolean);

  return requestedWords.some(
    function (requestedWord) {
      return registeredWords.some(
        function (registeredWord) {
          return (
            registeredWord.includes(
              requestedWord
            ) ||
            requestedWord.includes(
              registeredWord
            )
          );
        }
      );
    }
  );
}

function isVerifiedActive(
  verificationStatus,
  activeStatus,
  status
) {
  const verification =
    normalizeText(
      verificationStatus
    );

  const active =
    normalizeText(
      activeStatus
    );

  const generalStatus =
    normalizeText(
      status
    );

  const verifiedValues = [
    "verified",
    "approved",
    "yes"
  ];

  const activeValues = [
    "active",
    "available",
    "yes",
    "live"
  ];

  const rejectedValues = [
    "rejected",
    "suspended",
    "inactive",
    "blocked",
    "deleted"
  ];

  if (
    rejectedValues.includes(
      verification
    ) ||
    rejectedValues.includes(
      active
    ) ||
    rejectedValues.includes(
      generalStatus
    )
  ) {
    return false;
  }

  const verified =
    verifiedValues.includes(
      verification
    ) ||
    verifiedValues.includes(
      generalStatus
    );

  const operational =
    !activeStatus ||
    activeValues.includes(
      active
    ) ||
    activeValues.includes(
      generalStatus
    );

  return verified && operational;
}

// =====================================================
// LOCATION RANKING
// =====================================================

function getLocationRank(
  record,
  query
) {
  const recordLocalBody =
    normalizeText(
      record.localBody
    );

  const queryLocalBody =
    normalizeText(
      query.localBody
    );

  const recordDistrict =
    normalizeText(
      record.district
    );

  const queryDistrict =
    normalizeText(
      query.district
    );

  const recordState =
    normalizeText(
      record.state ||
      record.workingState ||
      ""
    );

  const queryState =
    normalizeText(
      query.state ||
      "Kerala"
    );

  // 1. Same local body
  if (
    queryLocalBody &&
    recordLocalBody &&
    (
      queryLocalBody === recordLocalBody ||
      recordLocalBody.includes(
        queryLocalBody
      ) ||
      queryLocalBody.includes(
        recordLocalBody
      )
    )
  ) {
    return 1;
  }

  // 2. Same district
  if (
    queryDistrict &&
    recordDistrict &&
    (
      queryDistrict === recordDistrict ||
      recordDistrict.includes(
        queryDistrict
      ) ||
      queryDistrict.includes(
        recordDistrict
      )
    )
  ) {
    return 2;
  }

  // 3. Same state
  if (
    queryState &&
    recordState &&
    (
      queryState === recordState ||
      recordState.includes(
        queryState
      ) ||
      queryState.includes(
        recordState
      )
    )
  ) {
    return 3;
  }

  // 4. South India
  const southIndiaStates = [
    "kerala",
    "tamil nadu",
    "karnataka",
    "andhra pradesh",
    "telangana",
    "puducherry"
  ];

  if (
    recordState &&
    southIndiaStates.includes(
      recordState
    )
  ) {
    return 4;
  }

  // 5. Rest of India
  return 5;
}
 async function searchPublicProviders(
  service,
  query
) {
  try {
    const safeQuery =
      query || {};

    const requestedService =
      String(service || "").trim();

    if (!requestedService) {
      return [];
    }

    const district =
      String(
        safeQuery.district || ""
      ).trim();

    const localBody =
      String(
        safeQuery.localBody || ""
      ).trim();

    const state =
      String(
        safeQuery.state || "Kerala"
      ).trim();

    const searchArea = [
      localBody,
      district,
      state,
      "India"
    ]
      .filter(Boolean)
      .join(", ");

    const nominatimResponse =
      await axios.get(
        "https://nominatim.openstreetmap.org/search",
        {
          params: {
            q: searchArea,
            format: "json",
            limit: 1
          },
          headers: {
            "User-Agent":
              "BhoomiMitra/1.0 agricultural-service-finder"
          },
          timeout: 10000
        }
      );

    const locations =
      Array.isArray(
        nominatimResponse.data
      )
        ? nominatimResponse.data
        : [];

    if (!locations.length) {
      return [];
    }

    const lat =
      Number(locations[0].lat);

    const lon =
      Number(locations[0].lon);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      return [];
    }

    const escapedService =
      requestedService
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"');

    const overpassQuery = `
[out:json][timeout:20];
(
  node(around:50000,${lat},${lon})
    ["name"~"${escapedService}",i];
  way(around:50000,${lat},${lon})
    ["name"~"${escapedService}",i];
  relation(around:50000,${lat},${lon})
    ["name"~"${escapedService}",i];
);
out center tags 10;
`;

    const response =
      await axios.post(
        OVERPASS_API_URL,
        overpassQuery,
        {
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
            "User-Agent":
              "BhoomiMitra/1.0 agricultural-service-finder"
          },
          timeout: 20000
        }
      );

    const elements =
      response &&
      response.data &&
      Array.isArray(
        response.data.elements
      )
        ? response.data.elements
        : [];

    return elements
      .map(function (element) {
        const tags =
          element.tags || {};

        const phone =
          tags.phone ||
          tags["contact:phone"] ||
          tags.mobile ||
          tags["contact:mobile"] ||
          "";

        return {
          directoryType:
            "Public Internet Provider",

          id:
            "OSM-" +
            String(element.id || ""),

          name:
            tags.name || "",

          mobile: phone,

          whatsapp:
            tags["contact:whatsapp"] ||
            "",

          district:
            district,

          state:
            state,

          localBody:
            localBody,

          service:
            requestedService,

          address:
            [
              tags["addr:housename"],
              tags["addr:street"],
              tags["addr:city"],
              tags["addr:district"],
              tags["addr:state"]
            ]
              .filter(Boolean)
              .join(", "),

          website:
            tags.website ||
            tags["contact:website"] ||
            "",

          verificationStatus:
            "Public Listing",

          activeStatus: "",

          status:
            "Unverified",

          source:
            "OpenStreetMap Public Listing",

          contactNumber:
            phoneKey(phone),

          locationRank:
            3
        };
      })
      .filter(function (record) {
        return record.name;
      });

  } catch (error) {
    console.error(
      "Public provider search error:",
      error &&
      error.message
        ? error.message
        : error
    );

    return [];
  }
}
// =====================================================
// MAIN SERVICE FINDER
// =====================================================

function createServiceFinder(options) {
  if (
    !options ||
    typeof options.readSheetRows !==
      "function"
  ) {
    throw new Error(
      "createServiceFinder requires readSheetRows."
    );
  }

  const readSheetRows =
    options.readSheetRows;

  const sheets =
    options.sheets || {};

  async function readDirectory(
    sheetName,
    directoryType
  ) {
    try {
      const rows =
        await readSheetRows(
          sheetName,
          "A:BK"
        );

      if (
        !Array.isArray(rows) ||
        rows.length < 2
      ) {
        console.log(
          "No service-directory records found in:",
          sheetName
        );

        return [];
      }

      const headers =
        rows[0];

      const headerMap =
        createHeaderMap(
          headers
        );

      return rows
        .slice(1)
        .map(function (row) {
          const record = {
            directoryType,

            id:
              getValue(
                row,
                headerMap,
                [
                  "Provider_ID",
                  "Provider ID",
                  "Worker_ID",
                  "Worker ID",
                  "Expert_ID",
                  "Expert ID",
                  "ID"
                ]
              ),

            name:
              getValue(
                row,
                headerMap,
                [
                  "Provider Name",
                  "Worker Name",
                  "Expert Name",
                  "Contact Person",
                  "Name"
                ]
              ),

            mobile:
              getValue(
                row,
                headerMap,
                [
                  "Mobile",
                  "Mobile No",
                  "Mobile_No",
                  "Mob No",
                  "Phone",
                  "Phone Number"
                ]
              ),

            whatsapp:
              getValue(
                row,
                headerMap,
                [
                  "WhatsApp",
                  "WhatsApp No",
                  "WhatsApp_No",
                  "WhatsApp Number"
                ]
              ),

            district:
              getValue(
                row,
                headerMap,
                [
                  "District",
                  "Working District",
                  "Districts Served"
                ]
              ),
             state:
  getValue(
    row,
    headerMap,
    [
      "State",
      "Working State",
      "States Served"
    ]
  ), 
            block:
              getValue(
                row,
                headerMap,
                [
                  "Block",
                  "Working Block"
                ]
              ),

            localBody:
              getValue(
                row,
                headerMap,
                [
                  "Local Body",
                  "Local_Body",
                  "Panchayath",
                  "Panchayat",
                  "Municipality",
                  "Corporation",
                  "Municipal Corporation"
                ]
              ),

            service:
              getValue(
                row,
                headerMap,
                [
                  "Service Category",
                  "Service Name",
                  "Service name",
                  "Specialization",
                  "Skill Category",
                  "Skill_Category",
                  "Sub Skill",
                  "Preferred Work",
                  "Worker Type",
                  "Expert Group",
                  "Expert_Group",
                  "Expertise",
                  "Main Service"
                ]
              ),

            verificationStatus:
              getValue(
                row,
                headerMap,
                [
                  "Verification Status",
                  "Verification_Status",
                  "Verification Level",
                  "Verified"
                ]
              ),

            activeStatus:
              getValue(
                row,
                headerMap,
                [
                  "Active Status",
                  "Active_Status",
                  "Live Status",
                  "Availability"
                ]
              ),

            status:
              getValue(
                row,
                headerMap,
                [
                  "Status"
                ]
              ),

            charges:
              getValue(
                row,
                headerMap,
                [
                  "Charges",
                  "Service Charge",
                  "Service Charges",
                  "Rate",
                  "Rate per Day",
                  "Rate per Hour"
                ]
              )
          };

          record.contactNumber =
            phoneKey(
              record.whatsapp ||
              record.mobile
            );

          return record;
        })
        .filter(function (record) {
          return (
            record.name &&
            record.contactNumber &&
            record.service
          );
        });

    } catch (error) {
      console.error(
        "Service directory read error:",
        sheetName,
        error &&
        error.message
          ? error.message
          : error
      );

      return [];
    }
  }

  async function searchServices(query) {
    const safeQuery =
      query || {};

    const requestedService =
      resolveRequestedService(
        safeQuery.service || ""
      );

    if (!requestedService) {
      return [];
    }

    const [
      providerRecords,
      workerRecords,
      expertRecords
    ] = await Promise.all([
      readDirectory(
        sheets.serviceProviderRegistration ||
          "Workforce Providers",
        "Service Provider"
      ),

      readDirectory(
        sheets.skilledWorkerRegistration ||
          "Skilled Workers",
        "Skilled Worker"
      ),

      readDirectory(
        sheets.expertRegistration ||
          "Expert_Directory",
        "Expert"
      )
    ]);

    const requestedCategory =
  normalizeText(
    query.category || ""
  );

let combined = [];

if (
  requestedCategory ===
    "skilled worker" ||
  requestedCategory ===
    "worker"
) {
  combined = workerRecords;

} else if (
  requestedCategory ===
    "service provider" ||
  requestedCategory ===
    "provider" ||
  requestedCategory ===
    "machinery"
) {
  combined = providerRecords;

} else if (
  requestedCategory ===
    "expert"
) {
  combined = expertRecords;

} else {
    combined = [
    ...workerRecords,
    ...providerRecords
  ];
}
    const uniqueRecords =
      new Map();

    combined.forEach(function (
      record
    ) {
      const uniqueKey = [
        record.directoryType,
        record.id ||
          record.contactNumber,
        normalizeText(
          record.service
        )
      ].join("|");

      if (
        !uniqueRecords.has(
          uniqueKey
        )
      ) {
        uniqueRecords.set(
          uniqueKey,
          record
        );
      }
    });

   const verifiedResults = Array.from(
  uniqueRecords.values()
)
  .filter(function (record) {
    return (
      matchesService(
        requestedService,
        record.service
      ) &&
      isVerifiedActive(
        record.verificationStatus,
        record.activeStatus,
        record.status
      )
    );
  })
  .map(function (record) {
    return {
      ...record,
      locationRank:
        getLocationRank(
          record,
          safeQuery
        )
    };
  })
  .sort(function (a, b) {
    if (
      a.locationRank !==
      b.locationRank
    ) {
      return (
        a.locationRank -
        b.locationRank
      );
    }

    const typePriority = {
      "Service Provider": 1,
      "Skilled Worker": 2,
      "Expert": 3
    };

    return (
      (typePriority[a.directoryType] || 99) -
      (typePriority[b.directoryType] || 99)
    );
  });

if (verifiedResults.length > 0) {
  return verifiedResults;
}

/*
 * Public internet fallback is only
 * for service providers/machinery.
 * Individual skilled workers remain
 * BhoomiMitra/KVK verified only.
 */
if (
  requestedCategory ===
    "skilled worker" ||
  requestedCategory ===
    "worker" ||
  requestedCategory ===
    "expert"
) {
  return [];
}

const publicProviders =
  await searchPublicProviders(
    requestedService,
    safeQuery
  );

return publicProviders
  .map(function (record) {
    return {
      ...record,
      locationRank:
        getLocationRank(
          record,
          safeQuery
        )
    };
  })
  .sort(function (a, b) {
    return (
      a.locationRank -
      b.locationRank
    );
  });
  }

  function formatServiceResults(
    results,
    query
  ) {
    const safeQuery =
      query || {};

    const requestedService =
      resolveRequestedService(
        safeQuery.service || ""
      );

    if (
      !Array.isArray(results) ||
      results.length === 0
    ) {
      return [
        "🔎 BhoomiMitra Service Search",
        "",
        "Service: " +
          (
            requestedService ||
            safeQuery.service ||
            "-"
          ),
        "",
        "ഈ സേവനത്തിനായി സ്ഥിരീകരിച്ച സജീവ സേവനദാതാവിനെയോ തൊഴിലാളിയെയോ BhoomiMitra ഡാറ്റാബേസിൽ കണ്ടെത്താനായില്ല.",
        "",
        safeQuery.localBody
          ? "Local Body: " +
            safeQuery.localBody
          : "",
        safeQuery.district
          ? "District: " +
            safeQuery.district
          : "",
        "",
        "മറ്റൊരു സേവനനാമമോ സമീപ പ്രദേശമോ ഉപയോഗിച്ച് വീണ്ടും ചോദിക്കാം.",
        "",
        "Source: BhoomiMitra verified service directory"
      ]
        .filter(function (line) {
          return line !== "";
        })
        .join("\n");
    }

    const selected =
      results.slice(0, 5);

    const lines = [
      "🔎 BhoomiMitra Service Search",
      "",
      "Service: " +
        (
          requestedService ||
          safeQuery.service ||
          "-"
        ),
      "",
     selected.length +
  " result(s) found."
    ];

    selected.forEach(function (
      record,
      index
    ) {
      lines.push(
        "",
        (index + 1) +
          ". " +
          record.name,

        "Category: " +
          record.directoryType,

        "Service/Skill: " +
          (
            record.service ||
            "-"
          ),

        "District: " +
          (
            record.district ||
            "-"
          ),

        "Local Body: " +
          (
            record.localBody ||
            "-"
          ),

        "Mobile/WhatsApp: " +
          (
            record.whatsapp ||
            record.mobile ||
            "-"
          )
      );

    if (
  record.directoryType ===
  "Public Internet Provider"
) {
  lines.push(
    "🌐 Public Internet Listing",
    "Status: Not verified by BhoomiMitra/KVK",
    "Availability and service conditions: confirm directly with provider"
  );
} else {
  lines.push(
    "✅ BhoomiMitra/KVK Verified Provider",
    "Status: Verified & Active"
  );
}
    });

    lines.push(
  "",
  "Note: BhoomiMitra/KVK does not fix rates. Charges, availability and service conditions shall be confirmed directly with the provider."
);

    return lines.join("\n");
  }

  return {
    readDirectory,
    searchServices,
    formatServiceResults
  };
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  createServiceFinder,
  normalizeText,
  normalizeHeader,
  resolveRequestedService,
  isServiceRequest,
  matchesService,
  isVerifiedActive,
  getLocationRank
};
