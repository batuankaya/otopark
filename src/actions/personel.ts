"use server";

import { revalidatePath } from "next/cache";

import { islemGunluguYazTx } from "@/lib/gunluk";
import { prisma } from "@/lib/prisma";
import { bugununSaati, formatlaSaat } from "@/lib/tarih";
import { formVerisiniAl, hatalariTopla, personelSaatSemasi } from "@/lib/validasyon";
import type { AlanHatalari } from "@/lib/validasyon";
import { oturumAl } from "@/lib/yetki";

export type PersonelDurumu = {
  basarili?: boolean;
  hata?: string;
  alanHatalari?: AlanHatalari;
};

/**
 * Geliş saatini düzeltir (yalnızca ADMIN).
 *
 * Otomatik kayıt girişin yapıldığı andır; çalışan 10:00'da gelip 10:15'te
 * giriş yaptıysa gerçek saat farklıdır. Düzeltme orijinal değerle birlikte
 * işlem günlüğüne yazılır — mesai kaydı özlük/ücret konusu olduğu için
 * kimin ne zaman değiştirdiği izlenebilir olmalı.
 */
export async function gelisSaatiniDuzelt(
  _onceki: PersonelDurumu,
  formData: FormData,
): Promise<PersonelDurumu> {
  const kullanici = await oturumAl();
  if (!kullanici) return { hata: "Oturumunuz sonlanmış." };
  if (kullanici.rol !== "ADMIN") {
    return { hata: "Geliş saatini yalnızca yönetici düzeltebilir." };
  }

  const ayrisma = personelSaatSemasi.safeParse(formVerisiniAl(formData));
  if (!ayrisma.success) return { alanHatalari: hatalariTopla(ayrisma.error) };
  const { kayitId, saat } = ayrisma.data;

  const kayit = await prisma.personelGiris.findUnique({
    where: { id: kayitId },
    include: { kullanici: { select: { adSoyad: true } } },
  });
  if (!kayit) return { hata: "Kayıt bulunamadı." };

  // Saat, kaydın kendi gününe uygulanır — bugüne değil. Yönetici geçmiş bir
  // günün saatini de düzeltebilir.
  const yeniZaman = bugununSaati(saat, kayit.gun);
  if (!yeniZaman) return { alanHatalari: { saat: "Saat geçersiz. Örnek: 08:30" } };

  await prisma.$transaction(async (tx) => {
    await tx.personelGiris.update({
      where: { id: kayitId },
      data: {
        gelisZamani: yeniZaman,
        duzeltenId: kullanici.id,
        // Orijinal değer yalnızca ilk düzeltmede saklanır; sonraki
        // düzeltmelerde ilk otomatik kayıt kaybolmasın.
        duzeltilenEski: kayit.duzeltilenEski ?? kayit.gelisZamani,
      },
    });

    await islemGunluguYazTx(tx, {
      kullaniciId: kullanici.id,
      islemTipi: "KULLANICI_DEGISIKLIGI",
      ilgiliKayitId: kayitId,
      eskiDeger: { gelisZamani: kayit.gelisZamani.toISOString() },
      yeniDeger: { gelisZamani: yeniZaman.toISOString() },
      aciklama:
        `${kayit.kullanici.adSoyad} geliş saati düzeltildi: ` +
        `${formatlaSaat(kayit.gelisZamani)} → ${saat}`,
    });
  });

  revalidatePath("/raporlar");
  return { basarili: true };
}
