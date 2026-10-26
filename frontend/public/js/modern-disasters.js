/**
 * Modern Disasters Page JavaScript
 */

let locationMap = null;
let locationMarker = null;
let mapPickerVisible = false;

const DISASTER_TYPE_API_MAP = {
    drought: 'other',
    industrial_accident: 'other'
};

const SEVERITY_API_MAP = {
    critical: 'high'
};

const BACKEND_TYPE_MAP = {
    flood: 'Flood',
    earthquake: 'Earthquake',
    fire: 'Fire',
    landslide: 'Landslide',
    cyclone: 'Cyclone',
    drought: 'Drought',
    industrial_accident: 'Fire',
    other: 'Flood'
};

const BACKEND_SEVERITY_MAP = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical'
};

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Check for saved test location
    const testLocation = localStorage.getItem('testLocation');
    if (testLocation) {
        const { lat, lon, name } = JSON.parse(testLocation);
        setCoordinates(lat, lon, name);
        localStorage.removeItem('testLocation');
    }
    
    // Setup form submission
    document.getElementById('disaster-form').addEventListener('submit', handleDisasterSubmit);
    document.getElementById('radius').addEventListener('input', loadEnhancedIntelligence);
    document.getElementById('latitude').addEventListener('change', loadEnhancedIntelligence);
    document.getElementById('longitude').addEventListener('change', loadEnhancedIntelligence);
    renderDisasterHistory();
    syncDisastersFromBackend();
});

// Set coordinates from quick location
function setCoordinates(lat, lon, name) {
    document.getElementById('latitude').value = lat;
    document.getElementById('longitude').value = lon;
    showToast(`Coordinates set to ${name}`, 'success');
    loadEnhancedIntelligence();
    
    // Update map marker if map is visible
    if (locationMap && locationMarker) {
        locationMarker.setLatLng([lat, lon]);
        locationMap.setView([lat, lon], 12);
    }
}

// Toggle map picker
function toggleMapPicker() {
    const wrapper = document.getElementById('map-container-wrapper');
    const toggleText = document.getElementById('map-toggle-text');
    
    mapPickerVisible = !mapPickerVisible;
    
    if (mapPickerVisible) {
        wrapper.classList.add('show');
        toggleText.textContent = 'Hide Map';
        
        // Initialize map if not already done
        if (!locationMap) {
            initLocationMap();
        }
        
        // If coordinates are already filled, show marker
        const lat = parseFloat(document.getElementById('latitude').value);
        const lon = parseFloat(document.getElementById('longitude').value);
        if (lat && lon) {
            updateMapMarker(lat, lon);
            locationMap.setView([lat, lon], 12);
        }
    } else {
        wrapper.classList.remove('show');
        toggleText.textContent = 'Select Location on Map';
    }
}

