"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { kaydiDuzenle, type IslemDurumu } from "@/actions/park";
import { MarkaModelSecici } from "@/components/marka-model-secici";
import { PlakaInput } from "@/components/plaka-input";
import { SaatInput } from "@/components/saat-input";
import { cozPlaka, ULKELER } from "@/lib/plaka";
import { saatGirdisiDegeri } from "@/lib/tarih";

export type DuzenlenecekKayit = {
  id: string;
  plaka: string | null;
  plakaGosterim: string | null;
  yabanciPlaka: boolean;
  ulkeKodu: string | null;
  marka: string | null;
  model: string | null;
  renk: string | null;
  notlar: string | null;
  /** "HH:MM" — İstanbul saatiyle. */
  girisSaati: string;
};

function KaydetButonu() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-16 w-full items-center justify-center rounded-xl bg-blue-700 text-xl font-bold text-white hover:bg-blue-800 disabled:bg-neutral-400"
    >
      {pending ? "Kaydediliyor…" : "DEĞİŞİKLİKLERİ KAYDET"}
    </button>
  );
}

/**
 * İçerideki bir kaydı düzenleme formu.
 *
 * Plakasız kayda plaka eklemek, yanlış girilen giriş saatini düzeltmek ve
 * araç bilgisi/not güncellemek için kullanılır. Giriş saati ücreti doğrudan
 * etkilediği için değişiklik işlem günlüğüne yazılır.
 */
export function KayitDuzenleFormu({ kayit }: { kayit: DuzenlenecekKayit }) {
  const router = useRouter();
  const [durum, islem] = useActionState<IslemDurumu, FormData>(kaydiDuzenle, {});

  const [plaka, setPlaka] = useState(kayit.plaka ?? "");
  const [yabanci, setYabanci] = useState(kayit.yabanciPlaka);
  const [ulkeKodu, setUlkeKodu] = useState(kayit.ulkeKodu ?? "");
  const [marka, setMarka] = useState(kayit.marka ?? "");
  const [model, setModel] = useState(kayit.model ?? "");
  const [renk, setRenk] = useState(kayit.renk ?? "");
  const [girisSaati, setGirisSaati] = useState(kayit.girisSaati);
  const [notlar, setNotlar] = useState(kayit.notlar ?? "");

  useEffect(() => {
    if (durum.basarili) router.push("/icerideki-araclar");
  }, [durum.basarili, router]);

  const plakaCozumu = plaka ? cozPlaka(plaka, yabanci) : null;
  const saatDegisti = girisSaati !== kayit.girisSaati;

  return (
    <form action={islem} className="space-y-4">
      <input type="hidden" name="parkKaydiId" value={kayit.id} />
      <input type="hidden" name="plaka" value={plaka} />
      {yabanci && <input type="hidden" name="yabanciPlaka" value="on" />}
      {yabanci && <input type="hidden" name="ulkeKodu" value={ulkeKodu} />}
      <input type="hidden" name="marka" value={marka} />
      <input type="hidden" name="model" value={model} />
      <input type="hidden" name="renk" value={renk} />
      <input type="hidden" name="girisSaati" value={girisSaati} />
      <input type="hidden" name="notlar" value={notlar} />

      {durum.hata && (
        <p role="alert" className="rounded-xl border-2 border-red-600 bg-red-50 p-4 font-bold text-red-800">
          {durum.hata}
        </p>
      )}

      <section className="space-y-3 rounded-xl border border-neutral-300 bg-white p-4">
        <h2 className="text-lg font-bold text-neutral-900">Plaka</h2>

        {!kayit.plaka && (
          <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
            Bu kayıt plakasız oluşturulmuş. Plakayı şimdi girebilirsiniz; boş bırakırsanız
            araç marka/model ile tanınmaya devam eder.
          </p>
        )}

        <PlakaInput
          deger={plaka}
          onDegisim={setPlaka}
          yabanci={yabanci}
          etiket={kayit.plaka ? "Plaka" : "Plaka (isteğe bağlı)"}
          hata={
            durum.alanHatalari?.plaka ??
            (plaka.length >= 5 && plakaCozumu && !plakaCozumu.gecerli
              ? plakaCozumu.hata
              : undefined)
          }
        />

        <label className="flex min-h-12 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={yabanci}
            onChange={(olay) => {
              setYabanci(olay.target.checked);
              setUlkeKodu("");
            }}
            className="h-6 w-6 shrink-0"
          />
          <span className="text-base font-semibold text-neutral-900">Yabancı plaka</span>
        </label>

        {yabanci && (
          <select
            value={ulkeKodu}
            onChange={(olay) => setUlkeKodu(olay.target.value)}
            aria-label="Ülke"
            className="h-14 w-full rounded-lg border-2 border-neutral-300 px-3 text-lg focus:border-blue-700 focus:outline-none"
          >
            <option value="">Ülke belirtilmedi</option>
            {ULKELER.map((ulke) => (
              <option key={ulke.kod} value={ulke.kod}>
                {ulke.ad} ({ulke.kod})
              </option>
            ))}
            <option value="XX">Diğer</option>
          </select>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-neutral-300 bg-white p-4">
        <h2 className="text-lg font-bold text-neutral-900">Giriş saati</h2>
        <SaatInput
          etiket="Aracın geldiği saat (bugün)"
          deger={girisSaati}
          onDegisim={setGirisSaati}
          hata={durum.alanHatalari?.girisSaati}
          enFazla={saatGirdisiDegeri()}
          ipucu="Saati değiştirmek ödenecek ücreti doğrudan etkiler."
        />
        {saatDegisti && (
          <p className="rounded-lg border-2 border-amber-500 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            Giriş saati {kayit.girisSaati} → {girisSaati} olarak değişecek. Bu değişiklik
            işlem günlüğüne kaydedilir.
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-neutral-300 bg-white p-4">
        <h2 className="text-lg font-bold text-neutral-900">Araç bilgileri</h2>

        <MarkaModelSecici
          marka={marka}
          model={model}
          onMarkaDegisim={setMarka}
          onModelDegisim={setModel}
          markaHatasi={durum.alanHatalari?.marka}
          modelHatasi={durum.alanHatalari?.model}
          zorunlu={!plaka}
        />

        <div>
          <label htmlFor="duzenle-renk" className="mb-1 block text-sm font-semibold text-neutral-700">
            Renk
          </label>
          <input
            id="duzenle-renk"
            value={renk}
            onChange={(olay) => setRenk(olay.target.value)}
            placeholder="Beyaz"
            autoComplete="off"
            className="h-14 w-full rounded-lg border-2 border-neutral-300 px-3 text-lg focus:border-blue-700 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="duzenle-notlar" className="mb-1 block text-sm font-semibold text-neutral-700">
            Not
          </label>
          <textarea
            id="duzenle-notlar"
            value={notlar}
            onChange={(olay) => setNotlar(olay.target.value)}
            rows={3}
            placeholder="Örn: sağ ön çamurluk çizik, anahtar bizde"
            className="w-full rounded-lg border-2 border-neutral-300 p-3 text-lg focus:border-blue-700 focus:outline-none"
          />
          <p className="mt-1 text-sm text-neutral-600">
            Not, aracın göründüğü tüm ekranlarda ve fişte görünür; arama da nota bakar.
          </p>
        </div>
      </section>

      <KaydetButonu />
    </form>
  );
}
