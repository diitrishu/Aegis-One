/**
 * Simple Interactive Map for AeGIS-1
 * Works with our existing backend API
 */

let map;
let facilityMarkers = {};
let disasterMarkers = [];
let drawnItems;

// Initialize the map
function initMap() {
    // Create map
    map = L.map('map').setView(AppConfig.mapCenter, AppConfig.zoomLevel);
    
    // Add base layer
    L.tileLayer(AppConfig.baseLayerUrl, {
        attribution: AppConfig.baseLayerAttribution,
        maxZoom: 19
    }).addTo(map);
    
    // Initialize feature groups
    facilityMarkers.hospitals = L.layerGroup().addTo(map);
    facilityMarkers.fire_stations = L.layerGroup().addTo(map);
    facilityMarkers.police_stations = L.layerGroup().addTo(map);
    
    // Initialize drawing layer
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    
    // Add drawing controls
    const drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems
        },
        draw: {
            polygon: true,
            circle: true,
            rectangle: true,
            marker: true,
            polyline: false,
            circlemarker: false
        }
    });
    map.addControl(drawControl);
    
    // Handle drawing events
    map.on(L.Draw.Event.CREATED, function (event) {
        const layer = event.layer;
        drawnItems.addLayer(layer);
        
        // Show disaster creation dialog
        showDisasterDialog(layer);
    });
    
    // Load initial data
    loadSystemStatus();
    
    console.log('✅ Map initialized');
}

// Load system status
async function loadSystemStatus() {
    try {
        const response = await fetch(`${AppConfig.apiUrl}/status`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        const statusText = document.getElementById('status-text');
        const statusDot = document.getElementById('status-dot');
        
        if (statusText) {
            statusText.textContent = data.system_ready ? 'Online' : 'Offline';
        }
        
        if (statusDot) {
            statusDot.className = data.system_ready ? 'status-dot online' : 'status-dot offline';
        }
        
        // Update facility counts
        const hospitalsCount = document.getElementById('hospitals-count');
        const fireCount = document.getElementById('fire-count');
        const policeCount = document.getElementById('police-count');
        
        if (hospitalsCount) hospitalsCount.textContent = data.hospitals || 0;
        if (fireCount) fireCount.textContent = data.fire_stations || 0;
        if (policeCount) policeCount.textContent = data.police_stations || 0;
        
        console.log('✅ System status loaded:', data);
    } catch (error) {
        console.error('❌ Error loading system status:', error);
        
        const statusText = document.getElementById('status-text');
        const statusDot = document.getElementById('status-dot');
        
        if (statusText) statusText.textContent = 'Error';
        if (statusDot) statusDot.className = 'status-dot offline';
    }
}

// Load facilities on map
async function loadFacilities(backendType, enabled) {
    // Map backend types to frontend marker groups
    const markerGroupMap = {
        'hospital': 'hospitals',
        'fire_station': 'fire_stations',
        'police_station': 'police_stations'
    };
    
    const markerGroup = markerGroupMap[backendType] || backendType;
    
    if (!enabled) {
        if (facilityMarkers[markerGroup]) {
            facilityMarkers[markerGroup].clearLayers();
        }
        return;
    }
    
    try {
        // Get map bounds
        const bounds = map.getBounds();
        const center = bounds.getCenter();
        
        // Calculate radius (rough estimate)
        const radius = Math.min(center.distanceTo(bounds.getNorthEast()) / 1000, 50); // km, max 50km
        
        const response = await fetch(
            `${AppConfig.apiUrl}/facilities?lat=${center.lat}&lon=${center.lng}&radius=${radius}&type=${backendType}&limit=100`
        );
        
        if (!response.ok) {
            console.warn(`No facilities found for ${backendType}: HTTP ${response.status}`);
            return;
        }
        
        const data = await response.json();
        
        // Clear existing markers
        if (facilityMarkers[markerGroup]) {
            facilityMarkers[markerGroup].clearLayers();
        }
        
        // Add markers
        if (data.facilities && data.facilities.length > 0) {
            data.facilities.forEach(facility => {
                const config = AppConfig.facilityTypes[backendType];
                if (!config) {
                    console.warn(`No config for facility type: ${backendType}`);
                    return;
                }
                
                const marker = L.marker([facility.latitude, facility.longitude], {
                    icon: L.divIcon({
                        html: `<div style="background: ${config.color}; color: white; padding: 5px; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px;">${config.icon}</div>`,
                        className: 'facility-marker',
                        iconSize: [30, 30]
                    })
                });
                
                marker.bindPopup(`
                    <strong>${config.name}</strong><br>
                    ${facility.name || 'Unnamed'}<br>
                    <small>Distance: ${facility.distance_km ? facility.distance_km.toFixed(2) + ' km' : 'N/A'}</small>
                `);
                
                if (facilityMarkers[markerGroup]) {
                    marker.addTo(facilityMarkers[markerGroup]);
                }
            });
            
            console.log(`✅ Loaded ${data.facilities.length} ${backendType}`);
        } else {
            console.log(`No ${backendType} found in this area`);
        }
    } catch (error) {
        console.error(`❌ Error loading ${backendType}:`, error);
        alert(`Error loading ${backendType}: ${error.message}\n\nPlease ensure the backend server is running.`);
    }
}

// Show disaster creation dialog
function showDisasterDialog(layer) {
    const center = layer.getLatLng ? layer.getLatLng() : layer.getBounds().getCenter();
    
    const html = `
        <div class="disaster-dialog">
            <h4>Create Disaster Event</h4>
            <form id="disaster-form-map">
                <div class="form-group">
                    <label>Disaster Type:</label>
                    <select id="disaster-type-map" class="form-control">
                        <option value="flood">🌊 Flood</option>
                        <option value="fire">🔥 Fire</option>
                        <option value="earthquake">🏚️ Earthquake</option>
                        <option value="landslide">⛰️ Landslide</option>
                        <option value="cyclone">🌀 Cyclone</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Severity:</label>
                    <select id="severity-map" class="form-control">
                        <option value="low">Low</option>
                        <option value="medium" selected>Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Description:</label>
                    <textarea id="description-map" class="form-control" rows="2">Emergency situation requiring immediate response</textarea>
                </div>
                <button type="submit" class="btn btn-danger btn-block">Create Disaster Event</button>
            </form>
        </div>
    `;
    
    const popup = L.popup()
        .setLatLng(center)
        .setContent(html)
        .openOn(map);
    
    // Handle form submission
    setTimeout(() => {
        document.getElementById('disaster-form-map').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const disasterData = {
                disaster_type: document.getElementById('disaster-type-map').value,
                latitude: center.lat,
                longitude: center.lng,
                severity: document.getElementById('severity-map').value,
                radius_km: layer.getRadius ? layer.getRadius() / 1000 : 5,
                description: document.getElementById('description-map').value
            };
            
            await createDisaster(disasterData);
            map.closePopup();
        });
    }, 100);
}

