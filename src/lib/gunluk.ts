/**
 * İşlem günlüğü (denetim izi).
 *
 * KVKK gereği: kim, ne zaman, hangi kayıt üzerinde ne yaptı — özellikle
 * iptal, ücret düzeltme ve dışa aktarma işlemleri kayıt altına alınır.
 *
 * Günlük yazımı ana işlemi bloklamamalıdır: hata olursa yalnızca sunucu
 * konsoluna düşer, kullanıcının işlemi geri alınmaz. (Aynı transaction
 * içinde yazılması gereken yerlerde `islemGunlugunuYazTx` kullanılır.)
 */

import type { Prisma, IslemTipi } from "@prisma/client";
import { prisma } from "./prisma";

export type GunlukKaydi = {
  kullaniciId?: string | null;
  islemTipi: IslemTipi;
  ilgiliKayitId?: string | null;
  eskiDeger?: Prisma.InputJsonValue | null;
  yeniDeger?: Prisma.InputJsonValue | null;
  aciklama?: string | null;
};

function veriyeCevir(kayit: GunlukKaydi): Prisma.IslemGunluguUncheckedCreateInput {
  return {
    kullaniciId: kayit.kullaniciId ?? null,
    islemTipi: kayit.islemTipi,
    ilgiliKayitId: kayit.ilgiliKayitId ?? null,
    eskiDeger: kayit.eskiDeger ?? undefined,
    yeniDeger: kayit.yeniDeger ?? undefined,
    aciklama: kayit.aciklama ?? null,
  };
}

/** Bağımsız günlük yazımı — hata ana işlemi etkilemez. */
export async function islemGunluguYaz(kayit: GunlukKaydi): Promise<void> {
  try {
    await prisma.islemGunlugu.create({ data: veriyeCevir(kayit) });
  } catch (hata) {
    console.error("İşlem günlüğü yazılamadı:", hata);
  }
}

/** Transaction içinde günlük yazımı — işlemle birlikte ya hep ya hiç. */
export async function islemGunluguYazTx(
  tx: Prisma.TransactionClient,
  kayit: GunlukKaydi,
): Promise<void> {
  await tx.islemGunlugu.create({ data: veriyeCevir(kayit) });
}

/** İşlem tiplerinin ekranda gösterilecek Türkçe karşılıkları. */
export const ISLEM_TIPI_ETIKETLERI: Record<IslemTipi, string> = {
  GIRIS: "Araç girişi",
  GIRIS_BASARISIZ: "Başarısız giriş denemesi",
  CIKIS: "Araç çıkışı",
  IPTAL: "Kayıt iptali",
  UCRET_DUZELTME: "Ücret düzeltmesi",
  TARIFE_DEGISIKLIGI: "Tarife değişikliği",
  KULLANICI_DEGISIKLIGI: "Kullanıcı değişikliği",
  ABONMAN_DEGISIKLIGI: "Abonman değişikliği",
  PARK_ALANI_DEGISIKLIGI: "Park alanı değişikliği",
  AYAR_DEGISIKLIGI: "Ayar değişikliği",
  VARDIYA_ACILIS: "Vardiya açılışı",
  VARDIYA_KAPANIS: "Vardiya kapanışı",
  DISA_AKTARMA: "Veri dışa aktarma",
  OTURUM_ACMA: "Oturum açma",
  GIDER_EKLEME: "Gider eklendi",
  GIDER_SILME: "Gider silindi",
  KAYIT_DUZENLEME: "Kayıt düzenlendi",
};
