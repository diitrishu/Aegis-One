#!/usr/bin/env python3
"""
ENHANCED DATA LOADER - Version 2.0
Loads high-resolution datasets (earthquake, population, elevation)
WITHOUT modifying existing system functionality.
"""

import os
import json
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import geopandas as gpd
import pandas as pd
import numpy as np
from shapely.geometry import Point, Polygon, box
from datetime import datetime

# Optional rasterio import (graceful degradation if not available)
try:
    import rasterio
    from rasterio.mask import mask as rasterio_mask
    RASTERIO_AVAILABLE = True
except ImportError:
    RASTERIO_AVAILABLE = False
    print("Warning: rasterio not available. Raster features disabled.")


class EnhancedDataLoader:
    """
    Load enhanced datasets for improved disaster response.
    Falls back gracefully if data not available.
    """
    
    def __init__(self, dataa_dir: str = "dataa/datasets"):
        self.dataa_dir = Path(dataa_dir)
        self.earthquake_data = None
        self.earthquake_stats = None
        self.population_raster = None
        self.population_stats = None
        self.high_density_zones = None
        self.elevation_raster = None
        self.elevation_stats = None
        self.low_lying_areas = None
        self.slope_raster = None
        
        self.data_available = {
            'earthquake': False,
            'population': False,
            'elevation': False
        }
        
        print("Enhanced Data Loader initializing...")
        self._check_data_availability()
    
    def _check_data_availability(self):
        """Check which enhanced datasets are available"""
        
        # Check earthquake data
        earthquake_path = self.dataa_dir / "seismic" / "processed" / "earthquakes_north_india.gpkg"
        if earthquake_path.exists():
            self.data_available['earthquake'] = True
            print(f"✓ Earthquake catalog available: {earthquake_path}")
        
        # Check population data
        population_path = self.dataa_dir / "population" / "processed" / "north_india_population_2020.tif"
        if population_path.exists() and RASTERIO_AVAILABLE:
            self.data_available['population'] = True
            print(f"✓ Population raster available: {population_path}")
        
        # Check elevation data
        elevation_path = self.dataa_dir / "elevation" / "processed" / "north_india_dem.tif"
        if elevation_path.exists() and RASTERIO_AVAILABLE:
            self.data_available['elevation'] = True
            print(f"✓ Elevation DEM available: {elevation_path}")
        
        if not any(self.data_available.values()):
            print("⚠ No enhanced data available. Run data processing scripts in dataa/")
    
    # ==================== EARTHQUAKE DATA ====================
    
    def load_earthquake_catalog(self) -> bool:
        """Load processed USGS earthquake catalog"""
        
        if not self.data_available['earthquake']:
            return False
        
        try:
            earthquake_path = self.dataa_dir / "seismic" / "processed" / "earthquakes_north_india.gpkg"
            self.earthquake_data = gpd.read_file(earthquake_path)
            
            # Load statistics
            stats_path = self.dataa_dir / "seismic" / "processed" / "statistics.json"
            if stats_path.exists():
                with open(stats_path, 'r') as f:
                    self.earthquake_stats = json.load(f)
            
            print(f"✓ Loaded {len(self.earthquake_data)} earthquake events (2000-2026)")
            return True
            
        except Exception as e:
            print(f"Error loading earthquake data: {e}")
            return False
    
    def query_earthquakes(self, location: Tuple[float, float], 
                         radius_km: float = 100, 
                         min_magnitude: float = 4.0,
                         start_date: Optional[datetime] = None,
                         end_date: Optional[datetime] = None) -> List[Dict]:
        """
        Query earthquake catalog near location
        
        Args:
            location: (lat, lon) tuple
            radius_km: Search radius in kilometers
            min_magnitude: Minimum earthquake magnitude
            start_date: Filter events after this date
            end_date: Filter events before this date
        
        Returns:
            List of earthquake events with details
        """
        
        if self.earthquake_data is None:
            if not self.load_earthquake_catalog():
                return []
        
        try:
            # Create search area
            center_point = Point(location[1], location[0])  # lon, lat
            search_buffer = center_point.buffer(radius_km / 111.0)  # Rough km to degrees
            
            # Spatial filter
            nearby = self.earthquake_data[self.earthquake_data.geometry.within(search_buffer)]
            
            # Magnitude filter
            nearby = nearby[nearby['mag'] >= min_magnitude]
            
            # Date filters
            if start_date or end_date:
                nearby['datetime'] = pd.to_datetime(nearby['time'])
                if start_date:
                    nearby = nearby[nearby['datetime'] >= start_date]
                if end_date:
                    nearby = nearby[nearby['datetime'] <= end_date]
            
            # Convert to list of dicts
            events = []
            for idx, row in nearby.iterrows():
                events.append({
                    'id': f"eq_{row.get('id', idx)}",
                    'magnitude': float(row['mag']),
                    'depth_km': float(row['depth']),
                    'location': (row.geometry.y, row.geometry.x),
                    'time': str(row['time']),
                    'place': row.get('place', 'Unknown'),
                    'distance_km': center_point.distance(row.geometry) * 111.0
                })
            
            # Sort by magnitude (descending)
            events.sort(key=lambda x: x['magnitude'], reverse=True)
            
            return events
            
        except Exception as e:
            print(f"Error querying earthquakes: {e}")
            return []
    
    def get_earthquake_statistics(self) -> Optional[Dict]:
        """Get earthquake catalog statistics"""
        return self.earthquake_stats
    
    # ==================== POPULATION DATA ====================
    
    def load_population_density(self) -> bool:
        """Load population density raster"""
        
        if not self.data_available['population'] or not RASTERIO_AVAILABLE:
            return False
        
        try:
            population_path = self.dataa_dir / "population" / "processed" / "north_india_population_2020.tif"
            self.population_raster = rasterio.open(population_path)
            
            # Load high-density zones
            hotspots_path = self.dataa_dir / "population" / "processed" / "high_density_zones.geojson"
            if hotspots_path.exists():
                self.high_density_zones = gpd.read_file(hotspots_path)
            
            # Load statistics
            stats_path = self.dataa_dir / "population" / "processed" / "statistics.json"
            if stats_path.exists():
                with open(stats_path, 'r') as f:
                    self.population_stats = json.load(f)
            
            print(f"✓ Loaded population raster (100m resolution)")
            return True
            
        except Exception as e:
            print(f"Error loading population data: {e}")
            return False
    
    def calculate_population_in_area(self, area: Polygon) -> int:
        """
        Calculate precise population count in polygon area
        
        Args:
            area: Shapely Polygon defining the area
        
        Returns:
            Estimated population count
        """
        
        if self.population_raster is None:
            if not self.load_population_density():
                return 0
        
        try:
            # Create GeoDataFrame with area
            area_gdf = gpd.GeoDataFrame([1], geometry=[area], crs="EPSG:4326")
            
            # Mask raster to area
            out_image, out_transform = rasterio_mask(
                self.population_raster, 
                area_gdf.geometry, 
                crop=True,
                nodata=self.population_raster.nodata
            )
            
            # Sum population (excluding nodata)
            pop_data = out_image[0]
            valid_data = pop_data[pop_data != self.population_raster.nodata]
            total_population = int(valid_data.sum())
            
            return total_population
            
        except Exception as e:
            print(f"Error calculating population: {e}")
            return 0
    
    def get_population_at_point(self, location: Tuple[float, float], 
                               radius_km: float = 1.0) -> int:
        """
        Get population within radius of point
        
        Args:
            location: (lat, lon) tuple
            radius_km: Radius in kilometers
        
        Returns:
            Estimated population count
        """
        
        # Create circular buffer
        center_point = Point(location[1], location[0])  # lon, lat
        buffer_area = center_point.buffer(radius_km / 111.0)
        
        return self.calculate_population_in_area(buffer_area)
    
    def identify_high_density_zones_in_area(self, area: Polygon, 
                                           threshold_per_km2: int = 5000) -> List[Dict]:
        """
        Find high-density population zones within area
        
        Args:
            area: Search area polygon
            threshold_per_km2: Minimum density threshold
        
        Returns:
            List of high-density zones
        """
        
        if self.high_density_zones is None:
            if not self.load_population_density():
                return []
        
        try:
            # Find zones within area
            zones_in_area = self.high_density_zones[
                self.high_density_zones.geometry.within(area)
            ]
            
            # Filter by threshold
            zones_in_area = zones_in_area[zones_in_area['population'] >= threshold_per_km2]
            
            # Convert to list
            hotspots = []
            for idx, row in zones_in_area.iterrows():
                hotspots.append({
                    'location': (row.geometry.centroid.y, row.geometry.centroid.x),
                    'population_density': int(row['population']),
                    'geometry': row.geometry
                })
            
            return hotspots
            
        except Exception as e:
            print(f"Error identifying high-density zones: {e}")
            return []
    
    # ==================== ELEVATION DATA ====================
    
    def load_elevation_data(self) -> bool:
        """Load elevation DEM and derived products"""
        
        if not self.data_available['elevation'] or not RASTERIO_AVAILABLE:
            return False
        
        try:
            # Load DEM
            elevation_path = self.dataa_dir / "elevation" / "processed" / "north_india_dem.tif"
            self.elevation_raster = rasterio.open(elevation_path)
            
            # Load slope
            slope_path = self.dataa_dir / "elevation" / "processed" / "slope.tif"
            if slope_path.exists():
                self.slope_raster = rasterio.open(slope_path)
            
            # Load low-lying areas
            low_lying_path = self.dataa_dir / "elevation" / "processed" / "low_lying_areas.geojson"
            if low_lying_path.exists():
                self.low_lying_areas = gpd.read_file(low_lying_path)
            
            # Load statistics
            stats_path = self.dataa_dir / "elevation" / "processed" / "statistics.json"
            if stats_path.exists():
                with open(stats_path, 'r') as f:
                    self.elevation_stats = json.load(f)
            
            print(f"✓ Loaded elevation DEM (30m resolution)")
            return True
            
        except Exception as e:
            print(f"Error loading elevation data: {e}")
            return False
    
    def get_elevation_at_point(self, location: Tuple[float, float]) -> Optional[float]:
        """
        Get elevation at specific point
        
        Args:
            location: (lat, lon) tuple
        
        Returns:
            Elevation in meters, or None if unavailable
        """
        
        if self.elevation_raster is None:
            if not self.load_elevation_data():
                return None
        
        try:
            # Sample raster at point
            lon, lat = location[1], location[0]
            row, col = self.elevation_raster.index(lon, lat)
            elevation = self.elevation_raster.read(1)[row, col]
            
            # Check for nodata
            if elevation == self.elevation_raster.nodata:
                return None
            
            return float(elevation)
            
        except Exception as e:
            print(f"Error getting elevation: {e}")
            return None
    
    def identify_flood_risk_areas(self, area: Polygon, 
                                 elevation_threshold_m: float = 50.0) -> List[Dict]:
        """
        Identify low-lying areas at flood risk
        
        Args:
            area: Search area polygon
            elevation_threshold_m: Maximum elevation for flood risk
        
        Returns:
            List of flood-risk zones
        """
        
        if self.low_lying_areas is None:
            if not self.load_elevation_data():
                return []
        
        try:
            # Find low-lying areas within search area
            flood_zones = self.low_lying_areas[
                self.low_lying_areas.geometry.within(area)
            ]
            
            # Filter by elevation threshold
            flood_zones = flood_zones[flood_zones['elevation_m'] <= elevation_threshold_m]
            
            # Convert to list
            zones = []
            for idx, row in flood_zones.iterrows():
                zones.append({
                    'location': (row.geometry.centroid.y, row.geometry.centroid.x),
                    'elevation_m': float(row['elevation_m']),
                    'geometry': row.geometry,
                    'risk_level': 'HIGH' if row['elevation_m'] < 10 else 'MEDIUM'
                })
            
            return zones
            
        except Exception as e:
            print(f"Error identifying flood risk areas: {e}")
            return []
    
    def calculate_elevation_profile(self, route_points: List[Tuple[float, float]]) -> Dict:
        """
        Calculate elevation profile along route
        
        Args:
            route_points: List of (lat, lon) tuples defining route
        
        Returns:
            Dict with elevation statistics
        """
        
        if self.elevation_raster is None:
            if not self.load_elevation_data():
                return {}
        
        try:
            elevations = []
            
            for lat, lon in route_points:
                elev = self.get_elevation_at_point((lat, lon))
                if elev is not None:
                    elevations.append(elev)
            
            if not elevations:
                return {}
            
            # Calculate statistics
            elevations = np.array(elevations)
            elevation_gain = np.sum(np.maximum(0, np.diff(elevations)))
            elevation_loss = np.sum(np.maximum(0, -np.diff(elevations)))
            
            return {
                'min_elevation_m': float(elevations.min()),
                'max_elevation_m': float(elevations.max()),
                'elevation_gain_m': float(elevation_gain),
                'elevation_loss_m': float(elevation_loss),
                'avg_elevation_m': float(elevations.mean()),
                'elevation_profile': elevations.tolist()
            }
            
        except Exception as e:
            print(f"Error calculating elevation profile: {e}")
            return {}
    
    # ==================== UTILITY METHODS ====================
    
    def get_data_status(self) -> Dict:
        """Get status of all enhanced datasets"""
        
        return {
            'earthquake_available': self.data_available['earthquake'],
            'earthquake_loaded': self.earthquake_data is not None,
            'earthquake_events': len(self.earthquake_data) if self.earthquake_data is not None else 0,
            
            'population_available': self.data_available['population'],
            'population_loaded': self.population_raster is not None,
            'population_resolution_m': 100 if self.population_raster else None,
            
            'elevation_available': self.data_available['elevation'],
            'elevation_loaded': self.elevation_raster is not None,
            'elevation_resolution_m': 30 if self.elevation_raster else None,
            
            'rasterio_available': RASTERIO_AVAILABLE
        }
    
    def close(self):
        """Close raster file handles"""
        if self.population_raster:
            self.population_raster.close()
        if self.elevation_raster:
            self.elevation_raster.close()
        if self.slope_raster:
            self.slope_raster.close()
    
    def __del__(self):
        """Cleanup on deletion"""
        self.close()


