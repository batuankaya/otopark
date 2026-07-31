/**
 * Her entegrasyon test dosyasından ÖNCE çalışır.
 *
 * İki iş yapar:
 *  1. DATABASE_URL'i test veritabanına çevirir. Bu satır, test dosyası
 *     `@/lib/prisma`yı içe aktarmadan önce çalışmak ZORUNDA: PrismaClient
 *     adresi kurulduğu anda okur, sonradan değiştirmek işe yaramaz.
 *  2. Next.js'e özgü modülleri taklit eder. Testler Next çalışma zamanı
 *     olmadan koştuğu için `revalidatePath` gibi çağrılar gerçek olamaz;
 *     zaten sınadığımız şey önbellek değil, veritabanına yazılan veri.
 */

import { vi } from "vitest";

import { testVeritabaniAdresi } from "./veritabani";

process.env.DATABASE_URL = testVeritabaniAdresi();

/**
 * Oturumdaki kullanıcı — testler `oturumAc()` ile değiştirir.
 * Taklit fabrikası çalıştığı anda okunduğu için global nesnede tutulur.
 */
declare global {
  var __testOturumu: { user: { id: string; acilis: number } } | null | undefined;
}

globalThis.__testOturumu = null;

/**
 * Gerçek `auth()` next-auth'a, çereze ve HTTP isteğine bağlı — testte
 * kurulamaz. Yerine oturumu doğrudan veriyoruz; `lib/yetki.ts` bu kimlikle
 * GERÇEK veritabanı doğrulamasını yapmaya devam ediyor (aktif mi, şifre
 * değişmiş mi), yani asıl sınamak istediğimiz mantık taklit edilmiyor.
 */
vi.mock("@/lib/auth", () => ({
  auth: async () => globalThis.__testOturumu ?? null,
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
  unstable_noStore: () => {},
}));
