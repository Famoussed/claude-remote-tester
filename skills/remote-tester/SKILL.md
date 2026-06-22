---
name: remote-tester
description: Manuel UI testlerini Playwright ile otomatik yapip sonuclari (screenshot + video + HTML rapor) kullanicinin Telegram'ina gonderir. Kullanici "test et", "su sayfayi test et", "manuel test yap", "ekran goruntusu/screenshot al ve at", "arayuze bak", "login akisini dene", "calisiyor mu kontrol et ve gorselini gonder" gibi seyler istediginde KULLAN. Kullanici genelde telefondan baglaniyor ve bilgisayar basinda degil; arayuzu kendisi acip bakamadigi icin testi senin yapip gorsel/video gondermen gerekiyor. Global "rt" komutu her proje dizininden calisir.
when_to_use: Bir implementasyon/degisiklik bitince kullanici "test et ve gorselini at", "ekran goruntusu gonder", "manuel test yap", "arayuzde calisiyor mu bak", "login/odeme/form akisini dene" dediginde. Ozellikle kullanici "bilgisayarda degilim", "telefondan bakiyorum" gibi seyler soylediginde.
---

# Remote Tester (`rt`) — Kullanim Kilavuzu

Kullanici telefondan Claude'a baglaniyor ve **bilgisayar basinda degil**. Bir implementasyon
bittiginde normalde kendisi arayuzu acip manuel test ederdi; bunu yapamadigi icin **bu testi SEN
yapacaksin** ve sonucu ona **gorsel + video olarak Telegram'dan** gonderecek `rt` aracini kullanacaksin.

`rt` zaten kurulu ve **her proje dizininden** calisir. Sonuclar otomatik kullanicinin Telegram'ina
gider (screenshot albumu + mp4 video + HTML rapor).

## Altin kurallar

1. **Once projenin calistigini dogrula.** Test edilecek sayfa bir dev sunucuda ayakta olmali
   (orn `localhost:3000`, `:5173`, `:8000`). Sunucu kapaliysa once baslat ya da kullaniciya sor.
   Hangi port oldugunu bilmiyorsan projeyi incele (package.json scripts, vite/next config, .env).
2. **Bol screenshot al.** Kullanici sonuclari GOZLE gorecek. Her onemli adimdan sonra
   `{"screenshot":"aciklayici-ad"}` ekle. Baslangic ve bitis otomatik alinir.
3. **expect ile dogrula.** Sadece tiklama yapma; "su gorunmeli" diye dogrulama ekle ki testin
   gercekten gectigi belli olsun. Hata olursa rt otomatik HATA screenshot'i alir.
4. **Calistirdiktan sonra ozeti kullaniciya ilet.** rt ciktisinda BASARILI/BASARISIZ, adim sayisi
   ve hata varsa hangi adimda oldugu yazar. Bunu kullaniciya kisaca aktar — o da Telegram'dan
   gorselleri/videoyu gormus olacak.
5. **Sifre/token gibi alanlarda** `"secret":true` ekle; loglarda ve raporda maskelenir.

## Temel kullanim

JSON adimlariyla (en yaygin yol):

```bash
rt run http://localhost:5173 --steps '[{"click":"Giris"},{"expect":"Panel"},{"screenshot":"sonuc"}]'
```

> **Onemli (Windows/PowerShell):** Tirnak kacisi JSON'u bozabilir. Adimlar uzun ya da ic ice
> tirnak iceriyorsa, JSON'u bir dosyaya yaz ve `--file` ile calistir — bu daha guvenli:

```bash
rt run --file .remote-tester/login-test.json
```

Dosya formati: ya dogrudan adim dizisi `[...]`, ya da `{"url":"...","steps":[...]}`.

## Tekrar kullanilabilir senaryolar

Sik calistirilacak akislari `.remote-tester/<isim>.json` olarak kaydet, sonra `--file` ile cagir.
Boylece kullanici "login testini tekrar calistir" dediginde dosyadan hizlica calistirirsin.

## Komut secenekleri

| Secenek | Aciklama |
|---------|----------|
| `--steps '<json>'` | JSON adim dizisi (string olarak) |
| `--file <yol>` | JSON adim dosyasi (tercih edilen, kacis sorunu yok) |
| `--code <yol>` | Ham Playwright kodu — karmasik senaryolar (asagiya bak) |
| `--name <ad>` | Bu calismaya isim ver (rapor klasoru) |
| `--browser <ad>` | chromium \| firefox \| webkit (varsayilan chromium) |
| `--headed` | Tarayiciyi gorunur ac (hata ayiklama; uzak kullanimda gerekmez) |
| `--no-telegram` | Telegram'a gonderme, sadece yerel rapor uret |
| `--no-video` | Video kaydetme |

