/**
 * Buffer Visualization Manager
 * Handles rendering and management of buffer overlays on the map
 */

class BufferVisualizationManager {
    constructor(map, spatialEngine, config, layerManager = null) {
        this.map = map;
        this.spatialEngine = spatialEngine;
        this.config = config;
        this.layerManager = layerManager;
        this.bufferLayers = new Map();
        this.bufferControls = new Map();
        this.isActive = false;
        
        this.initializeVisualization();
    }

    /**
     * Initialize buffer visualization system
     */
    initializeVisualization() {
        // Check if spatial engine is available
        if (!this.spatialEngine) {
            console.warn('⚠️ Spatial analysis engine not available - buffer analysis will have limited functionality');
        }
        
        // Check if buffer section already exists in HTML before creating
        const existingSection = document.querySelector('.buffer-analysis-section');
        if (existingSection) {
            console.log('✅ Buffer analysis section already exists in HTML - skipping creation');
            this.setupEventListeners();
        } else {
            console.log('🔧 Creating buffer controls via JavaScript...');
            this.createBufferControls();
            this.setupEventListeners();
        }
        
        console.log('✅ Buffer Visualization Manager initialized');
    }

    /**
     * Create buffer control interface
     */
    createBufferControls() {
        console.log('🔧 Creating buffer controls...');
        
        const controlPanel = document.querySelector('.control-panel');
        if (!controlPanel) {
            console.error('❌ Control panel not found!');
            return;
        }

        console.log('✅ Control panel found, adding buffer section...');

        const bufferSection = document.createElement('div');
        bufferSection.className = 'control-section buffer-analysis-section';
        bufferSection.innerHTML = `
            <h3>🎯 Buffer Analysis</h3>
            
            <div class="buffer-controls">
                <div class="buffer-distances">
                    <label>Buffer Distances (meters):</label>
                    <div class="distance-inputs">
                        <input type="number" id="buffer-distance-1" value="1000" min="100" max="50000" step="100">
                        <input type="number" id="buffer-distance-2" value="5000" min="100" max="50000" step="100">
                        <input type="number" id="buffer-distance-3" value="10000" min="100" max="50000" step="100">
                    </div>
                </div>

                <div class="buffer-source">
                    <label for="buffer-source-layer">Source Layer:</label>
                    <select id="buffer-source-layer">
                        <option value="">Select layer...</option>
                        <option value="agency_hospital">🏥 Hospitals</option>
                        <option value="agency_fire">🚒 Fire Stations</option>
                        <option value="agency_police">🚔 Police Stations</option>
                    </select>
                </div>

                <div class="buffer-actions">
                    <button id="create-buffers" class="btn btn-primary" disabled>
                        Create Buffers
                    </button>
                    <button id="clear-buffers" class="btn btn-secondary" disabled>
                        Clear Buffers
                    </button>
                </div>

                <div class="buffer-options">
                    <div class="option-group">
                        <label>
                            <input type="checkbox" id="show-combined-coverage" checked>
                            Show Combined Coverage
                        </label>
                    </div>
                    <div class="option-group">
                        <label>
                            <input type="checkbox" id="show-service-gaps">
                            Identify Service Gaps
                        </label>
                    </div>
                    <div class="option-group">
                        <label>
                            <input type="checkbox" id="discover-facilities" checked>
                            Discover Facilities in Buffers
                        </label>
                    </div>
                </div>

                <div class="buffer-styling">
                    <h4>Buffer Styling</h4>
                    <div class="style-controls">
                        <div class="style-row">
                            <label>Opacity:</label>
                            <input type="range" id="buffer-opacity" min="0.1" max="1" step="0.1" value="0.3">
                            <span id="opacity-value">30%</span>
                        </div>
                        <div class="style-row">
                            <label>Stroke Width:</label>
                            <input type="range" id="buffer-stroke-width" min="1" max="5" step="1" value="2">
                            <span id="stroke-width-value">2px</span>
                        </div>
                    </div>
                </div>

                <div class="buffer-results" id="buffer-results" style="display: none;">
                    <h4>Analysis Results</h4>
                    <div id="buffer-statistics"></div>
                </div>
            </div>
        `;

        controlPanel.appendChild(bufferSection);
        console.log('✅ Buffer analysis section added to control panel');
    }

