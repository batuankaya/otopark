/**
 * Personel geliş kaydı (mesai takibi).
 *
 * Çalışan uygulamaya giriş yaptığında otomatik kaydedilir. Ayrı bir "işe
 * geldim" düğmesi BİLEREK yok: basılması gereken bir düğme unutulur ve o gün
 * hiç kayıt oluşmaz. Görevli zaten çalışmak için giriş yapmak zorunda.
 *
 * Vardiyadan ayrıdır: vardiya otoparkın ortak kasasıdır ve tek kişi açar;
 * mesai kişiye özeldir ve her çalışan için tutulur.
 */

import { prisma } from "./prisma";
import { gunBaslangici } from "./tarih";

/**
 * Günün ilk girişini kaydeder.
 *
 * Aynı gün tekrar giriş yapılırsa yeni kayıt oluşmaz — `(kullaniciId, gun)`
 * benzersiz olduğu için `upsert` sessizce mevcut kaydı bırakır. Böylece
 * "geliş saati" günün ilk girişi olarak sabit kalır.
 *
 * Hata durumunda giriş akışı DURMAZ: mesai kaydı tutulamadı diye çalışan
 * sisteme girememesi kabul edilemez.
 */
export async function gelisiKaydet(kullaniciId: string): Promise<void> {
  try {
    const gun = gunBaslangici();
    await prisma.personelGiris.upsert({
      where: { kullaniciId_gun: { kullaniciId, gun } },
      create: { kullaniciId, gun, gelisZamani: new Date() },
      // Zaten kayıt varsa dokunulmaz: günün İLK girişi esastır.
      update: {},
    });
  } catch (hata) {
    console.error("Personel geliş kaydı oluşturulamadı:", hata);
  }
}

/** Belirli bir günün geliş kayıtları (varsayılan: bugün). */
export async function gununGelisleri(tarih: Date = new Date()) {
  const gun = gunBaslangici(tarih);

  const [girisler, aktifPersonel] = await Promise.all([
    prisma.personelGiris.findMany({
      where: { gun },
      include: { kullanici: { select: { id: true, adSoyad: true, rol: true } } },
      orderBy: { gelisZamani: "asc" },
    }),
    prisma.kullanici.findMany({
      where: { aktif: true },
      select: { id: true, adSoyad: true, rol: true },
    }),
  ]);

  // Gelmeyenleri de göster: "kim gelmedi" sorusu "kim geldi"den daha kritik.
  const gelenIdler = new Set(girisler.map((g) => g.kullaniciId));
  const gelmeyenler = aktifPersonel.filter((k) => !gelenIdler.has(k.id));

  return { girisler, gelmeyenler };
}

/** Bir tarih aralığındaki geliş kayıtları (yönetici raporu). */
export async function gelisGecmisi(baslangic: Date, bitis: Date) {
  return prisma.personelGiris.findMany({
    where: { gun: { gte: gunBaslangici(baslangic), lt: bitis } },
    include: { kullanici: { select: { adSoyad: true, rol: true } } },
    orderBy: [{ gun: "desc" }, { gelisZamani: "asc" }],
  });
}
