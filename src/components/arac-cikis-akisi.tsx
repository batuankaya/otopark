"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { aracCikisiYap, cikisOnizle, type CikisOnizlemesi, type IslemDurumu } from "@/actions/park";
import { PlakaGoster } from "@/components/plaka-goster";
import { formatlaPara } from "@/lib/para";
import { formatlaSure, formatlaTarihSaat, sureMetni, yirmiDortSaatiAstiMi } from "@/lib/tarih";

type AramaSonucu = {
  id: string;
  plaka: string | null;
  fisNo?: number | null;
  notlar?: string | null;
  girisZamani: string;
  cikisZamani: string | null;
  durum: "ICERIDE" | "CIKTI" | "IPTAL";
  plakaGosterim: string | null;
  yabanciPlaka: boolean;
  ulkeKodu: string | null;
  marka: string | null;
  model: string | null;
  renk: string | null;
};

function TamamlaButonu({ tutar }: { tutar: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-20 w-full items-center justify-center rounded-xl bg-blue-700 text-2xl font-bold text-white shadow-sm hover:bg-blue-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 disabled:bg-neutral-400"
    >
      {pending
        ? "Tamamlanıyor…"
        : tutar > 0
          ? `${formatlaPara(tutar)} TAHSİL ET`
          : "ÇIKIŞI TAMAMLA"}
    </button>
  );
}

