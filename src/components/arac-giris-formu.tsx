"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { aracGirisiYap, type IslemDurumu } from "@/actions/park";
import { MarkaModelSecici } from "@/components/marka-model-secici";
import { PlakaInput } from "@/components/plaka-input";
import { SaatInput } from "@/components/saat-input";
import { useTaslak } from "@/hooks/use-taslak";
import { cozPlaka, dogrulaPlaka, ULKELER } from "@/lib/plaka";
import { formatlaTarihSaat, saatGirdisiDegeri, sureMetni } from "@/lib/tarih";


type AracBilgisi = {
  bulundu: boolean;
  marka?: string | null;
  model?: string | null;
  renk?: string | null;
  notlar?: string | null;
  yabanciPlaka?: boolean;
  ulkeKodu?: string | null;
  iceride?: { kayitId: string; girisZamani: string; parkAlaniAd: string | null } | null;
};

const TASLAK_ANAHTARI = "otopark:arac-girisi-taslak";

function KaydetButonu({ devreDisi }: { devreDisi: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || devreDisi}
      className="flex min-h-20 w-full items-center justify-center rounded-xl bg-green-700 text-2xl font-bold text-white shadow-sm hover:bg-green-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-green-300 disabled:bg-neutral-400"
    >
      {pending ? "Kaydediliyor…" : "GİRİŞİ KAYDET"}
    </button>
  );
}

