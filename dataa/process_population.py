"""
Process WorldPop Population Density - CROP TO NORTH INDIA ONLY
- Load India population raster
- Crop to North India bounding box (24-32°N, 72-88°E)
- Extract high-density zones
- Generate statistics
"""

import rasterio
from rasterio.mask import mask
from shapely.geometry import box
import geopandas as gpd
import numpy as np
import json
from pathlib import Path

# Paths
INPUT_TIF = Path("datasets/population/ind_ppp_2020_UNadj.tif")
OUTPUT_DIR = Path("datasets/population/processed")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("Processing WorldPop Population Density...")
print(f"Input: {INPUT_TIF}")

# North India bounding box (24-32°N, 72-88°E)
NORTH_INDIA_BBOX = box(72, 24, 88, 32)

print("\n⚠️  Cropping to North India region only (24-32°N, 72-88°E)")
print("This will significantly reduce file size...")

# Open raster and crop to North India
with rasterio.open(INPUT_TIF) as src:
    print(f"\nOriginal raster size: {src.width} x {src.height} pixels")
    print(f"Original bounds: {src.bounds}")
    
    # Create GeoDataFrame with bounding box
    bbox_gdf = gpd.GeoDataFrame([1], geometry=[NORTH_INDIA_BBOX], crs="EPSG:4326")
    
    # Crop raster to bounding box
    out_image, out_transform = mask(src, bbox_gdf.geometry, crop=True, nodata=src.nodata)
    out_meta = src.meta.copy()
    
    # Update metadata
    out_meta.update({
        "driver": "GTiff",
        "height": out_image.shape[1],
        "width": out_image.shape[2],
        "transform": out_transform,
        "compress": "lzw"  # Compress to save space
    })
    
    print(f"Cropped raster size: {out_meta['width']} x {out_meta['height']} pixels")
    
    # Save cropped raster
    output_tif = OUTPUT_DIR / "north_india_population_2020.tif"
    with rasterio.open(output_tif, "w", **out_meta) as dest:
        dest.write(out_image)
    
    print(f"\n✓ Saved cropped raster to: {output_tif}")
    
    # Calculate statistics
    pop_data = out_image[0]
    pop_data_valid = pop_data[pop_data != src.nodata]
    
    stats = {
        "region": "North India (24-32°N, 72-88°E)",
        "total_population": int(pop_data_valid.sum()),
        "area_km2": int((out_meta['width'] * out_meta['height'] * 100 * 100) / 1_000_000),  # 100m resolution
        "population_density_per_km2": float(pop_data_valid.sum() / ((out_meta['width'] * out_meta['height'] * 100 * 100) / 1_000_000)),
        "statistics": {
            "min": float(pop_data_valid.min()),
            "max": float(pop_data_valid.max()),
            "mean": float(pop_data_valid.mean()),
            "median": float(np.median(pop_data_valid))
        },
        "high_density_zones": {
            "cells_over_1000_per_km2": int((pop_data_valid > 1000).sum()),
            "cells_over_5000_per_km2": int((pop_data_valid > 5000).sum()),
            "cells_over_10000_per_km2": int((pop_data_valid > 10000).sum())
        }
    }
    
    # Save statistics
    stats_file = OUTPUT_DIR / "statistics.json"
    with open(stats_file, 'w') as f:
        json.dump(stats, f, indent=2)
    print(f"✓ Statistics saved to: {stats_file}")
    
    # Identify high-density zones (> 5000 people/km²)
    print("\nIdentifying high-density zones (> 5000 people/km²)...")
    high_density_mask = pop_data > 5000
    
    # Create GeoJSON of high-density cells
    high_density_cells = []
    rows, cols = np.where(high_density_mask)
    
    # Sample only every 10th cell to avoid huge file
    sample_indices = np.arange(0, len(rows), 10)
    
    for idx in sample_indices[:1000]:  # Limit to 1000 cells
        row, col = rows[idx], cols[idx]
        # Get cell bounds
        cell_bounds = rasterio.transform.array_bounds(1, 1, out_transform * rasterio.Affine.translation(col, row))
        cell_box = box(*cell_bounds)
        high_density_cells.append({
            'geometry': cell_box,
            'population': float(pop_data[row, col])
        })
    
    if high_density_cells:
        hotspots_gdf = gpd.GeoDataFrame(high_density_cells, crs="EPSG:4326")
        hotspots_file = OUTPUT_DIR / "high_density_zones.geojson"
        hotspots_gdf.to_file(hotspots_file, driver="GeoJSON")
        print(f"✓ High-density zones saved to: {hotspots_file}")

# Print summary
print("\n" + "="*50)
print("POPULATION DATA SUMMARY (NORTH INDIA)")
print("="*50)
print(f"Total population: {stats['total_population']:,}")
print(f"Area: {stats['area_km2']:,} km²")
print(f"Average density: {stats['population_density_per_km2']:.1f} people/km²")
print(f"\nHigh-density zones:")
print(f"  > 1,000/km²:  {stats['high_density_zones']['cells_over_1000_per_km2']:,} cells")
print(f"  > 5,000/km²:  {stats['high_density_zones']['cells_over_5000_per_km2']:,} cells")
print(f"  > 10,000/km²: {stats['high_density_zones']['cells_over_10000_per_km2']:,} cells")
print("="*50)
