import Link from "next/link";
import type { Metadata } from "next";

import { vardiyaGiderleri } from "@/actions/gider";
import { GIDER_ETIKETLERI } from "@/lib/gider";
import { GiderFormu } from "@/components/gider-formu";
import { GiderSilButonu } from "@/components/gider-sil-butonu";
import { formatlaPara, sayiyaCevir } from "@/lib/para";
import { prisma } from "@/lib/prisma";
import { formatlaSaat, formatlaTarihSaat, gunBaslangici, gunSonu } from "@/lib/tarih";
import { acikVardiyayiBul, oturumZorunlu } from "@/lib/yetki";

export const metadata: Metadata = { title: "Giderler" };
export const dynamic = "force-dynamic";

export default async function GiderlerSayfasi() {
  await oturumZorunlu();
  const acikVardiya = await acikVardiyayiBul();

  const [vardiyaOzeti, bugunkuler] = await Promise.all([
    acikVardiya ? vardiyaGiderleri(acikVardiya.id) : null,
    // Vardiya kapansa bile günün toplamı görünsün.
    prisma.gider.findMany({
      where: { zaman: { gte: gunBaslangici(), lt: gunSonu() } },
      include: { kullanici: { select: { adSoyad: true } } },
      orderBy: { zaman: "desc" },
    }),
  ]);

  const bugunToplam = bugunkuler.reduce((t, g) => t + sayiyaCevir(g.tutar), 0);
  const bugunNakit = bugunkuler
    .filter((g) => g.odemeYontemi === "NAKIT")
    .reduce((t, g) => t + sayiyaCevir(g.tutar), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-neutral-900">Giderler</h1>

      {!acikVardiya && (
        <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4">
          <p className="text-lg font-bold text-amber-900">Otoparkta açık vardiya yok</p>
          <p className="mt-1 text-base text-amber-900">
            Gider kaydı için vardiya açılmalı — nakit giderin hangi kasadan düştüğü bilinmek
            zorunda.
          </p>
          <Link
            href="/vardiya"
            className="mt-3 flex min-h-14 items-center justify-center rounded-lg bg-amber-600 text-lg font-bold text-white hover:bg-amber-700"
          >
            VARDİYA AÇ
          </Link>
        </div>
      )}

      {/* Günün özeti */}
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border-2 border-neutral-900 bg-white p-4">
          <div className="text-sm text-neutral-600">Bugünkü toplam gider</div>
          <div className="mt-0.5 text-2xl font-bold tabular-nums text-red-700">
            {formatlaPara(bugunToplam)}
          </div>
        </div>
        <div className="rounded-xl border border-neutral-300 bg-white p-4">
          <div className="text-sm text-neutral-600">Kasadan çıkan (nakit)</div>
          <div className="mt-0.5 text-2xl font-bold tabular-nums text-neutral-900">
            {formatlaPara(bugunNakit)}
          </div>
        </div>
      </section>

      {acikVardiya && <GiderFormu />}

      {/* Açık vardiyanın giderleri */}
      {acikVardiya && vardiyaOzeti && (
        <section className="rounded-xl border border-neutral-300 bg-white">
          <h2 className="border-b border-neutral-200 px-4 py-3 text-base font-bold text-neutral-900">
            Bu vardiyanın giderleri ({vardiyaOzeti.kayitlar.length}) ·{" "}
            {formatlaPara(vardiyaOzeti.toplamGider)}
          </h2>

          {vardiyaOzeti.kayitlar.length === 0 ? (
            <p className="px-4 py-6 text-center text-neutral-600">
              Bu vardiyada henüz gider kaydedilmedi.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {vardiyaOzeti.kayitlar.map((gider) => (
                <li key={gider.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-14 shrink-0 text-sm tabular-nums text-neutral-600">
                    {formatlaSaat(gider.zaman)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-neutral-900">
                      {GIDER_ETIKETLERI[gider.kategori]}
                    </div>
                    <div className="truncate text-sm text-neutral-600">{gider.aciklama}</div>
                    <div className="text-xs text-neutral-500">{gider.kullanici.adSoyad}</div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="font-bold tabular-nums text-red-700">
                      −{formatlaPara(gider.tutar)}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {gider.odemeYontemi === "NAKIT" ? "Nakit" : "Kart"}
                    </div>
                  </div>

                  <GiderSilButonu giderId={gider.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Günün tüm giderleri (kapanmış vardiyalar dahil) */}
      {bugunkuler.length > 0 && (
        <section className="rounded-xl border border-neutral-300 bg-white">
          <h2 className="border-b border-neutral-200 px-4 py-3 text-base font-bold text-neutral-900">
            Bugünün tüm giderleri ({bugunkuler.length})
          </h2>
          <ul className="divide-y divide-neutral-200">
            {bugunkuler.map((gider) => (
              <li key={gider.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-28 shrink-0 tabular-nums text-neutral-600">
                  {formatlaTarihSaat(gider.zaman).slice(11)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold text-neutral-900">
                    {GIDER_ETIKETLERI[gider.kategori]}
                  </span>{" "}
                  <span className="text-neutral-600">— {gider.aciklama}</span>
                </span>
                <span className="shrink-0 font-bold tabular-nums text-red-700">
                  −{formatlaPara(gider.tutar)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
