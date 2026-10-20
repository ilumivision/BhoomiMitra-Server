"use strict";

const {
  getAccessibleLandBoundaryStatus,
  getLandBoundaryMapData
} = require("./landBoundary");

async function getAccessibleLand(options) {
  const input = options || {};
  const readAccessStatus =
    input.getAccessibleLandBoundaryStatus ||
    getAccessibleLandBoundaryStatus;
  const readMapData =
    input.getLandBoundaryMapData ||
    getLandBoundaryMapData;
  const request = {
    sheets: input.sheets,
    spreadsheetId: input.spreadsheetId,
    landId: input.landId,
    farmerId: input.farmerId || "",
    whatsapp: input.whatsapp || ""
  };

  const accessStatus = await readAccessStatus(request);

  if (!accessStatus || !accessStatus.success) {
    return {
      success: false,
      error: accessStatus && accessStatus.error
        ? accessStatus.error
        : "You do not have access to this land."
    };
  }

  if (accessStatus.mappingStatus !== "COMPLETED") {
    return {
      success: false,
      error: "Boundary mapping has not yet been completed for this land."
    };
  }

  // Map retrieval performs its own authorization check. Preserve the
  // verified identity so that check can succeed only for the same caller.
  const land = await readMapData(request);

  if (!land || !land.success) {
    return {
      success: false,
      error: land && land.error
        ? land.error
        : "Land information could not be loaded."
    };
  }

  return {
    success: true,
    accessType: accessStatus.accessType,
    accessLevel: accessStatus.accessLevel,
    land
  };
}

module.exports = {
  getAccessibleLand
};
