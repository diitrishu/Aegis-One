/**
 * Disaster Response Map V2 - Professional Version
 * Enhanced workflow: Draw disaster → Fill form → View facilities
 */

let map;
let baseLayers = {};
let drawnItems;
let disasterLayer;
let facilitiesLayer;
let distanceLinesLayer;
let routesLayer;
let highwaysLayer;
let currentDisasterLocation = null;
let currentDisasterZone = null;
let currentDisasterRadius = 5;
let allFacilities = [];
let allRoutes = [];

// Initialize the map
function initMap() {
    // Create map
    map = L.map('map').setView(AppConfig.mapCenter, AppConfig.zoomLevel);
    
    // Define base layers
    baseLayers = {
        'Street Map': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }),
        'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri',
            maxZoom: 19
        }),
        'Terrain': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenTopoMap contributors',
            maxZoom: 17
        })
    };
    
    // Add default layer
    baseLayers['Street Map'].addTo(map);
    
    // Add layer control
    L.control.layers(baseLayers).addTo(map);
    
    // Initialize feature groups
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    
    disasterLayer = new L.FeatureGroup();
    map.addLayer(disasterLayer);
    
    facilitiesLayer = new L.FeatureGroup();
    map.addLayer(facilitiesLayer);
    
    distanceLinesLayer = new L.FeatureGroup();
    map.addLayer(distanceLinesLayer);
    
    routesLayer = new L.FeatureGroup();
    map.addLayer(routesLayer);
    
    highwaysLayer = new L.FeatureGroup();
    map.addLayer(highwaysLayer);
    
    // Add drawing controls
    const drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems
        },
        draw: {
            polygon: {
                shapeOptions: {
                    color: '#dc3545',
                    fillOpacity: 0.3
                }
            },
            circle: {
                shapeOptions: {
                    color: '#dc3545',
                    fillOpacity: 0.3
                }
            },
            rectangle: {
                shapeOptions: {
                    color: '#dc3545',
                    fillOpacity: 0.3
                }
            },
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
        
        // Get center of drawn shape
        const center = layer.getLatLng ? layer.getLatLng() : layer.getBounds().getCenter();
        currentDisasterLocation = center;
        currentDisasterZone = layer;
        
        // Calculate radius from drawn shape
        if (layer.getRadius) {
            currentDisasterRadius = layer.getRadius() / 1000; // Convert to km
        } else if (layer.getBounds) {
            const bounds = layer.getBounds();
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            currentDisasterRadius = center.distanceTo(ne) / 1000; // Approximate radius in km
        }
        
        // Update radius in form
        document.getElementById('radius').value = Math.round(currentDisasterRadius * 10) / 10;
        
        // Update workflow
        document.getElementById('step1').classList.add('completed');
        document.getElementById('step1').classList.remove('active');
        document.getElementById('step2').classList.add('active');
        
        // Show disaster form
        document.getElementById('disaster-form-container').style.display = 'block';
        
        // Update coordinates display
        updateCoordinatesDisplay(center.lat, center.lng);
        
        // Scroll to form
        document.getElementById('disaster-form-container').scrollIntoView({ behavior: 'smooth' });
    });
    
    // Click on map to set location
    map.on('click', function(e) {
        if (document.getElementById('disaster-form-container').style.display === 'block' && !currentDisasterLocation) {
            currentDisasterLocation = e.latlng;
            updateCoordinatesDisplay(e.latlng.lat, e.latlng.lng);
            
            // Add temporary marker
            L.marker(e.latlng, {
                icon: L.divIcon({
                    html: '<div style="background: #dc3545; color: white; padding: 10px; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px;">📍</div>',
                    className: 'temp-marker',
                    iconSize: [40, 40]
                })
            }).addTo(drawnItems);
        }
    });
    
    // Load initial data
    loadSystemStatus();
    
    console.log('✅ Map V2 initialized with multiple base layers');
}

// Update coordinates display
function updateCoordinatesDisplay(lat, lng) {
    document.getElementById('coordinates-display').innerHTML = `
        <small>Latitude: ${lat.toFixed(6)}</small><br>
        <small>Longitude: ${lng.toFixed(6)}</small>
    `;
}

