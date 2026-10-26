@echo off
echo ========================================
echo  AEGIS-1 DISASTER RESPONSE SYSTEM
echo  SYSTEM STARTUP
echo ========================================
echo.

REM First run only:  pip install -r backend\requirements.api.txt  and  cd frontend ^&^& npm install

REM Kill any existing processes
echo Cleaning up old processes...
taskkill /F /IM node.exe 2>nul
timeout /t 1 /nobreak >nul

echo Starting Unified Backend API (Port 5000)...
start "Backend API" cmd /k "cd backend && python simple_disaster_api.py"
timeout /t 2 /nobreak >nul

echo Starting Routing API (Port 8082)...
start "Routing API" cmd /k "cd backend && python routing_api.py"
timeout /t 2 /nobreak >nul

echo Starting WMS Map Server (Port 8081)...
start "WMS Server" cmd /k "cd backend && python wms_server.py"
timeout /t 2 /nobreak >nul

echo Starting Location Tracking API (Port 5052)...
start "Location API" cmd /k "cd backend && python location_tracking_api.py"
timeout /t 2 /nobreak >nul

echo Starting Frontend Server (Port 3000)...
start "Frontend Server" cmd /k "cd frontend && node server.js"

echo.
echo ========================================
echo SYSTEM IS STARTING UP!
echo ========================================
echo.
echo Please wait a few seconds for all services to initialize.
echo.
echo Services running:
echo   - Backend API:          http://localhost:5000
echo   - Routing (OSM roads):  http://localhost:8082
echo   - WMS map layers:       http://localhost:8081/ows/
echo   - Location Tracking:    http://localhost:5052
echo   - Frontend Server:      http://localhost:3000
echo.
echo Access the dashboard in your browser:
echo http://localhost:3000
echo.
echo Close the separate command windows to stop the servers.
echo ========================================
echo.
pause
