const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Pad naar je echte .env
const envPath = path.join(__dirname, "backend/.env");
const encryptedPath = path.join(__dirname, "backend/.env.enc");

// Encryptiesleutel komt uit een GitHub Secret of lokaal ENV
const secretKey = process.env.ENV_SECRET_KEY;
if (!secretKey) {
  console.error("❌ ENV_SECRET_KEY is niet gezet!");
  process.exit(1);
}

const algorithm = "aes-256-ctr";
const iv = crypto.randomBytes(16);

const envContent = fs.readFileSync(envPath, "utf-8");
const cipher = crypto.createCipheriv(algorithm, crypto.createHash("sha256").update(secretKey).digest(), iv);

const encrypted = Buffer.concat([cipher.update(envContent), cipher.final()]);

fs.writeFileSync(encryptedPath, JSON.stringify({
  iv: iv.toString("hex"),
  content: encrypted.toString("hex")
}));

console.log("✅ .env versleuteld opgeslagen als .env.enc");
