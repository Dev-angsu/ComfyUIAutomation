# Icon Update Guide

This guide explains how to update the icons for your web interface and Electron application using your new `lai.png` file.

## 1. Web Favicon
The favicon is the small icon shown in the browser tab.
- **File Location**: `backendController/public/lai.png`
- **Configuration**: Updated in `backendController/index.html`
- **Code Change**:
  ```html
  <link rel="icon" type="image/png" href="/lai.png" />
  ```

## 2. Electron Window Icon
This is the icon shown in the window's title bar (if enabled) and the Windows taskbar while the app is running.
- **File Location**: `backendController/build/lai.png` (copied from public)
- **Configuration**: Updated in `backendController/electron-main.cjs`
- **Code Change**:
  ```javascript
  icon: path.join(__dirname, 'build', 'lai.png')
  ```

## 3. Desktop Executable Icon (Critical)
To change the icon of the `.exe` file itself (what you see in File Explorer), `electron-builder` requires specific formats:
- **Windows**: Requires a `.ico` file.
- **macOS**: Requires a `.icns` file.

### How to update the Executable Icon:
1. **Convert `lai.png` to `.ico`**:
   - Use an online converter (like [cloudconvert.com](https://cloudconvert.com/png-to-ico)) or a tool like ImageMagick.
   - For best results, the `.ico` should contain multiple sizes (16x16, 32x32, 48x48, 256x256).
2. **Replace the existing files**:
   - Save your new icon as `backendController/build/icon.ico`.
   - Save your new icon as `backendController/build/icon.icns` (for Mac).
3. **Rebuild the App**:
   - Run the build command to package the app with the new icons:
     ```powershell
     npm run electron:build
     ```

## Summary of Completed Actions:
- [x] Copied `public/lai.png` to `build/lai.png`.
- [x] Updated `index.html` to use `lai.png` as the web favicon.
- [x] Updated `electron-main.cjs` to use `lai.png` for the runtime window icon.
