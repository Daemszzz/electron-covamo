const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");

const isDev = !app.isPackaged;
let backendProcess = null;
const API_PORT = 8000; // Prod backend poort

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

function decryptEnv() {
  if (isDev) return; // Dev gebruikt eigen .env

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

function getBackendPath() {
  if (isDev) return null; // dev gebruikt start-backend.js

  const base = path.join(process.resourcesPath, "backend");

  if (os.platform() === "win32") return path.join(base, "app.exe");
  else return path.join(base, "app"); // Mac/Linux
}

function startBackend() {
  if (isDev) return;

  decryptEnv(); // eerst .env decoderen

  const backendPath = getBackendPath();
  if (!backendPath) return;

  console.log("🚀 Start backend via:", backendPath);

  backendProcess = spawn(backendPath, [`--port=${API_PORT}`], {
    shell: true,
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
