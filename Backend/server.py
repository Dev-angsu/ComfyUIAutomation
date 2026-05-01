import uvicorn
import multiprocessing
from main import app
import sys
import os

# This is required for PyInstaller + multiprocessing (uvicorn standard uses it)
if __name__ == '__main__':
    multiprocessing.freeze_support()
    # Get the port from environment or default to 8000
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
