/**
 * Rapor sorguları.
 *
 * Tüm gün sınırları Europe/Istanbul'a göre hesaplanır (bkz. lib/tarih.ts):
 * "bugünün cirosu" sunucunun saat dilimine göre kaymasın diye.
 */

import { prisma } from "./prisma";
import { sayiyaCevir } from "./para";
import { gunBaslangici, gunEkle, tarihGirdisiDegeri } from "./tarih";

export type RaporAraligi = { baslangic: Date; bitis: Date };

/** Aralıktaki ciro, işlem sayısı ve ödeme yöntemi dağılımı. */
export async function ciroOzeti({ baslangic, bitis }: RaporAraligi) {
  const [gruplar, iptalSayisi, girisSayisi] = await Promise.all([
    prisma.parkKaydi.groupBy({
      by: ["odemeYontemi"],
      where: { durum: "CIKTI", cikisZamani: { gte: baslangic, lt: bitis } },
      _sum: { tahsilEdilenUcret: true, hesaplananUcret: true },
      _count: { _all: true },
    }),
    prisma.parkKaydi.count({
      where: { durum: "IPTAL", iptalZamani: { gte: baslangic, lt: bitis } },
    }),
    prisma.parkKaydi.count({
      where: { girisZamani: { gte: baslangic, lt: bitis }, durum: { not: "IPTAL" } },
    }),
  ]);

  const topla = (yontem: "NAKIT" | "KART" | null) =>
    sayiyaCevir(gruplar.find((g) => g.odemeYontemi === yontem)?._sum.tahsilEdilenUcret);

  const nakit = topla("NAKIT");
  const kart = topla("KART");
  const cikisSayisi = gruplar.reduce((toplam, g) => toplam + g._count._all, 0);
  const hesaplananToplam = gruplar.reduce(
    (toplam, g) => toplam + sayiyaCevir(g._sum.hesaplananUcret),
    0,
  );

  return {
    nakit,
    kart,
    toplamCiro: nakit + kart,
    /** Hesaplanan ile tahsil edilen arasındaki fark (iskonto toplamı). */
    iskontoToplami: Math.round((hesaplananToplam - (nakit + kart)) * 100) / 100,
    girisSayisi,
    cikisSayisi,
    iptalSayisi,
    ucretsizCikisSayisi: gruplar.find((g) => g.odemeYontemi === null)?._count._all ?? 0,
    ortalamaFis: cikisSayisi > 0 ? Math.round(((nakit + kart) / cikisSayisi) * 100) / 100 : 0,
  };
}

/** Aralıktaki giderler — kategori ve ödeme yöntemine göre. */
export async function giderOzeti({ baslangic, bitis }: RaporAraligi) {
  const [kategoriler, yontemler] = await Promise.all([
    prisma.gider.groupBy({
      by: ["kategori"],
      where: { zaman: { gte: baslangic, lt: bitis } },
      _sum: { tutar: true },
      _count: { _all: true },
    }),
    prisma.gider.groupBy({
      by: ["odemeYontemi"],
      where: { zaman: { gte: baslangic, lt: bitis } },
      _sum: { tutar: true },
    }),
  ]);

  const topla = (yontem: "NAKIT" | "KART") =>
    sayiyaCevir(yontemler.find((y) => y.odemeYontemi === yontem)?._sum.tutar);

  const nakit = topla("NAKIT");
  const kart = topla("KART");

  return {
    nakitGider: nakit,
    kartGider: kart,
    toplamGider: nakit + kart,
    kategoriler: kategoriler
      .map((k) => ({
        kategori: k.kategori,
        tutar: sayiyaCevir(k._sum.tutar),
        adet: k._count._all,
      }))
      .sort((a, b) => b.tutar - a.tutar),
  };
}

/** Gün gün ciro ve araç sayısı — grafik için. */
export async function gunlukSeri({ baslangic, bitis }: RaporAraligi) {
  const kayitlar = await prisma.parkKaydi.findMany({
    where: { durum: "CIKTI", cikisZamani: { gte: baslangic, lt: bitis } },
    select: { cikisZamani: true, tahsilEdilenUcret: true },
  });

  // Aralıktaki her günü sıfırla başlat ki grafik boş günleri de göstersin.
  const gunler = new Map<string, { tarih: string; ciro: number; arac: number }>();
  for (let an = gunBaslangici(baslangic); an < bitis; an = gunEkle(an, 1)) {
    gunler.set(tarihGirdisiDegeri(an), { tarih: tarihGirdisiDegeri(an), ciro: 0, arac: 0 });
  }

  for (const kayit of kayitlar) {
    if (!kayit.cikisZamani) continue;
    const anahtar = tarihGirdisiDegeri(kayit.cikisZamani);
    const gun = gunler.get(anahtar);
    if (gun) {
      gun.ciro += sayiyaCevir(kayit.tahsilEdilenUcret);
      gun.arac += 1;
    }
  }

  return [...gunler.values()].map((gun) => ({
    ...gun,
    ciro: Math.round(gun.ciro * 100) / 100,
  }));
}

/** Saat bazlı doluluk dağılımı — hangi saatlerde yoğunuz? */
export async function saatlikDoluluk({ baslangic, bitis }: RaporAraligi) {
  const girisler = await prisma.parkKaydi.findMany({
    where: { girisZamani: { gte: baslangic, lt: bitis }, durum: { not: "IPTAL" } },
    select: { girisZamani: true },
  });

  const saatler = Array.from({ length: 24 }, (_, saat) => ({ saat, giris: 0 }));
  const bicim = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    hour12: false,
  });

  for (const kayit of girisler) {
    const saat = Number(bicim.format(kayit.girisZamani)) % 24;
    saatler[saat].giris += 1;
  }

  return saatler;
}

/** Görevli bazlı işlem sayısı ve tahsilat. */
export async function gorevliPerformansi({ baslangic, bitis }: RaporAraligi) {
  const [kullanicilar, girisler, cikislar] = await Promise.all([
    prisma.kullanici.findMany({ select: { id: true, adSoyad: true, rol: true } }),
    prisma.parkKaydi.groupBy({
      by: ["girisYapanId"],
      where: { girisZamani: { gte: baslangic, lt: bitis }, durum: { not: "IPTAL" } },
      _count: { _all: true },
    }),
    prisma.parkKaydi.groupBy({
      by: ["cikisYapanId"],
      where: { durum: "CIKTI", cikisZamani: { gte: baslangic, lt: bitis } },
      _count: { _all: true },
      _sum: { tahsilEdilenUcret: true },
    }),
  ]);

  return kullanicilar
    .map((kullanici) => {
      const giris = girisler.find((g) => g.girisYapanId === kullanici.id);
      const cikis = cikislar.find((c) => c.cikisYapanId === kullanici.id);
      return {
        id: kullanici.id,
        adSoyad: kullanici.adSoyad,
        rol: kullanici.rol,
        girisSayisi: giris?._count._all ?? 0,
        cikisSayisi: cikis?._count._all ?? 0,
        tahsilat: sayiyaCevir(cikis?._sum.tahsilEdilenUcret),
      };
    })
    .filter((satir) => satir.girisSayisi > 0 || satir.cikisSayisi > 0)
    .sort((a, b) => b.girisSayisi + b.cikisSayisi - (a.girisSayisi + a.cikisSayisi));
}
