#!/bin/bash

# Download USGS Earthquake Catalog for North India
# Magnitude 4+, from 2000-01-01 to 2026-02-07

echo "Downloading USGS Earthquake Catalog..."
echo "Region: North India (20-35°N, 68-90°E)"
echo "Magnitude: 4.0+"
echo "Time period: 2000-2026"
echo ""

# Create output directory
mkdir -p datasets/seismic

# Download earthquake data
wget -O datasets/seismic/earthquakes.csv \
  "https://earthquake.usgs.gov/fdsnws/event/1/query.csv?starttime=2000-01-01&endtime=2026-02-07&minlatitude=20&maxlatitude=35&minlongitude=68&maxlongitude=90&minmagnitude=4&orderby=time"

# Check if download was successful
if [ -f datasets/seismic/earthquakes.csv ]; then
    echo ""
    echo "✓ Download complete!"
    echo "File: datasets/seismic/earthquakes.csv"
    echo "Size: $(du -h datasets/seismic/earthquakes.csv | cut -f1)"
    echo ""
    echo "Preview (first 5 lines):"
    head -5 datasets/seismic/earthquakes.csv
else
    echo "✗ Download failed!"
    exit 1
fi
