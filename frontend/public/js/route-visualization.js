/**
 * Route Visualization Manager
 * Handles rendering and management of route overlays on the map
 */

class RouteVisualizationManager {
    constructor(map, routeEngine, config) {
        this.map = map;
        this.routeEngine = routeEngine;
        this.config = config;
        this.routeLayers = new Map();
        this.routeMarkers = new Map();
        this.isActive = false;
        
        this.initializeVisualization();
    }

    /**
     * Initialize route visualization system
     */
    initializeVisualization() {
        // Check if route engine is available
        if (!this.routeEngine) {
            console.warn('⚠️ Route optimization engine not available - route visualization will have limited functionality');
        }
        
        // Check if route section already exists in HTML before creating
        const existingSection = document.querySelector('.route-optimization-section');
        if (existingSection) {
            console.log('✅ Route optimization section already exists in HTML - using existing controls');
            this.setupEventListeners();
        } else {
            console.log('🔧 Route controls not found in HTML - attempting to create...');
            // Only try to create if control panel exists
            const controlPanel = document.querySelector('.control-panel');
            if (controlPanel) {
                this.createRouteControls();
                this.setupEventListeners();
            } else {
                console.warn('⚠️ Control panel not found - route controls will not be available');
                return;
            }
        }
        
        console.log('✅ Route Visualization Manager initialized');
    }

    /**
     * Create route control interface
     */
    createRouteControls() {
        console.log('🔧 Creating route controls...');
        
        const controlPanel = document.querySelector('.control-panel');
        if (!controlPanel) {
            console.warn('⚠️ Control panel not found - cannot create route controls');
            return;
        }

        console.log('✅ Control panel found, adding route section...');

        const routeSection = document.createElement('div');
        routeSection.className = 'control-section route-optimization-section';
        routeSection.innerHTML = `
            <h3>🗺️ Route Optimization</h3>
            
            <div class="route-controls">
                <div class="route-mode">
                    <label>Route Mode:</label>
                    <select id="route-mode">
                        <option value="point-to-point">Point to Point</option>
                        <option value="emergency-response">Emergency Response</option>
                        <option value="multi-destination">Multi-Destination</option>
                    </select>
                </div>

                <div class="route-points" id="point-to-point-controls">
                    <div class="route-point">
                        <label>Start Point:</label>
                        <div class="point-input">
                            <input type="text" id="start-point" placeholder="Click map or enter coordinates" readonly>
                            <button id="set-start-point" class="point-btn">📍 Set Start</button>
                        </div>
                    </div>
                    <div class="route-point">
                        <label>End Point:</label>
                        <div class="point-input">
                            <input type="text" id="end-point" placeholder="Click map or enter coordinates" readonly>
                            <button id="set-end-point" class="point-btn">🎯 Set End</button>
                        </div>
                    </div>
                </div>

                <div class="emergency-controls" id="emergency-response-controls" style="display: none;">
                    <div class="incident-location">
                        <label>Incident Location:</label>
                        <div class="point-input">
                            <input type="text" id="incident-location" placeholder="Click map to set incident location" readonly>
                            <button id="set-incident-location" class="point-btn">🚨 Set Incident</button>
                        </div>
                    </div>
                    <div class="facility-type">
                        <label>Response Type:</label>
                        <select id="emergency-facility-type">
                            <option value="hospital">🏥 Medical Emergency</option>
                            <option value="fire_station">🚒 Fire Emergency</option>
                            <option value="police_station">🚔 Police Emergency</option>
                        </select>
                    </div>
                </div>

                <div class="route-options">
                    <div class="route-type">
                        <label>Route Type:</label>
                        <select id="route-type">
                            <option value="fastest">⚡ Fastest Route</option>
                            <option value="shortest">📏 Shortest Route</option>
                            <option value="emergency">🚨 Emergency Route</option>
                        </select>
                    </div>
                    
                    <div class="vehicle-type">
                        <label>Vehicle Type:</label>
                        <select id="vehicle-type">
                            <option value="car">🚗 Car</option>
                            <option value="ambulance">🚑 Ambulance</option>
                            <option value="fire_truck">🚒 Fire Truck</option>
                            <option value="police">🚔 Police Vehicle</option>
                        </select>
                    </div>
                </div>

                <div class="route-actions">
                    <button id="calculate-route" class="btn btn-primary" disabled>
                        Calculate Route
                    </button>
                    <button id="calculate-alternatives" class="btn btn-secondary" disabled>
                        Show Alternatives
                    </button>
                    <button id="clear-routes" class="btn btn-secondary" disabled>
                        Clear Routes
                    </button>
                </div>

                <div class="route-analysis">
                    <div class="option-group">
                        <label>
                            <input type="checkbox" id="analyze-facilities" checked>
                            Analyze Facilities Along Route
                        </label>
                    </div>
                    <div class="option-group">
                        <label>
                            <input type="checkbox" id="assess-risks">
                            Assess Route Risks
                        </label>
                    </div>
                    <div class="option-group">
                        <label>
                            <input type="checkbox" id="analyze-population">
                            Analyze Population Impact
                        </label>
                    </div>
                </div>

                <div class="route-results" id="route-results" style="display: none;">
                    <h4>Route Analysis</h4>
                    <div id="route-statistics"></div>
                </div>
            </div>
        `;

        controlPanel.appendChild(routeSection);
        console.log('✅ Route optimization section added to control panel');
    }

