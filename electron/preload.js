const { contextBridge, ipcRenderer } = require("electron");
const http = require("http");

let backendPort = null;

ipcRenderer.on("backend-port", (_, port) => {
  backendPort = port;
  console.log("🔌 Backend poort ontvangen:", port);
});

function pingBackend() {
  return new Promise((resolve, reject) => {
    if (!backendPort) {
      reject(false);
      return;
    }
    http
      .get(`http://localhost:${backendPort}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          reject(false);
        }
      })
      .on("error", () => {
        reject(false);
      });
  });
}

contextBridge.exposeInMainWorld("backend", {
  isReady: async () => {
    try {
      return await pingBackend();
    } catch {
      return false;
    }
  },
  getPort: () => backendPort,
  getApiUrl: () => (backendPort ? `http://localhost:${backendPort}` : null),
});
