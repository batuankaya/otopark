"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { giderEkle, type GiderDurumu } from "@/actions/gider";
import { GIDER_ETIKETLERI, GIDER_KATEGORILERI } from "@/lib/gider";

type Kategori = keyof typeof GIDER_ETIKETLERI;

function EkleButonu() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-16 w-full items-center justify-center rounded-xl bg-blue-700 text-xl font-bold text-white hover:bg-blue-800 disabled:bg-neutral-400"
    >
      {pending ? "Kaydediliyor…" : "GİDERİ KAYDET"}
    </button>
  );
}

export function GiderFormu() {
  const router = useRouter();
  const [durum, islem] = useActionState<GiderDurumu, FormData>(giderEkle, {});
  const [kategori, setKategori] = useState<Kategori>("YEMEK");
  const [odemeYontemi, setOdemeYontemi] = useState<"NAKIT" | "KART">("NAKIT");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (durum.basarili) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [durum.basarili, router]);

  return (
    <form
      ref={formRef}
      action={islem}
      className="space-y-4 rounded-xl border border-neutral-300 bg-white p-4"
    >
      <input type="hidden" name="kategori" value={kategori} />
      <input type="hidden" name="odemeYontemi" value={odemeYontemi} />

      <h2 className="text-lg font-bold text-neutral-900">Yeni gider</h2>

      {durum.hata && (
        <div role="alert" className="rounded-lg border-2 border-red-600 bg-red-50 px-3 py-2">
          <p className="font-semibold text-red-800">{durum.hata}</p>
          {durum.vardiyaGerekli && (
            <Link
              href="/vardiya"
              className="mt-2 flex min-h-14 items-center justify-center rounded-lg bg-amber-600 font-bold text-white"
            >
              VARDİYA AÇ
            </Link>
          )}
        </div>
      )}

      {durum.basarili && (
        <p className="rounded-lg border-2 border-green-600 bg-green-50 px-3 py-2 font-semibold text-green-800">
          Gider kaydedildi.
        </p>
      )}

      {/* Kategori — tek dokunuşla seçim */}
      <fieldset>
        <legend className="mb-1.5 text-base font-semibold text-neutral-900">Ne için?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {GIDER_KATEGORILERI.map(([deger, etiket]) => (
            <button
              key={deger}
              type="button"
              onClick={() => setKategori(deger)}
              className={`flex min-h-14 items-center justify-center rounded-lg border-2 px-2 text-base font-bold ${
                kategori === deger
                  ? "border-blue-700 bg-blue-700 text-white"
                  : "border-neutral-300 bg-white text-neutral-900"
              }`}
            >
              {etiket}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="gider-tutar" className="mb-1 block text-base font-semibold text-neutral-900">
          Tutar (TL)
        </label>
        <input
          id="gider-tutar"
          name="tutar"
          type="text"
          inputMode="decimal"
          required
          placeholder="0,00"
          aria-invalid={!!durum.alanHatalari?.tutar}
          className="h-16 w-full rounded-lg border-2 border-neutral-400 px-4 text-2xl font-bold tabular-nums focus:border-blue-700 focus:outline-none"
        />
        {durum.alanHatalari?.tutar && (
          <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
            {durum.alanHatalari.tutar}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="gider-aciklama"
          className="mb-1 block text-base font-semibold text-neutral-900"
        >
          Açıklama
        </label>
        <input
          id="gider-aciklama"
          name="aciklama"
          required
          placeholder="Örn: öğle yemeği, çaycıya verilen"
          autoComplete="off"
          aria-invalid={!!durum.alanHatalari?.aciklama}
          className="h-14 w-full rounded-lg border-2 border-neutral-300 px-3 text-lg focus:border-blue-700 focus:outline-none"
        />
        {durum.alanHatalari?.aciklama && (
          <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
            {durum.alanHatalari.aciklama}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="mb-1.5 text-base font-semibold text-neutral-900">Nasıl ödendi?</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { deger: "NAKIT", etiket: "NAKİT" },
              { deger: "KART", etiket: "KART" },
            ] as const
          ).map((secenek) => (
            <button
              key={secenek.deger}
              type="button"
              onClick={() => setOdemeYontemi(secenek.deger)}
              className={`flex min-h-16 items-center justify-center rounded-lg border-2 text-xl font-bold ${
                odemeYontemi === secenek.deger
                  ? "border-blue-700 bg-blue-700 text-white"
                  : "border-neutral-300 bg-white text-neutral-900"
              }`}
            >
              {secenek.etiket}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-sm text-neutral-600">
          {odemeYontemi === "NAKIT"
            ? "Nakit gider vardiya kasasından düşülür."
            : "Kartla ödenen gider kasayı etkilemez, raporda görünür."}
        </p>
      </fieldset>

      <EkleButonu />
    </form>
  );
}