// Load system status
async function loadSystemStatus() {
    try {
        const response = await fetch(`${AppConfig.apiUrl}/status`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        const statusBadge = document.getElementById('system-status');
        if (statusBadge) {
            statusBadge.textContent = data.system_ready ? 'Online' : 'Offline';
            statusBadge.className = data.system_ready ? 'status-badge online' : 'status-badge offline';
        }
        
        const totalFacilities = document.getElementById('total-facilities');
        if (totalFacilities) {
            totalFacilities.textContent = data.total_facilities || 0;
        }
        
        console.log('✅ System status loaded');
    } catch (error) {
        console.error('❌ Error loading system status:', error);
        const statusBadge = document.getElementById('system-status');
        if (statusBadge) {
            statusBadge.textContent = 'Error';
            statusBadge.className = 'status-badge offline';
        }
    }
}

// Handle disaster form submission
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    
    document.getElementById('disaster-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!currentDisasterLocation) {
            alert('⚠️ Please draw a disaster zone or click on the map to set location');
            return;
        }
        
        const submitBtn = document.getElementById('submit-disaster');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        
        const disasterData = {
            disaster_type: document.getElementById('disaster-type').value,
            latitude: currentDisasterLocation.lat,
            longitude: currentDisasterLocation.lng,
            severity: document.getElementById('severity').value,
            radius_km: parseFloat(document.getElementById('radius').value),
            description: document.getElementById('description').value
        };
        
        try {
            const response = await fetch(`${AppConfig.apiUrl}/create_disaster`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(disasterData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                // Update workflow
                document.getElementById('step2').classList.add('completed');
                document.getElementById('step2').classList.remove('active');
                document.getElementById('step3').classList.add('active');
                
                // Add disaster marker
                addDisasterMarker(disasterData, result);
                
                // Load nearby facilities
                await loadNearbyFacilities(disasterData);
                
                // Load highways for evacuation routes
                await loadHighways(disasterData);
                
                // Show facilities container
                document.getElementById('facilities-container').style.display = 'block';
                document.getElementById('facilities-container').scrollIntoView({ behavior: 'smooth' });
                
                alert(`✅ Disaster Event Created!\n\nID: ${result.disaster_id}\nType: ${result.details.type}\n\nNearby facilities loaded automatically.`);
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            console.error('❌ Error creating disaster:', error);
            alert(`❌ Error: ${error.message}\n\nPlease ensure the backend server is running.`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> CREATE DISASTER EVENT';
        }
    });
    
    // Facility toggle handlers
    document.getElementById('show-hospitals').addEventListener('change', updateFacilityDisplay);
    document.getElementById('show-fire').addEventListener('change', updateFacilityDisplay);
    document.getElementById('show-police').addEventListener('change', updateFacilityDisplay);
    document.getElementById('show-distances').addEventListener('change', updateDistanceLines);
    
    // Highway toggle handler
    document.getElementById('show-highways').addEventListener('change', function(e) {
        if (e.target.checked) {
            map.addLayer(highwaysLayer);
        } else {
            map.removeLayer(highwaysLayer);
        }
    });
    
    // Routes toggle handler
    document.getElementById('show-routes').addEventListener('change', function(e) {
        if (e.target.checked) {
            map.addLayer(routesLayer);
        } else {
            map.removeLayer(routesLayer);
        }
    });
    
    // Calculate routes button
    document.getElementById('calculate-routes-btn').addEventListener('click', async function() {
        const btn = this;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculating Routes...';
        
        await loadRoutesToFacilities();
        
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-route"></i> Calculate Real Routes';
        
        // Enable routes toggle
        document.getElementById('show-routes').checked = true;
        document.getElementById('show-routes').dispatchEvent(new Event('change'));
        
        alert(`✅ Calculated real routes to top 15 facilities!\n\nRoutes show actual road distances and estimated travel times.`);
    });
});

// Add disaster marker
function addDisasterMarker(data, result) {
    const config = AppConfig.disasterTypes[data.disaster_type];
    
    const marker = L.marker([data.latitude, data.longitude], {
        icon: L.divIcon({
            html: `<div class="disaster-marker" style="background: ${config.color}; color: white; padding: 12px; border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; font-size: 24px; border: 4px solid white; box-shadow: 0 0 20px rgba(220,53,69,0.8);">${config.icon}</div>`,
            className: 'disaster-marker-icon',
            iconSize: [50, 50]
        })
    });
    
    marker.bindPopup(`
        <div style="min-width: 200px;">
            <h5 style="margin: 0 0 0.5rem 0; color: #dc3545;">${config.name} Disaster</h5>
            <strong>ID:</strong> ${result.disaster_id}<br>
            <strong>Severity:</strong> ${data.severity.toUpperCase()}<br>
            <strong>Radius:</strong> ${data.radius_km} km<br>
            <hr style="margin: 0.5rem 0;">
            <small>${data.description}</small>
        </div>
    `);
    
    marker.addTo(disasterLayer);
    
    // Add radius circle
    L.circle([data.latitude, data.longitude], {
        radius: data.radius_km * 1000,
        color: config.color,
        fillColor: config.color,
        fillOpacity: 0.2,
        weight: 2,
        dashArray: '10, 10'
    }).addTo(disasterLayer);
}

