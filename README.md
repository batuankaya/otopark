# Otopark Yönetim Sistemi

Eskişehir'deki açık otopark için **personel-içi** web uygulaması. Görevliler sahada telefon veya
tabletle araç giriş-çıkışı kaydeder, sistem ücreti hesaplar, gün sonunda kasa sayımı ve rapor alınır.
Müşteriye açık bir arayüz yoktur.

---

## İçindekiler

- [Hızlı kurulum](#hızlı-kurulum)
- [Ortam değişkenleri](#ortam-değişkenleri)
- [Veritabanı seçenekleri](#veritabanı-seçenekleri)
- [Giriş bilgileri](#giriş-bilgileri)
- [Komutlar](#komutlar)
- [İş kuralları](#iş-kuralları)
- [Roller ve yetkiler](#roller-ve-yetkiler)
- [Proje yapısı](#proje-yapısı)
- [Mimari kararlar](#mimari-kararlar)
- [KVKK](#kvkk)
- [Bilinmesi gerekenler](#bilinmesi-gerekenler)

---

## Hızlı kurulum

Gereksinimler: **Node.js 20+**, **PostgreSQL 16** (ya da Docker).

```bash
# 1) Bağımlılıklar
npm install

# 2) Ortam değişkenleri
cp .env.example .env
npx auth secret          # AUTH_SECRET üretir (veya: openssl rand -base64 32)

# 3) Veritabanı (Docker ile — en kolayı)
docker compose up -d

# 4) Şema + örnek veri
npm run kurulum          # prisma generate + migrate deploy + seed

# 5) Çalıştır
npm run dev
```

Tarayıcıda <http://localhost:3000> → `admin@otopark.local` / `Otopark2026Admin`

---

## Ortam değişkenleri

`.env.example` dosyasını `.env` olarak kopyalayıp doldurun.

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL bağlantı adresi |
| `AUTH_SECRET` | ✅ | Oturum çerezini şifreler. `npx auth secret` ile üretin |
| `AUTH_URL` | — | Uygulamanın adresi (üretimde gerçek alan adı) |
| `AUTH_TRUST_HOST` | — | Ters proxy arkasında `true` olmalı |
| `TZ` | — | `Europe/Istanbul` |
| `SEED_ADMIN_SIFRE` | — | Seed'in oluşturacağı yönetici şifresi |
| `SEED_GOREVLI_SIFRE` | — | Seed'in oluşturacağı görevli şifresi |

> **Üretimde:** `AUTH_SECRET`'i mutlaka değiştirin ve seed hesaplarının şifrelerini
> Ayarlar → Kullanıcılar bölümünden güncelleyin.

---

## Veritabanı seçenekleri

### A) Docker (önerilen — makineyi kirletmez)

```bash
docker compose up -d
```

Postgres 16 container'da **5433** portunda çalışır. `.env` içinde:

```
DATABASE_URL="postgresql://otopark:otopark@localhost:5433/otopark_dev?schema=public"
```

### B) Lokal PostgreSQL

```bash
createdb otopark_dev
```

`.env` içinde (kullanıcı adı/şifreyi kendinize göre düzenleyin):

```
DATABASE_URL="postgresql://postgres:SIFRE@localhost:5432/otopark_dev?schema=public"
```

---

## Giriş bilgileri

Seed iki hesap oluşturur:

| Rol | E-posta | Şifre |
|---|---|---|
| ADMIN | `admin@otopark.local` | `Otopark2026Admin` |
| GOREVLI | `gorevli@otopark.local` | `Otopark2026Gorevli` |

> ⚠️ **Bu şifreler herkese açık olarak belgelenmiştir.** Kurulumdan hemen sonra
> **Ayarlar → Kullanıcılar**'dan değiştirin. Sistemi yerel ağ dışına açacaksanız
> değiştirmeden açmayın — bu depoyu okuyan herkes varsayılanları bilir.

Seed ayrıca 1 tarife, 6 kapanmış vardiya ve **30 örnek park kaydı**
(22 çıkmış, 6 içeride, 2 iptal) üretir.

---

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` / `npm start` | Üretim derlemesi / sunucu |
| `npm test` | Tüm testler (birim + entegrasyon) |
| `npm run test:birim` | Yalnızca birim testleri — veritabanı gerekmez |
| `npm run test:entegrasyon` | Yalnızca entegrasyon testleri — PostgreSQL gerekir |
| `npm run test:izle` | Testleri izleme modunda çalıştırır |
| `npm run kurulum` | generate + migrate deploy + seed |
| `npm run db:migrate` | Yeni migration oluşturur |
| `npm run db:reset` | Veritabanını sıfırlar ve seed'i çalıştırır |
| `npm run db:studio` | Prisma Studio (veri görüntüleyici) |
| `npm run lint` | ESLint |

---

## Testler

İki küme var (`vitest.config.ts` içinde `projects` olarak tanımlı):

**Birim** (`tests/*.test.ts`) — saf iş kuralları: ücret motoru, plaka doğrulama,
tarih/vardiya günü hesapları, para ayrıştırma, zod şemaları, Türkçe sıralama.
Dış bağımlılık yok.

> Bu küme **bilerek `TZ=America/Los_Angeles`** ile koşar. Uygulama her yerde
> `Europe/Istanbul`'u açıkça belirtiyor; bu doğruysa sunucunun saat dilimi hiçbir
> sonucu değiştirmemeli. Yerel saate sızan bir bağımlılık olursa testler kırılır.

**Entegrasyon** (`tests/entegrasyon/*.test.ts`) — Server Action'ları **gerçek
PostgreSQL** üzerinde uçtan uca çalıştırır. Transaction'lar, kısmi unique
index'ler (mükerrer giriş / tek açık vardiya) ve `Decimal` aritmetiği taklit
edilemez; kasa devrinin doğruluğu ancak burada kanıtlanabilir.

- Ayrı bir veritabanı kullanır: **`otopark_test`**. Adres `.env` içindeki
  `DATABASE_URL`'den türetilir, yalnızca veritabanı adı değişir — şifre
  sürüm kontrolüne girmez.
- Veritabanı yoksa ilk çalıştırmada kendisi oluşturulur ve migrasyonlar uygulanır.
  Ek kurulum adımı yok, `npm test` yeterli.
- **Güvenlik kilidi:** testler her dosyada tüm tabloları boşalttığı için,
  hedef veritabanının adı `otopark_test` değilse çalışmayı reddeder
  (`tests/entegrasyon/veritabani.ts`). Geliştirme verisine yazmak imkânsızdır.

---

## İş kuralları

### Plaka

**Türk plakası**

Kalıp: **il kodu (01–81) + 1–3 harf + 2–5 rakam**

| Kalıp | Örnek |
|---|---|
| 1 harf + 4 rakam | `34 A 1234` |
| 1 harf + 5 rakam | `34 A 12345` |
| 2 harf + 3 rakam | `34 AB 123` |
| 2 harf + 4 rakam | `34 AB 1234` |
| 3 harf + 2 rakam | `34 ABC 12` |
| 3 harf + 3 rakam | `34 ABC 123` |

- **Q, W, X** reddedilir (Türk plakalarında kullanılmaz — yazım hatasını da yakalar)
- İl kodu **01–81** dışındaysa reddedilir
- Veritabanında boşluksuz ve büyük harf (`34ABC123`), ekranda boşluklu (`34 ABC 123`)
- Arama kısmi eşleşme yapar: **son 3 hane** ile de araç bulunur

> Kalıp sınırları `src/lib/plaka.ts` içindeki `EN_AZ_HARF` / `EN_COK_HARF` /
> `EN_AZ_RAKAM` / `EN_COK_RAKAM` sabitleriyle tek yerden ayarlanır. Kalıba uymayan
> bir plakayla karşılaşırsanız **Yabancı plaka** kutusu her zaman kaçış yoludur.

**Yabancı plaka**

Otoparka Bulgar, Gürcü, Alman, İran vb. plakalı araçlar da geliyor. Bu plakalar Türk
kalıbına uymadığı için ayrı bir yol izlenir:

- Araç girişinde **"Yabancı plaka"** kutusu işaretlenir; Türk kalıbı ve Q-W-X yasağı
  uygulanmaz, yalnızca makul uzunluk aranır
- Görevli kutuyu işaretlemeyi unutup Türk kalıbına uymayan bir plaka yazarsa, ekran
  **"Yabancı plaka olarak kaydet"** düğmesi gösterir — araç kaydedilemeden kalmaz
- İsteğe bağlı **ülke** seçilir (BG, DE, GE, IR…); plaka rozetinde ülke kodu ve
  turuncu şerit görünür, Türk plakalarında mavi "TR" şeridi kalır
- Saklama yine boşluksuz (`CB1234AK`) — böylece `M-AB 1234` ile `MAB1234` **aynı araç**
  sayılır ve mükerrer kayıt oluşmaz. Görevlinin yazdığı okunabilir hâl (`CB 1234 AK`)
  ayrıca saklanır ve fişte/listelerde o gösterilir
- Kısmi arama yabancı plakalarda da aynı şekilde çalışır

### Ücretlendirme (`src/lib/ucret.ts`)

**İlk saat ücreti + sonraki her saat için artan ücret.** Üst sınır yoktur.

```
1. Süre = yukarı yuvarlanmış dakika
2. Süre ≤ ilkÜcretsizDakika        → 0 TL
3. Ücretli dakika = süre − ücretsiz süre
4. Saat = ⌈ücretli dakika / 60⌉    (en az 1)
5. Ücret = ilkSaatÜcreti + (saat − 1) × saatlikÜcret
```

Varsayılan tarife: **ilk saat 100 TL, sonraki her saat +50 TL**, ilk 15 dk ücretsiz.

| Süre | Ücret |
|---|---|
| 15 dk | 0 TL (ücretsiz süre) |
| 1 saat | 100 TL |
| 2 saat | 150 TL |
| 3 saat | 200 TL |
| 5 saat | 300 TL |
| 24 saat | 1.250 TL |

- Başlayan her saat **tam saat** sayılır — 1 sa 1 dk kalan araç 2 saat öder
- İlk saat tamamlanmasa bile tam alınır (ücretsiz süre aşıldıysa)
- İskonto/ücret düzeltmesi **yalnızca sebep girilerek** yapılır ve işlem günlüğüne yazılır

**İsteğe bağlı günlük tavan.** Ayarlar'daki "Günlük tavan ücreti" **0** olduğu sürece
üst sınır uygulanmaz. İleride bir gün için tavan koymak isterseniz oraya tutar yazmanız
yeterli — kod değişikliği gerekmez.

Kuralların tamamı `tests/ucret.test.ts` içinde test edilir.

### Plaka arama

Menüdeki **Ara** sekmesinden ya da araç çıkışı ekranından kullanılır.

- `26` → il koduyla başlayanlar, `159` → son haneler, `26ABC` → harf grubu
- Sıralama: önce **içeridekiler**, sonra **terimle başlayanlar**, sonra en yeni.
  Böylece "26" yazınca 26 ile başlayan plakalar üste gelir ama son-hane araması da bozulmaz
- İçerideki araca dokununca doğrudan çıkış ekranına gider; geçmiş kayıtlarda fişe ulaşılır

**Araç çıkışı ekranı** açılır açılmaz içerideki araçları listeler (en uzun süredir içeride
olan üstte) — görevli hiç yazmadan aracı seçebilir.

### Giriş / çıkış

- Aynı plaka **aynı anda iki kez içeride olamaz** — deneme uyarı verir ve mevcut kaydı gösterir
- Kayıtlar **silinmez**, iptal edilir (soft delete) ve **sebep zorunludur** (yalnızca ADMIN)
- Otopark doluysa yeni giriş engellenir

### Abonman

Otopark aylık abonman **kullanmıyor**; ilgili ekranlar kapalıdır ve alt menüde görünmez.
Veri modeli (`Abonman` tablosu) ve iş kuralları yerinde bırakıldı: abonmanlı bir kayıt
varsa giriş/çıkış akışı onu hâlâ tanır ve 0 TL uygular.

Yeniden açmak için `src/app/(app)/_abonman-kapali/page.tsx` dosyasının başındaki
adımları izleyin (klasörü `abonman` olarak yeniden adlandırmak + menüye bağlantı eklemek).

### Vardiya — ortak kasa

Vardiya kullanıcı başına değil, **otopark genelinde tektir**.

- Bir görevli vardiyayı açtığında diğerlerinin ayrıca açmasına **gerek yoktur**; hepsi aynı
  kasaya işlem yapar
- Sistemde aynı anda yalnızca **bir** açık vardiya olabilir — veritabanı kısıtıyla garanti
  altında (`vardiya_tek_acik_uq`), iki görevli aynı anda açmaya çalışsa biri reddedilir
- Vardiyayı **kim açtıysa açsın, kim kapatırsa kapatsın** — açan görevli izinde olabilir.
  Açan ve kapatan ayrı ayrı kayda geçer (`kullaniciId` / `kapatanId`)
- **Açık vardiya olmadan araç giriş/çıkışı yapılamaz** — tahsil edilen para bir kasaya yazılmak zorunda
- Tahsilat, **çıkışın yapıldığı** vardiyaya yazılır (araç bir vardiyada girip başka vardiyada çıkabilir)
- Kapanışta: `fark = sayılanKasa − (açılışKasa + nakitTahsilat)` — anında hesaplanır ve gösterilir

> Not: Ortak kasa modelinde kasa açığının hangi görevliden kaynaklandığı ayrıştırılamaz.
> Kişi bazlı sorumluluk isterseniz her görevliye ayrı vardiya modeline dönmek gerekir.

#### Günlük otomatik sıfırlama

Vardiya her gün **00:00'da** (Ayarlar → *Vardiya sıfırlama saati*, 0–23) kendiliğinden
sıfırlanır:

- Açık vardiya o saatte kapanır, yerine yenisi açılır — görevlinin bir şey yapması gerekmez
- **Kasa devreder**: yeni vardiyanın açılış kasası, kapanan vardiyanın "kasada olması
  gereken" tutarıdır. Para fiziksel olarak kasada kalır, yalnızca defter yeni sayfaya geçer
- Otomatik kapanışta **kasa sayılmaz**: `kapanisKasa` ve `fark` boş kalır, uydurma bir kasa
  açığı raporlanmaz. Bu vardiyalar listede `OTOMATİK · kasa sayılmadı` rozetiyle görünür
- Görevli isterse günün herhangi bir anında vardiyayı elle de kapatabilir; sıfırlama saati
  yalnızca *unutulduğunda* devreye giren güvenlik ağıdır
- Vardiya ekranında bir sonraki sıfırlamanın ne zaman olacağı yazar

> **Sıfırlama saati çalışma saatlerinin DIŞINDA olmalı.** Otopark 08:00–20:30 açık;
> saat örneğin 12:00 yapılırsa vardiya iş gününün ortasında kapanıp yeniden açılır ve
> tek bir gün iki ayrı kasa defterine bölünür. Kasa devri yine doğru çalışır ama gün
> sonu mutabakatı iki parçadan toplanmak zorunda kalır. Varsayılan bu yüzden 00:00.

Sıfırlama **zamanlanmış görevle (cron) yapılmaz** — makine kapalıyken çalışmayan bir cron
sıfırlamayı sessizce atlar. Bunun yerine açık vardiya her sorgulandığında sınırın geçip
geçmediğine bakılır; uygulama üç gün kapalı kalsa bile ilk açılışta eski vardiya
*geçmişteki doğru saatte* kapatılmış olur (`src/lib/vardiya-sifirlama.ts`).

### Geriye dönük giriş

Görevli aracı kaydetmeyi unutursa giriş saatini elle girebilir:

- Araç girişi ekranında **"Giriş saati"** bölümü — yalnızca **saat** sorulur (`15:25`),
  tarih sorulmaz. Görevli `1525` yazar, alan `15:25` yapar (mobilde sayısal klavye)
- **Yalnızca aynı gün** geçerlidir; ileri bir saat reddedilir
- Boş bırakılırsa şu anki saat kullanılır
- Ücreti doğrudan etkilediği için işlem günlüğüne *"geriye dönük kayıt"* olarak yazılır

---

## Roller ve yetkiler

| | GOREVLI | ADMIN |
|---|:---:|:---:|
| Araç giriş / çıkış | ✅ | ✅ |
| Plaka arama, içerideki araçlar | ✅ | ✅ |
| Kendi vardiyası ve raporu | ✅ | ✅ |
| Tüm vardiya raporları | — | ✅ |
| Kayıt iptali | — | ✅ |
| Raporlar, CSV dışa aktarma | — | ✅ |
| Tarife, kapasite, kullanıcılar | — | ✅ |

---

## Proje yapısı

```
prisma/
  schema.prisma            Veri modeli
  migrations/              İlk kurulum + kısmi unique index'ler
  seed.ts                  Örnek veri
  seed-config.ts           ⚠️ TARİFE / KAPASİTE DEĞERLERİ BURADA
src/
  app/
    (auth)/giris/          Giriş ekranı
    (app)/                 Oturum gerektiren tüm sayfalar
      page.tsx             Ana pano
      arac-girisi/  arac-cikisi/  icerideki-araclar/
      ara/  vardiya/  raporlar/  ayarlar/
      _abonman-kapali/     "_" ile başlar → rota değil, kod arşivde duruyor
    fis/[id]/              58 mm termal yazıcı fişi
    api/
      auth/[...nextauth]/  Auth.js
      plaka-ara/           Kısmi plaka araması
      arac-bilgi/          Girişte araç bilgisi otomatik doldurma
      rapor/csv/           CSV dışa aktarma (loglu)
  actions/                 Server Action'lar (park, abonman, vardiya, ayarlar, kimlik)
  components/              Arayüz bileşenleri
  lib/
    plaka.ts               ✅ testli — doğrulama, normalize, maske
    ucret.ts               ✅ testli — ücret motoru (saf fonksiyon)
    tarih.ts               Europe/Istanbul yardımcıları
    para.ts  siralama.ts   TRY biçimi, localeCompare('tr')
    auth.ts  auth.config.ts  yetki.ts   Kimlik ve yetki
    prisma.ts  sorgular.ts  raporlar.ts  gunluk.ts  validasyon.ts
  middleware.ts            Rota koruması
tests/                     plaka.test.ts · ucret.test.ts
```

---

## Mimari kararlar

**Ücret motoru saf fonksiyondur.** `hesaplaUcret` veritabanına, tarihe veya oturuma bakmaz;
girdi alır, sonuç döner. Bu sayede tüm uç durumlar (tam 24 saat, tavan aşımı, abonman) veritabanı
olmadan test edilebiliyor.

**Eşzamanlılık veritabanı seviyesinde çözüldü.** İki görevli aynı anda işlem yapabilsin diye:

```sql
CREATE UNIQUE INDEX parkkaydi_plaka_iceride_uq ON "ParkKaydi"("plaka") WHERE "durum" = 'ICERIDE';
CREATE UNIQUE INDEX vardiya_kullanici_acik_uq  ON "Vardiya"("kullaniciId") WHERE "bitis" IS NULL;
```

Uygulama katmanı önce kontrol edip anlaşılır bir mesaj gösterir; yarış durumunda Prisma'nın `P2002`
hatası yakalanıp aynı mesaja çevrilir. Çıkış işlemi de `updateMany({ where: { id, durum: 'ICERIDE' }})`
ile koşullu yapılır — aynı araç iki kez çıkarılamaz.

**Tarife sürümlenir, güncellenmez.** Tarife değiştiğinde eski kayıt pasifleşir, yenisi oluşturulur.
Her `ParkKaydi` kendi `tarifeId`'sini saklar; geçmiş kayıtların ücreti sonradan değişmez.

**Zaman dilimi.** Veritabanı UTC saklar, arayüz her zaman Europe/Istanbul gösterir. Rapor gün
sınırları da İstanbul saatine göre hesaplanır (`src/lib/tarih.ts` → `gunBaslangici`), böylece
"bugünün cirosu" sunucunun saat dilimine göre kaymaz.

**Para `Decimal(10,2)`.** Kayan nokta yuvarlama hatası olmasın diye; hesaplama katmanına
girerken `number`a çevrilir, dönerken `Decimal`e.

**Karanlık tema bilerek kapalı.** Açık havada güneş altında okunabilirlik için koyu metin /
açık zemin sabitlendi.

**Saatler her yerde 24 saat biçiminde.** `<input type="time">` kullanılmıyor: tarayıcı saat
seçicisini sayfanın değil kendi dil ayarının biçimine göre çizdiği için işletim sistemi
İngilizce olduğunda AM/PM çıkıyordu. Yerine `SaatInput` bileşeni var. Tüm `Intl` biçimleyicileri
de `hour12: false` ile sabitlendi.

---

## Güvenlik

| Önlem | Durum |
|---|---|
| SQL injection | Prisma ORM — tek ham SQL sorgusu yok, tüm sorgular parametreli |
| Girdi doğrulama | Zod — doğrulamasız tek form işleyicisi yok |
| Şifre saklama | bcrypt, cost 12 |
| **Brute force** | Hesap 8 / IP 20 başarısız denemede 15 dk kilit |
| XSS | React kaçışı + `Content-Security-Policy` |
| Clickjacking | `X-Frame-Options: DENY` + `frame-ancestors 'none'` |
| CSRF | Next.js Server Actions'ta yerleşik + `sameSite=lax` çerez |
| Oturum hırsızlığı | `httpOnly` çerez, üretimde `__Secure-` öneki |
| Yetki atlatma | Middleware + sayfa bazlı çift kontrol, her istekte DB doğrulaması |
| **Veritabanı erişimi** | Postgres yalnızca `127.0.0.1`'e bağlı, şifre `.env`'den |
| **Şifre politikası** | En az 10 karakter + harf + rakam, yaygın şifreler reddedilir |
| **Şifre değişimi** | Şifre değişince o kullanıcının açık oturumları anında düşer |

**Brute force koruması** `src/lib/giris-koruma.ts` içinde. Kritik ayrıntı: kontrol
`authorize` callback'inde yapılır, Server Action'da değil — `/api/auth/callback/credentials`
uç noktasına doğrudan istek atılarak Server Action atlanabiliyor. Geliştirme sırasında bu
atlatma test edildi ve düzeltildi.

Kilit **son denemeden** itibaren sayılır (saldırgan bekleyip devam edemez) ama zaman
aşımına uğrar — sahadaki görevli kendini kalıcı olarak sistem dışında bırakmasın diye.

**Pasifleştirilen kullanıcı anında düşer:** oturum her istekte veritabanından doğrulanır,
JWT'ye güvenilmez. Rol değişikliği ve şifre değişimi de anında yürürlüğe girer —
JWT'de oturum açılış zamanı tutulur, `sifreDegisimi` damgasından eskiyse oturum geçersiz.

**Veritabanı ağa kapalı.** `docker-compose.yml` portu `127.0.0.1:5433`'e bağlar. Bu
kritik: `"5433:5432"` yazılırsa Docker `0.0.0.0`'a bağlar ve aynı WiFi/hotspot'taki
herkes veritabanına doğrudan bağlanıp tüm plakaları okuyabilir — uygulamanın tüm
güvenlik önlemleri atlanmış olur. Şifre de `.env` dosyasından okunur, kodda sabit değil.

**Şifre politikası** karmaşık simge istemez, uzunluk ister (10+ karakter, harf + rakam).
Simge zorunluluğu sahada tablet klavyesiyle çalışan görevliyi zorlar ve şifreyi bir yere
yazmaya iter — uzunluk daha etkili bir koruma.

### Üretime almadan önce

1. `NODE_ENV=production` (`npm run build && npm start`) — güvenli çerezleri,
   HSTS'i ve sıkı CSP'yi devreye alır
2. **HTTPS kurun.** Üretim modunda oturum çerezi `Secure` bayrağı taşır; HTTPS
   yoksa tarayıcıdan giriş yapılamaz. Uygulama başlangıçta uyarı verir
3. `AUTH_SECRET`'i yeniden üretin: `npx auth secret`
4. Seed hesaplarının şifrelerini değiştirin (varsayılanlar bu depoda yazılı)
5. Günlük yedeklemeyi otomatikleştirin (aşağıya bakın)

## Personel geliş saatleri (mesai)

Çalışan uygulamaya giriş yaptığında geliş saati **otomatik** kaydedilir. Ayrı bir
"işe geldim" düğmesi bilerek yok: basılması gereken düğme unutulur ve o gün hiç kayıt
oluşmaz — görevli zaten çalışmak için giriş yapmak zorunda.

- Günde kişi başına **tek kayıt**: günün ilk teması esas alınır, sonrakiler saati
  değiştirmez (`(kullaniciId, gun)` benzersiz)
- Kayıt yalnızca giriş anında değil, **her kimlik doğrulamasında** denenir. Oturum
  12 saatlik ve her istekte tazelendiği için, çıkış yapmadan çalışmaya devam eden
  biri ikinci gün hiç giriş yapmaz — yalnızca girişe bağlanırsa o günün kaydı hiç
  oluşmazdı. Gereksiz yazım işlem belleğindeki bir kümeyle engellenir
- **Raporlar** ekranında görünür, geliş sırasına göre numaralı (1., 2., …)
- **Gelmeyenler** de listelenir — "kim gelmedi" sorusu "kim geldi"den daha kritik
- Yönetici saati **düzeltebilir**: çalışan 10:00'da gelip 10:15'te giriş yapmış
  olabilir. Düzeltmede orijinal otomatik kayıt saklanır ve işlem günlüğüne yazılır
- **Yalnızca ADMIN görür** — mesai özlük bilgisidir (KVKK)

Gün sınırı **Europe/Istanbul gece yarısı**: 00:00'da yeni güne geçilir, geçmiş günlerin
kayıtları veritabanında kalır (ekranda yalnızca bugün gösterilir).

Vardiyadan ayrıdır: vardiya otoparkın ortak kasasıdır ve tek kişi açar; mesai
kişiye özeldir ve her çalışan için tutulur.

> Şu an yalnızca **geliş** saati tutuluyor. Çıkış/çalışma süresi gerekirse
> `PersonelGiris` modeline `cikisZamani` eklenerek genişletilebilir.

## Yedekleme

Kapsam bilerek küçük: **günde bir dosya, son 7 gün.** Uzun geçmiş arşivi hedeflenmiyor —
amaç gün içinde kazara veri kaybında (yanlış komut, disk hatası, konteynerin silinmesi)
o günün vardiya ve park kayıtlarını kurtarabilmek.

```bash
npm run yedek            # yedek al
npm run yedek:listele    # mevcut yedekleri gör
```

Yedekler `yedekler/` klasörüne yazılır ve **git'e girmez** — plaka ve telefon kişisel
veridir (KVKK).

### Geri yükleme

```bash
# DİKKAT: mevcut veriyi siler.
docker exec -i otopark-db psql -U otopark -d otopark_dev < yedekler/otopark_TARIH.sql
```

Yedek dosyası `--clean --if-exists` ile alındığı için mevcut tabloları önce temizler,
hata vermez.

> **Yedeklemeyi test edin.** Geri yüklenemeyen yedek, yedek değildir. Gerçek veriye
> dokunmadan denemek için geçici bir veritabanı kullanın:
> ```bash
> docker exec otopark-db psql -U otopark -d postgres -c "CREATE DATABASE yedek_testi;"
> docker exec -i otopark-db psql -U otopark -d yedek_testi < yedekler/DOSYA.sql
> docker exec otopark-db psql -U otopark -d yedek_testi -c 'SELECT count(*) FROM "ParkKaydi";'
> docker exec otopark-db psql -U otopark -d postgres -c "DROP DATABASE yedek_testi;"
> ```

### Otomatikleştirme (macOS)

Her gün 23:30'da yedek almak için:

```bash
crontab -e
```

Şu satırı ekleyin (yolu kendi kurulumunuza göre düzeltin):

```
30 23 * * * cd /Users/KULLANICI/otopark && /bin/bash scripts/yedekle.sh >> yedekler/yedek.log 2>&1
```

Bilgisayar o saatte kapalıysa cron çalışmaz. Sürekli açık değilse gün sonunda
`npm run yedek` çalıştırmayı vardiya kapatma alışkanlığına ekleyin.

## KVKK

- Plaka ve müşteri telefonu **kişisel veridir**; tüm rotalar (fiş sayfası dahil) oturum ister
- Şifreler **bcrypt (cost 12)** ile saklanır; hiçbir sorgu, log veya yanıt şifre hash'i döndürmez
- **Her CSV dışa aktarma** işlem günlüğüne yazılır: kim, ne zaman, hangi aralık, kaç satır
- İptal, ücret düzeltmesi, tarife/kullanıcı/abonman değişiklikleri eski–yeni değerleriyle loglanır
- Başarısız giriş denemeleri ve mükerrer giriş denemeleri de kayıt altına alınır

---

## Bilinmesi gerekenler

**Tarife ve kapasite `prisma/seed-config.ts` dosyasından geliyor:** kapasite 150,
ilk 15 dk ücretsiz, ilk saat 100 TL, sonraki her saat +50 TL, günlük tavan 0 (sınırsız).
Değiştirmek için **Ayarlar** ekranını kullanın ya da bu dosyayı düzenleyip
`npm run db:reset` çalıştırın.

**Park alanı (blok) kullanılmıyor.** Otopark tek alan olarak işletiliyor; giriş ekranında
blok seçimi, listelerde blok filtresi ve Ayarlar'da blok yönetimi yok. `ParkAlani` tablosu
şemada duruyor — ileride bloklara ayırmak isterseniz temel hazır.

**Fiş yazdırma.** `/fis/[id]` sayfası 58 mm genişliğe ayarlıdır (`globals.css` → `@media print`).
Termal yazıcıda kağıt boyutunu 58 mm seçin ve tarayıcının kenar boşluklarını "yok" yapın.

**Çevrimdışı davranışı.** Bağlantı koptuğunda üstte kırmızı uyarı çıkar ve araç girişi formundaki
veriler `localStorage`'a yazılır; bağlantı gelince kaldığınız yerden devam edilir. Kayıt işlemi
sunucuya gitmek zorunda olduğu için çevrimdışı **kayıt oluşturulamaz** — uyarı bunun içindir.

**Fiş numarası** global artan bir seridir (günlük sıfırlanmaz).
