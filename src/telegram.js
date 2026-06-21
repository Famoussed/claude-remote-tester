// Telegram Bot API gondericisi.
// Harici bagimlilik yok: Node 18+ yerlesik fetch / FormData / Blob kullanir.

import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { convertWebmToMp4 } from "./video.js";

const API = (method) => `https://api.telegram.org/bot${config.telegram.token}/${method}`;

async function call(method, form) {
  const res = await fetch(API(method), { method: "POST", body: form });
  const json = await res.json().catch(() => ({ ok: false, description: "JSON parse hatasi" }));
  if (!json.ok) {
    throw new Error(`Telegram ${method} hatasi: ${json.description || res.status}`);
  }
  return json.result;
}

function fileBlob(filePath, mime) {
  const buf = fs.readFileSync(filePath);
  return new Blob([buf], { type: mime });
}

export async function sendMessage(text) {
  const form = new FormData();
  form.append("chat_id", config.telegram.chatId);
  form.append("text", text);
  return call("sendMessage", form);
}

export async function sendPhoto(filePath, caption) {
  const form = new FormData();
  form.append("chat_id", config.telegram.chatId);
  if (caption) form.append("caption", caption.slice(0, 1024));
  form.append("photo", fileBlob(filePath, "image/png"), path.basename(filePath));
  return call("sendPhoto", form);
}

export async function sendVideo(filePath, caption, mime = "video/mp4") {
  const form = new FormData();
  form.append("chat_id", config.telegram.chatId);
  if (caption) form.append("caption", caption.slice(0, 1024));
  // supports_streaming: Telegram'in videoyu inline (akis halinde) oynatmasini saglar.
  form.append("supports_streaming", "true");
  form.append("video", fileBlob(filePath, mime), path.basename(filePath));
  return call("sendVideo", form);
}

export async function sendDocument(filePath, caption, mime = "application/octet-stream") {
  const form = new FormData();
  form.append("chat_id", config.telegram.chatId);
  if (caption) form.append("caption", caption.slice(0, 1024));
  form.append("document", fileBlob(filePath, mime), path.basename(filePath));
  return call("sendDocument", form);
}

// Birden fazla fotografi tek bir albumde (media group) gonder. En fazla 10'arli.
export async function sendPhotoAlbum(files, caption) {
  if (files.length === 0) return;
  // 10'arli gruplara bol.
  for (let i = 0; i < files.length; i += 10) {
    const chunk = files.slice(i, i + 10);
    const form = new FormData();
    form.append("chat_id", config.telegram.chatId);
    const media = chunk.map((f, idx) => {
      const attachName = `photo${idx}`;
      form.append(attachName, fileBlob(f, "image/png"), path.basename(f));
      const item = { type: "photo", media: `attach://${attachName}` };
      // Caption'i sadece ilk fotografa, ilk grupta koy.
      if (i === 0 && idx === 0 && caption) item.caption = caption.slice(0, 1024);
      return item;
    });
    form.append("media", JSON.stringify(media));
    await call("sendMediaGroup", form);
  }
}

// Bir test sonucunu komple Telegram'a gonder.
// Strateji: ozet + screenshot albumu + video (boyut uygunsa) + HTML rapor dosyasi.
export async function sendTestResult(ctx, { summary, htmlReport }) {
  const results = { sent: [], errors: [] };

  // 1) Screenshot'lari album olarak ozet caption ile gonder.
  try {
    const shotFiles = ctx.screenshots.map((s) => s.file).filter((f) => fs.existsSync(f));
    if (shotFiles.length) {
      await sendPhotoAlbum(shotFiles, summary);
      results.sent.push(`${shotFiles.length} screenshot`);
    } else {
      await sendMessage(summary);
      results.sent.push("ozet metin");
    }
  } catch (e) {
    results.errors.push(`screenshot: ${e.message}`);
    // Albumde hata olursa en azindan ozeti gonder.
    try {
      await sendMessage(summary);
      results.sent.push("ozet metin (fallback)");
    } catch {
      /* yoksay */
    }
  }

  // 2) Video gonder (Telegram bot dosya limiti ~50MB).
  // Playwright webm uretir; Telegram (ozellikle iOS) webm'i inline oynatamaz.
  // Once mp4'e (H.264) cevir; ffmpeg yoksa webm'i document olarak gonder.
  if (ctx.video && fs.existsSync(ctx.video)) {
    try {
      const mp4 = convertWebmToMp4(ctx.video);
      const toSend = mp4 || ctx.video;
      const sizeMb = fs.statSync(toSend).size / (1024 * 1024);
      if (sizeMb > 49) {
        results.errors.push(`video cok buyuk (${sizeMb.toFixed(1)}MB), atlandi`);
      } else if (mp4) {
        await sendVideo(mp4, "🎥 Test videosu", "video/mp4");
        results.sent.push("video (mp4)");
      } else {
        // ffmpeg yok: webm'i oynatilabilir bir dosya olarak gonder.
        await sendDocument(ctx.video, "🎥 Test videosu (webm — ffmpeg kurarsan mp4 olur)", "video/webm");
        results.sent.push("video (webm/document)");
      }
    } catch (e) {
      results.errors.push(`video: ${e.message}`);
    }
  }

  // 3) HTML rapor dosyasini gonder.
  if (htmlReport && fs.existsSync(htmlReport)) {
    try {
      await sendDocument(htmlReport, "📄 Detayli HTML rapor", "text/html");
      results.sent.push("html rapor");
    } catch (e) {
      results.errors.push(`rapor: ${e.message}`);
    }
  }

  return results;
}

// Bota gelen son mesajlardan chat ID'yi otomatik bul (kurulum yardimcisi).
export async function discoverChatId(token) {
  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.description || "getUpdates hatasi");
  const updates = json.result || [];
  const found = [];
  for (const u of updates) {
    const msg = u.message || u.edited_message || u.channel_post;
    if (msg && msg.chat) {
      found.push({
        id: msg.chat.id,
        name: msg.chat.title || `${msg.chat.first_name || ""} ${msg.chat.last_name || ""}`.trim() || msg.chat.username,
        type: msg.chat.type,
      });
    }
  }
  // Tekille.
  const uniq = [...new Map(found.map((f) => [f.id, f])).values()];
  return uniq;
}
