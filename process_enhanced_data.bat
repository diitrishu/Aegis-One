@echo off
REM Process Enhanced Datasets for AeGIS-1 v2.0
REM This script processes earthquake, population, and elevation data

echo ============================================================
echo ENHANCED DATA PROCESSING - AeGIS-1 v2.0
echo ============================================================
echo.

cd dataa

echo [1/4] Checking Python dependencies...
python -c "import geopandas, rasterio, pandas, numpy" 2>nul
if errorlevel 1 (
    echo Installing required packages...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)
echo OK - All dependencies installed
echo.

echo [2/4] Processing Earthquake Data...
echo This will filter USGS catalog to North India region
python process_earthquake.py
if errorlevel 1 (
    echo WARNING: Earthquake processing failed
) else (
    echo OK - Earthquake data processed
)
echo.

echo [3/4] Processing Population Data...
echo This will crop 1.5GB raster to North India (~200-300MB)
echo This may take 5-10 minutes...
python process_population.py
if errorlevel 1 (
    echo WARNING: Population processing failed
) else (
    echo OK - Population data processed
)
echo.

echo [4/4] Processing Elevation Data...
echo This will merge SRTM tiles and calculate slope
python process_elevation.py
if errorlevel 1 (
    echo WARNING: Elevation processing failed
) else (
    echo OK - Elevation data processed
)
echo.

echo ============================================================
echo PROCESSING COMPLETE
echo ============================================================
echo.
echo Processed data location: dataa/datasets/*/processed/
echo.
echo Next steps:
echo 1. Test enhanced data loader: python backend/enhanced_data_loader.py
echo 2. Update disaster response system to use enhanced data
echo 3. Run system tests
echo.

cd ..

pause
