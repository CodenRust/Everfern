@echo off
setlocal enabledelayedexpansion

:: EverFern Desktop — Professional Build Script
:: This script compiles the Next.js frontend and packages the Electron app into a Windows .exe

set APP_DIR=apps\desktop

echo =============================================================================
echo   EverFern Builder — Generating Premium Executable
echo =============================================================================
echo.

:: 1. Navigate to app directory
if not exist "%APP_DIR%" (
    echo [ERROR] Could not find application directory: %APP_DIR%
    :: Fallback: check if we are already in the directory
    if not exist "package.json" (
        echo [ERROR] Run this script from the root of the everfern-desktop folder.
        pause
        exit /b 1
    )
) else (
    cd %APP_DIR%
)

:: 2. Install dependencies
echo [1/3] Resolving dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm install failed.
    pause
    exit /b %ERRORLEVEL%
)

:: 3. Run full production build
echo [2/3] Compiling and Packaging...
echo This may take a few minutes as it generates the Next.js static site and the Electron binary.
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Build failed. Check the logs above.
    pause
    exit /b %ERRORLEVEL%
)

:: 4. Locate results
echo [3/3] Finalizing package...
echo.
echo =============================================================================
echo   SUCCESS! EverFern has been packaged.
echo =============================================================================
echo.
echo Your .exe file has been generated in:
echo %CD%\dist
echo.
echo Press any key to open the folder...
pause > nul
start "" "dist"
exit /b 0
