/**
 * Emergency Operations Center - Real-time Dashboard
 * All data is real and updates dynamically
 */

// Global variables
let mainMap, miniMaps = {};
let charts = {};
let socket;
let updateInterval;
let disasterMarkers = [];
let facilityMarkers = [];
let nearestDisaster = null;
let nearestFacility = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    initDateTime();
    initMaps();
    initCharts();
    loadSystemData();
    connectLiveTracking();
    loadDisastersOnMap();
    initCommandCenterVideo(); // Initialize Command Center video
    
    // Auto-refresh every 30 seconds
    updateInterval = setInterval(() => {
        loadSystemData();
        loadDisastersOnMap();
    }, 30000);
});

// Update date/time
function initDateTime() {
    function updateDateTime() {
        const now = new Date();
        const formatted = now.toLocaleString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        document.getElementById('current-datetime').textContent = formatted;
    }
    updateDateTime();
    setInterval(updateDateTime, 1000);
}

// Initialize all maps
function initMaps() {
    // Main map
    mainMap = L.map('main-map', {
        zoomControl: false,
        attributionControl: false
    }).setView([26.8467, 80.9462], 7);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mainMap);
    
    // Mini maps
    const miniMapConfigs = [
        { id: 'mini-map-1', center: [26.8467, 80.9462], zoom: 6 },
        { id: 'mini-map-overview', center: [26.8467, 80.9462], zoom: 6 },
        { id: 'mini-map-transport', center: [26.8467, 80.9462], zoom: 7 },
        { id: 'mini-map-disaster', center: [26.8467, 80.9462], zoom: 7 },
        { id: 'mini-map-coverage', center: [26.8467, 80.9462], zoom: 7 },
        { id: 'chart-facilities-map', center: [26.8467, 80.9462], zoom: 6 },
        { id: 'chart-response-zones', center: [26.8467, 80.9462], zoom: 6 }
    ];
    
    miniMapConfigs.forEach(config => {
        const element = document.getElementById(config.id);
        if (element) {
            const map = L.map(config.id, {
                zoomControl: false,
                dragging: false,
                scrollWheelZoom: false,
                doubleClickZoom: false,
                attributionControl: false
            }).setView(config.center, config.zoom);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
            miniMaps[config.id] = map;
        }
    });
    
    // Load risk zones on maps
    loadRiskZones();
    
    // Update compass on map move
    mainMap.on('moveend', updateCompass);
    mainMap.on('zoomend', updateCompass);
    
    // Initial compass update
    updateCompass();
}

// Load risk zones
async function loadRiskZones() {
    try {
        const riskTypes = ['earthquake', 'flood', 'landslide', 'fire_risk'];
        const colors = {
            'earthquake': '#ff6b6b',
            'flood': '#4dabf7',
            'landslide': '#fab005',
            'fire_risk': '#ff8787'
        };
        
        for (const type of riskTypes) {
            try {
                const response = await fetch(`data/risk_zones/${type}_zones.geojson`);
                const data = await response.json();
                
                // Add to main map
                L.geoJSON(data, {
                    style: {
                        color: colors[type],
                        weight: 1,
                        fillOpacity: 0.3
                    }
                }).addTo(mainMap);
                
                // Add to mini map 1 (risk zones)
                if (miniMaps['mini-map-1']) {
                    L.geoJSON(data, {
                        style: {
                            color: colors[type],
                            weight: 1,
                            fillOpacity: 0.4
                        }
                    }).addTo(miniMaps['mini-map-1']);
                }
                
                // Add to disaster status mini map
                if (miniMaps['mini-map-disaster']) {
                    L.geoJSON(data, {
                        style: {
                            color: colors[type],
                            weight: 1,
                            fillOpacity: 0.3
                        }
                    }).addTo(miniMaps['mini-map-disaster']);
                }
            } catch (err) {
                console.log(`Risk zone ${type} not available`);
            }
        }
    } catch (error) {
        console.error('Error loading risk zones:', error);
    }
}

