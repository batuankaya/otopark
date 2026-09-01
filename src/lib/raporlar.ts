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
  const [gruplar, iptalSayisi, girisSayisi, borclar, ucretsizCikisSayisi] = await Promise.all([
    prisma.parkKaydi.groupBy({
      by: ["odemeYontemi"],
      where: { durum: "CIKTI", cikisZamani: { gte: baslangic, lt: bitis } },
      // Eski borç tahsilatı da ciroya girer: para bu aralıkta kasaya girmiştir.
      _sum: {
        tahsilEdilenUcret: true,
        hesaplananUcret: true,
        tahsilEdilenBorc: true,
        borcTutari: true,
      },
      _count: { _all: true },
    }),
    prisma.parkKaydi.count({
      where: { durum: "IPTAL", iptalZamani: { gte: baslangic, lt: bitis } },
    }),
    prisma.parkKaydi.count({
      where: { girisZamani: { gte: baslangic, lt: bitis }, durum: { not: "IPTAL" } },
    }),
    prisma.parkKaydi.count({
      where: {
        durum: "CIKTI",
        cikisZamani: { gte: baslangic, lt: bitis },
        borcTutari: { gt: 0 },
      },
    }),
    // Borçlu çıkışta da ödeme yöntemi boştur; "ücretsiz çıktı" sayılmamalı.
    prisma.parkKaydi.count({
      where: {
        durum: "CIKTI",
        cikisZamani: { gte: baslangic, lt: bitis },
        odemeYontemi: null,
        borcTutari: 0,
      },
    }),
  ]);

  const topla = (yontem: "NAKIT" | "KART" | null) => {
    const grup = gruplar.find((g) => g.odemeYontemi === yontem);
    return sayiyaCevir(grup?._sum.tahsilEdilenUcret) + sayiyaCevir(grup?._sum.tahsilEdilenBorc);
  };

  const nakit = topla("NAKIT");
  const kart = topla("KART");
  const cikisSayisi = gruplar.reduce((toplam, g) => toplam + g._count._all, 0);
  const toplaAlan = (alan: "hesaplananUcret" | "tahsilEdilenUcret" | "tahsilEdilenBorc" | "borcTutari") =>
    gruplar.reduce((toplam, g) => toplam + sayiyaCevir(g._sum[alan]), 0);

  const hesaplananToplam = toplaAlan("hesaplananUcret");
  const parkUcretiTahsilati = toplaAlan("tahsilEdilenUcret");
  const tahsilEdilenBorc = toplaAlan("tahsilEdilenBorc");
  const olusanBorc = toplaAlan("borcTutari");

  return {
    nakit,
    kart,
    toplamCiro: nakit + kart,
    /**
     * Hesaplanan ile tahakkuk arasındaki fark (iskonto toplamı).
     * Borç iskonto değildir: tahsil edilmemiş olsa da alacak durduğu için
     * hesaba katılır, aksi hâlde her borçlu çıkış iskonto gibi görünürdü.
     */
    iskontoToplami:
      Math.round((hesaplananToplam - (parkUcretiTahsilati + olusanBorc)) * 100) / 100,
    /** Bu aralıkta ödemeden çıkan araçların bıraktığı borç. */
    olusanBorc: Math.round(olusanBorc * 100) / 100,
    /** Bu aralıkta kasaya giren eski borç tahsilatı. */
    tahsilEdilenBorc: Math.round(tahsilEdilenBorc * 100) / 100,
    borcluCikisSayisi: borclar,
    girisSayisi,
    cikisSayisi,
    iptalSayisi,
    ucretsizCikisSayisi,
    ortalamaFis: cikisSayisi > 0 ? Math.round(((nakit + kart) / cikisSayisi) * 100) / 100 : 0,
  };
}

/**
 * Halen açık olan borçlar — en eskisi başta.
 *
 * Dönem filtresi UYGULANMAZ: açık borç anlık bir bakiyedir, "geçen hafta
 * ne kadar borç vardı" diye sorulmaz. Borcun doğduğu çıkış tarihi listede
 * görünür, ne kadar beklediği oradan okunur.
 */
export async function acikBorclar(adet = 50) {
  const kayitlar = await prisma.parkKaydi.findMany({
    where: { durum: "CIKTI", borcKalan: { gt: 0 } },
    orderBy: { cikisZamani: "asc" },
    take: adet,
    select: {
      id: true,
      fisNo: true,
      plaka: true,
      plakaGosterim: true,
      marka: true,
      model: true,
      cikisZamani: true,
      borcTutari: true,
      borcKalan: true,
      arac: { select: { marka: true, model: true } },
    },
  });

  const toplam = await prisma.parkKaydi.aggregate({
    where: { durum: "CIKTI", borcKalan: { gt: 0 } },
    _sum: { borcKalan: true },
    _count: { _all: true },
  });

  return {
    toplam: sayiyaCevir(toplam._sum.borcKalan),
    adet: toplam._count._all,
    kayitlar: kayitlar.map((kayit) => ({
      id: kayit.id,
      fisNo: kayit.fisNo,
      plaka: kayit.plakaGosterim ?? kayit.plaka,
      arac: [kayit.marka ?? kayit.arac?.marka, kayit.model ?? kayit.arac?.model]
        .filter(Boolean)
        .join(" "),
      cikisZamani: kayit.cikisZamani,
      tutar: sayiyaCevir(kayit.borcTutari),
      kalan: sayiyaCevir(kayit.borcKalan),
    })),
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