export function AracCikisAkisi({
  baslangicKaydiId,
  icerdekiler = [],
}: {
  baslangicKaydiId?: string;
  /** Sunucudan gelen, şu an içerideki araçlar (arama yapılmadan gösterilir). */
  icerdekiler?: AramaSonucu[];
}) {
  const router = useRouter();

  const [terim, setTerim] = useState("");
  const [sonuclar, setSonuclar] = useState<AramaSonucu[]>([]);
  const [araniyor, setAraniyor] = useState(false);
  const [aramaYapildi, setAramaYapildi] = useState(false);

  const [onizleme, setOnizleme] = useState<CikisOnizlemesi | null>(null);
  const [odemeYontemi, setOdemeYontemi] = useState<"NAKIT" | "KART">("NAKIT");
  const [duzeltmeAcik, setDuzeltmeAcik] = useState(false);
  const [elleTutar, setElleTutar] = useState("");

  const [durum, islem] = useActionState<IslemDurumu, FormData>(aracCikisiYap, {});

  const kaydiSec = useCallback(async (kayitId: string) => {
    setAraniyor(true);
    const sonuc = await cikisOnizle(kayitId);
    setOnizleme(sonuc);
    setDuzeltmeAcik(false);
    setElleTutar("");
    setAraniyor(false);
  }, []);

  // Giriş ekranından "çıkışına git" ile gelindiyse doğrudan kaydı aç.
  useEffect(() => {
    if (baslangicKaydiId) void kaydiSec(baslangicKaydiId);
  }, [baslangicKaydiId, kaydiSec]);

  // Kısmi arama — 350 ms bekleyip sorgular (son 3 hane de çalışır).
  useEffect(() => {
    // Ham terim: sunucu plaka için normalize eder, marka/model/not için
    // kullanıcının yazdığı hâli kullanır.
    const temiz = terim.trim();
    if (temiz.length < 2) {
      setSonuclar([]);
      setAramaYapildi(false);
      return;
    }

    setAraniyor(true);
    const zamanlayici = setTimeout(async () => {
      try {
        const cevap = await fetch(`/api/plaka-ara?q=${encodeURIComponent(temiz)}`);
        const veri = await cevap.json();
        setSonuclar(veri.sonuclar ?? []);
      } catch {
        setSonuclar([]);
      } finally {
        setAraniyor(false);
        setAramaYapildi(true);
      }
    }, 350);

    return () => clearTimeout(zamanlayici);
  }, [terim]);

  // Çıkış tamamlandıysa fişe git.
  useEffect(() => {
    if (durum.basarili && durum.yeniKayitId) {
      router.push(`/fis/${durum.yeniKayitId}`);
    }
  }, [durum.basarili, durum.yeniKayitId, router]);

  // ---- Seçili kayıt yoksa: arama ekranı ----------------------------------
  if (!onizleme?.bulundu) {
    // Arama kutusu boşken içerideki araçlar gösterilir; yazmaya başlayınca
    // arama sonuçlarına geçilir.
    const aramaSerbest = terim.trim().length < 2;
    const gosterilecekler = aramaSerbest ? icerdekiler : sonuclar;

    return (
      <div className="space-y-4">
        <div>
          <label htmlFor="arama" className="mb-1.5 block text-base font-semibold text-neutral-900">
            Plaka ara
          </label>
          <input
            id="arama"
            type="text"
            value={terim}
            onChange={(olay) => setTerim(olay.target.value)}
            autoFocus
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="123 · şahin · not"
            className="h-16 w-full rounded-lg border-2 border-neutral-400 bg-white px-4 text-center font-mono text-3xl font-bold uppercase tracking-widest text-neutral-900 placeholder:text-lg placeholder:font-normal placeholder:tracking-normal placeholder:text-neutral-400 focus:border-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
          />
          <p className="mt-1.5 text-sm text-neutral-600">
            Plaka, marka/model veya not ile arayabilirsiniz. Son 3 hane yeterli.
          </p>
        </div>

        {onizleme && !onizleme.bulundu && onizleme.hata && (
          <p role="alert" className="rounded-lg border-2 border-red-600 bg-red-50 px-4 py-3 font-semibold text-red-800">
            {onizleme.hata}
          </p>
        )}

        {araniyor && <p className="text-center text-neutral-600">Aranıyor…</p>}

        {!araniyor && aramaYapildi && sonuclar.length === 0 && (
          <p className="rounded-lg border border-neutral-300 bg-white px-4 py-6 text-center text-neutral-600">
            Eşleşen araç bulunamadı.
          </p>
        )}

        {/* Arama yapılmadan önce içerideki araçlar listelenir: görevli
            çoğu zaman hiç yazmadan doğrudan aracı seçebilsin diye. */}
        {aramaSerbest && (
          <section>
            <h2 className="mb-2 text-base font-bold text-neutral-900">
              {icerdekiler.length > 0
                ? `Şu an içeride (${icerdekiler.length})`
                : "Otoparkta araç yok"}
            </h2>
            {icerdekiler.length === 0 && (
              <p className="rounded-lg border border-neutral-300 bg-white px-4 py-6 text-center text-neutral-600">
                Çıkış yapılabilecek araç bulunmuyor.
              </p>
            )}
          </section>
        )}

        {gosterilecekler.length > 0 && (
          <ul className="space-y-2">
            {gosterilecekler.map((sonuc) => {
              const iceride = sonuc.durum === "ICERIDE";
              return (
                <li key={sonuc.id}>
                  <button
                    type="button"
                    disabled={!iceride}
                    onClick={() => void kaydiSec(sonuc.id)}
                    className={`flex min-h-20 w-full items-center gap-3 rounded-xl border-2 px-4 text-left ${
                      iceride
                        ? "border-neutral-300 bg-white hover:border-blue-700"
                        : "cursor-not-allowed border-neutral-200 bg-neutral-100 opacity-70"
                    }`}
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
                        {[sonuc.marka, sonuc.model, sonuc.renk].filter(Boolean).join(" ") || "—"}
                      </div>
                      {sonuc.notlar && (
                        <div className="mt-1 truncate text-sm text-amber-900">{sonuc.notlar}</div>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      {iceride ? (
                        <>
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-bold ${
                              yirmiDortSaatiAstiMi(sonuc.girisZamani)
                                ? "bg-red-100 text-red-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            İÇERİDE
                          </span>
                          <div className="mt-1 text-sm font-semibold text-neutral-700">
                            {sureMetni(sonuc.girisZamani)}
                          </div>
                        </>
                      ) : (
                        <span className="rounded-full bg-neutral-200 px-2 py-1 text-xs font-bold text-neutral-700">
                          ÇIKMIŞ
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // ---- Seçili kayıt var: ücret ve tahsilat --------------------------------
  const kayit = onizleme.kayit!;
  const ucret = onizleme.ucret!;
  const elleTutarSayi = elleTutar.trim() === "" ? null : Number(elleTutar.replace(",", "."));
  const gosterilecekTutar =
    duzeltmeAcik && elleTutarSayi !== null && Number.isFinite(elleTutarSayi)
      ? elleTutarSayi
      : ucret.tutar;
  const tutarDegisti = Math.abs(gosterilecekTutar - ucret.tutar) > 0.009;

  return (
    <form action={islem} className="space-y-4">
      <input type="hidden" name="parkKaydiId" value={kayit.id} />
      <input type="hidden" name="odemeYontemi" value={odemeYontemi} />
      {duzeltmeAcik && elleTutar.trim() !== "" && (
        <input type="hidden" name="tahsilEdilenUcret" value={elleTutar} />
      )}

      {durum.hata && (
        <div role="alert" className="rounded-xl border-2 border-red-600 bg-red-50 p-4">
          <p className="font-bold text-red-800">{durum.hata}</p>
          {durum.vardiyaGerekli && (
            <Link
              href="/vardiya"
              className="mt-3 flex min-h-14 items-center justify-center rounded-lg bg-amber-600 text-lg font-bold text-white"
            >
              VARDİYA AÇ
            </Link>
          )}
        </div>
      )}

      {/* Araç özeti */}
      <section className="rounded-xl border border-neutral-300 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <PlakaGoster
            plaka={kayit.plaka}
            gosterim={kayit.plakaGosterim}
            yabanci={kayit.yabanciPlaka}
            ulkeKodu={kayit.ulkeKodu}
            marka={kayit.marka}
            model={kayit.model}
            boyut="buyuk"
          />
          <button
            type="button"
            onClick={() => {
              setOnizleme(null);
              setTerim("");
            }}
            className="min-h-12 shrink-0 rounded-lg border-2 border-neutral-300 px-3 text-sm font-semibold text-neutral-700"
          >
            Değiştir
          </button>
        </div>

        {[kayit.marka, kayit.model, kayit.renk].filter(Boolean).length > 0 && (
          <p className="mt-2 text-base text-neutral-700">
            {[kayit.marka, kayit.model, kayit.renk].filter(Boolean).join(" ")}
          </p>
        )}

        {/* Girişte yazılan not çıkışta da görünsün: "anahtar bizde",
            "hasar var" gibi notlar tam bu anda lazım oluyor. */}
        {kayit.notlar && (
          <p className="mt-2 rounded-lg border-2 border-amber-400 bg-amber-50 px-3 py-2 text-base font-semibold text-amber-900">
            {kayit.notlar}
          </p>
        )}

        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-neutral-200 pt-3 text-sm">
          <div>
            <dt className="text-neutral-600">Giriş</dt>
            <dd className="font-semibold text-neutral-900">
              {formatlaTarihSaat(kayit.girisZamani)}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-600">Süre</dt>
            <dd className="font-semibold text-neutral-900">{formatlaSure(ucret.toplamDakika)}</dd>
          </div>
          <div>
            <dt className="text-neutral-600">Tarife</dt>
            <dd className="font-semibold text-neutral-900">
              {ucret.uygulananTarifeTuru === "ABONMAN"
                ? "Abonman"
                : ucret.uygulananTarifeTuru === "GUNLUK"
                  ? "Günlük"
                  : "Saatlik"}
            </dd>
          </div>
        </dl>
      </section>

      {ucret.uyari && (
        <p role="alert" className="rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-3 font-semibold text-amber-900">
          {ucret.uyari}
        </p>
      )}

      {/* Ücret */}
      <section className="rounded-xl border-2 border-neutral-900 bg-white p-5 text-center">
        <div className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
          Ödenecek tutar
        </div>
        <div className="mt-1 text-5xl font-bold tabular-nums text-neutral-900">
          {formatlaPara(gosterilecekTutar)}
        </div>
        {tutarDegisti && (
          <div className="mt-1 text-sm text-neutral-600">
            Hesaplanan: {formatlaPara(ucret.tutar)}
          </div>
        )}
        {ucret.tutar === 0 && !tutarDegisti && (
          <div className="mt-1 text-sm font-semibold text-green-700">
            {ucret.uygulananTarifeTuru === "ABONMAN" ? "Abonman aracı" : "Ücretsiz süre içinde"}
          </div>
        )}
      </section>

      {/* Ödeme yöntemi */}
      {gosterilecekTutar > 0 && (
        <fieldset>
          <legend className="mb-1.5 text-base font-semibold text-neutral-900">Ödeme yöntemi</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { deger: "NAKIT", etiket: "NAKİT" },
                { deger: "KART", etiket: "KART" },
              ] as const
            ).map((secenek) => {
              const secili = odemeYontemi === secenek.deger;
              return (
                <button
                  key={secenek.deger}
                  type="button"
                  onClick={() => setOdemeYontemi(secenek.deger)}
                  className={`flex min-h-16 items-center justify-center rounded-lg border-2 text-xl font-bold ${
                    secili
                      ? "border-blue-700 bg-blue-700 text-white"
                      : "border-neutral-300 bg-white text-neutral-900"
                  }`}
                >
                  {secenek.etiket}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <TamamlaButonu tutar={gosterilecekTutar} />

      {/* İskonto / ücret düzeltme — sebep zorunlu */}
      <div className="rounded-xl border border-neutral-300 bg-white">
        <button
          type="button"
          onClick={() => setDuzeltmeAcik((acik) => !acik)}
          aria-expanded={duzeltmeAcik}
          className="flex min-h-14 w-full items-center justify-between px-4 text-base font-semibold text-neutral-700"
        >
          İskonto / ücret düzeltme
          <span aria-hidden className="text-xl">
            {duzeltmeAcik ? "−" : "+"}
          </span>
        </button>

        {duzeltmeAcik && (
          <div className="space-y-3 border-t border-neutral-200 p-4">
            <div>
              <label htmlFor="elle-tutar" className="mb-1 block text-sm font-semibold text-neutral-700">
                Tahsil edilecek tutar (TL)
              </label>
              <input
                id="elle-tutar"
                type="text"
                inputMode="decimal"
                value={elleTutar}
                onChange={(olay) => setElleTutar(olay.target.value)}
                placeholder={String(ucret.tutar)}
                className="h-14 w-full rounded-lg border-2 border-neutral-300 px-3 text-xl font-bold tabular-nums focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="duzeltme-sebebi" className="mb-1 block text-sm font-semibold text-neutral-700">
                Düzeltme sebebi <span className="text-red-700">*</span>
              </label>
              <textarea
                id="duzeltme-sebebi"
                name="ucretDuzeltmeSebebi"
                rows={2}
                placeholder="Örn: Bariyer arızası nedeniyle bekleme"
                aria-invalid={!!durum.alanHatalari?.ucretDuzeltmeSebebi}
                className="w-full rounded-lg border-2 border-neutral-300 p-3 text-base focus:border-blue-700 focus:outline-none"
              />
              {durum.alanHatalari?.ucretDuzeltmeSebebi && (
                <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
                  {durum.alanHatalari.ucretDuzeltmeSebebi}
                </p>
              )}
              <p className="mt-1 text-xs text-neutral-500">
                Ücret değişiklikleri işlem günlüğüne kaydedilir.
              </p>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