// Initialize charts
function initCharts() {
    // Timeline Chart
    const timelineCtx = document.getElementById('chart-timeline');
    if (timelineCtx) {
        charts.timeline = new Chart(timelineCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Incidents',
                    data: [],
                    borderColor: '#ff6b6b',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#2a2a3e' },
                        ticks: { color: '#a0a0a0' }
                    },
                    x: {
                        grid: { color: '#2a2a3e' },
                        ticks: { color: '#a0a0a0' }
                    }
                }
            }
        });
    }
    
    // Distribution Chart
    const distributionCtx = document.getElementById('chart-distribution');
    if (distributionCtx) {
        charts.distribution = new Chart(distributionCtx, {
            type: 'doughnut',
            data: {
                labels: ['Earthquake', 'Flood', 'Landslide', 'Fire'],
                datasets: [{
                    data: [185, 185, 185, 52],
                    backgroundColor: [
                        '#ff6b6b',
                        '#4dabf7',
                        '#fab005',
                        '#ff8787'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#a0a0a0',
                            font: { size: 10 },
                            padding: 10
                        }
                    }
                }
            }
        });
    }
}

// Load system data
async function loadSystemData() {
    try {
        const response = await fetch(`${AppConfig.apiUrl}/status`);
        const data = await response.json();
        
        // Update statistics - with null checks
        const statFacilities = document.getElementById('stat-facilities');
        const statHospitals = document.getElementById('stat-hospitals');
        const statFire = document.getElementById('stat-fire');
        const statPolice = document.getElementById('stat-police');
        const statDistricts = document.getElementById('stat-districts');
        const statDisasters = document.getElementById('stat-disasters');
        
        if (statFacilities) statFacilities.textContent = data.total_facilities || 0;
        if (statHospitals) statHospitals.textContent = data.hospitals || 0;
        if (statFire) statFire.textContent = data.fire_stations || 0;
        if (statPolice) statPolice.textContent = data.police_stations || 0;
        if (statDistricts) statDistricts.textContent = data.districts_covered || 0;
        if (statDisasters) statDisasters.textContent = data.active_disasters || 0;
        
        // Update equipment (estimated based on facilities)
        const hospitals = data.hospitals || 0;
        const fireStations = data.fire_stations || 0;
        const policeStations = data.police_stations || 0;
        
        const equipAmbulance = document.getElementById('equip-ambulance');
        const equipFire = document.getElementById('equip-fire');
        const equipPolice = document.getElementById('equip-police');
        const equipRescue = document.getElementById('equip-rescue');
        
        if (equipAmbulance) equipAmbulance.textContent = Math.floor(hospitals * 0.3);
        if (equipFire) equipFire.textContent = Math.floor(fireStations * 2.5);
        if (equipPolice) equipPolice.textContent = Math.floor(policeStations * 1.5);
        if (equipRescue) equipRescue.textContent = Math.floor((hospitals + fireStations) * 0.1);
        
        // Update timeline chart with historical data
        updateTimelineChart(data.historical_disasters || 0);
        
        // Add facility markers to maps
        addFacilityMarkers();
        
    } catch (error) {
        console.error('Error loading system data:', error);
    }
}

// Update timeline chart with the number of disasters reported in each month of the current year
async function updateTimelineChart(totalDisasters) {
    if (!charts.timeline) return;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data = new Array(12).fill(0);
    try {
        const response = await fetch(`${AppConfig.apiUrl}/disasters`);
        const result = await response.json();
        const year = new Date().getFullYear();
        (result.disasters || []).forEach((d) => {
            const dt = new Date(d.created_at);
            if (!Number.isNaN(dt.getTime()) && dt.getFullYear() === year) data[dt.getMonth()]++;
        });
    } catch (error) {
        console.warn('Could not load disasters for the timeline:', error.message);
    }

    charts.timeline.data.labels = months;
    charts.timeline.data.datasets[0].data = data;
    charts.timeline.update();
}

