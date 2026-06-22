# 🤖 Claude Remote Tester (`rt`)

> **Telefondan kod yazarken**, Claude implementasyonu bitirdiğinde — senin yerine manuel UI testini
> Playwright ile yapıp **screenshot + video + HTML raporu Telegram'a gönderen** araç.

![Node](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram-26A5E4?logo=telegram&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 🎯 Neden?

Artık işlerin çoğunu telefondan bağlandığın bir Claude session'ı ile yapıyorsan, Claude bir özelliği
bitirdiğinde **devreye senin girip arayüze bakman, manuel test etmen** gerekir. Bilgisayar başında
değilken bu iş aksar.

`claude-remote-tester` tam bu boşluğu doldurur: yapacağın manuel testi **Claude'un kendisi** yapar,
ekran görüntülerini ve hatta videolu test kaydını **Telegram'dan sana yollar**. Bilgisayara gitmeden,
telefondan manuel test kısmını halletmiş olursun.

> 💡 **Tool'un içinde AI yok.** Zekâ zaten telefondaki Claude'da; `rt` onun **"elleri ve gözleri"**.
> Bu sayede sıfır API maliyeti, sıfır ekstra karmaşa.

## ⚙️ Nasıl çalışır?

```
📱 Telefon (Claude session, bilgisayarına bağlı)
      │  "login olup sepete ürün ekle, ödeme ekranına bak ve görselini at"
      ▼
🧠 Claude → testi JSON adımlarına çevirir, "rt" komutunu çalıştırır
      ▼
🎭 Playwright → tarayıcıyı sürer (her adımda screenshot + video + trace)
      ▼
📤 Telegram → özet + screenshot albümü + 🎥 mp4 video + 📄 HTML rapor
```

## 📦 Kurulum (tek seferlik)

```bash
git clone https://github.com/Famoussed/claude-remote-tester.git
cd claude-remote-tester

npm install                       # bağımlılıklar
npm link                          # 'rt' komutunu global yapar (her dizinden çalışır)
npx playwright install chromium   # tarayıcı yoksa indirir
```

> **Windows:** `rt` komutu `%AppData%\npm` altına eklenir; **yeni bir terminalde** aktif olur.
>
> **Video için (opsiyonel ama önerilir):** [ffmpeg](https://ffmpeg.org/) kurulu olursa video
> Telegram'da inline oynayan `mp4`'e çevrilir. Yoksa `webm` dosya olarak gönderilir.

### 🔗 Telegram'ı bağla

1. Telegram'da **[@BotFather](https://t.me/BotFather)** → `/newbot` → isim + kullanıcı adı ver →
   sana bir **token** verir.
2. Oluşturduğun bota Telegram'dan bir mesaj yaz (örn `merhaba`) — **şart**, yoksa bot sana yazamaz.
3. Token ile chat ID'yi otomatik bul ve kaydet:
   ```bash
   rt setup-telegram 123456789:ABCdef...token
   ```
   Bu komut chat ID'ni bulur, `.env`'e yazar ve bir test mesajı gönderir.

`rt doctor` ile yapılandırma durumunu kontrol edebilirsin.

## 🚀 Kullanım

```bash
# JSON adımlarıyla (en yaygın)
rt run http://localhost:5173 --steps '[{"click":"Giris"},{"expect":"Panel"},{"screenshot":"ok"}]'

# Dosyadan (uzun/karmaşık JSON için önerilir — tırnak kaçış sorunu olmaz)
rt run --file .remote-tester/login-test.json

# Ham Playwright kodu (kaçış kapısı — karmaşık senaryolar)
rt run http://localhost:3000 --code test.js
```

**Seçenekler:** `--name <ad>` · `--browser chromium|firefox|webkit` · `--headed` · `--no-telegram` · `--no-video`

### Örnek senaryo

```bash
rt run http://localhost:5173 --steps '[
  {"screenshot":"acilis"},
  {"click":"Giris Yap"},
  {"fill":"#email","value":"test@example.com"},
  {"fill":"#password","value":"sifre123","secret":true},
  {"click":"Gonder"},
  {"waitForUrl":"**/dashboard"},
  {"expect":"Hosgeldin"},
  {"screenshot":"panel"}
]'
```

## 🧩 Claude'un otomatik kullanması için

İki yol var:

**1. Skill (önerilen, tüm projelerde geçerli):**
`skills/remote-tester/SKILL.md` dosyasını `~/.claude/skills/remote-tester/` altına kopyala. Artık
herhangi bir projede Claude'a *"şunu test et ve görselini at"* dediğinde skill otomatik devreye girer.

**2. Proje bazlı:**
Bir proje dizininde:
```bash
rt init
```
O projenin `CLAUDE.md`'sine kullanım notu ekler ve `.remote-tester/ornek-test.json` oluşturur.

## 📋 JSON DSL — tüm adımlar

| Adım | Açıklama |
|------|----------|
| `{"goto":"/path"}` | sayfaya git |
| `{"click":"Metin"}` / `{"click":true,"selector":"#x"}` | tıkla (buton/link/metin akıllı + kısmi eşleşir) |
| `{"fill":"#sel","value":"x","secret":true}` | input doldur (`secret` → loglarda maskelenir) |
| `{"type":"#sel","value":"..."}` | karakter karakter yaz |
| `{"press":"Enter"}` | klavye tuşu |
| `{"select":"#sel","value":"opt"}` | dropdown |
| `{"check":"#sel"}` / `{"uncheck":"#sel"}` | checkbox |
| `{"hover":"#sel"}` | üzerine gel |
| `{"wait":1000}` / `{"wait":"#sel","state":"visible"}` | bekle |
| `{"waitForUrl":"**/panel"}` | url değişimini bekle |
| `{"scroll":"bottom"}` / `{"scroll":"top"}` / `{"scroll":"#sel"}` | kaydır |
| `{"screenshot":"ad","fullPage":true}` | ekran görüntüsü |
| `{"expect":"metin"}` | metnin görünür olduğunu doğrula |
| `{"expect":{"visible":"#sel"}}` / `{"hidden":...}` / `{"url":...}` / `{"text":..,"in":..}` / `{"title":..}` | doğrulamalar |

**Locator alternatifleri** (`click`/`fill` için): `selector` (CSS), `role`+`name`, `text`,
`placeholder`, `label`, `testId`.

## 📂 Çıktı

Her çalışma `runs/<ad>/` altına yazılır:

```
runs/<ad>/
├── screenshots/        # her adımın PNG'si (başlangıç + bitiş otomatik)
├── video/*.mp4         # testin video kaydı (ffmpeg ile; yoksa .webm)
├── trace.zip           # Playwright trace viewer ile açılır
└── rapor.html          # screenshot'lar gömülü, tek dosya — taşınabilir rapor
```

## 🛠️ Sorun giderme

| Sorun | Çözüm |
|-------|-------|
| Telegram'a gitmedi | `rt doctor` çalıştır; eksikse `rt setup-telegram <token>` |
| `Unterminated string in JSON` (PowerShell) | `--steps` yerine `--file` kullan |
| Element bulunamadı | metin yerine CSS `selector` dene ya da önce `{"wait":"#sel"}` ekle |
| Video oynamıyor | ffmpeg kur (mp4 dönüşümü için) |
| `rt` komutu bulunamadı | yeni bir terminal aç (`npm link` PATH'i yeniler) |

## 🔒 Güvenlik

Telegram token'ın ve chat ID'n **yalnızca `.env`** dosyasında tutulur ve `.gitignore` ile korunur —
repoya hiçbir zaman gitmez. `.env.example` dosyasını kopyalayıp kendi değerlerini gir (ya da
`rt setup-telegram` kullan).

## 📄 Lisans

MIT
