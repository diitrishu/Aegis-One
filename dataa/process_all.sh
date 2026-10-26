#!/bin/bash

# Process all downloaded datasets
# Run this after all downloads complete

echo "=========================================="
echo "  Processing All Datasets"
echo "=========================================="
echo ""

# Check if Python dependencies are installed
echo "Checking Python dependencies..."
pip show geopandas > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️  Installing required Python packages..."
    pip install -r requirements.txt
fi

echo ""
echo "=========================================="
echo "  Step 1/3: Processing Earthquake Data"
echo "=========================================="
python process_earthquake.py

echo ""
echo "=========================================="
echo "  Step 2/3: Processing Population Data"
echo "=========================================="
echo "⚠️  This will CROP to North India only (saves ~1.2 GB)"
python process_population.py

echo ""
echo "=========================================="
echo "  Step 3/3: Processing Elevation Data"
echo "=========================================="
python process_elevation.py

echo ""
echo "=========================================="
echo "  Processing Complete!"
echo "=========================================="
echo ""
echo "Processed files are in datasets/*/processed/"
echo ""
echo "Summary:"
ls -lh datasets/seismic/processed/ 2>/dev/null
ls -lh datasets/population/processed/ 2>/dev/null
ls -lh datasets/elevation/processed/ 2>/dev/null
echo ""
echo "See QUICKSTART.md for next steps"
