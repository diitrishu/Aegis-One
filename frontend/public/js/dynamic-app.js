/**
 * Dynamic Disaster Response Dashboard - Main Application
 * Production-grade Web GIS with on-demand layer loading
 */

class DisasterResponseApp {
    constructor() {
        this.map = null;
        this.baseLayer = null;
        this.layerManager = null;
        this.drawingManager = null;
        this.spatialAnalysisEngine = null;
        this.bufferVisualizationManager = null;
        this.routeOptimizationEngine = null;
        this.routeVisualizationManager = null;
        this.dataLayerManager = null;
        this.measurementTools = null;
        this.offlineCacheManager = null;
        this.realTimeDataManager = null;
        this.reportingManager = null;
        this.coordinateTools = null;
        this.dataLayerUI = null;
        this.strategicAnalysisManager = null;
        this.ui = null;
        this.isInitialized = false;
        
        this.initializeApp();
    }

    /**
     * Initialize the complete application
     */
    async initializeApp() {
        try {
            console.log('🚀 Initializing Dynamic Disaster Response Dashboard...');
            
            // Initialize map first
            this.initializeMap();
            
            // Initialize layer manager
            this.layerManager = new DynamicLayerManager(this.map, DynamicConfig);
            
            // Initialize spatial analysis engine
            try {
                this.spatialAnalysisEngine = new SpatialAnalysisEngine(this.map, DynamicConfig);
                console.log('✅ Spatial analysis engine initialized');
            } catch (analysisError) {
                console.warn('⚠️ Spatial analysis engine failed to initialize:', analysisError.message);
                console.log('📍 Dashboard will work without advanced analysis functionality');
            }
            
            // Initialize buffer visualization manager (even if spatial analysis failed)
            try {
                console.log('🔧 Attempting to create BufferVisualizationManager...');
                console.log('Map available:', !!this.map);
                console.log('Spatial engine available:', !!this.spatialAnalysisEngine);
                console.log('Config available:', !!DynamicConfig);
                console.log('Layer manager available:', !!this.layerManager);
                
                this.bufferVisualizationManager = new BufferVisualizationManager(
                    this.map, 
                    this.spatialAnalysisEngine, 
                    DynamicConfig,
                    this.layerManager
                );
                console.log('✅ Buffer visualization manager initialized');
            } catch (bufferError) {
                console.error('❌ Buffer visualization manager failed to initialize:', bufferError);
                console.error('Error stack:', bufferError.stack);
                console.log('📍 Dashboard will work without buffer analysis functionality');
            }
            
            // Initialize route optimization system
            try {
                console.log('🔧 Attempting to create RouteOptimizationEngine...');
                
                this.routeOptimizationEngine = new RouteOptimizationEngine(
                    this.map,
                    this.spatialAnalysisEngine,
                    DynamicConfig
                );
                console.log('✅ Route optimization engine initialized');
                
                this.routeVisualizationManager = new RouteVisualizationManager(
                    this.map,
                    this.routeOptimizationEngine,
                    DynamicConfig
                );
                console.log('✅ Route visualization manager initialized');
            } catch (routeError) {
                console.error('❌ Route optimization system failed to initialize:', routeError);
                console.error('Error stack:', routeError.stack);
                console.log('📍 Dashboard will work without route optimization functionality');
            }

            // Initialize data layer manager
            try {
                this.dataLayerManager = new DataLayerManager(this.map, DynamicConfig);
                console.log('✅ Data layer manager initialized');
                this.dataLayerUI = new DataLayerUI(this.dataLayerManager);
            } catch (dataError) {
                console.warn('⚠️ Data layer manager failed to initialize:', dataError.message);
            }

            // Initialize measurement tools
            try {
                this.measurementTools = new MeasurementTools(this.map, DynamicConfig);
                console.log('✅ Measurement tools initialized');
            } catch (measureError) {
                console.warn('⚠️ Measurement tools failed to initialize:', measureError.message);
            }

            // Initialize offline cache manager
            try {
                this.offlineCacheManager = new OfflineCacheManager(this.map, DynamicConfig);
                console.log('✅ Offline cache manager initialized');
            } catch (offlineError) {
                console.warn('⚠️ Offline cache manager failed to initialize:', offlineError.message);
            }

            // Initialize real-time data manager
            try {
                this.realTimeDataManager = new RealTimeDataManager(DynamicConfig);
                console.log('✅ Real-time data manager initialized');
            } catch (rtError) {
                console.warn('⚠️ Real-time data manager failed to initialize:', rtError.message);
            }

            // Initialize reporting/export manager
            try {
                this.reportingManager = new ReportingManager(this.map, DynamicConfig, this.dataLayerManager);
                console.log('✅ Reporting manager initialized');
            } catch (reportError) {
                console.warn('⚠️ Reporting manager failed to initialize:', reportError.message);
            }

            // Initialize coordinate tools
            try {
                this.coordinateTools = new CoordinateTools(this.map, DynamicConfig);
                console.log('✅ Coordinate tools initialized');
            } catch (coordError) {
                console.warn('⚠️ Coordinate tools failed to initialize:', coordError.message);
            }

            // Initialize strategic analysis manager
            try {
                this.strategicAnalysisManager = new StrategicAnalysisManager(
                    this.map,
                    this.spatialAnalysisEngine,
                    this.dataLayerManager,
                    DynamicConfig
                );
                console.log('✅ Strategic analysis manager initialized');
            } catch (analysisError) {
                console.warn('⚠️ Strategic analysis manager failed to initialize:', analysisError.message);
            }
            
            // Initialize drawing manager (with better error handling)
            if (typeof L !== 'undefined' && typeof L.Control !== 'undefined' && typeof L.Control.Draw !== 'undefined') {
                try {
                    this.drawingManager = new DisasterDrawingManager(this.map, DynamicConfig);
                    console.log('✅ Drawing system initialized');
                } catch (drawError) {
                    console.warn('⚠️ Drawing system failed to initialize:', drawError.message);
                    console.log('📍 Dashboard will work without drawing functionality');
                    this.hideDrawingUI();
                }
            } else {
                console.warn('⚠️ Leaflet.Draw not available - drawing functionality disabled');
                this.hideDrawingUI();
            }
            
            // Initialize UI
            this.ui = new DynamicUI(this.layerManager, DynamicConfig);
            
            // Make components globally accessible for integration
            window.dynamicLayerManager = this.layerManager;
            window.spatialAnalysisEngine = this.spatialAnalysisEngine;
            window.bufferVisualizationManager = this.bufferVisualizationManager;
            window.routeOptimizationEngine = this.routeOptimizationEngine;
            window.routeVisualizationManager = this.routeVisualizationManager;
            window.dataLayerManager = this.dataLayerManager;
            window.measurementTools = this.measurementTools;
            window.offlineCacheManager = this.offlineCacheManager;
            window.realTimeDataManager = this.realTimeDataManager;
            window.reportingManager = this.reportingManager;
            window.coordinateTools = this.coordinateTools;
            window.dataLayerUI = this.dataLayerUI;
            window.strategicAnalysisManager = this.strategicAnalysisManager;
            
            // Setup additional event listeners
            this.setupEventListeners();
            
            // Test server connection
            await this.testServerConnection();
            
            this.isInitialized = true;
            console.log('✅ Dashboard initialized successfully');
            
            // Show welcome message
            this.showWelcomeMessage();
            
        } catch (error) {
            console.error('❌ Failed to initialize dashboard:', error);
            this.showErrorMessage('Failed to initialize dashboard. Please check server connection.');
        }
    }

