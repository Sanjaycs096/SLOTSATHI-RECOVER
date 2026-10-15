@echo off
setlocal EnableDelayedExpansion

:: ============================================================================
:: SlotSathi Recover — Full Stack Unified Launcher (Frontend + Backend)
:: Powers Next.js App Router (UI Components + REST API Routes simultaneously)
:: ============================================================================

title SlotSathi Recover — Full Stack Server

:: 1. Always switch to the directory containing this batch script
cd /d "%~dp0"

echo ============================================================================
echo   SlotSathi Recover — Full Stack Application Launcher
echo ============================================================================
echo.
echo   [INFO] Architecture Overview:
echo     * Frontend UI: Tutor Dashboard, Booking Portal, Offer Screens
echo     * Backend API: /api/bookings, /api/dashboard, /api/offers, /api/waitlist
echo     * Port: http://localhost:3000 (Unified Full-Stack Server)
echo.
echo ============================================================================
echo.

:: 2. Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not found in system PATH.
    echo Please install Node.js 24 (or >=22) from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Display Node and npm versions
for /f "tokens=*" %%i in ('node --version 2^>nul') do set NODE_VER=%%i
for /f "tokens=*" %%i in ('npm --version 2^>nul') do set NPM_VER=%%i
echo [CHECK] Node.js Version : !NODE_VER!
echo [CHECK] npm Version     : !NPM_VER!

:: 3. Check if node_modules exists, otherwise install dependencies cleanly
if not exist "node_modules\" (
    echo.
    echo [WARNING] 'node_modules' folder not found.
    echo Running clean dependency install ('npm ci')...
    echo.
    call npm ci
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] Dependency installation failed. Please check your network and try again.
        echo.
        pause
        exit /b 1
    )
    echo [SUCCESS] Dependencies installed successfully.
    echo.
)

:: 4. Check if port 3000 is already in use
netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [WARNING] Port 3000 is currently in use by another process.
    echo If another SlotSathi server is already running, you can access it directly at:
    echo   http://localhost:3000
    echo.
    set /p PROCEED_PORT="Do you still want to proceed and let Next.js find an open port? (Y/N) [Y]: "
    if /i "!PROCEED_PORT!"=="N" (
        echo [CANCELLED] Launcher stopped by user.
        pause
        exit /b 0
    )
    echo.
)

:: 5. Launch helper to open the default browser after server initializes
echo [INFO] Launching browser shortcut to http://localhost:3000 in 3 seconds...
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

:: 6. Display access routes summary
echo.
echo ============================================================================
echo   Application URLs & Endpoints
echo ============================================================================
echo   * Tutor Recovery Dashboard : http://localhost:3000/
echo   * Public Student Booking   : http://localhost:3000/book/aditi-sharma
echo   * API Health / Bookings    : http://localhost:3000/api/bookings
echo   * In-Process Test Runner   : http://localhost:3000/api/test-runner
echo.
echo   Press [Ctrl+C] in this window to stop both frontend and backend.
echo ============================================================================
echo.

:: 7. Start the unified Next.js Full Stack server
echo [INFO] Starting Next.js development server ('npm run dev')...
echo.
call npm run dev

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Next.js server exited with error code %ERRORLEVEL%.
    echo.
    pause
    exit /b %ERRORLEVEL%
)

pause
