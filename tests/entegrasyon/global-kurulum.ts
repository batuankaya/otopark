/**
 * Entegrasyon testleri için tek seferlik hazırlık.
 *
 * Test veritabanı yoksa `prisma migrate deploy` onu kendisi oluşturur, sonra
 * tüm migrasyonları uygular. Böylece yeni bir makinede ekstra kurulum adımı
 * gerekmez — `npm test` yeterlidir.
 */

import { execFileSync } from "node:child_process";

import { testVeritabaniAdresi } from "./veritabani";

export default function kur() {
  const adres = testVeritabaniAdresi();

  try {
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      // DATABASE_URL kabuktan verilir; Prisma .env'i bunun üzerine YAZMAZ.
      env: { ...process.env, DATABASE_URL: adres },
      stdio: "pipe",
    });
  } catch (hata) {
    const cikti = hata instanceof Error && "stderr" in hata ? String(hata.stderr) : String(hata);
    throw new Error(
      "Test veritabanı hazırlanamadı. PostgreSQL çalışıyor mu?\n" +
        "  Başlatmak için: docker compose up -d\n\n" +
        cikti,
    );
  }
}
