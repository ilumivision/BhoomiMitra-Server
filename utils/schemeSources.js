"use strict";

const SOURCE_SUPPORT = Object.freeze({
  HTML_SINGLE: "html_single",
  CUSTOM_ADAPTER_REQUIRED: "custom_adapter_required",
  TEMPORARILY_UNAVAILABLE: "temporarily_unavailable"
});

const OFFICIAL_SCHEME_SOURCES = Object.freeze([
  {
    id: "CENTRAL_MYSCHEME",
    name: "myScheme",
    level: "Central",
    department: "Government of India",
    category: "Multi-category",
    url: "https://www.myscheme.gov.in/search/category/Agriculture%2CRural%20%26%20Environment",
    allowedHosts: ["myscheme.gov.in", "www.myscheme.gov.in"],
    support: SOURCE_SUPPORT.CUSTOM_ADAPTER_REQUIRED,
    reason: "The search catalogue is a dynamic application and needs an approved structured-data adapter."
  },
  {
    id: "CENTRAL_AGRIWELFARE",
    name: "Ministry of Agriculture & Farmers Welfare",
    level: "Central",
    department: "Ministry of Agriculture & Farmers Welfare",
    category: "Agriculture",
    url: "https://agriwelfare.gov.in/",
    allowedHosts: ["agriwelfare.gov.in", "www.agriwelfare.gov.in"],
    support: SOURCE_SUPPORT.CUSTOM_ADAPTER_REQUIRED,
    reason: "The ministry portal spans several document formats and needs scheme-specific adapters."
  },
  {
    id: "CENTRAL_PM_KISAN",
    name: "PM-KISAN",
    level: "Central",
    department: "Department of Agriculture & Farmers Welfare",
    category: "Financial Support",
    url: "https://pmkisan.gov.in/",
    allowedHosts: ["pmkisan.gov.in", "www.pmkisan.gov.in"],
    support: SOURCE_SUPPORT.TEMPORARILY_UNAVAILABLE,
    reason: "The endpoint currently fails standard TLS certificate verification; TLS checks will not be bypassed."
  },
  {
    id: "CENTRAL_PMFBY",
    name: "Pradhan Mantri Fasal Bima Yojana",
    level: "Central",
    department: "Department of Agriculture & Farmers Welfare",
    category: "Insurance",
    url: "https://pmfby.gov.in/",
    allowedHosts: ["pmfby.gov.in", "www.pmfby.gov.in"],
    support: SOURCE_SUPPORT.CUSTOM_ADAPTER_REQUIRED,
    reason: "Current official details are distributed across portal pages and documents."
  },
  {
    id: "CENTRAL_HORTICULTURE",
    name: "Mission for Integrated Development of Horticulture",
    level: "Central",
    department: "Department of Agriculture & Farmers Welfare",
    category: "Horticulture",
    url: "https://midh.gov.in/",
    allowedHosts: ["midh.gov.in", "www.midh.gov.in"],
    support: SOURCE_SUPPORT.CUSTOM_ADAPTER_REQUIRED,
    reason: "A document-aware adapter is required for the official programme material."
  },
  {
    id: "CENTRAL_LIVESTOCK",
    name: "Department of Animal Husbandry and Dairying schemes",
    level: "Central",
    department: "Department of Animal Husbandry and Dairying",
    category: "Livestock",
    url: "https://dahd.gov.in/schemes/programmes",
    allowedHosts: ["dahd.gov.in", "www.dahd.gov.in"],
    support: SOURCE_SUPPORT.CUSTOM_ADAPTER_REQUIRED,
    reason: "The programme catalogue needs a department-specific listing and detail adapter."
  },
  {
    id: "CENTRAL_FISHERIES",
    name: "Department of Fisheries schemes",
    level: "Central",
    department: "Department of Fisheries",
    category: "Fisheries",
    url: "https://www.dof.gov.in/offerings",
    allowedHosts: ["dof.gov.in", "www.dof.gov.in", "pmmsy.dof.gov.in", "www.pmmsy.dof.gov.in"],
    support: SOURCE_SUPPORT.CUSTOM_ADAPTER_REQUIRED,
    reason: "The offerings portal needs scheme-specific detail adapters."
  },
  {
    id: "CENTRAL_FARM_MECHANIZATION",
    name: "Direct Benefit Transfer in Agriculture Mechanization",
    schemeName: "Sub-Mission on Agricultural Mechanization (SMAM)",
    level: "Central",
    department: "Department of Agriculture & Farmers Welfare",
    category: "Farm Machinery",
    subcategory: "Mechanization",
    url: "https://agrimachinery.nic.in/",
    applicationUrl: "https://agrimachinery.nic.in/",
    allowedHosts: ["agrimachinery.nic.in", "www.agrimachinery.nic.in"],
    stateApplicability: "India",
    support: SOURCE_SUPPORT.HTML_SINGLE,
    parser: {
      expectedText: "Agriculture Mechanization",
      contentSelector: "body",
      summarySelector: "p"
    }
  },
  {
    id: "CENTRAL_IRRIGATION",
    name: "Pradhan Mantri Krishi Sinchayee Yojana",
    level: "Central",
    department: "Government of India",
    category: "Irrigation",
    url: "https://pmksy.gov.in/",
    allowedHosts: ["pmksy.gov.in", "www.pmksy.gov.in"],
    support: SOURCE_SUPPORT.CUSTOM_ADAPTER_REQUIRED,
    reason: "The multi-component portal needs programme-specific adapters."
  },
  {
    id: "CENTRAL_NABARD",
    name: "NABARD agriculture support programmes",
    level: "Central",
    department: "National Bank for Agriculture and Rural Development",
    category: "Financial Support",
    url: "https://www.nabard.org/",
    allowedHosts: ["nabard.org", "www.nabard.org"],
    support: SOURCE_SUPPORT.CUSTOM_ADAPTER_REQUIRED,
    reason: "NABARD programme pages need explicit programme-level adapters."
  },
  {
    id: "KERALA_AGRICULTURE",
    name: "Kerala Agriculture Department annual schemes",
    level: "Kerala",
    department: "Agriculture Development and Farmers Welfare Department",
    category: "Agriculture",
    url: "https://keralaagriculture.gov.in/",
    allowedHosts: ["keralaagriculture.gov.in", "www.keralaagriculture.gov.in"],
    support: SOURCE_SUPPORT.CUSTOM_ADAPTER_REQUIRED,
    reason: "Current scheme details are primarily published in annual-plan PDFs."
  },
  {
    id: "KERALA_SHM_MIDH",
    name: "State Horticulture Mission Kerala scheme details",
    schemeName: "Mission for Integrated Development of Horticulture (MIDH) - Kerala",
    level: "Kerala",
    department: "State Horticulture Mission Kerala",
    category: "Horticulture",
    url: "https://shm.kerala.gov.in/scheme-details/",
    allowedHosts: ["shm.kerala.gov.in"],
    stateApplicability: "Kerala",
    support: SOURCE_SUPPORT.HTML_SINGLE,
    parser: {
      expectedText: "Mission for Integrated Development of Horticulture",
      contentSelector: ".entry-content, main, body",
      summarySelector: "p"
    }
  },
  {
    id: "KERALA_ANIMAL_HUSBANDRY",
    name: "Kerala Animal Husbandry schemes",
    level: "Kerala",
    department: "Animal Husbandry Department Kerala",
    category: "Livestock",
    url: "https://ahd.kerala.gov.in/en/centrally-sponsored-schemes/",
    allowedHosts: ["ahd.kerala.gov.in"],
    support: SOURCE_SUPPORT.TEMPORARILY_UNAVAILABLE,
    reason: "The public page timed out during the pilot endpoint audit."
  },
  {
    id: "KERALA_DAIRY",
    name: "Kerala Dairy Development schemes",
    level: "Kerala",
    department: "Dairy Development Department Kerala",
    category: "Dairy",
    url: "https://dairydevelopment.kerala.gov.in/Eng/",
    allowedHosts: ["dairydevelopment.kerala.gov.in", "www.dairydevelopment.kerala.gov.in"],
    support: SOURCE_SUPPORT.CUSTOM_ADAPTER_REQUIRED,
    reason: "The portal is fetchable, but schemes are split across news, forms, and DPR documents."
  },
  {
    id: "KERALA_FISHERIES",
    name: "Kerala Fisheries schemes",
    level: "Kerala",
    department: "Fisheries Department Kerala",
    category: "Fisheries",
    url: "https://fisheries.kerala.gov.in/index.php/en/schemes",
    allowedHosts: ["fisheries.kerala.gov.in"],
    support: SOURCE_SUPPORT.TEMPORARILY_UNAVAILABLE,
    reason: "The official URL currently redirects to an account-suspended page."
  },
  {
    id: "KERALA_LOCAL_GOVERNMENT",
    name: "Kerala local-government agriculture missions",
    level: "Kerala",
    department: "Local Self Government Department Kerala",
    category: "Local Government Support",
    url: "https://lsgkerala.gov.in/en",
    allowedHosts: ["lsgkerala.gov.in", "www.lsgkerala.gov.in"],
    support: SOURCE_SUPPORT.CUSTOM_ADAPTER_REQUIRED,
    reason: "Relevant programmes need an explicit allowlist and programme-specific adapters."
  },
  {
    id: "KERALA_FARM_MECHANIZATION",
    name: "Kerala farm mechanization schemes",
    level: "Kerala",
    department: "Agriculture Development and Farmers Welfare Department",
    category: "Farm Machinery",
    url: "https://kerala.gov.in/",
    allowedHosts: ["kerala.gov.in", "www.kerala.gov.in"],
    support: SOURCE_SUPPORT.TEMPORARILY_UNAVAILABLE,
    reason: "The identified official scheme article returned HTTP 503 during the pilot audit."
  }
]);

function supportedSchemeSources(sources) {
  return (sources || OFFICIAL_SCHEME_SOURCES).filter(function (source) {
    return source.support === SOURCE_SUPPORT.HTML_SINGLE;
  });
}

function sourceById(sourceId, sources) {
  const target = String(sourceId || "").trim().toUpperCase();
  return (sources || OFFICIAL_SCHEME_SOURCES).find(function (source) {
    return source.id.toUpperCase() === target;
  }) || null;
}

module.exports = {
  OFFICIAL_SCHEME_SOURCES,
  SOURCE_SUPPORT,
  sourceById,
  supportedSchemeSources
};
