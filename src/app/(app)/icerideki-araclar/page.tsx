import Link from "next/link";
import type { Metadata } from "next";

import { KayitIptalButonu } from "@/components/kayit-iptal-butonu";
import { PlakaGoster } from "@/components/plaka-goster";
import { prisma } from "@/lib/prisma";
import { dolulukAl } from "@/lib/sorgular";
import { aracEtiketi } from "@/lib/plaka";
import { turkceKarsilastir } from "@/lib/siralama";
import { formatlaTarihSaat, sureMetni, yirmiDortSaatiAstiMi } from "@/lib/tarih";
import { oturumZorunlu } from "@/lib/yetki";

export const metadata: Metadata = { title: "İçerideki Araçlar" };
export const dynamic = "force-dynamic";

type Siralama = "sure" | "plaka" | "yeni";

export default async function IcerdekiAraclarSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ sirala?: Siralama }>;
}) {
  const { sirala = "sure" } = await searchParams;
  const kullanici = await oturumZorunlu();

  const [kayitlar, doluluk] = await Promise.all([
    prisma.parkKaydi.findMany({
      where: { durum: "ICERIDE" },
      include: { arac: { select: { marka: true, model: true, renk: true, notlar: true } } },
    }),
    dolulukAl(),
  ]);

  // Sıralama: metinler Türkçe kurallarıyla karşılaştırılır.
  const sirali = [...kayitlar].sort((a, b) => {
    if (sirala === "plaka") return turkceKarsilastir(aracEtiketi(a), aracEtiketi(b));
    if (sirala === "yeni") return b.girisZamani.getTime() - a.girisZamani.getTime();
    // Varsayılan: en uzun süredir içeride olan başta
    return a.girisZamani.getTime() - b.girisZamani.getTime();
  });

  const uzunSureliSayisi = kayitlar.filter((k) => yirmiDortSaatiAstiMi(k.girisZamani)).length;

  const baglantiSinifi = (aktif: boolean) =>
    `flex min-h-12 items-center rounded-lg border-2 px-3 text-sm font-bold ${
      aktif ? "border-blue-700 bg-blue-700 text-white" : "border-neutral-300 bg-white text-neutral-800"
    }`;

  const filtreYolu = (yeniSirala: Siralama) =>
    yeniSirala === "sure" ? "/icerideki-araclar" : `/icerideki-araclar?sirala=${yeniSirala}`;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-neutral-900">İçerideki Araçlar</h1>
        <span className="text-sm font-semibold text-neutral-600">
          {kayitlar.length} araç / {doluluk.kapasite} kapasite
        </span>
      </div>

      {uzunSureliSayisi > 0 && (
        <p className="rounded-lg border-2 border-red-500 bg-red-50 px-4 py-3 font-semibold text-red-800">
          {uzunSureliSayisi} araç 24 saatten uzun süredir otoparkta.
        </p>
      )}

      {/* Sıralama */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-neutral-600">Sırala:</span>
        {(
          [
            { deger: "sure", etiket: "Park süresi" },
            { deger: "yeni", etiket: "En yeni" },
            { deger: "plaka", etiket: "Plaka" },
          ] as const
        ).map((secenek) => (
          <Link
            key={secenek.deger}
            href={filtreYolu(secenek.deger)}
            className={baglantiSinifi(sirala === secenek.deger)}
          >
            {secenek.etiket}
          </Link>
        ))}
      </div>

      {sirali.length === 0 ? (
        <p className="rounded-xl border border-neutral-300 bg-white px-4 py-10 text-center text-neutral-600">
          Otoparkta araç yok.
        </p>
      ) : (
        <ul className="space-y-2">
          {sirali.map((kayit) => {
            const uzunSureli = yirmiDortSaatiAstiMi(kayit.girisZamani);
            return (
              <li
                key={kayit.id}
                className={`rounded-xl border-2 bg-white p-4 ${
                  uzunSureli ? "border-red-500" : "border-neutral-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
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

                    <div className="mt-1.5 text-sm text-neutral-700">
                      {[
                        kayit.marka ?? kayit.arac?.marka,
                        kayit.model ?? kayit.arac?.model,
                        kayit.renk ?? kayit.arac?.renk,
                      ]
                        .filter(Boolean)
                        .join(" ") || "Araç bilgisi girilmemiş"}
                    </div>

                    <div className="mt-0.5 text-sm text-neutral-600">
                      {formatlaTarihSaat(kayit.girisZamani)}
                    </div>

                    {/* Kayda özel not yoksa aracın kalıcı notu gösterilir. */}
                    {(kayit.notlar ?? kayit.arac?.notlar) && (
                      <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-sm text-amber-900">
                        {kayit.notlar ?? kayit.arac?.notlar}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <div
                      className={`text-lg font-bold tabular-nums ${
                        uzunSureli ? "text-red-700" : "text-neutral-900"
                      }`}
                    >
                      {sureMetni(kayit.girisZamani)}
                    </div>
                    {uzunSureli && (
                      <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                        24 SAAT+
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/arac-cikisi?kayit=${kayit.id}`}
                    className="flex min-h-14 flex-1 items-center justify-center rounded-lg bg-blue-700 text-lg font-bold text-white hover:bg-blue-800"
                  >
                    ÇIKIŞ YAP
                  </Link>
                  <Link
                    href={`/kayit/${kayit.id}/duzenle`}
                    className="flex min-h-14 items-center justify-center rounded-lg border-2 border-neutral-300 px-4 font-semibold text-neutral-700"
                  >
                    Düzenle
                  </Link>
                  <Link
                    href={`/fis/${kayit.id}`}
                    className="flex min-h-14 items-center justify-center rounded-lg border-2 border-neutral-300 px-4 font-semibold text-neutral-700"
                  >
                    Fiş
                  </Link>
                  {kullanici.rol === "ADMIN" && <KayitIptalButonu parkKaydiId={kayit.id} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
