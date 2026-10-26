/**
 * Spatial Analysis Engine
 * Core spatial analysis operations for the Advanced GIS Analysis System
 */

class SpatialAnalysisEngine {
    constructor(map, config) {
        this.map = map;
        this.config = config;
        this.analysisLayers = new Map();
        this.analysisResults = new Map();
        
        // Check for MGRS availability and create fallback if needed
        if (typeof mgrs === 'undefined') {
            console.log('⚠️ MGRS library not available - creating minimal fallback');
            window.mgrs = {
                forward: () => 'MGRS not available',
                inverse: () => [0, 0],
                toPoint: () => [0, 0]
            };
        }
        
        // Verify dependencies
        this.checkDependencies();
        
        console.log('✅ SpatialAnalysisEngine initialized');
    }

    /**
     * Check if required dependencies are available
     */
    checkDependencies() {
        const dependencies = [
            { name: 'Turf.js', check: () => typeof turf !== 'undefined', required: true },
            { name: 'Proj4js', check: () => typeof proj4 !== 'undefined', required: false },
            { name: 'MGRS', check: () => typeof mgrs !== 'undefined', required: false }
        ];

        const missing = dependencies.filter(dep => dep.required && !dep.check());
        const optional = dependencies.filter(dep => !dep.required && !dep.check());
        
        if (missing.length > 0) {
            console.error('❌ Missing required spatial analysis dependencies:', missing.map(d => d.name));
            throw new Error(`Missing required dependencies: ${missing.map(d => d.name).join(', ')}`);
        }

        if (optional.length > 0) {
            console.log('⚠️ Missing optional spatial analysis dependencies:', optional.map(d => d.name));
            console.log('📍 Some advanced features may not be available');
        }

        console.log('✅ Core spatial analysis dependencies loaded');
    }

    /**
     * Calculate buffer zones around features at specified distances
     * @param {Array} features - Array of GeoJSON features or Leaflet layers
     * @param {Array} distances - Array of buffer distances in meters
     * @returns {Object} Buffer zones organized by distance
     */
    calculateBufferZones(features, distances = [1000, 5000, 10000]) {
        try {
            if (!features || features.length === 0) {
                throw new Error('No features provided for buffer analysis');
            }

            const bufferResults = {
                buffers: new Map(),
                metadata: {
                    featureCount: features.length,
                    distances: distances,
                    timestamp: new Date().toISOString()
                }
            };

            // Convert Leaflet layers to GeoJSON if needed
            const geoJsonFeatures = features.map(feature => {
                if (feature.toGeoJSON) {
                    return feature.toGeoJSON();
                }
                return feature;
            });

            // Calculate buffers for each distance
            distances.forEach(distance => {
                const buffers = [];
                
                geoJsonFeatures.forEach((feature, index) => {
                    try {
                        // Create buffer using Turf.js
                        const buffer = turf.buffer(feature, distance / 1000, { units: 'kilometers' });
                        
                        if (buffer) {
                            buffer.properties = {
                                ...buffer.properties,
                                sourceFeatureId: index,
                                bufferDistance: distance,
                                bufferUnits: 'meters',
                                area: turf.area(buffer)
                            };
                            buffers.push(buffer);
                        }
                    } catch (error) {
                        console.warn(`Failed to create buffer for feature ${index}:`, error);
                    }
                });

                bufferResults.buffers.set(distance, buffers);
            });

            console.log(`✅ Calculated ${bufferResults.buffers.size} buffer zones for ${features.length} features`);
            return bufferResults;

        } catch (error) {
            console.error('❌ Buffer calculation failed:', error);
            throw error;
        }
    }

