const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");

const isDev = !app.isPackaged;
let backendProcess = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, "../dist/index.html");
    win.loadFile(indexPath);
  }
}

function getVenvPythonPath() {
  const baseVenv = isDev
    ? path.join(__dirname, "..", "venv")
    : path.join(process.resourcesPath, "venv");

  if (os.platform() === "win32") {
    return path.join(baseVenv, "Scripts", "python.exe");
  } else {
    return path.join(baseVenv, "bin", "python3");
  }
}

function startBackend() {
  if (isDev) return; // In dev via script

  const script = path.join(process.resourcesPath, "backend", "app.py");
  const pythonPath = getVenvPythonPath();

  console.log("🚀 Start backend (prod) op poort 8000");

  backendProcess = spawn(pythonPath, [script, "--port=8000"], {
    stdio: "inherit",
  });

  backendProcess.on("error", (err) => {
    console.error("❌ Fout bij starten backend:", err);
  });

  backendProcess.on("exit", (code) => {
    console.log(`ℹ️ Backend gestopt met code ${code}`);
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});
