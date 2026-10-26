/**
 * Modern Map JavaScript
 */

let map;
let baseLayers = {};
let drawnItems;
let currentBaseLayer = 'street';
let riskLayerManager; // Risk zone layer manager
let facilitiesLayer;
let routeLinesLayer;
let nearbyFacilities = [];
let activeDisaster = null;

// Initialize map
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    setupEventListeners();
    
    // Check if there's a disaster to display
    const viewDisaster = localStorage.getItem('viewDisaster');
    if (viewDisaster) {
        const disaster = JSON.parse(viewDisaster);
        displayDisasterOnMap(disaster);
        localStorage.removeItem('viewDisaster');
    }
});

// Initialize Leaflet map
function initMap() {
    // Create map
    map = L.map('map').setView(AppConfig.mapCenter, AppConfig.zoomLevel);
    
    // Define base layers
    baseLayers = {
        street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }),
        satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri',
            maxZoom: 19
        }),
        terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenTopoMap contributors',
            maxZoom: 17
        })
    };
    
    // Add default layer
    baseLayers.street.addTo(map);
    
    // Initialize drawn items layer
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Dedicated layers so facilities/routes can be cleared independently
    facilitiesLayer = new L.FeatureGroup();
    map.addLayer(facilitiesLayer);
    routeLinesLayer = new L.FeatureGroup();
    map.addLayer(routeLinesLayer);
    
    // Initialize risk layer manager (check if class is available)
    if (typeof RiskLayerManager !== 'undefined') {
        riskLayerManager = new RiskLayerManager(map);
        console.log('✅ Risk layer manager initialized');
    } else {
        console.warn('⚠️ RiskLayerManager class not available');
    }
    
    // Add drawing controls
    const drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems,
            remove: true
        },
        draw: {
            polygon: {
                shapeOptions: {
                    color: '#f5576c',
                    fillOpacity: 0.3,
                    weight: 3
                }
            },
            circle: {
                shapeOptions: {
                    color: '#f5576c',
                    fillOpacity: 0.3,
                    weight: 3
                }
            },
            rectangle: {
                shapeOptions: {
                    color: '#f5576c',
                    fillOpacity: 0.3,
                    weight: 3
                }
            },
            marker: {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            },
            polyline: false,
            circlemarker: false
        }
    });
    map.addControl(drawControl);
    
    // Handle drawing events
    map.on(L.Draw.Event.CREATED, function(event) {
        const layer = event.layer;
        drawnItems.addLayer(layer);
        
        // Add popup with info
        let popupContent = '<div style="padding: 0.5rem;">';
        popupContent += '<strong>Disaster Zone</strong><br>';
        
        if (event.layerType === 'circle') {
            const radius = layer.getRadius();
            popupContent += `Radius: ${(radius / 1000).toFixed(2)} km`;
        } else if (event.layerType === 'marker') {
            const latlng = layer.getLatLng();
            popupContent += `Location: ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
        }
        
        popupContent += '<br><button class="btn-primary" style="margin-top: 0.5rem; padding: 0.375rem 0.75rem; font-size: 0.875rem;" onclick="reportFromMap()">Report Disaster</button>';
        popupContent += '</div>';
        
        layer.bindPopup(popupContent);
        
        showToast('Disaster zone marked on map', 'success');
    });
    
    map.on(L.Draw.Event.DELETED, function() {
        showToast('Drawings cleared', 'info');
    });
    
    // Add some sample markers for demonstration
    addSampleMarkers();
}

// Setup event listeners
function setupEventListeners() {
    // Base layer selector
    document.getElementById('base-layer-select').addEventListener('change', function(e) {
        changeBaseLayer(e.target.value);
    });
}

// Change base layer
function changeBaseLayer(layerName) {
    if (baseLayers[currentBaseLayer]) {
        map.removeLayer(baseLayers[currentBaseLayer]);
    }
    
    if (baseLayers[layerName]) {
        baseLayers[layerName].addTo(map);
        currentBaseLayer = layerName;
        showToast(`Switched to ${layerName} view`, 'info');
    }
}

// Clear all drawings
function clearDrawings() {
    drawnItems.clearLayers();
    facilitiesLayer.clearLayers();
    routeLinesLayer.clearLayers();
    nearbyFacilities = [];
    activeDisaster = null;
    showToast('All drawings cleared', 'info');
}

// Add sample markers for demonstration
function addSampleMarkers() {
    // Sample hospitals
    const hospitals = [
        { name: 'King George Medical University', lat: 26.8467, lng: 80.9462 },
        { name: 'AIIMS Delhi', lat: 28.5672, lng: 77.2100 }
    ];
    
    hospitals.forEach(hospital => {
        const marker = L.marker([hospital.lat, hospital.lng], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        });
        
        marker.bindPopup(`
            <div style="padding: 0.5rem;">
                <strong>🏥 ${hospital.name}</strong><br>
                <small>Hospital</small><br>
                <small>${hospital.lat.toFixed(4)}, ${hospital.lng.toFixed(4)}</small>
            </div>
        `);
        
        marker.addTo(map);
    });
    
    // Sample fire stations
    const fireStations = [
        { name: 'Hazratganj Fire Station', lat: 26.8500, lng: 80.9400 }
    ];
    
    fireStations.forEach(station => {
        const marker = L.marker([station.lat, station.lng], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        });
        
        marker.bindPopup(`
            <div style="padding: 0.5rem;">
                <strong>🚒 ${station.name}</strong><br>
                <small>Fire Station</small><br>
                <small>${station.lat.toFixed(4)}, ${station.lng.toFixed(4)}</small>
            </div>
        `);
        
        marker.addTo(map);
    });
}

// Report disaster from map
function reportFromMap() {
    window.location.href = 'disasters.html';
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Toggle theme
function toggleTheme() {
    showToast('Dark mode coming soon!', 'info');
}

// Display disaster on map
function displayDisasterOnMap(disaster) {
    activeDisaster = disaster;
    const disasterTypeKey = String(disaster.type || 'other').toLowerCase();
    const disasterColorMap = {
        flood: '#1e3a8a',
        fire: '#dc2626',
        earthquake: '#8b5a2b',
        landslide: '#b45309',
        cyclone: '#0ea5e9',
        other: '#f5576c'
    };
    const disasterColor = disasterColorMap[disasterTypeKey] || disasterColorMap.other;

    // Center map on disaster location
    map.setView([disaster.lat, disaster.lon], 13);

    // Add disaster point with type-specific color
    const disasterMarker = L.circleMarker([disaster.lat, disaster.lon], {
        radius: 9,
        color: disasterColor,
        fillColor: disasterColor,
        fillOpacity: 0.9,
        weight: 3
    }).addTo(drawnItems);

    // Add disaster radius circle
    const radiusCircle = L.circle([disaster.lat, disaster.lon], {
        radius: disaster.radius * 1000, // Convert km to meters
        color: disasterColor,
        fillColor: disasterColor,
        fillOpacity: 0.12,
        weight: 2
    }).addTo(drawnItems);

    // Create popup content
    const disasterTypeEmoji = {
        flood: 'FLOOD',
        earthquake: 'EARTHQUAKE',
        fire: 'FIRE',
        landslide: 'LANDSLIDE',
        cyclone: 'CYCLONE',
        other: 'ALERT'
    };

    const severityColor = {
        low: 'LOW',
        medium: 'MEDIUM',
        high: 'HIGH'
    };

    const popupContent = `
        <div style="padding: 0.75rem; min-width: 200px;">
            <h3 style="margin: 0 0 0.5rem 0; color: ${disasterColor}; font-size: 1.1rem;">
                ${disasterTypeEmoji[disasterTypeKey] || 'ALERT'} ${disasterTypeKey.toUpperCase()} Disaster
            </h3>
            <div style="margin-bottom: 0.5rem;">
                <strong>Severity:</strong> ${severityColor[disaster.severity] || String(disaster.severity || '').toUpperCase()}
            </div>
            <div style="margin-bottom: 0.5rem;">
                <strong>Location:</strong> ${disaster.lat.toFixed(4)}, ${disaster.lon.toFixed(4)}
            </div>
            <div style="margin-bottom: 0.5rem;">
                <strong>Affected Radius:</strong> ${disaster.radius} km
            </div>
            <div style="margin-bottom: 0.5rem;">
                <strong>Description:</strong><br>
                <span style="color: #666;">${disaster.description}</span>
            </div>
            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #eee;">
                <small style="color: #999;">Disaster ID: ${disaster.id}</small>
            </div>
        </div>
    `;

    disasterMarker.bindPopup(popupContent).openPopup();

    // Update sidebar with disaster info
    updateDisasterSidebar(disaster, {
        flood: 'FLOOD',
        earthquake: 'EARTHQUAKE',
        fire: 'FIRE',
        landslide: 'LANDSLIDE',
        cyclone: 'CYCLONE',
        other: 'ALERT'
    }, {
        low: 'LOW',
        medium: 'MEDIUM',
        high: 'HIGH'
    });

    // Load nearby facilities
    loadFacilitiesForMap(disaster.lat, disaster.lon);

    // Show notification
    showToast(`Displaying ${disasterTypeKey} disaster on map`, 'success');
}
// Load facilities for map display
async function loadFacilitiesForMap(lat, lon) {
    try {
        const response = await fetch(
            `${AppConfig.apiUrl}/facilities?lat=${lat}&lon=${lon}&radius=15&limit=20`
        );
        const result = await response.json();
        
        if (result.success && result.facilities && result.facilities.length > 0) {
            nearbyFacilities = result.facilities;
            displayFacilitiesOnMap(result.facilities);
            showToast(`Loaded ${result.facilities.length} nearby facilities`, 'success');
        }
    } catch (error) {
        console.error('Error loading facilities for map:', error);
    }
}

// Display facilities on map
function displayFacilitiesOnMap(facilities) {
    facilitiesLayer.clearLayers();

    facilities.forEach((facility, index) => {
        let iconColor = 'blue';
        let iconName = 'fa-building';
        
        if (facility.type.toLowerCase().includes('hospital')) {
            iconColor = 'red';
            iconName = 'fa-hospital';
        } else if (facility.type.toLowerCase().includes('fire')) {
            iconColor = 'orange';
            iconName = 'fa-fire-extinguisher';
        } else if (facility.type.toLowerCase().includes('police')) {
            iconColor = 'green';
            iconName = 'fa-shield-alt';
        }
        
        const marker = L.marker([facility.latitude || 0, facility.longitude || 0], {
            icon: L.icon({
                iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${iconColor}.png`,
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [20, 33],
                iconAnchor: [10, 33],
                popupAnchor: [1, -28],
                shadowSize: [33, 33]
            })
        }).addTo(facilitiesLayer);
        
        marker.bindPopup(`
            <div style="padding: 0.5rem;">
                <strong><i class="fas ${iconName}"></i> ${facility.name || 'Unnamed Facility'}</strong><br>
                <small>${facility.type}</small><br>
                ${facility.distance_km ? `<small>Distance: ${facility.distance_km.toFixed(2)} km</small><br>` : ''}
                ${facility.capacity ? `<small>Capacity: ${facility.capacity}</small><br>` : ''}
                <button
                    onclick="showRouteToFacility(${index})"
                    style="margin-top: 0.5rem; padding: 0.35rem 0.65rem; border: 1px solid #4f7cff; background: #4f7cff; color: #fff; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">
                    <i class="fas fa-route"></i> Show Route
                </button>
            </div>
        `);
    });
}

