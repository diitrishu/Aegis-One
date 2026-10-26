class MapController {
    constructor() {
        this.map = null;
        this.currentLayers = {};
        this.baseLayer = null;
    }

    init() {
        // Initialize Leaflet Map
        this.map = L.map('map').setView(AppConfig.mapCenter, AppConfig.zoomLevel);

        // Add Base Layer
        this.baseLayer = L.tileLayer(AppConfig.baseLayerUrl, {
            attribution: AppConfig.baseLayerAttribution,
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(this.map);

        console.log("Map Initialized");
    }

    /**
     * Updates the visible WMS layers based on selection
     * @param {string} scenarioLayerName - The simplified name of the disaster layer (or empty)
     * @param {Array<string>} agencyLayerNames - List of agency layer names to show
     */
    updateLayers(scenarioLayerName, agencyLayerNames) {
        // 1. Clear existing WMS layers to prevent duplication/stacking issues
        // In a more complex app, we might check what is already there, but clearing is safer for this scope.
        Object.values(this.currentLayers).forEach(layer => {
            this.map.removeLayer(layer);
        });
        this.currentLayers = {};

        // 2. Add Disaster Scenario Layer if selected
        if (scenarioLayerName) {
            this.addWmsLayer(scenarioLayerName, 10); // Z-index 10 (bottom of overlays)
        }

        // 3. Add Agency Layers
        agencyLayerNames.forEach(layerName => {
            this.addWmsLayer(layerName, 20); // Z-index 20 (on top of disaster)
        });
    }

    addWmsLayer(layerName, zIndex) {
        // QGIS Server WMS URL
        const wmsLayer = L.tileLayer.wms(AppConfig.wmsUrl, {
            layers: layerName,
            format: 'image/png',
            transparent: true,
            version: '1.3.0',
            detectRetina: true,
            zIndex: zIndex
        });

        wmsLayer.addTo(this.map);
        this.currentLayers[layerName] = wmsLayer;
    }
}
