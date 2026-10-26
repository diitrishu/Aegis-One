/**
 * Mobile GPS Tracker - Emergency Response Unit
 */

const CONFIG = {
    WEBSOCKET_URL: 'http://localhost:5052',  // Updated port
    UPDATE_INTERVAL: 3000,
    MAX_BUFFER_SIZE: 100,
    RECONNECT_DELAY: 3000
};

let socket = null;
let selectedRole = null;
let unitName = null;
let gpsWatchId = null;
let updateCount = 0;
let locationBuffer = [];
let isTracking = false;

function selectRole(role) {
    selectedRole = role;
    
    // Update UI
    document.querySelectorAll('.role-button').forEach(btn => {
        btn.classList.remove('selected');
    });
    event.target.closest('.role-button').classList.add('selected');
}

function startTracking() {
    unitName = document.getElementById('unit-name').value.trim();
    
    // Validation
    if (!selectedRole) {
        alert('Please select your role');
        return;
    }
    
    if (!unitName) {
        alert('Please enter your unit name/ID');
        return;
    }
    
    // Save to localStorage
    localStorage.setItem('tracker_role', selectedRole);
    localStorage.setItem('tracker_unit_name', unitName);
    
    // Switch screens
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('tracking-screen').classList.remove('hidden');
    
    // Update tracking subtitle
    const roleLabel = {
        police: 'Police',
        ambulance: 'Ambulance',
        fire: 'Fire',
        rescue: 'Rescue'
    };
    document.getElementById('tracking-subtitle').textContent =
        `${roleLabel[selectedRole] || 'Unit'} - ${unitName}`;
    
// Start GPS and WebSocket
    initializeWebSocket();
    startGPS();
    
    isTracking = true;
    addLog('Tracking started', 'success');
}

function stopTracking() {
    if (confirm('Stop tracking and disconnect?')) {
        // Stop GPS
        if (gpsWatchId) {
            navigator.geolocation.clearWatch(gpsWatchId);
            gpsWatchId = null;
        }
        
        // Disconnect WebSocket
        if (socket) {
            socket.disconnect();
            socket = null;
        }
        
        isTracking = false;
        addLog('Tracking stopped', 'info');
        
        // Reset and go back to setup
        setTimeout(() => {
            location.reload();
        }, 1000);
    }
}

function initializeWebSocket() {
    addLog('Connecting to server...', 'info');
    
    socket = io(CONFIG.WEBSOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: CONFIG.RECONNECT_DELAY,
        reconnectionAttempts: Infinity
    });
    
    socket.on('connect', () => {
        updateConnectionStatus('Connected', 'active');
        addLog('Connected to server', 'success');
        
        // Send buffered locations
        if (locationBuffer.length > 0) {
            addLog(`Sending ${locationBuffer.length} buffered locations`, 'info');
            locationBuffer.forEach(loc => {
                sendLocationUpdate(loc.lat, loc.lon, loc.speed, loc.heading);
            });
            locationBuffer = [];
        }
    });
    
    socket.on('disconnect', () => {
        updateConnectionStatus('Disconnected', 'error');
        addLog('Disconnected from server', 'error');
    });
    
    socket.on('reconnecting', (attemptNumber) => {
        updateConnectionStatus('Reconnecting...', 'warning');
        addLog(`Reconnecting (attempt ${attemptNumber})`, 'info');
    });
    
    socket.on('connection_status', (data) => {
        addLog(`Session ID: ${data.session_id}`, 'info');
    });
    
    socket.on('registration_success', (data) => {
        addLog(`Registered as ${data.unit_name} (${data.role})`, 'success');
    });
    
    socket.on('update_confirmed', (data) => {
        updateCount++;
        document.getElementById('update-count').textContent = updateCount;
    });
    
    socket.on('error', (data) => {
        addLog(`Error: ${data.message}`, 'error');
    });
}

function startGPS() {
    if (!navigator.geolocation) {
        addLog('GPS not supported by browser', 'error');
        updateGPSStatus('Not Supported', 'error');
        return;
    }
    
    updateGPSStatus('Requesting...', 'warning');
    addLog('Requesting GPS permission...', 'info');
    
    gpsWatchId = navigator.geolocation.watchPosition(
        handleGPSSuccess,
        handleGPSError,
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

function handleGPSSuccess(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const speed = position.coords.speed ? (position.coords.speed * 3.6) : null; // m/s to km/h
    const heading = position.coords.heading;
    
    // Update UI
    updateGPSStatus('Active', 'active');
    document.getElementById('current-lat').textContent = lat.toFixed(6);
    document.getElementById('current-lon').textContent = lon.toFixed(6);
    document.getElementById('current-speed').textContent = speed ? speed.toFixed(1) : '--';
    
    // Send to server
    if (socket && socket.connected) {
        sendLocationUpdate(lat, lon, speed, heading);
    } else {
        // Buffer location if disconnected
        if (locationBuffer.length < CONFIG.MAX_BUFFER_SIZE) {
            locationBuffer.push({ lat, lon, speed, heading });
            addLog('Location buffered (offline)', 'info');
        }
    }
}

function handleGPSError(error) {
    let message = 'GPS Error';
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = 'Permission Denied';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Position Unavailable';
            break;
        case error.TIMEOUT:
            message = 'Timeout';
            break;
    }
    
    updateGPSStatus(message, 'error');
    addLog(`GPS Error: ${message}`, 'error');
}

function sendLocationUpdate(lat, lon, speed, heading) {
    if (!socket || !socket.connected) {
        return;
    }
    
    // First update - register unit
    if (updateCount === 0) {
        socket.emit('register_unit', {
            role: selectedRole,
            unit_name: unitName,
            latitude: lat,
            longitude: lon,
            speed: speed,
            heading: heading
        });
    } else {
        // Subsequent updates
        socket.emit('location_update', {
            latitude: lat,
            longitude: lon,
            speed: speed,
            heading: heading
        });
    }
}

function updateGPSStatus(status, type) {
    const element = document.getElementById('gps-status');
    element.textContent = status;
    element.className = `status-value ${type}`;
}

function updateConnectionStatus(status, type) {
    const element = document.getElementById('connection-status');
    element.textContent = status;
    element.className = `status-value ${type}`;
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

// Load saved session on page load
window.addEventListener('DOMContentLoaded', () => {
    const savedRole = localStorage.getItem('tracker_role');
    const savedUnitName = localStorage.getItem('tracker_unit_name');
    
    if (savedRole && savedUnitName) {
        document.getElementById('unit-name').value = savedUnitName;
        // Auto-select saved role
        const roleButton = document.querySelector(`.role-button[onclick*="${savedRole}"]`);
        if (roleButton) {
            roleButton.classList.add('selected');
            selectedRole = savedRole;
        }
    }
});

// Prevent accidental page close while tracking
window.addEventListener('beforeunload', (e) => {
    if (isTracking) {
        e.preventDefault();
        e.returnValue = '';
    }
});
