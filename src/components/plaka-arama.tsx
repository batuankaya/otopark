"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PlakaGoster } from "@/components/plaka-goster";
import { formatlaPara } from "@/lib/para";
import { formatlaTarihSaat, sureMetni, yirmiDortSaatiAstiMi } from "@/lib/tarih";

type Sonuc = {
  id: string;
  plaka: string | null;
  fisNo: number | null;
  notlar: string | null;
  plakaGosterim: string | null;
  yabanciPlaka: boolean;
  ulkeKodu: string | null;
  girisZamani: string;
  cikisZamani: string | null;
  durum: "ICERIDE" | "CIKTI" | "IPTAL";
  tahsilEdilenUcret: number | null;
  odemeYontemi: "NAKIT" | "KART" | null;
  marka: string | null;
  model: string | null;
  renk: string | null;
  /** Bu kaydın çıkışından kalan borç. */
  borcKalan: number;
  /** Aracın tüm çıkışlarından kalan toplam borç. */
  aracBorcu: number;
};

/**
 * Plaka arama ekranı.
 *
 * Kısmi eşleşme: "26" il koduyla başlayanları, "159" son haneleri,
 * "26ABC" harf grubunu bulur. İçerideki araçlar her zaman üstte listelenir;
 * geçmiş kayıtlar da görünür ki görevli "bu araç bugün çıkmış" diyebilsin.
 */
