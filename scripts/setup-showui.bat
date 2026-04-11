@echo off
setlocal enabledelayedexpansion

:: ============================================================
::  EverFern ShowUI Universal Installer  —  Windows
::  Primary path: WSL2 (Linux shell, no build issues)
::  Fallback:     Native Python venv
:: ============================================================

set STEP=0
set SCRIPTS_DIR=%~dp0

call :banner

:: ── 1. Check for WSL ──────────────────────────────────────
call :step "Checking for WSL"
wsl --status >nul 2>&1
if %ERRORLEVEL% neq 0 (
    :: older Windows, try just running wsl
    wsl -e echo ok >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        call :warn "WSL not found — attempting to install WSL2..."
        goto :install_wsl
    )
)

:: Check if any distribution is actually installed
wsl -e echo ok >nul 2>&1
if %ERRORLEVEL% neq 0 (
    call :warn "WSL is enabled but no Linux distro found — installing Ubuntu..."
    goto :install_distro
)

call :ok "WSL is ready"
goto :run_wsl_installer

:: ── Install WSL2 + Ubuntu ─────────────────────────────────
:install_wsl
call :step "Installing WSL2 + Ubuntu (requires reboot)"
where winget >nul 2>&1
if %ERRORLEVEL% neq 0 (
    call :warn "winget not found — cannot auto-install WSL"
    goto :try_native_python
)

wsl --install -d Ubuntu --no-launch
if %ERRORLEVEL% neq 0 (
    call :warn "WSL install failed — falling back to native Python"
    goto :try_native_python
)

call :warn "WSL installed! A REBOOT IS REQUIRED."
echo.
echo  +======================================================+
echo  ^|  ACTION REQUIRED:                                    ^|
echo  ^|  Please REBOOT your PC, then re-run this installer. ^|
echo  ^|  WSL will finish setup on first launch.             ^|
echo  +======================================================+
echo.
exit /b 11

:install_distro
call :step "Installing Ubuntu distro into WSL"
wsl --install -d Ubuntu --no-launch
if %ERRORLEVEL% neq 0 (
    call :warn "Ubuntu install failed — falling back to native Python"
    goto :try_native_python
)
call :ok "Ubuntu installed. Waiting for initialisation..."
:: Give WSL a moment to register the distro
timeout /t 5 /nobreak >nul
wsl -e echo ok >nul 2>&1
if %ERRORLEVEL% neq 0 (
    call :warn "Distro not yet ready — please reboot and re-run"
    exit /b 11
)

:: ── 2. Run setup-unix.sh inside WSL ───────────────────────
:: ── 2. Run setup-unix.sh inside WSL ───────────────────────
:run_wsl_installer
call :step "Launching installer inside WSL"
echo EVERFERN_PROGRESS:10

:: Convert the Windows path to a WSL (Linux) path for the script
for /f "delims=" %%W in ('wsl -d Ubuntu -u root wslpath -u "%SCRIPTS_DIR%setup-unix.sh" 2^>nul') do set WSL_SCRIPT=%%W
if "%WSL_SCRIPT%"=="" (
    for /f "delims=" %%W in ('wsl wslpath -u "%SCRIPTS_DIR%setup-unix.sh" 2^>nul') do set WSL_SCRIPT=%%W
)

if "%WSL_SCRIPT%"=="" (
    call :fail "WSL is refusing background commands (Input Redirection Error)."
    echo.
    echo =========================================================================
    echo  CRITICAL FIX: Your Ubuntu WSL needs a username before it can work!
    echo  1. Open your Windows Start Menu
    echo  2. Type "Ubuntu" and open it
    echo  3. Create your UNIX username and password when prompted
    echo  4. Close Ubuntu and click "Install ShowUI" here again!
    echo =========================================================================
    echo.
    exit /b 11
)

call :ok "Script path in WSL: %WSL_SCRIPT%"
echo.
echo  Running: wsl bash "%WSL_SCRIPT%"
echo.

wsl -u root bash "%WSL_SCRIPT%"
set EXIT_CODE=%ERRORLEVEL%


if %EXIT_CODE% equ 0 (
    call :done "WSL"
    exit /b 0
) else (
    call :fail "WSL installer exited with code %EXIT_CODE%"
    exit /b %EXIT_CODE%
)


:: ── 3. Fallback: Native Python venv ───────────────────────
:try_native_python
call :warn "WSL unavailable — falling back to Native Python venv"
echo EVERFERN_PROGRESS:5

:: DeepSpeed prebuilt wheel for Windows (Python 3.11, CPU)
set DS_WHEEL=https://github.com/daiyizheng/deepspeed-windows-wheel/releases/download/v0.10.2/deepspeed-0.10.2+unknown-cp311-cp311-win_amd64.whl
set SHOWUI_DIR=%USERPROFILE%\ShowUI

call :step "Locating Python"
set PYTHON_EXE=

:: 1. Look for explicit Python 3.11+ installations first (avoids unsupported 3.13 from PATH)
for %%p in (
    "%USERPROFILE%\AppData\Local\Programs\Python\Python311\python.exe"
    "%USERPROFILE%\AppData\Local\Programs\Python\Python312\python.exe"
    "%USERPROFILE%\AppData\Local\Programs\Python\Python310\python.exe"
    "C:\Python311\python.exe"
    "C:\Python312\python.exe"
    "C:\Python310\python.exe"
) do (
    if exist %%p (
        set PYTHON_EXE=%%p
        call :ok "Found Python at %%p"
        goto :python_found
    )
)

