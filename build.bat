@echo off
setlocal

echo ========================================
echo   AI Studio - Windows Build Script
echo ========================================

:: 1. Build Backend
echo [1/2] Building Python Backend...
cd Backend
if not exist "venv" (
    echo Error: venv not found in Backend directory.
    exit /b 1
)

:: Use the venv python to run PyInstaller
.\venv\Scripts\python.exe -m PyInstaller backend.spec --noconfirm
if %ERRORLEVEL% neq 0 (
    echo Backend build failed!
    exit /b %ERRORLEVEL%
)
cd ..

:: 2. Build Frontend
echo [2/2] Building Electron Frontend...
cd backendController
call npm run electron:build
if %ERRORLEVEL% neq 0 (
    echo Frontend build failed!
    exit /b %ERRORLEVEL%
)
cd ..

echo ========================================
echo   Build Successful!
echo   Check backendController/dist-electron
echo ========================================
pause