// Initialize location picker map
function initLocationMap() {
    // Create map
    locationMap = L.map('location-map').setView(AppConfig.mapCenter, AppConfig.zoomLevel);
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(locationMap);
    
    // Add click handler
    locationMap.on('click', function(e) {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;
        
        // Update form fields
        document.getElementById('latitude').value = lat.toFixed(4);
        document.getElementById('longitude').value = lon.toFixed(4);
        
        // Update marker
        updateMapMarker(lat, lon);
        
        showToast(`Location selected: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, 'success');
        loadEnhancedIntelligence();
    });
    
    // Add some sample markers for reference
    addReferenceCities();
}

// Update map marker
function updateMapMarker(lat, lon) {
    if (locationMarker) {
        locationMap.removeLayer(locationMarker);
    }
    
    locationMarker = L.marker([lat, lon], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(locationMap);
    
    locationMarker.bindPopup(`
        <div style="padding: 0.5rem;">
            <strong>Selected Location</strong><br>
            Lat: ${lat.toFixed(4)}<br>
            Lon: ${lon.toFixed(4)}
        </div>
    `).openPopup();
}

// Add reference cities to map
function addReferenceCities() {
    const cities = [
        { name: 'Lucknow', lat: 26.8467, lon: 80.9462, icon: 'city' },
        { name: 'Delhi', lat: 28.6139, lon: 77.2090, icon: 'landmark' },
        { name: 'Kanpur', lat: 26.4499, lon: 80.3319, icon: 'industry' },
        { name: 'Agra', lat: 27.1767, lon: 78.0081, icon: 'monument' }
    ];
    
    cities.forEach(city => {
        const marker = L.marker([city.lat, city.lon], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [20, 33],
                iconAnchor: [10, 33],
                popupAnchor: [1, -28],
                shadowSize: [33, 33]
            })
        }).addTo(locationMap);
        
        marker.bindPopup(`
            <div style="padding: 0.5rem;">
                <strong>${city.name}</strong><br>
                <small>${city.lat.toFixed(4)}, ${city.lon.toFixed(4)}</small><br>
                <button onclick="setCoordinates(${city.lat}, ${city.lon}, '${city.name}')" 
                        style="margin-top: 0.5rem; padding: 0.25rem 0.75rem; background: linear-gradient(135deg, var(--primary), var(--secondary)); color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Use This Location
                </button>
            </div>
        `);
    });
}

// Use current GPS location
function useMyLocation() {
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser', 'error');
        return;
    }
    
    showToast('Getting your location...', 'info');
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            document.getElementById('latitude').value = lat.toFixed(4);
            document.getElementById('longitude').value = lon.toFixed(4);
            
            // Update map if visible
            if (locationMap && mapPickerVisible) {
                updateMapMarker(lat, lon);
                locationMap.setView([lat, lon], 14);
            } else if (!mapPickerVisible) {
                // Show map with current location
                toggleMapPicker();
                setTimeout(() => {
                    updateMapMarker(lat, lon);
                    locationMap.setView([lat, lon], 14);
                }, 500);
            }
            
            showToast(`Location detected: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, 'success');
            loadEnhancedIntelligence();
        },
        function(error) {
            let message = 'Unable to get your location';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    message = 'Location permission denied. Please enable location access.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = 'Location information unavailable.';
                    break;
                case error.TIMEOUT:
                    message = 'Location request timed out.';
                    break;
            }
            showToast(message, 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Handle disaster form submission
async function handleDisasterSubmit(e) {
    e.preventDefault();

    const selectedType = document.getElementById('disaster-type').value;
    const selectedSeverity = document.getElementById('severity').value;
    const latitude = parseFloat(document.getElementById('latitude').value);
    const longitude = parseFloat(document.getElementById('longitude').value);
    const radiusKm = parseInt(document.getElementById('radius').value, 10);
    const description = document.getElementById('description').value;

    const mappedType = DISASTER_TYPE_API_MAP[selectedType] || selectedType;
    const mappedSeverity = SEVERITY_API_MAP[selectedSeverity] || selectedSeverity;
    const isTypeMapped = mappedType !== selectedType;
    const isSeverityMapped = mappedSeverity !== selectedSeverity;

    const compatibilityNotes = [];
    if (isTypeMapped) {
        compatibilityNotes.push(`Requested type: ${selectedType}`);
    }
    if (isSeverityMapped) {
        compatibilityNotes.push(`Requested severity: ${selectedSeverity}`);
    }

    const formData = {
        disaster_type: mappedType,
        severity: mappedSeverity,
        latitude: latitude,
        longitude: longitude,
        radius_km: radiusKm,
        description: compatibilityNotes.length > 0
            ? `${description}\n[${compatibilityNotes.join(' | ')}]`
            : description
    };
    
    // Show loading modal
    showLoadingModal(true);
    
    try {
        const response = await fetch(`${AppConfig.apiUrl}/create_disaster`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        // Hide loading modal
        showLoadingModal(false);
        
        if (result.success) {
            const dbRecord = await persistDisasterToDatabase({
                disaster_type: selectedType,
                severity: selectedSeverity,
                latitude,
                longitude,
                radius_km: radiusKm,
                description
            });

            const resolvedId = dbRecord?.id || result.disaster_id;
            saveDisasterToLocalStorage({
                id: resolvedId,
                type: selectedType,
                api_type: mappedType,
                severity: selectedSeverity,
                api_severity: mappedSeverity,
                description: description,
                latitude: latitude,
                longitude: longitude,
                radius_km: radiusKm,
                timestamp: new Date().toISOString()
            });
            renderDisasterHistory();

            if (isTypeMapped || isSeverityMapped) {
                showToast('Saved with compatibility mapping for current API', 'warning');
            }

            displayDisasterResult({
                ...result,
                disaster_id: resolvedId
            }, {
                disaster_type: selectedType,
                severity: selectedSeverity
            });
            showToast('Emergency response activated!', 'success');

            // Keep local list synced with backend DB for report generation
            await syncDisastersFromBackend();
            
            // Optionally load nearby facilities
            setTimeout(() => {
                loadNearbyFacilities(latitude, longitude);
            }, 1000);
        } else {
            displayError(result.error || 'Failed to create disaster event');
            showToast('Failed to create disaster event', 'error');
        }
    } catch (error) {
        console.error('Error creating disaster:', error);
        showLoadingModal(false);
        displayError('Network error. Please check your connection.');
        showToast('Network error', 'error');
    }
}

function saveDisasterToLocalStorage(disaster) {
    const disasters = JSON.parse(localStorage.getItem('disasters') || '[]');
    disasters.unshift(disaster);
    localStorage.setItem('disasters', JSON.stringify(disasters.slice(0, 500)));
}

async function persistDisasterToDatabase(disaster) {
    try {
        const type = BACKEND_TYPE_MAP[disaster.disaster_type] || 'Flood';
        const severity = BACKEND_SEVERITY_MAP[disaster.severity] || 'Medium';
        const radiusKm = Number(disaster.radius_km || 5);
        const radiusDeg = radiusKm / 111.0;
        const lon = Number(disaster.longitude);
        const lat = Number(disaster.latitude);

        // Minimal polygon to represent affected area in GeoPackage
        const geometry = {
            type: 'Polygon',
            coordinates: [[
                [lon - radiusDeg, lat - radiusDeg],
                [lon + radiusDeg, lat - radiusDeg],
                [lon + radiusDeg, lat + radiusDeg],
                [lon - radiusDeg, lat + radiusDeg],
                [lon - radiusDeg, lat - radiusDeg]
            ]]
        };

        const payload = {
            disaster_type: type,
            severity: severity,
            description: disaster.description || '',
            geometry,
            created_by: 'web_user'
        };

        const response = await fetch(`${AppConfig.backendApiUrl}/disasters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.errors?.join(', ') || result.error || `HTTP ${response.status}`);
        }
        return { id: result.disaster_id };
    } catch (error) {
        console.error('Database persistence error:', error);
        showToast('Saved locally, but DB save failed', 'warning');
        return null;
    }
}

async function syncDisastersFromBackend() {
    try {
        const response = await fetch(`${AppConfig.backendApiUrl}/disasters`);
        const result = await response.json();
        if (!response.ok || !result.success || !Array.isArray(result.disasters)) {
            renderDisasterHistory();
            return;
        }

        const normalized = result.disasters.map((d) => {
            const geometry = d.geometry || {};
            const coords = geometry.coordinates?.[0]?.[0] || [0, 0];
            return {
                id: d.id,
                type: String(d.disaster_type || '').toLowerCase(),
                severity: String(d.severity || '').toLowerCase(),
                description: d.description || '',
                latitude: Number(coords[1] || 0),
                longitude: Number(coords[0] || 0),
                radius_km: 5,
                timestamp: d.created_at || new Date().toISOString()
            };
        });

        localStorage.setItem('disasters', JSON.stringify(normalized));
        renderDisasterHistory();
    } catch (error) {
        console.error('Failed to sync disasters from backend:', error);
        renderDisasterHistory();
    }
}

function formatDisasterType(type) {
    const value = String(type || '').replace(/_/g, ' ').trim();
    if (!value) return 'Unknown';
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatSeverity(severity) {
    const value = String(severity || '').trim();
    if (!value) return 'Unknown';
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function renderDisasterHistory() {
    const container = document.getElementById('disaster-history-list');
    if (!container) return;

    const disasters = JSON.parse(localStorage.getItem('disasters') || '[]');
    if (!Array.isArray(disasters) || disasters.length === 0) {
        container.innerHTML = `
            <p style="color: var(--text-secondary); margin: 0;">
                No reported disasters yet. Submit a disaster to build history.
            </p>
        `;
        return;
    }

    container.innerHTML = disasters.slice(0, 20).map((d) => {
        const type = formatDisasterType(d.type || d.disaster_type);
        const severity = formatSeverity(d.severity);
        const ts = new Date(d.timestamp || d.created_at || Date.now());
        const when = Number.isNaN(ts.getTime()) ? 'Unknown time' : ts.toLocaleString();
        const lat = Number(d.latitude || 0);
        const lon = Number(d.longitude || 0);
        const radius = Number(d.radius_km || 5);
        const desc = String(d.description || '').trim();
        const shortDesc = desc.length > 90 ? `${desc.slice(0, 90)}...` : desc;

        return `
            <div
                style="width: 100%; text-align: left; border: 1px solid var(--border-color); background: var(--bg-secondary); border-radius: 10px; padding: 0.75rem; margin-bottom: 0.75rem;">
                <div style="display: flex; justify-content: space-between; gap: 0.75rem; align-items: center;">
                    <strong style="color: var(--text-primary);">${type}</strong>
                    <span style="font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 999px; background: rgba(239,68,68,0.15); color: var(--danger);">${severity}</span>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.35rem;">
                    <i class="fas fa-map-marker-alt"></i> ${lat.toFixed(4)}, ${lon.toFixed(4)} | ${radius} km
                </div>
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">
                    <i class="fas fa-clock"></i> ${when}
                </div>
                ${shortDesc ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">${shortDesc}</div>` : ''}
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem;">
                    <button type="button" class="btn-secondary" onclick="selectHistoryDisaster('${String(d.id)}')">
                        <i class="fas fa-hospital"></i> Load Facilities
                    </button>
                    <button type="button" class="btn-primary" onclick="viewHistoryDisasterOnMap('${String(d.id)}')">
                        <i class="fas fa-map"></i> View on Map
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function selectHistoryDisaster(disasterId) {
    const disasters = JSON.parse(localStorage.getItem('disasters') || '[]');
    const selected = disasters.find(d => String(d.id) === String(disasterId));
    if (!selected) {
        showToast('Selected disaster not found', 'warning');
        return;
    }

    const lat = Number(selected.latitude);
    const lon = Number(selected.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        showToast('Invalid disaster coordinates', 'error');
        return;
    }

    document.getElementById('latitude').value = lat.toFixed(4);
    document.getElementById('longitude').value = lon.toFixed(4);
    document.getElementById('radius').value = Number(selected.radius_km || 5);
    loadEnhancedIntelligence();

    loadNearbyFacilities(lat, lon, {
        targetContainerId: 'history-facilities-result',
        title: `Nearby Facilities for Disaster #${selected.id}`
    });
}

function viewHistoryDisasterOnMap(disasterId) {
    const disasters = JSON.parse(localStorage.getItem('disasters') || '[]');
    const selected = disasters.find(d => String(d.id) === String(disasterId));
    if (!selected) {
        showToast('Selected disaster not found', 'warning');
        return;
    }

    const lat = Number(selected.latitude);
    const lon = Number(selected.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        showToast('Invalid disaster coordinates', 'error');
        return;
    }

    const disasterData = {
        id: selected.id,
        lat,
        lon,
        type: selected.type || selected.disaster_type || '',
        severity: selected.severity || '',
        radius: Number(selected.radius_km || 5),
        description: selected.description || '',
        timestamp: selected.timestamp || new Date().toISOString()
    };

    localStorage.setItem('viewDisaster', JSON.stringify(disasterData));
    window.location.href = 'map-new.html';
}

async function loadEnhancedIntelligence() {
    const container = document.getElementById('enhanced-intelligence');
    if (!container) return;

    const lat = parseFloat(document.getElementById('latitude').value);
    const lon = parseFloat(document.getElementById('longitude').value);
    const radius = parseFloat(document.getElementById('radius').value || '5');

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        container.innerHTML = '<p style="color: var(--text-secondary); margin: 0;">Set location to preview enhanced intelligence.</p>';
        return;
    }

    container.innerHTML = '<p style="color: var(--text-secondary); margin: 0;">Loading enhanced intelligence...</p>';

    try {
        const [populationRes, seismicRes, floodRes] = await Promise.all([
            fetch(`${AppConfig.backendApiUrl}/v2/population?lat=${lat}&lon=${lon}&radius=${radius}`),
            fetch(`${AppConfig.backendApiUrl}/v2/seismic-risk?lat=${lat}&lon=${lon}&radius=${Math.max(20, radius * 4)}`),
            fetch(`${AppConfig.backendApiUrl}/v2/flood-risk?lat=${lat}&lon=${lon}&radius=${Math.max(10, radius * 2)}`)
        ]);

        const population = await populationRes.json().catch(() => ({}));
        const seismic = await seismicRes.json().catch(() => ({}));
        const flood = await floodRes.json().catch(() => ({}));

        const popValue = population?.success ? Number(population.population || 0).toLocaleString() : 'Unavailable';
        const popAcc = population?.accuracy || 'N/A';
        const seismicLevel = seismic?.success ? (seismic.risk?.risk_level || 'UNKNOWN') : 'Unavailable';
        const eqCount = seismic?.success ? (seismic.risk?.total_earthquakes || 0) : 0;
        const highFlood = flood?.success ? (flood.high_risk_count || 0) : 'Unavailable';
        const floodCount = flood?.success ? (flood.count || 0) : 0;

        container.innerHTML = `
            <div class="info-list">
                <div class="info-item">
                    <span class="info-label"><i class="fas fa-users"></i> Population in Radius</span>
                    <span class="info-value">${popValue}</span>
                </div>
                <div class="info-item">
                    <span class="info-label"><i class="fas fa-bullseye"></i> Population Accuracy</span>
                    <span class="info-value">${popAcc}</span>
                </div>
                <div class="info-item">
                    <span class="info-label"><i class="fas fa-house-damage"></i> Seismic Risk</span>
                    <span class="info-value">${seismicLevel}</span>
                </div>
                <div class="info-item">
                    <span class="info-label"><i class="fas fa-wave-square"></i> Earthquake History</span>
                    <span class="info-value">${eqCount}</span>
                </div>
                <div class="info-item">
                    <span class="info-label"><i class="fas fa-water"></i> Flood-Risk Zones</span>
                    <span class="info-value">${floodCount}</span>
                </div>
                <div class="info-item">
                    <span class="info-label"><i class="fas fa-exclamation-triangle"></i> High Flood-Risk</span>
                    <span class="info-value">${highFlood}</span>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Enhanced intelligence error:', error);
        container.innerHTML = '<p style="color: var(--text-secondary); margin: 0;">Enhanced data unavailable right now.</p>';
    }
}

// Display disaster result
function displayDisasterResult(result, requested = null) {
    const resultDiv = document.getElementById('disaster-result');
    const displayType = requested?.disaster_type || result.details.type;
    const displaySeverity = requested?.severity || result.details.severity;
    
    const html = `
        <div class="result-card success">
            <div class="result-header">
                <div class="result-icon success">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div>
                    <div class="result-title">Emergency Response Activated</div>
                    <div style="color: var(--text-secondary); font-size: 0.875rem;">
                        Disaster ID: ${result.disaster_id}
                    </div>
                </div>
            </div>
            
            <div class="result-details">
                <div class="result-detail">
                    <span class="result-detail-label">Type</span>
                    <span class="result-detail-value">${String(displayType).toUpperCase()}</span>
                </div>
                <div class="result-detail">
                    <span class="result-detail-label">Severity</span>
                    <span class="result-detail-value">${String(displaySeverity).toUpperCase()}</span>
                </div>
                <div class="result-detail">
                    <span class="result-detail-label">Location</span>
                    <span class="result-detail-value">${result.details.location}</span>
                </div>
                <div class="result-detail">
                    <span class="result-detail-label">Radius</span>
                    <span class="result-detail-value">${result.details.radius}</span>
                </div>
            </div>
            
            ${result.response ? `
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                    <h4 style="margin-bottom: 0.75rem; color: var(--text-primary);">
                        <i class="fas fa-tasks"></i> Response Status
                    </h4>
                    <div class="info-list">
                        <div class="info-item">
                            <span class="info-label">
                                <i class="fas ${result.response.agencies_notified ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                                Agencies Notified
                            </span>
                            <span class="info-value">${result.response.agencies_notified ? 'Yes' : 'No'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">
                                <i class="fas ${result.response.facilities_identified ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                                Facilities Identified
                            </span>
                            <span class="info-value">${result.response.facilities_identified ? 'Yes' : 'No'}</span>
                        </div>
                        ${result.response.facilities ? `
                            <div class="info-item">
                                <span class="info-label">
                                    <i class="fas fa-hospital"></i> Total Facilities
                                </span>
                                <span class="info-value">
                                    ${(result.response.facilities.hospitals || 0) + 
                                      (result.response.facilities.fire_stations || 0) + 
                                      (result.response.facilities.police_stations || 0)}
                                </span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
            
            <!-- Emergency Notifications Sent -->
            <div style="margin-top: 1rem; padding: 1rem; background: linear-gradient(135deg, rgba(67, 233, 123, 0.1), rgba(56, 249, 215, 0.1)); border-radius: 8px; border-left: 4px solid var(--success);">
                <h4 style="margin-bottom: 0.75rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-bell"></i> Emergency Alerts Sent
                </h4>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.875rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-check-circle" style="color: var(--success);"></i>
                        <span><strong>National Disaster Response Force (NDRF)</strong> - Alert dispatched</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-check-circle" style="color: var(--success);"></i>
                        <span><strong>State Emergency Operations Center</strong> - Notification sent</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-check-circle" style="color: var(--success);"></i>
                        <span><strong>Local Police & Fire Departments</strong> - Alert issued</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-check-circle" style="color: var(--success);"></i>
                        <span><strong>Nearby Hospitals</strong> - Emergency standby activated</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-check-circle" style="color: var(--success);"></i>
                        <span><strong>District Administration</strong> - Situation report sent</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-check-circle" style="color: var(--success);"></i>
                        <span><strong>Emergency Services (108/112)</strong> - Coordinates shared</span>
                    </div>
                </div>
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(67, 233, 123, 0.3);">
                    <small style="color: var(--text-secondary);">
                        <i class="fas fa-info-circle"></i> All emergency responders have been notified with disaster location, type, and severity. Response teams are being mobilized.
                    </small>
                </div>
                <button onclick="showNotificationDetails('${result.disaster_id}', '${result.details.type}', '${result.details.severity}', '${result.details.location}')" 
                        style="width: 100%; margin-top: 1rem; padding: 0.625rem; background: white; border: 1px solid var(--success); color: var(--success); border-radius: 6px; cursor: pointer; font-weight: 600;">
                    <i class="fas fa-envelope"></i> View Notification Details
                </button>
            </div>
            
            <div style="margin-top: 1rem; display: flex; gap: 0.75rem;">
                <button class="btn-primary" onclick="viewDisasterOnMap('${result.disaster_id}', ${result.details.location.split(',')[0]}, ${result.details.location.split(',')[1]})">
                    <i class="fas fa-map"></i> View on Map
                </button>
                <button class="btn-secondary" onclick="loadNearbyFacilities(${result.details.location.split(',')[0]}, ${result.details.location.split(',')[1]})">
                    <i class="fas fa-hospital"></i> Load Facilities
                </button>
                <button class="btn-secondary" onclick="window.location.reload()">
                    <i class="fas fa-plus"></i> Report Another
                </button>
            </div>
        </div>
    `;
    
    resultDiv.innerHTML = html;
}

// Display error
function displayError(message) {
    const resultDiv = document.getElementById('disaster-result');
    
    const html = `
        <div class="result-card error">
            <div class="result-header">
                <div class="result-icon error">
                    <i class="fas fa-exclamation-circle"></i>
                </div>
                <div>
                    <div class="result-title">Error</div>
                </div>
            </div>
            <p style="color: var(--text-secondary); margin-top: 1rem;">
                ${message}
            </p>
        </div>
    `;
    
    resultDiv.innerHTML = html;
}

// Load nearby facilities
async function loadNearbyFacilities(lat, lon, options = {}) {
    const targetContainerId = options.targetContainerId || 'disaster-result';
    const title = options.title || 'Nearby Emergency Facilities';
    const resultDiv = document.getElementById(targetContainerId);
    if (!resultDiv) return;
    const appendMode = targetContainerId === 'disaster-result';
    const loadingId = `facilities-loading-${targetContainerId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

    try {
        // Show loading message
        const loadingHtml = `
            <div id="${loadingId}" class="card" style="margin-top: 0;">
                <div class="card-body" style="text-align: center; padding: 2rem;">
                    <div class="spinner" style="margin: 0 auto 1rem;"></div>
                    <p style="color: var(--text-secondary);">Searching for nearby emergency facilities...</p>
                </div>
            </div>
        `;
        if (appendMode) {
            resultDiv.insertAdjacentHTML('beforeend', loadingHtml);
        } else {
            resultDiv.innerHTML = loadingHtml;
        }
        
        const response = await fetch(
            `${AppConfig.apiUrl}/facilities?lat=${lat}&lon=${lon}&radius=15&limit=10`
        );
        const result = await response.json();
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        if (result.success && result.facilities && result.facilities.length > 0) {
            displayFacilities(result.facilities, { targetContainerId, title });
            showToast(`Found ${result.facilities.length} nearby facilities`, 'success');
        } else {
            // Show no facilities message
            const noFacilitiesHtml = `
                <div class="card" style="margin-top: 1.5rem;">
                    <div class="card-header">
                        <h3><i class="fas fa-hospital"></i> ${title}</h3>
                    </div>
                    <div class="card-body">
                        <div class="empty-state">
                            <i class="fas fa-info-circle"></i>
                            <h3>No Facilities Found</h3>
                            <p>No emergency facilities found within 15 km radius. Try searching on the Facilities page with a larger radius.</p>
                            <button class="btn-secondary" onclick="window.location.href='facilities.html'">
                                <i class="fas fa-search"></i> Search Facilities
                            </button>
                        </div>
                    </div>
                </div>
            `;
            if (appendMode) {
                resultDiv.insertAdjacentHTML('beforeend', noFacilitiesHtml);
            } else {
                resultDiv.innerHTML = noFacilitiesHtml;
            }
            showToast('No facilities found nearby', 'info');
        }
    } catch (error) {
        console.error('Error loading facilities:', error);
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        // Show error message
        const errorHtml = `
            <div class="card" style="margin-top: 1.5rem;">
                <div class="card-header">
                    <h3><i class="fas fa-hospital"></i> ${title}</h3>
                </div>
                <div class="card-body">
                    <div class="empty-state">
                        <i class="fas fa-exclamation-circle"></i>
                        <h3>Error Loading Facilities</h3>
                        <p>Unable to load nearby facilities. Please try again or search manually.</p>
                        <button class="btn-secondary" onclick="window.location.href='facilities.html'">
                            <i class="fas fa-search"></i> Search Facilities
                        </button>
                    </div>
                </div>
            </div>
        `;
        if (appendMode) {
            resultDiv.insertAdjacentHTML('beforeend', errorHtml);
        } else {
            resultDiv.innerHTML = errorHtml;
        }
        showToast('Failed to load facilities', 'error');
    }
}

// Display facilities
function displayFacilities(facilities, options = {}) {
    const targetContainerId = options.targetContainerId || 'disaster-result';
    const title = options.title || 'Nearby Emergency Facilities';
    const resultDiv = document.getElementById(targetContainerId);
    if (!resultDiv) return;
    const appendMode = targetContainerId === 'disaster-result';
    
    let facilitiesHtml = `
        <div class="card" style="margin-top: 0;">
            <div class="card-header">
                <h3><i class="fas fa-hospital"></i> ${title}</h3>
            </div>
            <div class="card-body">
    `;
    
    facilities.forEach(facility => {
        const iconClass = facility.type.includes('hospital') ? 'hospital' : 
                         facility.type.includes('fire') ? 'fire' : 'police';
        const icon = iconClass === 'hospital' ? 'fa-hospital' : 
                    iconClass === 'fire' ? 'fa-fire-extinguisher' : 'fa-shield-alt';
        
        facilitiesHtml += `
            <div class="facility-card">
                <div class="facility-header">
                    <div class="facility-icon ${iconClass}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div>
                        <div class="facility-name">${facility.name}</div>
                        <div class="facility-type">${facility.type}</div>
                    </div>
                </div>
                <div class="facility-details">
                    <div class="facility-detail">
                        <strong>Distance:</strong> ${facility.distance_km.toFixed(2)} km
                    </div>
                    ${facility.capacity ? `
                        <div class="facility-detail">
                            <strong>Capacity:</strong> ${facility.capacity}
                        </div>
                    ` : ''}
                    ${facility.status ? `
                        <div class="facility-detail">
                            <strong>Status:</strong> ${facility.status}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    facilitiesHtml += `
            </div>
        </div>
    `;
    
    if (appendMode) {
        resultDiv.insertAdjacentHTML('beforeend', facilitiesHtml);
    } else {
        resultDiv.innerHTML = facilitiesHtml;
    }
}

// Show/hide loading modal
function showLoadingModal(show) {
    const modal = document.getElementById('loading-modal');
    if (show) {
        modal.classList.add('show');
    } else {
        modal.classList.remove('show');
    }
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

// View disaster on map
function viewDisasterOnMap(disasterId, lat, lon) {
    // Store disaster data in localStorage
    const disasterData = {
        id: disasterId,
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        type: document.getElementById('disaster-type').value,
        severity: document.getElementById('severity').value,
        radius: parseFloat(document.getElementById('radius').value),
        description: document.getElementById('description').value,
        timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('viewDisaster', JSON.stringify(disasterData));
    
    // Redirect to map
    window.location.href = 'map-new.html';
}

// Show notification details
function showNotificationDetails(disasterId, type, severity, location) {
    const modal = document.getElementById('notification-modal');
    const content = document.getElementById('notification-content');
    
    const timestamp = new Date().toLocaleString();
    const [lat, lon] = location.split(',').map(s => s.trim());
    
    const notificationHtml = `
        <div style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;">
            <h4 style="margin-bottom: 1rem; color: var(--danger);">
                <i class="fas fa-exclamation-triangle"></i> EMERGENCY ALERT
            </h4>
            <div style="background: white; padding: 1rem; border-radius: 6px; font-family: monospace; font-size: 0.875rem; line-height: 1.8;">
                <strong>DISASTER ID:</strong> ${disasterId}<br>
                <strong>TYPE:</strong> ${type.toUpperCase()}<br>
                <strong>SEVERITY:</strong> ${severity.toUpperCase()}<br>
                <strong>LOCATION:</strong> ${lat}, ${lon}<br>
                <strong>TIME:</strong> ${timestamp}<br>
                <strong>STATUS:</strong> ACTIVE - IMMEDIATE RESPONSE REQUIRED
            </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; border-left: 4px solid var(--danger);">
                <h5 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">
                    <i class="fas fa-shield-alt"></i> National Disaster Response Force (NDRF)
                </h5>
                <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">
                    <strong>Message:</strong> "Emergency ${type} disaster reported at coordinates ${lat}, ${lon}. Severity: ${severity}. Deploy rapid response team immediately. Disaster ID: ${disasterId}"
                </p>
                <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: var(--success);">
                    <i class="fas fa-check-circle"></i> Delivered at ${timestamp}
                </p>
            </div>

            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; border-left: 4px solid var(--info);">
                <h5 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">
                    <i class="fas fa-building"></i> State Emergency Operations Center
                </h5>
                <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">
                    <strong>Message:</strong> "ALERT: ${type.toUpperCase()} disaster (${severity} severity) at ${lat}, ${lon}. Activate state emergency protocol. Coordinate with local authorities. ID: ${disasterId}"
                </p>
                <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: var(--success);">
                    <i class="fas fa-check-circle"></i> Delivered at ${timestamp}
                </p>
            </div>

            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; border-left: 4px solid var(--warning);">
                <h5 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">
                    <i class="fas fa-fire-extinguisher"></i> Local Fire & Police Departments
                </h5>
                <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">
                    <strong>Message:</strong> "EMERGENCY: ${type} disaster in your jurisdiction. Location: ${lat}, ${lon}. Severity: ${severity}. Dispatch units immediately. Ref: ${disasterId}"
                </p>
                <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: var(--success);">
                    <i class="fas fa-check-circle"></i> Delivered at ${timestamp}
                </p>
            </div>

            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; border-left: 4px solid var(--danger);">
                <h5 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">
                    <i class="fas fa-hospital"></i> Nearby Hospitals & Medical Centers
                </h5>
                <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">
                    <strong>Message:</strong> "STANDBY ALERT: ${type} disaster reported nearby (${lat}, ${lon}). Prepare emergency wards and trauma units. Expect casualties. Severity: ${severity}. ID: ${disasterId}"
                </p>
                <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: var(--success);">
                    <i class="fas fa-check-circle"></i> Delivered at ${timestamp}
                </p>
            </div>

            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; border-left: 4px solid var(--primary);">
                <h5 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">
                    <i class="fas fa-user-tie"></i> District Administration
                </h5>
                <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">
                    <strong>Message:</strong> "SITUATION REPORT: ${type.toUpperCase()} disaster at ${lat}, ${lon}. Severity: ${severity}. Coordinate evacuation and relief operations. Disaster ID: ${disasterId}"
                </p>
                <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: var(--success);">
                    <i class="fas fa-check-circle"></i> Delivered at ${timestamp}
                </p>
            </div>

            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; border-left: 4px solid var(--success);">
                <h5 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">
                    <i class="fas fa-phone-alt"></i> Emergency Services (108/112)
                </h5>
                <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">
                    <strong>Message:</strong> "EMERGENCY COORDINATES: ${lat}, ${lon}. ${type.toUpperCase()} disaster. Severity: ${severity}. Route all emergency calls from this area to priority queue. ID: ${disasterId}"
                </p>
                <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: var(--success);">
                    <i class="fas fa-check-circle"></i> Delivered at ${timestamp}
                </p>
            </div>
        </div>

        <div style="margin-top: 1.5rem; padding: 1rem; background: linear-gradient(135deg, rgba(67, 233, 123, 0.1), rgba(56, 249, 215, 0.1)); border-radius: 8px; text-align: center;">
            <i class="fas fa-check-circle" style="font-size: 2rem; color: var(--success); margin-bottom: 0.5rem;"></i>
            <p style="margin: 0; font-weight: 600; color: var(--text-primary);">
                All notifications successfully delivered
            </p>
            <p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: var(--text-secondary);">
                Emergency response teams have been mobilized
            </p>
        </div>
    `;
    
    content.innerHTML = notificationHtml;
    modal.classList.add('show');
}

// Close notification modal
function closeNotificationModal() {
    const modal = document.getElementById('notification-modal');
    modal.classList.remove('show');
}
