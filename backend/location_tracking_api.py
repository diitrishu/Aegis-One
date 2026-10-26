#!/usr/bin/env python3
"""
Live Location Tracking API - WebSocket Server
Real-time GPS tracking for emergency response units
"""

from flask import Flask, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import logging
import time
from datetime import datetime
import re
from threading import Thread

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Flask app setup
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Configuration
HOST = '0.0.0.0'
PORT = 5052  # Changed from 5051 to avoid conflicts

# Location validation (India region)
LAT_MIN, LAT_MAX = 8.0, 37.0
LON_MIN, LON_MAX = 68.0, 97.0

# Valid roles
VALID_ROLES = ['police', 'ambulance', 'fire', 'rescue']

# Rate limiting
MIN_UPDATE_INTERVAL = 1.0  # seconds

# Stale unit timeout
STALE_THRESHOLD = 60  # seconds
CLEANUP_INTERVAL = 30  # seconds

# In-memory data store
active_units = {}  # {session_id: unit_data}
last_update_time = {}  # {session_id: timestamp}

def validate_location(lat, lon):
    """Validate coordinates are within India region"""
    try:
        lat = float(lat)
        lon = float(lon)
        return (LAT_MIN <= lat <= LAT_MAX) and (LON_MIN <= lon <= LON_MAX)
    except (ValueError, TypeError):
        return False

def sanitize_unit_name(name):
    """Sanitize unit name to alphanumeric, hyphens, underscores"""
    if not name:
        return None
    # Remove any characters that aren't alphanumeric, hyphen, or underscore
    sanitized = re.sub(r'[^a-zA-Z0-9\-_]', '', str(name))
    return sanitized[:50] if sanitized else None  # Max 50 chars

def check_rate_limit(session_id):
    """Check if update is within rate limit"""
    current_time = time.time()
    if session_id in last_update_time:
        time_since_last = current_time - last_update_time[session_id]
        if time_since_last < MIN_UPDATE_INTERVAL:
            return False
    last_update_time[session_id] = current_time
    return True

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    session_id = request.sid
    logger.info(f"Client connected: {session_id}")
    emit('connection_status', {
        'status': 'connected',
        'session_id': session_id
    })

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    session_id = request.sid
    if session_id in active_units:
        unit_data = active_units[session_id]
        logger.info(f"Unit disconnected: {unit_data['unit_name']} ({unit_data['role']})")
        
        # Broadcast unit offline
        emit('unit_offline', {
            'session_id': session_id,
            'unit_name': unit_data['unit_name']
        }, broadcast=True)
        
        # Remove from active units
        del active_units[session_id]
        if session_id in last_update_time:
            del last_update_time[session_id]
    else:
        logger.info(f"Client disconnected: {session_id}")

@socketio.on('register_unit')
def handle_register_unit(data):
    """Register a new emergency unit"""
    session_id = request.sid
    
    try:
        # Validate required fields
        role = data.get('role', '').lower()
        unit_name = sanitize_unit_name(data.get('unit_name'))
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        
        # Validation
        if role not in VALID_ROLES:
            emit('error', {'message': f'Invalid role. Must be one of: {", ".join(VALID_ROLES)}'})
            return
        
        if not unit_name:
            emit('error', {'message': 'Invalid unit name'})
            return
        
        if not validate_location(latitude, longitude):
            emit('error', {'message': 'Invalid location coordinates'})
            return
        
        # Create unit data
        unit_data = {
            'session_id': session_id,
            'role': role,
            'unit_name': unit_name,
            'latitude': float(latitude),
            'longitude': float(longitude),
            'speed': data.get('speed'),
            'heading': data.get('heading'),
            'timestamp': datetime.now().isoformat(),
            'last_update': time.time()
        }
        
        # Store unit
        active_units[session_id] = unit_data
        last_update_time[session_id] = time.time()
        
        logger.info(f"Unit registered: {unit_name} ({role}) at {latitude}, {longitude}")
        
        # Confirm registration
        emit('registration_success', {
            'session_id': session_id,
            'unit_name': unit_name,
            'role': role
        })
        
        # Broadcast to all dashboards
        emit('unit_online', unit_data, broadcast=True)
        
    except Exception as e:
        logger.error(f"Error registering unit: {e}")
        emit('error', {'message': 'Registration failed'})

@socketio.on('location_update')
def handle_location_update(data):
    """Handle location update from unit"""
    session_id = request.sid
    
    try:
        # Check if unit is registered
        if session_id not in active_units:
            emit('error', {'message': 'Unit not registered'})
            return
        
        # Rate limiting
        if not check_rate_limit(session_id):
            return  # Silently drop if too frequent
        
        # Validate location
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        
        if not validate_location(latitude, longitude):
            emit('error', {'message': 'Invalid location coordinates'})
            return
        
        # Update unit data
        unit_data = active_units[session_id]
        unit_data['latitude'] = float(latitude)
        unit_data['longitude'] = float(longitude)
        unit_data['speed'] = data.get('speed')
        unit_data['heading'] = data.get('heading')
        unit_data['timestamp'] = datetime.now().isoformat()
        unit_data['last_update'] = time.time()
        
        # Confirm update
        emit('update_confirmed', {'timestamp': unit_data['timestamp']})
        
        # Broadcast to all dashboards
        emit('location_broadcast', unit_data, broadcast=True)
        
    except Exception as e:
        logger.error(f"Error updating location: {e}")
        emit('error', {'message': 'Location update failed'})

@socketio.on('request_all_units')
def handle_request_all_units():
    """Send list of all active units to requesting client"""
    units_list = list(active_units.values())
    emit('all_units', {'units': units_list})
    logger.info(f"Sent {len(units_list)} active units to client")

def cleanup_stale_units():
    """Background task to remove stale units"""
    while True:
        try:
            current_time = time.time()
            stale_sessions = []
            
            for session_id, unit_data in active_units.items():
                time_since_update = current_time - unit_data['last_update']
                if time_since_update > STALE_THRESHOLD:
                    stale_sessions.append(session_id)
            
            # Remove stale units
            for session_id in stale_sessions:
                unit_data = active_units[session_id]
                logger.info(f"Removing stale unit: {unit_data['unit_name']}")
                
                # Broadcast unit offline
                socketio.emit('unit_offline', {
                    'session_id': session_id,
                    'unit_name': unit_data['unit_name']
                })
                
                del active_units[session_id]
                if session_id in last_update_time:
                    del last_update_time[session_id]
            
            socketio.sleep(CLEANUP_INTERVAL)
            
        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")
            socketio.sleep(CLEANUP_INTERVAL)

@app.route('/health')
def health_check():
    """Health check endpoint"""
    return {
        'status': 'healthy',
        'active_units': len(active_units),
        'timestamp': datetime.now().isoformat()
    }

@app.route('/stats')
def get_stats():
    """Get system statistics"""
    return {
        'active_units': len(active_units),
        'units_by_role': {
            role: len([u for u in active_units.values() if u['role'] == role])
            for role in VALID_ROLES
        },
        'timestamp': datetime.now().isoformat()
    }

if __name__ == '__main__':
    logger.info(f"Starting Location Tracking API on port {PORT}")
    logger.info(f"Valid roles: {', '.join(VALID_ROLES)}")
    logger.info(f"Location bounds: Lat {LAT_MIN}-{LAT_MAX}, Lon {LON_MIN}-{LON_MAX}")
    
    # Start cleanup thread
    cleanup_thread = Thread(target=cleanup_stale_units, daemon=True)
    cleanup_thread.start()
    
    # Start server
    socketio.run(app, host=HOST, port=PORT, debug=False)
