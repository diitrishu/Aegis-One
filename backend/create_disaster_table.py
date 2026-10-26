#!/usr/bin/env python3
"""
Create user_disaster_areas table in the GeoPackage database
"""
import sqlite3
import os

GEOPACKAGE_PATH = "data/disaster_data.gpkg"

def create_disaster_table():
    """Create the user_disaster_areas table if it doesn't exist"""
    
    if not os.path.exists(GEOPACKAGE_PATH):
        print(f"Error: GeoPackage not found at {GEOPACKAGE_PATH}")
        return False
    
    try:
        with sqlite3.connect(GEOPACKAGE_PATH) as conn:
            cursor = conn.cursor()
            
            # Create the table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_disaster_areas (
                    fid INTEGER PRIMARY KEY AUTOINCREMENT,
                    disaster_type TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    description TEXT,
                    created_at TEXT NOT NULL,
                    created_by TEXT DEFAULT 'web_user',
                    geometry_json TEXT NOT NULL
                )
            """)
            
            # Create index for faster queries
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_disaster_type 
                ON user_disaster_areas(disaster_type)
            """)
            
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_severity 
                ON user_disaster_areas(severity)
            """)
            
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_created_at 
                ON user_disaster_areas(created_at)
            """)
            
            conn.commit()
            
            # Check if table was created
            cursor.execute("""
                SELECT COUNT(*) FROM user_disaster_areas
            """)
            count = cursor.fetchone()[0]
            
            print(f"✅ Table 'user_disaster_areas' created successfully!")
            print(f"   Current disaster count: {count}")
            
            return True
            
    except Exception as e:
        print(f"❌ Error creating table: {e}")
        return False

if __name__ == "__main__":
    print("Creating user_disaster_areas table...")
    print(f"GeoPackage: {GEOPACKAGE_PATH}")
    print("-" * 50)
    
    success = create_disaster_table()
    
    if success:
        print("\n✅ Database setup complete!")
        print("\nYou can now:")
        print("1. Create disasters via the disasters.html page")
        print("2. Generate reports via the analytics.html page")
    else:
        print("\n❌ Database setup failed!")
