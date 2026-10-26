/**
 * Modern Facilities Page JavaScript
 */

let searchMap = null;
let searchMarker = null;
let searchMapVisible = false;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('search-form').addEventListener('submit', handleSearch);
});

// Search location quick action
function searchLocation(lat, lon, name) {
    document.getElementById('search-lat').value = lat;
    document.getElementById('search-lon').value = lon;
    showToast(`Searching facilities near ${name}`, 'info');
    
    // Update map marker if map is visible
    if (searchMap && searchMarker) {
        searchMarker.setLatLng([lat, lon]);
        searchMap.setView([lat, lon], 12);
    }
    
    setTimeout(() => {
        document.getElementById('search-form').dispatchEvent(new Event('submit'));
    }, 500);
}

// Toggle search map
function toggleSearchMap() {
    const wrapper = document.getElementById('search-map-wrapper');
    const toggleText = document.getElementById('search-map-toggle-text');
    
    searchMapVisible = !searchMapVisible;
    
    if (searchMapVisible) {
        wrapper.classList.add('show');
        toggleText.textContent = 'Hide Map';
        
        // Initialize map if not already done
        if (!searchMap) {
            initSearchMap();
        }
        
        // If coordinates are already filled, show marker
        const lat = parseFloat(document.getElementById('search-lat').value);
        const lon = parseFloat(document.getElementById('search-lon').value);
        if (lat && lon) {
            updateSearchMarker(lat, lon);
            searchMap.setView([lat, lon], 12);
        }
    } else {
        wrapper.classList.remove('show');
        toggleText.textContent = 'Select Location on Map';
    }
}

