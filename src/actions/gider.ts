"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { GIDER_ETIKETLERI } from "@/lib/gider";
import { islemGunluguYazTx } from "@/lib/gunluk";
import { sayiyaCevir } from "@/lib/para";
import { prisma } from "@/lib/prisma";
import {
  formVerisiniAl,
  giderSemasi,
  hatalariTopla,
  type AlanHatalari,
} from "@/lib/validasyon";
import { acikVardiyayiBul, oturumAl } from "@/lib/yetki";

export type GiderDurumu = {
  basarili?: boolean;
  hata?: string;
  alanHatalari?: AlanHatalari;
  vardiyaGerekli?: boolean;
};

/**
 * Gider ekler.
 *
 * Gider her zaman AÇIK VARDİYAYA bağlanır: nakit gider kasadan çıktığı için
 * hangi vardiyanın kasasından düştüğü bilinmek zorunda. Vardiya yoksa işlem
 * yapılmaz — aksi hâlde gün sonu sayımı tutmaz.
 */
export async function giderEkle(
  _onceki: GiderDurumu,
  formData: FormData,
): Promise<GiderDurumu> {
  const kullanici = await oturumAl();
  if (!kullanici) return { hata: "Oturumunuz sonlanmış." };

  const vardiya = await acikVardiyayiBul();
  if (!vardiya) {
    return {
      hata: "Açık vardiya yok. Gider kaydı için önce vardiya açılmalı.",
      vardiyaGerekli: true,
    };
  }

  const ayrisma = giderSemasi.safeParse(formVerisiniAl(formData));
  if (!ayrisma.success) return { alanHatalari: hatalariTopla(ayrisma.error) };
  const veri = ayrisma.data;

  await prisma.$transaction(async (tx) => {
    const gider = await tx.gider.create({
      data: {
        vardiyaId: vardiya.id,
        kullaniciId: kullanici.id,
        kategori: veri.kategori,
        tutar: new Prisma.Decimal(veri.tutar),
        aciklama: veri.aciklama,
        odemeYontemi: veri.odemeYontemi,
      },
    });

    await islemGunluguYazTx(tx, {
      kullaniciId: kullanici.id,
      islemTipi: "GIDER_EKLEME",
      ilgiliKayitId: gider.id,
      yeniDeger: {
        kategori: veri.kategori,
        tutar: veri.tutar,
        odemeYontemi: veri.odemeYontemi,
        aciklama: veri.aciklama,
      },
      aciklama: `${GIDER_ETIKETLERI[veri.kategori]} gideri: ${veri.tutar} TL — ${veri.aciklama}`,
    });
  });

  revalidatePath("/giderler");
  revalidatePath("/vardiya");
  revalidatePath("/raporlar");
  return { basarili: true };
}

/**
 * Gideri siler.
 *
 * Yalnızca AÇIK vardiyanın giderleri silinebilir: kapanmış vardiyanın kasası
 * sayılıp mutabakatı yapılmıştır, sonradan değiştirilirse rapor tutmaz.
 * Silme işlemi eski değeriyle günlüğe yazılır.
 */
export async function giderSil(
  _onceki: GiderDurumu,
  formData: FormData,
): Promise<GiderDurumu> {
  const kullanici = await oturumAl();
  if (!kullanici) return { hata: "Oturumunuz sonlanmış." };

  const giderId = formData.get("giderId");
  if (typeof giderId !== "string") return { hata: "Gider bulunamadı." };

  const gider = await prisma.gider.findUnique({
    where: { id: giderId },
    include: { vardiya: { select: { bitis: true } } },
  });
  if (!gider) return { hata: "Gider bulunamadı." };
  if (gider.vardiya.bitis) {
    return { hata: "Kapanmış vardiyanın gideri silinemez." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.gider.delete({ where: { id: giderId } });
    await islemGunluguYazTx(tx, {
      kullaniciId: kullanici.id,
      islemTipi: "GIDER_SILME",
      ilgiliKayitId: giderId,
      eskiDeger: {
        kategori: gider.kategori,
        tutar: sayiyaCevir(gider.tutar),
        odemeYontemi: gider.odemeYontemi,
        aciklama: gider.aciklama,
      },
      aciklama: `Gider silindi: ${sayiyaCevir(gider.tutar)} TL — ${gider.aciklama}`,
    });
  });

  revalidatePath("/giderler");
  revalidatePath("/vardiya");
  revalidatePath("/raporlar");
  return { basarili: true };
}

/** Bir vardiyanın gider toplamları. */
export async function vardiyaGiderleri(vardiyaId: string) {
  const [gruplar, kayitlar] = await Promise.all([
    prisma.gider.groupBy({
      by: ["odemeYontemi"],
      where: { vardiyaId },
      _sum: { tutar: true },
    }),
    prisma.gider.findMany({
      where: { vardiyaId },
      include: { kullanici: { select: { adSoyad: true } } },
      orderBy: { zaman: "desc" },
    }),
  ]);

  const topla = (yontem: "NAKIT" | "KART") =>
    sayiyaCevir(gruplar.find((g) => g.odemeYontemi === yontem)?._sum.tutar);

  const nakit = topla("NAKIT");
  const kart = topla("KART");

  return { nakitGider: nakit, kartGider: kart, toplamGider: nakit + kart, kayitlar };
}
