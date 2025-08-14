const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");
const http = require("http");

const isDev = !app.isPackaged;
let backendProcess = null;
const API_PORT = 8000;

// Wacht tot backend bereikbaar is
async function waitForBackend() {
  const maxRetries = 20;
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise((resolve, reject) => {
        http
          .get(`http://localhost:${API_PORT}`, (res) => {
            if (res.statusCode < 500) resolve();
            else reject();
          })
          .on("error", reject);
      });
      console.log("✅ Backend is bereikbaar");
      return;
    } catch {
      console.log(`⏳ Wachten op backend... (${i + 1}/${maxRetries})`);
      await delay(500);
    }
  }

  console.error("❌ Backend startte niet op tijd");
  app.quit();
}

// Electron venster maken
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
    const indexPath = path.join(process.resourcesPath, "dist", "index.html");
    win
      .loadFile(indexPath)
      .catch((err) => console.error("❌ Kan index.html niet laden:", err));
  }
}

// Decrypt .env in productie
function decryptEnv() {
  if (isDev) return;

  const secretKey = process.env.ENV_SECRET_KEY;
  if (!secretKey) {
    console.error("❌ ENV_SECRET_KEY is niet gezet!");
    app.quit();
    return;
  }

  const encPath = path.join(process.resourcesPath, "backend", ".env.enc");
  if (!fs.existsSync(encPath)) {
    console.error("❌ Versleutelde .env.enc niet gevonden!");
    app.quit();
    return;
  }

  const encryptedData = JSON.parse(fs.readFileSync(encPath, "utf-8"));
  const iv = Buffer.from(encryptedData.iv, "hex");
  const content = Buffer.from(encryptedData.content, "hex");

  const decipher = crypto.createDecipheriv(
    "aes-256-ctr",
    crypto.createHash("sha256").update(secretKey).digest(),
    iv
  );

  const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);

  const envPath = path.join(process.resourcesPath, "backend", ".env");
  fs.writeFileSync(envPath, decrypted);
  console.log("✅ .env gedecodeerd en geschreven naar:", envPath);
}

// Backend pad bepalen
function getBackendPath() {
  const base = isDev
    ? path.join(__dirname, "..", "backend", "dist")
    : path.join(process.resourcesPath, "backend");

  if (os.platform() === "win32") {
    return path.join(base, isDev ? "app.exe" : "app.exe");
  } else {
    return path.join(base, "app");
  }
}

// Backend starten
async function startBackend() {
  decryptEnv();

  const backendPath = getBackendPath();
  if (!fs.existsSync(backendPath)) {
    console.error("❌ Geen backend executable gevonden:", backendPath);
    app.quit();
    return;
  }

  console.log("🚀 Start backend via:", backendPath);

  backendProcess = spawn(backendPath, [`--port=${API_PORT}`], {
    shell: true,
    stdio: isDev ? "inherit" : "ignore",
    windowsHide: !isDev,
  });

  backendProcess.on("error", (err) => {
    console.error("❌ Fout bij starten backend:", err);
  });

  backendProcess.on("exit", (code) => {
    console.log(`ℹ️ Backend gestopt met code ${code}`);
  });

  await waitForBackend();
}

// Backend stoppen
function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

app.whenReady().then(async () => {
  await startBackend();
  createWindow();
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
