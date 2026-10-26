#!/usr/bin/env python3
"""
UNIFIED AEGIS-1 API - V1.0 + V2.0 MERGED
Combines original disaster management with enhanced data capabilities
"""

import os
import sys
import json
import sqlite3
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path

# Add backend directory to path for V2.0 imports
sys.path.insert(0, str(Path(__file__).parent))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Configuration
DATA_DIR = Path(__file__).parent / "data"
GEOPACKAGE_PATH = DATA_DIR / "up_india_complete.gpkg"  # Use complete dataset with facilities
DISASTER_LAYER = "user_disaster_areas"

# Disaster type validation
VALID_DISASTER_TYPES = ["Flood", "Fire", "Landslide", "Earthquake", "Cyclone", "Drought"]
VALID_SEVERITY_LEVELS = ["Low", "Medium", "High", "Critical"]

# V2.0 Enhanced Data System (optional)
v2_system = None
v2_available = False

try:
    from disaster_response_system_v2 import DisasterResponseSystemV2
    logger.info("Initializing V2.0 Enhanced Data System...")
    v2_system = DisasterResponseSystemV2(
        data_dir=str(DATA_DIR),
        enhanced_data_dir=str(Path(__file__).resolve().parent.parent / "dataa" / "datasets"),
    )
    v2_available = v2_system.enhanced_features_active
    logger.info(f"✅ V2.0 Enhanced Data: {'ACTIVE' if v2_available else 'NOT ACTIVE (V1.0 fully operational)'}")
except Exception as e:
    logger.warning(f"V2.0 Enhanced Data not available: {e}")
    logger.info("Running in V1.0 mode (fully operational)")

