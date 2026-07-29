import Link from "next/link";
import type { Metadata } from "next";

import { CiroGrafigi, DolulukGrafigi } from "@/components/rapor-grafikleri";
import { formatlaPara } from "@/lib/para";
import { GIDER_ETIKETLERI } from "@/lib/gider";
import {
  ciroOzeti,
  giderOzeti,
  gorevliPerformansi,
  gunlukSeri,
  saatlikDoluluk,
} from "@/lib/raporlar";
import { tarihAraligiOlustur } from "@/lib/tarih";
import { adminZorunlu } from "@/lib/yetki";

export const metadata: Metadata = { title: "Raporlar" };
export const dynamic = "force-dynamic";

type Donem = "bugun" | "hafta" | "ay";

export default async function RaporlarSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ donem?: Donem }>;
}) {
  await adminZorunlu();
  const { donem = "bugun" } = await searchParams;

  const aralik = tarihAraligiOlustur(donem);

  const [ozet, seri, saatler, gorevliler, giderler] = await Promise.all([
    ciroOzeti(aralik),
    gunlukSeri(aralik),
    saatlikDoluluk(aralik),
    gorevliPerformansi(aralik),
    giderOzeti(aralik),
  ]);

  const donemSinifi = (aktif: boolean) =>
    `flex min-h-12 flex-1 items-center justify-center rounded-lg border-2 text-base font-bold ${
      aktif ? "border-blue-700 bg-blue-700 text-white" : "border-neutral-300 bg-white text-neutral-800"
    }`;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-neutral-900">Raporlar</h1>

      {/* Dönem seçimi */}
      <div className="flex gap-2">
        <Link href="/raporlar?donem=bugun" className={donemSinifi(donem === "bugun")}>
          Bugün
        </Link>
        <Link href="/raporlar?donem=hafta" className={donemSinifi(donem === "hafta")}>
          Son 7 gün
        </Link>
        <Link href="/raporlar?donem=ay" className={donemSinifi(donem === "ay")}>
          Son 30 gün
        </Link>
      </div>

      {/* Ciro özeti */}
      <section className="grid grid-cols-2 gap-3">
        <Kart etiket="Toplam ciro" deger={formatlaPara(ozet.toplamCiro)} vurgu />
        <Kart etiket="Ortalama fiş" deger={formatlaPara(ozet.ortalamaFis)} />
        <Kart etiket="Nakit" deger={formatlaPara(ozet.nakit)} />
        <Kart etiket="Kart" deger={formatlaPara(ozet.kart)} />
        <Kart etiket="Giren araç" deger={String(ozet.girisSayisi)} />
        <Kart etiket="Çıkan araç" deger={String(ozet.cikisSayisi)} />
      </section>

      {/* Gider ve net kazanç */}
      <section className="grid grid-cols-2 gap-3">
        <Kart etiket="Toplam gider" deger={`−${formatlaPara(giderler.toplamGider)}`} />
        <Kart
          etiket="Net kazanç"
          deger={formatlaPara(ozet.toplamCiro - giderler.toplamGider)}
          vurgu
        />
      </section>

      {giderler.kategoriler.length > 0 && (
        <section className="rounded-xl border border-neutral-300 bg-white p-4">
          <h2 className="text-base font-bold text-neutral-900">Giderler</h2>
          <ul className="mt-2 space-y-1.5">
            {giderler.kategoriler.map((k) => (
              <li key={k.kategori} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-neutral-700">
                  {GIDER_ETIKETLERI[k.kategori]}{" "}
                  <span className="text-neutral-500">({k.adet})</span>
                </span>
                <span className="font-bold tabular-nums text-red-700">
                  −{formatlaPara(k.tutar)}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-2 border-t border-neutral-200 pt-1.5 text-sm">
              <span className="font-bold text-neutral-900">
                Nakit {formatlaPara(giderler.nakitGider)} · Kart{" "}
                {formatlaPara(giderler.kartGider)}
              </span>
              <span className="font-bold tabular-nums text-red-700">
                −{formatlaPara(giderler.toplamGider)}
              </span>
            </li>
          </ul>
        </section>
      )}

      {(ozet.iskontoToplami !== 0 || ozet.iptalSayisi > 0 || ozet.ucretsizCikisSayisi > 0) && (
        <section className="rounded-xl border border-neutral-300 bg-white p-4 text-sm">
          <h2 className="font-bold text-neutral-900">Dikkat edilecekler</h2>
          <ul className="mt-2 space-y-1 text-neutral-700">
            {ozet.iskontoToplami !== 0 && (
              <li>
                Toplam ücret düzeltmesi:{" "}
                <span className="font-bold tabular-nums">{formatlaPara(ozet.iskontoToplami)}</span>
              </li>
            )}
            {ozet.iptalSayisi > 0 && <li>{ozet.iptalSayisi} kayıt iptal edildi</li>}
            {ozet.ucretsizCikisSayisi > 0 && (
              <li>{ozet.ucretsizCikisSayisi} araç ücretsiz çıktı (abonman veya ücretsiz süre)</li>
            )}
          </ul>
        </section>
      )}

      {/* Grafikler */}
      {donem !== "bugun" && (
        <section className="rounded-xl border border-neutral-300 bg-white p-4">
          <h2 className="text-base font-bold text-neutral-900">Günlük ciro</h2>
          <CiroGrafigi veri={seri} />
        </section>
      )}

      <section className="rounded-xl border border-neutral-300 bg-white p-4">
        <h2 className="text-base font-bold text-neutral-900">Saatlik giriş yoğunluğu</h2>
        <DolulukGrafigi veri={saatler} />
      </section>

      {/* Görevli performansı */}
      <section className="rounded-xl border border-neutral-300 bg-white">
        <h2 className="border-b border-neutral-200 px-4 py-3 text-base font-bold text-neutral-900">
          Görevli bazlı işlem
        </h2>
        {gorevliler.length === 0 ? (
          <p className="px-4 py-6 text-center text-neutral-600">Bu dönemde işlem yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-600">
                <tr>
                  <th className="px-4 py-2 font-semibold">Görevli</th>
                  <th className="px-2 py-2 text-right font-semibold">Giriş</th>
                  <th className="px-2 py-2 text-right font-semibold">Çıkış</th>
                  <th className="px-4 py-2 text-right font-semibold">Tahsilat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {gorevliler.map((gorevli) => (
                  <tr key={gorevli.id}>
                    <td className="px-4 py-2.5 font-semibold text-neutral-900">
                      {gorevli.adSoyad}
                      {gorevli.rol === "ADMIN" && (
                        <span className="ml-1 text-xs font-normal text-neutral-500">(yönetici)</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{gorevli.girisSayisi}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{gorevli.cikisSayisi}</td>
                    <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                      {formatlaPara(gorevli.tahsilat)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* CSV dışa aktarma */}
      <section className="rounded-xl border border-neutral-300 bg-white p-4">
        <h2 className="text-base font-bold text-neutral-900">Dışa aktarma</h2>
        <p className="mt-1 text-sm text-neutral-600">
          KVKK gereği her dışa aktarma işlemi kim tarafından ve ne zaman yapıldığıyla birlikte
          işlem günlüğüne kaydedilir.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <a
            href={`/api/rapor/csv?donem=${donem}&tur=kayitlar`}
            className="flex min-h-14 items-center justify-center rounded-lg bg-blue-700 font-bold text-white hover:bg-blue-800"
          >
            PARK KAYITLARI (CSV)
          </a>
          <a
            href={`/api/rapor/csv?donem=${donem}&tur=ozet`}
            className="flex min-h-14 items-center justify-center rounded-lg border-2 border-neutral-300 font-bold text-neutral-800 hover:bg-neutral-50"
          >
            GÜNLÜK ÖZET (CSV)
          </a>
        </div>
      </section>
    </div>
  );
}

function Kart({ etiket, deger, vurgu }: { etiket: string; deger: string; vurgu?: boolean }) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 ${
        vurgu ? "border-2 border-neutral-900" : "border-neutral-300"
      }`}
    >
      <div className="text-sm text-neutral-600">{etiket}</div>
      <div
        className={`mt-0.5 font-bold tabular-nums text-neutral-900 ${
          vurgu ? "text-2xl" : "text-xl"
        }`}
      >
        {deger}
      </div>
    </div>
  );
}
