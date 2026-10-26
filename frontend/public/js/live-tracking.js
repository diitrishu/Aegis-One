/**
 * Live Tracking Dashboard - Emergency Response
 */

const CONFIG = {
    WEBSOCKET_URL: 'http://localhost:5052',  // Updated port
    MAP_CENTER: [26.8467, 80.9462],
    MAP_ZOOM: 7,
    STALE_THRESHOLD: 60000
};

let socket = null;
let map = null;
let markers = {};
let units = {};
let activeFilters = {
    police: true,
    ambulance: true,
    fire: true,
    rescue: true
};

const roleIcons = {
    police: '🚓',
    ambulance: '🚑',
    fire: '🚒',
    rescue: '🚁'
};

const roleColors = {
    police: '#3b82f6',
    ambulance: '#ef4444',
    fire: '#f59e0b',
    rescue: '#10b981'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initWebSocket();
});

function initMap() {
    map = L.map('map').setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    console.log('✅ Map initialized');
}

function initWebSocket() {
    updateConnectionStatus('connecting');
    
    socket = io(CONFIG.WEBSOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 3000,
        reconnectionAttempts: Infinity
    });
    
    socket.on('connect', () => {
        updateConnectionStatus('connected');
        addLog('Connected to tracking server', 'online');
        
        // Request all active units
        socket.emit('request_all_units');
    });
    
    socket.on('disconnect', () => {
        updateConnectionStatus('disconnected');
        addLog('Disconnected from server', 'offline');
    });
    
    socket.on('unit_online', (data) => {
        addUnit(data);
        addLog(`${data.unit_name} (${data.role}) came online`, 'online');
    });
    
    socket.on('location_broadcast', (data) => {
        updateUnit(data);
    });
    
    socket.on('unit_offline', (data) => {
        removeUnit(data.session_id);
        addLog(`${data.unit_name} went offline`, 'offline');
    });
    
    socket.on('all_units', (data) => {
        data.units.forEach(unit => addUnit(unit));
        addLog(`Loaded ${data.units.length} active units`, 'online');
    });
}

function addUnit(data) {
    const sessionId = data.session_id;
    
    // Store unit data
    units[sessionId] = data;
    
    // Create marker
    const iconHtml = `
        <div style="font-size: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            ${roleIcons[data.role]}
        </div>
    `;
    
    const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
    
    const marker = L.marker([data.latitude, data.longitude], {
        icon: customIcon
    });
    
    marker.bindPopup(createPopupContent(data));
    
    // Add to map if filter is active
    if (activeFilters[data.role]) {
        marker.addTo(map);
    }
    
    markers[sessionId] = marker;
    
    // Update statistics
    updateStatistics();
}

function updateUnit(data) {
    const sessionId = data.session_id;
    
    // Update unit data
    units[sessionId] = data;
    
    // Update marker position
    if (markers[sessionId]) {
        const marker = markers[sessionId];
        const newLatLng = [data.latitude, data.longitude];
        
        // Smooth transition
        marker.setLatLng(newLatLng);
        marker.setPopupContent(createPopupContent(data));
    }
}

function removeUnit(sessionId) {
    // Remove marker
    if (markers[sessionId]) {
        map.removeLayer(markers[sessionId]);
        delete markers[sessionId];
    }
    
    // Remove unit data
    delete units[sessionId];
    
    // Update statistics
    updateStatistics();
}

function createPopupContent(data) {
    const timeSinceUpdate = Date.now() - new Date(data.timestamp).getTime();
    const isActive = timeSinceUpdate < CONFIG.STALE_THRESHOLD;
    const statusClass = isActive ? 'active' : 'idle';
    const statusText = isActive ? 'Active' : 'Idle';
    
    const speed = data.speed ? `${data.speed.toFixed(1)} km/h` : 'N/A';
    const heading = data.heading ? `${data.heading.toFixed(0)}°` : 'N/A';
    
    return `
        <div class="unit-popup">
            <h4>${roleIcons[data.role]} ${data.unit_name}</h4>
            <p><strong>Role:</strong> ${data.role.charAt(0).toUpperCase() + data.role.slice(1)}</p>
            <p><strong>Status:</strong> <span class="status-badge ${statusClass}">${statusText}</span></p>
            <p><strong>Location:</strong> ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}</p>
            <p><strong>Speed:</strong> ${speed}</p>
            <p><strong>Heading:</strong> ${heading}</p>
            <p><strong>Last Update:</strong> ${new Date(data.timestamp).toLocaleTimeString()}</p>
        </div>
    `;
}

function toggleFilter(role) {
    activeFilters[role] = !activeFilters[role];
    
    // Update button state
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        if (btn.textContent.toLowerCase().includes(role)) {
            if (activeFilters[role]) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
    
    // Apply filter to markers
    Object.entries(markers).forEach(([sessionId, marker]) => {
        const unit = units[sessionId];
        if (activeFilters[unit.role]) {
            marker.addTo(map);
        } else {
            map.removeLayer(marker);
        }
    });
}

function updateStatistics() {
    const stats = {
        police: 0,
        ambulance: 0,
        fire: 0,
        rescue: 0
    };
    
    Object.values(units).forEach(unit => {
        stats[unit.role]++;
    });
    
    document.getElementById('stat-police').textContent = stats.police;
    document.getElementById('stat-ambulance').textContent = stats.ambulance;
    document.getElementById('stat-fire').textContent = stats.fire;
    document.getElementById('stat-rescue').textContent = stats.rescue;
}

function updateConnectionStatus(status) {
    const indicator = document.getElementById('connection-indicator');
    
    if (status === 'connected') {
        indicator.className = 'connection-indicator connected';
        indicator.innerHTML = '<i class="fas fa-check-circle"></i><span>Connected</span>';
    } else if (status === 'disconnected') {
        indicator.className = 'connection-indicator disconnected';
        indicator.innerHTML = '<i class="fas fa-times-circle"></i><span>Disconnected</span>';
    } else {
        indicator.className = 'connection-indicator';
        indicator.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i><span>Connecting...</span>';
    }
}

function addLog(message, type = 'info') {
    const logContainer = document.getElementById('activity-log');
    const timestamp = new Date().toLocaleTimeString();
    
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${timestamp}] ${message}`;
    
    logContainer.insertBefore(entry, logContainer.firstChild);
    
    // Keep only last 50 entries
    while (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.lastChild);
    }
}

// Check for stale units periodically
setInterval(() => {
    const now = Date.now();
    Object.entries(units).forEach(([sessionId, unit]) => {
        const timeSinceUpdate = now - new Date(unit.timestamp).getTime();
        if (timeSinceUpdate > CONFIG.STALE_THRESHOLD) {
            // Update popup to show idle status
            if (markers[sessionId]) {
                markers[sessionId].setPopupContent(createPopupContent(unit));
            }
        }
    });
}, 10000); // Check every 10 seconds
