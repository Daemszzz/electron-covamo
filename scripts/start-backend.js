const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");

const PORT = 8000; // dev en prod consistent

function getVenvPythonPath() {
  const baseVenv = path.join(__dirname, "..", "venv");
  if (os.platform() === "win32") {
    return path.join(baseVenv, "Scripts", "python.exe");
  } else {
    return path.join(baseVenv, "bin", "python3");
  }
}

function startBackend() {
  const pythonPath = getVenvPythonPath();
  const script = path.join(__dirname, "..", "backend", "app.py");

  if (!fs.existsSync(pythonPath)) {
    console.error("❌ Python executable niet gevonden in venv:", pythonPath);
    process.exit(1);
  }

  console.log(`🚀 Start backend (dev) op poort ${PORT}`);

  const backend = spawn(pythonPath, [script, `--port=${PORT}`], {
    stdio: "inherit",
  });

  backend.on("error", (err) => {
    console.error("❌ Fout bij starten backend:", err);
  });
}

startBackend();
