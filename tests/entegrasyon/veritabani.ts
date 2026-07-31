/**
 * Entegrasyon testlerinin veritabanı adresi.
 *
 * Testler GERÇEK PostgreSQL üzerinde çalışır — Prisma sorguları, transaction'lar,
 * kısmi unique index'ler ve Decimal davranışı taklit edilemez; taklit edilirse
 * de test ettiğimiz şey kendi taklidimiz olur.
 *
 * Adres `.env` içindeki DATABASE_URL'den türetilir; yalnızca veritabanı ADI
 * `otopark_test` ile değiştirilir. Böylece şifre bu dosyaya (ve sürüm
 * kontrolüne) yazılmak zorunda kalmaz.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Testlerin kullanacağı veritabanı adı. Güvenlik kilidi buna bakar. */
const TEST_VERITABANI_ADI = "otopark_test";

/** `.env` dosyasından tek bir anahtarı okur (bağımlılık eklememek için elle). */
function envDegeriniOku(anahtar: string): string | undefined {
  try {
    const icerik = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const satir of icerik.split("\n")) {
      const temiz = satir.trim();
      if (!temiz || temiz.startsWith("#")) continue;
      const ayirac = temiz.indexOf("=");
      if (ayirac === -1) continue;
      if (temiz.slice(0, ayirac).trim() !== anahtar) continue;
      // Değer tırnaklı olabilir: DATABASE_URL="postgresql://..."
      return temiz
        .slice(ayirac + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env yoksa aşağıdaki hata mesajı devreye girer.
  }
  return undefined;
}

/**
 * Test veritabanı adresini üretir.
 *
 * GÜVENLİK KİLİDİ: üretilen adresin veritabanı adı `otopark_test` değilse
 * hata fırlatılır. Testler her dosya başında TÜM TABLOLARI BOŞALTIYOR —
 * yanlışlıkla geliştirme (veya daha kötüsü, canlı) veritabanına bağlanmak
 * tüm park kayıtlarını siler. Bu kontrol o senaryoyu imkânsız kılar.
 */
export function testVeritabaniAdresi(): string {
  const ham = process.env.TEST_DATABASE_URL ?? envDegeriniOku("DATABASE_URL");

  if (!ham) {
    throw new Error(
      "DATABASE_URL bulunamadı. Entegrasyon testleri için .env dosyası gerekli " +
        "(bkz. .env.example) ya da TEST_DATABASE_URL tanımlayın.",
    );
  }

  const adres = new URL(ham);
  // URL yolu "/otopark_dev" biçiminde; yalnızca adı değiştiriyoruz.
  adres.pathname = `/${TEST_VERITABANI_ADI}`;

  /**
   * Tek bağlantı.
   *
   * Testler her dosyada TRUNCATE çalıştırıyor; bu, tablonun tamamı üzerinde
   * özel kilit ister. Havuzda birden fazla bağlantı varsa biri hâlâ satır
   * kilidi tutarken diğeri TRUNCATE'e girip deadlock üretiyor (40P01) —
   * testler rastgele kırılır. Testler zaten sıralı koştuğu için tek bağlantı
   * hız kaybettirmez, bu hata sınıfını tamamen ortadan kaldırır.
   */
  adres.searchParams.set("connection_limit", "1");

  const ad = adres.pathname.replace(/^\//, "");
  if (ad !== TEST_VERITABANI_ADI) {
    throw new Error(
      `Güvenlik kilidi: testler yalnızca "${TEST_VERITABANI_ADI}" veritabanında ` +
        `çalışabilir, "${ad}" reddedildi. Testler tüm tabloları boşaltır.`,
    );
  }

  return adres.toString();
}
