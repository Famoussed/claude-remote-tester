// Test sonucundan kendi kendine yeten (self-contained) bir HTML rapor uretir.
// Screenshot'lari base64 gomerek tek dosyada tasinabilir hale getirir.

import fs from "node:fs";
import path from "node:path";

function imgToDataUri(file) {
  try {
    const b = fs.readFileSync(file);
    return `data:image/png;base64,${b.toString("base64")}`;
  } catch {
    return "";
  }
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildHtmlReport(ctx) {
  const pass = ctx.status === "passed";
  const color = pass ? "#16a34a" : "#dc2626";
  const statusText = pass ? "BASARILI" : "BASARISIZ";
  const dur = (ctx.durationMs / 1000).toFixed(1);

  const shots = ctx.screenshots
    .map(
      (s) => `
      <figure class="shot">
        <img src="${imgToDataUri(s.file)}" alt="${esc(s.name)}" loading="lazy" />
        <figcaption>${esc(s.name)}</figcaption>
      </figure>`
    )
    .join("");

  const stepsRows = ctx.steps
    .map(
      (s) => `<tr><td>${s.index}</td><td><code>${esc(s.action)}</code></td><td>${esc(s.detail)}</td></tr>`
    )
    .join("");

  const errBlock = ctx.error
    ? `<div class="err"><h3>Hata</h3><pre>${esc(ctx.error.message)}\n\n${esc(ctx.error.stack || "")}</pre></div>`
    : "";

  const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Test Raporu — ${esc(ctx.runName)}</title>
<style>
  :root{font-family:system-ui,Segoe UI,Roboto,sans-serif}
  body{margin:0;background:#0b0f17;color:#e5e7eb}
  header{padding:20px 24px;border-bottom:1px solid #1f2937;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
  .badge{background:${color};color:#fff;padding:6px 14px;border-radius:999px;font-weight:700;font-size:14px}
  h1{font-size:18px;margin:0}
  .meta{color:#9ca3af;font-size:13px}
  .wrap{padding:24px;max-width:1100px;margin:0 auto}
  h2{font-size:15px;color:#93c5fd;margin:28px 0 12px;text-transform:uppercase;letter-spacing:.5px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
  figure.shot{margin:0;background:#111827;border:1px solid #1f2937;border-radius:10px;overflow:hidden}
  figure.shot img{width:100%;display:block;background:#fff}
  figcaption{padding:8px 12px;font-size:13px;color:#cbd5e1}
  table{width:100%;border-collapse:collapse;font-size:13px}
  td,th{text-align:left;padding:8px 10px;border-bottom:1px solid #1f2937}
  code{background:#1f2937;padding:2px 6px;border-radius:5px;color:#a5b4fc}
  .err{background:#1c1010;border:1px solid #7f1d1d;border-radius:10px;padding:16px;margin-top:16px}
  .err pre{white-space:pre-wrap;color:#fca5a5;font-size:12px}
  video{width:100%;border-radius:10px;border:1px solid #1f2937;background:#000}
</style></head>
<body>
<header>
  <span class="badge">${statusText}</span>
  <h1>${esc(ctx.runName)}</h1>
  <span class="meta">${ctx.steps.length} adim · ${ctx.screenshots.length} goruntu · ${dur}s · ${esc(
    ctx.baseUrl
  )}</span>
</header>
<div class="wrap">
  ${errBlock}
  <h2>Goruntuler</h2>
  <div class="grid">${shots}</div>
  ${ctx.video ? `<h2>Video</h2><video controls src="${path.basename(ctx.video)}"></video>` : ""}
  <h2>Adimlar</h2>
  <table><thead><tr><th>#</th><th>Aksiyon</th><th>Detay</th></tr></thead><tbody>${stepsRows}</tbody></table>
</div>
</body></html>`;

  const out = path.join(ctx.dir, "rapor.html");
  fs.writeFileSync(out, html, "utf8");
  return out;
}

// Telegram caption / konsol icin kisa metin ozeti.
export function buildTextSummary(ctx) {
  const pass = ctx.status === "passed";
  const icon = pass ? "✅" : "❌";
  const dur = (ctx.durationMs / 1000).toFixed(1);
  const lines = [];
  lines.push(`${icon} ${pass ? "BASARILI" : "BASARISIZ"} — ${ctx.runName}`);
  lines.push(`🌐 ${ctx.baseUrl || "(url yok)"}`);
  lines.push(`📋 ${ctx.steps.length} adim · 🖼️ ${ctx.screenshots.length} goruntu · ⏱️ ${dur}s`);
  if (ctx.assertions.length) {
    lines.push(`✓ ${ctx.assertions.length} dogrulama gecti`);
  }
  if (ctx.error) {
    lines.push("");
    lines.push(`⚠️ Hata: ${ctx.error.message.slice(0, 300)}`);
    // Hatanin hangi adimda oldugunu goster.
    const last = ctx.steps[ctx.steps.length - 1];
    if (last) lines.push(`   (son adim: ${last.action} → ${last.detail})`);
  }
  return lines.join("\n");
}
