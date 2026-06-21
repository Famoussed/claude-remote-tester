// Video donusturucu: Playwright'in webm (VP8/VP9) ciktisini Telegram'in her cihazda
// (ozellikle iOS) inline oynatabilecegi mp4 (H.264 + AAC, faststart) formatina cevirir.
// ffmpeg yoksa null doner; cagiran taraf webm'i document olarak gondererek geri duser.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

let ffmpegChecked = false;
let ffmpegAvailable = false;

export function hasFfmpeg() {
  if (ffmpegChecked) return ffmpegAvailable;
  ffmpegChecked = true;
  try {
    const r = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
    ffmpegAvailable = r.status === 0;
  } catch {
    ffmpegAvailable = false;
  }
  return ffmpegAvailable;
}

// webm dosyasini ayni klasorde .mp4 olarak uretir. Basarisizsa null doner.
export function convertWebmToMp4(webmPath) {
  if (!hasFfmpeg()) return null;
  if (!webmPath || !fs.existsSync(webmPath)) return null;

  const mp4Path = path.join(
    path.dirname(webmPath),
    path.basename(webmPath, path.extname(webmPath)) + ".mp4"
  );

  // -movflags +faststart: metadata'yi basa alir, akis halinde oynatma icin sart.
  // -pix_fmt yuv420p: maksimum oynaticilik (iOS/QuickTime dahil).
  // libx264 + aac: Telegram'in inline oynattigi standart kombinasyon.
  const args = [
    "-y",
    "-i",
    webmPath,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    mp4Path,
  ];

  const r = spawnSync("ffmpeg", args, { stdio: "ignore" });
  if (r.status === 0 && fs.existsSync(mp4Path)) return mp4Path;
  return null;
}
