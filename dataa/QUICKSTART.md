# Quick Start: Using Downloaded Datasets

## Current Status

✅ **Earthquake Data:** Downloaded (528 KB)  
🔄 **Population Data:** Downloading... (1.5 GB, ~60-90 min)  
🔄 **Elevation Data:** Downloading... (100-200 MB, ~5-10 min)

## What to Do Next

### 1. Wait for Downloads to Complete

Monitor download progress in your terminal. The scripts will show progress bars.

### 2. Process the Data

Once downloads finish, run the processing scripts:

```bash
# Process earthquake data (filters to North India)
python process_earthquake.py

# Process population data (crops to North India only - saves space!)
python process_population.py

# Process elevation data (merges tiles, identifies flood-risk areas)
python process_elevation.py
```

### 3. Verify Processed Data

Check the `datasets/*/processed/` directories:

```bash
# Earthquake
ls datasets/seismic/processed/
# Expected: earthquakes_north_india.gpkg, statistics.json

# Population (North India only)
ls datasets/population/processed/
# Expected: north_india_population_2020.tif, high_density_zones.geojson, statistics.json

# Elevation
ls datasets/elevation/processed/
# Expected: north_india_dem.tif, low_lying_areas.geojson, slope.tif, statistics.json
```

## How to Use the Data

### Flood Simulation
- Use `north_india_dem.tif` for elevation
- Use `low_lying_areas.geojson` to identify flood-prone zones
- Combine with your existing flood risk zones

### Last-Mile Logistics
- Use `north_india_population_2020.tif` for population density
- Use `high_density_zones.geojson` for demand hotspots
- Calculate affected population in disaster radius

### Earthquake Simulation
- Use `earthquakes_north_india.gpkg` for historical events
- Combine with your existing earthquake risk zones
- Model infrastructure damage based on magnitude/distance

### Dynamic Routing
- Use `slope.tif` for road accessibility
- Use `low_lying_areas.geojson` to avoid flood zones
- Combine with your existing road network (76,961 segments)

## Integration Example

```python
import geopandas as gpd
import rasterio

# Load processed data
earthquakes = gpd.read_file("datasets/seismic/processed/earthquakes_north_india.gpkg")
low_lying = gpd.read_file("datasets/elevation/processed/low_lying_areas.geojson")

# Load population raster
with rasterio.open("datasets/population/processed/north_india_population_2020.tif") as src:
    population = src.read(1)
    
# Now combine with your existing road network, facilities, etc.
```

## File Sizes After Processing

- **Earthquake:** ~2 MB (GeoPackage)
- **Population:** ~200-300 MB (North India cropped from 1.5 GB)
- **Elevation:** ~150-250 MB (merged tiles + slope)

**Total processed:** ~350-550 MB (much smaller than raw 1.6-1.7 GB!)

## Troubleshooting

**Download failed?**
- Check internet connection
- Re-run individual download script: `bash download_<dataset>.sh`

**Processing errors?**
- Install dependencies: `pip install -r requirements.txt`
- Check Python version: `python --version` (need 3.8+)

**Out of disk space?**
- Delete raw population file after processing (saves 1.2 GB)
- Delete SRTM .zip files after extraction

## Next Steps

1. ✅ Download data (in progress)
2. ⏳ Process data (run scripts above)
3. ⏳ Integrate with existing disaster response system
4. ⏳ Build flood simulation using DEM
5. ⏳ Implement population-based logistics
6. ⏳ Create earthquake impact models

See `DATA_SOURCES.md` for detailed dataset documentation.
