const { spawn } = require("child_process");
const path = require("path");
const os = require("os");

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

  console.log("🚀 Start backend op poort 8000");

  const backend = spawn(pythonPath, [script, "--port=8000"], {
    stdio: "inherit",
  });

  backend.on("error", (err) => {
    console.error("❌ Fout bij starten backend:", err);
  });
}

startBackend();
