/**
 * Entegrasyon testleri için ortak yardımcılar.
 */

import { Prisma } from "@prisma/client";
import { vi } from "vitest";

import { prisma } from "@/lib/prisma";
import { saatGirdisiDegeri } from "@/lib/tarih";
import { sifirlamaOnbelleginiTemizle } from "@/lib/vardiya-sifirlama";

// ---------------------------------------------------------------------------
// Veritabanı
// ---------------------------------------------------------------------------

/**
 * Tüm tabloları boşaltır.
 *
 * Tablo adları şemadan değil `information_schema`dan okunur: yeni bir model
 * eklendiğinde bu dosyayı güncellemek unutulursa testler sessizce kirli
 * veriyle çalışmaya başlardı.
 */
export async function veritabaniniTemizle(): Promise<void> {
  const tablolar = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `;

  if (tablolar.length === 0) return;

  const liste = tablolar.map((t) => `"public"."${t.tablename}"`).join(", ");
  // RESTART IDENTITY: fişNo her testte 1'den başlasın.
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${liste} RESTART IDENTITY CASCADE`);

  // Sıfırlama saati ayarı işlem belleğinde önbelleklenir; tablolar boşalınca
  // önbellek eski değeri göstermeye devam eder.
  sifirlamaOnbelleginiTemizle();
}

export type TemelVeri = Awaited<ReturnType<typeof temelVeriyiKur>>;

/**
 * Otoparkın çalışması için gereken asgari veri.
 *
 * Tarife bilerek gerçek işletmeninkiyle aynı: ilk saat 100 TL, sonraki her
 * saat +50 TL, ilk 15 dakika ücretsiz, günlük tavan yok.
 */
export async function temelVeriyiKur(
  secenekler: { kapasite?: number; sifirlamaSaati?: number } = {},
) {
  const { kapasite = 100, sifirlamaSaati = 12 } = secenekler;

  /**
   * Şifre değişim anı açıkça geçmişe yazılır.
   *
   * Şema varsayılanı `now()` veritabanında üretilir ve GERÇEK saati alır —
   * sahte saat (simülasyon günü) ona göre geçmişte kalır. `lib/yetki.ts` de
   * "şifre oturum açıldıktan sonra değişmiş" deyip oturumu geçersiz sayar.
   * Kontrolün kendisi doğru; testte tarihleri hizalamak gerekiyor.
   */
  const sifreDegisimi = new Date("2020-01-01T00:00:00.000Z");

  const [yonetici, gorevli, gorevliIki] = await Promise.all([
    prisma.kullanici.create({
      data: {
        adSoyad: "Ayşe Yönetici",
        email: "yonetici@otopark.test",
        // Şifre doğrulaması testte devrede değil (auth taklit ediliyor);
        // alan zorunlu olduğu için geçerli biçimde bir hash yazılır.
        sifreHash: "$2a$12$testtesttesttesttesttesttesttesttesttesttesttesttestte",
        sifreDegisimi,
        rol: "ADMIN",
      },
    }),
    prisma.kullanici.create({
      data: {
        adSoyad: "Mehmet Görevli",
        email: "gorevli@otopark.test",
        sifreHash: "$2a$12$testtesttesttesttesttesttesttesttesttesttesttesttestte",
        sifreDegisimi,
        rol: "GOREVLI",
      },
    }),
    prisma.kullanici.create({
      data: {
        adSoyad: "Zeynep Görevli",
        email: "gorevli2@otopark.test",
        sifreHash: "$2a$12$testtesttesttesttesttesttesttesttesttesttesttesttestte",
        sifreDegisimi,
        rol: "GOREVLI",
      },
    }),
  ]);

  const tarife = await prisma.tarife.create({
    data: {
      ad: "Standart",
      ilkUcretsizDakika: 15,
      ilkSaatUcreti: new Prisma.Decimal(100),
      saatlikUcret: new Prisma.Decimal(50),
      gunlukTavanUcret: new Prisma.Decimal(0),
      aktif: true,
      // Geçmişte başlasın: `aktifTarifeyiAl` yalnızca başlamış tarifeyi alır.
      gecerlilikBaslangic: new Date("2020-01-01T00:00:00.000Z"),
    },
  });

  const [ayar, alan] = await Promise.all([
    prisma.ayar.create({
      data: {
        id: 1,
        otoparkAdi: "Test Otoparkı",
        toplamKapasite: kapasite,
        vardiyaSifirlamaSaati: sifirlamaSaati,
      },
    }),
    prisma.parkAlani.create({ data: { ad: "Zemin", kapasite: 50, sira: 1 } }),
  ]);

  return { yonetici, gorevli, gorevliIki, tarife, ayar, alan };
}

// ---------------------------------------------------------------------------
// Oturum
// ---------------------------------------------------------------------------

/**
 * Verilen kullanıcıyı "oturum açmış" yapar.
 *
 * `acilis` (oturumun açılma anı) şu an olarak verilir: `lib/yetki.ts`,
 * şifre bu andan sonra değiştiyse oturumu geçersiz sayar.
 */
