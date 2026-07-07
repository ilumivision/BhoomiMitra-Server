async function servicesModule(data) {
    return {
        success: true,
        module: "SERVICES",
        reply: "Service module is working. BhoomiMitra can handle experts, consultants, workers, machinery, nurseries, planting material suppliers, input dealers, transport and institutions."
    };
}
module.exports = servicesModule;
