/**
 * Dynamic UI Management
 * Handles user interface interactions and updates
 */

class DynamicUI {
    constructor(layerManager, config) {
        this.layerManager = layerManager;
        this.config = config;
        this.isInitialized = false;

        this.initializeUI();
    }

    /**
     * Initialize UI components
     */
    initializeUI() {
        this.setupEventListeners();
        this.initializeTooltips();
        this.setupKeyboardShortcuts();
        this.startPerformanceMonitoring();

        this.isInitialized = true;
        console.log('🎨 Dynamic UI initialized');
    }

    /**
     * Setup additional event listeners
     */
    setupEventListeners() {
        // Base layer switcher (if implemented)
        this.setupBaseLayerSwitcher();

        // Disaster scenario selector
        this.setupDisasterScenarioSelector();

        // Map event listeners
        this.setupMapEventListeners();

        // Window resize handler
        window.addEventListener('resize', this.handleResize.bind(this));

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
    }

    /**
     * Setup base layer switcher
     */
    setupBaseLayerSwitcher() {
        // Create base layer control if multiple base layers are configured
        const baseLayerKeys = Object.keys(this.config.baseLayers);
        if (baseLayerKeys.length > 1) {
            this.createBaseLayerControl(baseLayerKeys);
        }
    }

    /**
     * Create base layer control
     */
    createBaseLayerControl(layerKeys) {
        const controlContainer = document.createElement('div');
        controlContainer.className = 'base-layer-control';
        controlContainer.innerHTML = `
            <h4>Base Maps</h4>
            <div class="base-layer-options">
                ${layerKeys.map(key => `
                    <label class="base-layer-option">
                        <input type="radio" name="base-layer" value="${key}" ${key === 'default' ? 'checked' : ''}>
                        <span>${this.config.baseLayers[key].name}</span>
                    </label>
                `).join('')}
            </div>
        `;

        // Add to control panel
        const controlPanel = document.querySelector('.control-panel');
        if (controlPanel) {
            const baseSection = document.createElement('div');
            baseSection.className = 'control-section';
            baseSection.appendChild(controlContainer);
            controlPanel.appendChild(baseSection);
        }

        // Add event listeners
        controlContainer.querySelectorAll('input[name="base-layer"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.switchBaseLayer(e.target.value);
            });
        });
    }

    /**
     * Switch base layer
     */
    switchBaseLayer(layerKey) {
        const layerConfig = this.config.baseLayers[layerKey];
        if (!layerConfig) return;

        // This would need to be implemented in the main app
        // For now, just log the change
        console.log(`🗺️ Switching to base layer: ${layerConfig.name}`);

        // Emit custom event for main app to handle
        document.dispatchEvent(new CustomEvent('baseLayerChange', {
            detail: { layerKey, layerConfig }
        }));
    }

    /**
     * Setup disaster scenario selector
     */
    setupDisasterScenarioSelector() {
        const disasterSelector = document.getElementById('disaster-selector');
        if (!disasterSelector) return;

        disasterSelector.addEventListener('change', (e) => {
            this.handleDisasterScenarioChange(e.target.value);
        });

        console.log('✅ Disaster scenario selector initialized');
    }

    /**
     * Handle disaster scenario selection
     */
    handleDisasterScenarioChange(scenarioType) {
        if (!scenarioType) {
            console.log('🔄 Disaster scenario cleared');
            // Use toast notification if available
            if (window.toast) {
                window.toast.info('Disaster scenario cleared');
            }
            return;
        }

        console.log(`🌊 Loading disaster scenario: ${scenarioType}`);

        // Show info about disaster scenarios (these connect to real data when available)
        const scenarioNames = {
            'flood': 'Flood Risk Analysis',
            'fire': 'Fire Risk Assessment',
            'earthquake': 'Earthquake Impact Modeling',
            'landslide': 'Landslide Susceptibility'
        };

        const scenarioName = scenarioNames[scenarioType] || scenarioType;

        // Use toast notification for feedback
        if (window.toast) {
            window.toast.info(`${scenarioName}: showing the ${scenarioType} risk layer`);
        } else {
            this.layerManager.showLayerInfo(`ℹ️ ${scenarioName}: showing the ${scenarioType} risk layer`);
        }
    }

    /**
     * Setup map event listeners
     */
    setupMapEventListeners() {
        // Map click handler for feature identification
        document.addEventListener('mapClick', (e) => {
            this.handleMapClick(e.detail);
        });

        // Map zoom/pan handlers
        document.addEventListener('mapMoveEnd', (e) => {
            this.updateMapInfo(e.detail);
        });
    }

    /**
     * Handle map click for feature identification
     */
    handleMapClick(clickData) {
        const { latlng, layerPoint } = clickData;

        // Get active queryable layers
        const queryableLayers = this.layerManager.getActiveLayerInfo()
            .filter(layer => this.config.layers[layer.name]?.queryable);

        if (queryableLayers.length === 0) return;

        // Perform GetFeatureInfo request
        this.performFeatureQuery(latlng, queryableLayers);
    }

    /**
     * Perform WMS GetFeatureInfo query
     */
    async performFeatureQuery(latlng, layers) {
        try {
            this.layerManager.showLoadingIndicator(true);

            const layerNames = layers.map(l => l.name).join(',');
            const map = this.layerManager.map;
            const bounds = map.getBounds();
            const size = map.getSize();

            const params = new URLSearchParams({
                SERVICE: 'WMS',
                VERSION: this.config.wms.version,
                REQUEST: 'GetFeatureInfo',
                LAYERS: layerNames,
                QUERY_LAYERS: layerNames,
                STYLES: '',
                FORMAT: 'image/png',
                TRANSPARENT: 'true',
                INFO_FORMAT: 'application/json',
                CRS: 'EPSG:4326',
                BBOX: `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`,
                WIDTH: size.x,
                HEIGHT: size.y,
                I: Math.round(map.latLngToContainerPoint(latlng).x),
                J: Math.round(map.latLngToContainerPoint(latlng).y)
            });

            const response = await fetch(`${this.config.server.baseUrl}?${params}`);

            if (response.ok) {
                const data = await response.json();
                this.displayFeatureInfo(data, latlng);
            } else {
                throw new Error(`Query failed: ${response.status}`);
            }

        } catch (error) {
            console.error('❌ Feature query failed:', error);
            this.layerManager.showLayerInfo('❌ Feature query failed', 'error');
        } finally {
            this.layerManager.showLoadingIndicator(false);
        }
    }

    /**
     * Display feature information
     */
    displayFeatureInfo(data, latlng) {
        if (!data.features || data.features.length === 0) {
            this.layerManager.showLayerInfo('ℹ️ No features found at this location');
            return;
        }

        const features = data.features;
        const infoHtml = features.map(feature => {
            const props = feature.properties;
            const layerName = feature.layer || 'Unknown';

            return `
                <div class="feature-info">
                    <h5>${this.config.layers[layerName]?.displayName || layerName}</h5>
                    <div class="feature-properties">
                        ${Object.entries(props).map(([key, value]) =>
                `<div><strong>${key}:</strong> ${value}</div>`
            ).join('')}
                    </div>
                </div>
            `;
        }).join('');

        this.layerManager.showLayerInfo(infoHtml);
    }

    /**
     * Initialize tooltips
     */
    initializeTooltips() {
        // Add tooltips to layer toggles
        document.querySelectorAll('.layer-toggle').forEach(toggle => {
            const layerName = toggle.querySelector('[data-layer]')?.dataset.layer;
            if (layerName && this.config.layers[layerName]) {
                const config = this.config.layers[layerName];
                toggle.title = `${config.displayName} - Click to toggle visibility`;
            }
        });

        // Add tooltips to action buttons
        const clearAllBtn = document.getElementById('clear-all');
        if (clearAllBtn) {
            clearAllBtn.title = 'Remove all active layers from map (Ctrl+C)';
        }

        const refreshBtn = document.getElementById('refresh-server');
        if (refreshBtn) {
            refreshBtn.title = 'Test server connection and refresh capabilities (Ctrl+R)';
        }
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        this.shortcuts = {
            'ctrl+c': () => this.layerManager.clearAllLayers(),
            'ctrl+r': () => this.layerManager.refreshServer(),
            'escape': () => this.hideAllPanels(),
            'ctrl+1': () => this.toggleLayer('hospitals'),
            'ctrl+2': () => this.toggleLayer('fire_stations'),
            'ctrl+3': () => this.toggleLayer('police_stations'),
            'ctrl+4': () => this.toggleLayer('highways')
        };
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(e) {
        const key = [];
        if (e.ctrlKey) key.push('ctrl');
        if (e.shiftKey) key.push('shift');
        if (e.altKey) key.push('alt');
        key.push(e.key.toLowerCase());

        const shortcut = key.join('+');
        const action = this.shortcuts[shortcut];

        if (action) {
            e.preventDefault();
            action();
        }
    }

    /**
     * Toggle layer via keyboard shortcut
     */
    toggleLayer(layerName) {
        const toggle = document.querySelector(`[data-layer="${layerName}"]`);
        if (toggle) {
            toggle.checked = !toggle.checked;
            toggle.dispatchEvent(new Event('change'));
        }
    }

    /**
     * Hide all panels
     */
    hideAllPanels() {
        document.getElementById('layer-info')?.classList.remove('show');
        document.getElementById('loading-indicator')?.classList.remove('show');
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Responsive adjustments
        const controlPanel = document.querySelector('.control-panel');
        const mapContainer = document.querySelector('.map-container');

        if (window.innerWidth <= 768) {
            // Mobile layout adjustments
            controlPanel?.classList.add('mobile');
            mapContainer?.classList.add('mobile');
        } else {
            // Desktop layout
            controlPanel?.classList.remove('mobile');
            mapContainer?.classList.remove('mobile');
        }

        // Trigger map resize if needed
        document.dispatchEvent(new CustomEvent('windowResize'));
    }

    /**
     * Update map information display
     */
    updateMapInfo(mapData) {
        const { center, zoom, bounds } = mapData;

        // Update any map info displays
        const mapInfoElements = document.querySelectorAll('.map-info');
        mapInfoElements.forEach(element => {
            element.innerHTML = `
                <div>Center: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}</div>
                <div>Zoom: ${zoom}</div>
            `;
        });
    }

    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        if (!this.config.ui.showPerformanceStats) return;

        setInterval(() => {
            this.updatePerformanceDisplay();
        }, 1000);
    }

    /**
     * Update performance display
     */
    updatePerformanceDisplay() {
        const memoryInfo = performance.memory;
        if (memoryInfo) {
            const memoryUsage = Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024);

            // Update memory usage display if element exists
            const memoryElement = document.getElementById('memory-usage');
            if (memoryElement) {
                memoryElement.textContent = `${memoryUsage}MB`;
            }
        }
    }

    /**
     * Show notification using toast system
     */
    showNotification(message, type = 'info', duration = 5000) {
        // Use toast notification system if available
        if (window.toast) {
            switch (type) {
                case 'success':
                    window.toast.success(message, duration);
                    break;
                case 'warning':
                    window.toast.warning(message, duration);
                    break;
                case 'error':
                    window.toast.error(message, duration);
                    break;
                default:
                    window.toast.info(message, duration);
            }
        } else {
            // Fallback to console
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    /**
     * Export current layer configuration
     */
    exportConfiguration() {
        const activeLayerInfo = this.layerManager.getActiveLayerInfo();
        const config = {
            timestamp: new Date().toISOString(),
            activeLayers: activeLayerInfo,
            mapCenter: this.layerManager.map.getCenter(),
            mapZoom: this.layerManager.map.getZoom()
        };

        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `disaster-dashboard-config-${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
        this.showNotification('✅ Configuration exported successfully');
    }
}