async function showRouteToFacility(facilityIndex) {
    if (!activeDisaster) {
        showToast('Select or open a disaster first to route from incident point', 'warning');
        return;
    }

    const facility = nearbyFacilities[facilityIndex];
    if (!facility || !Number.isFinite(facility.latitude) || !Number.isFinite(facility.longitude)) {
        showToast('Facility coordinates unavailable for routing', 'warning');
        return;
    }

    routeLinesLayer.clearLayers();
    showToast(`Calculating route to ${facility.name || 'facility'}...`, 'info');

    try {
        const route = await calculateRouteFromDisasterToFacility(activeDisaster, facility);
        const distanceKm = route.distance / 1000;
        const durationMin = route.duration / 60;

        L.geoJSON(route.geometry, {
            style: {
                color: '#4f7cff',
                weight: 5,
                opacity: 0.85
            }
        }).bindPopup(`
            <strong>Route: ${facility.name || 'Facility'}</strong><br>
            Distance: ${distanceKm.toFixed(2)} km<br>
            ETA: ${Math.round(durationMin)} min
        `).addTo(routeLinesLayer);

        map.fitBounds(routeLinesLayer.getBounds(), { padding: [40, 40] });
        showToast(`Route ready: ${distanceKm.toFixed(2)} km`, 'success');
    } catch (error) {
        // Fallback direct line if routing service is unavailable.
        L.polyline(
            [
                [activeDisaster.lat, activeDisaster.lon],
                [facility.latitude, facility.longitude]
            ],
            {
                color: '#94a3b8',
                weight: 3,
                dashArray: '6, 8',
                opacity: 0.9
            }
        ).bindPopup(`
            <strong>${facility.name || 'Facility'}</strong><br>
            Approx route unavailable, showing direct line
        `).addTo(routeLinesLayer);

        map.fitBounds(routeLinesLayer.getBounds(), { padding: [40, 40] });
        showToast('Routing service unavailable, showing direct line', 'warning');
    }
}