    /**
     * Setup event listeners for route controls
     */
    setupEventListeners() {
        // Route mode selection
        const routeModeSelect = document.getElementById('route-mode');
        if (routeModeSelect) {
            routeModeSelect.addEventListener('change', (e) => {
                this.handleRouteModeChange(e.target.value);
            });
        }

        // Point setting buttons
        this.setupPointSetters();

        // Route calculation buttons
        const calculateBtn = document.getElementById('calculate-route');
        if (calculateBtn) {
            calculateBtn.addEventListener('click', () => {
                this.calculateRoute();
            });
        }

        const alternativesBtn = document.getElementById('calculate-alternatives');
        if (alternativesBtn) {
            alternativesBtn.addEventListener('click', () => {
                this.calculateAlternativeRoutes();
            });
        }

        const clearBtn = document.getElementById('clear-routes');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearRoutes();
            });
        }

        const addStopBtn = document.getElementById('add-stop');
        if (addStopBtn) {
            addStopBtn.addEventListener('click', () => {
                this.activatePointSetting('waypoint');
            });
        }
        const clearStopsBtn = document.getElementById('clear-stops');
        if (clearStopsBtn) {
            clearStopsBtn.addEventListener('click', () => {
                this.clearWaypoints();
            });
        }

        // Map click handler for setting points
        this.setupMapClickHandler();
    }

    /**
     * Handle route mode change
     */
    handleRouteModeChange(mode) {
        const pointToPointControls = document.getElementById('point-to-point-controls');
        const emergencyControls = document.getElementById('emergency-response-controls');
        
        if (pointToPointControls && emergencyControls) {
            switch (mode) {
                case 'point-to-point':
                    pointToPointControls.style.display = 'block';
                    emergencyControls.style.display = 'none';
                    const multiControls = document.getElementById('multi-destination-controls');
                    if (multiControls) multiControls.style.display = 'none';
                    break;
                case 'multi-destination':
                    pointToPointControls.style.display = 'block';
                    emergencyControls.style.display = 'none';
                    const multiControls2 = document.getElementById('multi-destination-controls');
                    if (multiControls2) multiControls2.style.display = 'block';
                    break;
                case 'emergency-response':
                    pointToPointControls.style.display = 'none';
                    emergencyControls.style.display = 'block';
                    break;
            }
        }

        this.updateCalculateButtonState();
        console.log(`📍 Route mode changed to: ${mode}`);
    }

    /**
     * Setup point setter buttons
     */
    setupPointSetters() {
        const buttons = [
            { id: 'set-start-point', mode: 'start' },
            { id: 'set-end-point', mode: 'end' },
            { id: 'set-incident-location', mode: 'incident' }
        ];

        buttons.forEach(({ id, mode }) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', () => {
                    this.activatePointSetting(mode);
                });
            }
        });
    }

    /**
     * Activate point setting mode
     */
    activatePointSetting(mode) {
        // Deactivate any existing point setting
        this.deactivatePointSetting();
        
        // Set active mode
        this.activePointSetting = mode;
        
        // Update UI to show active state
        const button = document.getElementById(`set-${mode === 'incident' ? 'incident-location' : mode + '-point'}`);
        if (button) {
            button.classList.add('active');
            button.textContent = `✋ Click Map (${mode})`;
        }
        
        // Change map cursor
        this.map.getContainer().style.cursor = 'crosshair';
        
        console.log(`📍 Activated point setting mode: ${mode}`);
    }

    /**
     * Deactivate point setting mode
     */
    deactivatePointSetting() {
        if (this.activePointSetting) {
            const button = document.getElementById(`set-${this.activePointSetting === 'incident' ? 'incident-location' : this.activePointSetting + '-point'}`);
            if (button) {
                button.classList.remove('active');
                const icons = { start: '📍', end: '🎯', incident: '🚨' };
                button.textContent = `${icons[this.activePointSetting]} Set ${this.activePointSetting === 'incident' ? 'Incident' : this.activePointSetting.charAt(0).toUpperCase() + this.activePointSetting.slice(1)}`;
            }
        }
        
        this.activePointSetting = null;
        this.map.getContainer().style.cursor = '';
    }

    /**
     * Setup map click handler
     */
    setupMapClickHandler() {
        this.map.on('click', (e) => {
            if (this.activePointSetting) {
                this.setPoint(this.activePointSetting, [e.latlng.lng, e.latlng.lat]);
                this.deactivatePointSetting();
            }
        });
    }

    /**
     * Set a route point
     */
    setPoint(type, coordinates) {
        const [lng, lat] = coordinates;
        const coordText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        
        // Update input field
        const inputId = type === 'incident' ? 'incident-location' : `${type}-point`;
        const input = document.getElementById(inputId);
        if (input) {
            input.value = coordText;
        }
        
        // Store coordinates
        if (!this.routePoints) this.routePoints = {};
        if (type === 'waypoint') {
            if (!this.routePoints.waypoints) this.routePoints.waypoints = [];
            this.routePoints.waypoints.push(coordinates);
            this.updateWaypointsList();
        } else {
            this.routePoints[type] = coordinates;
        }
        
        // Add marker to map
        this.addPointMarker(type, coordinates);
        
        // Update button states
        this.updateCalculateButtonState();
        
        console.log(`📍 Set ${type} point: ${coordText}`);
    }

    /**
     * Add point marker to map
     */
    addPointMarker(type, coordinates) {
        // Remove existing marker of this type (except waypoints)
        if (type !== 'waypoint' && this.routeMarkers.has(type)) {
            this.map.removeLayer(this.routeMarkers.get(type));
        }
        
        const icons = {
            start: '🟢',
            end: '🔴',
            incident: '🚨'
        };
        
        const colors = {
            start: '#00ff88',
            end: '#ff4757',
            incident: '#ff6b6b',
            waypoint: '#ffa502'
        };
        
        const iconHtml = `
            <div class="route-marker" style="
                background: ${colors[type]};
                border: 2px solid white;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            ">
                ${icons[type]}
            </div>
        `;
        
        const marker = L.marker(coordinates.slice().reverse(), {
            icon: L.divIcon({
                html: iconHtml,
                className: 'custom-route-marker',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        });
        
        marker.bindPopup(`
            <div class="route-point-popup">
                <h4>${icons[type]} ${type.charAt(0).toUpperCase() + type.slice(1)} Point</h4>
                <p><strong>Coordinates:</strong> ${coordinates[1].toFixed(4)}, ${coordinates[0].toFixed(4)}</p>
            </div>
        `);
        
        marker.addTo(this.map);
        const markerKey = type === 'waypoint' ? `waypoint_${Date.now()}` : type;
        this.routeMarkers.set(markerKey, marker);
    }


    updateWaypointsList() {
        const list = document.getElementById('waypoints-list');
        if (!list) return;
        const waypoints = this.routePoints?.waypoints || [];
        list.innerHTML = waypoints.map((pt, i) => `Stop ${i + 1}: ${pt[1].toFixed(4)}, ${pt[0].toFixed(4)}`).join('<br>');
    }

    clearWaypoints() {
        if (this.routePoints) this.routePoints.waypoints = [];
        this.updateWaypointsList();
    }

    /**
     * Update calculate button state
     */

    async collectAvoidAreas() {
        const areas = [];
        if (window.dataLayerManager) {
            const damageFeatures = window.dataLayerManager.getLayerFeatures('damage_assessment');
            damageFeatures.forEach(f => areas.push(f));
        }
        try {
            const res = await fetch(`${DynamicConfig.api.baseUrl}/disasters`);
            if (res.ok) {
                const data = await res.json();
                (data.disasters || []).forEach(d => {
                    if (d.geometry) {
                        areas.push({ type: 'Feature', geometry: d.geometry, properties: { source: 'disaster' } });
                    }
                });
            }
        } catch (e) {}
        const traffic = window.realTimeDataManager?.latestData?.traffic;
        if (traffic?.closures && Array.isArray(traffic.closures)) {
            traffic.closures.forEach((c) => {
                if (c?.geometry) areas.push({ type: 'Feature', geometry: c.geometry, properties: { source: 'traffic' } });
            });
        }
        return areas;
    }

    updateCalculateButtonState() {
        const calculateBtn = document.getElementById('calculate-route');
        const alternativesBtn = document.getElementById('calculate-alternatives');
        const routeMode = document.getElementById('route-mode')?.value;
        
        let canCalculate = false;
        
        if (routeMode === 'emergency-response') {
            canCalculate = this.routePoints?.incident;
        } else {
            canCalculate = this.routePoints?.start && this.routePoints?.end;
        }
        
        if (calculateBtn) calculateBtn.disabled = !canCalculate;
        if (alternativesBtn) alternativesBtn.disabled = !canCalculate;
    }

    /**
     * Calculate route
     */
    async calculateRoute() {
        try {
            if (!this.routeEngine) {
                throw new Error('Route optimization engine not available');
            }

            const routeMode = document.getElementById('route-mode')?.value;
            const routeType = document.getElementById('route-type')?.value || 'fastest';
            const vehicleType = document.getElementById('vehicle-type')?.value || 'car';
            
            console.log(`🗺️ Calculating ${routeType} route (${routeMode} mode)`);
            
            // Show loading indicator
            this.showLoadingIndicator(true);
            
            let route;
            
            if (routeMode === 'emergency-response') {
                const facilityType = document.getElementById('emergency-facility-type')?.value || 'hospital';
                const routes = await this.routeEngine.calculateEmergencyResponseRoutes(
                    this.routePoints.incident,
                    facilityType,
                    {
                        routeType,
                        vehicleType,
                        maxDistance: 50000,
                        analyzeFacilities: document.getElementById('analyze-facilities')?.checked,
                        assessRisks: document.getElementById('assess-risks')?.checked,
                        analyzePopulation: document.getElementById('analyze-population')?.checked
                    }
                );
                
                if (routes.length > 0) {
                    route = routes[0]; // Use the fastest response route
                    this.renderEmergencyRoutes(routes);
                    this.updateEmergencyRouteResults(routes);
                } else {
                    throw new Error('No emergency routes found');
                }
            } else if (routeMode === 'multi-destination') {
                const waypoints = this.routePoints.waypoints || [];
                route = await this.routeEngine.calculateMultiStopRoute(
                    [this.routePoints.start, ...waypoints, this.routePoints.end],
                    {
                        routeType,
                        vehicleType
                    }
                );
                this.renderRoute(route, 'primary');
                this.updateRouteResults(route);
            } else {
                const avoidAreas = await this.collectAvoidAreas();
                route = await this.routeEngine.calculateOptimalRoute(
                    this.routePoints.start,
                    this.routePoints.end,
                    {
                        routeType,
                        vehicleType,
                        analyzeFacilities: document.getElementById('analyze-facilities')?.checked,
                        assessRisks: document.getElementById('assess-risks')?.checked,
                        analyzePopulation: document.getElementById('analyze-population')?.checked,
                        avoidAreas,
                        start: this.routePoints.start,
                        end: this.routePoints.end
                    }
                );
                
                this.renderRoute(route, 'primary');
                this.updateRouteResults(route);
            }
            
            if (route) {
                this.enableRouteControls(true);
                console.log('✅ Route calculated and displayed');
                
                // Show route source information
                this.showRouteSourceInfo(route);
            }
            
        } catch (error) {
            console.error('❌ Route calculation failed:', error);
            this.showError(`Route calculation failed: ${error.message}`);
        } finally {
            this.showLoadingIndicator(false);
        }
    }

    /**
     * Calculate alternative routes
     */
    async calculateAlternativeRoutes() {
        try {
            if (!this.routeEngine) {
                throw new Error('Route optimization engine not available');
            }

            const vehicleType = document.getElementById('vehicle-type')?.value || 'car';
            
            console.log('🗺️ Calculating alternative routes...');
            
            const routes = await this.routeEngine.calculateMultipleRoutes(
                this.routePoints.start,
                this.routePoints.end,
                {
                    vehicleType,
                    emergencyPriority: document.getElementById('route-type')?.value === 'emergency',
                    analyzeFacilities: document.getElementById('analyze-facilities')?.checked
                }
            );
            
            this.renderAlternativeRoutes(routes);
            this.updateAlternativeRouteResults(routes);
            
            console.log(`✅ ${routes.length} alternative routes calculated`);
            
        } catch (error) {
            console.error('❌ Alternative route calculation failed:', error);
            this.showError(`Alternative route calculation failed: ${error.message}`);
        }
    }

    /**
     * Render route on map
     */
    renderRoute(route, routeId = 'primary') {
        // Remove existing route
        if (this.routeLayers.has(routeId)) {
            this.map.removeLayer(this.routeLayers.get(routeId));
        }
        
        const colors = {
            primary: '#007bff',
            fastest: '#00ff88',
            shortest: '#ff6b6b',
            emergency: '#ff4757'
        };
        
        const color = colors[route.routeType] || colors[routeId] || colors.primary;
        
        const routeLayer = L.geoJSON(route.geometry, {
            style: {
                color: color,
                weight: 4,
                opacity: 0.8,
                dashArray: routeId === 'primary' ? null : '10, 5'
            }
        });
        
        routeLayer.bindPopup(`
            <div class="route-popup">
                <h4>🗺️ ${route.routeType?.charAt(0).toUpperCase() + route.routeType?.slice(1) || 'Route'}</h4>
                <p><strong>Distance:</strong> ${(route.distance / 1000).toFixed(1)} km</p>
                <p><strong>Duration:</strong> ${Math.round(route.duration / 60)} minutes</p>
                <p><strong>Vehicle:</strong> ${route.vehicleType || 'Car'}</p>
            </div>
        `);
        
        routeLayer.addTo(this.map);
        this.routeLayers.set(routeId, routeLayer);
        
        // Fit map to route bounds
        if (routeId === 'primary') {
            this.map.fitBounds(routeLayer.getBounds(), { padding: [20, 20] });
        }
    }

    /**
     * Render emergency response routes
     */
    renderEmergencyRoutes(routes) {
        routes.forEach((route, index) => {
            this.renderRoute(route, `emergency_${index}`);
            
            // Add facility marker
            if (route.facility) {
                this.addFacilityMarker(route.facility, index);
            }
        });
    }

    /**
     * Render alternative routes
     */
    renderAlternativeRoutes(routes) {
        routes.forEach((route, index) => {
            this.renderRoute(route, `alternative_${index}`);
        });
    }

    /**
     * Add facility marker
     */
    addFacilityMarker(facility, index) {
        const icons = {
            hospital: '🏥',
            fire_station: '🚒',
            police_station: '🚔'
        };
        
        const icon = icons[facility.type] || '📍';
        
        const marker = L.marker(facility.coordinates.slice().reverse(), {
            icon: L.divIcon({
                html: `<div style="background: white; border: 2px solid #007bff; border-radius: 50%; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; font-size: 14px;">${icon}</div>`,
                className: 'facility-marker',
                iconSize: [25, 25],
                iconAnchor: [12, 12]
            })
        });
        
        marker.bindPopup(`
            <div class="facility-popup">
                <h4>${icon} ${facility.name}</h4>
                <p><strong>Distance:</strong> ${(facility.distance / 1000).toFixed(1)} km</p>
                <p><strong>Priority:</strong> ${facility.priority}</p>
                <p><strong>Type:</strong> ${facility.type.replace('_', ' ').toUpperCase()}</p>
            </div>
        `);
        
        marker.addTo(this.map);
        this.routeMarkers.set(`facility_${index}`, marker);
    }

    /**
     * Update route results display
     */
    updateRouteResults(route) {
        const resultsDiv = document.getElementById('route-results');
        const statisticsDiv = document.getElementById('route-statistics');
        
        if (resultsDiv && statisticsDiv) {
            const sourceInfo = route.source ? `
                <div class="route-stat">
                    <span class="stat-label">Data Source:</span>
                    <span class="stat-value">${route.source === 'osrm' ? '🌐 OSRM (Real Roads)' : '📍 Fallback (Estimated)'}</span>
                </div>
            ` : '';
            
            statisticsDiv.innerHTML = `
                <div class="route-stat">
                    <span class="stat-label">Distance:</span>
                    <span class="stat-value">${(route.distance / 1000).toFixed(1)} km</span>
                </div>
                <div class="route-stat">
                    <span class="stat-label">Straight-line:</span>
                    <span class="stat-value">${this.getStraightLineDistance(route)} km</span>
                </div>
                <div class="route-stat">
                    <span class="stat-label">Duration:</span>
                    <span class="stat-value">${Math.round(route.duration / 60)} minutes</span>
                </div>
                <div class="route-stat">
                    <span class="stat-label">Route Type:</span>
                    <span class="stat-value">${route.routeType || 'Standard'}</span>
                </div>
                <div class="route-stat">
                    <span class="stat-label">Vehicle:</span>
                    <span class="stat-value">${route.vehicleType || 'Car'}</span>
                </div>
                ${sourceInfo}
                ${route.estimatedResponseTime ? `
                <div class="route-stat">
                    <span class="stat-label">Response Time:</span>
                    <span class="stat-value">${route.estimatedResponseTime.toFixed(1)} minutes</span>
                </div>
                ` : ''}
                ${this.renderInstructions(route)}
            `;
            
            resultsDiv.style.display = 'block';
        }
    }

    getStraightLineDistance(route) {
        try {
            const coords = route?.geometry?.coordinates;
            if (!coords || coords.length < 2) return 'N/A';
            const start = coords[0];
            const end = coords[coords.length - 1];
            const distanceKm = turf.distance(turf.point(start), turf.point(end), { units: 'kilometers' });
            return distanceKm.toFixed(1);
        } catch (e) {
            return 'N/A';
        }
    }

    /**
     * Render turn-by-turn instructions for a route
     */
    renderInstructions(route) {
        const steps = route?.instructions || route?.steps || [];
        if (!steps || steps.length === 0) {
            return '';
        }

        const listItems = steps.slice(0, 12).map((step, index) => {
            const instruction = step.instruction || step.name || 'Continue';
            const distance = step.distance ? `${Math.round(step.distance)} m` : '';
            const duration = step.duration ? `${Math.round(step.duration / 60)} min` : '';
            const details = [distance, duration].filter(Boolean).join(', ');
            return `<li>${index + 1}. ${instruction}${details ? ` (${details})` : ''}</li>`;
        }).join('');

        return `
            <div class="route-instructions">
                <h5>Turn-by-turn (first ${Math.min(12, steps.length)} steps)</h5>
                <ol>${listItems}</ol>
            </div>
        `;
    }

    /**
     * Update emergency route results
     */
    updateEmergencyRouteResults(routes) {
        const statisticsDiv = document.getElementById('route-statistics');
        
        if (statisticsDiv && routes.length > 0) {
            const primaryRoute = routes[0];
            let html = `
                <div class="emergency-route-primary">
                    <h5>🚨 Fastest Emergency Response:</h5>
                    <div class="route-stat">
                        <span class="stat-label">Facility:</span>
                        <span class="stat-value">${primaryRoute.facility?.name || 'Unknown'}</span>
                    </div>
                    <div class="route-stat">
                        <span class="stat-label">Response Time:</span>
                        <span class="stat-value">${primaryRoute.estimatedResponseTime?.toFixed(1) || 'Unknown'} minutes</span>
                    </div>
                    <div class="route-stat">
                        <span class="stat-label">Distance:</span>
                        <span class="stat-value">${(primaryRoute.distance / 1000).toFixed(1)} km</span>
                    </div>
                    <div class="route-stat">
                        <span class="stat-label">Priority:</span>
                        <span class="stat-value">Level ${primaryRoute.priority || 'Unknown'}</span>
                    </div>
                    <div class="route-stat">
                        <span class="stat-label">Data Source:</span>
                        <span class="stat-value">${primaryRoute.source === 'osrm_emergency' ? '🌐 OSRM Emergency' : primaryRoute.source === 'osrm' ? '🌐 OSRM' : '📍 Fallback'}</span>
                    </div>
                </div>
            `;
            
            if (routes.length > 1) {
                html += '<h5>Alternative Emergency Routes:</h5>';
                routes.slice(1, 4).forEach((route, index) => {
                    html += `
                        <div class="alternative-emergency-route">
                            <strong>${route.facility?.name || `Option ${index + 2}`}:</strong>
                            ${route.estimatedResponseTime?.toFixed(1) || 'Unknown'} min, 
                            ${(route.distance / 1000).toFixed(1)} km
                            ${route.source === 'osrm_emergency' ? ' (🌐 Real)' : route.source === 'osrm' ? ' (🌐 OSRM)' : ' (📍 Est.)'}
                        </div>
                    `;
                });
            }
            
            statisticsDiv.innerHTML = html;
        }
    }

    /**
     * Show loading indicator
     */
    showLoadingIndicator(show) {
        const calculateBtn = document.getElementById('calculate-route');
        const alternativesBtn = document.getElementById('calculate-alternatives');
        
        if (show) {
            if (calculateBtn) {
                calculateBtn.disabled = true;
                calculateBtn.textContent = '⏳ Calculating...';
            }
            if (alternativesBtn) {
                alternativesBtn.disabled = true;
            }
        } else {
            if (calculateBtn) {
                calculateBtn.disabled = false;
                calculateBtn.textContent = 'Calculate Route';
            }
            if (alternativesBtn) {
                alternativesBtn.disabled = false;
            }
        }
    }

    /**
     * Show route source information
     */
    showRouteSourceInfo(route) {
        if (route.source === 'osrm' || route.source === 'osrm_emergency') {
            console.log('✅ Using real OSRM road network data');
        } else if (route.source === 'fallback') {
            console.log('⚠️ Using fallback routing (OSRM unavailable)');
        }
    }

    /**
     * Update alternative route results
     */
    updateAlternativeRouteResults(routes) {
        const statisticsDiv = document.getElementById('route-statistics');
        
        if (statisticsDiv) {
            let html = '<h5>Alternative Routes:</h5>';
            
            routes.forEach((route, index) => {
                html += `
                    <div class="alternative-route">
                        <strong>${route.routeType} Route:</strong>
                        ${(route.distance / 1000).toFixed(1)} km, ${Math.round(route.duration / 60)} min
                    </div>
                `;
            });
            
            statisticsDiv.innerHTML = html;
        }
    }

    /**
     * Clear all routes
     */
    clearRoutes() {
        // Remove all route layers
        this.routeLayers.forEach((layer) => {
            this.map.removeLayer(layer);
        });
        this.routeLayers.clear();
        
        // Remove all markers except point markers
        const keepMarkers = ['start', 'end', 'incident'];
        this.routeMarkers.forEach((marker, key) => {
            if (!keepMarkers.includes(key)) {
                this.map.removeLayer(marker);
            }
        });
        
        // Keep only point markers
        const pointMarkers = new Map();
        keepMarkers.forEach(key => {
            if (this.routeMarkers.has(key)) {
                pointMarkers.set(key, this.routeMarkers.get(key));
            }
        });
        this.routeMarkers = pointMarkers;
        
        // Hide results
        const resultsDiv = document.getElementById('route-results');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
        }
        
        this.enableRouteControls(false);
        console.log('🧹 Routes cleared');
    }

    /**
     * Enable/disable route control buttons
     */
    enableRouteControls(enabled) {
        const clearBtn = document.getElementById('clear-routes');
        if (clearBtn) {
            clearBtn.disabled = !enabled;
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        console.error(message);
        alert(message);
    }

    /**
     * Get route visualization statistics
     */
    getRouteStats() {
        return {
            activeRoutes: this.routeLayers.size,
            activeMarkers: this.routeMarkers.size,
            isActive: this.isActive
        };
    }
}
