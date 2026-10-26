/**
 * ENHANCED DATA LAYERS - Version 2.0
 * Manages earthquake, population, and elevation data layers on the map
 */

class EnhancedDataLayerManager {
    constructor(map) {
        this.map = map;
        this.earthquakeLayer = null;
        this.earthquakeMarkers = [];
        this.v2ApiUrl = 'http://localhost:5000/api/v2';  // Unified API
        this.isV2Available = false;
        
        // Check if V2.0 API is available
        this.checkV2Availability();
    }
    
    /**
     * Check if V2.0 API is available
     */
    async checkV2Availability() {
        try {
            const response = await fetch('http://localhost:5000/api/health', {
                signal: AbortSignal.timeout(2000)
            });
            const data = await response.json();
            
            if (data.v2_available && data.version === '2.0') {
                this.isV2Available = true;
                console.log('✅ V2.0 Enhanced Data API available (unified)');
                return true;
            }
        } catch (error) {
            console.warn('⚠️ V2.0 Enhanced Data API not available:', error.message);
            this.isV2Available = false;
        }
        return false;
    }
    
    /**
     * Load and display earthquake data based on current map view
     */
    async loadEarthquakeLayer(location = null, radius = null, minMagnitude = 4.0) {
        if (!this.isV2Available) {
            console.warn('V2.0 API not available, cannot load earthquake data');
            return false;
        }
        
        try {
            // Use provided location or map center
            const center = location || this.map.getCenter();
            const lat = center.lat || center[0];
            const lon = center.lng || center[1];
            
            // Calculate radius based on map zoom if not provided
            if (!radius) {
                const zoom = this.map.getZoom();
                // Adjust radius based on zoom level (more zoom = smaller radius)
                if (zoom >= 12) radius = 50;       // City level
                else if (zoom >= 10) radius = 100;  // Regional level
                else if (zoom >= 8) radius = 200;   // State level
                else radius = 500;                  // Country level
            }
            
            console.log(`🔍 Loading earthquakes near ${lat.toFixed(4)}, ${lon.toFixed(4)} (radius: ${radius}km, zoom: ${this.map.getZoom()})`);
            
            const response = await fetch(
                `${this.v2ApiUrl}/earthquakes?lat=${lat}&lon=${lon}&radius=${radius}&min_magnitude=${minMagnitude}`
            );
            const data = await response.json();
            
            if (data.success && data.earthquakes && data.earthquakes.length > 0) {
                this.displayEarthquakes(data.earthquakes);
                console.log(`✅ Loaded ${data.earthquakes.length} earthquake events for current view`);
                return data.earthquakes.length;
            } else {
                console.log('No earthquake data available for this location');
                this.clearEarthquakeLayer();
                return 0;
            }
        } catch (error) {
            console.error('Error loading earthquake data:', error);
            return false;
        }
    }
    
    /**
     * Reload earthquakes when map moves (debounced)
     */
    setupMapListeners() {
        let reloadTimeout;
        const reloadEarthquakes = () => {
            clearTimeout(reloadTimeout);
            reloadTimeout = setTimeout(() => {
                if (this.map.hasLayer(this.earthquakeLayer)) {
                    this.loadEarthquakeLayer();
                }
            }, 500); // Wait 500ms after map stops moving
        };
        
        this.map.on('moveend', reloadEarthquakes);
        this.map.on('zoomend', reloadEarthquakes);
    }
    