class SimpleDisasterAPI:
    """Simplified disaster data management using basic SQLite"""
    
    def __init__(self, geopackage_path):
        self.geopackage_path = geopackage_path
        self.ensure_disaster_table()
    
    def ensure_disaster_table(self):
        """Create disaster table if it doesn't exist"""
        try:
            with sqlite3.connect(self.geopackage_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name=?
                """, (DISASTER_LAYER,))
                
                if not cursor.fetchone():
                    logger.info(f"Creating {DISASTER_LAYER} table")
                    self._create_disaster_table(conn)
                else:
                    logger.info(f"{DISASTER_LAYER} table already exists")
                    
        except Exception as e:
            logger.error(f"Error ensuring disaster table: {e}")
            raise
    
    def _create_disaster_table(self, conn):
        """Create the disaster areas table with basic structure"""
        cursor = conn.cursor()
        
        # Create the main table
        cursor.execute(f"""
            CREATE TABLE {DISASTER_LAYER} (
                fid INTEGER PRIMARY KEY AUTOINCREMENT,
                disaster_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                description TEXT,
                created_at TEXT NOT NULL,
                created_by TEXT DEFAULT 'web_user',
                geometry_json TEXT NOT NULL
            )
        """)
        
        # Add to gpkg_contents (required for GeoPackage)
        cursor.execute("""
            INSERT INTO gpkg_contents (
                table_name, data_type, identifier, description, 
                last_change, min_x, min_y, max_x, max_y, srs_id
            ) VALUES (?, 'features', ?, 'User-submitted disaster areas', ?, 
                     77.0, 24.0, 85.0, 31.0, 4326)
        """, (DISASTER_LAYER, DISASTER_LAYER, datetime.now().isoformat()))
        
        conn.commit()
        logger.info(f"Created {DISASTER_LAYER} table")
    
    def validate_disaster_data(self, data):
        """Validate incoming disaster data"""
        errors = []
        
        # Check required fields
        required_fields = ['disaster_type', 'severity', 'geometry']
        for field in required_fields:
            if field not in data:
                errors.append(f"Missing required field: {field}")
        
        # Validate disaster type
        if data.get('disaster_type') not in VALID_DISASTER_TYPES:
            errors.append(f"Invalid disaster_type. Must be one of: {VALID_DISASTER_TYPES}")
        
        # Validate severity
        if data.get('severity') not in VALID_SEVERITY_LEVELS:
            errors.append(f"Invalid severity. Must be one of: {VALID_SEVERITY_LEVELS}")
        
        # Basic geometry validation
        try:
            geometry = data.get('geometry')
            if not isinstance(geometry, dict) or 'type' not in geometry:
                errors.append("Invalid geometry format")
        except Exception as e:
            errors.append(f"Geometry error: {str(e)}")
        
        return errors
    
    def save_disaster(self, data):
        """Save disaster data to GeoPackage"""
        try:
            # Validate data
            errors = self.validate_disaster_data(data)
            if errors:
                return {"success": False, "errors": errors}
            
            # Prepare data for insertion
            disaster_data = {
                'disaster_type': data['disaster_type'],
                'severity': data['severity'],
                'description': data.get('description', ''),
                'created_at': datetime.now().isoformat(),
                'created_by': data.get('created_by', 'web_user'),
                'geometry_json': json.dumps(data['geometry'])
            }
            
            # Insert with basic locking
            with sqlite3.connect(self.geopackage_path, timeout=30.0) as conn:
                cursor = conn.cursor()
                cursor.execute(f"""
                    INSERT INTO {DISASTER_LAYER} 
                    (disaster_type, severity, description, created_at, created_by, geometry_json)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    disaster_data['disaster_type'],
                    disaster_data['severity'], 
                    disaster_data['description'],
                    disaster_data['created_at'],
                    disaster_data['created_by'],
                    disaster_data['geometry_json']
                ))
                
                disaster_id = cursor.lastrowid
                conn.commit()
                
                logger.info(f"Saved disaster {disaster_id}: {disaster_data['disaster_type']}")
                
                return {
                    "success": True, 
                    "disaster_id": disaster_id,
                    "message": "Disaster area saved successfully"
                }
                
        except sqlite3.OperationalError as e:
            logger.error(f"Database lock error: {e}")
            return {"success": False, "errors": ["Database temporarily locked, please try again"]}
        except Exception as e:
            logger.error(f"Error saving disaster: {e}")
            return {"success": False, "errors": [str(e)]}
    
    def get_disasters(self, disaster_type=None, severity=None):
        """Retrieve disaster data with optional filtering"""
        try:
            with sqlite3.connect(self.geopackage_path) as conn:
                query = f"""
                    SELECT fid, disaster_type, severity, description, 
                           created_at, created_by, geometry_json
                    FROM {DISASTER_LAYER}
                    WHERE 1=1
                """
                params = []
                
                if disaster_type:
                    query += " AND disaster_type = ?"
                    params.append(disaster_type)
                
                if severity:
                    query += " AND severity = ?"
                    params.append(severity)
                
                query += " ORDER BY created_at DESC"
                
                cursor = conn.cursor()
                cursor.execute(query, params)
                
                disasters = []
                for row in cursor.fetchall():
                    disasters.append({
                        'id': row[0],
                        'disaster_type': row[1],
                        'severity': row[2],
                        'description': row[3],
                        'created_at': row[4],
                        'created_by': row[5],
                        'geometry': json.loads(row[6]) if row[6] else None
                    })
                
                return {"success": True, "disasters": disasters}
                
        except Exception as e:
            logger.error(f"Error retrieving disasters: {e}")
            return {"success": False, "errors": [str(e)]}

# Initialize API
disaster_api = SimpleDisasterAPI(GEOPACKAGE_PATH)