    /**
     * Initialize the Leaflet map with base layer only
     */
    initializeMap() {
        console.log('🗺️ Initializing map...');
        
        // Create map instance
        this.map = L.map('map', {
            center: DynamicConfig.map.center,
            zoom: DynamicConfig.map.zoom,
            minZoom: DynamicConfig.map.minZoom,
            maxZoom: DynamicConfig.map.maxZoom,
            zoomControl: true,
            attributionControl: true
        });

        // Add ONLY the base layer (no GIS layers)
        this.addBaseLayer();
        
        // Setup map event listeners
        this.setupMapEventListeners();
        
        console.log('✅ Map initialized with base layer only');
    }

    /**
     * Add base layer to map (frontend-only, no backend dependency)
     */
    addBaseLayer() {
        const baseLayerConfig = DynamicConfig.baseLayers.default;
        
        this.baseLayer = L.tileLayer(baseLayerConfig.url, {
            attribution: baseLayerConfig.attribution,
            maxZoom: baseLayerConfig.maxZoom,
            tileSize: DynamicConfig.performance.tileSize,
            updateWhenIdle: DynamicConfig.performance.updateWhenIdle,
            updateWhenZooming: DynamicConfig.performance.updateWhenZooming
        });

        this.baseLayer.addTo(this.map);
        console.log('🗺️ Base layer loaded from frontend');
    }