// Create disaster event
async function createDisaster(data) {
    try {
        const response = await fetch(`${AppConfig.apiUrl}/create_disaster`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            alert(`✅ Disaster Event Created!\n\nID: ${result.disaster_id}\nType: ${result.details.type}\nLocation: ${result.details.location}\n\nFacilities: ${result.response?.facilities?.hospitals || 0} hospitals, ${result.response?.facilities?.fire_stations || 0} fire stations, ${result.response?.facilities?.police_stations || 0} police stations\nAffected Population: ${(result.response?.affected_population || 0).toLocaleString()}`);
            
            // Add marker for disaster
            const config = AppConfig.disasterTypes[data.disaster_type];
            const marker = L.marker([data.latitude, data.longitude], {
                icon: L.divIcon({
                    html: `<div style="background: ${config.color}; color: white; padding: 10px; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);">${config.icon}</div>`,
                    className: 'disaster-marker',
                    iconSize: [40, 40]
                })
            });
            
            marker.bindPopup(`
                <strong>${config.name} Disaster</strong><br>
                ID: ${result.disaster_id}<br>
                Severity: ${data.severity.toUpperCase()}<br>
                ${data.description}<br>
                <hr>
                <small>
                Facilities: ${result.response?.facilities?.hospitals || 0} hospitals<br>
                Population: ${(result.response?.affected_population || 0).toLocaleString()} affected
                </small>
            `);
            
            marker.addTo(map);
            disasterMarkers.push(marker);
            
            // Refresh system status
            loadSystemStatus();
        } else {
            alert(`❌ Error: ${result.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('❌ Error creating disaster:', error);
        alert(`❌ Error creating disaster: ${error.message}\n\nPlease ensure the backend server is running on port 3000.`);
    }
}

// Toggle facility layer
function toggleFacilityLayer(type, enabled) {
    // Map frontend types to backend types
    const typeMap = {
        'hospitals': 'hospital',
        'fire_stations': 'fire_station',
        'police_stations': 'police_station'
    };
    
    const backendType = typeMap[type] || type;
    loadFacilities(backendType, enabled);
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    
    // Setup layer toggles
    document.getElementById('hospitals-toggle').addEventListener('change', (e) => {
        toggleFacilityLayer('hospitals', e.target.checked);
    });
    
    document.getElementById('fire-toggle').addEventListener('change', (e) => {
        toggleFacilityLayer('fire_stations', e.target.checked);
    });
    
    document.getElementById('police-toggle').addEventListener('change', (e) => {
        toggleFacilityLayer('police_stations', e.target.checked);
    });
});
