/**
 * Birden fazla ekranın paylaştığı veri erişim fonksiyonları.
 *
 * Sayfa bileşenlerinin içine dağılmış Prisma sorguları yerine buraya
 * toplandı: doluluk hesabı, aktif tarife ve ayar okuma gibi işler her
 * yerde aynı kuralla çalışsın diye.
 */

import { unstable_noStore as onbellekleme } from "next/cache";

import { prisma } from "./prisma";
import { sayiyaCevir } from "./para";
import { kalanGun } from "./tarih";

/** Ayarlar satırı yoksa oluşturur — kurulum yarım kalsa bile uygulama çalışsın. */
export async function ayarlariAl() {
  const mevcut = await prisma.ayar.findUnique({ where: { id: 1 } });
  if (mevcut) return mevcut;

  return prisma.ayar.create({
    data: { id: 1, otoparkAdi: "Otopark", toplamKapasite: 100 },
  });
}

/**
 * Yürürlükteki tarife: geçerlilik başlangıcı geçmiş, aktif tarifelerin
 * en yenisi. Yoksa `null` döner ve arayüz kullanıcıyı Ayarlar'a yönlendirir.
 */
export async function aktifTarifeyiAl() {
  return prisma.tarife.findFirst({
    where: { aktif: true, gecerlilikBaslangic: { lte: new Date() } },
    orderBy: { gecerlilikBaslangic: "desc" },
  });
}

/** Ücret motorunun beklediği sade tarife nesnesi. */
export function tarifeyiSadelestir(tarife: {
  ilkUcretsizDakika: number;
  ilkSaatUcreti: unknown;
  saatlikUcret: unknown;
  gunlukTavanUcret: unknown;
}) {
  return {
    ilkUcretsizDakika: tarife.ilkUcretsizDakika,
    ilkSaatUcreti: sayiyaCevir(tarife.ilkSaatUcreti),
    saatlikUcret: sayiyaCevir(tarife.saatlikUcret),
    gunlukTavanUcret: sayiyaCevir(tarife.gunlukTavanUcret),
  };
}

export async function parkAlanlariniAl(yalnizAktif = true) {
  return prisma.parkAlani.findMany({
    where: yalnizAktif ? { aktif: true } : undefined,
    orderBy: [{ sira: "asc" }, { ad: "asc" }],
  });
}

/** Ana panodaki doluluk göstergesi. */
export async function dolulukAl() {
  onbellekleme(); // anlık veri; önbelleğe alınmamalı

  const [ayar, icerideSayisi] = await Promise.all([
    ayarlariAl(),
    prisma.parkKaydi.count({ where: { durum: "ICERIDE" } }),
  ]);

  const kapasite = ayar.toplamKapasite || 1;
  return {
    iceride: icerideSayisi,
    kapasite: ayar.toplamKapasite,
    bosYer: Math.max(0, ayar.toplamKapasite - icerideSayisi),
    yuzde: Math.min(100, Math.round((icerideSayisi / kapasite) * 100)),
    doluMu: icerideSayisi >= ayar.toplamKapasite,
  };
}

/** Park alanı bazında doluluk — içerideki araçlar ekranındaki filtre başlıkları. */
export async function alanBazliDoluluk() {
  const [alanlar, sayimlar] = await Promise.all([
    parkAlanlariniAl(),
    prisma.parkKaydi.groupBy({
      by: ["parkAlaniId"],
      where: { durum: "ICERIDE" },
      _count: { _all: true },
    }),
  ]);

  return alanlar.map((alan) => ({
    ...alan,
    iceride: sayimlar.find((s) => s.parkAlaniId === alan.id)?._count._all ?? 0,
  }));
}

/** Ana panodaki "son işlemler" listesi. */
export async function sonIslemleriAl(adet = 10) {
  onbellekleme();

  return prisma.parkKaydi.findMany({
    where: { durum: { not: "IPTAL" } },
    orderBy: [{ guncellemeTarihi: "desc" }],
    take: adet,
    select: {
      id: true,
      plaka: true,
      plakaGosterim: true,
      yabanciPlaka: true,
      ulkeKodu: true,
      marka: true,
      model: true,
      notlar: true,
      fisNo: true,
      girisZamani: true,
      cikisZamani: true,
      durum: true,
      tahsilEdilenUcret: true,
      odemeYontemi: true,
      parkAlaniAd: true,
      girisYapan: { select: { adSoyad: true } },
      cikisYapan: { select: { adSoyad: true } },
    },
  });
}

/** Plakası içeride olan aktif kayıt (mükerrer giriş kontrolü). */
export async function icerideMi(plaka: string) {
  return prisma.parkKaydi.findFirst({
    where: { plaka, durum: "ICERIDE" },
    include: {
      arac: true,
      girisYapan: { select: { adSoyad: true } },
      parkAlani: { select: { ad: true } },
    },
  });
}

/**
 * Bir araca ait, çıkış anında geçerli olan abonman.
 * "Geçerli" = durum AKTIF ve tarih aralığı içinde.
 */
export async function gecerliAbonmaniBul(aracId: string, an: Date = new Date()) {
  return prisma.abonman.findFirst({
    where: {
      aracId,
      durum: "AKTIF",
      baslangicTarihi: { lte: an },
      bitisTarihi: { gte: an },
    },
    orderBy: { bitisTarihi: "desc" },
  });
}

/** Araca bağlı herhangi bir abonman (süresi dolmuş olsa bile) — girişte uyarmak için. */
export async function aracinAbonmaniniBul(aracId: string) {
  return prisma.abonman.findFirst({
    where: { aracId, durum: { not: "IPTAL" } },
    orderBy: { bitisTarihi: "desc" },
  });
}

/** Bitişine 7 gün veya daha az kalan aktif abonmanlar. */
export async function bitenAbonmanlariAl(gunEsigi = 7) {
  const simdi = new Date();
  const esik = new Date(simdi.getTime() + gunEsigi * 24 * 60 * 60 * 1000);

  const abonmanlar = await prisma.abonman.findMany({
    where: { durum: "AKTIF", bitisTarihi: { lte: esik } },
    include: { arac: { select: { plaka: true } } },
    orderBy: { bitisTarihi: "asc" },
  });

  return abonmanlar.map((abonman) => ({
    ...abonman,
    kalanGun: kalanGun(abonman.bitisTarihi, simdi),
  }));
}
