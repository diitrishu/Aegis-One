@echo off
echo ========================================
echo DISASTER RESPONSE SYSTEM - DOCKER SETUP
echo ========================================
echo.
echo Starting Docker services...
echo This will start:
echo   - QGIS Server (WMS/WFS) on port 8081
echo   - PostGIS Database on port 5432
echo   - OSRM Routing Engine on port 5000
echo   - Routing API on port 8082
echo   - Disaster API on port 5050
echo.

cd backend

echo Checking Docker...
docker --version
if errorlevel 1 (
    echo ERROR: Docker is not installed or not running
    echo Please install Docker Desktop and start it
    pause
    exit /b 1
)

echo.
echo Building and starting services...
docker-compose up -d --build

echo.
echo Waiting for services to start...
timeout /t 10 /nobreak

echo.
echo ========================================
echo SERVICES STATUS
echo ========================================
docker-compose ps

echo.
echo ========================================
echo SERVICE URLS
echo ========================================
echo QGIS Server WMS: http://localhost:8081/ows/
echo PostGIS Database: localhost:5432
echo OSRM Routing: http://localhost:5000
echo Routing API: http://localhost:8082
echo Disaster API: http://localhost:5050
echo.
echo Frontend Dashboard: http://localhost:3000
echo.
echo ========================================
echo To stop services: docker-compose down
echo To view logs: docker-compose logs -f
echo ========================================
echo.
pause
