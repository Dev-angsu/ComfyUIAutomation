#!/bin/bash

echo "========================================"
echo "  AI Studio - macOS Build Script"
echo "========================================"

# 1. Build Backend
echo "[1/2] Building Python Backend..."
cd Backend
if [ ! -d "venv" ]; then
    echo "Error: venv not found in Backend directory."
    exit 1
fi

# On Mac, venv uses bin/python instead of Scripts/python.exe
./venv/bin/python -m PyInstaller backend.spec --noconfirm
if [ $? -ne 0 ]; then
    echo "Backend build failed!"
    exit 1
fi
cd ..

# 2. Build Frontend
echo "[2/2] Building Electron Frontend..."
cd backendController
npm run electron:build
if [ $? -ne 0 ]; then
    echo "Frontend build failed!"
    exit 1
fi
cd ..

echo "========================================"
echo "  Build Successful!"
echo "  Check backendController/dist-electron"
echo "========================================"
