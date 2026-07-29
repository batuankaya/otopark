import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { KayitDuzenleFormu } from "@/components/kayit-duzenle-formu";
import { PlakaGoster } from "@/components/plaka-goster";
import { prisma } from "@/lib/prisma";
import { formatlaTarihSaat, saatGirdisiDegeri, sureMetni } from "@/lib/tarih";
import { oturumZorunlu } from "@/lib/yetki";

export const metadata: Metadata = { title: "Kaydı Düzenle" };
export const dynamic = "force-dynamic";

export default async function KayitDuzenleSayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await oturumZorunlu();
  const { id } = await params;

  const kayit = await prisma.parkKaydi.findUnique({
    where: { id },
    include: { arac: { select: { marka: true, model: true, renk: true, notlar: true } } },
  });

  if (!kayit) notFound();

  if (kayit.durum !== "ICERIDE") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-5">
          <h1 className="text-xl font-bold text-amber-900">Bu kayıt düzenlenemez</h1>
          <p className="mt-2 text-base text-amber-900">
            Yalnızca otoparkta bulunan araçların kaydı düzenlenebilir. Bu araç
            {kayit.durum === "CIKTI" ? " çıkış yapmış" : " iptal edilmiş"}.
          </p>
        </div>
        <Link
          href="/icerideki-araclar"
          className="flex min-h-14 items-center justify-center rounded-lg border-2 border-neutral-300 bg-white font-bold text-neutral-800"
        >
          İÇERİDEKİ ARAÇLARA DÖN
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-neutral-900">Kaydı Düzenle</h1>
        <Link
          href="/icerideki-araclar"
          className="min-h-12 rounded-lg border-2 border-neutral-300 px-3 py-3 text-sm font-semibold text-neutral-700"
        >
          Geri
        </Link>
      </div>

      <section className="rounded-xl border border-neutral-300 bg-white p-4">
        <PlakaGoster
          plaka={kayit.plaka}
          gosterim={kayit.plakaGosterim}
          yabanci={kayit.yabanciPlaka}
          ulkeKodu={kayit.ulkeKodu}
          marka={kayit.marka ?? kayit.arac?.marka}
          model={kayit.model ?? kayit.arac?.model}
          fisNo={kayit.fisNo}
          boyut="orta"
        />
        <p className="mt-2 text-sm text-neutral-600">
          Fiş #{kayit.fisNo} · Giriş {formatlaTarihSaat(kayit.girisZamani)} ·{" "}
          {sureMetni(kayit.girisZamani)} içeride
        </p>
      </section>

      <KayitDuzenleFormu
        kayit={{
          id: kayit.id,
          plaka: kayit.plaka,
          plakaGosterim: kayit.plakaGosterim,
          yabanciPlaka: kayit.yabanciPlaka,
          ulkeKodu: kayit.ulkeKodu,
          marka: kayit.marka ?? kayit.arac?.marka ?? null,
          model: kayit.model ?? kayit.arac?.model ?? null,
          renk: kayit.renk ?? kayit.arac?.renk ?? null,
          notlar: kayit.notlar ?? kayit.arac?.notlar ?? null,
          girisSaati: saatGirdisiDegeri(kayit.girisZamani),
        }}
      />
    </div>
  );
}
