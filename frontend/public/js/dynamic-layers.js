/**
 * Dynamic Layer Management System
 * Handles on-demand WMS layer loading/unloading
 */

class DynamicLayerManager {
    constructor(map, config) {
        this.map = map;
        this.config = config;
        this.activeLayers = new Map();
        this.wmsRequestCount = 0;
        this.loadStartTime = 0;
        
        this.initializeEventListeners();
    }

    /**
     * Initialize event listeners for layer management
     */
    initializeEventListeners() {
        // Layer toggle events
        document.querySelectorAll('[data-layer]').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const layerName = e.target.dataset.layer;
                if (e.target.checked) {
                    this.loadLayer(layerName);
                } else {
                    this.unloadLayer(layerName);
                }
            });
        });

        // Disaster scenario selector
        const disasterSelector = document.getElementById('disaster-selector');
        if (disasterSelector) {
            disasterSelector.addEventListener('change', async (e) => {
                await this.handleDisasterScenario(e.target.value);
            });
        }

        // Clear all layers button
        const clearAllBtn = document.getElementById('clear-all');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.clearAllLayers();
            });
        }

        // Refresh server button
        const refreshBtn = document.getElementById('refresh-server');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshServer();
            });
        }
    }

    /**
     * Load a layer dynamically via WMS
     */
    async loadLayer(layerName) {
        try {
            this.showLoadingIndicator(true);
            this.loadStartTime = performance.now();

            const layerConfig = this.config.layers[layerName];
            if (!layerConfig) {
                throw new Error(`Layer configuration not found: ${layerName}`);
            }

            // Check if layer is already loaded
            if (this.activeLayers.has(layerName)) {
                console.warn(`Layer ${layerName} is already loaded`);
                return;
            }

            // Check if layer exists on server before creating WMS layer
            const layerExists = await this.checkLayerExists(layerName);
            if (!layerExists) {
                throw new Error(`Layer ${layerName} not available on QGIS server`);
            }

            // Create WMS layer
            const wmsLayer = this.createWMSLayer(layerName, layerConfig);
            
            // Add to map
            wmsLayer.addTo(this.map);
            
            // Store reference
            this.activeLayers.set(layerName, {
                layer: wmsLayer,
                config: layerConfig,
                loadTime: performance.now() - this.loadStartTime
            });

            // Update UI
            this.updateLayerCount(layerName);
            this.updatePerformanceStats();
            
            // Log for debugging
            if (this.config.debug.logWMSRequests) {
                console.log(`✅ Layer loaded: ${layerName}`, {
                    loadTime: performance.now() - this.loadStartTime,
                    wmsUrl: wmsLayer._url
                });
            }

            this.showLayerInfo(`${layerConfig.icon} ${layerConfig.displayName} loaded successfully`);
            window.dataLayerUI?.refreshLayerOrderSelect?.(document.getElementById('layer-order-select'));

        } catch (error) {
            console.error(`❌ Failed to load layer ${layerName}:`, error);
            this.showLayerInfo(`Failed to load ${layerName}: ${error.message}`, 'error');
            
            // Uncheck the toggle on error
            const toggle = document.querySelector(`[data-layer="${layerName}"]`);
            if (toggle) toggle.checked = false;
        } finally {
            this.showLoadingIndicator(false);
        }
    }

    /**
     * Create WMS layer with proper configuration
     */
    createWMSLayer(layerName, layerConfig) {
        const wmsCrs = this.config.wms.crs === "EPSG:4326" ? L.CRS.EPSG4326 : L.CRS.EPSG3857;

        const wmsOptions = {
            layers: layerName,
            format: layerConfig.format || this.config.wms.format,
            transparent: layerConfig.transparent !== undefined ? layerConfig.transparent : this.config.wms.transparent,
            version: this.config.wms.version,
            crs: wmsCrs,
            styles: layerConfig.style || this.config.wms.styles,
            exceptions: this.config.wms.exceptions,
            // Performance optimizations
            tileSize: layerConfig.tileSize || this.config.performance.tileSize,
            updateWhenIdle: this.config.performance.updateWhenIdle,
            updateWhenZooming: this.config.performance.updateWhenZooming,
            keepBuffer: this.config.performance.keepBuffer,
            // Layer-specific zoom limits
            minZoom: layerConfig.minZoom || 0,
            maxZoom: layerConfig.maxZoom || 18
        };

        const wmsLayer = L.tileLayer.wms(this.config.server.baseUrl, wmsOptions);
        
        // Track tile errors to avoid spam
        let tileErrorCount = 0;
        const maxTileErrors = 5;
        
        // Add event listeners for debugging
        wmsLayer.on('loading', () => {
            this.wmsRequestCount++;
            this.updatePerformanceStats();
        });

        wmsLayer.on('load', () => {
            if (this.config.debug.logPerformance) {
                console.log(`🔄 WMS tile loaded for ${layerName}`);
            }
        });

        wmsLayer.on('tileerror', (e) => {
            tileErrorCount++;
            if (tileErrorCount <= maxTileErrors) {
                console.error(`❌ WMS tile error for ${layerName}:`, e);
                if (tileErrorCount === maxTileErrors) {
                    console.warn(`⚠️ Suppressing further tile errors for ${layerName} (${maxTileErrors} errors reached)`);
                }
            }
        });

        return wmsLayer;
    }

    /**
     * Unload a layer from the map
     */
    unloadLayer(layerName) {
        try {
            const layerData = this.activeLayers.get(layerName);
            if (!layerData) {
                console.warn(`Layer ${layerName} is not currently loaded`);
                return;
            }

            // Remove from map
            this.map.removeLayer(layerData.layer);
            
            // Remove from active layers
            this.activeLayers.delete(layerName);

            // Update UI
            this.updateLayerCount(layerName, 0);
            this.updatePerformanceStats();

            // Log for debugging
            if (this.config.debug.logWMSRequests) {
                console.log(`🗑️ Layer unloaded: ${layerName}`);
            }

            const layerConfig = this.config.layers[layerName];
            this.showLayerInfo(`${layerConfig?.icon || '📍'} ${layerConfig?.displayName || layerName} removed`);
            window.dataLayerUI?.refreshLayerOrderSelect?.(document.getElementById('layer-order-select'));

        } catch (error) {
            console.error(`❌ Failed to unload layer ${layerName}:`, error);
        }
    }

    /**
     * Handle disaster scenario selection
     */
    async handleDisasterScenario(scenarioType) {
        // Clear existing disaster layers
        this.clearDisasterLayers();

        if (!scenarioType) return;

        // Load appropriate disaster layer
        const disasterLayerMap = {
            'flood': 'flood_zones',
            'fire': 'fire_risk',
            'earthquake': 'earthquake_zones',
            'landslide': 'landslide_zones'
        };

        const layerName = disasterLayerMap[scenarioType];
        if (layerName && this.config.layers[layerName]) {
            // Check if layer exists on server before loading
            const layerExists = await this.checkLayerExists(layerName);
            if (layerExists) {
                this.loadLayer(layerName);
            } else {
                this.showLayerInfo(`⚠️ ${scenarioType} scenario data not available yet - layer not found on server`, 'warning');
                console.warn(`Layer ${layerName} is configured but not available on QGIS server`);
            }
        } else {
            this.showLayerInfo(`⚠️ ${scenarioType} scenario data not available yet`, 'warning');
        }
    }

    /**
     * Check if a layer exists on the QGIS server
     */
    async checkLayerExists(layerName) {
        try {
            const capabilitiesUrl = `${this.config.server.baseUrl}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=${this.config.wms.version}`;
            const response = await fetch(capabilitiesUrl, {
                method: 'GET',
                timeout: this.config.server.timeout
            });

            if (response.ok) {
                const xmlText = await response.text();
                // Check if layer name appears in capabilities XML
                if (xmlText.includes(`<Name>${layerName}</Name>`)) {
                    return true;
                }
            }
            // Fallback: try a tiny GetMap request (some layers may not appear in capabilities)
            return await this.checkLayerByGetMap(layerName);
        } catch (error) {
            console.error(`Error checking layer existence for ${layerName}:`, error);
            // Fallback: attempt a GetMap request before giving up
            return await this.checkLayerByGetMap(layerName);
        }
    }

    /**
     * Fallback check by issuing a small GetMap request
     */
    async checkLayerByGetMap(layerName) {
        const tryGetMap = async (crs) => {
            const bbox = this.getMapBBoxForWms(crs);
            const testUrl = `${this.config.server.baseUrl}?SERVICE=WMS&REQUEST=GetMap&VERSION=${this.config.wms.version}` +
                `&LAYERS=${encodeURIComponent(layerName)}` +
                `&STYLES=${encodeURIComponent(this.config.wms.styles || '')}` +
                `&CRS=${encodeURIComponent(crs)}` +
                `&BBOX=${bbox}` +
                `&WIDTH=256&HEIGHT=256&FORMAT=${encodeURIComponent(this.config.wms.format)}` +
                `&TRANSPARENT=${this.config.wms.transparent}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.server.timeout);

            const response = await fetch(testUrl, { method: 'GET', signal: controller.signal });
            clearTimeout(timeoutId);
            return response.ok;
        };

        try {
            // Try configured CRS first
            const primaryCrs = this.config.wms.crs;
            if (await tryGetMap(primaryCrs)) {
                return true;
            }

            // Fallback to EPSG:4326 if configured CRS failed (common WMS capability mismatch)
            if (primaryCrs !== "EPSG:4326") {
                return await tryGetMap("EPSG:4326");
            }

            return false;
        } catch (error) {
            console.warn(`GetMap fallback failed for ${layerName}:`, error);
            return false;
        }
    }

    /**
     * Compute a WMS BBOX for the current map view based on configured CRS
     */
    getMapBBoxForWms(crsOverride = null) {
        const crs = crsOverride || this.config.wms.crs;
        const bounds = this.map.getBounds();

        if (crs === "EPSG:3857") {
            const sw = L.CRS.EPSG3857.project(bounds.getSouthWest());
            const ne = L.CRS.EPSG3857.project(bounds.getNorthEast());
            return `${sw.x},${sw.y},${ne.x},${ne.y}`;
        }

        // Default to EPSG:4326 (lon,lat order)
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        return `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
    }

    /**
     * Clear all disaster-related layers
     */
    clearDisasterLayers() {
        const disasterLayers = Array.from(this.activeLayers.keys()).filter(layerName => {
            const layerConfig = this.config.layers[layerName];
            return layerConfig && layerConfig.category === 'disaster';
        });

        disasterLayers.forEach(layerName => {
            this.unloadLayer(layerName);
        });
    }

    /**
     * Clear all active layers
     */
    clearAllLayers() {
        const layerNames = Array.from(this.activeLayers.keys());
        
        layerNames.forEach(layerName => {
            this.unloadLayer(layerName);
            
            // Uncheck toggles
            const toggle = document.querySelector(`[data-layer="${layerName}"]`);
            if (toggle) toggle.checked = false;
        });

        // Reset disaster selector
        const disasterSelector = document.getElementById('disaster-selector');
        if (disasterSelector) disasterSelector.value = '';

        this.showLayerInfo('🧹 All layers cleared');
    }

    getLayerNames() {
        return Array.from(this.activeLayers.keys());
    }

    reorderLayer(layerName, direction = 'front') {
        const layerData = this.activeLayers.get(layerName);
        if (!layerData || !layerData.layer) return;
        if (direction === 'front' && layerData.layer.bringToFront) {
            layerData.layer.bringToFront();
        }
        if (direction === 'back' && layerData.layer.bringToBack) {
            layerData.layer.bringToBack();
        }
    }

    /**
     * Refresh server connection
     */
    async refreshServer() {
        try {
            this.showLoadingIndicator(true);
            
            // Test server connectivity
            const testUrl = `${this.config.server.baseUrl}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=${this.config.wms.version}`;
            
            const response = await fetch(testUrl, {
                method: 'GET',
                timeout: this.config.server.timeout
            });

            if (response.ok) {
                this.updateServerStatus('connected');
                this.showLayerInfo('🔄 Server connection refreshed');
            } else {
                throw new Error(`Server responded with status: ${response.status}`);
            }

        } catch (error) {
            console.error('❌ Server refresh failed:', error);
            this.updateServerStatus('error');
            this.showLayerInfo('❌ Server connection failed', 'error');
        } finally {
            this.showLoadingIndicator(false);
        }
    }

    /**
     * Update layer count in UI
     */
    updateLayerCount(layerName, count = null) {
        const countElement = document.getElementById(`${layerName.replace(/_/g, '-')}-count`);
        if (countElement) {
            if (count !== null) {
                countElement.textContent = count;
            } else {
                // For now, show "✓" when loaded, could be enhanced to show actual feature count
                countElement.textContent = this.activeLayers.has(layerName) ? '✓' : '';
            }
        }
    }

    /**
     * Update performance statistics
     */
    updatePerformanceStats() {
        const activeLayersElement = document.getElementById('active-layers');
        const wmsRequestsElement = document.getElementById('wms-requests');
        const loadTimeElement = document.getElementById('load-time');

        if (activeLayersElement) {
            activeLayersElement.textContent = this.activeLayers.size;
        }

        if (wmsRequestsElement) {
            wmsRequestsElement.textContent = this.wmsRequestCount;
        }

        if (loadTimeElement && this.loadStartTime > 0) {
            const loadTime = Math.round(performance.now() - this.loadStartTime);
            loadTimeElement.textContent = `${loadTime}ms`;
        }
    }

    /**
     * Show/hide loading indicator
     */
    showLoadingIndicator(show) {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            indicator.classList.toggle('show', show);
        }
    }

    /**
     * Show layer information
     */
    showLayerInfo(message, type = 'info') {
        const infoPanel = document.getElementById('layer-info');
        const detailsElement = document.getElementById('layer-details');
        
        if (infoPanel && detailsElement) {
            detailsElement.innerHTML = `<div class="info-${type}">${message}</div>`;
            infoPanel.classList.add('show');

            // Auto-hide after configured time
            if (this.config.ui.autoHideInfoPanel > 0) {
                setTimeout(() => {
                    infoPanel.classList.remove('show');
                }, this.config.ui.autoHideInfoPanel);
            }
        }
    }

    /**
     * Update server status indicator
     */
    updateServerStatus(status) {
        const statusDot = document.getElementById('server-status');
        const statusText = document.getElementById('status-text');

        if (statusDot && statusText) {
            statusDot.className = `dot ${status}`;
            
            const statusMessages = {
                'connected': 'Server Online',
                'loading': 'Connecting...',
                'error': 'Server Error'
            };

            statusText.textContent = statusMessages[status] || 'Unknown';
        }
    }

    /**
     * Get active layer information
     */
    getActiveLayerInfo() {
        return Array.from(this.activeLayers.entries()).map(([name, data]) => ({
            name,
            displayName: data.config.displayName,
            category: data.config.category,
            loadTime: data.loadTime
        }));
    }
}
