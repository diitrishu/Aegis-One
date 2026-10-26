#!/bin/bash
cd "$(dirname "$0")/../data"

echo "Creating multi-level highway system..."

# Level 1: Major highways only (motorways, trunks) - for zoom 6-10
echo "Creating Level 1: Major highways..."
ogr2ogr -f GPKG highways_level1.gpkg highways_lines.gpkg \
  -sql "SELECT * FROM highways WHERE highway IN ('motorway', 'trunk') LIMIT 2000" \
  -nln highways_major

# Level 2: Primary and secondary roads - for zoom 11-13  
echo "Creating Level 2: Primary roads..."
ogr2ogr -f GPKG highways_level2.gpkg highways_lines.gpkg \
  -sql "SELECT * FROM highways WHERE highway IN ('motorway', 'trunk', 'primary', 'secondary') LIMIT 5000" \
  -nln highways_primary

# Level 3: All major roads including tertiary - for zoom 14+
echo "Creating Level 3: All roads..."
ogr2ogr -f GPKG highways_level3.gpkg highways_lines.gpkg \
  -sql "SELECT * FROM highways WHERE highway IN ('motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential') LIMIT 10000" \
  -nln highways_all

echo "Highway levels created successfully!"
echo "Level 1: $(ogrinfo highways_level1.gpkg highways_major -so | grep 'Feature Count')"
echo "Level 2: $(ogrinfo highways_level2.gpkg highways_primary -so | grep 'Feature Count')"  
echo "Level 3: $(ogrinfo highways_level3.gpkg highways_all -so | grep 'Feature Count')"