export function oturumAc(kullaniciId: string): void {
  globalThis.__testOturumu = {
    user: { id: kullaniciId, acilis: Math.floor(Date.now() / 1000) },
  };
}

export function oturumKapat(): void {
  globalThis.__testOturumu = null;
}

// ---------------------------------------------------------------------------
// Zaman
// ---------------------------------------------------------------------------

/**
 * Simülasyonun geçtiği gün: 15 Temmuz 2026, Çarşamba.
 *
 * Türkiye yaz saati uygulamamıyor, UTC+3 sabit — yani İstanbul 08:00 = UTC 05:00.
 */
export const SIMULASYON_GUNU = "2026-07-15";

/**
 * "HH:MM" (İstanbul) → o anın UTC karşılığı.
 *
 * `Date.UTC` ile kurulur, metin birleştirerek DEĞİL: İstanbul 01:00 gibi
 * saatlerde UTC karşılığı bir önceki güne düşer (−2 saat) ve metin biçiminde
 * "T-2:00" gibi geçersiz bir tarih üretilirdi. `Date.UTC` negatif saati
 * doğru şekilde önceki güne taşır.
 */
export function istanbulAni(hhmm: string, gun: string = SIMULASYON_GUNU): Date {
  const [saat, dakika] = hhmm.split(":").map(Number);
  const [yil, ay, ayinGunu] = gun.split("-").map(Number);
  // Türkiye yaz saati uygulamıyor: UTC+3 sabit.
  return new Date(Date.UTC(yil, ay - 1, ayinGunu, saat - 3, dakika, 0, 0));
}

/**
 * Sistem saatini İstanbul'da verilen saate sabitler.
 *
 * YALNIZCA `Date` taklit edilir (`toFake: ["Date"]`). setTimeout/setInterval
 * gerçek kalmak zorunda: Prisma'nın ağ katmanı bunlara dayanıyor, taklit
 * edilirse veritabanı çağrıları asla tamamlanmaz.
 */
export function saatiAyarla(hhmm: string, gun: string = SIMULASYON_GUNU): Date {
  const an = istanbulAni(hhmm, gun);
  vi.setSystemTime(an);
  return an;
}

/**
 * Sahte saatin İstanbul'daki "HH:MM" karşılığı.
 *
 * Araç girişlerinde `girisSaati` alanına verilir. Sebebi önemli:
 * `ParkKaydi.girisZamani` şemada `@default(now())` ve bu varsayılan
 * VERİTABANI tarafından üretiliyor (`DEFAULT CURRENT_TIMESTAMP`) — yani
 * sahte saati değil sunucunun gerçek saatini yazar. Saati açıkça geçmek
 * hem bunu çözer hem de uygulamanın "geriye dönük giriş" yolunu sınar.
 */
export function suankiSaat(): string {
  return saatGirdisiDegeri(new Date());
}

/**
 * Vardiyanın başlangıç anını simülasyon saatine çeker.
 *
 * `Vardiya.baslangic` da veritabanı varsayılanıyla dolar ve `vardiyaAc`
 * bu alanı dışarıdan almaz. Otomatik sıfırlama "vardiya sınırdan önce mi
 * açıldı?" diye baktığı için, gerçek saatle yazılmış bir başlangıç
 * simülasyonu anlamsız kılardı. Test düzeneğine ait bir düzeltmedir;
 * uygulamada böyle bir müdahale yoktur.
 */
export async function vardiyaBaslangiciniAyarla(vardiyaId: string, an: Date): Promise<void> {
  await prisma.vardiya.update({ where: { id: vardiyaId }, data: { baslangic: an } });
}

/** Zaman taklidini başlatır (beforeEach içinde çağrılır). */
export function zamaniDondur(): void {
  vi.useFakeTimers({ toFake: ["Date"] });
}

/** Gerçek saate döner (afterEach içinde çağrılır). */
export function zamaniSerbestBirak(): void {
  vi.useRealTimers();
}

// ---------------------------------------------------------------------------
// Form verisi
// ---------------------------------------------------------------------------

/**
 * Server Action'lar `FormData` bekler — tarayıcının gönderdiğiyle aynı
 * biçimde kurulur ki doğrulama katmanı da gerçekten sınansın.
 */
export function form(alanlar: Record<string, string | number | boolean | undefined>): FormData {
  const veri = new FormData();
  for (const [anahtar, deger] of Object.entries(alanlar)) {
    if (deger === undefined) continue;
    // Checkbox'lar tarayıcıda "on" olarak gelir; false ise hiç gönderilmez.
    if (deger === false) continue;
    veri.set(anahtar, deger === true ? "on" : String(deger));
  }
  return veri;
}

/** Server Action'ların ilk parametresi (önceki durum) — testlerde hep boş. */
export const BOS_DURUM = {} as never;
