import Link from "next/link";

import { BuyukButon } from "@/components/buyuk-buton";
import { DolulukGostergesi } from "@/components/doluluk-gostergesi";
import { PlakaGoster } from "@/components/plaka-goster";
import { formatlaPara } from "@/lib/para";
import { dolulukAl, sonIslemleriAl } from "@/lib/sorgular";
import { formatlaSaat, sureMetni } from "@/lib/tarih";
import { acikVardiyayiBul, oturumZorunlu } from "@/lib/yetki";

export const dynamic = "force-dynamic";

export default async function AnaPano({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string; bilgi?: string }>;
}) {
  const { hata, bilgi } = await searchParams;
  await oturumZorunlu(); // oturum ve hesap geçerliliği kontrolü

  const [doluluk, sonIslemler, acikVardiya] = await Promise.all([
    dolulukAl(),
    sonIslemleriAl(10),
    acikVardiyayiBul(),
  ]);

  return (
    <div className="space-y-4">
      {hata === "yetkisiz" && (
        <p role="alert" className="rounded-lg border-2 border-red-600 bg-red-50 px-4 py-3 font-semibold text-red-800">
          Bu bölüme erişim yetkiniz yok.
        </p>
      )}
      {bilgi && (
        <p className="rounded-lg border-2 border-green-600 bg-green-50 px-4 py-3 font-semibold text-green-800">
          {bilgi}
        </p>
      )}

      {/* Açık vardiya yoksa işlem yapılamaz — en üstte, en görünür yerde uyar. */}
      {!acikVardiya && (
        <div
          role="alert"
          className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4"
        >
          <p className="text-lg font-bold text-amber-900">Otoparkta açık vardiya yok</p>
          <p className="mt-1 text-base text-amber-900">
            Araç giriş ve çıkış işlemi yapabilmek için vardiya açılmalı. Vardiya ortaktır —
            bir görevli açtığında herkes aynı kasaya işlem yapar.
          </p>
          <Link
            href="/vardiya"
            className="mt-3 flex min-h-14 w-full items-center justify-center rounded-lg bg-amber-600 text-lg font-bold text-white hover:bg-amber-700"
          >
            VARDİYA AÇ
          </Link>
        </div>
      )}

      <DolulukGostergesi {...doluluk} />

      <div className="grid gap-3">
        <BuyukButon
          href="/arac-girisi"
          baslik="ARAÇ GİRİŞİ"
          altBaslik={doluluk.doluMu ? "Otopark dolu" : `${doluluk.bosYer} boş yer`}
          simge="→"
          renk="yesil"
          devreDisi={!acikVardiya}
        />
        <BuyukButon
          href="/arac-cikisi"
          baslik="ARAÇ ÇIKIŞI"
          altBaslik="Plakayla ara, ücreti tahsil et"
          simge="←"
          renk="mavi"
          devreDisi={!acikVardiya}
        />
      </div>

      {/* Son işlemler */}
      <section className="rounded-xl border border-neutral-300 bg-white">
        <h2 className="border-b border-neutral-200 px-4 py-3 text-base font-bold text-neutral-900">
          Son işlemler
        </h2>

        {sonIslemler.length === 0 ? (
          <p className="px-4 py-6 text-center text-neutral-600">Henüz işlem yok.</p>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {sonIslemler.map((kayit) => {
              const cikisYapildi = kayit.durum === "CIKTI";
              // Kayda özel not yoksa aracın kalıcı notu gösterilir.
              const not = kayit.notlar ?? kayit.arac?.notlar;
              return (
                <li key={kayit.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg font-bold ${
                        cikisYapildi ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
                      }`}
                    >
                      {cikisYapildi ? "←" : "→"}
                    </span>

                    <div className="min-w-0 flex-1">
                      <PlakaGoster
                        plaka={kayit.plaka}
                        gosterim={kayit.plakaGosterim}
                        yabanci={kayit.yabanciPlaka}
                        ulkeKodu={kayit.ulkeKodu}
                        marka={kayit.marka}
                        model={kayit.model}
                        fisNo={kayit.fisNo}
                        boyut="kucuk"
                      />

                      <div className="mt-1 truncate text-sm text-neutral-700">
                        {[
                          kayit.marka ?? kayit.arac?.marka,
                          kayit.model ?? kayit.arac?.model,
                          kayit.renk ?? kayit.arac?.renk,
                        ]
                          .filter(Boolean)
                          .join(" ") || "Araç bilgisi girilmemiş"}
                      </div>

                      <div className="mt-0.5 truncate text-sm text-neutral-600">
                        {cikisYapildi
                          ? `Çıkış ${formatlaSaat(kayit.cikisZamani)} · ${kayit.cikisYapan?.adSoyad ?? ""}`
                          : `Giriş ${formatlaSaat(kayit.girisZamani)} · ${sureMetni(kayit.girisZamani)}`}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      {cikisYapildi ? (
                        <>
                          <div className="font-bold tabular-nums text-neutral-900">
                            {formatlaPara(kayit.tahsilEdilenUcret)}
                          </div>
                          <div className="text-xs text-neutral-500">
                            {kayit.odemeYontemi === "NAKIT"
                              ? "Nakit"
                              : kayit.odemeYontemi === "KART"
                                ? "Kart"
                                : "Ücretsiz"}
                          </div>
                        </>
                      ) : (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-800">
                          İÇERİDE
                        </span>
                      )}
                    </div>
                  </div>

                  {not && (
                    <p className="mt-1.5 rounded bg-amber-50 px-2 py-1 text-sm text-amber-900">
                      {not}
                    </p>
                  )}

                  {/* İşlem butonları: içerideki araç için çıkış ve düzenleme,
                      çıkmış araç için fiş. Görevli panodan ayrılmak zorunda
                      kalmasın diye burada da erişilebilir. */}
                  <div className="mt-2 flex gap-2">
                    {cikisYapildi ? (
                      <Link
                        href={`/fis/${kayit.id}`}
                        className="flex min-h-12 flex-1 items-center justify-center rounded-lg border-2 border-neutral-300 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                      >
                        Fiş
                      </Link>
                    ) : (
                      <>
                        <Link
                          href={`/arac-cikisi?kayit=${kayit.id}`}
                          className="flex min-h-12 flex-1 items-center justify-center rounded-lg bg-blue-700 text-sm font-bold text-white hover:bg-blue-800"
                        >
                          ÇIKIŞ YAP
                        </Link>
                        <Link
                          href={`/kayit/${kayit.id}/duzenle`}
                          className="flex min-h-12 items-center justify-center rounded-lg border-2 border-neutral-300 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                        >
                          Düzenle
                        </Link>
                        <Link
                          href={`/fis/${kayit.id}`}
                          className="flex min-h-12 items-center justify-center rounded-lg border-2 border-neutral-300 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                        >
                          Fiş
                        </Link>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