// Load nearby facilities
async function loadNearbyFacilities(disasterData) {
    const types = ['hospital', 'fire_station', 'police_station'];
    allFacilities = [];
    
    for (const type of types) {
        try {
            const response = await fetch(
                `${AppConfig.apiUrl}/facilities?lat=${disasterData.latitude}&lon=${disasterData.longitude}&radius=${disasterData.radius_km * 2}&type=${type}&limit=50`
            );
            
            if (response.ok) {
                const data = await response.json();
                if (data.facilities && data.facilities.length > 0) {
                    allFacilities.push(...data.facilities.map(f => ({ ...f, type })));
                }
            }
        } catch (error) {
            console.error(`Error loading ${type}:`, error);
        }
    }
    
    // Update counts
    const hospitals = allFacilities.filter(f => f.type === 'hospital').length;
    const fireStations = allFacilities.filter(f => f.type === 'fire_station').length;
    const policeStations = allFacilities.filter(f => f.type === 'police_station').length;
    
    document.getElementById('hospitals-count').textContent = hospitals;
    document.getElementById('fire-count').textContent = fireStations;
    document.getElementById('police-count').textContent = policeStations;
    
    // Display facilities
    updateFacilityDisplay();
    
    console.log(`✅ Loaded ${allFacilities.length} nearby facilities`);
}

// Update facility display
function updateFacilityDisplay() {
    facilitiesLayer.clearLayers();
    distanceLinesLayer.clearLayers();
    
    const showHospitals = document.getElementById('show-hospitals').checked;
    const showFire = document.getElementById('show-fire').checked;
    const showPolice = document.getElementById('show-police').checked;
    const showDistances = document.getElementById('show-distances').checked;
    
    const facilityListHtml = [];
    
    allFacilities.forEach(facility => {
        let shouldShow = false;
        let config = null;
        
        if (facility.type === 'hospital' && showHospitals) {
            shouldShow = true;
            config = AppConfig.facilityTypes.hospital;
        } else if (facility.type === 'fire_station' && showFire) {
            shouldShow = true;
            config = AppConfig.facilityTypes.fire_station;
        } else if (facility.type === 'police_station' && showPolice) {
            shouldShow = true;
            config = AppConfig.facilityTypes.police_station;
        }
        
        if (shouldShow && config) {
            // Add marker
            const marker = L.marker([facility.latitude, facility.longitude], {
                icon: L.divIcon({
                    html: `<div style="background: ${config.color}; color: white; padding: 6px; border-radius: 50%; width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${config.icon}</div>`,
                    className: 'facility-marker',
                    iconSize: [35, 35]
                })
            });
            
            marker.bindPopup(`
                <div style="min-width: 180px;">
                    <h6 style="margin: 0 0 0.5rem 0; color: ${config.color};">${config.icon} ${config.name}</h6>
                    <strong>${facility.name}</strong><br>
                    ${facility.route_distance ? 
                        `<small>🚗 Route: ${facility.route_distance.toFixed(2)} km (${Math.round(facility.route_duration)} min)</small><br>` :
                        `<small>📏 Straight: ${facility.distance_km.toFixed(2)} km</small><br>`
                    }
                    <small>🏥 Capacity: ${facility.capacity}</small><br>
                    <small>✅ Status: ${facility.status}</small>
                </div>
            `);
            
            marker.addTo(facilitiesLayer);
            
            // Add distance line
            if (showDistances && currentDisasterLocation) {
                const line = L.polyline(
                    [
                        [currentDisasterLocation.lat, currentDisasterLocation.lng],
                        [facility.latitude, facility.longitude]
                    ],
                    {
                        color: config.color,
                        weight: 2,
                        opacity: 0.6,
                        dashArray: '5, 10'
                    }
                );
                
                line.bindTooltip(`${facility.distance_km.toFixed(2)} km`, {
                    permanent: false,
                    direction: 'center'
                });
                
                line.addTo(distanceLinesLayer);
            }
            
            // Add to list
            facilityListHtml.push(`
                <div class="facility-item">
                    <strong>${config.icon} ${facility.name}</strong>
                    ${facility.route_distance ?
                        `<small>🚗 ${facility.route_distance.toFixed(2)} km (${Math.round(facility.route_duration)} min) | 🏥 ${facility.capacity}</small>` :
                        `<small>📏 ${facility.distance_km.toFixed(2)} km | 🏥 ${facility.capacity}</small>`
                    }
                </div>
            `);
        }
    });
    
    document.getElementById('facility-list').innerHTML = facilityListHtml.join('') || '<p style="text-align: center; color: #666;">No facilities to display</p>';
}

