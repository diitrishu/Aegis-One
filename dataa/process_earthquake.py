"""
Process USGS Earthquake Catalog
- Parse CSV to GeoDataFrame
- Filter for North India region
- Create spatial index
- Generate statistics
"""

import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
import json
from pathlib import Path

# Paths
INPUT_CSV = Path("datasets/seismic/earthquakes.csv")
OUTPUT_DIR = Path("datasets/seismic/processed")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("Processing USGS Earthquake Catalog...")
print(f"Input: {INPUT_CSV}")

# Load CSV
df = pd.read_csv(INPUT_CSV)
print(f"\nLoaded {len(df)} earthquake events")

# Create GeoDataFrame
geometry = [Point(lon, lat) for lon, lat in zip(df['longitude'], df['latitude'])]
gdf = gpd.GeoDataFrame(df, geometry=geometry, crs="EPSG:4326")

# Filter for North India (more focused region)
# North India: 24-32°N, 72-88°E
north_india = gdf[
    (gdf['latitude'] >= 24) & (gdf['latitude'] <= 32) &
    (gdf['longitude'] >= 72) & (gdf['longitude'] <= 88)
].copy()

print(f"Filtered to {len(north_india)} events in North India region")

# Generate statistics
stats = {
    "total_events": len(north_india),
    "magnitude_range": {
        "min": float(north_india['mag'].min()),
        "max": float(north_india['mag'].max()),
        "mean": float(north_india['mag'].mean())
    },
    "depth_range_km": {
        "min": float(north_india['depth'].min()),
        "max": float(north_india['depth'].max()),
        "mean": float(north_india['depth'].mean())
    },
    "time_range": {
        "earliest": str(north_india['time'].min()),
        "latest": str(north_india['time'].max())
    },
    "magnitude_distribution": {
        "mag_4_5": int(((north_india['mag'] >= 4) & (north_india['mag'] < 5)).sum()),
        "mag_5_6": int(((north_india['mag'] >= 5) & (north_india['mag'] < 6)).sum()),
        "mag_6_7": int(((north_india['mag'] >= 6) & (north_india['mag'] < 7)).sum()),
        "mag_7_plus": int((north_india['mag'] >= 7).sum())
    }
}

# Save to GeoPackage
output_gpkg = OUTPUT_DIR / "earthquakes_north_india.gpkg"
north_india.to_file(output_gpkg, driver="GPKG")
print(f"\n✓ Saved to: {output_gpkg}")

# Save statistics
stats_file = OUTPUT_DIR / "statistics.json"
with open(stats_file, 'w') as f:
    json.dump(stats, f, indent=2)
print(f"✓ Statistics saved to: {stats_file}")

# Print summary
print("\n" + "="*50)
print("EARTHQUAKE DATA SUMMARY")
print("="*50)
print(f"Total events (North India): {stats['total_events']}")
print(f"Magnitude range: {stats['magnitude_range']['min']:.1f} - {stats['magnitude_range']['max']:.1f}")
print(f"Time period: {stats['time_range']['earliest'][:10]} to {stats['time_range']['latest'][:10]}")
print(f"\nMagnitude distribution:")
print(f"  4.0-4.9: {stats['magnitude_distribution']['mag_4_5']} events")
print(f"  5.0-5.9: {stats['magnitude_distribution']['mag_5_6']} events")
print(f"  6.0-6.9: {stats['magnitude_distribution']['mag_6_7']} events")
print(f"  7.0+:    {stats['magnitude_distribution']['mag_7_plus']} events")
print("="*50)
