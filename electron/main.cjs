const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");
const fs = require("fs");
const http = require("http");

const isDev = !app.isPackaged;
let backendProcess = null;
const API_PORT = 8000;
const FRONTEND_DEV_URL = "http://localhost:5173";

// --- WINDOW ---
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev) {
    let attempts = 0;
    const maxAttempts = 15;

    const tryLoad = () => {
      attempts++;
      win.loadURL(FRONTEND_DEV_URL).catch(() => {
        if (attempts < maxAttempts) {
          console.log(`⏳ Wachten op Vite dev server... poging ${attempts}`);
          setTimeout(tryLoad, 1000);
        } else {
          console.error("❌ Kan Vite dev server niet bereiken!");
          dialog.showErrorBox(
            "Frontend fout",
            "Vite dev server reageert niet."
          );
        }
      });
    };

    tryLoad();
    win.webContents.openDevTools();
  } else {
    const indexPath = path.join(process.resourcesPath, "dist", "index.html");
    win.loadFile(indexPath).catch((err) => {
      console.error("❌ Kan index.html niet laden:", err);
      dialog.showErrorBox("Frontend fout", err.message);
    });
  }
}

// --- BACKEND PATH ---
function getBackendPath() {
  const base = isDev
    ? path.join(__dirname, "backend")
    : path.join(process.resourcesPath, "backend");

  if (os.platform() === "win32") {
    return isDev ? path.join(base, "launcher.py") : path.join(base, "app.exe");
  } else {
    return isDev ? path.join(base, "launcher.py") : path.join(base, "app");
  }
}

// --- BACKEND HEALTH CHECK ---
function waitForBackend(port, retries = 15, delay = 1000) {
  return new Promise((resolve, reject) => {
    const attempt = (count) => {
      http
        .get(`http://localhost:${port}/health`, (res) => {
          if (res.statusCode === 200) resolve();
          else if (count > 0) setTimeout(() => attempt(count - 1), delay);
          else reject(new Error("Backend reageert niet"));
        })
        .on("error", () => {
          if (count > 0) setTimeout(() => attempt(count - 1), delay);
          else reject(new Error("Backend niet bereikbaar"));
        });
    };
    attempt(retries);
  });
}

// --- START BACKEND ---
function startBackend() {
  const backendPath = getBackendPath();
  const envPath = path.join(path.dirname(backendPath), ".env");

  // Check of backend executable of script bestaat
  if (!fs.existsSync(backendPath)) {
    dialog.showErrorBox(
      "Backend fout",
      `Backend bestand niet gevonden:\n${backendPath}`
    );
    app.quit();
    return;
  }

  // Check of .env aanwezig is
  if (!fs.existsSync(envPath)) {
    dialog.showErrorBox(
      "Backend fout",
      `.env bestand niet gevonden:\n${envPath}\nZorg dat het voor de build is aangemaakt.`
    );
    app.quit();
    return;
  }

  let command, args;
  if (backendPath.endsWith(".py")) {
    command = os.platform() === "win32" ? "python" : "python3";
    args = [backendPath, `--port=${API_PORT}`];
  } else {
    command = backendPath;
    args = [`--port=${API_PORT}`];
  }

  console.log(`🚀 Start backend: ${command} ${args.join(" ")}`);

  const stdioConfig = isDev ? "inherit" : ["pipe", "pipe", "pipe"];
  backendProcess = spawn(command, args, {
    shell: true,
    stdio: stdioConfig,
    windowsHide: !isDev,
  });

  // Log naar bestand in userData
  const logFile = path.join(app.getPath("userData"), "backend.log");
  const logStream = fs.createWriteStream(logFile, { flags: "a" });
  backendProcess.stdout.pipe(logStream);
  backendProcess.stderr.pipe(logStream);

  backendProcess.on("error", (err) => {
    dialog.showErrorBox(
      "Backend fout",
      `Kon backend niet starten: ${err.message}`
    );
  });

  backendProcess.on("exit", (code) => {
    console.log(`ℹ️ Backend gestopt met code ${code}`);
  });

  return waitForBackend(API_PORT, 15, 1000);
}

// --- STOP BACKEND ---
function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

// --- APP LIFECYCLE ---
app.whenReady().then(async () => {
  try {
    await startBackend();
    createWindow();
  } catch (err) {
    dialog.showErrorBox("Backend fout", err.message);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});