    /**
     * Calculate combined coverage area from multiple buffer zones
     * @param {Array} buffers - Array of buffer GeoJSON features
     * @returns {Object} Combined coverage area
     */
    calculateCombinedCoverage(buffers) {
        try {
            if (!buffers || buffers.length === 0) {
                return null;
            }

            // Create a feature collection from buffers
            const featureCollection = turf.featureCollection(buffers);
            
            // Calculate union of all buffers
            let combinedArea = buffers[0];
            
            for (let i = 1; i < buffers.length; i++) {
                try {
                    combinedArea = turf.union(combinedArea, buffers[i]);
                } catch (error) {
                    console.warn(`Failed to union buffer ${i}:`, error);
                }
            }

            if (combinedArea) {
                combinedArea.properties = {
                    ...combinedArea.properties,
                    type: 'combined_coverage',
                    bufferCount: buffers.length,
                    totalArea: turf.area(combinedArea),
                    timestamp: new Date().toISOString()
                };
            }

            console.log('✅ Combined coverage area calculated');
            return combinedArea;

        } catch (error) {
            console.error('❌ Combined coverage calculation failed:', error);
            throw error;
        }
    }

    /**
     * Identify service gaps in coverage area
     * @param {Object} coverageArea - Combined coverage GeoJSON
     * @param {Object} boundary - Study area boundary GeoJSON
     * @returns {Object} Service gaps
     */
    identifyServiceGaps(coverageArea, boundary) {
        try {
            if (!coverageArea || !boundary) {
                throw new Error('Coverage area and boundary required for gap analysis');
            }

            // Calculate the difference between boundary and coverage
            const gaps = turf.difference(boundary, coverageArea);
            
            if (gaps) {
                gaps.properties = {
                    ...gaps.properties,
                    type: 'service_gaps',
                    gapArea: turf.area(gaps),
                    coverageArea: turf.area(coverageArea),
                    boundaryArea: turf.area(boundary),
                    timestamp: new Date().toISOString()
                };

                // Calculate coverage percentage
                const coveragePercentage = (turf.area(coverageArea) / turf.area(boundary)) * 100;
                gaps.properties.coveragePercentage = Math.round(coveragePercentage * 100) / 100;
            }

            console.log('✅ Service gaps identified');
            return gaps;

        } catch (error) {
            console.error('❌ Service gap analysis failed:', error);
            throw error;
        }
    }

    /**
     * Find features within a buffer zone with enhanced discovery capabilities
     * @param {Array} features - Features to search
     * @param {Object} buffer - Buffer zone GeoJSON
     * @param {Object} options - Discovery options
     * @returns {Array} Features within buffer with additional metadata
     */
    findFeaturesWithinBuffer(features, buffer, options = {}) {
        try {
            if (!features || !buffer) {
                return [];
            }

            const featuresWithin = [];
            const {
                includeDistance = true,
                includeDirection = false,
                sortByDistance = true
            } = options;

            features.forEach((feature, index) => {
                try {
                    // Convert Leaflet layer to GeoJSON if needed
                    const geoJsonFeature = feature.toGeoJSON ? feature.toGeoJSON() : feature;
                    
                    // Check if feature is within buffer
                    let isWithin = false;
                    const geomType = geoJsonFeature?.geometry?.type;
                    if (geomType === 'Point') {
                        isWithin = turf.booleanPointInPolygon(geoJsonFeature, buffer);
                    } else {
                        isWithin = turf.booleanWithin(geoJsonFeature, buffer) || 
                                   turf.booleanOverlap(geoJsonFeature, buffer);
                    }
                    
                    if (isWithin) {
                        const discoveredFeature = {
                            feature: feature,
                            geoJson: geoJsonFeature,
                            index: index
                        };

                        // Add distance information if requested
                        if (includeDistance) {
                            discoveredFeature.distance = this.calculateDistanceToBuffer(geoJsonFeature, buffer);
                            discoveredFeature.distanceToCenter = this.calculateDistanceToBufferCenter(geoJsonFeature, buffer);
                        }

                        // Add direction information if requested
                        if (includeDirection) {
                            discoveredFeature.bearing = this.calculateBearingFromBufferCenter(geoJsonFeature, buffer);
                        }

                        featuresWithin.push(discoveredFeature);
                    }
                } catch (error) {
                    console.warn(`Failed to check feature ${index} within buffer:`, error);
                }
            });

            // Sort by distance if requested
            if (sortByDistance && featuresWithin.length > 0 && featuresWithin[0].distanceToCenter !== undefined) {
                featuresWithin.sort((a, b) => a.distanceToCenter - b.distanceToCenter);
            }

            console.log(`✅ Found ${featuresWithin.length} features within buffer`);
            return featuresWithin;

        } catch (error) {
            console.error('❌ Feature search within buffer failed:', error);
            return [];
        }
    }

