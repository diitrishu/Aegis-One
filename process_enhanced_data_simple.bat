@echo off
REM Simplified Data Processing - Works WITHOUT rasterio
REM Only processes earthquake data (no population/elevation)

echo ============================================================
echo SIMPLIFIED DATA PROCESSING - Earthquake Data Only
echo ============================================================
echo.
echo This version works without rasterio installation issues.
echo You'll get earthquake features immediately!
echo.

cd dataa

echo [1/2] Checking Python dependencies...
python -c "import geopandas, pandas, numpy" 2>nul
if errorlevel 1 (
    echo Installing required packages (no rasterio)...
    pip install geopandas pandas numpy shapely pyproj
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)
echo OK - Core dependencies installed
echo.

echo [2/2] Processing Earthquake Data...
echo This will filter USGS catalog to North India region
python process_earthquake.py
if errorlevel 1 (
    echo ERROR: Earthquake processing failed
    pause
    exit /b 1
) else (
    echo OK - Earthquake data processed successfully!
)
echo.

echo ============================================================
echo PROCESSING COMPLETE
echo ============================================================
echo.
echo Processed: Earthquake catalog (~2,800 events)
echo Location: dataa/datasets/seismic/processed/
echo.
echo What you can do now:
echo 1. Query 26 years of earthquake history
echo 2. Analyze seismic patterns
echo 3. Assess earthquake risk for facilities
echo.
echo To add population and elevation features later:
echo - Install rasterio (see WINDOWS_RASTERIO_FIX.md)
echo - Run: python process_population.py
echo - Run: python process_elevation.py
echo.

cd ..

echo Testing earthquake data loader...
python backend/test_earthquake_only.py

pause
