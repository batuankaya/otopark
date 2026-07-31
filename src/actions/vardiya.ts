"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { islemGunluguYazTx } from "@/lib/gunluk";
import { prisma } from "@/lib/prisma";
import { vardiyaOzetiHesapla } from "@/lib/vardiya-ozet";
import {
  formVerisiniAl,
  hatalariTopla,
  vardiyaAcSemasi,
  vardiyaKapatSemasi,
  type AlanHatalari,
} from "@/lib/validasyon";
import { acikVardiyayiBul, oturumAl } from "@/lib/yetki";

export type VardiyaDurumu = {
  basarili?: boolean;
  hata?: string;
  alanHatalari?: AlanHatalari;
  vardiyaId?: string;
};

// ---------------------------------------------------------------------------
// Vardiya aç
// ---------------------------------------------------------------------------

export async function vardiyaAc(
  _onceki: VardiyaDurumu,
  formData: FormData,
): Promise<VardiyaDurumu> {
  const kullanici = await oturumAl();
  if (!kullanici) return { hata: "Oturumunuz sonlanmış." };

  const ayrisma = vardiyaAcSemasi.safeParse(formVerisiniAl(formData));
  if (!ayrisma.success) return { alanHatalari: hatalariTopla(ayrisma.error) };

  // Vardiya otopark genelinde tektir: başkası açtıysa yenisi açılmaz,
  // görevli mevcut vardiyaya işlem yapmaya devam eder.
  const mevcut = await acikVardiyayiBul();
  if (mevcut) {
    const acan =
      mevcut.kullaniciId === kullanici.id ? "Sizin" : `${mevcut.kullanici.adSoyad} tarafından`;
    return {
      hata: `Otoparkta zaten açık bir vardiya var (${acan} açıldı). İşlem yapmak için yeni vardiya açmanıza gerek yok.`,
    };
  }

  try {
    const vardiya = await prisma.$transaction(async (tx) => {
      const yeni = await tx.vardiya.create({
        data: {
          kullaniciId: kullanici.id,
          acilisKasa: new Prisma.Decimal(ayrisma.data.acilisKasa),
          notlar: ayrisma.data.notlar,
        },
      });

      await islemGunluguYazTx(tx, {
        kullaniciId: kullanici.id,
        islemTipi: "VARDIYA_ACILIS",
        ilgiliKayitId: yeni.id,
        yeniDeger: { acilisKasa: ayrisma.data.acilisKasa },
        aciklama: `Vardiya açıldı — açılış kasası ${ayrisma.data.acilisKasa} TL`,
      });

      return yeni;
    });

    revalidatePath("/");
    revalidatePath("/vardiya");
    return { basarili: true, vardiyaId: vardiya.id };
  } catch (hata) {
    // Kısmi unique index: sistemde aynı anda tek açık vardiya olabilir.
    if (hata instanceof Prisma.PrismaClientKnownRequestError && hata.code === "P2002") {
      return { hata: "Vardiya az önce başka bir görevli tarafından açıldı." };
    }
    console.error("Vardiya açılamadı:", hata);
    return { hata: "Vardiya açılamadı. Lütfen tekrar deneyin." };
  }
}

// ---------------------------------------------------------------------------
// Vardiya kapat
// ---------------------------------------------------------------------------

export async function vardiyaKapat(
  _onceki: VardiyaDurumu,
  formData: FormData,
): Promise<VardiyaDurumu> {
  const kullanici = await oturumAl();
  if (!kullanici) return { hata: "Oturumunuz sonlanmış." };

  const ayrisma = vardiyaKapatSemasi.safeParse(formVerisiniAl(formData));
  if (!ayrisma.success) return { alanHatalari: hatalariTopla(ayrisma.error) };

  const { vardiyaId, kapanisKasa, notlar } = ayrisma.data;

  const vardiya = await prisma.vardiya.findUnique({ where: { id: vardiyaId } });
  if (!vardiya) return { hata: "Vardiya bulunamadı." };
  if (vardiya.bitis) return { hata: "Bu vardiya zaten kapatılmış." };

  // Vardiya ortak kasadır: açan görevli izinde olabilir, o yüzden kapatmayı
  // herkes yapabilir. Kimin kapattığı `kapatanId` ile kayda geçer.

  // Açık park kaydı uyarısı değil, bilgi amaçlı: araçlar bir sonraki
  // vardiyaya devreder, bu normal bir durumdur.
  const ozet = await vardiyaOzetiHesapla(vardiyaId);
  const fark = Math.round((kapanisKasa - ozet.beklenenKasa) * 100) / 100;

  await prisma.$transaction(async (tx) => {
    const guncelleme = await tx.vardiya.updateMany({
      where: { id: vardiyaId, bitis: null },
      data: {
        bitis: new Date(),
        kapatanId: kullanici.id,
        kapanisKasa: new Prisma.Decimal(kapanisKasa),
        toplamNakit: new Prisma.Decimal(ozet.toplamNakit),
        toplamKart: new Prisma.Decimal(ozet.toplamKart),
        fark: new Prisma.Decimal(fark),
        ...(notlar ? { notlar } : {}),
      },
    });

    if (guncelleme.count === 0) throw new Error("ZATEN_KAPALI");

    await islemGunluguYazTx(tx, {
      kullaniciId: kullanici.id,
      islemTipi: "VARDIYA_KAPANIS",
      ilgiliKayitId: vardiyaId,
      yeniDeger: {
        kapanisKasa,
        beklenenKasa: ozet.beklenenKasa,
        toplamNakit: ozet.toplamNakit,
        toplamKart: ozet.toplamKart,
        nakitGider: ozet.nakitGider,
        kartGider: ozet.kartGider,
        fark,
      },
      aciklama:
        `Vardiya kapatıldı — nakit ${ozet.toplamNakit} TL, kart ${ozet.toplamKart} TL, ` +
        `gider ${ozet.toplamGider} TL, fark ${fark} TL`,
    });
  });

  revalidatePath("/");
  revalidatePath("/vardiya");
  return { basarili: true, vardiyaId };
}
