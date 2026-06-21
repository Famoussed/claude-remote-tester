// Playwright test calistirici.
// JSON DSL adimlarini ya da ham Playwright kodunu calistirir.
// Her adimda screenshot alir, video + trace kaydeder, sonucu yapilandirilmis dondurur.

import fs from "node:fs";
import path from "node:path";
import { chromium, firefox, webkit } from "playwright";
import { config } from "./config.js";

const BROWSERS = { chromium, firefox, webkit };

// Bir locator'u DSL adimindan cozer.
// Oncelik: explicit selector > role+name > metin > placeholder > label > test-id.
function resolveLocator(page, step) {
  if (step.selector) return page.locator(step.selector);
  if (step.role) return page.getByRole(step.role, step.name ? { name: step.name } : undefined);
  if (step.text) return page.getByText(step.text, { exact: !!step.exact });
  if (step.placeholder) return page.getByPlaceholder(step.placeholder);
  if (step.label) return page.getByLabel(step.label);
  if (step.testId) return page.getByTestId(step.testId);
  // "click" gibi adimlar icin kullanici dogrudan metni "click": "Giris" verebilir.
  return null;
}

// Bir adimin hedefini insan-okur etikete cevir (loglar icin).
function describeTarget(step) {
  return (
    step.selector ||
    step.name ||
    step.text ||
    step.placeholder ||
    step.label ||
    step.testId ||
    (typeof step.click === "string" ? step.click : "") ||
    ""
  );
}

// Bir DSL adimini calistir. page ve ctx (run context) verilir.
async function runStep(page, step, ctx) {
  const t = config.defaults.timeoutMs;
  const log = (action, detail) =>
    ctx.steps.push({ index: ctx.steps.length + 1, action, detail, ts: Date.now() });

  // --- Navigasyon ---
  if (step.goto !== undefined) {
    const url = resolveUrl(step.goto, ctx.baseUrl);
    await page.goto(url, { waitUntil: step.waitUntil || "load", timeout: t });
    log("goto", url);
    return;
  }

  // --- Tiklamalar ---
  if (step.click !== undefined) {
    // "click": "Giris" (metin) ya da {click:true, selector:"..."}
    if (typeof step.click === "string") {
      await smartClickByText(page, step.click, step.exact, t);
    } else {
      await resolveLocator(page, step).click({ timeout: t });
    }
    log("click", describeTarget(step));
    return;
  }

  // --- Form doldurma ---
  if (step.fill !== undefined) {
    // {fill:"#email", value:"x"} ya da {fill:true, selector, value}
    const loc =
      typeof step.fill === "string" ? page.locator(step.fill) : resolveLocator(page, step);
    await loc.fill(String(step.value ?? ""), { timeout: t });
    log("fill", `${describeTarget(step) || step.fill} = ${maskMaybe(step)}`);
    return;
  }

  if (step.type !== undefined) {
    const loc = typeof step.type === "string" ? page.locator(step.type) : resolveLocator(page, step);
    await loc.pressSequentially(String(step.value ?? ""), { delay: step.delay ?? 30, timeout: t });
    log("type", `${describeTarget(step) || step.type}`);
    return;
  }

  if (step.press !== undefined) {
    await page.keyboard.press(step.press);
    log("press", step.press);
    return;
  }

  if (step.select !== undefined) {
    const loc = page.locator(step.select);
    await loc.selectOption(step.value, { timeout: t });
    log("select", `${step.select} = ${step.value}`);
    return;
  }

  if (step.check !== undefined) {
    await page.locator(step.check).check({ timeout: t });
    log("check", step.check);
    return;
  }

  if (step.uncheck !== undefined) {
    await page.locator(step.uncheck).uncheck({ timeout: t });
    log("uncheck", step.uncheck);
    return;
  }

  if (step.hover !== undefined) {
    const loc = typeof step.hover === "string" ? page.locator(step.hover) : resolveLocator(page, step);
    await loc.hover({ timeout: t });
    log("hover", describeTarget(step) || step.hover);
    return;
  }

  // --- Bekleme ---
  if (step.wait !== undefined) {
    if (typeof step.wait === "number") {
      await page.waitForTimeout(step.wait);
      log("wait", `${step.wait}ms`);
    } else {
      // selector bekle
      await page.locator(step.wait).waitFor({ state: step.state || "visible", timeout: t });
      log("wait", `${step.wait} (${step.state || "visible"})`);
    }
    return;
  }

  if (step.waitForUrl !== undefined) {
    await page.waitForURL(step.waitForUrl, { timeout: t });
    log("waitForUrl", step.waitForUrl);
    return;
  }

  // --- Scroll ---
  if (step.scroll !== undefined) {
    if (step.scroll === "bottom") {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    } else if (step.scroll === "top") {
      await page.evaluate(() => window.scrollTo(0, 0));
    } else {
      await page.locator(step.scroll).scrollIntoViewIfNeeded({ timeout: t });
    }
    log("scroll", String(step.scroll));
    return;
  }

  // --- Dogrulamalar (expect) ---
  if (step.expect !== undefined) {
    await runExpect(page, step, ctx, t);
    return;
  }

  // --- Screenshot ---
  if (step.screenshot !== undefined) {
    const name = typeof step.screenshot === "string" ? step.screenshot : `adim-${ctx.steps.length + 1}`;
    const file = await takeScreenshot(page, ctx, name, step.fullPage);
    log("screenshot", name);
    ctx.screenshots.push({ name, file });
    return;
  }

  throw new Error(`Bilinmeyen adim: ${JSON.stringify(step)}`);
}

