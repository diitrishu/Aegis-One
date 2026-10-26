@echo off
echo ========================================
echo STOPPING DOCKER SERVICES
echo ========================================
echo.

cd backend
docker compose down

echo.
echo All services stopped.
echo.
pause
