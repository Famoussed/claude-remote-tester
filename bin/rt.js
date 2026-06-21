#!/usr/bin/env node
// Remote Tester CLI — "rt" komutu.
// Her dizinden calisir. Telefondaki Claude session'in elleri ve gozleri.
//
// Kullanim:
//   rt run <url> --steps '<json>'        JSON DSL adimlariyla test
//   rt run <url> --file test.json        Dosyadan JSON test
//   rt run <url> --code test.spec.js     Ham Playwright kodu (kacis kapisi)
//   rt init                              Bulundugun projeye CLAUDE.md notu + ornek ekler
//   rt setup-telegram <token>            Chat ID'yi bulup .env'e yazar
//   rt doctor                            Kurulum durumunu kontrol eder

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config, telegramConfigured, reloadConfig, ROOT_DIR } from "../src/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function help() {
  console.log(`
Remote Tester (rt) — Claude'un Playwright elleri

KOMUTLAR
  rt run <url> [secenekler]     Bir UI testi calistir ve sonucu Telegram'a gonder
  rt init                       Bulundugun projeye kullanim notu + ornek senaryo ekle
  rt setup-telegram <token>     Telegram bot token'i ile chat ID'yi bul ve kaydet
  rt doctor                     Kurulum/yapilandirma kontrolu

RUN SECENEKLERI
  --steps '<json>'    JSON DSL adim dizisi (string)
  --file <yol>        JSON adim dosyasi (steps dizisi ya da {url,steps})
  --code <yol>        Ham Playwright kodu dosyasi (page degiskeni hazir)
  --name <ad>         Bu calismaya isim ver (rapor klasoru icin)
  --browser <ad>      chromium | firefox | webkit  (varsayilan chromium)
  --headed            Tarayiciyi gorunur ac (hata ayiklama)
  --no-telegram       Telegram'a gonderme, sadece yerel rapor uret
  --no-video          Video kaydetme

ORNEK
  rt run http://localhost:3000 --steps '[
    {"click":"Giris Yap"},
    {"fill":"#email","value":"test@x.com"},
    {"fill":"#password","value":"123456","secret":true},
    {"click":"Gonder"},
    {"expect":"Hosgeldin"},
    {"screenshot":"panel"}
  ]'

JSON DSL ADIMLARI
  {"goto":"/path"}                     sayfaya git (url'ye gore)
  {"click":"Metin"} | {"click":true,"selector":"#x"}
  {"fill":"#sel","value":"x","secret":true}
  {"type":"#sel","value":"yavas yazi"}
  {"press":"Enter"}
  {"select":"#sel","value":"opt"}
  {"check":"#sel"} | {"uncheck":"#sel"}
  {"hover":"#sel"}
  {"wait":1000} | {"wait":"#sel","state":"visible"}
  {"waitForUrl":"**/panel"}
  {"scroll":"bottom"} | {"scroll":"#sel"}
  {"screenshot":"ad","fullPage":true}
  {"expect":"gorunmesi gereken metin"}
  {"expect":{"visible":"#sel"}} | {"hidden":"#sel"} | {"url":"**/x"} | {"text":"..","in":"#sel"} | {"title":".."}
`);
}

