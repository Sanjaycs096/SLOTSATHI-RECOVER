@echo off
setlocal EnableDelayedExpansion

:: ============================================================================
:: SlotSathi Recover — Safe GitHub Sync Script
:: Repository: https://github.com/Sanjaycs096/SLOTSATHI-RECOVER.git
:: ============================================================================

title SlotSathi Recover — Git Sync Tool

:: 1. Always switch to the directory containing this batch script
cd /d "%~dp0"
echo ============================================================================
echo   SlotSathi Recover — Safe GitHub Push Utility
echo ============================================================================
echo.

:: 2. Verify that Git is installed and accessible
where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git is not installed or not found in system PATH.
    echo Please install Git from https://git-scm.com/ and try again.
    echo.
    pause
    exit /b 1
)

:: 3. Verify that this directory is a Git repository
git rev-parse --is-inside-work-tree >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Current directory is not a Git repository.
    echo Run 'git init' and set up the remote first.
    echo.
    pause
    exit /b 1
)

:: 4. Get and display current branch
for /f "tokens=*" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i
if "!CURRENT_BRANCH!"=="" set CURRENT_BRANCH=main
echo [INFO] Current branch: !CURRENT_BRANCH!

:: 5. Verify the configured remote origin
for /f "tokens=*" %%i in ('git remote get-url origin 2^>nul') do set REMOTE_URL=%%i
if "!REMOTE_URL!"=="" (
    echo [ERROR] Remote 'origin' is not configured.
    echo Expected: https://github.com/Sanjaycs096/SLOTSATHI-RECOVER.git
    echo Run: git remote add origin https://github.com/Sanjaycs096/SLOTSATHI-RECOVER.git
    echo.
    pause
    exit /b 1
)

echo [INFO] Remote origin: !REMOTE_URL!

:: Check that remote matches expected repository
echo !REMOTE_URL! | findstr /i "SLOTSATHI-RECOVER" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Remote URL does not contain 'SLOTSATHI-RECOVER'.
    echo Please ensure this is the intended destination before proceeding.
    echo.
)

:: 6. Security pre-flight check: Scan for sensitive files
echo.
echo [CHECK] Scanning for potential secrets and private credential files...
set SECRET_FOUND=0

if exist ".env" (
    echo [ALERT] Found '.env' file. Verifying .gitignore...
    git check-ignore -q .env
    if !ERRORLEVEL! NEQ 0 (
        echo [DANGER] '.env' is NOT ignored by git! Aborting to prevent credential leak.
        echo Please add '.env' to .gitignore before staging.
        set SECRET_FOUND=1
    )
)

if exist ".env.local" (
    echo [ALERT] Found '.env.local' file. Verifying .gitignore...
    git check-ignore -q .env.local
    if !ERRORLEVEL! NEQ 0 (
        echo [DANGER] '.env.local' is NOT ignored by git! Aborting.
        echo Please add '.env.local' to .gitignore before staging.
        set SECRET_FOUND=1
    )
)

if exist ".env.production" (
    echo [ALERT] Found '.env.production'. Verifying .gitignore...
    git check-ignore -q .env.production
    if !ERRORLEVEL! NEQ 0 (
        echo [DANGER] '.env.production' is NOT ignored by git! Aborting.
        set SECRET_FOUND=1
    )
)

if exist "*.pem" (
    echo [DANGER] Found private key file (*.pem). Aborting.
    set SECRET_FOUND=1
)

if exist "*.key" (
    echo [DANGER] Found private key file (*.key). Aborting.
    set SECRET_FOUND=1
)

if !SECRET_FOUND! NEQ 0 (
    echo.
    echo [STOP] One or more potential secret files were detected and could be leaked.
    echo Resolve the file exclusion in .gitignore and remove any private keys before running.
    echo.
    pause
    exit /b 1
)
echo [PASS] No unignored secret files detected.

:: 7. Display current Git status
echo.
echo ============================================================================
echo   Current Git Working Tree Status
echo ============================================================================
git status --short
echo.

:: Check if there are changes to commit
git status --porcelain | findstr /r "." >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Working tree clean. Nothing to commit.
    echo Checking if there are unpushed commits...
    git log origin/!CURRENT_BRANCH!..HEAD --oneline 2>nul | findstr /r "." >nul 2>&1
    if !ERRORLEVEL! NEQ 0 (
        echo [INFO] Local branch is up to date with origin/!CURRENT_BRANCH!.
        echo Nothing to push.
        echo.
        pause
        exit /b 0
    ) else (
        echo [INFO] Unpushed commits detected. Proceeding to push step.
        goto DO_PUSH
    )
)

:: 8. Stage changes safely
echo ============================================================================
set /p CONFIRM_STAGE="Do you want to stage all modified/tracked project files? (Y/N) [Y]: "
if /i "!CONFIRM_STAGE!"=="N" (
    echo [CANCELLED] Staging aborted by user.
    echo.
    pause
    exit /b 0
)

echo [INFO] Staging files...
git add .
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to stage changes.
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================================
echo   Staged Changes Summary
echo ============================================================================
git diff --staged --stat
echo.

:: 9. Prompt for commit message
set DEFAULT_MSG=feat: update SlotSathi Recover
set /p COMMIT_MSG="Enter commit message [!DEFAULT_MSG!]: "
if "!COMMIT_MSG!"=="" set COMMIT_MSG=!DEFAULT_MSG!

echo [INFO] Committing with message: "!COMMIT_MSG!"...
git commit -m "!COMMIT_MSG!"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git commit failed or nothing changed.
    echo.
    pause
    exit /b 1
)
echo [SUCCESS] Changes committed successfully.
echo.

:: 10. Push to remote origin
:DO_PUSH
echo ============================================================================
echo   Push Confirmation
echo ============================================================================
echo Target Remote : !REMOTE_URL!
echo Target Branch : !CURRENT_BRANCH!
echo.
echo NOTE: Force push is strictly disabled.
set /p CONFIRM_PUSH="Are you ready to push to '!CURRENT_BRANCH!'? (Y/N) [Y]: "
if /i "!CONFIRM_PUSH!"=="N" (
    echo [CANCELLED] Push cancelled by user. Local commit is preserved.
    echo.
    pause
    exit /b 0
)

echo [INFO] Pushing commits to origin/!CURRENT_BRANCH!...
git push origin !CURRENT_BRANCH!
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] 'git push' failed with exit code %ERRORLEVEL%.
    echo Common reasons:
    echo   1. GitHub authentication required (run 'gh auth login' or enter Personal Access Token).
    echo   2. Remote branch has newer commits (run 'git pull --rebase origin !CURRENT_BRANCH!' safely).
    echo   3. Insufficient write permissions on repository https://github.com/Sanjaycs096/SLOTSATHI-RECOVER.git.
    echo.
    echo Your local commits remain completely safe.
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================================
echo   [SUCCESS] Successfully pushed to https://github.com/Sanjaycs096/SLOTSATHI-RECOVER.git!
echo ============================================================================
echo.
pause
exit /b 0
