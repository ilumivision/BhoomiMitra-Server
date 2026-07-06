async function weatherModule(data) {
    return {
        success: true,
        module: "WEATHER",
        reply: "Weather module is working."
    };
}
module.exports = weatherModule;