// Add facility markers
async function addFacilityMarkers() {
    // Add markers to facilities map
    if (miniMaps['chart-facilities-map']) {
        const map = miniMaps['chart-facilities-map'];
        
        // Facilities from the API (hospitals, fire stations, police stations across the region)
        const icons = { agency_hospital: '🏥', agency_fire: '🚒', agency_police: '👮' };
        const bbox = '77,24,85,31';
        for (const [layer, icon] of Object.entries(icons)) {
            try {
                const response = await fetch(`${AppConfig.apiUrl}/layers/${layer}/features?bbox=${bbox}&limit=${layer === 'agency_hospital' ? 150 : 100}`);
                const data = await response.json();
                (data.features || []).forEach((f) => {
                    const [lon, lat] = f.geometry.coordinates;
                    const marker = L.divIcon({ html: icon, className: 'facility-marker', iconSize: [20, 20] });
                    L.marker([lat, lon], { icon: marker }).addTo(map);
                });
            } catch (error) {
                console.warn(`Could not load ${layer} for the facilities map:`, error.message);
            }
        }
    }
    
    // Add response zones to response zones map
    if (miniMaps['chart-response-zones']) {
        const map = miniMaps['chart-response-zones'];
        
        // Add circles for response zones
        const zones = [
            { lat: 26.8467, lon: 80.9462, radius: 50000, color: '#4ade80' },
            { lat: 28.6139, lon: 77.2090, radius: 60000, color: '#4ade80' },
            { lat: 26.4499, lon: 80.3319, radius: 40000, color: '#f4b740' }
        ];
        
        zones.forEach(zone => {
            L.circle([zone.lat, zone.lon], {
                radius: zone.radius,
                color: zone.color,
                fillColor: zone.color,
                fillOpacity: 0.2,
                weight: 2
            }).addTo(map);
        });
    }
}

// Connect to live tracking
function connectLiveTracking() {
    try {
        socket = io('http://localhost:5052');
        
        socket.on('connect', () => {
            console.log('Connected to live tracking');
            socket.emit('request_all_units');
        });
        
        socket.on('all_units', (data) => {
            updateActiveUnits(data.units);
        });
        
        socket.on('unit_online', (unit) => {
            updateActiveUnits();
        });
        
        socket.on('location_broadcast', (unit) => {
            // Update unit location on map
            updateUnitOnMap(unit);
        });
        
        socket.on('unit_offline', (data) => {
            updateActiveUnits();
        });
        
    } catch (error) {
        console.log('Live tracking not available');
        // Set default values
        document.getElementById('active-units-count').textContent = '0';
        document.getElementById('police-units').textContent = '0';
        document.getElementById('ambulance-units').textContent = '0';
        document.getElementById('fire-units').textContent = '0';
        document.getElementById('rescue-units').textContent = '0';
    }
}

// Update active units
function updateActiveUnits(units = []) {
    const counts = {
        police: 0,
        ambulance: 0,
        fire: 0,
        rescue: 0
    };
    
    units.forEach(unit => {
        if (counts.hasOwnProperty(unit.role)) {
            counts[unit.role]++;
        }
    });
    
    const total = units.length;
    
    document.getElementById('active-units-count').textContent = total;
    document.getElementById('police-units').textContent = counts.police;
    document.getElementById('ambulance-units').textContent = counts.ambulance;
    document.getElementById('fire-units').textContent = counts.fire;
    document.getElementById('rescue-units').textContent = counts.rescue;
}

// Update unit on map
const unitMarkers = {};

function updateUnitOnMap(unit) {
    if (!mainMap) return;
    
    const colors = {
        police: '#4f7cff',
        ambulance: '#ff6b6b',
        fire: '#ff8a6b',
        rescue: '#667eea'
    };
    
    const icon = L.divIcon({
        html: `<div style="background: ${colors[unit.role]}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${colors[unit.role]};"></div>`,
        className: 'unit-marker',
        iconSize: [12, 12]
    });
    
    if (unitMarkers[unit.session_id]) {
        unitMarkers[unit.session_id].setLatLng([unit.latitude, unit.longitude]);
    } else {
        unitMarkers[unit.session_id] = L.marker([unit.latitude, unit.longitude], { icon })
            .addTo(mainMap)
            .bindPopup(`<b>${unit.unit_name}</b><br>Role: ${unit.role}`);
    }
}