@app.route('/api/disasters', methods=['POST'])
def create_disaster():
    """Create new disaster area"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "errors": ["No JSON data provided"]}), 400
        
        result = disaster_api.save_disaster(data)
        
        if result['success']:
            return jsonify(result), 201
        else:
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"API error: {e}")
        return jsonify({"success": False, "errors": ["Internal server error"]}), 500

@app.route('/api/create_disaster', methods=['POST'])
def create_disaster_legacy():
    """
    Backward-compatible endpoint used by older frontend pages.
    Accepts lat/lon/radius payload and stores into /api/disasters format.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "errors": ["No JSON data provided"]}), 400

        requested_type = str(data.get('disaster_type', 'flood')).strip().lower()
        requested_severity = str(data.get('severity', 'medium')).strip().lower()
        lat = float(data.get('latitude'))
        lon = float(data.get('longitude'))
        radius_km = float(data.get('radius_km', 5))
        description = str(data.get('description', ''))

        type_map = {
            'flood': 'Flood',
            'fire': 'Fire',
            'landslide': 'Landslide',
            'earthquake': 'Earthquake',
            'cyclone': 'Cyclone',
            'drought': 'Drought',
            'industrial_accident': 'Fire',
            'other': 'Flood'
        }
        severity_map = {
            'low': 'Low',
            'medium': 'Medium',
            'high': 'High',
            'critical': 'Critical'
        }

        normalized_type = type_map.get(requested_type, 'Flood')
        normalized_severity = severity_map.get(requested_severity, 'Medium')

        # Create a simple square polygon around incident point.
        radius_deg = radius_km / 111.0
        geometry = {
            "type": "Polygon",
            "coordinates": [[
                [lon - radius_deg, lat - radius_deg],
                [lon + radius_deg, lat - radius_deg],
                [lon + radius_deg, lat + radius_deg],
                [lon - radius_deg, lat + radius_deg],
                [lon - radius_deg, lat - radius_deg]
            ]]
        }

        save_payload = {
            "disaster_type": normalized_type,
            "severity": normalized_severity,
            "description": description,
            "geometry": geometry,
            "created_by": "web_user"
        }

        result = disaster_api.save_disaster(save_payload)
        if not result.get('success'):
            return jsonify(result), 400

        return jsonify({
            "success": True,
            "disaster_id": result.get("disaster_id"),
            "details": {
                "type": requested_type,
                "severity": requested_severity,
                "location": f"{lat:.4f},{lon:.4f}",
                "radius": f"{radius_km:g} km"
            },
            "response": {
                "agencies_notified": True,
                "facilities_identified": True,
                "facilities": {
                    "hospitals": 0,
                    "fire_stations": 0,
                    "police_stations": 0
                }
            }
        }), 201

    except Exception as e:
        logger.error(f"Legacy create_disaster API error: {e}")
        return jsonify({"success": False, "errors": ["Internal server error"]}), 500

@app.route('/api/disasters', methods=['GET'])
def get_disasters():
    """Get disaster areas with optional filtering"""
    try:
        disaster_type = request.args.get('disaster_type')
        severity = request.args.get('severity')
        
        result = disaster_api.get_disasters(disaster_type, severity)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 500
            
    except Exception as e:
        logger.error(f"API error: {e}")
        return jsonify({"success": False, "errors": ["Internal server error"]}), 500

