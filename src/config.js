// Konfigurasyon yukleyici.
// Oncelik sirasi: CLI argumanlari > ortam degiskenleri > .env dosyasi > varsayilanlar.
// Hicbir gizli bilgi koda gomulmez; her sey .env veya ortamdan gelir.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Basit .env okuyucu (bagimlilik eklememek icin elle yazildi).
function loadDotEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // Tirnaklari soy.
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const fileEnv = loadDotEnv();

function pick(key, fallback) {
  return process.env[key] ?? fileEnv[key] ?? fallback;
}

export const ROOT_DIR = ROOT;

export const config = {
  telegram: {
    token: pick("TELEGRAM_BOT_TOKEN", ""),
    chatId: pick("TELEGRAM_CHAT_ID", ""),
  },
  // Test ciktilarinin yazilacagi ana klasor.
  outputDir: pick("RT_OUTPUT_DIR", path.join(ROOT, "runs")),
  // Varsayilan tarayici ayarlari.
  defaults: {
    headless: pick("RT_HEADLESS", "true") !== "false",
    viewportWidth: parseInt(pick("RT_VIEWPORT_WIDTH", "1280"), 10),
    viewportHeight: parseInt(pick("RT_VIEWPORT_HEIGHT", "800"), 10),
    timeoutMs: parseInt(pick("RT_TIMEOUT_MS", "15000"), 10),
    video: pick("RT_VIDEO", "true") !== "false",
  },
};

export function telegramConfigured() {
  return Boolean(config.telegram.token && config.telegram.chatId);
}

// .env dosyasini diskten yeniden oku ve config'i guncelle.
// 'setup-telegram' .env'i yazdiktan sonra ayni process icinde token'i tazelemek icin.
export function reloadConfig() {
  const fresh = loadDotEnv();
  const get = (k, fb) => process.env[k] ?? fresh[k] ?? fb;
  config.telegram.token = get("TELEGRAM_BOT_TOKEN", "");
  config.telegram.chatId = get("TELEGRAM_CHAT_ID", "");
  return config;
}
