const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");

const isDev = !app.isPackaged;
let backendProcess = null;
const API_PORT = 8000; // standaard backend poort
const FRONTEND_DEV_URL = "http://localhost:5173";

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev) {
    // Probeer Vite server te bereiken met retries
    let attempts = 0;
    const maxAttempts = 10;

    const tryLoad = () => {
      attempts++;
      win.loadURL(FRONTEND_DEV_URL).catch(() => {
        if (attempts < maxAttempts) {
          console.log(`⏳ Wachten op Vite dev server... poging ${attempts}`);
          setTimeout(tryLoad, 1000);
        } else {
          console.error("❌ Kan Vite dev server niet bereiken!");
        }
      });
    };

    tryLoad();
    win.webContents.openDevTools();
  } else {
    const indexPath = path.join(process.resourcesPath, "dist", "index.html");
    win.loadFile(indexPath).catch((err) => {
      console.error("❌ Kan index.html niet laden:", err);
    });
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
  const base = isDev
    ? path.join(__dirname, "backend")
    : path.join(process.resourcesPath, "backend");

  if (os.platform() === "win32") {
    return isDev
      ? path.join(base, "launcher.py") // dev gebruikt python script
      : path.join(base, "app.exe"); // prod gebruikt exe
  } else {
    return isDev ? path.join(base, "launcher.py") : path.join(base, "app");
  }
}

function startBackend() {
  decryptEnv();

  const backendPath = getBackendPath();

  if (!fs.existsSync(backendPath)) {
    console.error("❌ Backend bestand niet gevonden:", backendPath);
    app.quit();
    return;
  }

  let command, args;

  if (backendPath.endsWith(".py")) {
    command = "python";
    args = [backendPath, `--port=${API_PORT}`];
  } else {
    command = backendPath; // exe of bin
    args = [`--port=${API_PORT}`];
  }

  console.log(`🚀 Start backend: ${command} ${args.join(" ")}`);

  backendProcess = spawn(command, args, {
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