// Initialize search map
function initSearchMap() {
    // Create map
    searchMap = L.map('search-map').setView(AppConfig.mapCenter, AppConfig.zoomLevel);
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(searchMap);
    
    // Add click handler
    searchMap.on('click', function(e) {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;
        
        // Update form fields
        document.getElementById('search-lat').value = lat.toFixed(4);
        document.getElementById('search-lon').value = lon.toFixed(4);
        
        // Update marker
        updateSearchMarker(lat, lon);
        
        showToast(`Location selected: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, 'success');
    });
    
    // Add reference cities
    addReferenceCities();
}

// Update search marker
function updateSearchMarker(lat, lon) {
    if (searchMarker) {
        searchMap.removeLayer(searchMarker);
    }
    
    searchMarker = L.marker([lat, lon], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(searchMap);
    
    searchMarker.bindPopup(`
        <div style="padding: 0.5rem;">
            <strong>Search Location</strong><br>
            Lat: ${lat.toFixed(4)}<br>
            Lon: ${lon.toFixed(4)}
        </div>
    `).openPopup();
}

// Add reference cities
function addReferenceCities() {
    const cities = [
        { name: 'Lucknow', lat: 26.8467, lon: 80.9462 },
        { name: 'Delhi', lat: 28.6139, lon: 77.2090 },
        { name: 'Kanpur', lat: 26.4499, lon: 80.3319 },
        { name: 'Agra', lat: 27.1767, lon: 78.0081 }
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
        }).addTo(searchMap);
        
        marker.bindPopup(`
            <div style="padding: 0.5rem;">
                <strong>${city.name}</strong><br>
                <small>${city.lat.toFixed(4)}, ${city.lon.toFixed(4)}</small><br>
                <button onclick="searchLocation(${city.lat}, ${city.lon}, '${city.name}')" 
                        style="margin-top: 0.5rem; padding: 0.25rem 0.75rem; background: linear-gradient(135deg, var(--primary), var(--secondary)); color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Search Here
                </button>
            </div>
        `);
    });
}

// Use current GPS location for search
function useMyLocationSearch() {
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser', 'error');
        return;
    }
    
    showToast('Getting your location...', 'info');
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            document.getElementById('search-lat').value = lat.toFixed(4);
            document.getElementById('search-lon').value = lon.toFixed(4);
            
            // Update map if visible
            if (searchMap && searchMapVisible) {
                updateSearchMarker(lat, lon);
                searchMap.setView([lat, lon], 14);
            } else if (!searchMapVisible) {
                // Show map with current location
                toggleSearchMap();
                setTimeout(() => {
                    updateSearchMarker(lat, lon);
                    searchMap.setView([lat, lon], 14);
                }, 500);
            }
            
            showToast(`Location detected: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, 'success');
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

// Handle search form submission
async function handleSearch(e) {
    e.preventDefault();
    
    const lat = parseFloat(document.getElementById('search-lat').value);
    const lon = parseFloat(document.getElementById('search-lon').value);
    const type = document.getElementById('facility-type').value;
    const radius = parseInt(document.getElementById('search-radius').value);
    
    // Show loading
    showLoadingModal(true);
    
    try {
        let url = `${AppConfig.apiUrl}/facilities?lat=${lat}&lon=${lon}&radius=${radius}&limit=20`;
        if (type) {
            url += `&type=${type}`;
        }
        
        const response = await fetch(url);
        const result = await response.json();
        
        showLoadingModal(false);
        
        if (result.success) {
            displayFacilities(result.facilities);
            showToast(`Found ${result.facilities.length} facilities`, 'success');
        } else {
            displayError('No facilities found');
            showToast('No facilities found', 'info');
        }
    } catch (error) {
        console.error('Error searching facilities:', error);
        showLoadingModal(false);
        displayError('Failed to search facilities');
        showToast('Search failed', 'error');
    }
}

// Display facilities
function displayFacilities(facilities) {
    const resultsSection = document.getElementById('results-section');
    const facilitiesList = document.getElementById('facilities-list');
    const resultsCount = document.getElementById('results-count');
    
    resultsSection.style.display = 'block';
    resultsCount.textContent = `${facilities.length} facilities found`;
    
    if (facilities.length === 0) {
        facilitiesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>No Facilities Found</h3>
                <p>Try adjusting your search parameters or increasing the search radius</p>
            </div>
        `;
        return;
    }
    
    let html = '<div class="grid-2">';
    
    facilities.forEach(facility => {
        const iconClass = getFacilityIconClass(facility.type);
        const icon = getFacilityIcon(facility.type);
        
        html += `
            <div class="facility-card">
                <div class="facility-header">
                    <div class="facility-icon ${iconClass}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div style="flex: 1;">
                        <div class="facility-name">${facility.name || 'Unnamed Facility'}</div>
                        <div class="facility-type">${formatFacilityType(facility.type)}</div>
                    </div>
                </div>
                <div class="facility-details">
                    <div class="facility-detail">
                        <i class="fas fa-map-marker-alt"></i>
                        <strong>Distance:</strong> ${facility.distance_km ? facility.distance_km.toFixed(2) : 'N/A'} km
                    </div>
                    ${facility.capacity ? `
                        <div class="facility-detail">
                            <i class="fas fa-bed"></i>
                            <strong>Capacity:</strong> ${facility.capacity}
                        </div>
                    ` : ''}
                    ${facility.status ? `
                        <div class="facility-detail">
                            <i class="fas fa-info-circle"></i>
                            <strong>Status:</strong> ${facility.status}
                        </div>
                    ` : ''}
                    ${facility.latitude && facility.longitude ? `
                        <div class="facility-detail" style="grid-column: 1 / -1;">
                            <i class="fas fa-location-arrow"></i>
                            <strong>Coordinates:</strong> ${facility.latitude.toFixed(4)}, ${facility.longitude.toFixed(4)}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    facilitiesList.innerHTML = html;
}

// Display error
function displayError(message) {
    const resultsSection = document.getElementById('results-section');
    const facilitiesList = document.getElementById('facilities-list');
    
    resultsSection.style.display = 'block';
    facilitiesList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-circle"></i>
            <h3>Error</h3>
            <p>${message}</p>
        </div>
    `;
}

// Get facility icon class
function getFacilityIconClass(type) {
    if (type.toLowerCase().includes('hospital')) return 'hospital';
    if (type.toLowerCase().includes('fire')) return 'fire';
    if (type.toLowerCase().includes('police')) return 'police';
    return 'hospital';
}

// Get facility icon
function getFacilityIcon(type) {
    if (type.toLowerCase().includes('hospital')) return 'fa-hospital';
    if (type.toLowerCase().includes('fire')) return 'fa-fire-extinguisher';
    if (type.toLowerCase().includes('police')) return 'fa-shield-alt';
    return 'fa-building';
}

// Format facility type
function formatFacilityType(type) {
    return type.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
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
