"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { islemGunluguYazTx } from "@/lib/gunluk";
import { prisma } from "@/lib/prisma";
import { sayiyaCevir } from "@/lib/para";
import {
  abonmanSemasi,
  formVerisiniAl,
  hatalariTopla,
  type AlanHatalari,
} from "@/lib/validasyon";
import { oturumAl } from "@/lib/yetki";

export type AbonmanDurumuSonucu = {
  basarili?: boolean;
  hata?: string;
  alanHatalari?: AlanHatalari;
  abonmanId?: string;
};

/**
 * Abonman ekler veya günceller. Plaka ile araç eşleştirilir; araç yoksa
 * oluşturulur (henüz otoparka hiç gelmemiş bir araca abonman tanımlanabilsin).
 */
export async function abonmanKaydet(
  _onceki: AbonmanDurumuSonucu,
  formData: FormData,
): Promise<AbonmanDurumuSonucu> {
  const kullanici = await oturumAl();
  if (!kullanici) return { hata: "Oturumunuz sonlanmış." };

  const veriler = formVerisiniAl(formData);
  const abonmanId = typeof veriler.abonmanId === "string" ? veriler.abonmanId : undefined;

  const ayrisma = abonmanSemasi.safeParse(veriler);
  if (!ayrisma.success) return { alanHatalari: hatalariTopla(ayrisma.error) };
  const veri = ayrisma.data;

  try {
    const sonuc = await prisma.$transaction(async (tx) => {
      const arac = await tx.arac.upsert({
        where: { plaka: veri.plaka },
        create: {
          plaka: veri.plaka,
          plakaGosterim: veri.plakaGosterim,
          yabanciPlaka: veri.yabanciPlaka,
          ulkeKodu: veri.ulkeKodu,
        },
        update: {
          plakaGosterim: veri.plakaGosterim,
          yabanciPlaka: veri.yabanciPlaka,
          ...(veri.ulkeKodu ? { ulkeKodu: veri.ulkeKodu } : {}),
        },
      });

      // Aynı araca çakışan tarihlerde ikinci bir aktif abonman olmasın.
      const cakisan = await tx.abonman.findFirst({
        where: {
          aracId: arac.id,
          durum: "AKTIF",
          ...(abonmanId ? { id: { not: abonmanId } } : {}),
          baslangicTarihi: { lte: veri.bitisTarihi },
          bitisTarihi: { gte: veri.baslangicTarihi },
        },
      });
      if (cakisan && veri.durum === "AKTIF") {
        throw new Error("CAKISAN_ABONMAN");
      }

      const veriGovdesi = {
        aracId: arac.id,
        musteriAdi: veri.musteriAdi,
        telefon: veri.telefon ?? null,
        baslangicTarihi: veri.baslangicTarihi,
        bitisTarihi: veri.bitisTarihi,
        aylikUcret: new Prisma.Decimal(veri.aylikUcret),
        durum: veri.durum,
        notlar: veri.notlar ?? null,
      };

      if (abonmanId) {
        const eski = await tx.abonman.findUnique({ where: { id: abonmanId } });
        if (!eski) throw new Error("BULUNAMADI");

        const guncel = await tx.abonman.update({
          where: { id: abonmanId },
          data: veriGovdesi,
        });

        await islemGunluguYazTx(tx, {
          kullaniciId: kullanici.id,
          islemTipi: "ABONMAN_DEGISIKLIGI",
          ilgiliKayitId: abonmanId,
          eskiDeger: {
            musteriAdi: eski.musteriAdi,
            bitisTarihi: eski.bitisTarihi.toISOString(),
            aylikUcret: sayiyaCevir(eski.aylikUcret),
            durum: eski.durum,
          },
          yeniDeger: {
            musteriAdi: guncel.musteriAdi,
            bitisTarihi: guncel.bitisTarihi.toISOString(),
            aylikUcret: veri.aylikUcret,
            durum: guncel.durum,
          },
          aciklama: `${veri.plakaGosterim} abonmanı güncellendi`,
        });

        return guncel;
      }

      const yeni = await tx.abonman.create({ data: veriGovdesi });

      await islemGunluguYazTx(tx, {
        kullaniciId: kullanici.id,
        islemTipi: "ABONMAN_DEGISIKLIGI",
        ilgiliKayitId: yeni.id,
        yeniDeger: {
          plaka: veri.plaka,
          musteriAdi: veri.musteriAdi,
          bitisTarihi: veri.bitisTarihi.toISOString(),
          aylikUcret: veri.aylikUcret,
        },
        aciklama: `${veri.plakaGosterim} için abonman oluşturuldu`,
      });

      return yeni;
    });

    revalidatePath("/abonman");
    revalidatePath("/");
    return { basarili: true, abonmanId: sonuc.id };
  } catch (hata) {
    if (hata instanceof Error && hata.message === "CAKISAN_ABONMAN") {
      return { hata: "Bu araç için seçilen tarih aralığında zaten aktif bir abonman var." };
    }
    if (hata instanceof Error && hata.message === "BULUNAMADI") {
      return { hata: "Abonman bulunamadı." };
    }
    console.error("Abonman kaydedilemedi:", hata);
    return { hata: "Abonman kaydedilemedi. Lütfen tekrar deneyin." };
  }
}

/** Abonmanı iptal eder (silinmez — geçmiş park kayıtları ona bağlı). */
export async function abonmanIptalEt(
  _onceki: AbonmanDurumuSonucu,
  formData: FormData,
): Promise<AbonmanDurumuSonucu> {
  const kullanici = await oturumAl();
  if (!kullanici) return { hata: "Oturumunuz sonlanmış." };

  const abonmanId = formData.get("abonmanId");
  if (typeof abonmanId !== "string") return { hata: "Abonman bulunamadı." };

  const abonman = await prisma.abonman.findUnique({
    where: { id: abonmanId },
    include: { arac: { select: { plaka: true, plakaGosterim: true } } },
  });
  if (!abonman) return { hata: "Abonman bulunamadı." };

  await prisma.$transaction(async (tx) => {
    await tx.abonman.update({ where: { id: abonmanId }, data: { durum: "IPTAL" } });
    await islemGunluguYazTx(tx, {
      kullaniciId: kullanici.id,
      islemTipi: "ABONMAN_DEGISIKLIGI",
      ilgiliKayitId: abonmanId,
      eskiDeger: { durum: abonman.durum },
      yeniDeger: { durum: "IPTAL" },
      aciklama: `${abonman.arac.plakaGosterim ?? abonman.arac.plaka} abonmanı iptal edildi`,
    });
  });

  revalidatePath("/abonman");
  return { basarili: true };
}

/**
 * Süresi geçmiş AKTIF abonmanları SURESI_DOLDU'ya çeker.
 * Abonman listesi açıldığında çağrılır — ayrı bir zamanlanmış göreve
 * ihtiyaç kalmasın diye.
 */
export async function suresiDolanlariIsaretle(): Promise<number> {
  const sonuc = await prisma.abonman.updateMany({
    where: { durum: "AKTIF", bitisTarihi: { lt: new Date() } },
    data: { durum: "SURESI_DOLDU" },
  });
  return sonuc.count;
}
