/**
 * AEGIS-1 - FRONTEND APP
 * JavaScript for web interface functionality
 */

// Global variables
let systemData = null;
let selectedCoordinates = null;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚨 Disaster Response Dashboard Loading...');
    
    // Load initial system status
    loadSystemStatus();
    
    // Set up form submission
    document.getElementById('disaster-form').addEventListener('submit', handleDisasterSubmission);
    
    console.log('✅ Dashboard Ready');
});

// Load system status from backend
async function loadSystemStatus() {
    const statusDiv = document.getElementById('system-status');
    
    // Show loading state
    statusDiv.innerHTML = `
        <div class="text-center p-4">
            <div class="loading-spinner"></div>
            <p class="mt-2">Loading system status...</p>
        </div>
    `;
    
    try {
        console.log('🔍 Fetching system status...');
        const response = await fetch('/api/status');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        systemData = data;
        
        console.log('✅ System status loaded:', {
            ready: data.system_ready,
            facilities: data.total_facilities
        });
        
        // Display system status
        displaySystemStatus(data);
        
    } catch (error) {
        console.error('❌ Error loading system status:', error);
        statusDiv.innerHTML = `
            <div class="alert alert-danger alert-custom">
                <h5><i class="fas fa-exclamation-triangle"></i> Connection Error</h5>
                <p>Could not connect to the disaster response system.</p>
                <p><strong>Error:</strong> ${error.message}</p>
                <small class="text-muted">Please ensure the backend system is running.</small>
            </div>
        `;
    }
}

// Display system status in the UI
function displaySystemStatus(data) {
    const statusDiv = document.getElementById('system-status');
    
    if (data.error) {
        statusDiv.innerHTML = `
            <div class="alert alert-danger alert-custom">
                <h5><i class="fas fa-exclamation-triangle"></i> System Error</h5>
                <p>${data.error}</p>
                <p>The web interface is running, but the disaster response system could not be loaded.</p>
            </div>
        `;
        return;
    }
    
    const statusIndicator = data.system_ready ? 'status-operational' : 'status-error';
    const statusText = data.system_ready ? 'OPERATIONAL' : 'ERROR';
    const statusIcon = data.system_ready ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
    
    statusDiv.innerHTML = `
        <div class="status-grid">
            <div class="stat-card">
                <div class="stat-number">${data.total_facilities.toLocaleString()}</div>
                <div class="stat-label">Total Facilities</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.districts_covered}</div>
                <div class="stat-label">Districts Covered</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.historical_disasters.toLocaleString()}</div>
                <div class="stat-label">Historical Disasters</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.active_disasters}</div>
                <div class="stat-label">Active Disasters</div>
            </div>
        </div>
        
        <div class="alert ${data.system_ready ? 'alert-success' : 'alert-danger'} alert-custom">
            <h5>
                <span class="system-status-indicator ${statusIndicator}"></span>
                <i class="${statusIcon}"></i> System ${statusText}
            </h5>
            <p><strong>Status:</strong> ${data.system_ready ? 'Ready for emergency response operations' : 'System not ready'}</p>
            <div class="row mt-3">
                <div class="col-4">
                    <small><strong>Hospitals:</strong> ${data.hospitals?.toLocaleString() || 'N/A'}</small>
                </div>
                <div class="col-4">
                    <small><strong>Fire Stations:</strong> ${data.fire_stations?.toLocaleString() || 'N/A'}</small>
                </div>
                <div class="col-4">
                    <small><strong>Police Stations:</strong> ${data.police_stations?.toLocaleString() || 'N/A'}</small>
                </div>
            </div>
            <hr>
            <small class="text-muted">Last Updated: ${new Date(data.last_updated).toLocaleString()}</small>
        </div>
    `;
}

