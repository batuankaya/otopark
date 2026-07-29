import { NextResponse } from "next/server";

import { normalizeAramaTerimi } from "@/lib/plaka";
import { prisma } from "@/lib/prisma";
import { oturumAl } from "@/lib/yetki";

/**
 * Plaka araması — kısmi eşleşme destekler.
 *
 * Görevli "26" (il kodu), "159" (son 3 hane), "26ABC" ya da araç bilgisiyle
 * ("şahin", "beyaz", "anahtar bizde") arayabilir.
 * Arama `contains` ile yapılır ki her ikisi de bulunsun; sonuçlar sonra
 * anlamlı bir sıraya konur:
 *
 *   1. İçeridekiler (çıkış işlemi yalnızca onlara yapılabilir)
 *   2. Terimle BAŞLAYANLAR — "26" yazınca 26 ile başlayan plakalar üstte
 *   3. Eşleşmenin plakada geçtiği konum (baştakiler önce)
 *   4. En yeni giriş
 *
 * KVKK: plaka kişisel veridir — uç nokta oturum ister.
 */
export async function GET(istek: Request) {
  const kullanici = await oturumAl();
  if (!kullanici) {
    return NextResponse.json({ hata: "Yetkisiz." }, { status: 401 });
  }

  const url = new URL(istek.url);
  const ham = (url.searchParams.get("q") ?? "").trim();
  // Plaka araması normalize edilmiş biçimde (boşluksuz, büyük harf) yapılır;
  // marka/model/not aramasında kullanıcının yazdığı hâl kullanılır.
  const terim = normalizeAramaTerimi(ham);
  const yalnizIceride = url.searchParams.get("iceride") === "1";
  const adet = Math.min(Number(url.searchParams.get("adet") ?? 20) || 20, 50);

  // Tek karakterle arama yapılmaz: neredeyse tüm kayıtlar dönerdi.
  if (ham.length < 2) {
    return NextResponse.json({ sonuclar: [], ipucu: "En az 2 karakter girin." });
  }

  const kayitlar = await prisma.parkKaydi.findMany({
    where: {
      durum: yalnizIceride ? "ICERIDE" : { not: "IPTAL" },
      OR: [
        { plaka: { contains: terim } },
        // Araç bilgisi ve not aramaları büyük/küçük harf duyarsız.
        { marka: { contains: ham, mode: "insensitive" } },
        { model: { contains: ham, mode: "insensitive" } },
        { renk: { contains: ham, mode: "insensitive" } },
        { notlar: { contains: ham, mode: "insensitive" } },
        { arac: { marka: { contains: ham, mode: "insensitive" } } },
        { arac: { model: { contains: ham, mode: "insensitive" } } },
        { arac: { renk: { contains: ham, mode: "insensitive" } } },
        // Araca kalıcı olarak yazılmış not da aranır.
        { arac: { notlar: { contains: ham, mode: "insensitive" } } },
      ],
    },
    orderBy: { girisZamani: "desc" },
    take: adet * 3, // sıralama sonrası kırpılacak
    select: {
      id: true,
      plaka: true,
      plakaGosterim: true,
      yabanciPlaka: true,
      ulkeKodu: true,
      marka: true,
      model: true,
      renk: true,
      notlar: true,
      fisNo: true,
      girisZamani: true,
      cikisZamani: true,
      durum: true,
      tarifeTuru: true,
      tahsilEdilenUcret: true,
      odemeYontemi: true,
      arac: { select: { marka: true, model: true, renk: true, notlar: true } },
    },
  });

  const sirali = [...kayitlar].sort((a, b) => {
    // 1) İçeridekiler üstte
    const aIceride = a.durum === "ICERIDE" ? 0 : 1;
    const bIceride = b.durum === "ICERIDE" ? 0 : 1;
    if (aIceride !== bIceride) return aIceride - bIceride;

    // 2) Plakada eşleşenler, yalnızca araç bilgisi/notta eşleşenlerden önce;
    //    plaka içinde de terimle BAŞLAYANLAR öne alınır ("26" → 26 ile
    //    başlayan plakalar). Eşleşme plakada değilse en sona düşer.
    const konum = (p: string | null) => {
      if (!p) return 999;
      const i = p.indexOf(terim);
      return i < 0 ? 999 : i;
    };
    const aKonum = konum(a.plaka);
    const bKonum = konum(b.plaka);
    if (aKonum !== bKonum) return aKonum - bKonum;

    // 3) En yeni giriş
    return b.girisZamani.getTime() - a.girisZamani.getTime();
  });

  return NextResponse.json({
    toplam: sirali.length,
    sonuclar: sirali.slice(0, adet).map((kayit) => ({
      id: kayit.id,
      plaka: kayit.plaka,
      plakaGosterim: kayit.plakaGosterim,
      yabanciPlaka: kayit.yabanciPlaka,
      ulkeKodu: kayit.ulkeKodu,
      girisZamani: kayit.girisZamani.toISOString(),
      cikisZamani: kayit.cikisZamani?.toISOString() ?? null,
      durum: kayit.durum,
      tarifeTuru: kayit.tarifeTuru,
      tahsilEdilenUcret: kayit.tahsilEdilenUcret ? Number(kayit.tahsilEdilenUcret) : null,
      odemeYontemi: kayit.odemeYontemi,
      fisNo: kayit.fisNo,
      notlar: kayit.notlar ?? kayit.arac?.notlar ?? null,
      marka: kayit.marka ?? kayit.arac?.marka ?? null,
      model: kayit.model ?? kayit.arac?.model ?? null,
      renk: kayit.renk ?? kayit.arac?.renk ?? null,
    })),
  });
}
