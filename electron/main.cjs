const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");
const fs = require("fs");
const http = require("http");

const isDev = !app.isPackaged;
let backendProcess = null;
let backendPort = 8000; // wordt overschreven door stdout van backend
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

win.webContents.on("did-finish-load", () => {
  if (backendPort) {
    win.webContents.send("backend-port", backendPort);
  }
});

// --- BACKEND PATH ---
function getBackendPath() {
  const base = isDev
    ? path.join(__dirname, "backend")
    : path.join(process.resourcesPath, "backend");

  if (os.platform() === "win32") {
    return isDev ? path.join(base, "launcher.py") : path.join(base, "app.exe");
  } else if (os.platform() === "darwin") {
    if (isDev) return path.join(base, "launcher.py");
    return path.join(base, "app.app", "Contents", "MacOS", "app");
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
  const envPath = isDev
    ? path.join(__dirname, "backend", ".env")
    : path.join(process.resourcesPath, "backend", ".env");

  if (!fs.existsSync(backendPath)) {
    dialog.showErrorBox(
      "Backend fout",
      `Backend bestand niet gevonden:\n${backendPath}`
    );
    app.quit();
    return;
  }

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
    args = [backendPath]; // geen --port meegeven, backend zoekt zelf
  } else {
    command = backendPath;
    args = []; // idem
  }

  console.log(`🚀 Start backend: ${command} ${args.join(" ")}`);

  const stdioConfig = isDev ? "pipe" : ["pipe", "pipe", "pipe"];
  backendProcess = spawn(command, args, {
    shell: true,
    stdio: stdioConfig,
    windowsHide: !isDev,
  });

  // stdout uitlezen om de poort te detecteren
  backendProcess.stdout.on("data", (data) => {
    const text = data.toString();
    console.log(`[Backend]: ${text}`);

    const match = text.match(/Backend gestart op poort (\d+)/);
    if (match) {
      backendPort = parseInt(match[1], 10);
      console.log(`✅ Backend draait op poort ${backendPort}`);
      
      BrowserWindow.getAllWindows().forEach((w) => {
        w.webContents.send("backend-port", backendPort);
      });
    }
  });

  backendProcess.stderr.on("data", (data) => {
    console.error(`[Backend ERROR]: ${data.toString()}`);
  });

  // loggen naar bestand
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

  backendProcess.on("exit", (code) =>
    console.log(`ℹ️ Backend gestopt met code ${code}`)
  );

  // wacht tot backend ready is
  return new Promise((resolve, reject) => {
    let waited = 0;
    const interval = setInterval(() => {
      if (backendPort !== 8000 || waited > 20) {
        clearInterval(interval);
        waitForBackend(backendPort).then(resolve).catch(reject);
      }
      waited++;
    }, 500);
  });
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