    /**
     * Calculate distance from feature to buffer center
     * @param {Object} feature - GeoJSON feature
     * @param {Object} buffer - Buffer GeoJSON
     * @returns {number} Distance in meters
     */
    calculateDistanceToBufferCenter(feature, buffer) {
        try {
            const featureCentroid = turf.centroid(feature);
            const bufferCentroid = turf.centroid(buffer);
            
            const distance = turf.distance(featureCentroid, bufferCentroid, { units: 'meters' });
            return Math.round(distance);
        } catch (error) {
            console.warn('Failed to calculate distance to buffer center:', error);
            return 0;
        }
    }

    /**
     * Calculate bearing from buffer center to feature
     * @param {Object} feature - GeoJSON feature
     * @param {Object} buffer - Buffer GeoJSON
     * @returns {number} Bearing in degrees
     */
    calculateBearingFromBufferCenter(feature, buffer) {
        try {
            const featureCentroid = turf.centroid(feature);
            const bufferCentroid = turf.centroid(buffer);
            
            const bearing = turf.bearing(bufferCentroid, featureCentroid);
            return Math.round(bearing);
        } catch (error) {
            console.warn('Failed to calculate bearing from buffer center:', error);
            return 0;
        }
    }

    /**
     * Automatically identify facilities within disaster areas
     * @param {Object} disasterArea - Disaster area GeoJSON
     * @param {Array} facilityLayers - Array of facility layer data
     * @param {Array} bufferDistances - Buffer distances to analyze
     * @returns {Object} Facility discovery results
     */
    identifyFacilitiesInDisasterArea(disasterArea, facilityLayers, bufferDistances = [1000, 5000, 10000]) {
        try {
            if (!disasterArea || !facilityLayers || facilityLayers.length === 0) {
                throw new Error('Disaster area and facility layers required');
            }

            const discoveryResults = {
                disasterArea: disasterArea,
                bufferAnalysis: new Map(),
                facilitySummary: new Map(),
                timestamp: new Date().toISOString()
            };

            // Create buffers around disaster area
            const bufferResults = this.calculateBufferZones([disasterArea], bufferDistances);

            // Analyze each buffer distance
            bufferResults.buffers.forEach((buffers, distance) => {
                const buffer = buffers[0]; // Single disaster area, single buffer
                const bufferAnalysis = {
                    distance: distance,
                    facilitiesFound: new Map(),
                    totalFacilities: 0
                };

                // Check each facility layer
                facilityLayers.forEach(layerData => {
                    const { layerName, features, displayName, icon } = layerData;
                    
                    const facilitiesInBuffer = this.findFeaturesWithinBuffer(features, buffer, {
                        includeDistance: true,
                        includeDirection: true,
                        sortByDistance: true
                    });

                    bufferAnalysis.facilitiesFound.set(layerName, {
                        layerName,
                        displayName,
                        icon,
                        count: facilitiesInBuffer.length,
                        facilities: facilitiesInBuffer
                    });

                    bufferAnalysis.totalFacilities += facilitiesInBuffer.length;

                    // Update facility summary
                    if (!discoveryResults.facilitySummary.has(layerName)) {
                        discoveryResults.facilitySummary.set(layerName, {
                            layerName,
                            displayName,
                            icon,
                            totalAcrossAllBuffers: 0,
                            byDistance: new Map()
                        });
                    }

                    const summary = discoveryResults.facilitySummary.get(layerName);
                    summary.totalAcrossAllBuffers += facilitiesInBuffer.length;
                    summary.byDistance.set(distance, facilitiesInBuffer.length);
                });

                discoveryResults.bufferAnalysis.set(distance, bufferAnalysis);
            });

            console.log(`✅ Facility discovery completed for disaster area`);
            return discoveryResults;

        } catch (error) {
            console.error('❌ Facility discovery failed:', error);
            throw error;
        }
    }