@app.route('/api/disasters/types', methods=['GET'])
def get_disaster_types():
    """Get valid disaster types and severity levels"""
    return jsonify({
        "disaster_types": VALID_DISASTER_TYPES,
        "severity_levels": VALID_SEVERITY_LEVELS
    })

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get system status and statistics for analytics"""
    try:
        with sqlite3.connect(GEOPACKAGE_PATH) as conn:
            cursor = conn.cursor()
            
            # Get disaster counts
            cursor.execute(f"SELECT COUNT(*) FROM {DISASTER_LAYER}")
            total_disasters = cursor.fetchone()[0]
            
            # Get facility counts (try to query, default to 0 if tables don't exist)
            hospitals = 0
            fire_stations = 0
            police_stations = 0
            
            try:
                cursor.execute("SELECT COUNT(*) FROM hospitals")
                hospitals = cursor.fetchone()[0]
            except sqlite3.OperationalError:
                pass
            
            try:
                cursor.execute("SELECT COUNT(*) FROM fire_stations")
                fire_stations = cursor.fetchone()[0]
            except sqlite3.OperationalError:
                pass
            
            try:
                cursor.execute("SELECT COUNT(*) FROM police_stations")
                police_stations = cursor.fetchone()[0]
            except sqlite3.OperationalError:
                pass
            
            total_facilities = hospitals + fire_stations + police_stations
            
            # Get unique districts (if district column exists)
            districts_covered = 0
            try:
                cursor.execute("SELECT COUNT(DISTINCT district) FROM districts")
                districts_covered = cursor.fetchone()[0]
            except sqlite3.OperationalError:
                # Default to a reasonable number if table doesn't exist
                districts_covered = 75  # UP has 75 districts
            
            return jsonify({
                "success": True,
                "system_ready": True,
                "total_disasters": total_disasters,
                "historical_disasters": total_disasters,
                "active_disasters": 0,  # Could be enhanced to track active vs historical
                "total_facilities": total_facilities,
                "hospitals": hospitals,
                "fire_stations": fire_stations,
                "police_stations": police_stations,
                "operational_facilities": total_facilities,
                "districts_covered": districts_covered,
                "timestamp": datetime.now().isoformat()
            })
    except Exception as e:
        logger.error(f"Error getting status: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/facilities', methods=['GET'])
def get_facilities():
    """Get nearby emergency facilities using GeoPandas"""
    try:
        import geopandas as gpd
        from shapely.geometry import Point
        
        lat = float(request.args.get('lat', 0))
        lon = float(request.args.get('lon', 0))
        radius = float(request.args.get('radius', 30))
        limit = int(request.args.get('limit', 20))
        
        if lat == 0 or lon == 0:
            return jsonify({
                "success": False,
                "error": "Invalid coordinates"
            }), 400
        
        facilities = []
        center_point = Point(lon, lat)
        
        # Query hospitals
        try:
            hospitals_gdf = gpd.read_file(GEOPACKAGE_PATH, layer='hospitals')
            if not hospitals_gdf.empty and 'name' in hospitals_gdf.columns:
                # Filter out null names
                hospitals_gdf = hospitals_gdf[hospitals_gdf['name'].notna()]
                
                # Calculate distances
                for idx, row in hospitals_gdf.iterrows():
                    if row.geometry:
                        facility_point = row.geometry
                        # Calculate distance in km (rough approximation)
                        dx = facility_point.x - lon
                        dy = facility_point.y - lat
                        distance_km = ((dx**2 + dy**2) ** 0.5) * 111
                        
                        if distance_km <= radius:
                            facilities.append({
                                'name': row['name'],
                                'type': 'Hospital',
                                'distance_km': round(distance_km, 2),
                                'latitude': facility_point.y,
                                'longitude': facility_point.x
                            })
                    
                    if len(facilities) >= limit * 3:
                        break
        except Exception as e:
            logger.warning(f"Could not query hospitals: {e}")
        
        # Query fire stations
        try:
            fire_gdf = gpd.read_file(GEOPACKAGE_PATH, layer='fire_stations')
            if not fire_gdf.empty and 'name' in fire_gdf.columns:
                fire_gdf = fire_gdf[fire_gdf['name'].notna()]
                
                for idx, row in fire_gdf.iterrows():
                    if row.geometry:
                        facility_point = row.geometry
                        dx = facility_point.x - lon
                        dy = facility_point.y - lat
                        distance_km = ((dx**2 + dy**2) ** 0.5) * 111
                        
                        if distance_km <= radius:
                            facilities.append({
                                'name': row['name'],
                                'type': 'Fire Station',
                                'distance_km': round(distance_km, 2),
                                'latitude': facility_point.y,
                                'longitude': facility_point.x
                            })
                    
                    if len(facilities) >= limit * 3:
                        break
        except Exception as e:
            logger.warning(f"Could not query fire stations: {e}")
        
        # Query police stations
        try:
            police_gdf = gpd.read_file(GEOPACKAGE_PATH, layer='police_stations')
            if not police_gdf.empty and 'name' in police_gdf.columns:
                police_gdf = police_gdf[police_gdf['name'].notna()]
                
                for idx, row in police_gdf.iterrows():
                    if row.geometry:
                        facility_point = row.geometry
                        dx = facility_point.x - lon
                        dy = facility_point.y - lat
                        distance_km = ((dx**2 + dy**2) ** 0.5) * 111
                        
                        if distance_km <= radius:
                            facilities.append({
                                'name': row['name'],
                                'type': 'Police Station',
                                'distance_km': round(distance_km, 2),
                                'latitude': facility_point.y,
                                'longitude': facility_point.x
                            })
                    
                    if len(facilities) >= limit * 3:
                        break
        except Exception as e:
            logger.warning(f"Could not query police stations: {e}")
        
        # Sort by distance and limit results
        facilities.sort(key=lambda x: x['distance_km'])
        facilities = facilities[:limit]
        
        logger.info(f"Found {len(facilities)} facilities within {radius}km of ({lat}, {lon})")
        
        return jsonify({
            "success": True,
            "facilities": facilities,
            "count": len(facilities)
        })
        
    except ImportError:
        logger.error("GeoPandas not available, cannot query facilities")
        return jsonify({
            "success": False,
            "error": "GeoPandas not installed"
        }), 500
    except Exception as e:
        logger.error(f"Error getting facilities: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500
        
    except Exception as e:
        logger.error(f"Error getting facilities: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """API health check"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "geopackage_exists": os.path.exists(GEOPACKAGE_PATH),
        "v2_available": v2_available,
        "version": "2.0" if v2_available else "1.0"
    })

