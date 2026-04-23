#!/bin/bash

echo "Starting AI Studio Environment (macOS)..."
echo ""

echo "Checking if ComfyUI is running on http://deb.local:8188/..."
while true; do
    curl -s -o /dev/null http://deb.local:8188/
    if [ $? -eq 0 ]; then
        echo "ComfyUI is online!"
        echo ""
        break
    else
        echo "ComfyUI is not ready yet. Please ensure it is running on your Windows machine."
        echo "Waiting 3 seconds..."
        sleep 3
    fi
done

# Capture the absolute path to this script's directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check dependencies
if [ ! -d "$DIR/backendController/node_modules" ]; then
    echo "⚠️  WARNING: node_modules not found in backendController."
    echo "It looks like you haven't installed the frontend dependencies yet."
    echo "Please run: cd backendController && npm install"
    echo ""
fi

if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null; then
    echo "✅ FastAPI Backend is already running on Port 8000. Skipping..."
else
    echo "Starting FastAPI Backend (Port 8000)..."
    # Determine if we need to activate a virtual environment
    if [ -f "$DIR/.venv/bin/activate" ]; then
        VENV_PATH="$DIR/.venv/bin/activate"
    elif [ -f "$DIR/Backend/.venv/bin/activate" ]; then
        VENV_PATH="$DIR/Backend/.venv/bin/activate"
    else
        VENV_PATH=""
    fi
    
    # Construct the command string using single quotes for paths to avoid AppleScript quote conflicts
    if [ -n "$VENV_PATH" ]; then
        CMD="cd '$DIR/Backend' && source '$VENV_PATH' && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
    else
        CMD="cd '$DIR/Backend' && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
    fi
    
    # Pass the pre-constructed command to osascript
    osascript <<EOF
tell application "Terminal"
    do script "$CMD"
end tell
EOF
fi

if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null; then
    echo "✅ Next.js Frontend is already running on Port 3000. Skipping..."
else
    echo "Starting Next.js Frontend (Port 3000)..."
    osascript <<EOF
tell application "Terminal"
    do script "cd '$DIR/backendController' && npm run dev -- --host --open"
end tell
EOF
fi

echo "Done! Environment startup check complete."