    /**
     * Display earthquake markers on map
     */
    displayEarthquakes(earthquakes) {
        // Clear existing markers
        this.clearEarthquakeLayer();
        
        // Create layer group if not exists
        if (!this.earthquakeLayer) {
            this.earthquakeLayer = L.layerGroup().addTo(this.map);
        }
        
        // Add markers for each earthquake
        earthquakes.forEach(eq => {
            const [lat, lon] = eq.location;
            const magnitude = eq.magnitude;
            
            // Color based on magnitude
            let color = '#22c55e'; // Green for minor
            let size = 8;
            
            if (magnitude >= 6.0) {
                color = '#ef4444'; // Red for major
                size = 16;
            } else if (magnitude >= 5.0) {
                color = '#f59e0b'; // Orange for moderate
                size = 12;
            }
            
            // Create circle marker
            const marker = L.circleMarker([lat, lon], {
                radius: size,
                fillColor: color,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.7
            });
            
            // Create popup content
            const popupContent = `
                <div style="padding: 0.75rem; min-width: 200px;">
                    <h4 style="margin: 0 0 0.5rem 0; color: ${color}; font-size: 1rem;">
                        🏗️ Magnitude ${magnitude.toFixed(1)} Earthquake
                    </h4>
                    <div style="font-size: 0.875rem; margin-bottom: 0.25rem;">
                        <strong>Location:</strong> ${eq.place}
                    </div>
                    <div style="font-size: 0.875rem; margin-bottom: 0.25rem;">
                        <strong>Date:</strong> ${new Date(eq.time).toLocaleDateString()}
                    </div>
                    <div style="font-size: 0.875rem; margin-bottom: 0.25rem;">
                        <strong>Depth:</strong> ${eq.depth_km.toFixed(1)} km
                    </div>
                    <div style="font-size: 0.875rem; margin-bottom: 0.25rem;">
                        <strong>Distance:</strong> ${eq.distance_km.toFixed(1)} km away
                    </div>
                    <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #eee;">
                        <small style="color: #999;">V2.0 Enhanced Data</small>
                    </div>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            marker.addTo(this.earthquakeLayer);
            this.earthquakeMarkers.push(marker);
        });
        
        console.log(`✅ Displayed ${earthquakes.length} earthquake markers`);
    }
    
    /**
     * Clear earthquake layer
     */
    clearEarthquakeLayer() {
        if (this.earthquakeLayer) {
            this.earthquakeLayer.clearLayers();
        }
        this.earthquakeMarkers = [];
    }
    
    /**
     * Toggle earthquake layer visibility
     */
    toggleEarthquakeLayer() {
        if (!this.earthquakeLayer) {
            return false;
        }
        
        if (this.map.hasLayer(this.earthquakeLayer)) {
            this.map.removeLayer(this.earthquakeLayer);
            return false;
        } else {
            this.map.addLayer(this.earthquakeLayer);
            return true;
        }
    }
    
    /**
     * Get V2.0 data summary for a specific location
     */
    async getLocationDataSummary(location, radius = 10) {
        if (!this.isV2Available) {
            return null;
        }
        
        try {
            const lat = location.lat || location[0];
            const lon = location.lng || location[1];
            
            // Fetch all three data types in parallel
            const [earthquakeData, populationData, seismicRisk] = await Promise.all([
                fetch(`${this.v2ApiUrl}/earthquakes?lat=${lat}&lon=${lon}&radius=${radius * 10}&min_magnitude=4.0`)
                    .then(r => r.json()).catch(() => null),
                fetch(`${this.v2ApiUrl}/population?lat=${lat}&lon=${lon}&radius=${radius}`)
                    .then(r => r.json()).catch(() => null),
                fetch(`${this.v2ApiUrl}/seismic-risk?lat=${lat}&lon=${lon}&radius=${radius * 5}`)
                    .then(r => r.json()).catch(() => null)
            ]);
            
            return {
                location: { lat, lon },
                earthquakes: earthquakeData?.success ? {
                    count: earthquakeData.count,
                    events: earthquakeData.earthquakes?.slice(0, 5) || [], // Top 5
                    nearest: earthquakeData.earthquakes?.[0] || null
                } : null,
                population: populationData?.success ? {
                    count: populationData.population,
                    accuracy: populationData.accuracy,
                    radius: radius
                } : null,
                seismicRisk: seismicRisk?.success ? seismicRisk.risk : null
            };
        } catch (error) {
            console.error('Error fetching location data:', error);
            return null;
        }
    }
    
    /**
     * Display V2.0 data popup for a location
     */
    showLocationDataPopup(location, data) {
        if (!data) return;
        
        const { lat, lon } = data.location;
        
        let popupContent = `
            <div style="padding: 1rem; min-width: 300px; max-width: 400px;">
                <h3 style="margin: 0 0 1rem 0; color: #4f7cff; font-size: 1.1rem; border-bottom: 2px solid #4f7cff; padding-bottom: 0.5rem;">
                    📍 Location Data Summary
                </h3>
                <div style="font-size: 0.875rem; color: #666; margin-bottom: 1rem;">
                    <strong>Coordinates:</strong> ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E
                </div>`;
        
        // Seismic Risk
        if (data.seismicRisk) {
            const risk = data.seismicRisk;
            const riskColor = risk.risk_level === 'HIGH' ? '#ef4444' : 
                            risk.risk_level === 'MEDIUM' ? '#f59e0b' : '#22c55e';
            
            popupContent += `
                <div style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(245, 158, 11, 0.1)); padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid ${riskColor};">
                    <div style="font-weight: 600; margin-bottom: 0.5rem; color: ${riskColor};">
                        🏗️ Seismic Risk: ${risk.risk_level}
                    </div>
                    <div style="font-size: 0.875rem; color: #666;">
                        • Total earthquakes: ${risk.total_earthquakes || 0}<br>
                        • Major events (M6.0+): ${risk.major_earthquakes || 0}<br>
                        • Largest magnitude: M${(risk.largest_magnitude || 0).toFixed(1)}
                    </div>
                </div>`;
        }
        
        // Population
        if (data.population) {
            const pop = data.population;
            popupContent += `
                <div style="background: linear-gradient(135deg, rgba(79, 124, 255, 0.1), rgba(45, 212, 191, 0.1)); padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid #4f7cff;">
                    <div style="font-weight: 600; margin-bottom: 0.5rem; color: #4f7cff;">
                        👥 Population (${pop.radius}km radius)
                    </div>
                    <div style="font-size: 0.875rem; color: #666;">
                        • Estimated: ${pop.count.toLocaleString()} people<br>
                        • Accuracy: ${pop.accuracy}<br>
                        • Resolution: 100m grid
                    </div>
                </div>`;
        }
        
        // Earthquakes
        if (data.earthquakes && data.earthquakes.count > 0) {
            const eq = data.earthquakes;
            popupContent += `
                <div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(34, 197, 94, 0.1)); padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid #f59e0b;">
                    <div style="font-weight: 600; margin-bottom: 0.5rem; color: #f59e0b;">
                        🌍 Earthquake History
                    </div>
                    <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">
                        Found ${eq.count} events in region
                    </div>`;
            
            if (eq.nearest) {
                const nearest = eq.nearest;
                popupContent += `
                    <div style="background: white; padding: 0.5rem; border-radius: 6px; margin-top: 0.5rem;">
                        <div style="font-weight: 600; color: #f59e0b;">Nearest: M${nearest.magnitude.toFixed(1)}</div>
                        <div style="font-size: 0.75rem; color: #999;">
                            ${nearest.place}<br>
                            ${new Date(nearest.time).toLocaleDateString()} • ${nearest.distance_km.toFixed(1)}km away
                        </div>
                    </div>`;
            }
            
            popupContent += `</div>`;
        }
        
        popupContent += `
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #eee; text-align: center;">
                    <small style="color: #999;">✨ V2.0 Enhanced Data</small>
                </div>
            </div>`;
        
        // Create popup at location
        L.popup()
            .setLatLng([lat, lon])
            .setContent(popupContent)
            .openOn(this.map);
    }
    
    /**
     * Enable click-to-query mode
     */
    enableLocationQuery() {
        const clickHandler = async (e) => {
            const { lat, lng } = e.latlng;
            
            // Show loading popup
            L.popup()
                .setLatLng([lat, lng])
                .setContent('<div style="padding: 1rem; text-align: center;"><i class="fas fa-spinner fa-spin"></i> Loading V2.0 data...</div>')
                .openOn(this.map);
            
            // Fetch data
            const data = await this.getLocationDataSummary({ lat, lng }, 10);
            
            if (data) {
                this.showLocationDataPopup({ lat, lng }, data);
            } else {
                L.popup()
                    .setLatLng([lat, lng])
                    .setContent('<div style="padding: 1rem;">❌ V2.0 data not available</div>')
                    .openOn(this.map);
            }
        };
        
        this.map.on('click', clickHandler);
        this.locationQueryEnabled = true;
        
        return clickHandler;
    }
    
    /**
     * Disable click-to-query mode
     */
    disableLocationQuery() {
        if (this.locationQueryHandler) {
            this.map.off('click', this.locationQueryHandler);
            this.locationQueryEnabled = false;
        }
    }
    
    /**
     * Get V2.0 analytics data
     */
    async getV2Analytics() {
        if (!this.isV2Available) {
            return null;
        }
        
        try {
            const response = await fetch(`${this.v2ApiUrl}/analytics`);
            const data = await response.json();
            
            if (data.success) {
                return data;
            }
        } catch (error) {
            console.error('Error getting V2 analytics:', error);
        }
        return null;
    }
    
    /**
     * Add earthquake legend to map
     */
    addEarthquakeLegend() {
        const legend = L.control({ position: 'bottomright' });
        
        legend.onAdd = function() {
            const div = L.DomUtil.create('div', 'info legend');
            div.style.background = 'white';
            div.style.padding = '10px';
            div.style.borderRadius = '8px';
            div.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            
            div.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 8px;">🏗️ Earthquake Magnitude</div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <div style="width: 16px; height: 16px; border-radius: 50%; background: #ef4444; border: 2px solid white;"></div>
                    <span style="font-size: 0.875rem;">M6.0+ (Major)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: #f59e0b; border: 2px solid white;"></div>
                    <span style="font-size: 0.875rem;">M5.0-5.9 (Moderate)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e; border: 2px solid white;"></div>
                    <span style="font-size: 0.875rem;">M4.0-4.9 (Minor)</span>
                </div>
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee; font-size: 0.75rem; color: #999;">
                    V2.0 Enhanced Data (2000-2026)
                </div>
            `;
            
            return div;
        };
        
        legend.addTo(this.map);
        return legend;
    }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.EnhancedDataLayerManager = EnhancedDataLayerManager;
}
