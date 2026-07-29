import { NextResponse } from "next/server";

import { cozPlaka } from "@/lib/plaka";
import { prisma } from "@/lib/prisma";
import { oturumAl } from "@/lib/yetki";

/**
 * Araç girişinde plaka yazılırken çağrılır: araç daha önce geldiyse
 * marka/model/renk bilgisi forma otomatik dolar ve içeride olup olmadığı
 * anında görünür — görevli kaydetmeye basmadan uyarılır.
 */
export async function GET(istek: Request) {
  const kullanici = await oturumAl();
  if (!kullanici) {
    return NextResponse.json({ hata: "Yetkisiz." }, { status: 401 });
  }

  const url = new URL(istek.url);
  const yabanci = url.searchParams.get("yabanci") === "1";
  const cozum = cozPlaka(url.searchParams.get("plaka") ?? "", yabanci);
  if (!cozum.gecerli) {
    return NextResponse.json({ bulundu: false });
  }

  const arac = await prisma.arac.findUnique({
    where: { plaka: cozum.deger.plaka },
    select: {
      id: true,
      marka: true,
      model: true,
      renk: true,
      notlar: true,
      yabanciPlaka: true,
      ulkeKodu: true,
      parkKayitlari: {
        where: { durum: "ICERIDE" },
        select: { id: true, girisZamani: true, parkAlaniAd: true },
        take: 1,
      },
    },
  });

  if (!arac) return NextResponse.json({ bulundu: false });

  const icerideKayit = arac.parkKayitlari[0] ?? null;

  return NextResponse.json({
    bulundu: true,
    marka: arac.marka,
    model: arac.model,
    renk: arac.renk,
    // Aracın kalıcı notu — önceki girişte yazılmışsa forma otomatik dolar.
    notlar: arac.notlar,
    yabanciPlaka: arac.yabanciPlaka,
    ulkeKodu: arac.ulkeKodu,
    iceride: icerideKayit
      ? {
          kayitId: icerideKayit.id,
          girisZamani: icerideKayit.girisZamani.toISOString(),
          parkAlaniAd: icerideKayit.parkAlaniAd,
        }
      : null,
  });
}