    /**
     * Calculate distance from feature to buffer edge
     * @param {Object} feature - GeoJSON feature
     * @param {Object} buffer - Buffer GeoJSON
     * @returns {number} Distance in meters
     */
    calculateDistanceToBuffer(feature, buffer) {
        try {
            // Get the centroid of the feature
            const centroid = turf.centroid(feature);
            
            // Calculate distance to buffer edge
            const distance = turf.distance(centroid, buffer, { units: 'meters' });
            
            return Math.round(distance);
        } catch (error) {
            console.warn('Failed to calculate distance to buffer:', error);
            return 0;
        }
    }

    /**
     * Calculate population statistics within buffer zones
     * @param {Object} buffer - Buffer zone GeoJSON
     * @param {Array} populationData - Population data points
     * @returns {Object} Population statistics
     */
    calculatePopulationWithinBuffer(buffer, populationData) {
        try {
            if (!buffer || !populationData || populationData.length === 0) {
                return {
                    totalPopulation: 0,
                    populationDensity: 0,
                    dataPoints: 0
                };
            }

            let totalPopulation = 0;
            let dataPointsWithin = 0;

            populationData.forEach(dataPoint => {
                try {
                    const point = turf.point([dataPoint.longitude, dataPoint.latitude]);
                    
                    if (turf.booleanWithin(point, buffer)) {
                        totalPopulation += dataPoint.population || 0;
                        dataPointsWithin++;
                    }
                } catch (error) {
                    console.warn('Failed to process population data point:', error);
                }
            });

            const bufferArea = turf.area(buffer); // in square meters
            const populationDensity = bufferArea > 0 ? totalPopulation / (bufferArea / 1000000) : 0; // per km²

            const stats = {
                totalPopulation: totalPopulation,
                populationDensity: Math.round(populationDensity * 100) / 100,
                dataPoints: dataPointsWithin,
                bufferArea: Math.round(bufferArea),
                timestamp: new Date().toISOString()
            };

            console.log('✅ Population statistics calculated:', stats);
            return stats;

        } catch (error) {
            console.error('❌ Population calculation failed:', error);
            return {
                totalPopulation: 0,
                populationDensity: 0,
                dataPoints: 0,
                error: error.message
            };
        }
    }