export function AracGirisFormu() {
  const router = useRouter();
  const [durum, islem] = useActionState<IslemDurumu, FormData>(aracGirisiYap, {});
  const [aracBilgisi, setAracBilgisi] = useState<AracBilgisi | null>(null);
  const [detayAcik, setDetayAcik] = useState(false);
  const plakaRef = useRef<HTMLInputElement>(null);

  // Form verisi localStorage'da tutulur: internet koparsa ya da telefon
  // uygulamayı kapatırsa görevlinin yazdıkları kaybolmasın.
  const [geriyeDonukAcik, setGeriyeDonukAcik] = useState(false);

  const { taslak, guncelle, temizle } = useTaslak(TASLAK_ANAHTARI, {
    plaka: "",
    plakasiz: false,
    yabanciPlaka: false,
    ulkeKodu: "",
    marka: "",
    model: "",
    renk: "",
    girisSaati: "",
    notlar: "",
  });

  const plakasiz = taslak.plakasiz;
  const yabanci = taslak.yabanciPlaka;
  const plakaCozumu = taslak.plaka ? cozPlaka(taslak.plaka, yabanci) : null;
  // Plakasız kayıtta plaka yerine marka + model aranır.
  const plakaGecerli = plakasiz
    ? !!taslak.marka.trim() && !!taslak.model.trim()
    : (plakaCozumu?.gecerli ?? false);

  // Türk kalıbına uymayan ama yabancı işaretlenmemiş plakada görevliye
  // "yabancı plaka mı?" diye sor — kaydedemeden kalmasın.
  const yabanciOnerisi =
    !plakasiz && !yabanci && taslak.plaka.length >= 4 && !dogrulaPlaka(taslak.plaka).gecerli;

  // Plaka tamamlandığında aracı sorgula: bilgiler otomatik dolsun,
  // araç zaten içerideyse görevli kaydetmeden önce görsün.
  useEffect(() => {
    if (plakasiz || !plakaCozumu?.gecerli) {
      setAracBilgisi(null);
      return;
    }

    const normalize = plakaCozumu.deger.plaka;
    const zamanlayici = setTimeout(async () => {
      try {
        const cevap = await fetch(
          `/api/arac-bilgi?plaka=${encodeURIComponent(normalize)}&yabanci=${yabanci ? "1" : "0"}`,
        );
        if (!cevap.ok) return;
        const veri: AracBilgisi = await cevap.json();
        setAracBilgisi(veri);

        // Boş alanları geçmiş bilgiyle doldur (görevlinin yazdığını ezmeden).
        if (veri.bulundu) {
          guncelle({
            marka: taslak.marka || veri.marka || "",
            model: taslak.model || veri.model || "",
            renk: taslak.renk || veri.renk || "",
            ulkeKodu: taslak.ulkeKodu || veri.ulkeKodu || "",
            // Aracın kalıcı notu forma gelsin; görevlinin yazdığı ezilmesin.
            notlar: taslak.notlar || veri.notlar || "",
          });
        }
      } catch {
        // Çevrimdışı olabilir; sessizce geç — kayıt yine de denenebilir.
      }
    }, 350);

    return () => clearTimeout(zamanlayici);
    // marka/model/renk bilerek dışarıda: kullanıcı yazarken tetiklenmesin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taslak.plaka, plakasiz, yabanci]);

  // Kayıt başarılıysa taslağı temizle ve fişe git.
  useEffect(() => {
    if (durum.basarili && durum.yeniKayitId) {
      temizle();
      router.push(`/fis/${durum.yeniKayitId}?yeni=1`);
    }
  }, [durum.basarili, durum.yeniKayitId, router, temizle]);

  const icerideUyarisi = aracBilgisi?.iceride;

  return (
    <form action={islem} className="space-y-4">
      {/* Sunucuya gidecek gizli alanlar (kontrollü input'ların değerleri) */}
      {/* Plakasız kayıtta plaka alanı hiç gönderilmez. */}
      {!plakasiz && <input type="hidden" name="plaka" value={taslak.plaka} />}
      {!plakasiz && yabanci && <input type="hidden" name="yabanciPlaka" value="on" />}
      {!plakasiz && yabanci && <input type="hidden" name="ulkeKodu" value={taslak.ulkeKodu} />}
      <input type="hidden" name="marka" value={taslak.marka} />
      <input type="hidden" name="model" value={taslak.model} />
      <input type="hidden" name="renk" value={taslak.renk} />
      {/* Not katlanmış panelin içinde olduğu için buradan gönderilir:
          panel kapalıyken textarea render edilmiyor ve not kayboluyordu. */}
      <input type="hidden" name="notlar" value={taslak.notlar} />

      {durum.hata && (
        <div role="alert" className="rounded-xl border-2 border-red-600 bg-red-50 p-4">
          <p className="text-lg font-bold text-red-800">{durum.hata}</p>
          {durum.mevcutKayitId && (
            <Link
              href={`/arac-cikisi?kayit=${durum.mevcutKayitId}`}
              className="mt-3 flex min-h-14 items-center justify-center rounded-lg bg-blue-700 text-lg font-bold text-white hover:bg-blue-800"
            >
              BU ARACIN ÇIKIŞINA GİT
            </Link>
          )}
          {durum.vardiyaGerekli && (
            <Link
              href="/vardiya"
              className="mt-3 flex min-h-14 items-center justify-center rounded-lg bg-amber-600 text-lg font-bold text-white hover:bg-amber-700"
            >
              VARDİYA AÇ
            </Link>
          )}
        </div>
      )}

      {!plakasiz && (
      <PlakaInput
        ref={plakaRef}
        deger={taslak.plaka}
        onDegisim={(deger) => guncelle({ plaka: deger })}
        yabanci={yabanci}
        otomatikOdak
        hata={
          durum.alanHatalari?.plaka ??
          (taslak.plaka.length >= 5 && plakaCozumu && !plakaCozumu.gecerli
            ? plakaCozumu.hata
            : undefined)
        }
        ipucu={
          yabanci
            ? "Plakayı araçta yazdığı gibi girin."
            : "Örnek: 34 A 1234 · 34 AB 123 · 34 ABC 123"
        }
      />
      )}

      {/* Plakasız kayıt anahtarı — plaka okunamadığında araç yine kaydedilebilsin */}
      <div className="rounded-xl border-2 border-neutral-300 bg-white p-3">
        <label className="flex min-h-12 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={plakasiz}
            onChange={(olay) =>
              guncelle({ plakasiz: olay.target.checked, plaka: "", yabanciPlaka: false, ulkeKodu: "" })
            }
            className="h-6 w-6 shrink-0"
          />
          <span className="text-base font-bold text-neutral-900">
            Plaka yok / okunamıyor
          </span>
        </label>
        {plakasiz && (
          <p className="mt-1 text-sm text-neutral-600">
            Araç marka ve modeliyle kaydedilir. Plakayı sonradan{" "}
            <strong>İçerideki Araçlar</strong> ekranından düzenleyip ekleyebilirsiniz.
          </p>
        )}
      </div>

      {/* Yabancı plaka anahtarı */}
      {!plakasiz && (
      <div className="rounded-xl border-2 border-neutral-300 bg-white p-3">
        <label className="flex min-h-12 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={yabanci}
            onChange={(olay) =>
              guncelle({ yabanciPlaka: olay.target.checked, ulkeKodu: "" })
            }
            className="h-6 w-6 shrink-0"
          />
          <span className="text-base font-bold text-neutral-900">Yabancı plaka</span>
        </label>

        {yabanci && (
          <div className="mt-3">
            <label htmlFor="ulke" className="mb-1 block text-sm font-semibold text-neutral-700">
              Ülke (isteğe bağlı)
            </label>
            <select
              id="ulke"
              value={taslak.ulkeKodu}
              onChange={(olay) => guncelle({ ulkeKodu: olay.target.value })}
              className="h-14 w-full rounded-lg border-2 border-neutral-300 px-3 text-lg focus:border-blue-700 focus:outline-none"
            >
              <option value="">Belirtilmedi</option>
              {ULKELER.map((ulke) => (
                <option key={ulke.kod} value={ulke.kod}>
                  {ulke.ad} ({ulke.kod})
                </option>
              ))}
              <option value="XX">Diğer</option>
            </select>
          </div>
        )}
      </div>
      )}

      {/* Türk kalıbına uymuyorsa yabancı plaka önerisi */}
      {yabanciOnerisi && (
        <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4">
          <p className="font-bold text-amber-900">Bu plaka Türk plaka kalıbına uymuyor.</p>
          <p className="mt-0.5 text-sm text-amber-900">
            Yurt dışı plakalı bir araçsa aşağıdaki düğmeye basın; Türk plaka kuralları
            uygulanmaz.
          </p>
          <button
            type="button"
            onClick={() => guncelle({ yabanciPlaka: true })}
            className="mt-3 flex min-h-14 w-full items-center justify-center rounded-lg bg-amber-600 text-lg font-bold text-white hover:bg-amber-700"
          >
            YABANCI PLAKA OLARAK KAYDET
          </button>
        </div>
      )}

      {/* Aracın önceki girişten kalan notu — görevli hemen görsün */}
      {aracBilgisi?.notlar && !icerideUyarisi && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-3">
          <p className="text-sm font-bold text-amber-900">Bu araca ait not</p>
          <p className="mt-0.5 text-base text-amber-900">{aracBilgisi.notlar}</p>
        </div>
      )}

      {/* Araç zaten içeride — kaydetmeden önce uyar */}
      {icerideUyarisi && (
        <div role="alert" className="rounded-xl border-2 border-red-600 bg-red-50 p-4">
          <p className="text-lg font-bold text-red-800">Bu araç zaten otoparkta</p>
          <p className="mt-1 text-base text-red-900">
            {formatlaTarihSaat(icerideUyarisi.girisZamani)} — {sureMetni(icerideUyarisi.girisZamani)}
            {icerideUyarisi.parkAlaniAd ? ` · ${icerideUyarisi.parkAlaniAd}` : ""}
          </p>
          <Link
            href={`/arac-cikisi?kayit=${icerideUyarisi.kayitId}`}
            className="mt-3 flex min-h-14 items-center justify-center rounded-lg bg-blue-700 text-lg font-bold text-white hover:bg-blue-800"
          >
            ÇIKIŞINA GİT
          </Link>
        </div>
      )}

      {/* Geriye dönük giriş — araç kaydedilmeyi unutulduysa gerçek saat girilir */}
      <div className="rounded-xl border border-neutral-300 bg-white">
        <button
          type="button"
          onClick={() => {
            const acilacak = !geriyeDonukAcik;
            setGeriyeDonukAcik(acilacak);
            // Kapatılınca alan temizlensin ki yanlışlıkla eski saat gönderilmesin.
            if (!acilacak) guncelle({ girisSaati: "" });
          }}
          aria-expanded={geriyeDonukAcik}
          className="flex min-h-14 w-full items-center justify-between px-4 text-base font-semibold text-neutral-700"
        >
          <span>
            Giriş saati
            {taslak.girisSaati && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                {taslak.girisSaati}
              </span>
            )}
          </span>
          <span aria-hidden className="text-xl">
            {geriyeDonukAcik ? "−" : "+"}
          </span>
        </button>

        {geriyeDonukAcik && (
          <div className="space-y-2 border-t border-neutral-200 p-4">
            <SaatInput
              ad="girisSaati"
              etiket="Aracın geldiği saat (bugün)"
              deger={taslak.girisSaati}
              onDegisim={(deger) => guncelle({ girisSaati: deger })}
              hata={durum.alanHatalari?.girisSaati}
              enFazla={saatGirdisiDegeri()}
              ipucu="Aracı kaydetmeyi unuttuysanız geldiği saati yazın; ücret o saatten hesaplanır. Boş bırakırsanız şu anki saat kullanılır."
            />
            {taslak.girisSaati && (
              <button
                type="button"
                onClick={() => guncelle({ girisSaati: "" })}
                className="min-h-12 text-sm font-semibold text-blue-800 underline"
              >
                Şu anki saati kullan
              </button>
            )}
          </div>
        )}
      </div>

      <KaydetButonu devreDisi={!plakaGecerli || !!icerideUyarisi} />

      {/* Araç bilgileri — plakasız kayıtta zorunlu olduğu için açık gelir */}
      <div className="rounded-xl border border-neutral-300 bg-white">
        <button
          type="button"
          onClick={() => setDetayAcik((acik) => !acik)}
          aria-expanded={detayAcik || plakasiz}
          className="flex min-h-14 w-full items-center justify-between px-4 text-base font-semibold text-neutral-700"
        >
          Araç bilgileri {plakasiz ? "(zorunlu)" : "(isteğe bağlı)"}
          <span aria-hidden className="text-xl">
            {detayAcik || plakasiz ? "−" : "+"}
          </span>
        </button>

        {(detayAcik || plakasiz) && (
          <div className="space-y-3 border-t border-neutral-200 p-4">
            <MarkaModelSecici
              marka={taslak.marka}
              model={taslak.model}
              onMarkaDegisim={(deger) => guncelle({ marka: deger })}
              onModelDegisim={(deger) => guncelle({ model: deger })}
              markaHatasi={durum.alanHatalari?.marka}
              modelHatasi={durum.alanHatalari?.model}
              zorunlu={plakasiz}
            />

            <div>
              <label htmlFor="alan-renk" className="mb-1 block text-sm font-semibold text-neutral-700">
                Renk
              </label>
              <input
                id="alan-renk"
                value={taslak.renk}
                onChange={(olay) => guncelle({ renk: olay.target.value })}
                placeholder="Beyaz"
                autoComplete="off"
                className="h-14 w-full rounded-lg border-2 border-neutral-300 px-3 text-lg focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="alan-notlar"
                className="mb-1 block text-sm font-semibold text-neutral-700"
              >
                Not
              </label>
              <textarea
                id="alan-notlar"
                value={taslak.notlar}
                onChange={(olay) => guncelle({ notlar: olay.target.value })}
                rows={2}
                placeholder="Örn: sağ ön çamurluk çizik, anahtar bizde"
                className="w-full rounded-lg border-2 border-neutral-300 p-3 text-lg focus:border-blue-700 focus:outline-none"
              />
              <p className="mt-1 text-sm text-neutral-600">
                Not, aracın göründüğü tüm ekranlarda ve fişte görünür; arama da nota bakar.
              </p>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