export function PlakaArama() {
  const [terim, setTerim] = useState("");
  const [sonuclar, setSonuclar] = useState<Sonuc[]>([]);
  const [toplam, setToplam] = useState(0);
  const [araniyor, setAraniyor] = useState(false);
  const [aramaYapildi, setAramaYapildi] = useState(false);

  useEffect(() => {
    // Ham terim gönderilir: sunucu plaka için normalize eder, marka/model/not
    // için kullanıcının yazdığı hâli kullanır ("şahin" normalize edilirse bozulur).
    const temiz = terim.trim();
    if (temiz.length < 2) {
      setSonuclar([]);
      setAramaYapildi(false);
      return;
    }

    setAraniyor(true);
    const zamanlayici = setTimeout(async () => {
      try {
        const cevap = await fetch(`/api/plaka-ara?q=${encodeURIComponent(temiz)}&adet=50`);
        const veri = await cevap.json();
        setSonuclar(veri.sonuclar ?? []);
        setToplam(veri.toplam ?? 0);
      } catch {
        setSonuclar([]);
        setToplam(0);
      } finally {
        setAraniyor(false);
        setAramaYapildi(true);
      }
    }, 300);

    return () => clearTimeout(zamanlayici);
  }, [terim]);

  const iceridekiler = sonuclar.filter((s) => s.durum === "ICERIDE");
  const gecmis = sonuclar.filter((s) => s.durum !== "ICERIDE");

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="plaka-ara" className="mb-1.5 block text-base font-semibold text-neutral-900">
          Plaka
        </label>
        <div className="relative">
          <input
            id="plaka-ara"
            type="text"
            value={terim}
            onChange={(olay) => setTerim(olay.target.value)}
            autoFocus
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="26 · şahin · not"
            className="h-16 w-full rounded-lg border-2 border-neutral-400 bg-white px-4 pr-14 text-center font-mono text-3xl font-bold text-neutral-900 placeholder:text-xl placeholder:font-normal placeholder:tracking-normal placeholder:text-neutral-400 focus:border-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
          />
          {terim && (
            <button
              type="button"
              onClick={() => setTerim("")}
              aria-label="Temizle"
              className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-lg text-2xl text-neutral-500 hover:bg-neutral-100"
            >
              ×
            </button>
          )}
        </div>
        <p className="mt-1.5 text-sm text-neutral-600">
          Plaka (26, 159, 26ABC), marka/model (şahin), renk veya not ile arayabilirsiniz.
        </p>
      </div>

      {araniyor && <p className="text-center text-neutral-600">Aranıyor…</p>}

      {!araniyor && aramaYapildi && sonuclar.length === 0 && (
        <p className="rounded-xl border border-neutral-300 bg-white px-4 py-10 text-center text-neutral-600">
          Eşleşen araç bulunamadı.
        </p>
      )}

      {iceridekiler.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-bold text-neutral-900">
            Şu an içeride ({iceridekiler.length})
          </h2>
          <ul className="space-y-2">
            {iceridekiler.map((sonuc) => (
              <li key={sonuc.id}>
                <Link
                  href={`/arac-cikisi?kayit=${sonuc.id}`}
                  className="flex min-h-20 w-full items-center gap-3 rounded-xl border-2 border-neutral-300 bg-white px-4 py-3 hover:border-blue-700"
                >
                  <div className="min-w-0 flex-1">
                    <PlakaGoster
                      plaka={sonuc.plaka}
                      gosterim={sonuc.plakaGosterim}
                      yabanci={sonuc.yabanciPlaka}
                      ulkeKodu={sonuc.ulkeKodu}
                      marka={sonuc.marka}
                      model={sonuc.model}
                      fisNo={sonuc.fisNo}
                      boyut="orta"
                    />
                    <div className="mt-1 truncate text-sm text-neutral-600">
                      {[sonuc.marka, sonuc.model, sonuc.renk].filter(Boolean).join(" ") ||
                        "Araç bilgisi yok"}
                    </div>
                    <div className="text-sm text-neutral-600">
                      Giriş {formatlaTarihSaat(sonuc.girisZamani)}
                    </div>
                    {sonuc.notlar && (
                      <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-sm text-amber-900">
                        {sonuc.notlar}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    {sonuc.aracBorcu > 0 && (
                      <div className="mb-1">
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-800">
                          BORÇ {formatlaPara(sonuc.aracBorcu)}
                        </span>
                      </div>
                    )}
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold ${
                        yirmiDortSaatiAstiMi(sonuc.girisZamani)
                          ? "bg-red-100 text-red-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      İÇERİDE
                    </span>
                    <div className="mt-1 font-bold text-neutral-900">
                      {sureMetni(sonuc.girisZamani)}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-blue-800">Çıkış yap →</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {gecmis.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-bold text-neutral-900">
            Geçmiş kayıtlar ({gecmis.length})
          </h2>
          <ul className="space-y-2">
            {gecmis.map((sonuc) => (
              <li
                key={sonuc.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-300 bg-white px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <PlakaGoster
                    plaka={sonuc.plaka}
                    gosterim={sonuc.plakaGosterim}
                    yabanci={sonuc.yabanciPlaka}
                    ulkeKodu={sonuc.ulkeKodu}
                    marka={sonuc.marka}
                    model={sonuc.model}
                    fisNo={sonuc.fisNo}
                    boyut="kucuk"
                  />
                  <div className="mt-1 truncate text-sm text-neutral-600">
                    {[sonuc.marka, sonuc.model, sonuc.renk].filter(Boolean).join(" ") || "—"}
                  </div>
                  {sonuc.notlar && (
                    <div className="mt-1 truncate text-sm text-amber-900">{sonuc.notlar}</div>
                  )}
                  <div className="text-sm text-neutral-600">
                    {formatlaTarihSaat(sonuc.girisZamani)} →{" "}
                    {sonuc.cikisZamani ? formatlaTarihSaat(sonuc.cikisZamani) : "—"}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {sonuc.tahsilEdilenUcret !== null && (
                    <div className="font-bold tabular-nums text-neutral-900">
                      {formatlaPara(sonuc.tahsilEdilenUcret)}
                    </div>
                  )}
                  <div className="text-xs text-neutral-500">
                    {sonuc.odemeYontemi === "NAKIT"
                      ? "Nakit"
                      : sonuc.odemeYontemi === "KART"
                        ? "Kart"
                        : sonuc.borcKalan > 0
                          ? "Ödenmedi"
                          : "Ücretsiz"}
                  </div>
                  {sonuc.borcKalan > 0 && (
                    <div className="mt-1 text-sm font-bold text-red-700">
                      BORÇ {formatlaPara(sonuc.borcKalan)}
                    </div>
                  )}
                  <Link
                    href={`/fis/${sonuc.id}`}
                    className="mt-1 inline-block text-sm font-semibold text-blue-800 underline"
                  >
                    Fiş
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {toplam > sonuclar.length && (
        <p className="text-center text-sm text-neutral-600">
          {toplam} sonuçtan ilk {sonuclar.length} tanesi gösteriliyor. Aramayı daraltın.
        </p>
      )}
    </div>
  );
}
