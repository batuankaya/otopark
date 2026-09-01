import Link from "next/link";
import type { Metadata } from "next";

import { VardiyaAcFormu, VardiyaKapatFormu } from "@/components/vardiya-formlari";
import { vardiyaOzetiHesapla } from "@/lib/vardiya-ozet";
import { formatlaPara, sayiyaCevir } from "@/lib/para";
import { prisma } from "@/lib/prisma";
import { formatlaTarihSaat, sonrakiVardiyaSifirlamasi, sureMetni } from "@/lib/tarih";
import { sifirlamaSaatiniAl } from "@/lib/vardiya-sifirlama";
import { acikVardiyayiBul, oturumZorunlu } from "@/lib/yetki";

export const metadata: Metadata = { title: "Vardiya" };
export const dynamic = "force-dynamic";

export default async function VardiyaSayfasi() {
  const kullanici = await oturumZorunlu();
  const acikVardiya = await acikVardiyayiBul();

  const [ozet, gecmisVardiyalar, sifirlamaSaati] = await Promise.all([
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
    sifirlamaSaatiniAl(),
  ]);

  const sonrakiSifirlama = sonrakiVardiyaSifirlamasi(sifirlamaSaati);
  const sifirlamaSaatiMetni = `${String(sifirlamaSaati).padStart(2, "0")}:00`;

  /**
   * Yeni vardiya açarken önerilecek başlangıç nakiti.
   *
   * Sıfırlama saatinde vardiya kapanır ama yenisi AÇILMAZ — onu sabah gelen
   * görevli açar (bkz. lib/vardiya-sifirlama.ts). Dolayısıyla kasa devri
   * artık otomatik değil: görevli kasayı sayıp tutarı kendisi giriyor.
   *
   * Önceki vardiyada kasada kalması gereken tutar öneri olarak gösterilir.
   * Elle kapatılmış vardiyada sayılan tutar (kapanisKasa), otomatik
   * kapanmışta hesaplanan beklenen tutar esas alınır. Öneri sadece
   * kolaylıktır — görevli saydığı rakamı yazar, fark oradan doğar.
   */
  const sonKapanan = acikVardiya
    ? null
    : ((gecmisVardiyalar[0] ?? null) as (typeof gecmisVardiyalar)[number] | null);

  const onerilenKasa = sonKapanan
    ? sonKapanan.kapanisKasa !== null
      ? sayiyaCevir(sonKapanan.kapanisKasa)
      : (await vardiyaOzetiHesapla(sonKapanan.id)).beklenenKasa
    : null;

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

            {/* Görevli, vardiyanın kendiliğinden kapanacağını önceden bilsin. */}
            <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900">
              Vardiya her gün {sifirlamaSaatiMetni}&apos;de otomatik sıfırlanır. Sonraki
              sıfırlama: {formatlaTarihSaat(sonrakiSifirlama)} ({sureMetni(new Date(), sonrakiSifirlama)}{" "}
              sonra) — kasa devreder, para kasada kalır.
            </p>

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
              {/* Borç kalemleri yalnızca varsa gösterilir: her vardiyada
                  olmayan bir durum için kasa özetini şişirmeye gerek yok. */}
              {ozet.tahsilEdilenBorc > 0 && (
                <Kutu
                  etiket="Eski borç tahsilatı"
                  deger={formatlaPara(ozet.tahsilEdilenBorc)}
                  vurgu="yesil"
                />
              )}
              {ozet.olusanBorc > 0 && (
                <Kutu
                  etiket={`Ödemeden çıkan (${ozet.borcluCikisSayisi} araç)`}
                  deger={formatlaPara(ozet.olusanBorc)}
                  vurgu="kirmizi"
                />
              )}
            </dl>

            {ozet.tahsilEdilenBorc > 0 && (
              <p className="mt-2 text-sm text-neutral-600">
                Eski borç tahsilatı nakit/kart toplamlarının içindedir — para bu vardiyada
                kasaya girmiştir.
              </p>
            )}
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
          <VardiyaAcFormu onerilenKasa={onerilenKasa} />
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
                        {/* Otomatik kapanışta kasa sayılmaz; fark hesabı olmadığı
                            için bu vardiyalar elle kapatılanlarla karıştırılmamalı. */}
                        {vardiya.otomatikKapanis && (
                          <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-bold text-neutral-700">
                            OTOMATİK · kasa sayılmadı
                          </span>
                        )}
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