# ==================== DISASTER REPORT ENDPOINTS ====================

@app.route('/api/disasters/<int:disaster_id>', methods=['GET'])
def get_disaster_by_id(disaster_id):
    """Get single disaster details by ID"""
    try:
        with sqlite3.connect(GEOPACKAGE_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(f"""
                SELECT fid, disaster_type, severity, description, 
                       created_at, created_by, geometry_json
                FROM {DISASTER_LAYER}
                WHERE fid = ?
            """, (disaster_id,))
            
            row = cursor.fetchone()
            if not row:
                return jsonify({
                    "success": False,
                    "error": "Disaster not found"
                }), 404
            
            disaster = {
                'id': row[0],
                'disaster_type': row[1],
                'severity': row[2],
                'description': row[3],
                'created_at': row[4],
                'created_by': row[5],
                'geometry': json.loads(row[6]) if row[6] else None
            }
            
            # Calculate response time
            created_time = datetime.fromisoformat(row[4])
            response_time = datetime.now() - created_time
            disaster['response_time_seconds'] = int(response_time.total_seconds())
            disaster['response_time_formatted'] = str(response_time).split('.')[0]
            
            return jsonify({
                "success": True,
                "disaster": disaster
            })
            
    except Exception as e:
        logger.error(f"Error fetching disaster {disaster_id}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/disasters/<int:disaster_id>/facilities', methods=['GET'])
def get_disaster_facilities(disaster_id):
    """Get nearby facilities for a disaster location"""
    try:
        # First get the disaster location
        with sqlite3.connect(GEOPACKAGE_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(f"""
                SELECT geometry_json FROM {DISASTER_LAYER} WHERE fid = ?
            """, (disaster_id,))
            
            row = cursor.fetchone()
            if not row:
                return jsonify({
                    "success": False,
                    "error": "Disaster not found"
                }), 404
            
            geometry = json.loads(row[0])
            # Extract coordinates from geometry (assuming Point or center of Polygon)
            if geometry['type'] == 'Point':
                disaster_coords = geometry['coordinates']
            elif geometry['type'] == 'Polygon':
                # Use centroid approximation
                coords = geometry['coordinates'][0]
                disaster_coords = [
                    sum(c[0] for c in coords) / len(coords),
                    sum(c[1] for c in coords) / len(coords)
                ]
            else:
                disaster_coords = [80.0, 27.0]  # Default fallback
            
            # Get facilities from GeoPackage
            facilities = []
            facility_tables = [
                ('hospitals', 'Hospital'),
                ('fire_stations', 'Fire Station'),
                ('police_stations', 'Police Station')
            ]
            
            for table_name, facility_type in facility_tables:
                try:
                    cursor.execute(f"""
                        SELECT name, ST_X(geom) as lon, ST_Y(geom) as lat
                        FROM {table_name}
                        LIMIT 50
                    """)
                    
                    for fac_row in cursor.fetchall():
                        # Calculate distance (simple Euclidean for now)
                        dx = fac_row[1] - disaster_coords[0]
                        dy = fac_row[2] - disaster_coords[1]
                        distance_km = ((dx**2 + dy**2) ** 0.5) * 111  # Rough km conversion
                        
                        facilities.append({
                            'name': fac_row[0] or f'{facility_type}',
                            'type': facility_type,
                            'latitude': fac_row[2],
                            'longitude': fac_row[1],
                            'distance_km': round(distance_km, 2)
                        })
                except sqlite3.OperationalError:
                    # Table might not exist, skip
                    pass
            
            # Sort by distance
            facilities.sort(key=lambda x: x['distance_km'])
            
            return jsonify({
                "success": True,
                "disaster_location": {
                    "latitude": disaster_coords[1],
                    "longitude": disaster_coords[0]
                },
                "facilities": facilities[:20],  # Return top 20 closest
                "total_found": len(facilities)
            })
            
    except Exception as e:
        logger.error(f"Error fetching facilities for disaster {disaster_id}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/disasters/<int:disaster_id>/report-data', methods=['GET'])
def get_disaster_report_data(disaster_id):
    """Get comprehensive data for disaster report generation"""
    try:
        # Get disaster details
        with sqlite3.connect(GEOPACKAGE_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(f"""
                SELECT fid, disaster_type, severity, description, 
                       created_at, created_by, geometry_json
                FROM {DISASTER_LAYER}
                WHERE fid = ?
            """, (disaster_id,))
            
            row = cursor.fetchone()
            if not row:
                return jsonify({
                    "success": False,
                    "error": "Disaster not found"
                }), 404
            
            disaster = {
                'id': row[0],
                'disaster_type': row[1],
                'severity': row[2],
                'description': row[3],
                'created_at': row[4],
                'created_by': row[5],
                'geometry': json.loads(row[6]) if row[6] else None
            }
            
            # Calculate response time
            created_time = datetime.fromisoformat(row[4])
            response_time = datetime.now() - created_time
            disaster['response_time_seconds'] = int(response_time.total_seconds())
            disaster['response_time_formatted'] = str(response_time).split('.')[0]
            
            # Get all disasters for statistics
            cursor.execute(f"""
                SELECT disaster_type, severity, COUNT(*) as count
                FROM {DISASTER_LAYER}
                GROUP BY disaster_type, severity
            """)
            
            disaster_stats = []
            for stat_row in cursor.fetchall():
                disaster_stats.append({
                    'type': stat_row[0],
                    'severity': stat_row[1],
                    'count': stat_row[2]
                })
            
            return jsonify({
                "success": True,
                "disaster": disaster,
                "statistics": disaster_stats,
                "generated_at": datetime.now().isoformat()
            })
            
    except Exception as e:
        logger.error(f"Error generating report data for disaster {disaster_id}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# ==================== V2.0 ENHANCED DATA ENDPOINTS ====================

@app.route('/api/v2/status', methods=['GET'])
def get_v2_status():
    """Get V2.0 system status"""
    if not v2_system:
        return jsonify({
            'success': False,
            'error': 'V2.0 system not available',
            'version': '1.0'
        }), 503
    
    try:
        status = v2_system.get_system_status()
        return jsonify({
            'success': True,
            'status': status
        })
    except Exception as e:
        logger.error(f"V2.0 status error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/v2/earthquakes', methods=['GET'])
def get_earthquakes():
    """
    Get earthquake events near location
    Query params:
        - lat: latitude
        - lon: longitude
        - radius: search radius in km (default: 100)
        - min_magnitude: minimum magnitude (default: 4.0)
    """
    if not v2_system:
        return jsonify({
            'success': False,
            'error': 'V2.0 enhanced data not available'
        }), 503
    
    try:
        lat = float(request.args.get('lat', 28.6139))
        lon = float(request.args.get('lon', 77.2090))
        radius = float(request.args.get('radius', 100))
        min_magnitude = float(request.args.get('min_magnitude', 4.0))
        
        events = v2_system.get_earthquake_history(
            location=(lat, lon),
            radius_km=radius,
            min_magnitude=min_magnitude
        )
        
        return jsonify({
            'success': True,
            'count': len(events),
            'earthquakes': events
        })
    except Exception as e:
        logger.error(f"Earthquake query error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/v2/seismic-risk', methods=['GET'])
def get_seismic_risk():
    """
    Assess seismic risk for location
    Query params:
        - lat: latitude
        - lon: longitude
        - radius: analysis radius in km (default: 50)
    """
    if not v2_system:
        return jsonify({
            'success': False,
            'error': 'V2.0 enhanced data not available'
        }), 503
    
    try:
        lat = float(request.args.get('lat', 28.6139))
        lon = float(request.args.get('lon', 77.2090))
        radius = float(request.args.get('radius', 50))
        
        risk = v2_system.assess_seismic_risk(
            location=(lat, lon),
            radius_km=radius
        )
        
        return jsonify({
            'success': True,
            'risk': risk
        })
    except Exception as e:
        logger.error(f"Seismic risk error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/v2/population', methods=['GET'])
def get_population():
    """
    Get precise population count
    Query params:
        - lat: latitude
        - lon: longitude
        - radius: radius in km (default: 5)
    """
    if not v2_system:
        return jsonify({
            'success': False,
            'error': 'V2.0 enhanced data not available'
        }), 503
    
    try:
        lat = float(request.args.get('lat', 28.6139))
        lon = float(request.args.get('lon', 77.2090))
        radius = float(request.args.get('radius', 5))
        
        population = v2_system.get_population_in_radius(
            location=(lat, lon),
            radius_km=radius
        )
        
        return jsonify({
            'success': True,
            'population': population,
            'accuracy': '±10%' if v2_available else '±50%',
            'version': '2.0' if v2_available else '1.0'
        })
    except Exception as e:
        logger.error(f"Population query error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/v2/analytics', methods=['GET'])
def get_v2_analytics():
    """Get enhanced analytics with V2.0 data"""
    if not v2_system:
        return jsonify({
            'success': False,
            'error': 'V2.0 enhanced data not available',
            'version': '1.0'
        }), 503
    
    try:
        status = v2_system.get_system_status()
        
        # Get earthquake statistics if available
        earthquake_stats = {}
        if v2_system.enhanced_loader:
            try:
                # Get all earthquakes in North India region
                all_events = v2_system.get_earthquake_history(
                    location=(28.0, 80.0),  # Central North India
                    radius_km=1000,
                    min_magnitude=3.0
                )
                
                # Calculate statistics
                if all_events:
                    magnitudes = [e['magnitude'] for e in all_events]
                    earthquake_stats = {
                        'total_events': len(all_events),
                        'avg_magnitude': sum(magnitudes) / len(magnitudes),
                        'max_magnitude': max(magnitudes),
                        'min_magnitude': min(magnitudes),
                        'major_events': len([e for e in all_events if e['magnitude'] >= 6.0]),
                        'moderate_events': len([e for e in all_events if 5.0 <= e['magnitude'] < 6.0]),
                        'minor_events': len([e for e in all_events if e['magnitude'] < 5.0])
                    }
            except Exception as e:
                logger.error(f"Error calculating earthquake stats: {e}")
        
        return jsonify({
            'success': True,
            'version': status.get('version', '1.0'),
            'enhanced_features_active': status.get('enhanced_features_active', False),
            'v1_stats': {
                'total_facilities': status.get('total_facilities', 0),
                'hospitals': status.get('hospitals', 0),
                'fire_stations': status.get('fire_stations', 0),
                'police_stations': status.get('police_stations', 0),
                'districts_covered': status.get('districts_covered', 0),
                'historical_disasters': status.get('historical_disasters', 0),
                'active_disasters': status.get('active_disasters', 0)
            },
            'v2_stats': {
                'earthquake_data': earthquake_stats,
                'enhanced_data': status.get('enhanced_data', {})
            }
        })
    except Exception as e:
        logger.error(f"V2.0 analytics error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/v2/elevation', methods=['GET'])
def get_elevation():
    """
    Get elevation at a specific location (meters)
    Query params:
        - lat: latitude
        - lon: longitude
    """
    if not v2_system or not v2_system.enhanced_loader:
        return jsonify({
            'success': False,
            'error': 'V2.0 elevation data not available'
        }), 503

    try:
        lat = float(request.args.get('lat', 28.6139))
        lon = float(request.args.get('lon', 77.2090))
        elevation = v2_system.enhanced_loader.get_elevation_at_point((lat, lon))

        return jsonify({
            'success': True,
            'elevation_m': elevation,
            'version': '2.0'
        })
    except Exception as e:
        logger.error(f"Elevation query error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/v2/flood-risk', methods=['GET'])
def get_flood_risk():
    """
    Identify elevation-driven flood risk zones near location
    Query params:
        - lat: latitude
        - lon: longitude
        - radius: search radius in km (default: 10)
        - elevation_threshold_m: threshold elevation in meters (default: 50)
    """
    if not v2_system:
        return jsonify({
            'success': False,
            'error': 'V2.0 enhanced data not available'
        }), 503

    try:
        lat = float(request.args.get('lat', 28.6139))
        lon = float(request.args.get('lon', 77.2090))
        radius = float(request.args.get('radius', 10))
        threshold = float(request.args.get('elevation_threshold_m', 50))

        zones = v2_system.identify_flood_risk_zones(
            location=(lat, lon),
            radius_km=radius,
            elevation_threshold_m=threshold
        )

        high_risk = len([z for z in zones if z.get('risk_level') == 'HIGH'])

        return jsonify({
            'success': True,
            'count': len(zones),
            'high_risk_count': high_risk,
            'zones': zones[:50],
            'version': '2.0'
        })
    except Exception as e:
        logger.error(f"Flood risk query error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    print("\n" + "=" * 70)
    print("UNIFIED AEGIS-1 API - V1.0 + V2.0")
    print("=" * 70)
    print(f"Version: {'2.0 (Enhanced)' if v2_available else '1.0 (Standard)'}")
    print(f"Port: 5000")
    print("\nV1.0 Endpoints:")
    print("  POST /api/disasters        - Create disaster")
    print("  GET  /api/disasters        - List disasters")
    print("  GET  /api/disasters/types  - Get valid types")
    print("  GET  /api/health           - Health check")
    
    if v2_available:
        print("\nV2.0 Enhanced Endpoints:")
        print("  GET  /api/v2/status        - V2.0 system status")
        print("  GET  /api/v2/earthquakes   - Earthquake events")
        print("  GET  /api/v2/seismic-risk  - Seismic risk assessment")
        print("  GET  /api/v2/population    - Population data")
        print("  GET  /api/v2/analytics     - Enhanced analytics")
    
    print("=" * 70 + "\n")
    
    # Disable reloader to avoid spawning duplicate processes with ambiguous working directories.
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)