    /**
     * Perform basic geometric validation on features
     * @param {Object} feature - GeoJSON feature to validate
     * @returns {Object} Validation result
     */
    validateGeometry(feature) {
        try {
            const validation = {
                isValid: true,
                errors: [],
                warnings: []
            };

            // Check if feature exists
            if (!feature) {
                validation.isValid = false;
                validation.errors.push('Feature is null or undefined');
                return validation;
            }

            // Check geometry type
            if (!feature.geometry || !feature.geometry.type) {
                validation.isValid = false;
                validation.errors.push('Missing or invalid geometry');
                return validation;
            }

            // Use Turf.js to check for self-intersections and other issues
            try {
                // Check if geometry is valid using Turf
                const cleaned = turf.cleanCoords(feature);
                
                // Check for minimum coordinate requirements
                if (feature.geometry.coordinates && feature.geometry.coordinates.length < 2) {
                    validation.warnings.push('Geometry has very few coordinates');
                }

                // Check area for polygons
                if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                    const area = turf.area(feature);
                    if (area < 1) { // Less than 1 square meter
                        validation.warnings.push('Polygon area is very small');
                    }
                }

            } catch (error) {
                validation.isValid = false;
                validation.errors.push(`Geometry validation failed: ${error.message}`);
            }

            return validation;

        } catch (error) {
            return {
                isValid: false,
                errors: [`Validation error: ${error.message}`],
                warnings: []
            };
        }
    }

    /**
     * Identify intersections across multiple layers
     */
    analyzeMultiLayerIntersections(layers = []) {
        const results = [];
        for (let i = 0; i < layers.length; i++) {
            for (let j = i + 1; j < layers.length; j++) {
                const a = layers[i];
                const b = layers[j];
                let count = 0;
                (a.features || []).forEach((fa) => {
                    (b.features || []).forEach((fb) => {
                        try {
                            if (turf.booleanIntersects(fa, fb)) count++;
                        } catch (e) {}
                    });
                });
                results.push({ layerA: a.name, layerB: b.name, intersections: count });
            }
        }
        return results;
    }

    /**
     * Highlight hospitals at risk based on hazard zones
     */
    identifyHospitalsAtRisk(hazardZones = [], hospitals = []) {
        return hospitals.filter((hospital) => {
            return hazardZones.some((zone) => {
                try {
                    return turf.booleanIntersects(hospital, zone);
                } catch (e) {
                    return false;
                }
            });
        });
    }

    /**
     * Calculate affected population from overlap of population features and an area
     */
    calculateAffectedPopulation(area, populationFeatures = []) {
        let totalPopulation = 0;
        let children = 0;
        let elderly = 0;
        let disabled = 0;

        populationFeatures.forEach((feature) => {
            try {
                if (!turf.booleanIntersects(area, feature)) return;
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

        return {
            totalPopulation: Math.round(totalPopulation),
            demographics: {
                children: Math.round(children),
                elderly: Math.round(elderly),
                disabled: Math.round(disabled)
            }
        };
    }

    /**
     * Calculate priority zones using damage and population layers
     */
    calculatePriorityZones(damageFeatures = [], populationFeatures = []) {
        return damageFeatures.map((damage) => {
            const populationStats = this.calculateAffectedPopulation(damage, populationFeatures);
            return {
                geometry: damage.geometry,
                damage_level: damage.properties?.damage_level || 'unknown',
                estimated_population: populationStats.totalPopulation
            };
        }).sort((a, b) => b.estimated_population - a.estimated_population);
    }

    /**
     * Generate resource recommendations from analysis inputs
     */
    generateResourceRecommendations({ hospitalsAtRisk = [], affectedPopulation = {}, serviceGapsAreaKm2 = 0, priorityZones = [] } = {}) {
        const recommendations = [];
        if (hospitalsAtRisk.length > 0) {
            recommendations.push(`Deploy backup medical units for ${hospitalsAtRisk.length} at-risk hospitals.`);
        }
        if ((affectedPopulation.totalPopulation || 0) > 0) {
            recommendations.push(`Prioritize aid for ${affectedPopulation.totalPopulation} affected residents.`);
        }
        if (serviceGapsAreaKm2 > 0) {
            recommendations.push(`Establish temporary services for ${serviceGapsAreaKm2.toFixed(2)} km² coverage gaps.`);
        }
        if (priorityZones.length > 0) {
            recommendations.push(`Focus humanitarian aid on top ${Math.min(3, priorityZones.length)} priority zones.`);
        }
        if (recommendations.length === 0) {
            recommendations.push('No critical recommendations at this time.');
        }
        return recommendations;
    }

    /**
     * Get analysis statistics
     * @returns {Object} Current analysis statistics
     */
    getAnalysisStats() {
        return {
            analysisLayers: this.analysisLayers.size,
            analysisResults: this.analysisResults.size,
            lastAnalysis: this.analysisResults.size > 0 ? 
                Array.from(this.analysisResults.values()).pop().timestamp : null,
            memoryUsage: performance.memory ? 
                Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : 'N/A'
        };
    }

    /**
     * Clear analysis results and free memory
     */
    clearAnalysis() {
        this.analysisLayers.clear();
        this.analysisResults.clear();
        console.log('✅ Analysis data cleared');
    }
}
