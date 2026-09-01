import Link from "next/link";
import type { Metadata } from "next";

import { AracCikisAkisi } from "@/components/arac-cikis-akisi";
import { araclarinAcikBorclari } from "@/lib/borc";
import { prisma } from "@/lib/prisma";
import { acikVardiyayiBul, oturumZorunlu } from "@/lib/yetki";

export const metadata: Metadata = { title: "Araç Çıkışı" };
export const dynamic = "force-dynamic";

export default async function AracCikisiSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ kayit?: string }>;
}) {
  const { kayit } = await searchParams;
  await oturumZorunlu(); // oturum ve hesap geçerliliği kontrolü
  const acikVardiya = await acikVardiyayiBul();

  if (!acikVardiya) {
    return (
      <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-5">
        <h1 className="text-xl font-bold text-amber-900">Otoparkta açık vardiya yok</h1>
        <p className="mt-2 text-base text-amber-900">
          Tahsil edilen para bir kasaya yazılmak zorunda. Vardiya ortaktır: bir görevli
          açtığında diğerleri de aynı kasaya işlem yapar.
        </p>
        <Link
          href="/vardiya"
          className="mt-4 flex min-h-14 items-center justify-center rounded-lg bg-amber-600 text-lg font-bold text-white hover:bg-amber-700"
        >
          VARDİYA AÇ
        </Link>
      </div>
    );
  }

  // Ekran açılır açılmaz içerideki araçlar listelensin: görevli çoğu zaman
  // hiç yazmadan doğrudan aracı seçip çıkışını yapabilsin diye.
  // En uzun süredir içeride olan üstte (çıkma ihtimali en yüksek olan).
  const icerdekiler = await prisma.parkKaydi.findMany({
    where: { durum: "ICERIDE" },
    orderBy: { girisZamani: "asc" },
    take: 60,
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
      aracId: true,
      arac: { select: { marka: true, model: true, renk: true, notlar: true } },
    },
  });

  // İçerideki araçların önceki gelişlerinden kalan borcu listede görünsün.
  const aracBorclari = await araclarinAcikBorclari(
    icerdekiler.flatMap((k) => (k.aracId ? [k.aracId] : [])),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-neutral-900">Araç Çıkışı</h1>
      <AracCikisAkisi
        baslangicKaydiId={kayit}
        icerdekiler={icerdekiler.map((k) => ({
          id: k.id,
          plaka: k.plaka,
          plakaGosterim: k.plakaGosterim,
          yabanciPlaka: k.yabanciPlaka,
          ulkeKodu: k.ulkeKodu,
          girisZamani: k.girisZamani.toISOString(),
          cikisZamani: k.cikisZamani?.toISOString() ?? null,
          durum: k.durum,
          fisNo: k.fisNo,
          notlar: k.notlar ?? k.arac?.notlar ?? null,
          marka: k.marka ?? k.arac?.marka ?? null,
          model: k.model ?? k.arac?.model ?? null,
          renk: k.renk ?? k.arac?.renk ?? null,
          aracBorcu: k.aracId ? (aracBorclari.get(k.aracId) ?? 0) : 0,
        }))}
      />
    </div>
  );
}