    /**
     * Setup event listeners for buffer controls
     */
    setupEventListeners() {
        // Source layer selection
        const sourceLayerSelect = document.getElementById('buffer-source-layer');
        if (sourceLayerSelect) {
            sourceLayerSelect.addEventListener('change', (e) => {
                this.handleSourceLayerChange(e.target.value);
            });
        }

        // Create buffers button
        const createBuffersBtn = document.getElementById('create-buffers');
        if (createBuffersBtn) {
            createBuffersBtn.addEventListener('click', () => {
                this.createBuffers();
            });
        }

        // Clear buffers button
        const clearBuffersBtn = document.getElementById('clear-buffers');
        if (clearBuffersBtn) {
            clearBuffersBtn.addEventListener('click', () => {
                this.clearBuffers();
            });
        }

        // Styling controls
        this.setupStylingControls();

        // Option checkboxes
        document.getElementById('show-combined-coverage')?.addEventListener('change', (e) => {
            this.toggleCombinedCoverage(e.target.checked);
        });

        document.getElementById('show-service-gaps')?.addEventListener('change', (e) => {
            this.toggleServiceGaps(e.target.checked);
        });
    }

    /**
     * Setup styling control event listeners
     */
    setupStylingControls() {
        const opacitySlider = document.getElementById('buffer-opacity');
        const opacityValue = document.getElementById('opacity-value');
        
        if (opacitySlider && opacityValue) {
            opacitySlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                opacityValue.textContent = `${Math.round(value * 100)}%`;
                this.updateBufferOpacity(value);
            });
        }

        const strokeWidthSlider = document.getElementById('buffer-stroke-width');
        const strokeWidthValue = document.getElementById('stroke-width-value');
        
        if (strokeWidthSlider && strokeWidthValue) {
            strokeWidthSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                strokeWidthValue.textContent = `${value}px`;
                this.updateBufferStrokeWidth(value);
            });
        }
    }

    /**
     * Handle source layer selection change
     */
    handleSourceLayerChange(layerName) {
        const createBtn = document.getElementById('create-buffers');
        if (createBtn) {
            createBtn.disabled = !layerName;
        }

        if (layerName) {
            console.log(`📍 Selected source layer: ${layerName}`);
        }
    }

    /**
     * Create buffer zones around selected layer features
     */
    async createBuffers() {
        try {
            // Check if spatial engine is available
            if (!this.spatialEngine) {
                throw new Error('Spatial analysis engine not available - please refresh the page');
            }

            const sourceLayerName = document.getElementById('buffer-source-layer')?.value;
            if (!sourceLayerName) {
                throw new Error('No source layer selected');
            }

            // Get buffer distances
            const distances = this.getBufferDistances();
            if (distances.length === 0) {
                throw new Error('No valid buffer distances specified');
            }

            // Get source layer features
            const sourceFeatures = await this.getLayerFeatures(sourceLayerName);
            if (sourceFeatures.length === 0) {
                throw new Error('No features found in source layer');
            }

            console.log(`🎯 Creating buffers for ${sourceFeatures.length} features at distances: ${distances.join(', ')}m`);

            // Clear existing buffers
            this.clearBuffers();

            // Calculate buffers using spatial engine
            const bufferResults = this.spatialEngine.calculateBufferZones(sourceFeatures, distances);
            
            // Render buffers on map
            this.renderBuffers(bufferResults, sourceLayerName);

            // Show combined coverage if enabled
            if (document.getElementById('show-combined-coverage')?.checked) {
                this.showCombinedCoverage(bufferResults);
            }

            // Show service gaps if enabled
            if (document.getElementById('show-service-gaps')?.checked) {
                this.showServiceGaps(bufferResults);
            }

            // Discover facilities if enabled
            if (document.getElementById('discover-facilities')?.checked) {
                await this.discoverFacilitiesInBuffers(bufferResults, sourceLayerName);
            }

            // Update UI
            this.updateBufferResults(bufferResults, sourceFeatures.length);
            this.enableBufferControls(true);

            console.log('✅ Buffer analysis completed successfully');

        } catch (error) {
            console.error('❌ Buffer creation failed:', error);
            this.showError(`Buffer creation failed: ${error.message}`);
        }
    }

    /**
     * Get buffer distances from input fields
     */
    getBufferDistances() {
        const distances = [];
        
        for (let i = 1; i <= 3; i++) {
            const input = document.getElementById(`buffer-distance-${i}`);
            if (input && input.value) {
                const distance = parseInt(input.value);
                if (distance > 0) {
                    distances.push(distance);
                }
            }
        }

        return distances.sort((a, b) => a - b); // Sort ascending
    }

    /**
     * Get features from a layer using the disaster API
     */
    async getLayerFeatures(layerName) {
        try {
            const bounds = this.map.getBounds();
            const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
            const url = `${this.config.api.baseUrl}/layers/${layerName}/features?bbox=${bbox}&limit=5000`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Layer feature request failed: ${response.status}`);
            }
            const data = await response.json();
            return data.features || [];
        } catch (error) {
            console.error(`Failed to load features for ${layerName}:`, error);
            return [];
        }
    }

    /**
     * Render buffer zones on the map
     */
    renderBuffers(bufferResults, sourceLayerName) {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1']; // Red, teal, blue
        const opacity = parseFloat(document.getElementById('buffer-opacity')?.value || 0.3);
        const strokeWidth = parseInt(document.getElementById('buffer-stroke-width')?.value || 2);

        bufferResults.buffers.forEach((buffers, distance) => {
            const color = colors[Array.from(bufferResults.buffers.keys()).indexOf(distance)] || '#999999';
            
            buffers.forEach((buffer, index) => {
                const bufferLayer = L.geoJSON(buffer, {
                    style: {
                        fillColor: color,
                        fillOpacity: opacity,
                        color: color,
                        weight: strokeWidth,
                        opacity: 0.8
                    }
                });

                // Add popup with buffer information
                bufferLayer.bindPopup(`
                    <div class="buffer-popup">
                        <h4>Buffer Zone</h4>
                        <p><strong>Source:</strong> ${sourceLayerName}</p>
                        <p><strong>Distance:</strong> ${distance}m</p>
                        <p><strong>Area:</strong> ${(buffer.properties.area / 1000000).toFixed(2)} km²</p>
                    </div>
                `);

                bufferLayer.addTo(this.map);
                
                // Store layer reference
                const layerKey = `${sourceLayerName}_${distance}_${index}`;
                this.bufferLayers.set(layerKey, {
                    layer: bufferLayer,
                    distance: distance,
                    sourceLayer: sourceLayerName,
                    buffer: buffer
                });
            });
        });
    }

    /**
     * Show combined coverage area
     */
    showCombinedCoverage(bufferResults) {
        // Get all buffers from the largest distance
        const distances = Array.from(bufferResults.buffers.keys()).sort((a, b) => b - a);
        const largestBuffers = bufferResults.buffers.get(distances[0]);
        
        if (largestBuffers && largestBuffers.length > 0) {
            const combinedCoverage = this.spatialEngine.calculateCombinedCoverage(largestBuffers);
            
            if (combinedCoverage) {
                const coverageLayer = L.geoJSON(combinedCoverage, {
                    style: {
                        fillColor: '#ffd93d',
                        fillOpacity: 0.2,
                        color: '#ffd93d',
                        weight: 3,
                        opacity: 0.8,
                        dashArray: '10, 5'
                    }
                });

                coverageLayer.bindPopup(`
                    <div class="coverage-popup">
                        <h4>Combined Coverage Area</h4>
                        <p><strong>Total Area:</strong> ${(combinedCoverage.properties.totalArea / 1000000).toFixed(2)} km²</p>
                        <p><strong>Buffer Count:</strong> ${combinedCoverage.properties.bufferCount}</p>
                    </div>
                `);

                coverageLayer.addTo(this.map);
                this.bufferLayers.set('combined_coverage', {
                    layer: coverageLayer,
                    type: 'coverage',
                    coverage: combinedCoverage
                });
            }
        }
    }


    /**
     * Show service gaps (placeholder for future implementation)
     */
    showServiceGaps(bufferResults) {
        try {
            const distances = Array.from(bufferResults.buffers.keys()).sort((a, b) => b - a);
            const largestBuffers = bufferResults.buffers.get(distances[0]);
            if (!largestBuffers || largestBuffers.length === 0) {
                return;
            }
            const combinedCoverage = this.spatialEngine.calculateCombinedCoverage(largestBuffers);
            if (!combinedCoverage) {
                return;
            }

            const bounds = this.map.getBounds();
            const boundary = turf.bboxPolygon([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]);
            const gaps = this.spatialEngine.identifyServiceGaps(combinedCoverage, boundary);
            if (!gaps) {
                return;
            }

            const gapsLayer = L.geoJSON(gaps, {
                style: {
                    fillColor: '#ff4757',
                    fillOpacity: 0.15,
                    color: '#ff4757',
                    weight: 2,
                    opacity: 0.7,
                    dashArray: '4, 4'
                }
            });

            gapsLayer.bindPopup(`
                <div class="gap-popup">
                    <h4>Service Gaps</h4>
                    <p><strong>Gap Area:</strong> ${(gaps.properties.gapArea / 1000000).toFixed(2)} km??</p>
                    <p><strong>Coverage:</strong> ${gaps.properties.coveragePercentage}%</p>
                </div>
            `);

            gapsLayer.addTo(this.map);
            this.bufferLayers.set('service_gaps', { layer: gapsLayer, type: 'gaps', gaps });
        } catch (error) {
            console.warn('Service gap analysis failed:', error);
        }
    }

    /**
     * Discover facilities within buffer zones
     */
    async discoverFacilitiesInBuffers(bufferResults, sourceLayerName) {
        try {
            console.log('🔍 Discovering facilities within buffer zones...');

            // Get all available facility layers (excluding the source layer)
            const facilityLayers = await this.getAllFacilityLayers(sourceLayerName);
            
            if (facilityLayers.length === 0) {
                console.log('ℹ️ No other facility layers available for discovery');
                return;
            }

            let totalDiscovered = 0;
            const discoveryResults = new Map();

            // Analyze each buffer distance
            bufferResults.buffers.forEach((buffers, distance) => {
                buffers.forEach((buffer, bufferIndex) => {
                    facilityLayers.forEach(layerData => {
                        const facilitiesInBuffer = this.spatialEngine.findFeaturesWithinBuffer(
                            layerData.features, 
                            buffer, 
                            {
                                includeDistance: true,
                                includeDirection: true,
                                sortByDistance: true
                            }
                        );

                        if (facilitiesInBuffer.length > 0) {
                            const key = `${distance}_${bufferIndex}_${layerData.layerName}`;
                            discoveryResults.set(key, {
                                distance,
                                bufferIndex,
                                layerName: layerData.layerName,
                                displayName: layerData.displayName,
                                icon: layerData.icon,
                                facilities: facilitiesInBuffer,
                                count: facilitiesInBuffer.length
                            });

                            totalDiscovered += facilitiesInBuffer.length;

                            // Add facility markers to map
                            this.addFacilityMarkers(facilitiesInBuffer, layerData, distance);
                        }
                    });
                });
            });

            // Update results display
            this.updateFacilityDiscoveryResults(discoveryResults, totalDiscovered);

            console.log(`✅ Discovered ${totalDiscovered} facilities across all buffer zones`);

        } catch (error) {
            console.error('❌ Facility discovery failed:', error);
        }
    }

    /**
     * Get all available facility layers except the source layer
     */
    async getAllFacilityLayers(excludeLayerName) {
        const facilityLayers = [];
        
        const layerConfigs = {
            'agency_hospital': { displayName: 'Hospitals', icon: '🏥' },
            'agency_fire': { displayName: 'Fire Stations', icon: '🚒' },
            'agency_police': { displayName: 'Police Stations', icon: '🚔' }
        };

        for (const [layerName, config] of Object.entries(layerConfigs)) {
            if (layerName !== excludeLayerName) {
                const features = await this.getLayerFeatures(layerName);
                if (features.length > 0) {
                    facilityLayers.push({
                        layerName,
                        displayName: config.displayName,
                        icon: config.icon,
                        features
                    });
                }
            }
        }

        return facilityLayers;
    }

    /**
     * Add facility markers to the map
     */
    addFacilityMarkers(facilities, layerData, bufferDistance) {
        facilities.forEach((facilityData, index) => {
            const { geoJson, distance, distanceToCenter, bearing } = facilityData;
            
            if (geoJson.geometry.type === 'Point') {
                const [lng, lat] = geoJson.geometry.coordinates;
                
                // Create custom icon based on facility type
                const iconHtml = `
                    <div class="facility-marker" style="
                        background: rgba(255, 255, 255, 0.9);
                        border: 2px solid #007bff;
                        border-radius: 50%;
                        width: 30px;
                        height: 30px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 16px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    ">
                        ${layerData.icon}
                    </div>
                `;

                const customIcon = L.divIcon({
                    html: iconHtml,
                    className: 'custom-facility-icon',
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });

                const marker = L.marker([lat, lng], { icon: customIcon });
                
                // Add popup with facility information
                marker.bindPopup(`
                    <div class="facility-popup">
                        <h4>${layerData.icon} ${layerData.displayName}</h4>
                        <p><strong>Name:</strong> ${geoJson.properties.name || 'Unknown'}</p>
                        <p><strong>Buffer Zone:</strong> ${bufferDistance}m</p>
                        <p><strong>Distance to Center:</strong> ${distanceToCenter}m</p>
                        ${bearing !== undefined ? `<p><strong>Direction:</strong> ${this.getBearingDirection(bearing)}</p>` : ''}
                        <div style="margin-top: 8px; padding: 4px; background: rgba(0,123,255,0.1); border-radius: 4px;">
                            <small>🎯 Discovered in buffer analysis</small>
                        </div>
                    </div>
                `);

                marker.addTo(this.map);
                
                // Store marker reference
                const markerKey = `facility_${layerData.layerName}_${bufferDistance}_${index}`;
                this.bufferLayers.set(markerKey, {
                    layer: marker,
                    type: 'facility_marker',
                    layerName: layerData.layerName,
                    bufferDistance: bufferDistance
                });
            }
        });
    }

    /**
     * Convert bearing to compass direction
     */
    getBearingDirection(bearing) {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round(((bearing + 360) % 360) / 45) % 8;
        return directions[index];
    }

    /**
     * Update facility discovery results display
     */
    updateFacilityDiscoveryResults(discoveryResults, totalDiscovered) {
        const resultsDiv = document.getElementById('buffer-results');
        const statisticsDiv = document.getElementById('buffer-statistics');
        
        if (resultsDiv && statisticsDiv && totalDiscovered > 0) {
            // Group results by layer type
            const layerSummary = new Map();
            
            discoveryResults.forEach((result) => {
                if (!layerSummary.has(result.layerName)) {
                    layerSummary.set(result.layerName, {
                        displayName: result.displayName,
                        icon: result.icon,
                        totalCount: 0,
                        byDistance: new Map()
                    });
                }
                
                const summary = layerSummary.get(result.layerName);
                summary.totalCount += result.count;
                
                if (!summary.byDistance.has(result.distance)) {
                    summary.byDistance.set(result.distance, 0);
                }
                summary.byDistance.set(result.distance, summary.byDistance.get(result.distance) + result.count);
            });

            // Add facility discovery section to statistics
            let facilityHtml = `
                <div class="facility-discovery-section">
                    <h5 style="color: var(--success-color); margin: 10px 0 8px 0;">🎯 Discovered Facilities</h5>
            `;

            layerSummary.forEach((summary, layerName) => {
                facilityHtml += `
                    <div class="facility-summary">
                        <div class="stat-row">
                            <span class="stat-label">${summary.icon} ${summary.displayName}:</span>
                            <span class="stat-value">${summary.totalCount}</span>
                        </div>
                `;

                // Show breakdown by distance
                summary.byDistance.forEach((count, distance) => {
                    if (count > 0) {
                        facilityHtml += `
                            <div class="stat-row sub-stat">
                                <span class="stat-label">  • Within ${distance}m:</span>
                                <span class="stat-value">${count}</span>
                            </div>
                        `;
                    }
                });

                facilityHtml += `</div>`;
            });

            facilityHtml += `
                    <div class="stat-row total-facilities">
                        <span class="stat-label"><strong>Total Discovered:</strong></span>
                        <span class="stat-value"><strong>${totalDiscovered}</strong></span>
                    </div>
                </div>
            `;

            // Append to existing statistics
            statisticsDiv.innerHTML += facilityHtml;
        }
    }

    /**
     * Update buffer opacity
     */
    updateBufferOpacity(opacity) {
        this.bufferLayers.forEach((layerData) => {
            if (layerData.layer && layerData.layer.setStyle) {
                layerData.layer.setStyle({
                    fillOpacity: opacity
                });
            }
        });
    }

    /**
     * Update buffer stroke width
     */
    updateBufferStrokeWidth(width) {
        this.bufferLayers.forEach((layerData) => {
            if (layerData.layer && layerData.layer.setStyle) {
                layerData.layer.setStyle({
                    weight: width
                });
            }
        });
    }

    /**
     * Toggle combined coverage visibility
     */
    toggleCombinedCoverage(show) {
        const coverageLayer = this.bufferLayers.get('combined_coverage');
        if (coverageLayer) {
            if (show) {
                coverageLayer.layer.addTo(this.map);
            } else {
                this.map.removeLayer(coverageLayer.layer);
            }
        }
    }


    /**
     * Toggle service gaps visibility
     */
    toggleServiceGaps(show) {
        const gapsLayer = this.bufferLayers.get('service_gaps');
        if (gapsLayer) {
            if (show) {
                gapsLayer.layer.addTo(this.map);
            } else {
                this.map.removeLayer(gapsLayer.layer);
            }
        }
    }

    /**
     * Clear all buffer layers
     */
    clearBuffers() {
        this.bufferLayers.forEach((layerData) => {
            this.map.removeLayer(layerData.layer);
        });
        
        this.bufferLayers.clear();
        this.enableBufferControls(false);
        
        // Hide results
        const resultsDiv = document.getElementById('buffer-results');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
        }

        console.log('🧹 Buffer layers cleared');
    }

    /**
     * Enable/disable buffer control buttons
     */
    enableBufferControls(enabled) {
        const clearBtn = document.getElementById('clear-buffers');
        if (clearBtn) {
            clearBtn.disabled = !enabled;
        }
    }

    /**
     * Update buffer analysis results display
     */
    updateBufferResults(bufferResults, featureCount) {
        const resultsDiv = document.getElementById('buffer-results');
        const statisticsDiv = document.getElementById('buffer-statistics');
        
        if (resultsDiv && statisticsDiv) {
            let totalArea = 0;
            let bufferCount = 0;

            bufferResults.buffers.forEach((buffers, distance) => {
                buffers.forEach(buffer => {
                    totalArea += buffer.properties.area;
                    bufferCount++;
                });
            });

            statisticsDiv.innerHTML = `
                <div class="stat-row">
                    <span class="stat-label">Source Features:</span>
                    <span class="stat-value">${featureCount}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Buffer Zones:</span>
                    <span class="stat-value">${bufferCount}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Total Area:</span>
                    <span class="stat-value">${(totalArea / 1000000).toFixed(2)} km²</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Distances:</span>
                    <span class="stat-value">${Array.from(bufferResults.buffers.keys()).join(', ')}m</span>
                </div>
                ${this.renderPopulationStats(bufferResults)}
            `;

            resultsDiv.style.display = 'block';
        }
    }


    renderPopulationStats(bufferResults) {
        try {
            const populationFeatures = window.dataLayerManager?.getLayerFeatures('population_density') || [];
            if (!populationFeatures.length) {
                return '';
            }
            let html = '<div class="stat-row"><span class="stat-label">Population Data:</span><span class="stat-value">Loaded</span></div>';
            bufferResults.buffers.forEach((buffers, distance) => {
                const buffer = buffers[0];
                if (!buffer) return;
                const stats = this.spatialEngine.calculatePopulationWithinBuffer(buffer, populationFeatures.map(f => ({
                    latitude: turf.centroid(f).geometry.coordinates[1],
                    longitude: turf.centroid(f).geometry.coordinates[0],
                    population: f.properties?.population || 0
                })));
                html += `<div class="stat-row sub-stat">
                    <span class="stat-label">Within ${distance}m:</span>
                    <span class="stat-value">${stats.totalPopulation}</span>
                </div>`;
            });
            return html;
        } catch (e) {
            return '';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        // Use the layer manager's error display if available
        if (this.layerManager && this.layerManager.showLayerInfo) {
            this.layerManager.showLayerInfo(`❌ ${message}`, 'error');
        } else {
            console.error(message);
            alert(message);
        }
    }

    /**
     * Get buffer analysis statistics
     */
    getBufferStats() {
        return {
            activeBuffers: this.bufferLayers.size,
            isActive: this.isActive,
            lastAnalysis: this.bufferLayers.size > 0 ? new Date().toISOString() : null
        };
    }
}
