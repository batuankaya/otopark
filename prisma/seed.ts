/**
 * Seed — boş veritabanına ilk kurulum.
 *
 * Oluşturur:
 *   - Genel ayarlar
 *   - Araç sınıfı başına 1 tarife
 *   - 1 yönetici hesabı (e-posta ve şifre .env'den)
 *
 * Tarife ve otopark değerleri `prisma/seed-config.ts`ten okunur. Görevli
 * hesapları sonradan Ayarlar > Kullanıcılar'dan açılır.
 *
 * Güvenlik kuralları:
 *   - Depoda hiçbir kimlik bilgisi yoktur. Depo herkese açık; içinde yazılı
 *     bir e-posta/şifreyle kurulan sistemin yönetici paneli de herkese açık
 *     olurdu. `SEED_ADMIN_EMAIL` ve `SEED_ADMIN_SIFRE` zorunludur ve şifre,
 *     uygulamanın şifre kurallarından geçmek zorundadır.
 *   - Yalnızca BOŞ veritabanında çalışır, hiçbir şey silmez. Canlı sistemde
 *     yanlışlıkla çalıştırılması kayıtları yok etmesin diye.
 *
 * Çalıştırmak için:  npx prisma db seed
 * (veya sıfırdan:    npx prisma migrate reset)
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { sifreAlani } from "../src/lib/validasyon";
import { otoparkBilgisi, varsayilanTarifeler } from "./seed-config";

const prisma = new PrismaClient();

const ortamSemasi = z.object({
  SEED_ADMIN_EMAIL: z.string().trim().toLowerCase().email("geçerli bir e-posta olmalı"),
  SEED_ADMIN_SIFRE: sifreAlani,
});

async function main() {
  const ortam = ortamSemasi.safeParse(process.env);
  if (!ortam.success) {
    const sorunlar = ortam.error.issues.map((s) => `  - ${s.path.join(".")}: ${s.message}`);
    throw new Error(
      ".env içindeki yönetici bilgileri eksik ya da geçersiz:\n" + sorunlar.join("\n"),
    );
  }
  const { SEED_ADMIN_EMAIL: email, SEED_ADMIN_SIFRE: sifre } = ortam.data;

  const [kullaniciSayisi, ayarSayisi] = await Promise.all([
    prisma.kullanici.count(),
    prisma.ayar.count(),
  ]);
  if (kullaniciSayisi > 0 || ayarSayisi > 0) {
    throw new Error(
      "Veritabanı boş değil; seed yalnızca ilk kurulumda çalışır ve hiçbir veriyi silmez.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.ayar.create({ data: { id: 1, ...otoparkBilgisi } });

    for (const t of varsayilanTarifeler) {
      await tx.tarife.create({
        data: {
          ad: t.ad,
          aracSinifi: t.aracSinifi,
          ilkUcretsizDakika: t.ilkUcretsizDakika,
          ilkSaatUcreti: t.ilkSaatUcreti,
          saatlikUcret: t.saatlikUcret,
          gunlukTavanUcret: t.gunlukTavanUcret,
          aktif: true,
        },
      });
    }

    await tx.kullanici.create({
      data: {
        adSoyad: "Yönetici",
        email,
        sifreHash: await bcrypt.hash(sifre, 12),
        rol: "ADMIN",
      },
    });
  });

  console.log(`✓ Ayarlar (kapasite: ${otoparkBilgisi.toplamKapasite})`);
  for (const t of varsayilanTarifeler) {
    console.log(
      `✓ Tarife (${t.aracSinifi}): ilk ${t.ilkUcretsizDakika} dk ücretsiz, ` +
        `ilk saat ${t.ilkSaatUcreti} TL, sonraki her saat +${t.saatlikUcret} TL`,
    );
  }
  // Şifre ekrana yazılmaz: terminal geçmişine ve kurulum loglarına düşmesin.
  console.log(`✓ Yönetici: ${email}`);
}

main()
  .catch((hata) => {
    console.error("Seed başarısız:", hata instanceof Error ? hata.message : hata);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