## JSON DSL — tum adimlar

| Adim | Ne yapar |
|------|----------|
| `{"goto":"/path"}` | Sayfaya git (url'ye gore cozulur) |
| `{"click":"Buton Metni"}` | Metne gore tikla (buton/link/metin akilli denenir, kismi eslesir) |
| `{"click":true,"selector":"#id"}` | CSS secici ile tikla |
| `{"fill":"#sel","value":"x"}` | Input doldur (`"secret":true` → maskelenir) |
| `{"type":"#sel","value":"..."}` | Karakter karakter yaz (yavas yazi) |
| `{"press":"Enter"}` | Klavye tusu |
| `{"select":"#sel","value":"opt"}` | Dropdown sec |
| `{"check":"#sel"}` / `{"uncheck":"#sel"}` | Checkbox |
| `{"hover":"#sel"}` | Uzerine gel |
| `{"wait":1000}` | Bekle (ms) |
| `{"wait":"#sel","state":"visible"}` | Bir elementi bekle (visible/hidden/attached) |
| `{"waitForUrl":"**/dashboard"}` | URL degisimini bekle |
| `{"scroll":"bottom"}` / `{"scroll":"top"}` / `{"scroll":"#sel"}` | Kaydir |
| `{"screenshot":"ad"}` | Ekran goruntusu (`"fullPage":true` opsiyonel) |
| `{"expect":"metin"}` | Bir metnin gorunur oldugunu dogrula |
| `{"expect":{"visible":"#sel"}}` | Element gorunur |
| `{"expect":{"hidden":"#sel"}}` | Element gizli |
| `{"expect":{"url":"**/x"}}` | URL eslesir |
| `{"expect":{"text":"..","in":"#sel"}}` | Belirli kapsamda metin |
| `{"expect":{"title":".."}}` | Sayfa basligi icerir |

## Locator ipuclari (click/fill icin alternatif hedefleme)

Sadece metin yerine sunlari da verebilirsin: `"selector"` (CSS), `"role"`+`"name"` (erisilebilir
rol), `"text"`, `"placeholder"`, `"label"`, `"testId"`. Ornek:
`{"click":true,"role":"button","name":"Kaydet"}`.

## Karmasik senaryolar — ham Playwright kodu

JSON DSL yetmezse bir `.js` dosyasina ham Playwright kodu yaz ve `--code` ile calistir.
Hazir degiskenler: `page`, `context`, `ctx`, ve `await takeScreenshot("ad")`.

```js
// ornek.js
await page.goto("http://localhost:3000");
await page.getByRole("button", { name: "Yukle" }).click();
await page.waitForSelector(".sonuc");
await takeScreenshot("yukleme-sonrasi");
```

```bash
rt run --code ornek.js --name karmasik-test
```

## Tipik akis (sen boyle dusun)

1. Kullanici "X'i test et ve gorselini at" dedi.
2. Projenin hangi portta calistigini bul; calismiyorsa baslat.
3. Test adimlarini JSON olarak kur (bol screenshot + expect). Uzunsa `.remote-tester/` altina dosya yaz.
4. `rt run <url> --file ...` (ya da `--steps`) calistir.
5. Cikti ozetini oku; BASARILI/BASARISIZ durumunu ve hata varsa hangi adimda oldugunu kullaniciya ilet.
   Kullanici gorselleri/videoyu Telegram'dan gormus olacak.

## Sorun giderme

- **Telegram'a gitmedi:** `rt doctor` ile yapilandirmayi kontrol et. Eksikse kullaniciya
  `rt setup-telegram <token>` calistirmasini soyle (kurulum bir kez yapilir).
- **Element bulunamadi:** Selector yanlis olabilir; metin yerine CSS selector dene ya da once
  `{"wait":"#sel"}` ile bekle. Sayfa gec yukluyorsa adim oncesine `{"wait":1500}` ekle.
- **PowerShell tirnak hatasi (`Unterminated string in JSON`):** `--steps` yerine `--file` kullan.
- **Video oynamiyor:** rt videoyu mp4'e cevirir (ffmpeg gerekli). ffmpeg yoksa webm document olarak
  gider; kullaniciya ffmpeg kurmasini onerebilirsin.

## Yeni projeye kurulum (opsiyonel)

Bir projeye `rt init` calistirilirsa o projenin `CLAUDE.md`'sine kisa bir not ve
`.remote-tester/ornek-test.json` eklenir. Bu skill zaten her yerden calistigi icin sart degil,
ama proje-ozel senaryolar saklamak istersen faydali.
