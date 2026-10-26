#!/bin/bash

# Master script to download all missing datasets
# Downloads: Earthquake catalog, Population density, Elevation data

echo "=========================================="
echo "  Missing Dataset Download - Master Script"
echo "=========================================="
echo ""
echo "This will download:"
echo "  1. USGS Earthquake Catalog (~10-50 MB)"
echo "  2. WorldPop Population Density (~500 MB - 1 GB)"
echo "  3. SRTM Elevation Tiles (~1-2 GB)"
echo ""
echo "Total download: ~2-3 GB"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

echo ""
echo "=========================================="
echo "  Step 1/3: Downloading Earthquake Data"
echo "=========================================="
bash download_earthquake.sh

echo ""
echo "=========================================="
echo "  Step 2/3: Downloading Population Data"
echo "=========================================="
bash download_population.sh

echo ""
echo "=========================================="
echo "  Step 3/3: Downloading Elevation Data"
echo "=========================================="
bash download_elevation.sh

echo ""
echo "=========================================="
echo "  Download Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "--------"
echo "Earthquake data: $(du -h datasets/seismic/earthquakes.csv 2>/dev/null | cut -f1 || echo 'Not found')"
echo "Population data: $(du -h datasets/population/ind_ppp_2020_UNadj.tif 2>/dev/null | cut -f1 || echo 'Not found')"
echo "Elevation data:  $(du -sh datasets/elevation/ 2>/dev/null | cut -f1 || echo 'Not found')"
echo ""
echo "Next steps:"
echo "  1. Run processing scripts to prepare data"
echo "  2. Integrate with existing disaster response system"
