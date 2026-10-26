#!/usr/bin/env python3
"""
Convert risk zone GeoPackages to GeoJSON for web display
"""

import geopandas as gpd
import json
import os

def simplify_and_convert(input_file, output_file, tolerance=0.01):
    """Convert GeoPackage to simplified GeoJSON"""
    try:
        print(f"Reading {input_file}...")
        gdf = gpd.read_file(input_file)
        
        # Simplify geometries to reduce file size
        print(f"Simplifying geometries (tolerance={tolerance})...")
        gdf['geometry'] = gdf['geometry'].simplify(tolerance, preserve_topology=True)
        
        # Convert to WGS84 if needed
        if gdf.crs and gdf.crs.to_epsg() != 4326:
            print("Converting to WGS84...")
            gdf = gdf.to_crs(epsg=4326)
        
        # Save as GeoJSON
        print(f"Saving to {output_file}...")
        gdf.to_file(output_file, driver='GeoJSON')
        
        # Get file size
        size_mb = os.path.getsize(output_file) / (1024 * 1024)
        print(f"✅ Created {output_file} ({size_mb:.2f} MB)")
        print(f"   Features: {len(gdf)}")
        
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    # Create output directory
    output_dir = "frontend/public/data/risk_zones"
    os.makedirs(output_dir, exist_ok=True)
    
    print("\n🗺️  Converting Risk Zone Data to GeoJSON\n")
    print("=" * 60)
    
    # Risk zones to convert
    conversions = [
        {
            'input': 'backend/data/disasters/earthquake_zones.gpkg',
            'output': f'{output_dir}/earthquake_zones.geojson',
            'tolerance': 0.01,
            'name': 'Earthquake Risk Zones'
        },
        {
            'input': 'backend/data/disasters/flood_zones.gpkg',
            'output': f'{output_dir}/flood_zones.geojson',
            'tolerance': 0.01,
            'name': 'Flood Risk Zones'
        },
        {
            'input': 'backend/data/disasters/landslide_zones.gpkg',
            'output': f'{output_dir}/landslide_zones.geojson',
            'tolerance': 0.01,
            'name': 'Landslide Risk Zones'
        },
        {
            'input': 'backend/data/disasters/fire_risk_zones.gpkg',
            'output': f'{output_dir}/fire_risk_zones.geojson',
            'tolerance': 0.01,
            'name': 'Fire Risk Zones'
        }
    ]
    
    success_count = 0
    for conv in conversions:
        print(f"\n📍 {conv['name']}")
        print("-" * 60)
        if simplify_and_convert(conv['input'], conv['output'], conv['tolerance']):
            success_count += 1
    
    print("\n" + "=" * 60)
    print(f"✅ Converted {success_count}/{len(conversions)} risk zones successfully!")
    print(f"📁 Output directory: {output_dir}")
    print("\n🚀 Risk zones are ready for web display!")

if __name__ == '__main__':
    main()
