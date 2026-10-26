#!/bin/bash

# Download SRTM Elevation Data for North India
# ~90m resolution (CGIAR-CSI SRTM v4.1, 3 arc-second)

echo "Downloading SRTM Elevation Data for North India..."
echo "Resolution: ~90m (3 arc-second)"
echo "Source: CGIAR-CSI SRTM"
echo ""

# Create output directory
mkdir -p datasets/elevation

# North India coverage: N25-N35, E75-E85
# SRTM tiles are named by lower-left corner coordinates

# List of tiles needed for North India
# 5x5 degree SRTM tiles are numbered srtm_X_Y with
#   X = (longitude + 180) / 5 + 1   (X=52 -> 75E-80E, X=53 -> 80E-85E)
#   Y = (60 - latitude) / 5 + 1     (Y=06 -> 35N-30N, Y=07 -> 30N-25N)
# NOTE: an earlier version of this script listed srtm_44_*/srtm_45_*, which are
# the Middle East (35E-45E). If you have those files in datasets/elevation/,
# delete them before running process_elevation.py.
TILES=(
    "srtm_52_07"  # N25-N30, E75-E80
    "srtm_53_07"  # N25-N30, E80-E85
    "srtm_52_06"  # N30-N35, E75-E80
    "srtm_53_06"  # N30-N35, E80-E85
)

BASE_URL="https://srtm.csi.cgiar.org/wp-content/uploads/files/srtm_5x5/TIFF"

echo "Downloading ${#TILES[@]} SRTM tiles..."
echo ""

for tile in "${TILES[@]}"; do
    echo "Downloading ${tile}.zip..."
    wget -c -O "datasets/elevation/${tile}.zip" "${BASE_URL}/${tile}.zip"
    
    if [ -f "datasets/elevation/${tile}.zip" ]; then
        echo "Extracting ${tile}.zip..."
        unzip -o "datasets/elevation/${tile}.zip" -d datasets/elevation/
        echo "✓ ${tile} complete"
        echo ""
    else
        echo "✗ Failed to download ${tile}"
    fi
done

echo ""
echo "Download Summary:"
echo "----------------"
ls -lh datasets/elevation/*.tif 2>/dev/null || echo "No .tif files found"
echo ""
echo "Total size: $(du -sh datasets/elevation/ | cut -f1)"
