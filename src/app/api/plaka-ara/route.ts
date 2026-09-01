import { NextResponse } from "next/server";

import { araclarinAcikBorclari } from "@/lib/borc";
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

  // Araç bilgisi ve not aramaları büyük/küçük harf duyarsız.
  const metinKosulu = [
    { marka: { contains: ham, mode: "insensitive" as const } },
    { model: { contains: ham, mode: "insensitive" as const } },
    { renk: { contains: ham, mode: "insensitive" as const } },
    // Araca kalıcı olarak yazılmış not da aranır.
    { notlar: { contains: ham, mode: "insensitive" as const } },
  ];

  /**
   * Eşleşen araçlar ÖNCE ayrı bir sorguyla bulunur.
   *
   * Bu koşullar doğrudan `{ arac: { ... } }` biçiminde yazılırsa Prisma
   * ParkKaydi ile Arac'ı JOIN'liyor ve OR koşulu iki tabloya yayıldığı için
   * PostgreSQL hiçbir indeksi kullanamıyor: her aramada tüm park kayıtları
   * taranıyordu (55 bin kayıtta ~110 ms, kayıt sayısıyla doğrusal büyüyor).
   *
   * İkiye bölününce her iki sorgu da tek tablo üzerinde kalıyor ve trigram
   * (GIN) indeksleri devreye giriyor — tam plaka araması ~110 ms'den ~4 ms'ye
   * düşüyor. Sonuçlar birebir aynı; değişen yalnızca sorgunun şekli.
   */
  const eslesenAraclar = await prisma.arac.findMany({
    where: { OR: metinKosulu },
    select: { id: true },
  });

  const kayitlar = await prisma.parkKaydi.findMany({
    where: {
      durum: yalnizIceride ? "ICERIDE" : { not: "IPTAL" },
      OR: [
        { plaka: { contains: terim } },
        ...metinKosulu,
        ...(eslesenAraclar.length
          ? [{ aracId: { in: eslesenAraclar.map((arac) => arac.id) } }]
          : []),
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
      aracId: true,
      borcKalan: true,
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

  const gosterilecekler = sirali.slice(0, adet);
  // Araç bazlı açık borç: satırın kendi borcu değil, aracın TOPLAM borcu.
  // İçerideki bir araç için "önceki gelişinden borcu var" bilgisi ancak
  // böyle görünür.
  const aracBorclari = await araclarinAcikBorclari(
    gosterilecekler.flatMap((kayit) => (kayit.aracId ? [kayit.aracId] : [])),
  );

  return NextResponse.json({
    toplam: sirali.length,
    sonuclar: gosterilecekler.map((kayit) => ({
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
      /** Bu kaydın çıkışından kalan borç. */
      borcKalan: Number(kayit.borcKalan),
      /** Aracın tüm çıkışlarından kalan toplam borç. */
      aracBorcu: kayit.aracId ? (aracBorclari.get(kayit.aracId) ?? 0) : 0,
      fisNo: kayit.fisNo,
      notlar: kayit.notlar ?? kayit.arac?.notlar ?? null,
      marka: kayit.marka ?? kayit.arac?.marka ?? null,
      model: kayit.model ?? kayit.arac?.model ?? null,
      renk: kayit.renk ?? kayit.arac?.renk ?? null,
    })),
  });
}
