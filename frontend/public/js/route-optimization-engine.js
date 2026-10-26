/**
 * Route Optimization Engine
 * Handles route calculation, optimization, and emergency response routing
 */

class RouteOptimizationEngine {
    constructor(map, spatialEngine, config) {
        this.map = map;
        this.spatialEngine = spatialEngine;
        this.config = config;
        this.routeCache = new Map();
        this.activeRoutes = new Map();
        this.routingService = null;
        
        this.initializeRouting();
    }

    /**
     * Initialize routing system
     */
    initializeRouting() {
        // Check for routing dependencies
        this.checkRoutingDependencies();
        
        // Initialize routing service (using Leaflet Routing Machine or similar)
        this.setupRoutingService();
        
        console.log('✅ Route Optimization Engine initialized');
    }

    /**
     * Check routing dependencies
     */
    checkRoutingDependencies() {
        const dependencies = [
            { name: 'Leaflet', check: () => typeof L !== 'undefined', required: true },
            { name: 'Turf.js', check: () => typeof turf !== 'undefined', required: true }
        ];

        const missing = dependencies.filter(dep => dep.required && !dep.check());
        
        if (missing.length > 0) {
            console.error('❌ Missing routing dependencies:', missing.map(d => d.name));
            throw new Error(`Missing routing dependencies: ${missing.map(d => d.name).join(', ')}`);
        }

        console.log('✅ Routing dependencies available');
    }

    /**
     * Setup routing service
     */
    setupRoutingService() {
        // Initialize OSRM routing service with real API integration
        this.routingService = {
            calculateRoute: (start, end, options = {}) => {
                return this.calculateOSRMRoute(start, end, options);
            },
            calculateMultipleRoutes: (waypoints, options = {}) => {
                return this.calculateMultipleRoutes(waypoints, options);
            }
        };
        
        // Get routing configuration from dynamic config
        this.routingConfig = this.config?.routing || {
            apiUrl: 'http://localhost:8082',
            osrmUrl: 'http://localhost:5000',
            timeout: 15000,
            cacheEnabled: true
        };
        
        console.log('🔧 OSRM routing service configured:', this.routingConfig);
    }

    /**
     * Calculate optimal route between two points using OSRM API
     * @param {Array} start - [lng, lat] coordinates
     * @param {Array} end - [lng, lat] coordinates
     * @param {Object} options - Routing options
     * @returns {Object} Route information
     */
    async calculateOptimalRoute(start, end, options = {}) {
        try {
            const {
                routeType = 'fastest', // fastest, shortest, emergency
                avoidAreas = [],
                vehicleType = 'car',
                emergencyPriority = false
            } = options;

            // Check cache first
            const cacheKey = this.generateCacheKey(start, end, options);
            if (this.routeCache.has(cacheKey)) {
                console.log('📋 Using cached route');
                return this.routeCache.get(cacheKey);
            }

            console.log(`🗺️ Calculating ${routeType} route from [${start}] to [${end}]`);

            // Try OSRM API first, fallback to simple routing if unavailable
            let routeResult;
            try {
                routeResult = await this.calculateOSRMRoute(start, end, options);
                options.start = start;
                options.end = end;
                console.log('✅ Using OSRM routing service');
            } catch (osrmError) {
                console.warn('⚠️ OSRM routing failed, using fallback:', osrmError.message);
                routeResult = await this.calculateSimpleRoute(start, end, options);
            }

            // Avoid obstacles if provided
            if (options.avoidAreas && options.avoidAreas.length > 0) {
                const avoided = await this.avoidRouteObstacles(routeResult, options.avoidAreas, options);
                if (avoided) {
                    routeResult = avoided;
                }
            }

            // Enhance route with additional analysis
            const enhancedRoute = await this.enhanceRouteWithAnalysis(routeResult, options);

            // Cache the result
            this.routeCache.set(cacheKey, enhancedRoute);

            console.log(`✅ Route calculated: ${enhancedRoute.distance}m, ${enhancedRoute.duration}s`);
            return enhancedRoute;

        } catch (error) {
            console.error('❌ Route calculation failed:', error);
            throw error;
        }
    }

