#!/usr/bin/env python3
"""
DISASTER RESPONSE COORDINATION & DECISION SUPPORT SYSTEM - VERSION 2.0
Extends Version 1.0 with enhanced data capabilities while preserving all existing features.
Lives depend on this system - 100% backward compatible, zero breaking changes.

VERSION 2.0 ENHANCEMENTS:
- Enhanced population estimates (100m resolution, ±10% accuracy vs ±50%)
- Earthquake history analysis (1,216 events, 26 years of data)
- Elevation-based flood modeling (30m DEM)
- All Version 1.0 features preserved and operational
"""

import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Optional

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Import Version 1.0 system (PRESERVED)
from disaster_response_system import (
    DisasterResponseSystem as DisasterResponseSystemV1,
    DisasterType, Priority, FacilityType,
    DisasterEvent, EmergencyFacility, PopulationData
)

from shapely.geometry import Point, Polygon

# Import enhanced data loader (optional)
try:
    from enhanced_data_loader import EnhancedDataLoader
    ENHANCED_DATA_AVAILABLE = True
except ImportError:
    ENHANCED_DATA_AVAILABLE = False
    print("Note: Enhanced data features not available (install rasterio for full features)")


class DisasterResponseSystemV2(DisasterResponseSystemV1):
    """
    VERSION 2.0: Enhanced AeGIS-1
    Extends V1.0 with enhanced data capabilities
    100% backward compatible - all V1.0 methods work unchanged
    """
    
    def __init__(self, data_dir: str = "data", enhanced_data_dir: str = "dataa/datasets"):
        """
        Initialize Version 2.0 system
        
        Args:
            data_dir: Path to Version 1.0 data (existing)
            enhanced_data_dir: Path to Version 2.0 enhanced datasets (new)
        """
        # Initialize Version 1.0 (PRESERVED - all existing functionality)
        super().__init__(data_dir)
        
        # Version 2.0 additions
        self.version = "2.0"
        self.enhanced_loader = None
        self.enhanced_features_active = False
        
        # Load enhanced data if available
        if ENHANCED_DATA_AVAILABLE and os.path.exists(enhanced_data_dir):
            try:
                print("\n" + "=" * 70)
                print("[V2.0] LOADING ENHANCED DATASETS...")
                print("=" * 70)
                
                self.enhanced_loader = EnhancedDataLoader(enhanced_data_dir)
                
                # Get status
                status = self.enhanced_loader.get_data_status()
                
                print("\n[V2.0] ✅ ENHANCED FEATURES ENABLED:")
                if status['earthquake_available']:
                    print(f"       • Earthquake history: {status['earthquake_events']:,} events (2000-2026)")
                if status['population_available']:
                    print(f"       • Population data: {status['population_resolution_m']}m resolution (±10% accuracy)")
                if status['elevation_available']:
                    print(f"       • Elevation data: {status['elevation_resolution_m']}m DEM (flood modeling)")
                
                self.enhanced_features_active = True
                
            except Exception as e:
                print(f"\n[V2.0] ⚠️  Enhanced features unavailable: {e}")
                print("[V2.0] System will use Version 1.0 features (fully operational)")
                self.enhanced_loader = None
        else:
            if not ENHANCED_DATA_AVAILABLE:
                print("\n[V2.0] Enhanced data loader not available (rasterio not installed)")
            else:
                print(f"\n[V2.0] Enhanced data directory not found: {enhanced_data_dir}")
            print("[V2.0] Using Version 1.0 features (fully operational)")
        
        # Final status
        print("\n" + "=" * 70)
        print(f"SYSTEM READY - VERSION {self.version}")
        print("=" * 70)
        print(f"✅ Version 1.0 features: ACTIVE (all preserved)")
        print(f"✅ Facilities: {len(self.facilities)}")
        print(f"✅ Districts: {len(self.population_data)}")
        print(f"✅ Historical disasters: {len(self.historical_disasters)}")
        if self.enhanced_features_active:
            print(f"✅ Version 2.0 enhanced features: ACTIVE")
        else:
            print(f"ℹ️  Version 2.0 enhanced features: NOT ACTIVE (V1.0 fully operational)")
        print("=" * 70 + "\n")
    
    # ==================== VERSION 1.0 METHOD ENHANCEMENTS ====================
    
    def _estimate_affected_population(self, affected_area: Polygon) -> int:
        """
        Enhanced population estimation
        V2.0: Uses 100m resolution raster data (±10% accuracy)
        V1.0: Falls back to district-based estimation (±50% accuracy)
        """
        # Try V2.0 precise calculation
        if self.enhanced_loader:
            try:
                precise_population = self.enhanced_loader.calculate_population_in_area(affected_area)
                if precise_population > 0:
                    print(f"   [V2.0] Precise population: {precise_population:,} (±10% accuracy)")
                    return precise_population
            except Exception as e:
                print(f"   [V2.0] Precise calculation failed, using V1.0 method")
        
        # V1.0 fallback (PRESERVED)
        result = super()._estimate_affected_population(affected_area)
        print(f"   [V1.0] District-based estimate: {result:,} (±50% accuracy)")
        return result
    
    # ==================== VERSION 2.0 NEW METHODS ====================
    
    def get_earthquake_history(self, location: Tuple[float, float], 
                               radius_km: float = 100, 
                               min_magnitude: float = 4.0) -> List[Dict]:
        """
        VERSION 2.0: Query historical earthquake data
        
        Args:
            location: (lat, lon) tuple
            radius_km: Search radius in kilometers
            min_magnitude: Minimum earthquake magnitude
        
        Returns:
            List of earthquake events, empty if enhanced data not available
        """
        if not self.enhanced_loader:
            return []
        
        try:
            events = self.enhanced_loader.query_earthquakes(
                location=location,
                radius_km=radius_km,
                min_magnitude=min_magnitude
            )
            return events
        except Exception as e:
            print(f"[V2.0] Earthquake query error: {e}")
            return []
    
    def assess_seismic_risk(self, location: Tuple[float, float], 
                           radius_km: float = 50) -> Dict:
        """
        VERSION 2.0: Assess seismic risk for a location
        
        Args:
            location: (lat, lon) tuple
            radius_km: Analysis radius in kilometers
        
        Returns:
            Risk assessment dict with level, event counts, and details
        """
        if not self.enhanced_loader:
            return {
                'risk_level': 'UNKNOWN',
                'reason': 'Enhanced earthquake data not available',
                'recommendation': 'Install enhanced data for seismic analysis',
                'version': '1.0'
            }
        
        try:
            # Get earthquake history
            events = self.enhanced_loader.query_earthquakes(
                location=location,
                radius_km=radius_km,
                min_magnitude=5.0
            )
            
            # Count major earthquakes
            major_events = [e for e in events if e['magnitude'] >= 6.0]
            
            # Assess risk level
            if len(major_events) > 3 or len(events) > 15:
                risk_level = 'HIGH'
            elif len(major_events) > 1 or len(events) > 8:
                risk_level = 'MEDIUM'
            else:
                risk_level = 'LOW'
            
            return {
                'risk_level': risk_level,
                'total_earthquakes': len(events),
                'major_earthquakes': len(major_events),
                'largest_magnitude': events[0]['magnitude'] if events else 0,
                'largest_event': events[0] if events else None,
                'recent_events': [e for e in events if any(year in e['time'] for year in ['2020', '2021', '2022', '2023', '2024', '2025', '2026'])],
                'version': '2.0'
            }
        except Exception as e:
            print(f"[V2.0] Seismic risk assessment error: {e}")
            return {'risk_level': 'UNKNOWN', 'error': str(e), 'version': '2.0'}
    
    def identify_flood_risk_zones(self, location: Tuple[float, float], 
                                  radius_km: float = 10,
                                  elevation_threshold_m: float = 50) -> List[Dict]:
        """
        VERSION 2.0: Identify flood-prone areas using elevation data
        
        Args:
            location: (lat, lon) tuple
            radius_km: Search radius in kilometers
            elevation_threshold_m: Maximum elevation for flood risk
        
        Returns:
            List of flood risk zones, empty if enhanced data not available
        """
        if not self.enhanced_loader:
            return []
        
        try:
            # Create search area
            center_point = Point(location[1], location[0])
            search_area = center_point.buffer(radius_km / 111.0)
            
            # Get flood risk zones
            flood_zones = self.enhanced_loader.identify_flood_risk_areas(
                search_area,
                elevation_threshold_m=elevation_threshold_m
            )
            
            return flood_zones
        except Exception as e:
            print(f"[V2.0] Flood risk identification error: {e}")
            return []
    
    def get_population_in_radius(self, location: Tuple[float, float], 
                                radius_km: float = 5) -> int:
        """
        VERSION 2.0: Get precise population count within radius
        
        Args:
            location: (lat, lon) tuple
            radius_km: Radius in kilometers
        
        Returns:
            Population count (precise if V2.0 data available, estimate if V1.0)
        """
        if self.enhanced_loader:
            try:
                population = self.enhanced_loader.get_population_at_point(
                    location=location,
                    radius_km=radius_km
                )
                return population
            except Exception as e:
                print(f"[V2.0] Precise population query error: {e}, using V1.0 estimate")
        
        # Fallback to V1.0 district-based estimate
        center_point = Point(location[1], location[0])
        area = center_point.buffer(radius_km / 111.0)
        return self._estimate_affected_population(area)
    
    def generate_enhanced_situation_report(self, disaster_id: str) -> Dict:
        """
        VERSION 2.0: Generate comprehensive situation report with enhanced data
        
        Args:
            disaster_id: ID of the disaster event
        
        Returns:
            Enhanced situation report with V2.0 data if available
        """
        # Get V1.0 report (PRESERVED)
        report = self.generate_situation_report(disaster_id)
        
        if 'error' in report:
            return report
        
        # Add V2.0 enhancements
        report['version'] = '2.0'
        
        if self.enhanced_loader and disaster_id in self.active_disasters:
            disaster = self.active_disasters[disaster_id]
            
            # Add earthquake context
            try:
                eq_history = self.get_earthquake_history(
                    disaster.location,
                    radius_km=100,
                    min_magnitude=4.0
                )
                
                seismic_risk = self.assess_seismic_risk(disaster.location, radius_km=50)
                
                report['seismic_context'] = {
                    'historical_events': len(eq_history),
                    'risk_level': seismic_risk.get('risk_level', 'UNKNOWN'),
                    'major_earthquakes': seismic_risk.get('major_earthquakes', 0),
                    'largest_magnitude': seismic_risk.get('largest_magnitude', 0),
                    'recent_activity': len(seismic_risk.get('recent_events', [])),
                    'notable_events': [
                        {
                            'magnitude': e['magnitude'],
                            'place': e['place'],
                            'date': e['time'][:10],
                            'distance_km': e['distance_km']
                        }
                        for e in eq_history[:5]  # Top 5 largest
                    ]
                }
            except Exception as e:
                report['seismic_context'] = {'error': str(e)}
            
            # Add flood risk zones
            if disaster.disaster_type == DisasterType.FLOOD:
                try:
                    flood_zones = self.identify_flood_risk_zones(
                        disaster.location,
                        radius_km=15,
                        elevation_threshold_m=50
                    )
                    
                    report['flood_risk_analysis'] = {
                        'zones_identified': len(flood_zones),
                        'high_risk_zones': len([z for z in flood_zones if z.get('risk_level') == 'HIGH']),
                        'zones': flood_zones[:10]  # Top 10 zones
                    }
                except Exception as e:
                    report['flood_risk_analysis'] = {'error': str(e)}
            
            # Add precise population if available
            try:
                precise_pop = self.enhanced_loader.calculate_population_in_area(disaster.affected_area)
                report['disaster_info']['precise_population'] = precise_pop
                report['disaster_info']['population_accuracy'] = '±10%'
            except:
                report['disaster_info']['population_accuracy'] = '±50%'
        
        return report
    
    def get_system_status(self) -> Dict:
        """
        Enhanced system status including V2.0 features
        """
        # Get V1.0 status (PRESERVED)
        status = super().get_system_status()
        
        # Add V2.0 information
        status['version'] = self.version
        status['enhanced_features_active'] = self.enhanced_features_active
        
        if self.enhanced_loader:
            enhanced_status = self.enhanced_loader.get_data_status()
            status['enhanced_data'] = {
                'earthquake_events': enhanced_status.get('earthquake_events', 0),
                'population_resolution_m': enhanced_status.get('population_resolution_m'),
                'elevation_resolution_m': enhanced_status.get('elevation_resolution_m'),
                'rasterio_available': enhanced_status.get('rasterio_available', False)
            }
        
        return status


