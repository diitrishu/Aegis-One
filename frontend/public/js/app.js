// Main Initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing Smart City Dashboard...");

    const mapController = new MapController();
    const uiController = new UIController();

    // Initialize Map
    mapController.init();

    // Initialize UI and Bind to Map Update
    uiController.init((scenario, agencies) => {
        console.log("State Changed:", { scenario, agencies });
        mapController.updateLayers(scenario, agencies);
    });

    // CRITICAL: Do NOT trigger initial state to ensure zero layers load on startup
    // Layers will only load when user explicitly selects them
    console.log("Dashboard ready. Basemap loaded. No WMS layers preloaded.");
});