    /**
     * Setup map event listeners
     */
    setupMapEventListeners() {
        // Map click for feature identification
        this.map.on('click', (e) => {
            document.dispatchEvent(new CustomEvent('mapClick', {
                detail: {
                    latlng: e.latlng,
                    layerPoint: e.layerPoint,
                    containerPoint: e.containerPoint
                }
            }));
        });

        // Map move events
        this.map.on('moveend', (e) => {
            document.dispatchEvent(new CustomEvent('mapMoveEnd', {
                detail: {
                    center: this.map.getCenter(),
                    zoom: this.map.getZoom(),
                    bounds: this.map.getBounds()
                }
            }));
        });

        // Map zoom events
        this.map.on('zoomend', (e) => {
            this.updateZoomDependentLayers();
        });

        // Map load event
        this.map.on('load', () => {
            console.log('🗺️ Map fully loaded');
        });
    }

    /**
     * Setup additional event listeners
     */
    setupEventListeners() {
        // Base layer change event
        document.addEventListener('baseLayerChange', (e) => {
            this.switchBaseLayer(e.detail.layerKey, e.detail.layerConfig);
        });

        // Window resize event
        document.addEventListener('windowResize', () => {
            this.map.invalidateSize();
        });

        // Visibility change (tab switching)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.map) {
                this.map.invalidateSize();
            }
        });

        // Error handling
        window.addEventListener('error', (e) => {
            console.error('🚨 Global error:', e.error);
            this.handleGlobalError(e.error);
        });

        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            console.error('🚨 Unhandled promise rejection:', e.reason);
            this.handleGlobalError(e.reason);
        });
    }

    /**
     * Switch base layer
     */
    switchBaseLayer(layerKey, layerConfig) {
        if (this.baseLayer) {
            this.map.removeLayer(this.baseLayer);
        }

        this.baseLayer = L.tileLayer(layerConfig.url, {
            attribution: layerConfig.attribution,
            maxZoom: layerConfig.maxZoom,
            tileSize: DynamicConfig.performance.tileSize,
            updateWhenIdle: DynamicConfig.performance.updateWhenIdle,
            updateWhenZooming: DynamicConfig.performance.updateWhenZooming
        });

        this.baseLayer.addTo(this.map);
        console.log(`🗺️ Switched to base layer: ${layerConfig.name}`);
    }

    /**
     * Test server connection
     */
    async testServerConnection() {
        try {
            this.layerManager.updateServerStatus('loading');
            
            const testUrl = `${DynamicConfig.server.baseUrl}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=${DynamicConfig.wms.version}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), DynamicConfig.server.timeout);
            
            const response = await fetch(testUrl, {
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (response.ok) {
                this.layerManager.updateServerStatus('connected');
                console.log('✅ QGIS Server connection successful');
                return true;
            } else {
                throw new Error(`Server responded with status: ${response.status}`);
            }

        } catch (error) {
            console.error('❌ Server connection failed:', error);
            this.layerManager.updateServerStatus('error');
            
            if (error.name === 'AbortError') {
                this.showErrorMessage('Server connection timeout. Please check if QGIS Server is running.');
            } else {
                this.showErrorMessage(`Server connection failed: ${error.message}`);
            }
            
            return false;
        }
    }

    /**
     * Update zoom-dependent layers
     */
    updateZoomDependentLayers() {
        const currentZoom = this.map.getZoom();
        
        // Example: Hide detailed layers at low zoom levels
        if (currentZoom < 10) {
            // Could implement logic to hide/show layers based on zoom
            console.log(`🔍 Zoom level: ${currentZoom} - Consider hiding detailed layers`);
        }
    }

    /**
     * Hide drawing UI when not available
     */
    hideDrawingUI() {
        const drawingToggle = document.getElementById('toggle-drawing');
        const drawingPanel = document.getElementById('drawing-panel');
        
        if (drawingToggle) {
            drawingToggle.style.display = 'none';
        }
        
        if (drawingPanel) {
            drawingPanel.style.display = 'none';
        }
        
        console.log('🚫 Drawing UI hidden in main app');
    }

    /**
     * Show welcome message
     */
    showWelcomeMessage() {
        const welcomeMessage = `
            🚨 <strong>Dynamic Disaster Response Dashboard</strong><br>
            📍 Focused on Uttar Pradesh, India<br>
            🎯 <strong>Key Features:</strong><br>
            • Zero preloaded layers - all on-demand<br>
            • Real-time WMS layer loading<br>
            • Emergency services mapping<br>
            • Performance monitoring<br><br>
            <strong>Quick Start:</strong><br>
            ✅ Toggle emergency services (hospitals, fire, police)<br>
            ✅ Select disaster scenarios<br>
            ✅ Use Ctrl+C to clear all layers<br>
            ✅ Use Ctrl+R to refresh server
        `;
        
        this.layerManager.showLayerInfo(welcomeMessage);
    }

    /**
     * Show error message
     */
    showErrorMessage(message) {
        this.layerManager.showLayerInfo(`❌ ${message}`, 'error');
    }

    /**
     * Handle global errors
     */
    handleGlobalError(error) {
        if (DynamicConfig.debug.enabled) {
            console.error('🚨 Global error handler:', error);
        }
        
        // Don't show error messages for minor issues
        if (error.message && !error.message.includes('ResizeObserver')) {
            this.showErrorMessage(`Application error: ${error.message}`);
        }
    }

    /**
     * Get application status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            mapReady: !!this.map,
            serverConnected: this.layerManager?.activeLayers?.size >= 0,
            activeLayers: this.layerManager?.getActiveLayerInfo() || [],
            performance: {
                wmsRequests: this.layerManager?.wmsRequestCount || 0,
                memoryUsage: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : 'N/A'
            }
        };
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.map) {
            this.map.remove();
        }
        
        // Clear any intervals or timeouts
        // Remove event listeners
        
        console.log('🧹 Dashboard resources cleaned up');
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 DOM Content Loaded - checking dependencies...');
    console.log('Turf available:', typeof turf !== 'undefined');
    console.log('Proj4 available:', typeof proj4 !== 'undefined');
    console.log('MGRS available:', typeof mgrs !== 'undefined');
    console.log('Leaflet available:', typeof L !== 'undefined');
    
    // Global app instance
    window.DisasterApp = new DisasterResponseApp();
    
    // Expose for debugging
    if (DynamicConfig.debug.enabled) {
        window.DynamicConfig = DynamicConfig;
        console.log('🔧 Debug mode enabled - Config available as window.DynamicConfig');
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.DisasterApp) {
        window.DisasterApp.destroy();
    }
});
