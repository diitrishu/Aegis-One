#!/bin/bash

# Download WorldPop Population Density for India (2020)
# 100m resolution, UN-adjusted

echo "Downloading WorldPop Population Density..."
echo "Country: India"
echo "Year: 2020"
echo "Resolution: 100m"
echo ""

# Create output directory
mkdir -p datasets/population

# Download population data
wget -O datasets/population/ind_ppp_2020_UNadj.tif \
  "https://data.worldpop.org/GIS/Population/Global_2000_2020/2020/IND/ind_ppp_2020_UNadj.tif"

# Check if download was successful
if [ -f datasets/population/ind_ppp_2020_UNadj.tif ]; then
    echo ""
    echo "✓ Download complete!"
    echo "File: datasets/population/ind_ppp_2020_UNadj.tif"
    echo "Size: $(du -h datasets/population/ind_ppp_2020_UNadj.tif | cut -f1)"
else
    echo "✗ Download failed!"
    exit 1
fi