// Update distance lines
function updateDistanceLines() {
    updateFacilityDisplay();
}

// Load highways for evacuation routes
async function loadHighways(disasterData) {
    try {
        console.log('🛣️ Loading highways for evacuation routes...');
        
        // Calculate 50km from disaster boundary
        const evacuationRadius = disasterData.radius_km + 50;
        
        // For now, we'll create a visual representation
        // In production, this would load actual highway data from backend
        
        // Draw evacuation zone (50km from boundary)
        L.circle([disasterData.latitude, disasterData.longitude], {
            radius: evacuationRadius * 1000,
            color: '#ffc107',
            fillColor: '#ffc107',
            fillOpacity: 0.05,
            weight: 2,
            dashArray: '15, 15'
        }).addTo(highwaysLayer).bindPopup(`
            <strong>Evacuation Zone</strong><br>
            Radius: ${evacuationRadius} km from disaster center<br>
            <small>Highways within this zone are critical for evacuation</small>
        `);
        
        // Add label
        L.marker([disasterData.latitude, disasterData.longitude], {
            icon: L.divIcon({
                html: `<div style="background: #ffc107; color: black; padding: 5px 10px; border-radius: 3px; font-weight: bold; font-size: 11px; white-space: nowrap;">⚠️ EVACUATION ZONE: ${evacuationRadius}km</div>`,
                className: 'evacuation-label',
                iconSize: [150, 30]
            }),
            zIndexOffset: 1000
        }).addTo(highwaysLayer);
        
        console.log(`✅ Evacuation zone marked: ${evacuationRadius}km radius`);
        
    } catch (error) {
        console.error('❌ Error loading highways:', error);
    }
}

// Calculate real route between two points
async function calculateRoute(fromLat, fromLon, toLat, toLon, facilityName) {
    try {
        // Using OSRM public API for routing
        const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Routing service unavailable');
        }
        
        const data = await response.json();
        
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            return {
                geometry: route.geometry,
                distance: route.distance / 1000, // Convert to km
                duration: route.duration / 60, // Convert to minutes
                facilityName: facilityName
            };
        }
        
        return null;
    } catch (error) {
        console.error('Error calculating route:', error);
        return null;
    }
}

// Load routes to facilities
async function loadRoutesToFacilities() {
    if (!currentDisasterLocation || allFacilities.length === 0) {
        return;
    }
    
    routesLayer.clearLayers();
    allRoutes = [];
    
    console.log('🚗 Calculating real routes to facilities...');
    
    // Get top 5 closest facilities of each type
    const topFacilities = [];
    ['hospital', 'fire_station', 'police_station'].forEach(type => {
        const facilities = allFacilities.filter(f => f.type === type).slice(0, 5);
        topFacilities.push(...facilities);
    });
    
    let routesCalculated = 0;
    
    for (const facility of topFacilities) {
        const route = await calculateRoute(
            currentDisasterLocation.lat,
            currentDisasterLocation.lng,
            facility.latitude,
            facility.longitude,
            facility.name
        );
        
        if (route) {
            allRoutes.push(route);
            routesCalculated++;
            
            // Get color based on facility type
            let color = '#dc3545';
            if (facility.type === 'fire_station') color = '#fd7e14';
            if (facility.type === 'police_station') color = '#007bff';
            
            // Draw route on map
            const routeLine = L.geoJSON(route.geometry, {
                style: {
                    color: color,
                    weight: 4,
                    opacity: 0.7
                }
            });
            
            routeLine.bindPopup(`
                <strong>Route to ${facility.name}</strong><br>
                <strong>Distance:</strong> ${route.distance.toFixed(2)} km<br>
                <strong>Est. Time:</strong> ${Math.round(route.duration)} minutes<br>
                <small>Real road route via OSRM</small>
            `);
            
            routeLine.addTo(routesLayer);
        }
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`✅ Calculated ${routesCalculated} real routes`);
    
    // Update facility list with real distances
    updateFacilityListWithRoutes();
}

// Update facility list with route information
function updateFacilityListWithRoutes() {
    allFacilities.forEach(facility => {
        const route = allRoutes.find(r => r.facilityName === facility.name);
        if (route) {
            facility.route_distance = route.distance;
            facility.route_duration = route.duration;
        }
    });
    
    // Re-sort by route distance if available
    allFacilities.sort((a, b) => {
        const distA = a.route_distance || a.distance_km;
        const distB = b.route_distance || b.distance_km;
        return distA - distB;
    });
    
    updateFacilityDisplay();
}
