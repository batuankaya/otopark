import Link from "next/link";
import type { Metadata } from "next";

import { VardiyaAcFormu, VardiyaKapatFormu } from "@/components/vardiya-formlari";
import { vardiyaOzetiHesapla } from "@/actions/vardiya";
import { formatlaPara, sayiyaCevir } from "@/lib/para";
import { prisma } from "@/lib/prisma";
import { formatlaTarihSaat, sureMetni } from "@/lib/tarih";
import { acikVardiyayiBul, oturumZorunlu } from "@/lib/yetki";

export const metadata: Metadata = { title: "Vardiya" };
export const dynamic = "force-dynamic";

export default async function VardiyaSayfasi() {
  const kullanici = await oturumZorunlu();
  const acikVardiya = await acikVardiyayiBul();

  const [ozet, gecmisVardiyalar] = await Promise.all([
    acikVardiya ? vardiyaOzetiHesapla(acikVardiya.id) : null,
    prisma.vardiya.findMany({
      // Vardiya ortak kasa olduğu için geçmiş vardiyaları herkes görür.
      where: { bitis: { not: null } },
      include: {
        kullanici: { select: { adSoyad: true } },
        kapatan: { select: { adSoyad: true } },
      },
      orderBy: { baslangic: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-neutral-900">Vardiya</h1>

      {acikVardiya && ozet ? (
        <>
          {/* Açık vardiya özeti */}
          <section className="rounded-xl border-2 border-green-600 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-800">
                VARDİYA AÇIK
              </span>
              <span className="text-sm font-semibold text-neutral-600">
                {sureMetni(acikVardiya.baslangic)}
              </span>
            </div>

            <p className="mt-2 text-sm text-neutral-600">
              {formatlaTarihSaat(acikVardiya.baslangic)} ·{" "}
              <span className="font-semibold">{acikVardiya.kullanici.adSoyad}</span> açtı
            </p>
            {acikVardiya.kullaniciId !== kullanici.id && (
              <p className="mt-1 text-sm text-neutral-600">
                Bu ortak kasadır — işlemleriniz bu vardiyaya yazılır, ayrıca vardiya açmanıza
                gerek yok.
              </p>
            )}

            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-neutral-200 pt-3">
              <Kutu etiket="Açılış kasası" deger={formatlaPara(ozet.acilisKasa)} />
              <Kutu etiket="Nakit tahsilat" deger={formatlaPara(ozet.toplamNakit)} vurgu="yesil" />
              <Kutu etiket="Kart tahsilat" deger={formatlaPara(ozet.toplamKart)} />
              <Kutu
                etiket="Kasada olması gereken"
                deger={formatlaPara(ozet.beklenenKasa)}
                vurgu="mavi"
              />
              <Kutu etiket="Nakit gider" deger={`−${formatlaPara(ozet.nakitGider)}`} vurgu="kirmizi" />
              <Kutu etiket="Kart gider" deger={`−${formatlaPara(ozet.kartGider)}`} />
              <Kutu etiket="Giriş yapılan" deger={`${ozet.girisSayisi} araç`} />
              <Kutu etiket="Çıkış yapılan" deger={`${ozet.cikisSayisi} araç`} />
            </dl>
          </section>

          <VardiyaKapatFormu
            vardiyaId={acikVardiya.id}
            beklenenKasa={ozet.beklenenKasa}
            toplamNakit={ozet.toplamNakit}
            toplamKart={ozet.toplamKart}
            acilisKasa={ozet.acilisKasa}
            nakitGider={ozet.nakitGider}
            kartGider={ozet.kartGider}
          />
        </>
      ) : (
        <>
          <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4">
            <p className="text-lg font-bold text-amber-900">Otoparkta açık vardiya yok</p>
            <p className="mt-1 text-base text-amber-900">
              Araç giriş ve çıkış işlemleri yapabilmek için vardiya açılmalı. Vardiya ortaktır:
              siz açtığınızda diğer görevliler de aynı kasaya işlem yapar.
            </p>
          </div>
          <VardiyaAcFormu />
        </>
      )}

      {/* Geçmiş vardiyalar */}
      <section className="rounded-xl border border-neutral-300 bg-white">
        <h2 className="border-b border-neutral-200 px-4 py-3 text-base font-bold text-neutral-900">
          Geçmiş vardiyalar
        </h2>

        {gecmisVardiyalar.length === 0 ? (
          <p className="px-4 py-6 text-center text-neutral-600">Kapanmış vardiya yok.</p>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {gecmisVardiyalar.map((vardiya) => {
              const fark = sayiyaCevir(vardiya.fark);
              return (
                <li key={vardiya.id}>
                  <Link
                    href={`/vardiya/${vardiya.id}/rapor`}
                    className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-neutral-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-neutral-900">
                        {formatlaTarihSaat(vardiya.baslangic)}
                      </div>
                      <div className="truncate text-sm text-neutral-600">
                        {vardiya.kullanici.adSoyad}
                        {vardiya.kapatan && vardiya.kapatan.adSoyad !== vardiya.kullanici.adSoyad
                          ? ` → ${vardiya.kapatan.adSoyad}`
                          : ""}{" "}
                        · {sureMetni(vardiya.baslangic, vardiya.bitis!)}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="font-bold tabular-nums text-neutral-900">
                        {formatlaPara(sayiyaCevir(vardiya.toplamNakit) + sayiyaCevir(vardiya.toplamKart))}
                      </div>
                      {fark !== 0 && (
                        <div
                          className={`text-sm font-bold tabular-nums ${
                            fark < 0 ? "text-red-700" : "text-amber-700"
                          }`}
                        >
                          {fark > 0 ? "+" : ""}
                          {formatlaPara(fark)}
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kutu({
  etiket,
  deger,
  vurgu,
}: {
  etiket: string;
  deger: string;
  vurgu?: "yesil" | "mavi" | "kirmizi";
}) {
  const renk =
    vurgu === "yesil"
      ? "text-green-700"
      : vurgu === "mavi"
        ? "text-blue-800"
        : vurgu === "kirmizi"
          ? "text-red-700"
          : "text-neutral-900";
  return (
    <div>
      <dt className="text-sm text-neutral-600">{etiket}</dt>
      <dd className={`text-xl font-bold tabular-nums ${renk}`}>{deger}</dd>
    </div>
  );
}
