"""
Process SRTM Elevation Data for North India
- Merge multiple SRTM tiles
- Identify low-lying areas for flood risk
- Generate slope raster
"""

import rasterio
from rasterio.merge import merge
from rasterio.warp import calculate_default_transform, reproject, Resampling
import numpy as np
import geopandas as gpd
from shapely.geometry import box
import json
from pathlib import Path
import glob

# Paths
INPUT_DIR = Path("datasets/elevation")
OUTPUT_DIR = Path("datasets/elevation/processed")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("Processing SRTM Elevation Data...")

# Find all SRTM .tif files
tif_files = list(INPUT_DIR.glob("*.tif"))
print(f"\nFound {len(tif_files)} SRTM tiles:")
for f in tif_files:
    print(f"  - {f.name}")

if not tif_files:
    print("\n⚠️  No .tif files found. Make sure SRTM tiles are extracted from .zip files")
    exit(1)

# Open all tiles
src_files_to_mosaic = []
for fp in tif_files:
    src = rasterio.open(fp)
    src_files_to_mosaic.append(src)

print("\nMerging tiles into single DEM...")
mosaic, out_trans = merge(src_files_to_mosaic)

# Update metadata
out_meta = src_files_to_mosaic[0].meta.copy()
out_meta.update({
    "driver": "GTiff",
    "height": mosaic.shape[1],
    "width": mosaic.shape[2],
    "transform": out_trans,
    "compress": "lzw"
})

# Save merged DEM
output_dem = OUTPUT_DIR / "north_india_dem.tif"
with rasterio.open(output_dem, "w", **out_meta) as dest:
    dest.write(mosaic)

print(f"✓ Merged DEM saved to: {output_dem}")

# Close source files
for src in src_files_to_mosaic:
    src.close()

# Calculate statistics
elevation_data = mosaic[0]
valid_data = elevation_data[elevation_data != out_meta.get('nodata', -32768)]

stats = {
    "elevation_range_m": {
        "min": float(valid_data.min()),
        "max": float(valid_data.max()),
        "mean": float(valid_data.mean()),
        "median": float(np.median(valid_data))
    },
    "low_lying_areas": {
        "below_10m": int((valid_data < 10).sum()),
        "10m_to_50m": int(((valid_data >= 10) & (valid_data < 50)).sum()),
        "50m_to_100m": int(((valid_data >= 50) & (valid_data < 100)).sum())
    },
    "raster_info": {
        "width": mosaic.shape[2],
        "height": mosaic.shape[1],
        "resolution_m": 30
    }
}

# Identify low-lying areas (< 50m) for flood risk
print("\nIdentifying low-lying areas (< 50m elevation)...")
low_lying_mask = (elevation_data < 50) & (elevation_data >= 0)

# Create GeoJSON of low-lying areas (sample to avoid huge file)
low_lying_cells = []
rows, cols = np.where(low_lying_mask)

# Sample every 100th cell
sample_indices = np.arange(0, len(rows), 100)

for idx in sample_indices[:5000]:  # Limit to 5000 cells
    row, col = rows[idx], cols[idx]
    # Get cell bounds
    cell_bounds = rasterio.transform.array_bounds(1, 1, out_trans * rasterio.Affine.translation(col, row))
    cell_box = box(*cell_bounds)
    low_lying_cells.append({
        'geometry': cell_box,
        'elevation_m': float(elevation_data[row, col])
    })

if low_lying_cells:
    low_lying_gdf = gpd.GeoDataFrame(low_lying_cells, crs="EPSG:4326")
    low_lying_file = OUTPUT_DIR / "low_lying_areas.geojson"
    low_lying_gdf.to_file(low_lying_file, driver="GeoJSON")
    print(f"✓ Low-lying areas saved to: {low_lying_file}")

# Calculate slope (simple gradient)
print("\nCalculating slope...")
# Use numpy gradient for simple slope calculation
dy, dx = np.gradient(elevation_data.astype(float))
slope = np.sqrt(dx**2 + dy**2)

# Save slope raster
slope_meta = out_meta.copy()
with rasterio.open(OUTPUT_DIR / "slope.tif", "w", **slope_meta) as dest:
    dest.write(slope.astype(np.float32), 1)

print(f"✓ Slope raster saved to: {OUTPUT_DIR / 'slope.tif'}")

# Save statistics
stats_file = OUTPUT_DIR / "statistics.json"
with open(stats_file, 'w') as f:
    json.dump(stats, f, indent=2)
print(f"✓ Statistics saved to: {stats_file}")

# Print summary
print("\n" + "="*50)
print("ELEVATION DATA SUMMARY (NORTH INDIA)")
print("="*50)
print(f"Elevation range: {stats['elevation_range_m']['min']:.1f}m - {stats['elevation_range_m']['max']:.1f}m")
print(f"Mean elevation: {stats['elevation_range_m']['mean']:.1f}m")
print(f"\nLow-lying areas (flood risk):")
print(f"  < 10m:      {stats['low_lying_areas']['below_10m']:,} cells")
print(f"  10-50m:     {stats['low_lying_areas']['10m_to_50m']:,} cells")
print(f"  50-100m:    {stats['low_lying_areas']['50m_to_100m']:,} cells")
print(f"\nRaster: {stats['raster_info']['width']} x {stats['raster_info']['height']} pixels @ 30m resolution")
print("="*50)
