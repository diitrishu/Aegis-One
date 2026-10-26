# Dataset Sources and Documentation

## Overview

This directory contains 3 real, offline datasets downloaded to extend the AeGIS-1 for North India.

## Datasets

### 1. USGS Earthquake Catalog

**Purpose:** Historical seismic events for earthquake impact simulation

**Source:** USGS Earthquake Hazards Program  
**URL:** https://earthquake.usgs.gov/fdsnws/event/1/query.csv  
**License:** Public Domain (U.S. Government)

**Specifications:**
- **Region:** North India (20-35°N, 68-90°E)
- **Time Period:** 2000-01-01 to 2026-02-07
- **Magnitude:** 4.0+
- **Format:** CSV
- **Size:** ~528 KB
- **Records:** ~2,800 earthquake events

**Files:**
- `datasets/seismic/earthquakes.csv` - Raw CSV download
- `datasets/seismic/processed/earthquakes_north_india.gpkg` - Filtered GeoPackage (24-32°N, 72-88°E)
- `datasets/seismic/processed/statistics.json` - Event statistics

**Citation:**
```
U.S. Geological Survey, Earthquake Hazards Program (2026). 
Earthquake Catalog. Retrieved February 7, 2026, from 
https://earthquake.usgs.gov/fdsnws/event/1/
```

---

### 2. WorldPop Population Density

**Purpose:** Last-mile logistics, demand hotspot identification, survivor density estimation

**Source:** WorldPop, University of Southampton  
**URL:** https://data.worldpop.org/GIS/Population/Global_2000_2020/2020/IND/ind_ppp_2020_UNadj.tif  
**License:** Creative Commons Attribution 4.0 International (CC BY 4.0)

**Specifications:**
- **Region:** India (full country, cropped to North India in processing)
- **Year:** 2020
- **Resolution:** 100m (~3 arc-seconds)
- **Format:** GeoTIFF
- **Size:** ~1.5 GB (full India), ~200-300 MB (North India cropped)
- **Data Type:** Population count per pixel

**Files:**
- `datasets/population/ind_ppp_2020_UNadj.tif` - Full India raster
- `datasets/population/processed/north_india_population_2020.tif` - Cropped to North India (24-32°N, 72-88°E)
- `datasets/population/processed/high_density_zones.geojson` - Areas > 5,000 people/km²
- `datasets/population/processed/statistics.json` - Population statistics

**Citation:**
```
WorldPop (www.worldpop.org - School of Geography and Environmental Science, 
University of Southampton). India 100m Population (2020). 
https://doi.org/10.5258/SOTON/WP00675
```

---

### 3. SRTM Digital Elevation Model

**Purpose:** Flood spread simulation, low-lying area detection, elevation-based routing

**Source:** CGIAR-CSI SRTM v4.1  
**URL:** https://srtm.csi.cgiar.org/  
**License:** Public Domain (NASA/USGS data)

**Specifications:**
- **Region:** North India (tiles covering 24-32°N, 72-88°E)
- **Resolution:** ~90m (3 arc-second, CGIAR-CSI SRTM v4.1)
- **Format:** GeoTIFF
- **Size:** ~100-200 MB (4 tiles)
- **Tiles:** srtm_52_07, srtm_53_07, srtm_52_06, srtm_53_06 (75-85E, 25-35N)

**Files:**
- `datasets/elevation/srtm_*.tif` - Individual SRTM tiles
- `datasets/elevation/processed/north_india_dem.tif` - Merged DEM mosaic
- `datasets/elevation/processed/low_lying_areas.geojson` - Areas < 50m elevation (flood risk)
- `datasets/elevation/processed/slope.tif` - Slope gradient raster
- `datasets/elevation/processed/statistics.json` - Elevation statistics

**Citation:**
```
Jarvis A., H.I. Reuter, A. Nelson, E. Guevara, 2008, Hole-filled SRTM 
for the globe Version 4, available from the CGIAR-CSI SRTM 90m Database 
(http://srtm.csi.cgiar.org)
```

---

## Geographic Coverage

All datasets are focused on **North India** region:
- **Latitude:** 24°N to 32°N
- **Longitude:** 72°E to 88°E

This covers major states including:
- Uttar Pradesh
- Uttarakhand
- Himachal Pradesh
- Punjab
- Haryana
- Delhi
- Rajasthan (northern part)
- Madhya Pradesh (northern part)

---

## Processing Workflow

### 1. Download Data
```bash
# Download all datasets
bash download_all.sh

# Or download individually
bash download_earthquake.sh
bash download_population.sh
bash download_elevation.sh
```

### 2. Install Processing Dependencies
```bash
pip install -r requirements.txt
```

### 3. Process Data
```bash
# Process earthquake catalog
python process_earthquake.py

# Process population data (crops to North India)
python process_population.py

# Process elevation data (merge tiles)
python process_elevation.py
```

---

## Data Quality Notes

### Earthquake Data
- **Completeness:** Comprehensive for magnitude 4+ events
- **Accuracy:** ±5-10 km location accuracy for most events
- **Temporal Coverage:** 26 years (2000-2026)
- **Limitations:** Smaller earthquakes (< 4.0) not included

### Population Data
- **Completeness:** Full coverage of India
- **Accuracy:** Modeled data, not census counts
- **Temporal:** 2020 estimates
- **Limitations:** 100m resolution may not capture small settlements

### Elevation Data
- **Completeness:** Full coverage of North India
- **Accuracy:** ±16m vertical accuracy
- **Resolution:** ~90m horizontal
- **Limitations:** May have artifacts in mountainous areas

---

## Integration with Existing System

These datasets complement your existing data:

| Existing Data | New Dataset | Integration |
|---------------|-------------|-------------|
| Risk zones (607) | Elevation DEM | Validate flood zones with low-lying areas |
| Road networks (76,961) | Elevation + Population | Dynamic routing with elevation penalties |
| Facilities (5,832) | Population density | Capacity planning based on nearby population |
| Historical disasters (1,388) | Earthquake catalog | Validate seismic risk zones |
| Boundaries (20 districts) | All datasets | Aggregate statistics by district |

---

## File Sizes

| Dataset | Raw | Processed |
|---------|-----|-----------|
| Earthquake | 528 KB | ~2 MB |
| Population | 1.5 GB | ~200-300 MB (North India only) |
| Elevation | ~100-200 MB | ~150-250 MB |
| **Total** | **~1.6-1.7 GB** | **~350-550 MB** |

---

## Update Procedure

To update datasets with newer data:

1. **Earthquake:** Change `endtime` parameter in download_earthquake.sh
2. **Population:** Check WorldPop for newer year releases
3. **Elevation:** SRTM is static (from 2000), no updates needed

---

## License Compliance

- **USGS Earthquake:** Public domain, no attribution required
- **WorldPop:** CC BY 4.0 - **Attribution required** in publications
- **SRTM:** Public domain, citation recommended

**When publishing or deploying, include:**
```
This system uses population data from WorldPop (www.worldpop.org) 
licensed under CC BY 4.0.
```

---

## Contact & Support

- **USGS Earthquake:** https://earthquake.usgs.gov/contactus/
- **WorldPop:** info@worldpop.org
- **SRTM/CGIAR-CSI:** https://csi.cgiar.org/

---

*Last Updated: February 7, 2026*
