import { defineConfig } from "vitest/config";

/**
 * İki test kümesi var:
 *
 *  • birim       — saf iş kuralları (plaka, ücret, tarih, para, doğrulama…).
 *                  Hiçbir dış bağımlılık yok, milisaniyeler içinde koşar.
 *
 *  • entegrasyon — GERÇEK PostgreSQL üzerinde Server Action'ları uçtan uca
 *                  çalıştırır. Transaction'lar, kısmi unique index'ler ve
 *                  Decimal aritmetiği taklit edilemez; kasa devrinin doğru
 *                  olduğunu ancak burada kanıtlayabiliriz.
 *
 * Entegrasyon testleri ayrı bir veritabanında (otopark_test) çalışır ve her
 * dosyada tabloları boşaltır — bu yüzden paralel koşamazlar.
 */

const yollar = { resolve: { tsconfigPaths: true } } as const;

export default defineConfig({
  ...yollar,
  test: {
    projects: [
      {
        ...yollar,
        test: {
          name: "birim",
          environment: "node",
          include: ["tests/*.test.ts"],
          globals: false,
          /**
           * Sunucu saat dilimi BİLEREK İstanbul'dan farklı seçildi.
           *
           * Uygulama her yerde Europe/Istanbul'u açıkça belirtiyor; bu doğruysa
           * sunucunun saati hiçbir sonucu değiştirmemeli. Los Angeles hem geride
           * (UTC−7) hem de yaz saati uyguluyor — yerel saate sızan bir bağımlılık
           * varsa tarih testleri burada kırılır.
           */
          env: { TZ: "America/Los_Angeles" },
        },
      },
      {
        ...yollar,
        test: {
          name: "entegrasyon",
          environment: "node",
          include: ["tests/entegrasyon/**/*.test.ts"],
          globalSetup: ["tests/entegrasyon/global-kurulum.ts"],
          setupFiles: ["tests/entegrasyon/kurulum.ts"],
          globals: false,
          // Hepsi aynı veritabanını kullanıyor: dosyalar sırayla koşmalı.
          fileParallelism: false,
          // Veritabanı açılışı ilk dosyada birkaç saniye sürebilir.
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
