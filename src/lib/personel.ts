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
 * Bugün kaydı yazılmış kullanıcılar — gereksiz veritabanı yazımını önler.
 *
 * Kayıt yalnızca giriş anında oluşturulmak yetmiyor: oturum 12 saatlik ve her
 * istekte tazeleniyor, yani çıkış yapmadan çalışmaya devam eden biri ikinci
 * gün hiç giriş yapmaz ve o günün geliş kaydı oluşmaz. Bu yüzden kayıt her
 * kimlik doğrulamasında denenir.
 *
 * Her istekte veritabanına yazmamak için işlem belleğinde tutulur. Uygulama
 * yeniden başlarsa küme boşalır ve kullanıcı başına bir fazladan `upsert`
 * yapılır — zararsız, çünkü `update: {}` mevcut kaydı değiştirmez.
 */
const bugunKaydedilenler = new Set<string>();

/**
 * Günün ilk girişini kaydeder.
 *
 * Aynı gün tekrar çağrılırsa saat DEĞİŞMEZ — `(kullaniciId, gun)` benzersiz
 * olduğu için `upsert` mevcut kaydı olduğu gibi bırakır. Böylece "geliş saati"
 * günün ilk temasında sabitlenir.
 *
 * Hata durumunda akış DURMAZ: mesai kaydı tutulamadı diye çalışanın sisteme
 * girememesi ya da sayfanın açılmaması kabul edilemez.
 */
export async function gelisiKaydet(kullaniciId: string): Promise<void> {
  const gun = gunBaslangici();
  const anahtar = `${kullaniciId}:${gun.getTime()}`;

  // Bu süreçte bugün için zaten yazıldıysa veritabanına hiç gitme.
  if (bugunKaydedilenler.has(anahtar)) return;

  try {
    await prisma.personelGiris.upsert({
      where: { kullaniciId_gun: { kullaniciId, gun } },
      create: { kullaniciId, gun, gelisZamani: new Date() },
      // Zaten kayıt varsa dokunulmaz: günün İLK teması esastır.
      update: {},
    });

    bugunKaydedilenler.add(anahtar);

    // Küme sınırsız büyümesin: gün değişince eski anahtarlar gereksizdir.
    if (bugunKaydedilenler.size > 200) {
      for (const eski of bugunKaydedilenler) {
        if (!eski.endsWith(`:${gun.getTime()}`)) bugunKaydedilenler.delete(eski);
      }
    }
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