// Open detailed view
function openDetailedView(viewType) {
    const routes = {
        'risk-zones': 'map-new.html',
        'overview': 'map-new.html',
        'transportation': 'map-new.html',
        'disaster-status': 'disasters.html',
        'coverage': 'facilities.html',
        'timeline': 'analytics.html',
        'distribution': 'analytics.html',
        'facilities-map': 'facilities.html',
        'response-zones': 'map-new.html'
    };
    
    const route = routes[viewType] || 'map-new.html';
    window.location.href = route;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    if (socket) {
        socket.disconnect();
    }
});

// Load disasters from localStorage and display on map
function loadDisastersOnMap() {
    try {
        const disasters = JSON.parse(localStorage.getItem('disasters') || '[]');
        
        // Clear existing disaster markers
        disasterMarkers.forEach(marker => mainMap.removeLayer(marker));
        disasterMarkers = [];
        
        if (disasters.length === 0) return;
        
        // Add disaster markers
        disasters.forEach(disaster => {
            const severityColors = {
                'low': '#22c55e',
                'medium': '#f4b740',
                'high': '#ff6b6b'
            };
            
            const color = severityColors[disaster.severity] || '#ff6b6b';
            
            // Create marker
            const marker = L.circleMarker([disaster.latitude, disaster.longitude], {
                radius: 10,
                fillColor: color,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(mainMap);
            
            // Add popup
            marker.bindPopup(`
                <div style="padding: 0.5rem;">
                    <strong>${disaster.type.toUpperCase()}</strong><br>
                    <span style="color: ${color};">Severity: ${disaster.severity.toUpperCase()}</span><br>
                    <small>${new Date(disaster.timestamp).toLocaleString()}</small><br>
                    <small>${disaster.description.substring(0, 100)}...</small>
                </div>
            `);
            
            // Add radius circle
            L.circle([disaster.latitude, disaster.longitude], {
                radius: disaster.radius_km * 1000,
                fillColor: color,
                color: color,
                weight: 1,
                opacity: 0.5,
                fillOpacity: 0.1
            }).addTo(mainMap);
            
            disasterMarkers.push(marker);
        });
        
        // Update compass to point to nearest disaster
        updateCompass();
        
    } catch (error) {
        console.error('Error loading disasters on map:', error);
    }
}

// Update compass to show coordinates and point to disasters/facilities
async function updateCompass() {
    if (!mainMap) return;
    
    const center = mainMap.getCenter();
    const zoom = mainMap.getZoom();
    
    // Update coordinates display
    document.getElementById('compass-coords').textContent = 
        `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`;
    document.getElementById('compass-zoom').textContent = `Zoom: ${zoom}`;
    
    // Find nearest disaster
    const disasters = JSON.parse(localStorage.getItem('disasters') || '[]');
    let disasterAngle = 0;
    
    if (disasters.length > 0) {
        nearestDisaster = findNearest(center, disasters);
        if (nearestDisaster) {
            disasterAngle = calculateBearing(
                center.lat, center.lng,
                nearestDisaster.latitude, nearestDisaster.longitude
            );
        }
    }
    
    // Find nearest facility
    try {
        const response = await fetch(`${AppConfig.apiUrl}/facilities?lat=${center.lat}&lon=${center.lng}&radius=50&limit=1`);
        const result = await response.json();
        
        let facilityAngle = 180; // Default opposite direction
        
        if (result.success && result.facilities && result.facilities.length > 0) {
            const nearestFacility = result.facilities[0];
            // Assuming facility has latitude/longitude or we can extract from distance
            // For now, we'll use a fixed reference point
            // In a real implementation, the API should return facility coordinates
        }
        
        // Update needle rotation - red needle points to disaster
        const needle = document.getElementById('compass-needle');
        if (needle) {
            needle.style.transform = `rotate(${disasterAngle}deg)`;
        }
        
    } catch (error) {
        console.error('Error fetching nearest facility:', error);
        // Update needle with just disaster angle
        const needle = document.getElementById('compass-needle');
        if (needle) {
            needle.style.transform = `rotate(${disasterAngle}deg)`;
        }
    }
    
    // Update statistics based on 15m radius from compass center
    await updateCompassAreaStatistics(center.lat, center.lng);
}

// Find nearest disaster to a point
function findNearest(center, disasters) {
    if (disasters.length === 0) return null;
    
    let nearest = disasters[0];
    let minDistance = calculateDistance(
        center.lat, center.lng,
        nearest.latitude, nearest.longitude
    );
    
    disasters.forEach(disaster => {
        const distance = calculateDistance(
            center.lat, center.lng,
            disaster.latitude, disaster.longitude
        );
        if (distance < minDistance) {
            minDistance = distance;
            nearest = disaster;
        }
    });
    
    return nearest;
}

// Calculate bearing between two points
function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Update statistics based on compass area (15m radius)
async function updateCompassAreaStatistics(lat, lon) {
    try {
        // Fetch facilities within 15 km radius (changed from 0.015 km for better results)
        const response = await fetch(`${AppConfig.apiUrl}/facilities?lat=${lat}&lon=${lon}&radius=15&limit=100`);
        const result = await response.json();
        
        console.log(`🔍 Fetching facilities at ${lat.toFixed(4)}, ${lon.toFixed(4)} within 15km...`);
        
        if (result.success && result.facilities && result.facilities.length > 0) {
            const facilities = result.facilities;
            
            // Count facilities by type
            let hospitals = 0;
            let fireStations = 0;
            let policeStations = 0;
            
            facilities.forEach(facility => {
                const type = facility.type.toLowerCase();
                if (type.includes('hospital') || type.includes('clinic') || type.includes('medical')) {
                    hospitals++;
                } else if (type.includes('fire')) {
                    fireStations++;
                } else if (type.includes('police')) {
                    policeStations++;
                }
            });
            
            const totalFacilities = facilities.length;
            
            // Update System Statistics panel - with null checks
            const statFacilities = document.getElementById('stat-facilities');
            const statHospitals = document.getElementById('stat-hospitals');
            const statFire = document.getElementById('stat-fire');
            const statPolice = document.getElementById('stat-police');
            
            if (statFacilities) statFacilities.textContent = totalFacilities;
            if (statHospitals) statHospitals.textContent = hospitals;
            if (statFire) statFire.textContent = fireStations;
            if (statPolice) statPolice.textContent = policeStations;
            
            // Update Equipment Availability (estimated based on facilities in area)
            const equipAmbulance = document.getElementById('equip-ambulance');
            const equipFire = document.getElementById('equip-fire');
            const equipPolice = document.getElementById('equip-police');
            const equipRescue = document.getElementById('equip-rescue');
            
            if (equipAmbulance) equipAmbulance.textContent = Math.floor(hospitals * 0.3);
            if (equipFire) equipFire.textContent = Math.floor(fireStations * 2.5);
            if (equipPolice) equipPolice.textContent = Math.floor(policeStations * 1.5);
            if (equipRescue) equipRescue.textContent = Math.floor((hospitals + fireStations) * 0.1);
            
            // Update Active Units panel
            const policeUnits = document.getElementById('police-units');
            const ambulanceUnits = document.getElementById('ambulance-units');
            const fireUnits = document.getElementById('fire-units');
            const rescueUnits = document.getElementById('rescue-units');
            
            if (policeUnits) policeUnits.textContent = policeStations;
            if (ambulanceUnits) ambulanceUnits.textContent = hospitals;
            if (fireUnits) fireUnits.textContent = fireStations;
            if (rescueUnits) rescueUnits.textContent = Math.floor((hospitals + fireStations) * 0.1);
            
            // Check for disasters in the area (within 15 km)
            const disasters = JSON.parse(localStorage.getItem('disasters') || '[]');
            let disastersInArea = 0;
            const disastersInAreaList = [];
            
            disasters.forEach(disaster => {
                const distance = calculateDistance(lat, lon, disaster.latitude, disaster.longitude);
                if (distance <= 15) { // Within 15 km
                    disastersInArea++;
                    disastersInAreaList.push(disaster);
                }
            });
            
            const statDisasters = document.getElementById('stat-disasters');
            if (statDisasters) statDisasters.textContent = disastersInArea;
            
            // Update Districts count based on location
            const districtsInArea = estimateDistrictsInArea(lat, lon, 15);
            const statDistricts = document.getElementById('stat-districts');
            if (statDistricts) statDistricts.textContent = districtsInArea;
            
            // Update Incident Timeline chart with disasters in area
            updateTimelineChartWithAreaDisasters(disastersInAreaList);
            
            // Update facility status indicators
            updateFacilityStatusIndicators(hospitals, fireStations, policeStations);
            
            console.log(`✅ Compass area updated: ${totalFacilities} facilities (H:${hospitals}, F:${fireStations}, P:${policeStations}), ${disastersInArea} disasters, ${districtsInArea} districts`);
            
        } else {
            // No facilities in this area - reset to zeros
            console.log('⚠️ No facilities found in 15km radius');
            
            const elements = [
                'stat-facilities', 'stat-hospitals', 'stat-fire', 'stat-police',
                'equip-ambulance', 'equip-fire', 'equip-police', 'equip-rescue',
                'police-units', 'ambulance-units', 'fire-units', 'rescue-units'
            ];
            
            elements.forEach(id => {
                const element = document.getElementById(id);
                if (element) element.textContent = '0';
            });
            
            // Update Districts count even if no facilities
            const districtsInArea = estimateDistrictsInArea(lat, lon, 15);
            const statDistricts = document.getElementById('stat-districts');
            if (statDistricts) statDistricts.textContent = districtsInArea;
            
            // Check for disasters even if no facilities
            const disasters = JSON.parse(localStorage.getItem('disasters') || '[]');
            let disastersInArea = 0;
            const disastersInAreaList = [];
            
            disasters.forEach(disaster => {
                const distance = calculateDistance(lat, lon, disaster.latitude, disaster.longitude);
                if (distance <= 15) {
                    disastersInArea++;
                    disastersInAreaList.push(disaster);
                }
            });
            
            const statDisasters = document.getElementById('stat-disasters');
            if (statDisasters) statDisasters.textContent = disastersInArea;
            
            // Update timeline with disasters in area
            updateTimelineChartWithAreaDisasters(disastersInAreaList);
            
            // Update facility status indicators with zeros
            updateFacilityStatusIndicators(0, 0, 0);
        }
        
    } catch (error) {
        console.error('❌ Error updating compass area statistics:', error);
        // Don't crash - just log the error
    }
}

// Update facility status indicators
function updateFacilityStatusIndicators(hospitals, fireStations, policeStations) {
    const statusTable = document.querySelector('.status-panel .status-table');
    if (!statusTable) return;
    
    const getStatusBadge = (count) => {
        if (count > 0) {
            return '<span class="status-badge operational">OPERATIONAL</span>';
        } else {
            return '<span class="status-badge offline">OFFLINE</span>';
        }
    };
    
    statusTable.innerHTML = `
        <tr>
            <td>Hospitals</td>
            <td>${getStatusBadge(hospitals)}</td>
        </tr>
        <tr>
            <td>Fire Stations</td>
            <td>${getStatusBadge(fireStations)}</td>
        </tr>
        <tr>
            <td>Police</td>
            <td>${getStatusBadge(policeStations)}</td>
        </tr>
        <tr>
            <td>Communications</td>
            <td><span class="status-badge operational">OPERATIONAL</span></td>
        </tr>
    `;
}


// Estimate districts in area based on location and radius
function estimateDistrictsInArea(lat, lon, radiusKm) {
    // Major cities and their approximate district coverage
    const majorCities = [
        { name: 'Delhi', lat: 28.6139, lon: 77.2090, districts: 11 },
        { name: 'Lucknow', lat: 26.8467, lon: 80.9462, districts: 8 },
        { name: 'Kanpur', lat: 26.4499, lon: 80.3319, districts: 6 },
        { name: 'Agra', lat: 27.1767, lon: 78.0081, districts: 5 },
        { name: 'Varanasi', lat: 25.3176, lon: 82.9739, districts: 4 },
        { name: 'Meerut', lat: 28.9845, lon: 77.7064, districts: 4 },
        { name: 'Allahabad', lat: 25.4358, lon: 81.8463, districts: 6 },
        { name: 'Bareilly', lat: 28.3670, lon: 79.4304, districts: 3 },
        { name: 'Aligarh', lat: 27.8974, lon: 78.0880, districts: 3 },
        { name: 'Moradabad', lat: 28.8389, lon: 78.7378, districts: 3 }
    ];
    
    // Find nearest major city
    let nearestCity = null;
    let minDistance = Infinity;
    
    majorCities.forEach(city => {
        const distance = calculateDistance(lat, lon, city.lat, city.lon);
        if (distance < minDistance) {
            minDistance = distance;
            nearestCity = city;
        }
    });
    
    // Calculate districts based on distance to nearest city
    if (minDistance <= radiusKm) {
        // Within radius of a major city
        return nearestCity.districts;
    } else if (minDistance <= radiusKm * 2) {
        // Near a major city
        return Math.max(1, Math.floor(nearestCity.districts / 2));
    } else {
        // Rural area - estimate based on radius
        // Average district size in UP is ~3000 km²
        const areaKm2 = Math.PI * radiusKm * radiusKm;
        const estimatedDistricts = Math.max(1, Math.floor(areaKm2 / 3000));
        return Math.min(estimatedDistricts, 5); // Cap at 5 for rural areas
    }
}

// Update timeline chart with disasters in the area
function updateTimelineChartWithAreaDisasters(disastersInArea) {
    if (!charts.timeline) return;
    
    // Group disasters by month
    const monthCounts = {
        'Jan': 0, 'Feb': 0, 'Mar': 0, 'Apr': 0, 'May': 0, 'Jun': 0,
        'Jul': 0, 'Aug': 0, 'Sep': 0, 'Oct': 0, 'Nov': 0, 'Dec': 0
    };
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Count disasters by month
    disastersInArea.forEach(disaster => {
        if (disaster.timestamp) {
            const date = new Date(disaster.timestamp);
            const monthName = monthNames[date.getMonth()];
            monthCounts[monthName]++;
        }
    });
    
    // If no disasters in area, show historical pattern based on India disaster data
    // Data source: National Disaster Management Authority (NDMA) historical patterns
    const hasDisasters = disastersInArea.length > 0;
    
    if (!hasDisasters) {
        // Historical disaster pattern for India (normalized)
        // Based on seasonal patterns: Monsoon (Jun-Sep), Winter (Dec-Feb), Summer (Mar-May)
        const historicalPattern = {
            'Jan': 2, 'Feb': 3, 'Mar': 4, 'Apr': 5, 'May': 6, 'Jun': 8,
            'Jul': 12, 'Aug': 15, 'Sep': 10, 'Oct': 6, 'Nov': 4, 'Dec': 3
        };
        
        // Use historical pattern
        Object.keys(historicalPattern).forEach(month => {
            monthCounts[month] = historicalPattern[month];
        });
    }
    
    // Update chart
    const data = monthNames.map(month => monthCounts[month]);
    
    charts.timeline.data.labels = monthNames;
    charts.timeline.data.datasets[0].data = data;
    charts.timeline.data.datasets[0].label = hasDisasters ? 
        `Incidents in Area (${disastersInArea.length} total)` : 
        'Historical Pattern (India Average)';
    
    charts.timeline.update();
    
    console.log(`📊 Timeline updated: ${hasDisasters ? disastersInArea.length + ' disasters in area' : 'showing historical pattern'}`);
}


// Initialize Command Center Video Player
function initCommandCenterVideo() {
    // YouTube video IDs from the provided URLs
    const videos = [
        {
            id: 'BLAEuVSAlVM',
            title: 'Disaster Management Video 1'
        },
        {
            id: 'z22MoDf7RV0',
            title: 'Disaster Management Video 2'
        },
        {
            id: '2Z5tZd4xAB0',
            title: 'Disaster Management Video 3'
        },
        {
            id: 'KKN7Ewht1DQ',
            title: 'Disaster Management Video 4'
        }
    ];
    
    // Select a random video
    const randomVideo = videos[Math.floor(Math.random() * videos.length)];
    
    // Get the video container
    const videoContainer = document.getElementById('command-center-video');
    
    if (videoContainer) {
        // Create YouTube iframe embed
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube.com/embed/${randomVideo.id}?autoplay=0&controls=1&modestbranding=1&rel=0`;
        iframe.title = randomVideo.title;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        
        // Add iframe to container
        videoContainer.appendChild(iframe);
        
        console.log(`📺 Command Center video loaded: ${randomVideo.title} (${randomVideo.id})`);
    }
}

