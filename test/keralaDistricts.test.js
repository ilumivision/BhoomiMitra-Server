const test = require("node:test");
const assert = require("node:assert/strict");
const detectKeralaDistrict = require("../utils/keralaDistricts");

const districts = [
  ["Thiruvananthapuram", "തിരുവനന്തപുരം"],
  ["Kollam", "കൊല്ലം"],
  ["Pathanamthitta", "പത്തനംതിട്ട"],
  ["Alappuzha", "ആലപ്പുഴ"],
  ["Kottayam", "കോട്ടയം"],
  ["Idukki", "ഇടുക്കി"],
  ["Ernakulam", "എറണാകുളം"],
  ["Thrissur", "തൃശ്ശൂർ"],
  ["Palakkad", "പാലക്കാട്"],
  ["Malappuram", "മലപ്പുറം"],
  ["Kozhikode", "കോഴിക്കോട്"],
  ["Wayanad", "വയനാട്"],
  ["Kannur", "കണ്ണൂർ"],
  ["Kasaragod", "കാസർഗോഡ്"]
];

test("recognizes all canonical English Kerala district names", function () {
  for (const [english] of districts) {
    assert.equal(
      detectKeralaDistrict("Weather forecast for " + english + " please"),
      english
    );
  }
});

test("recognizes all Malayalam Kerala district names inside sentences", function () {
  for (const [english, malayalam] of districts) {
    assert.equal(
      detectKeralaDistrict(malayalam + "യിലെ അടുത്ത 3 ദിവസത്തെ കാലാവസ്ഥ പറയൂ"),
      english
    );
  }
});

test("recognizes supported common English district variants", function () {
  const variants = [
    ["Trivandrum", "Thiruvananthapuram"],
    ["Alleppey", "Alappuzha"],
    ["Calicut", "Kozhikode"],
    ["Kasargod", "Kasaragod"]
  ];

  for (const [variant, canonical] of variants) {
    assert.equal(
      detectKeralaDistrict("Weather in " + variant),
      canonical
    );
  }
});

test("returns null when no Kerala district is present", function () {
  assert.equal(
    detectKeralaDistrict("അടുത്ത 3 ദിവസത്തെ കാലാവസ്ഥ പറയൂ"),
    null
  );
});
