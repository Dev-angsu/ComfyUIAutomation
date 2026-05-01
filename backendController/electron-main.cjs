const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const waitOn = require('wait-on');

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') // We'll create this if needed
    },
    title: "AI Studio Desktop",
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon_512.png')
  });

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackend() {
  const isDev = process.env.NODE_ENV === 'development';
  let backendPath;

  if (isDev) {
    // In dev, we assume python is in path and we run from source
    // Adjust path to point to the Backend directory relative to this file
    const pythonPath = path.join(__dirname, '..', 'Backend', 'venv', 'Scripts', 'python.exe');
    const backendDir = path.join(__dirname, '..', 'Backend');
    backendProcess = spawn(pythonPath, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'], {
      cwd: backendDir,
      shell: true
    });
  } else {
    // In production, we run the bundled executable
    const exeName = process.platform === 'win32' ? 'comfy-backend.exe' : 'comfy-backend';
    backendPath = path.join(process.resourcesPath, 'backend', exeName);
    
    if (process.platform === 'win32') {
       // fallback for different packing structures
       if (!require('fs').existsSync(backendPath)) {
         backendPath = path.join(__dirname, '..', 'Backend', 'dist', exeName);
       }
    } else {
       // On Mac/Linux, check if it's in the app bundle or local dist
       if (!require('fs').existsSync(backendPath)) {
         backendPath = path.join(__dirname, '..', 'Backend', 'dist', exeName);
       }
       // Ensure executable permissions on Unix
       try { require('fs').chmodSync(backendPath, 0o755); } catch(e) {}
    }

    const backendDir = path.dirname(backendPath);
    const userDataPath = app.getPath('userData');

    backendProcess = spawn(backendPath, [], {
      cwd: backendDir,
      shell: false,
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        DATABASE_PATH: path.join(userDataPath, 'ai_studio.db'),
        LOG_FILE_PATH: path.join(userDataPath, 'api_server.log')
      }
    });
  }

  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data}`);
  });
}

app.whenReady().then(() => {
  startBackend();

  // Wait for backend to be ready before showing the window
  const opts = {
    resources: ['http://127.0.0.1:8000/api/health'],
    timeout: 30000,
    httpMethod: 'GET'
  };

  waitOn(opts)
    .then(() => {
      createWindow();
    })
    .catch((err) => {
      console.error('Backend failed to start in time:', err);
      createWindow(); // still show window, maybe it'll recover
    });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (backendProcess) {
    // Kill the backend process tree
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', backendProcess.pid, '/f', '/t']);
    } else {
      // On Unix, we kill the process group or just the PID
      process.kill(-backendProcess.pid); // Kill process group
    }
  }
});
