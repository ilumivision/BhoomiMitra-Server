"use strict";

async function registerLand(data) {

  console.log("Registering land...");

  console.log(data);

  return {
    success: true,
    landId: "LAND-TEMP"
  };

}

module.exports = {
  registerLand
};