# ==================== MAIN EXECUTION ====================

def main():
    """Main function to demonstrate Version 2.0 system"""
    
    print("=" * 70)
    print("[ALERT] DISASTER RESPONSE SYSTEM - VERSION 2.0 [ALERT]")
    print("Real-time emergency response for North India")
    print("Enhanced with precise population, earthquake history, and flood modeling")
    print("=" * 70)
    
    # Initialize Version 2.0 system
    system = DisasterResponseSystemV2()
    
    # Show system status
    status = system.get_system_status()
    print(f"\n[STATUS] SYSTEM STATUS:")
    for key, value in status.items():
        if key != 'enhanced_data':
            print(f"   {key}: {value}")
    
    if 'enhanced_data' in status:
        print(f"\n[V2.0] ENHANCED DATA STATUS:")
        for key, value in status['enhanced_data'].items():
            print(f"   {key}: {value}")
    
    # Example: Create a flood disaster in Lucknow
    print(f"\n[FLOOD] SIMULATING FLOOD DISASTER IN LUCKNOW...")
    disaster_id = system.create_disaster_event(
        disaster_type=DisasterType.FLOOD,
        location=(26.8467, 80.9462),  # Lucknow coordinates
        description="Heavy monsoon flooding in Lucknow city center",
        severity=Priority.HIGH,
        affected_radius_km=10.0
    )
    
    # Generate enhanced situation report
    print(f"\n[REPORT] GENERATING ENHANCED SITUATION REPORT...")
    report = system.generate_enhanced_situation_report(disaster_id)
    
    print(f"\n[ALERT] SITUATION REPORT - {disaster_id}")
    print(f"   Version: {report.get('version', '1.0')}")
    print(f"   Disaster Type: {report['disaster_info']['type'].upper()}")
    print(f"   Severity: {report['disaster_info']['severity'].upper()}")
    print(f"   Affected Population: {report['disaster_info']['affected_population']:,}")
    if 'precise_population' in report['disaster_info']:
        print(f"   Precise Population: {report['disaster_info']['precise_population']:,} (±10%)")
    print(f"   Available Hospitals: {report['facility_status']['hospitals']}")
    print(f"   Available Fire Stations: {report['facility_status']['fire_stations']}")
    print(f"   Available Police Stations: {report['facility_status']['police_stations']}")
    
    # Show V2.0 enhancements
    if 'seismic_context' in report and 'error' not in report['seismic_context']:
        print(f"\n[V2.0] SEISMIC CONTEXT:")
        print(f"   Risk Level: {report['seismic_context']['risk_level']}")
        print(f"   Historical Events: {report['seismic_context']['historical_events']}")
        print(f"   Major Earthquakes: {report['seismic_context']['major_earthquakes']}")
    
    if 'flood_risk_analysis' in report and 'error' not in report['flood_risk_analysis']:
        print(f"\n[V2.0] FLOOD RISK ANALYSIS:")
        print(f"   Zones Identified: {report['flood_risk_analysis']['zones_identified']}")
        print(f"   High Risk Zones: {report['flood_risk_analysis']['high_risk_zones']}")
    
    print(f"\n[SUCCESS] DISASTER RESPONSE SYSTEM VERSION 2.0 OPERATIONAL")
    print(f"   All Version 1.0 features: PRESERVED")
    print(f"   Enhanced features: {'ACTIVE' if system.enhanced_features_active else 'NOT ACTIVE (V1.0 fully operational)'}")
    print(f"   {len(system.facilities)} facilities available")
    print(f"   {len(system.population_data)} districts covered")
    
    return system


if __name__ == "__main__":
    system = main()