# ==================== STANDALONE TESTING ====================

def main():
    """Test enhanced data loader"""
    
    print("=" * 60)
    print("ENHANCED DATA LOADER TEST")
    print("=" * 60)
    
    # Initialize loader
    loader = EnhancedDataLoader("dataa/datasets")
    
    # Show status
    status = loader.get_data_status()
    print("\nData Status:")
    for key, value in status.items():
        print(f"  {key}: {value}")
    
    # Test earthquake query
    if status['earthquake_available']:
        print("\n--- Testing Earthquake Query ---")
        events = loader.query_earthquakes(
            location=(28.6139, 77.2090),  # Delhi
            radius_km=100,
            min_magnitude=5.0
        )
        print(f"Found {len(events)} earthquakes (M5.0+) near Delhi")
        if events:
            print(f"Largest: M{events[0]['magnitude']} at {events[0]['place']}")
    
    # Test population calculation
    if status['population_available']:
        print("\n--- Testing Population Calculation ---")
        population = loader.get_population_at_point(
            location=(26.8467, 80.9462),  # Lucknow
            radius_km=5
        )
        print(f"Population within 5km of Lucknow: {population:,}")
    
    # Test elevation query
    if status['elevation_available']:
        print("\n--- Testing Elevation Query ---")
        elevation = loader.get_elevation_at_point((28.6139, 77.2090))  # Delhi
        print(f"Elevation at Delhi: {elevation:.1f}m")
    
    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
