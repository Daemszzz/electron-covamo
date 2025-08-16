const { contextBridge } = require("electron");
const http = require("http");

function pingBackend(port = 8000) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}/health`, (res) => {
      if (res.statusCode === 200) {
        resolve(true);
      } else {
        reject(false);
      }
    }).on("error", () => {
      reject(false);
    });
  });
}

contextBridge.exposeInMainWorld("backend", {
  isReady: async () => {
    try {
      return await pingBackend(8000);
    } catch {
      return false;
    }
  },
});
