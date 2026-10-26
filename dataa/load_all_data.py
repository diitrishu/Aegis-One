"""
Unified Data Loader for North India Disaster Risk Assessment
Loads earthquake, population, and elevation data with spatial queries
"""

import geopandas as gpd
import rasterio
from rasterio.mask import mask
from shapely.geometry import Point, box
import numpy as np
import json
from pathlib import Path
from typing import Tuple, Optional, Dict, List

class NorthIndiaDataLoader:
    """Load and query earthquake, population, and elevation data for North India"""
    
    def __init__(self, data_dir: str = "datasets"):
        self.data_dir = Path(data_dir)
        
        # Paths
        self.earthquake_file = self.data_dir / "seismic/processed/earthquakes_north_india.gpkg"
        self.population_file = self.data_dir / "population/processed/north_india_population_2020.tif"
        self.elevation_file = self.data_dir / "elevation/processed/north_india_dem.tif"
        self.slope_file = self.data_dir / "elevation/processed/slope.tif"
        
        # Load data
        print("Loading North India disaster risk data...")
        self._load_earthquake_data()
        self._load_raster_metadata()
        print(f"✓ Data loaded successfully!")
        
    def _load_earthquake_data(self):
        """Load earthquake point data"""
        if not self.earthquake_file.exists():
            raise FileNotFoundError(f"Earthquake data not found: {self.earthquake_file}")
        self.earthquakes = gpd.read_file(self.earthquake_file)
        
        # Extract year from time column if it exists
        if 'time' in self.earthquakes.columns and 'year' not in self.earthquakes.columns:
            import pandas as pd
            self.earthquakes['year'] = pd.to_datetime(self.earthquakes['time']).dt.year
        
        print(f"  ✓ Loaded {len(self.earthquakes)} earthquakes")
        
    def _load_raster_metadata(self):
        """Load raster metadata without loading full arrays"""
        # Population
        if self.population_file.exists():
            with rasterio.open(self.population_file) as src:
                self.pop_meta = {
                    'bounds': src.bounds,
                    'crs': src.crs,
                    'transform': src.transform,
                    'shape': (src.height, src.width)
                }
            print(f"  ✓ Population raster: {src.width}x{src.height} pixels")
        else:
            print(f"  ⚠ Population data not found")
            self.pop_meta = None
            
        # Elevation
        if self.elevation_file.exists():
            with rasterio.open(self.elevation_file) as src:
                self.elev_meta = {
                    'bounds': src.bounds,
                    'crs': src.crs,
                    'transform': src.transform,
                    'shape': (src.height, src.width)
                }
            print(f"  ✓ Elevation raster: {src.width}x{src.height} pixels")
        else:
            print(f"  ⚠ Elevation data not found")
            self.elev_meta = None
    
    # ==================== EARTHQUAKE QUERIES ====================
    
    def get_earthquakes_in_bbox(self, min_lon: float, min_lat: float, 
                                max_lon: float, max_lat: float,
                                min_magnitude: Optional[float] = None) -> gpd.GeoDataFrame:
        """Get earthquakes within bounding box"""
        bbox = box(min_lon, min_lat, max_lon, max_lat)
        result = self.earthquakes[self.earthquakes.intersects(bbox)]
        
        if min_magnitude:
            result = result[result['mag'] >= min_magnitude]
            
        return result
    
    def get_earthquakes_near_point(self, lon: float, lat: float, 
                                   radius_km: float = 100,
                                   min_magnitude: Optional[float] = None) -> gpd.GeoDataFrame:
        """Get earthquakes within radius of a point"""
        point = Point(lon, lat)
        # Approximate: 1 degree ≈ 111 km
        buffer_deg = radius_km / 111.0
        
        result = self.earthquakes[
            self.earthquakes.distance(point) <= buffer_deg
        ]
        
        if min_magnitude:
            result = result[result['mag'] >= min_magnitude]
            
        return result.copy()
    
    def get_major_earthquakes(self, min_magnitude: float = 6.0) -> gpd.GeoDataFrame:
        """Get major earthquakes above magnitude threshold"""
        return self.earthquakes[self.earthquakes['mag'] >= min_magnitude].copy()
    
    # ==================== POPULATION QUERIES ====================
    
    def get_population_at_point(self, lon: float, lat: float) -> Optional[float]:
        """Get population density at a specific point"""
        if not self.pop_meta:
            return None
            
        with rasterio.open(self.population_file) as src:
            # Convert lon/lat to pixel coordinates
            row, col = src.index(lon, lat)
            
            # Check if within bounds
            if 0 <= row < src.height and 0 <= col < src.width:
                value = src.read(1)[row, col]
                return float(value) if value != src.nodata else 0.0
            return None
    
    def get_population_in_bbox(self, min_lon: float, min_lat: float,
                               max_lon: float, max_lat: float) -> Dict:
        """Get population statistics within bounding box"""
        if not self.pop_meta:
            return None
            
        bbox_geom = box(min_lon, min_lat, max_lon, max_lat)
        bbox_gdf = gpd.GeoDataFrame([1], geometry=[bbox_geom], crs="EPSG:4326")
        
        with rasterio.open(self.population_file) as src:
            out_image, out_transform = mask(src, bbox_gdf.geometry, crop=True, nodata=src.nodata)
            pop_data = out_image[0]
            valid_data = pop_data[pop_data != src.nodata]
            
            if len(valid_data) == 0:
                return {'total': 0, 'mean': 0, 'max': 0}
                
            return {
                'total_population': int(valid_data.sum()),
                'mean_density': float(valid_data.mean()),
                'max_density': float(valid_data.max()),
                'cells': len(valid_data)
            }
    
    # ==================== ELEVATION QUERIES ====================
    
    def get_elevation_at_point(self, lon: float, lat: float) -> Optional[float]:
        """Get elevation at a specific point"""
        if not self.elev_meta:
            return None
            
        with rasterio.open(self.elevation_file) as src:
            row, col = src.index(lon, lat)
            
            if 0 <= row < src.height and 0 <= col < src.width:
                value = src.read(1)[row, col]
                return float(value) if value != src.nodata else None
            return None
    
    def get_elevation_stats_in_bbox(self, min_lon: float, min_lat: float,
                                    max_lon: float, max_lat: float) -> Dict:
        """Get elevation statistics within bounding box"""
        if not self.elev_meta:
            return None
            
        bbox_geom = box(min_lon, min_lat, max_lon, max_lat)
        bbox_gdf = gpd.GeoDataFrame([1], geometry=[bbox_geom], crs="EPSG:4326")
        
        with rasterio.open(self.elevation_file) as src:
            out_image, out_transform = mask(src, bbox_gdf.geometry, crop=True, nodata=src.nodata)
            elev_data = out_image[0]
            valid_data = elev_data[elev_data != src.nodata]
            
            if len(valid_data) == 0:
                return {'min': 0, 'max': 0, 'mean': 0}
                
            return {
                'min_elevation_m': float(valid_data.min()),
                'max_elevation_m': float(valid_data.max()),
                'mean_elevation_m': float(valid_data.mean()),
                'median_elevation_m': float(np.median(valid_data))
            }
    
    # ==================== COMBINED RISK ASSESSMENT ====================
    
    def assess_disaster_risk(self, lon: float, lat: float, radius_km: float = 50) -> Dict:
        """
        Comprehensive disaster risk assessment for a location
        Combines earthquake history, population density, and terrain
        """
        result = {
            'location': {'lon': lon, 'lat': lat},
            'radius_km': radius_km
        }
        
        # Earthquake risk
        nearby_quakes = self.get_earthquakes_near_point(lon, lat, radius_km)
        result['earthquake_risk'] = {
            'total_events': len(nearby_quakes),
            'major_events_m6+': len(nearby_quakes[nearby_quakes['mag'] >= 6.0]),
            'max_magnitude': float(nearby_quakes['mag'].max()) if len(nearby_quakes) > 0 else 0,
            'recent_events_5yr': len(nearby_quakes[nearby_quakes['year'] >= 2021])
        }
        
        # Population exposure
        pop_density = self.get_population_at_point(lon, lat)
        result['population_exposure'] = {
            'density_at_point': pop_density if pop_density else 0,
            'risk_level': 'HIGH' if pop_density and pop_density > 1000 else 'MEDIUM' if pop_density and pop_density > 100 else 'LOW'
        }
        
        # Terrain risk
        elevation = self.get_elevation_at_point(lon, lat)
        result['terrain_risk'] = {
            'elevation_m': elevation if elevation else 0,
            'flood_risk': 'HIGH' if elevation and elevation < 50 else 'MEDIUM' if elevation and elevation < 100 else 'LOW'
        }
        
        return result
    
    def get_summary_statistics(self) -> Dict:
        """Get summary statistics for all datasets"""
        stats = {
            'earthquake_data': {
                'total_events': len(self.earthquakes),
                'magnitude_range': [
                    float(self.earthquakes['mag'].min()),
                    float(self.earthquakes['mag'].max())
                ],
                'time_range': [
                    int(self.earthquakes['year'].min()),
                    int(self.earthquakes['year'].max())
                ],
                'major_events_m7+': len(self.earthquakes[self.earthquakes['mag'] >= 7.0])
            }
        }
        
        # Load population stats
        pop_stats_file = self.data_dir / "population/processed/statistics.json"
        if pop_stats_file.exists():
            with open(pop_stats_file) as f:
                stats['population_data'] = json.load(f)
        
        # Load elevation stats
        elev_stats_file = self.data_dir / "elevation/processed/statistics.json"
        if elev_stats_file.exists():
            with open(elev_stats_file) as f:
                stats['elevation_data'] = json.load(f)
        
        return stats


