@echo off
setlocal

:: 1. Always switch to the directory containing this batch script
cd /d "%~dp0"
title SlotSathi Recover — Full Stack Server (Frontend + Backend)

echo ============================================================================
echo   SlotSathi Recover — Full Stack Application Launcher
echo ============================================================================
echo.
echo   Architecture: Next.js App Router (Frontend UI + Backend REST API)
echo   Local Address: http://localhost:3000
echo.
echo ============================================================================
echo.

:: 2. Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto NO_NODE

:: 3. Check if npm is installed
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto NO_NPM

:: Display Node.js and npm versions
echo [CHECK] Node.js is installed:
node --version
echo [CHECK] npm is installed:
call npm --version
echo.

:: 4. Check if node_modules exists
if not exist "node_modules" goto INSTALL_DEPS
goto START_APP

:INSTALL_DEPS
echo [WARNING] node_modules folder was not found.
echo Installing dependencies using npm ci...
echo.
call npm ci
if %ERRORLEVEL% NEQ 0 goto DEPS_FAILED
echo [SUCCESS] Dependencies installed successfully.
echo.

:START_APP
:: 5. Open browser in background after 3 seconds
echo [INFO] Preparing to open browser at http://localhost:3000 ...
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

:: 6. Display endpoints cheatsheet
echo.
echo ============================================================================
echo   Application URLs:
echo   - Tutor Dashboard : http://localhost:3000/
echo   - Student Booking : http://localhost:3000/book/aditi-sharma
echo   - API Bookings    : http://localhost:3000/api/bookings
echo   - API Dashboard   : http://localhost:3000/api/dashboard
echo.
echo   Press Ctrl+C in this console window to stop the server.
echo ============================================================================
echo.
echo [INFO] Starting Next.js full-stack server (npm run dev)...
echo.

call npm run dev
if %ERRORLEVEL% NEQ 0 goto SERVER_ERROR
goto END

:NO_NODE
echo.
echo [ERROR] Node.js was not found in your system PATH.
echo Please install Node.js 24 or 22 from https://nodejs.org/
echo.
pause
exit /b 1

:NO_NPM
echo.
echo [ERROR] npm was not found in your system PATH.
echo.
pause
exit /b 1

:DEPS_FAILED
echo.
echo [ERROR] npm ci failed. Please check your internet connection.
echo.
pause
exit /b 1

:SERVER_ERROR
echo.
echo [ERROR] Server exited with an error.
echo.
pause
exit /b 1

:END
pause
