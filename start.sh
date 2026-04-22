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

echo "Starting FastAPI Backend (Port 8000)..."
osascript -e 'tell application "Terminal" to do script "cd \"'"$DIR"'/Backend\" && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"'

echo "Starting Next.js Frontend (Port 3000)..."
osascript -e 'tell application "Terminal" to do script "cd \"'"$DIR"'/backendController\" && npm run dev"'

echo "Done! Both services are launching in separate Terminal windows."