    /**
     * Calculate route using OSRM API
     */
    async calculateOSRMRoute(start, end, options = {}) {
        try {
            const {
                routeType = 'fastest',
                vehicleType = 'car'
            } = options;

            // Map vehicle types to OSRM profiles
            const profileMap = this.config?.routing?.profiles || {
                car: 'driving',
                ambulance: 'driving',
                fire_truck: 'driving',
                police: 'driving'
            };
            
            const profile = profileMap[vehicleType] || 'driving';
            
            // Prepare request to routing API
            const requestBody = {
                start: start,
                end: end,
                profile: profile,
                alternatives: routeType === 'emergency' ? false : true,
                steps: true,
                geometries: 'geojson'
            };

            console.log('🌐 Calling OSRM routing API:', requestBody);

            const response = await fetch(`${this.routingConfig.apiUrl}/route`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.routingConfig.timeout)
            });

            if (!response.ok) {
                throw new Error(`OSRM API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
                throw new Error(`OSRM routing failed: ${data.message || 'No routes found'}`);
            }

            // Process the best route
            const osrmRoute = data.routes[0];
            if (!osrmRoute.distance || osrmRoute.distance <= 0) {
                throw new Error('OSRM returned zero-distance route');
            }
            
            return {
                geometry: osrmRoute.geometry,
                distance: osrmRoute.distance,
                duration: osrmRoute.duration,
                instructions: osrmRoute.instructions || [],
                waypoints: data.waypoints || [],
                routeType: routeType,
                vehicleType: vehicleType,
                source: 'osrm'
            };

        } catch (error) {
            console.error('❌ OSRM route calculation failed:', error);
            throw error;
        }
    }

    /**
     * Calculate simple route (fallback implementation)
     */
    calculateSimpleRoute(start, end, options = {}) {
        try {
            // Create a more realistic route that follows approximate road patterns
            const startPoint = turf.point(start);
            const endPoint = turf.point(end);
            
            // Calculate straight-line distance
            const straightDistance = turf.distance(startPoint, endPoint, { units: 'meters' });
            
            // Create a more realistic route with waypoints that approximate road networks
            const waypoints = this.generateRealisticWaypoints(start, end);
            const routeLine = turf.lineString(waypoints);
            
            // Calculate more realistic distance (typically 1.3-1.5x straight line distance)
            const roadFactor = this.getRoadFactor(options.routeType);
            const distance = Math.round(straightDistance * roadFactor);
            
            // Estimate duration based on distance and route type
            const speed = this.getEstimatedSpeed(options.routeType, options.vehicleType);
            const duration = (distance / 1000 / speed) * 3600; // Convert to seconds
            
            return {
                geometry: routeLine,
                distance: distance,
                duration: Math.round(duration),
                instructions: [
                    { instruction: 'Start route', distance: 0, duration: 0 },
                    { instruction: `Follow main roads for ${(distance/1000).toFixed(1)}km`, distance: distance * 0.8, duration: duration * 0.8 },
                    { instruction: 'Arrive at destination', distance: distance, duration: duration }
                ],
                waypoints: waypoints.map(coord => turf.point(coord)),
                routeType: options.routeType || 'fastest',
                vehicleType: options.vehicleType || 'car'
            };
        } catch (error) {
            console.error('❌ Simple route calculation failed:', error);
            throw error;
        }
    }

    /**
     * Generate realistic waypoints that approximate road networks
     */
    generateRealisticWaypoints(start, end) {
        const waypoints = [start];
        
        // Calculate distance to determine number of waypoints
        const distance = turf.distance(turf.point(start), turf.point(end));
        const numWaypoints = Math.min(8, Math.max(3, Math.floor(distance / 15))); // More waypoints for longer routes
        
        // Determine if this is likely a highway route (long distance) or city route
        const isHighwayRoute = distance > 50; // km
        
        for (let i = 1; i < numWaypoints; i++) {
            const ratio = i / numWaypoints;
            
            // Linear interpolation
            const lat = start[1] + (end[1] - start[1]) * ratio;
            const lng = start[0] + (end[0] - start[0]) * ratio;
            
            // Add realistic deviation based on route type
            let deviation;
            if (isHighwayRoute) {
                // Highway routes: less deviation, more direct
                deviation = 0.005 + Math.random() * 0.01;
            } else {
                // City routes: more deviation to simulate city streets
                deviation = 0.01 + Math.random() * 0.02;
            }
            
            // Create curved path that simulates following major roads
            const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
            const perpAngle = angle + Math.PI / 2;
            
            // Alternate sides to create a more natural curve
            const side = (i % 2 === 0) ? 1 : -1;
            const curveFactor = Math.sin(ratio * Math.PI) * side; // Creates a smooth curve
            
            const deviatedLat = lat + Math.sin(perpAngle) * deviation * curveFactor;
            const deviatedLng = lng + Math.cos(perpAngle) * deviation * curveFactor;
            
            waypoints.push([deviatedLng, deviatedLat]);
        }
        
        waypoints.push(end);
        return waypoints;
    }

    /**
     * Get road factor for distance calculation (accounts for road network vs straight line)
     */
    getRoadFactor(routeType) {
        const factors = {
            fastest: 1.4,    // Highways and main roads
            shortest: 1.3,   // More direct routes
            safest: 1.6,     // Prefer safer, potentially longer routes
            emergency: 1.2   // Emergency routes with priority access
        };
        return factors[routeType] || 1.4;
    }

    /**
     * Get estimated speed based on route type and vehicle
     */
    getEstimatedSpeed(routeType, vehicleType) {
        const speeds = {
            car: {
                fastest: 60, // km/h
                shortest: 40,
                safest: 35,
                emergency: 80
            },
            ambulance: {
                fastest: 70,
                shortest: 50,
                safest: 40,
                emergency: 100
            },
            fire_truck: {
                fastest: 60,
                shortest: 40,
                safest: 35,
                emergency: 90
            },
            police: {
                fastest: 80,
                shortest: 50,
                safest: 45,
                emergency: 120
            }
        };

        return speeds[vehicleType]?.[routeType] || speeds.car.fastest;
    }


    async calculateMultiStopRoute(waypoints, options = {}) {
        try {
            const profileMap = this.config?.routing?.profiles || { car: 'driving' };
            const profile = profileMap[options.vehicleType] || 'driving';
            const requestBody = {
                waypoints,
                profile,
                alternatives: false,
                steps: true,
                geometries: 'geojson'
            };
            const response = await fetch(`${this.routingConfig.apiUrl}/route-multi`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.routingConfig.timeout)
            });
            if (!response.ok) {
                throw new Error(`Multi-route API error: ${response.status}`);
            }
            const data = await response.json();
            if (!data.routes || data.routes.length === 0) {
                throw new Error('No multi-stop routes found');
            }
            const osrmRoute = data.routes[0];
            return {
                geometry: osrmRoute.geometry,
                distance: osrmRoute.distance,
                duration: osrmRoute.duration,
                instructions: osrmRoute.instructions || [],
                waypoints: data.waypoints || [],
                routeType: options.routeType || 'fastest',
                vehicleType: options.vehicleType || 'car',
                source: 'osrm'
            };
        } catch (error) {
            console.warn('Multi-stop routing failed, falling back to simple routing:', error.message);
            const start = waypoints[0];
            const end = waypoints[waypoints.length - 1];
            return this.calculateSimpleRoute(start, end, options);
        }
    }

    /**
     * Calculate multiple routes for comparison
     */
    async calculateMultipleRoutes(start, end, options = {}) {
        try {
            const routeTypes = ['fastest', 'shortest', 'safest'];
            if (options.emergencyPriority) {
                routeTypes.push('emergency');
            }

            const routes = [];
            
            for (const routeType of routeTypes) {
                try {
                    const route = await this.calculateOptimalRoute(start, end, {
                        ...options,
                        routeType
                    });
                    routes.push({
                        ...route,
                        routeType,
                        id: `route_${routeType}_${Date.now()}`
                    });
                } catch (error) {
                    console.warn(`Failed to calculate ${routeType} route:`, error);
                }
            }

            // Sort routes by preference (emergency first, then fastest, then shortest)
            routes.sort((a, b) => {
                const priority = { emergency: 0, fastest: 1, safest: 2, shortest: 3 };
                return priority[a.routeType] - priority[b.routeType];
            });

            console.log(`✅ Calculated ${routes.length} alternative routes`);
            return routes;

        } catch (error) {
            console.error('❌ Multiple route calculation failed:', error);
            throw error;
        }
    }


    async avoidRouteObstacles(route, avoidAreas, options = {}) {
        try {
            const intersects = avoidAreas.some(area => turf.booleanIntersects(route.geometry, area));
            if (!intersects) return null;
            const area = avoidAreas[0];
            const bbox = turf.bbox(area);
            const detour = [bbox[2] + 0.05, (bbox[1] + bbox[3]) / 2];
            const start = options.start || options.startPoint || null;
            const end = options.end || options.endPoint || null;
            if (!start || !end) return null;
            const detourRoute = await this.calculateMultiStopRoute([start, detour, end], options);
            detourRoute.avoidance = true;
            return detourRoute;
        } catch (e) {
            console.warn('Obstacle avoidance failed:', e);
            return null;
        }
    }

    /**
     * Enhance route with additional analysis
     */
    async enhanceRouteWithAnalysis(route, options = {}) {
        try {
            const enhanced = { ...route };

            // Add facility analysis along route
            if (options.analyzeFacilities) {
                enhanced.facilitiesAlongRoute = await this.analyzeFacilitiesAlongRoute(route);
            }

            // Add risk assessment
            if (options.assessRisks) {
                enhanced.riskAssessment = await this.assessRouteRisks(route);
            }

            // Add population impact
            if (options.analyzePopulation) {
                enhanced.populationImpact = await this.analyzeRoutePopulationImpact(route);
            }

            // Add real-time factors (traffic, weather, etc.)
            if (options.includeRealTimeFactors) {
                enhanced.realTimeFactors = await this.analyzeRealTimeFactors(route);
            }

            return enhanced;

        } catch (error) {
            console.warn('Route enhancement failed:', error);
            return route; // Return basic route if enhancement fails
        }
    }

    /**
     * Analyze facilities along route
     */
    async analyzeFacilitiesAlongRoute(route, bufferDistance = 1000) {
        try {
            if (!this.spatialEngine) {
                return { hospitals: [], fireStations: [], policeStations: [] };
            }
            const routeBuffer = turf.buffer(route.geometry, bufferDistance / 1000, { units: 'kilometers' });
            const layers = ['agency_hospital', 'agency_fire', 'agency_police'];
            const results = { hospitals: [], fireStations: [], policeStations: [] };
            for (const layer of layers) {
                try {
                    const response = await fetch(`${this.config.api.baseUrl}/layers/${layer}/within`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ geometry: routeBuffer.geometry, limit: 2000 })
                    });
                    if (!response.ok) continue;
                    const data = await response.json();
                    const feats = data.features || [];
                    if (layer === 'agency_hospital') results.hospitals = feats;
                    if (layer === 'agency_fire') results.fireStations = feats;
                    if (layer === 'agency_police') results.policeStations = feats;
                } catch (e) {
                    console.warn('Facility query failed:', e);
                }
            }
            return results;
        } catch (error) {
            console.warn('Facility analysis along route failed:', error);
            return { hospitals: [], fireStations: [], policeStations: [] };
        }
    }


    /**
     * Assess risks along route
     */
    async assessRouteRisks(route) {
        try {
            // Basic risk assessment (can be enhanced with real-time feeds)
            const risks = {
                floodRisk: 'low',
                trafficRisk: 'medium',
                weatherRisk: 'low',
                securityRisk: 'low',
                overallRisk: 'low'
            };

            return risks;

        } catch (error) {
            console.warn('Route risk assessment failed:', error);
            return { overallRisk: 'unknown' };
        }
    }

    /**
     * Analyze population impact along route
     */
    async analyzeRoutePopulationImpact(route, bufferDistance = 500) {
        try {
            const routeBuffer = turf.buffer(route.geometry, bufferDistance / 1000, { units: 'kilometers' });
            const bufferArea = turf.area(routeBuffer);

            const populationFeatures = window.dataLayerManager?.getLayerFeatures('population_density') || [];
            if (!populationFeatures.length) {
                return {
                    bufferArea,
                    estimatedPopulation: 0,
                    populationDensity: 0,
                    vulnerablePopulation: { children: 0, elderly: 0, disabled: 0 },
                    confidence: 'low'
                };
            }

            let totalPopulation = 0;
            let children = 0;
            let elderly = 0;
            let disabled = 0;

            populationFeatures.forEach((feature) => {
                try {
                    if (!turf.booleanIntersects(routeBuffer, feature)) return;
                    let pop = feature.properties?.population;
                    if (pop === undefined || pop === null) {
                        const density = feature.properties?.population_density;
                        if (density) {
                            const areaKm2 = turf.area(feature) / 1000000;
                            pop = density * areaKm2;
                        } else {
                            pop = 0;
                        }
                    }
                    totalPopulation += pop;
                    const childrenPct = (feature.properties?.children_pct || 0) / 100;
                    const elderlyPct = (feature.properties?.elderly_pct || 0) / 100;
                    const disabledPct = (feature.properties?.disabled_pct || 0) / 100;
                    children += pop * childrenPct;
                    elderly += pop * elderlyPct;
                    disabled += pop * disabledPct;
                } catch (e) {}
            });

            const populationDensity = bufferArea > 0 ? totalPopulation / (bufferArea / 1000000) : 0;

            return {
                bufferArea,
                estimatedPopulation: Math.round(totalPopulation),
                populationDensity: Math.round(populationDensity * 100) / 100,
                vulnerablePopulation: {
                    children: Math.round(children),
                    elderly: Math.round(elderly),
                    disabled: Math.round(disabled)
                },
                confidence: 'medium'
            };

        } catch (error) {
            console.warn('Route population impact analysis failed:', error);
            return { estimatedPopulation: 0 };
        }
    }


    /**
     * Analyze real-time factors
     */
    async analyzeRealTimeFactors(route) {
        try {
            const realtime = window.realTimeDataManager?.latestData || {};
            if (!realtime || Object.keys(realtime).length === 0) {
                return { status: 'not-configured' };
            }

            return {
                traffic: realtime.traffic || realtime.trafficData || null,
                weather: realtime.weather || realtime.weatherData || null,
                emergency: realtime.emergency || realtime.emergencyData || null
            };

        } catch (error) {
            console.warn('Real-time factor analysis failed:', error);
            return {};
        }
    }


    /**
     * Generate cache key for route
     */
    generateCacheKey(start, end, options) {
        const key = `${start.join(',')}_${end.join(',')}_${JSON.stringify(options)}`;
        return btoa(key).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
    }

    /**
     * Clear route cache
     */
    clearCache() {
        this.routeCache.clear();
        console.log('🧹 Route cache cleared');
    }

    /**
     * Get route statistics
     */
    getRouteStats() {
        return {
            cachedRoutes: this.routeCache.size,
            activeRoutes: this.activeRoutes.size,
            totalCalculations: this.routeCache.size
        };
    }

    /**
     * Calculate emergency response routes using real OSRM API
     * Specialized method for emergency scenarios
     */
    async calculateEmergencyResponseRoutes(incidentLocation, facilityType = 'hospital', options = {}) {
        try {
            console.log(`🚨 Calculating emergency response routes to ${facilityType}`);

            // Use real facility data from API
            const facilities = await this.getRealFacilities(incidentLocation, facilityType, 5);
            if (!facilities || facilities.length === 0) {
                throw new Error(`No ${facilityType} facilities available in real data source`);
            }
            
            const emergencyRoutes = [];
            
            for (const facility of facilities) {
                try {
                    // Try OSRM API first, fallback to simple routing
                    let route;
                    try {
                        // Use emergency routing API endpoint
                        const emergencyRequest = {
                            incident: incidentLocation,
                            facility_type: facilityType,
                            max_facilities: 1,
                            max_distance: options.maxDistance || 50000,
                            vehicle_profile: this.getEmergencyVehicleProfile(facilityType)
                        };

                        const response = await fetch(`${this.routingConfig.apiUrl}/emergency-route`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(emergencyRequest),
                            signal: AbortSignal.timeout(this.routingConfig.timeout)
                        });

                        if (response.ok) {
                            const data = await response.json();
                            if (data.routes && data.routes.length > 0) {
                                const emergencyRoute = data.routes[0];
                                route = {
                                    geometry: emergencyRoute.route.geometry,
                                    distance: emergencyRoute.route.distance,
                                    duration: emergencyRoute.route.duration,
                                    instructions: emergencyRoute.route.instructions || [],
                                    facility: emergencyRoute.facility,
                                    estimatedResponseTime: emergencyRoute.response_time_minutes,
                                    priority: emergencyRoute.priority,
                                    vehicleType: emergencyRoute.vehicle_type,
                                    routeType: 'emergency',
                                    source: 'osrm_emergency'
                                };
                            }
                        }
                    } catch (osrmError) {
                        console.warn(`OSRM emergency routing failed for ${facility.name}, using fallback:`, osrmError.message);
                    }

                    // Fallback to simple routing if OSRM failed
                    if (!route) {
                        const simpleRoute = await this.calculateOptimalRoute(
                            incidentLocation,
                            facility.coordinates,
                            {
                                ...options,
                                routeType: 'emergency',
                                emergencyPriority: true,
                                vehicleType: this.getEmergencyVehicleType(facilityType)
                            }
                        );
                        
                        route = {
                            ...simpleRoute,
                            facility: facility,
                            priority: facility.priority || 1,
                            estimatedResponseTime: simpleRoute.duration / 60, // Convert to minutes
                            source: 'fallback'
                        };
                    }
                    
                    emergencyRoutes.push(route);
                    
                } catch (error) {
                    console.warn(`Failed to calculate route to ${facility.name}:`, error);
                }
            }

            // Sort by response time
            emergencyRoutes.sort((a, b) => a.estimatedResponseTime - b.estimatedResponseTime);

            console.log(`✅ Calculated ${emergencyRoutes.length} emergency response routes`);
            return emergencyRoutes;

        } catch (error) {
            console.error('❌ Emergency response route calculation failed:', error);
            throw error;
        }
    }

    /**
     * Get real facilities from API
     */
    async getRealFacilities(location, facilityType, count = 5) {
        try {
            const requestBody = {
                location: location,
                facility_type: facilityType,
                radius: 50000, // 50km
                limit: count
            };

            const response = await fetch(`${this.routingConfig.apiUrl}/facilities`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.routingConfig.timeout)
            });

            if (!response.ok) {
                throw new Error(`Facilities API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.facilities || data.facilities.length === 0) {
                throw new Error('No facilities found in API response');
            }

            return data.facilities.map(facility => ({
                id: facility.id,
                name: facility.name,
                coordinates: facility.coordinates,
                priority: facility.priority,
                type: facility.type,
                capacity: facility.capacity,
                contact_info: facility.contact_info,
                address: facility.address
            }));

        } catch (error) {
            console.error('❌ Real facilities API failed:', error);
            throw error;
        }
    }

    /**
     * Get emergency vehicle profile for OSRM
     */
    getEmergencyVehicleProfile(facilityType) {
        const profileMap = this.config?.routing?.emergencyProfiles || {
            hospital: 'ambulance',
            fire_station: 'fire_truck',
            police_station: 'police'
        };
        
        return profileMap[facilityType] || 'driving';
    }

    /**
     * Get appropriate emergency vehicle type
     */
    getEmergencyVehicleType(facilityType) {
        const vehicleTypes = {
            hospital: 'ambulance',
            fire_station: 'fire_truck',
            police_station: 'police'
        };
        
        return vehicleTypes[facilityType] || 'car';
    }
}
