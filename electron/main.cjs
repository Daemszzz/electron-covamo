const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");
const fs = require("fs");
// const crypto = require("crypto");
const http = require("http");

const isDev = !app.isPackaged;
let backendProcess = null;
const API_PORT = 8000;
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

// function decryptEnv() {
//   if (isDev) return;

//   const secretKey = process.env.ENV_SECRET_KEY;
//   if (!secretKey) {
//     dialog.showErrorBox("Configuratiefout", "ENV_SECRET_KEY is niet gezet!");
//     app.quit();
//     return;
//   }

//   const encPath = path.join(process.resourcesPath, "backend", ".env.enc");
//   if (!fs.existsSync(encPath)) {
//     dialog.showErrorBox("Backend fout", "Versleutelde .env.enc niet gevonden!");
//     app.quit();
//     return;
//   }

//   try {
//     const encryptedData = JSON.parse(fs.readFileSync(encPath, "utf-8"));
//     const iv = Buffer.from(encryptedData.iv, "hex");
//     const content = Buffer.from(encryptedData.content, "hex");

//     const decipher = crypto.createDecipheriv(
//       "aes-256-ctr",
//       crypto.createHash("sha256").update(secretKey).digest(),
//       iv
//     );

//     const decrypted = Buffer.concat([
//       decipher.update(content),
//       decipher.final(),
//     ]);
//     const envPath = path.join(process.resourcesPath, "backend", ".env");

//     fs.writeFileSync(envPath, decrypted);
//     console.log("✅ .env gedecodeerd en geschreven naar:", envPath);
//   } catch (err) {
//     dialog.showErrorBox("Decryptie fout", err.message);
//     app.quit();
//   }
// }

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

function waitForBackend(port, retries = 10, delay = 1000) {
  return new Promise((resolve, reject) => {
    const attempt = (count) => {
      http
        .get(`http://localhost:${port}/health`, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else if (count > 0) {
            setTimeout(() => attempt(count - 1), delay);
          } else {
            reject(new Error("Backend reageert niet"));
          }
        })
        .on("error", () => {
          if (count > 0) {
            setTimeout(() => attempt(count - 1), delay);
          } else {
            reject(new Error("Backend niet bereikbaar"));
          }
        });
    };
    attempt(retries);
  });
}

function startBackend() {
  // decryptEnv();

  const backendPath = getBackendPath();

  if (!fs.existsSync(backendPath)) {
    dialog.showErrorBox(
      "Backend fout",
      `Backend bestand niet gevonden:\n${backendPath}`
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

  const stdioConfig = isDev ? "inherit" : ["ignore", "pipe", "pipe"];
  backendProcess = spawn(command, args, {
    shell: true,
    stdio: stdioConfig,
    windowsHide: !isDev,
  });

  if (!isDev) {
    const logFile = path.join(app.getPath("userData"), "backend.log");
    const logStream = fs.createWriteStream(logFile, { flags: "a" });
    backendProcess.stdout.pipe(logStream);
    backendProcess.stderr.pipe(logStream);
  }

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

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

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
