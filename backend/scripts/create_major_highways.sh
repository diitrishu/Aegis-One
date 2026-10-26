#!/bin/bash
cd "$(dirname "$0")/../data"

# Create a filtered highway layer with only major roads
ogr2ogr -f GPKG highways_major_lines.gpkg highways_lines.gpkg \
  -sql "SELECT * FROM highways WHERE highway IN ('motorway', 'trunk', 'primary', 'secondary') OR name LIKE '%NH%' OR name LIKE '%SH%' LIMIT 10000" \
  -nln highways_major

echo "Created highways_major_lines.gpkg with filtered highways"