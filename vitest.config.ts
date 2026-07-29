import { defineConfig } from "vitest/config";

/**
 * Birim testleri yalnızca saf iş kuralı kütüphanelerini kapsar
 * (plaka doğrulama ve ücret hesabı) — veritabanı veya tarayıcı gerekmez.
 */
export default defineConfig({
  resolve: {
    // "@/lib/..." yollarını tsconfig.json'daki paths ayarından çözer.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
  },
});
