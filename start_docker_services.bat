@echo off
echo ========================================
echo AEGIS-1 - DOCKER SETUP
echo ========================================
echo.
echo This starts the whole system in containers:
echo   - Backend API         port 5000
echo   - Routing API         port 8082  (bundled OpenStreetMap road graph)
echo   - WMS map server      port 8081
echo   - Location tracking   port 5052
echo   - Frontend            port 3000
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
docker compose up -d --build

echo.
docker compose ps

echo.
echo ========================================
echo Open the dashboard: http://localhost:3000
echo To stop services:   stop_docker_services.bat
echo To view logs:       docker compose logs -f   (run inside backend\)
echo ========================================
echo.
pause