// Handle disaster form submission
async function handleDisasterSubmission(event) {
    event.preventDefault();
    
    const resultDiv = document.getElementById('disaster-result');
    const submitBtn = event.target.querySelector('button[type="submit"]');
    
    // Show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="loading-spinner"></div> Creating Disaster Event...';
    
    resultDiv.innerHTML = `
        <div class="alert alert-info alert-custom mt-3">
            <div class="loading-spinner"></div> Creating disaster event and activating emergency response...
        </div>
    `;
    
    // Collect form data
    const formData = {
        disaster_type: document.getElementById('disaster-type').value,
        latitude: parseFloat(document.getElementById('latitude').value),
        longitude: parseFloat(document.getElementById('longitude').value),
        severity: document.getElementById('severity').value,
        radius_km: parseFloat(document.getElementById('radius').value),
        description: document.getElementById('description').value
    };
    
    try {
        console.log('🚨 Creating disaster event:', formData);
        
        const response = await fetch('/api/create_disaster', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Disaster created successfully:', result.disaster_id);
            
            resultDiv.innerHTML = `
                <div class="alert alert-success alert-custom mt-3">
                    <h5><i class="fas fa-check-circle"></i> EMERGENCY RESPONSE ACTIVATED!</h5>
                    <div class="row">
                        <div class="col-md-6">
                            <p><strong>Disaster ID:</strong> <code>${result.disaster_id}</code></p>
                            <p><strong>Type:</strong> ${result.details.type}</p>
                            <p><strong>Severity:</strong> ${result.details.severity}</p>
                        </div>
                        <div class="col-md-6">
                            <p><strong>Location:</strong> ${result.details.location}</p>
                            <p><strong>Affected Radius:</strong> ${result.details.radius}</p>
                        </div>
                    </div>
                    <hr>
                    <div class="row">
                        <div class="col-12">
                            <h6><i class="fas fa-tasks"></i> Emergency Protocol Status:</h6>
                            <div class="row">
                                <div class="col-md-6">
                                    <small>${result.response?.agencies_notified ? '✅' : '❌'} Agencies notified: ${result.response?.agencies_notified ? 'YES' : 'NO'}</small><br>
                                    <small>${result.response?.facilities_identified ? '✅' : '❌'} Facilities identified: ${result.response?.facilities?.hospitals || 0} hospitals, ${result.response?.facilities?.fire_stations || 0} fire stations, ${result.response?.facilities?.police_stations || 0} police stations</small>
                                </div>
                                <div class="col-md-6">
                                    <small>${result.response?.population_assessed ? '✅' : '❌'} Population assessed: ${(result.response?.affected_population || 0).toLocaleString()} people affected</small><br>
                                    <small>${result.response?.coordination_initiated ? '✅' : '❌'} Coordination initiated: ${result.response?.facilities?.total_capacity || 0} total facility capacity</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Reset form
            document.getElementById('disaster-form').reset();
            
            // Refresh system status after a short delay
            setTimeout(() => {
                loadSystemStatus();
            }, 2000);
            
        } else {
            console.error('❌ Error creating disaster:', result.error);
            
            resultDiv.innerHTML = `
                <div class="alert alert-danger alert-custom mt-3">
                    <h5><i class="fas fa-exclamation-triangle"></i> Error Creating Disaster Event</h5>
                    <p>${result.error}</p>
                    <small class="text-muted">Please check your input and try again.</small>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('❌ Network error creating disaster:', error);
        
        resultDiv.innerHTML = `
            <div class="alert alert-danger alert-custom mt-3">
                <h5><i class="fas fa-exclamation-triangle"></i> Network Error</h5>
                <p>Could not create disaster event due to a network error.</p>
                <p><strong>Error:</strong> ${error.message}</p>
                <small class="text-muted">Please check your connection and try again.</small>
            </div>
        `;
    } finally {
        // Reset submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ACTIVATE EMERGENCY RESPONSE PROTOCOL';
    }
}

// Set coordinates from quick selection
function setCoordinates(lat, lon, cityName) {
    document.getElementById('latitude').value = lat;
    document.getElementById('longitude').value = lon;
    document.getElementById('description').value = `Emergency situation in ${cityName} requiring immediate response and coordination`;
    
    selectedCoordinates = { lat, lon, city: cityName };
    
    // Visual feedback - highlight selected coordinate card
    document.querySelectorAll('.coordinate-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.target.closest('.coordinate-card').classList.add('selected');
    
    console.log(`📍 Coordinates set for ${cityName}: ${lat}, ${lon}`);
}

// Find nearby facilities
async function findNearbyFacilities() {
    const lat = document.getElementById('latitude').value;
    const lon = document.getElementById('longitude').value;
    const resultDiv = document.getElementById('facilities-result');
    
    if (!lat || !lon) {
        resultDiv.innerHTML = `
            <div class="alert alert-warning alert-custom">
                <i class="fas fa-exclamation-triangle"></i> Please enter latitude and longitude coordinates first.
            </div>
        `;
        return;
    }
    
    // Show loading state
    resultDiv.innerHTML = `
        <div class="text-center p-4">
            <div class="loading-spinner"></div>
            <p class="mt-2">Finding emergency facilities near ${lat}, ${lon}...</p>
        </div>
    `;
    
    try {
        console.log(`🏥 Finding facilities near ${lat}, ${lon}`);
        
        const response = await fetch(`/api/facilities?lat=${lat}&lon=${lon}&radius=15&limit=10`);
        const result = await response.json();
        
        if (result.success && result.facilities.length > 0) {
            console.log(`✅ Found ${result.facilities.length} facilities`);
            
            let facilitiesHtml = `
                <div class="alert alert-success alert-custom">
                    <h6><i class="fas fa-map-marker-alt"></i> Found ${result.facilities.length} Emergency Facilities</h6>
                    <small>Within 15km of coordinates ${lat}, ${lon}</small>
                </div>
            `;
            
            result.facilities.forEach((facility, index) => {
                facilitiesHtml += `
                    <div class="facility-item">
                        <div class="facility-name">
                            ${index + 1}. ${facility.name}
                        </div>
                        <div class="facility-details">
                            <div class="row">
                                <div class="col-md-6">
                                    <small><strong>Type:</strong> ${facility.type}</small><br>
                                    <small><strong>Distance:</strong> ${facility.distance}</small>
                                </div>
                                <div class="col-md-6">
                                    <small><strong>Capacity:</strong> ${facility.capacity}</small><br>
                                    <small><strong>Status:</strong> ${facility.status}</small>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            resultDiv.innerHTML = facilitiesHtml;
            
        } else if (result.success && result.facilities.length === 0) {
            resultDiv.innerHTML = `
                <div class="alert alert-warning alert-custom">
                    <h6><i class="fas fa-search"></i> No Facilities Found</h6>
                    <p>No emergency facilities found within 15km of the specified coordinates.</p>
                    <small class="text-muted">Try expanding the search radius or check different coordinates.</small>
                </div>
            `;
        } else {
            throw new Error(result.error || 'Unknown error occurred');
        }
        
    } catch (error) {
        console.error('❌ Error finding facilities:', error);
        
        resultDiv.innerHTML = `
            <div class="alert alert-danger alert-custom">
                <h6><i class="fas fa-exclamation-triangle"></i> Error Finding Facilities</h6>
                <p>Could not retrieve emergency facilities data.</p>
                <p><strong>Error:</strong> ${error.message}</p>
                <small class="text-muted">Please check your coordinates and try again.</small>
            </div>
        `;
    }
}

// Utility functions
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-custom position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-triangle' : 'info-circle'}"></i>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Export functions for global access
window.loadSystemStatus = loadSystemStatus;
window.setCoordinates = setCoordinates;
window.findNearbyFacilities = findNearbyFacilities;