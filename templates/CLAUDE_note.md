## Manuel UI Testi (Remote Tester / `rt`)

Kullanici "test et", "su sayfayi test et ve gorselini at", "manuel test yap", "ekran goruntusu al"
gibi bir sey istediginde, manuel testi SEN yapacaksin. Kullanici muhtemelen bilgisayar basinda
degil (telefondan baglaniyor), bu yuzden ona arayuzu gormesi icin gorsel/video gondermelisin.

Bunun icin global `rt` komutunu kullan. Her dizinden calisir.

### Nasil calistirilir

```bash
rt run <URL> --steps '<json-adim-dizisi>'
```

Sonuc otomatik olarak kullanicinin Telegram'ina gider (screenshot albumu + video + HTML rapor).
Komut bittiginde yerel rapor yolunu da yazar.

### JSON DSL adimlari

- `{"goto":"/path"}` — sayfaya git
- `{"click":"Buton Metni"}` veya `{"click":true,"selector":"#id"}`
- `{"fill":"#selector","value":"deger"}` — sifre icin `"secret":true` ekle (loglarda maskelenir)
- `{"type":"#sel","value":"yavas yazi"}`
- `{"press":"Enter"}`
- `{"select":"#sel","value":"opt"}`, `{"check":"#sel"}`, `{"uncheck":"#sel"}`, `{"hover":"#sel"}`
- `{"wait":1000}` (ms) veya `{"wait":"#sel","state":"visible"}`
- `{"waitForUrl":"**/panel"}`
- `{"scroll":"bottom"}` / `{"scroll":"top"}` / `{"scroll":"#sel"}`
- `{"screenshot":"aciklayici-ad"}` — `"fullPage":true` opsiyonel
- `{"expect":"gorunmesi gereken metin"}` — basit metin dogrulama
- `{"expect":{"visible":"#sel"}}` / `{"hidden":"#sel"}` / `{"url":"**/x"}` / `{"text":"..","in":"#sel"}` / `{"title":".."}`

### Onemli kurallar

1. **Bol bol screenshot al.** Kullanici sonuclari gozle gorecek; her onemli adimdan sonra
   `{"screenshot":"..."}` ekle. Baslangic ve bitis otomatik alinir.
2. **expect ile dogrula.** Sadece tiklama yapma; "sunun gorunmesi lazim" diye dogrulama ekle ki
   test gercekten gecti mi belli olsun.
3. **Yerel gelistirme URL'sini dogru ver.** Proje hangi portta calisiyorsa (orn localhost:3000,
   localhost:8000, localhost:5173) onu kullan. Emin degilsen kullaniciya sor ya da projeyi incele.
4. **Karmasik senaryolar** icin `--code <dosya.js>` ile ham Playwright kodu da gonderebilirsin;
   `page`, `context`, `ctx` ve `takeScreenshot(ad)` degiskenleri hazirdir.
5. Tekrar kullanilacak senaryolari `.remote-tester/` klasorune `.json` olarak kaydet,
   sonra `rt run <url> --file .remote-tester/senaryo.json` ile calistir.

### Ornek

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