async function cmdRun(args) {
  const { runTest } = await import("../src/runner.js");
  const { buildHtmlReport, buildTextSummary } = await import("../src/report.js");

  const url = args._[0];
  let steps = [];
  let code = null;

  if (args.file) {
    const raw = fs.readFileSync(path.resolve(args.file), "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) steps = parsed;
    else {
      steps = parsed.steps || [];
      if (!args._[0] && parsed.url) args._[0] = parsed.url;
    }
  } else if (args.steps && typeof args.steps === "string") {
    steps = JSON.parse(args.steps);
  } else if (args.code) {
    code = fs.readFileSync(path.resolve(args.code), "utf8");
  }

  if (!url && !code && steps.length === 0) {
    console.error("HATA: bir <url> ya da --steps/--file/--code gerekli. 'rt help' yaz.");
    process.exit(1);
  }

  // Video ayarini override et.
  if (args["no-video"]) config.defaults.video = false;

  console.log(`▶ Test baslatiliyor: ${url || "(kod modu)"} ...`);

  const ctx = await runTest({
    url: args._[0],
    steps,
    code,
    browser: args.browser,
    headless: args.headed ? false : undefined,
    runName: args.name,
  });

  const summary = buildTextSummary(ctx);
  const htmlReport = buildHtmlReport(ctx);

  console.log("\n" + summary);
  console.log(`\n📁 Yerel cikti: ${ctx.dir}`);
  console.log(`📄 HTML rapor: ${htmlReport}`);

  // Telegram'a gonder.
  if (!args["no-telegram"]) {
    if (!telegramConfigured()) {
      console.warn(
        "\n⚠ Telegram yapilandirilmamis. 'rt setup-telegram <token>' calistir. (Yerel rapor hazir.)"
      );
    } else {
      const { sendTestResult } = await import("../src/telegram.js");
      console.log("\n📤 Telegram'a gonderiliyor...");
      const res = await sendTestResult(ctx, { summary, htmlReport });
      console.log(`✓ Gonderildi: ${res.sent.join(", ") || "yok"}`);
      if (res.errors.length) console.warn(`⚠ Sorunlar: ${res.errors.join(" | ")}`);
    }
  }

  process.exit(ctx.status === "passed" ? 0 : 1);
}

async function cmdSetupTelegram(args) {
  const token = args._[0];
  if (!token) {
    console.error("Kullanim: rt setup-telegram <BOT_TOKEN>");
    console.error("Once bota Telegram'dan bir mesaj yazmis olman gerekir!");
    process.exit(1);
  }
  const { discoverChatId } = await import("../src/telegram.js");
  console.log("🔎 Chat ID araniyor (bota yazdigin mesajlardan)...");
  const chats = await discoverChatId(token);
  if (chats.length === 0) {
    console.error(
      "\n❌ Hic mesaj bulunamadi. Telegram'da bota bir mesaj yaz (orn 'merhaba'), sonra tekrar dene."
    );
    process.exit(1);
  }
  console.log("\nBulunan sohbetler:");
  chats.forEach((c, i) => console.log(`  [${i + 1}] ${c.name} (id: ${c.id}, ${c.type})`));

  // Tek sohbet varsa otomatik sec; coksa ilkini al ama uyari ver.
  const chosen = chats[0];
  writeEnv({ TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: String(chosen.id) });
  reloadConfig(); // ayni process icinde taze token/chat_id ile devam et
  console.log(`\n✓ .env'e yazildi: token + chat_id=${chosen.id} (${chosen.name})`);
  if (chats.length > 1) {
    console.log("⚠ Birden fazla sohbet vardi, ilki secildi. Yanlissa .env'de TELEGRAM_CHAT_ID'yi degistir.");
  }

  // Test mesaji gonder.
  const { sendMessage } = await import("../src/telegram.js");
  await sendMessage("✅ Remote Tester baglandi! Artik test sonuclarini buraya gonderebilirim.");
  console.log("📩 Test mesaji gonderildi — Telegram'i kontrol et.");
}

function writeEnv(updates) {
  const envPath = path.join(ROOT_DIR, ".env");
  let lines = [];
  if (fs.existsSync(envPath)) lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  const map = new Map();
  for (const l of lines) {
    const eq = l.indexOf("=");
    if (eq > -1 && !l.trim().startsWith("#")) map.set(l.slice(0, eq).trim(), l.slice(eq + 1));
  }
  for (const [k, v] of Object.entries(updates)) map.set(k, v);
  const out = [...map.entries()].map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
  fs.writeFileSync(envPath, out, "utf8");
}

function cmdInit() {
  const cwd = process.cwd();
  const tplPath = path.join(__dirname, "..", "templates", "CLAUDE_note.md");
  const note = fs.readFileSync(tplPath, "utf8");

  // 1) Ornek senaryo dosyasi.
  const exampleDir = path.join(cwd, ".remote-tester");
  fs.mkdirSync(exampleDir, { recursive: true });
  const examplePath = path.join(exampleDir, "ornek-test.json");
  if (!fs.existsSync(examplePath)) {
    fs.writeFileSync(
      examplePath,
      JSON.stringify(
        {
          url: "http://localhost:3000",
          steps: [
            { screenshot: "anasayfa" },
            { click: "Giris Yap" },
            { fill: "#email", value: "test@example.com" },
            { fill: "#password", value: "sifre123", secret: true },
            { click: "Gonder" },
            { expect: "Hosgeldin" },
            { screenshot: "panel" },
          ],
        },
        null,
        2
      ),
      "utf8"
    );
  }

  // 2) CLAUDE.md'ye not ekle (varsa ekle, yoksa olustur).
  const claudeMd = path.join(cwd, "CLAUDE.md");
  const marker = "<!-- remote-tester -->";
  let existing = fs.existsSync(claudeMd) ? fs.readFileSync(claudeMd, "utf8") : "";
  if (existing.includes(marker)) {
    console.log("ℹ CLAUDE.md zaten Remote Tester notunu iceriyor, atlandi.");
  } else {
    const block = `\n${marker}\n${note}\n`;
    fs.writeFileSync(claudeMd, existing + block, "utf8");
    console.log(`✓ CLAUDE.md guncellendi: ${claudeMd}`);
  }
  console.log(`✓ Ornek senaryo: ${examplePath}`);
  console.log("\nArtik bu projede Claude'a 'su testi yap ve gorselini at' diyebilirsin.");
}

function cmdDoctor() {
  console.log("Remote Tester — durum kontrolu\n");
  console.log(`• Tool dizini: ${ROOT_DIR}`);
  console.log(`• Cikti dizini: ${config.outputDir}`);
  console.log(`• Telegram: ${telegramConfigured() ? "✓ yapilandirilmis" : "✗ EKSIK (rt setup-telegram <token>)"}`);
  console.log(`• Headless: ${config.defaults.headless}`);
  console.log(`• Video: ${config.defaults.video}`);
  console.log(`• Viewport: ${config.defaults.viewportWidth}x${config.defaults.viewportHeight}`);
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const args = parseArgs(argv.slice(1));

  try {
    switch (cmd) {
      case "run":
        await cmdRun(args);
        break;
      case "init":
        cmdInit();
        break;
      case "setup-telegram":
        await cmdSetupTelegram(args);
        break;
      case "doctor":
        cmdDoctor();
        break;
      case "help":
      case "--help":
      case "-h":
      case undefined:
        help();
        break;
      default:
        console.error(`Bilinmeyen komut: ${cmd}\n`);
        help();
        process.exit(1);
    }
  } catch (err) {
    console.error(`\n❌ Hata: ${err.message}`);
    if (process.env.RT_DEBUG) console.error(err.stack);
    process.exit(1);
  }
}

main();
