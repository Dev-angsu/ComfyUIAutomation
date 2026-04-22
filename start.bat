@echo off
setlocal enabledelayedexpansion
echo Starting AI Studio Environment...
echo.

:: Ensure these match your actual ComfyUI installation paths!
set COMFY_DIR="F:\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\"
set COMFY_BAT="run_nvidia_gpu.bat"
set /a retry_count=0

echo Checking if ComfyUI is running on port 8188...
:WAIT_COMFY
curl -s -o nul http://127.0.0.1:8188/
if %errorlevel% neq 0 (
    set /a retry_count+=1
    
    if !retry_count! equ 4 (
        echo ComfyUI not detected after 10 seconds. Auto-launching ComfyUI...
        start "ComfyUI" cmd /k "cd /d %COMFY_DIR% && %COMFY_BAT%"
    ) else (
        echo ComfyUI is not ready yet. Waiting 3 seconds...
    )
    
    timeout /t 3 /nobreak > NUL
    goto WAIT_COMFY
)
echo ComfyUI is online!
echo.

:: Kill existing process on Port 8000 and Start FastAPI Backend
echo Checking for existing FastAPI Backend on Port 8000...
FOR /F "tokens=5" %%a in ('netstat -aon ^| findstr /C:":8000 " ^| findstr LISTENING') do (
    echo Killing existing process on Port 8000 [PID: %%a]...
    taskkill /F /PID %%a >nul 2>&1
)
echo Starting FastAPI Backend (Port 8000)...
start "AI Studio Backend" cmd /k "cd Backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: Kill existing process on Port 3000 and Start Next.js Frontend
echo Checking for existing Next.js Frontend on Port 3000...
FOR /F "tokens=5" %%a in ('netstat -aon ^| findstr /C:":3000 " ^| findstr LISTENING') do (
    echo Killing existing process on Port 3000 [PID: %%a]...
    taskkill /F /PID %%a >nul 2>&1
)
echo Starting Next.js Frontend (Port 3000)...
start "AI Studio Frontend" cmd /k "cd backendController && npm run dev -- --host --open"

echo Done! Both services are launching in separate windows.