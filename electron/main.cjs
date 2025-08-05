const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

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
    win.webContents.openDevTools();
    win.loadURL("http://localhost:5173");
  } else {
    win.webContents.openDevTools();
    const indexPath = path.join(__dirname, "../dist/index.html");
    win.loadFile(indexPath);
  }
}

function startBackend() {
  const script = isDev
    ? "backend/app.py"
    : path.join(__dirname, "..", "backend", "app.py");

  //127.0.0.1:5000/api/zoek/TEST
  http: backendProcess = spawn("python3", [script], {
    stdio: "inherit",
  });

  backendProcess.on("error", (err) => {
    console.error("Fout bij starten backend:", err);
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
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
