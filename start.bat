@echo off
echo ========================================================
echo          TERMINAL - CAMPUS GAME PLATFORM
echo ========================================================

echo.
echo [1/3] Syncing database schema...
call npx prisma db push --schema=prisma/schema.prisma --skip-generate
if errorlevel 1 (
    echo.
    echo ERROR: Database sync failed. Check your PostgreSQL connection.
    echo        Make sure PostgreSQL is running and .env DATABASE_URL is correct.
    pause
    exit /b 1
)
echo       Database ready!

echo.
echo [2/3] Starting Backend Server (port 3001)...
start "Terminal Backend" cmd /k "cd server && npm run dev"

echo [3/3] Starting Frontend UI (port 5173)...
start "Terminal Frontend" cmd /k "cd client && npm run dev"

echo.
echo ========================================================
echo  Both servers are starting up — please wait ~5 seconds
echo  Backend  : http://localhost:3001
echo  Frontend : http://localhost:5173
echo ========================================================
echo.
timeout /t 5 /nobreak > NUL
start http://localhost:5173

echo You can close this window. Servers are running in their own windows.
pause
