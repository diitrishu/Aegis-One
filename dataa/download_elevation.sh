#!/bin/bash

# Download SRTM Elevation Data for North India
# 30m resolution (SRTM 1 Arc-Second)

echo "Downloading SRTM Elevation Data for North India..."
echo "Resolution: 30m (1 arc-second)"
echo "Source: CGIAR-CSI SRTM"
echo ""

# Create output directory
mkdir -p datasets/elevation

# North India coverage: approximately N25-N35, E75-E85
# SRTM tiles are named by lower-left corner coordinates

# List of tiles needed for North India
# Format: srtm_XX_YY where XX is longitude zone, YY is latitude zone
TILES=(
    "srtm_44_06"  # N25-N30, E75-E80
    "srtm_45_06"  # N25-N30, E80-E85
    "srtm_44_05"  # N30-N35, E75-E80
    "srtm_45_05"  # N30-N35, E80-E85
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