:: 2. Try python from PATH if it works and is valid
where python >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set PYTHON_EXE=python
    call :ok "Found python in PATH"
    goto :python_found
)

call :warn "Python not found — attempting auto-install via winget"
where winget >nul 2>&1
if %ERRORLEVEL% neq 0 (
    call :fail "Neither WSL, Python, nor winget found. Install Python 3.11+ from https://python.org"
    exit /b 1
)

echo     Installing Python 3.11 silently...
winget install --id Python.Python.3.11 --silent --accept-package-agreements --accept-source-agreements
if %ERRORLEVEL% neq 0 (
    call :fail "Winget install failed. Install Python 3.11+ manually from https://python.org"
    exit /b 1
)

for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "USER_PATH=%%B"
for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PATH 2^>nul') do set "SYS_PATH=%%B"
set "PATH=%USER_PATH%;%SYS_PATH%"

for /f "delims=" %%i in ('where python 2^>nul') do (
    set PYTHON_EXE=%%i
    goto :after_winget
)
call :fail "Python installed but not reachable. Close and reopen this terminal, then re-run."
exit /b 1
:after_winget
call :ok "Python installed via winget"

:python_found
call :step "Git check"
where git >nul 2>&1
if %ERRORLEVEL% neq 0 (
    call :warn "git not found — attempting install via winget..."
    where winget >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        winget install --id Git.Git --silent --accept-package-agreements --accept-source-agreements
        if %ERRORLEVEL% neq 0 (
            call :fail "Git install failed. Install from https://git-scm.com"
            exit /b 1
        )
        call :ok "Git installed"
    ) else (
        call :fail "git not found and winget unavailable. Install git from https://git-scm.com"
        exit /b 1
    )
) else (
    call :ok "Git available"
)

call :step "Repository"
echo EVERFERN_PROGRESS:20
if not exist "%SHOWUI_DIR%\.git" (
    echo     Cloning ShowUI...
    git clone https://github.com/showlab/ShowUI.git "%SHOWUI_DIR%"
    if %ERRORLEVEL% neq 0 (
        call :fail "Git clone failed — check your network connection"
        exit /b 1
    )
    call :ok "Repository cloned"
) else (
    call :ok "Repository already present — skipping clone"
)

cd /d "%SHOWUI_DIR%"

call :step "Upgrading to 'uv' package manager"
echo EVERFERN_PROGRESS:25
"%PYTHON_EXE%" -m pip install --quiet --upgrade uv
if %ERRORLEVEL% neq 0 (
    call :warn "Failed to install uv, falling back to slow pip"
    set UV_BIN="%PYTHON_EXE%" -m pip
    set UV_VENV="%PYTHON_EXE%" -m venv venv
) else (
    call :ok "uv available (ultra-fast dependencies)"
    set UV_BIN="%PYTHON_EXE%" -m uv pip
    set UV_VENV="%PYTHON_EXE%" -m uv venv venv --python 3.11
)

call :step "Virtual environment"
echo EVERFERN_PROGRESS:30
if not exist "venv\Scripts\activate.bat" (
    echo     Creating venv...
    %UV_VENV%
    if %ERRORLEVEL% neq 0 (
        call :fail "Failed to create virtual environment"
        exit /b 1
    )
    call :ok "Virtual environment created"
) else (
    call :ok "Virtual environment already exists — skipping"
)

set VENV_PYTHON=%SHOWUI_DIR%\venv\Scripts\python.exe

call :step "Project dependencies (PyTorch CPU & Packages)"
echo EVERFERN_PROGRESS:50
echo     Resolving strict ShowUI constraints concurrently...

:: We attempt to seamlessly merge DeepSpeed prebuilt wheel (since DeepSpeed doesn't build on Windows) directly into the dependency tree solver
%UV_BIN% install --quiet -r requirements.txt torchvision torchaudio "setuptools<82" wheel "%DS_WHEEL%" --extra-index-url https://download.pytorch.org/whl/cpu
if %ERRORLEVEL% neq 0 (
    call :warn "DeepSpeed prebuilt wheel conflict. Falling back to ops-disabled build..."
    %UV_BIN% install --quiet -r requirements.txt deepspeed torchvision torchaudio "setuptools<82" wheel --extra-index-url https://download.pytorch.org/whl/cpu --no-build-isolation
    if !ERRORLEVEL! neq 0 (
        call :fail "Dependency installation failed"
        exit /b 1
    )
)
call :ok "All dependencies natively installed flawlessly!"

call :done "Native Python uv backend"
exit /b 0


:: ============================================================
::  UI helpers
:: ============================================================
:banner
echo.
echo  +======================================================+
echo  ^|       EverFern  --  ShowUI Universal Installer      ^|
echo  ^|       Platform: Windows (WSL-first)                 ^|
echo  +======================================================+
echo.
echo EVERFERN_PROGRESS:5
exit /b

:step
set /a STEP+=1
echo.
echo  [%STEP%] %~1
exit /b

:ok
echo     OK  %~1
exit /b

:warn
echo.
echo     !! WARNING: %~1
echo.
exit /b

:fail
echo.
echo  +======================================================+
echo  ^|  FAILED: %~1
echo  +======================================================+
echo.
exit /b

:done
echo.
echo EVERFERN_PROGRESS:100
echo  +======================================================+
echo  ^|  ShowUI is ready!  (via %~1)
echo  ^|                                                      ^|
echo  ^|  The EverFern app will now launch the AI engine.    ^|
echo  +======================================================+
echo.
exit /b