// Metne gore akilli tiklama: once tiklanabilir rolleri (button/link) dener,
// sonra genel metni. Boylece "Giris Yap" gibi metinler noktalama/bosluk
// farklarina daha az takilir ve gercek butona tiklar.
async function smartClickByText(page, text, exact, t) {
  const perTry = Math.max(2500, Math.floor(t / 4));
  // Substring eslesmesi icin regex (kullanici "Giris" derse "Giris Yap"i bulur).
  const rx = exact ? undefined : new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const candidates = [
    page.getByRole("button", { name: text, exact: !!exact }),
    page.getByRole("link", { name: text, exact: !!exact }),
    ...(rx
      ? [
          page.getByRole("button", { name: rx }),
          page.getByRole("link", { name: rx }),
          page.getByText(rx),
        ]
      : []),
    page.getByText(text, { exact: !!exact }),
  ];
  let lastErr;
  for (const loc of candidates) {
    try {
      const target = loc.first();
      await target.waitFor({ state: "visible", timeout: perTry });
      await target.click({ timeout: perTry });
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Tiklanacak "${text}" bulunamadi (button/link/metin denendi). ${lastErr?.message || ""}`);
}

async function runExpect(page, step, ctx, t) {
  const e = step.expect;
  // {expect:"metin gorunmeli"}  -> bir metnin gorunur olmasi
  // {expect:{visible:"#sel"}} / {expect:{text:"...", in:"#sel"}} / {expect:{url:"..."}}
  if (typeof e === "string") {
    await page.getByText(e, { exact: false }).first().waitFor({ state: "visible", timeout: t });
    ctx.assertions.push({ desc: `Metin gorunur: "${e}"`, ok: true });
    ctx.steps.push({ index: ctx.steps.length + 1, action: "expect", detail: `gorunur: ${e}`, ts: Date.now() });
    return;
  }
  if (e.visible) {
    await page.locator(e.visible).waitFor({ state: "visible", timeout: t });
    ctx.assertions.push({ desc: `Gorunur: ${e.visible}`, ok: true });
    ctx.steps.push({ index: ctx.steps.length + 1, action: "expect", detail: `gorunur: ${e.visible}`, ts: Date.now() });
    return;
  }
  if (e.hidden) {
    await page.locator(e.hidden).waitFor({ state: "hidden", timeout: t });
    ctx.assertions.push({ desc: `Gizli: ${e.hidden}`, ok: true });
    ctx.steps.push({ index: ctx.steps.length + 1, action: "expect", detail: `gizli: ${e.hidden}`, ts: Date.now() });
    return;
  }
  if (e.url) {
    await page.waitForURL(e.url, { timeout: t });
    ctx.assertions.push({ desc: `URL eslesti: ${e.url}`, ok: true });
    ctx.steps.push({ index: ctx.steps.length + 1, action: "expect", detail: `url: ${e.url}`, ts: Date.now() });
    return;
  }
  if (e.text) {
    const scope = e.in ? page.locator(e.in) : page.locator("body");
    await scope.getByText(e.text, { exact: !!e.exact }).first().waitFor({ state: "visible", timeout: t });
    ctx.assertions.push({ desc: `"${e.text}" ${e.in ? "icinde " + e.in : ""}`, ok: true });
    ctx.steps.push({ index: ctx.steps.length + 1, action: "expect", detail: `metin: ${e.text}`, ts: Date.now() });
    return;
  }
  if (e.title) {
    const title = await page.title();
    if (!title.includes(e.title)) throw new Error(`Baslik "${e.title}" beklendi, gelen: "${title}"`);
    ctx.assertions.push({ desc: `Baslik icerir: ${e.title}`, ok: true });
    ctx.steps.push({ index: ctx.steps.length + 1, action: "expect", detail: `baslik: ${e.title}`, ts: Date.now() });
    return;
  }
  throw new Error(`Bilinmeyen expect: ${JSON.stringify(e)}`);
}

function maskMaybe(step) {
  // Sifre alanlarini loglarda maskele.
  const tgt = (step.selector || step.fill || step.label || "").toString().toLowerCase();
  if (step.secret || tgt.includes("pass") || tgt.includes("sifre") || tgt.includes("parola")) {
    return "******";
  }
  return String(step.value ?? "");
}

function resolveUrl(target, baseUrl) {
  if (/^https?:\/\//i.test(target)) return target;
  if (!baseUrl) return target;
  return new URL(target, baseUrl).toString();
}

async function takeScreenshot(page, ctx, name, fullPage) {
  const safe = String(name).replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60);
  const idx = String(ctx.screenshots.length + 1).padStart(2, "0");
  const file = path.join(ctx.dir, "screenshots", `${idx}-${safe}.png`);
  await page.screenshot({ path: file, fullPage: !!fullPage });
  return file;
}

// Ana giris noktasi: bir test calistir.
// opts: { url, steps, code, browser, headless, runName }
export async function runTest(opts) {
  const browserName = opts.browser || "chromium";
  const launcher = BROWSERS[browserName] || chromium;
  const headless = opts.headless ?? config.defaults.headless;

  const runName = opts.runName || `run-${stamp()}`;
  const dir = path.join(config.outputDir, runName);
  fs.mkdirSync(path.join(dir, "screenshots"), { recursive: true });
  fs.mkdirSync(path.join(dir, "video"), { recursive: true });

  const ctx = {
    dir,
    runName,
    baseUrl: opts.url || "",
    steps: [],
    screenshots: [],
    assertions: [],
    startedAt: Date.now(),
    status: "passed",
    error: null,
  };

  const browser = await launcher.launch({ headless });
  const context = await browser.newContext({
    viewport: {
      width: config.defaults.viewportWidth,
      height: config.defaults.viewportHeight,
    },
    recordVideo: config.defaults.video ? { dir: path.join(dir, "video") } : undefined,
    ignoreHTTPSErrors: true,
  });

  // Trace kaydi (Playwright trace viewer icin).
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

  const page = await context.newPage();

  try {
    if (opts.code) {
      // Ham Playwright kodu kacis kapisi: kullaniciya page/context/expect verilir.
      const fn = new Function(
        "page",
        "context",
        "ctx",
        "takeScreenshot",
        `return (async () => { ${opts.code} })();`
      );
      await fn(page, context, ctx, (n, fp) => takeScreenshot(page, ctx, n, fp).then((f) => {
        ctx.screenshots.push({ name: n, file: f });
        return f;
      }));
    } else {
      // Once baseUrl'e git (eger ilk adim goto degilse).
      const steps = opts.steps || [];
      const firstIsGoto = steps[0] && steps[0].goto !== undefined;
      if (opts.url && !firstIsGoto) {
        await page.goto(opts.url, { waitUntil: "load", timeout: config.defaults.timeoutMs });
        ctx.steps.push({ index: 1, action: "goto", detail: opts.url, ts: Date.now() });
      }
      // Otomatik baslangic screenshot'i.
      const startShot = await takeScreenshot(page, ctx, "baslangic", false);
      ctx.screenshots.push({ name: "baslangic", file: startShot });

      for (const step of steps) {
        await runStep(page, step, ctx);
      }
    }
    // Otomatik bitis screenshot'i.
    const endShot = await takeScreenshot(page, ctx, "bitis", false);
    ctx.screenshots.push({ name: "bitis", file: endShot });
  } catch (err) {
    ctx.status = "failed";
    ctx.error = { message: err.message, stack: err.stack };
    // Hata aninda screenshot al.
    try {
      const failShot = await takeScreenshot(page, ctx, "HATA", true);
      ctx.screenshots.push({ name: "HATA", file: failShot });
    } catch {
      /* sayfa kapali olabilir */
    }
  } finally {
    ctx.finishedAt = Date.now();
    ctx.durationMs = ctx.finishedAt - ctx.startedAt;
    // Trace'i kaydet.
    try {
      await context.tracing.stop({ path: path.join(dir, "trace.zip") });
    } catch {
      /* yoksay */
    }
    await page.close();
    await context.close(); // video burada flush edilir
    await browser.close();
  }

  // Video dosyasini bul (Playwright rastgele isim verir).
  ctx.video = findVideo(path.join(dir, "video"));

  return ctx;
}

function findVideo(dir) {
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".webm"));
    if (files.length === 0) return null;
    return path.join(dir, files[0]);
  } catch {
    return null;
  }
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes()
  )}${p(d.getSeconds())}`;
}