# ==================== EXAMPLE USAGE ====================

if __name__ == "__main__":
    # Initialize loader
    loader = NorthIndiaDataLoader()
    
    print("\n" + "="*60)
    print("NORTH INDIA DISASTER RISK DATA - SUMMARY")
    print("="*60)
    
    # Get overall statistics
    stats = loader.get_summary_statistics()
    
    print("\n📊 EARTHQUAKE DATA:")
    eq_stats = stats['earthquake_data']
    print(f"  Total events: {eq_stats['total_events']}")
    print(f"  Magnitude range: M{eq_stats['magnitude_range'][0]:.1f} - M{eq_stats['magnitude_range'][1]:.1f}")
    print(f"  Time period: {eq_stats['time_range'][0]} - {eq_stats['time_range'][1]}")
    print(f"  Major events (M7+): {eq_stats['major_events_m7+']}")
    
    if 'population_data' in stats:
        print("\n👥 POPULATION DATA:")
        pop_stats = stats['population_data']
        print(f"  Total population: {pop_stats['total_population']:,}")
        print(f"  Area: {pop_stats['area_km2']:,} km²")
        print(f"  Average density: {pop_stats['population_density_per_km2']:.1f} people/km²")
    
    if 'elevation_data' in stats:
        print("\n⛰️  ELEVATION DATA:")
        elev_stats = stats['elevation_data']
        print(f"  Elevation range: {elev_stats['elevation_range_m']['min']:.0f}m - {elev_stats['elevation_range_m']['max']:.0f}m")
        print(f"  Mean elevation: {elev_stats['elevation_range_m']['mean']:.0f}m")
        print(f"  Low-lying areas (<50m): {elev_stats['low_lying_areas']['below_10m'] + elev_stats['low_lying_areas']['10m_to_50m']:,} cells")
    
    print("\n" + "="*60)
    print("EXAMPLE QUERIES")
    print("="*60)
    
    # Example 1: Delhi risk assessment
    print("\n🔍 Disaster Risk Assessment: Delhi (28.6°N, 77.2°E)")
    delhi_risk = loader.assess_disaster_risk(77.2, 28.6, radius_km=100)
    print(f"  Earthquake Risk:")
    print(f"    - Total events (100km): {delhi_risk['earthquake_risk']['total_events']}")
    print(f"    - Major events (M6+): {delhi_risk['earthquake_risk']['major_events_m6+']}")
    print(f"    - Max magnitude: M{delhi_risk['earthquake_risk']['max_magnitude']:.1f}")
    print(f"  Population Exposure: {delhi_risk['population_exposure']['risk_level']}")
    print(f"  Terrain Risk: {delhi_risk['terrain_risk']['flood_risk']} (elevation: {delhi_risk['terrain_risk']['elevation_m']:.0f}m)")
    
    # Example 2: Major earthquakes
    print("\n🔴 Major Earthquakes (M7.0+):")
    major_quakes = loader.get_major_earthquakes(min_magnitude=7.0)
    for _, quake in major_quakes.iterrows():
        print(f"  M{quake['mag']:.1f} - {quake['latitude']:.2f}°N, {quake['longitude']:.2f}°E ({quake['year']})")
    
    # Example 3: Regional query
    print("\n📍 Regional Analysis: Delhi NCR (28-29°N, 76-78°E)")
    bbox_quakes = loader.get_earthquakes_in_bbox(76, 28, 78, 29, min_magnitude=5.0)
    print(f"  Earthquakes (M5.0+): {len(bbox_quakes)}")
    
    # Use point query for Delhi center
    delhi_pop = loader.get_population_at_point(77.2, 28.6)
    delhi_elev = loader.get_elevation_at_point(77.2, 28.6)
    print(f"  Population density at Delhi: {delhi_pop:.0f} people/hectare" if delhi_pop else "  Population: N/A")
    print(f"  Elevation at Delhi: {delhi_elev:.0f}m" if delhi_elev else "  Elevation: N/A")
    
    print("\n" + "="*60)
    print("✓ All data loaded and tested successfully!")
    print("="*60)