async function calculateRouteFromDisasterToFacility(disaster, facility) {
    const fromLat = disaster.lat;
    const fromLon = disaster.lon;
    const toLat = facility.latitude;
    const toLon = facility.longitude;

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;
    const response = await fetch(osrmUrl);
    if (!response.ok) {
        throw new Error(`Routing failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No route found');
    }

    return data.routes[0];
}

async function showRoutesToFacilities() {
    if (!activeDisaster || nearbyFacilities.length === 0) {
        showToast('No active disaster/facility context found', 'warning');
        return;
    }

    routeLinesLayer.clearLayers();

    // Limit routes for performance/readability
    const targets = [...nearbyFacilities]
        .filter(f => Number.isFinite(f.latitude) && Number.isFinite(f.longitude))
        .slice(0, 10);

    if (targets.length === 0) {
        showToast('No valid facilities available for routing', 'warning');
        return;
    }

    showToast('Calculating facility-to-disaster routes...', 'info');

    let routedCount = 0;
    for (const facility of targets) {
        try {
            const route = await calculateRouteFromDisasterToFacility(activeDisaster, facility);
            const distanceKm = route.distance / 1000;
            const durationMin = route.duration / 60;

            L.geoJSON(route.geometry, {
                style: {
                    color: '#4f7cff',
                    weight: 4,
                    opacity: 0.75
                }
            }).bindPopup(`
                <strong>Route: ${facility.name || 'Facility'}</strong><br>
                Distance: ${distanceKm.toFixed(2)} km<br>
                ETA: ${Math.round(durationMin)} min
            `).addTo(routeLinesLayer);

            routedCount += 1;
        } catch (error) {
            // Fallback line if OSRM route is unavailable
            L.polyline(
                [
                    [activeDisaster.lat, activeDisaster.lon],
                    [facility.latitude, facility.longitude]
                ],
                {
                    color: '#94a3b8',
                    weight: 2,
                    dashArray: '6, 8',
                    opacity: 0.7
                }
            ).bindPopup(`
                <strong>${facility.name || 'Facility'}</strong><br>
                Approx route unavailable, showing direct line
            `).addTo(routeLinesLayer);
        }
    }

    if (routedCount > 0) {
        showToast(`Displayed ${routedCount} routed paths`, 'success');
    } else {
        showToast('Routing service unavailable; showed direct lines', 'warning');
    }
}

function clearRoutes() {
    routeLinesLayer.clearLayers();
    showToast('Routes cleared', 'info');
}

// Update disaster sidebar
function updateDisasterSidebar(disaster, typeEmoji, severityColor) {
    const section = document.getElementById('disaster-info-section');
    const content = document.getElementById('disaster-info-content');
    
    const html = `
        <div style="background: linear-gradient(135deg, rgba(245, 87, 108, 0.1), rgba(240, 147, 251, 0.1)); padding: 1rem; border-radius: 8px; border: 2px solid #f5576c;">
            <div style="font-size: 2rem; text-align: center; margin-bottom: 0.5rem;">
                ${typeEmoji[disaster.type] || '⚠️'}
            </div>
            <h4 style="text-align: center; margin-bottom: 1rem; color: #f5576c;">
                ${disaster.type.toUpperCase()}
            </h4>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <div style="background: white; padding: 0.75rem; border-radius: 6px;">
                    <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.25rem;">Severity</div>
                    <div style="font-weight: 600;">${severityColor[disaster.severity]} ${disaster.severity.toUpperCase()}</div>
                </div>
                <div style="background: white; padding: 0.75rem; border-radius: 6px;">
                    <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.25rem;">Affected Radius</div>
                    <div style="font-weight: 600;">${disaster.radius} km</div>
                </div>
                <div style="background: white; padding: 0.75rem; border-radius: 6px;">
                    <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.25rem;">Location</div>
                    <div style="font-weight: 600; font-family: monospace; font-size: 0.875rem;">
                        ${disaster.lat.toFixed(4)}, ${disaster.lon.toFixed(4)}
                    </div>
                </div>
                <div style="background: white; padding: 0.75rem; border-radius: 6px;">
                    <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.25rem;">Description</div>
                    <div style="font-size: 0.875rem;">${disaster.description}</div>
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                <button onclick="showRoutesToFacilities()" style="flex: 1; padding: 0.625rem; background: #4f7cff; border: 1px solid #4f7cff; color: white; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    <i class="fas fa-route"></i> Show Routes
                </button>
                <button onclick="clearRoutes()" style="padding: 0.625rem; background: white; border: 1px solid #4f7cff; color: #4f7cff; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    <i class="fas fa-eraser"></i>
                </button>
            </div>
            <button onclick="clearDisasterView()" style="width: 100%; margin-top: 1rem; padding: 0.625rem; background: white; border: 1px solid #f5576c; color: #f5576c; border-radius: 6px; cursor: pointer; font-weight: 600;">
                <i class="fas fa-times"></i> Clear Disaster
            </button>
        </div>
    `;
    
    content.innerHTML = html;
    section.style.display = 'block';
}

// Clear disaster view
function clearDisasterView() {
    const section = document.getElementById('disaster-info-section');
    section.style.display = 'none';
    clearDrawings();
    showToast('Disaster cleared from map', 'info');
}


/**
 * Toggle risk zone layer
 */
async function toggleRiskZone(type) {
    if (!riskLayerManager) {
        console.error('Risk layer manager not initialized');
        return;
    }
    
    try {
        const checkbox = document.getElementById(`toggle-${type}`);
        const isVisible = await riskLayerManager.toggleLayer(type);
        
        // Update checkbox state
        if (checkbox) {
            checkbox.checked = isVisible;
        }
        
        // Show toast notification
        const config = riskLayerManager.getConfig(type);
        if (config) {
            showToast(
                isVisible ? `${config.icon} ${config.name} zones displayed` : `${config.name} zones hidden`,
                isVisible ? 'success' : 'info'
            );
        }
    } catch (error) {
        console.error(`Error toggling ${type} risk zone:`, error);
        showToast(`Error loading ${type} risk zones`, 'error');
    }
}
