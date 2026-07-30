"use client";

import { useId } from "react";

import { MARKALAR, markaModelleri } from "@/lib/araclar";

/**
 * Marka ve model seçimi.
 *
 * Neden `<select>` değil, `<input list>` (datalist)?
 * Katalog 74 marka / 890 model içeriyor. Açılır listede bunu kaydırmak sahada
 * çok yavaş; datalist ise yazdıkça filtreler ("tof" → Tofaş) ve mobilde de
 * yerel öneri kutusu açar. Ayrıca serbest metin zaten desteklendiği için
 * listede olmayan araç ek bir düğmeye gerek kalmadan yazılabilir —
 * katalog asla kısıtlayıcı olmamalı.
 */
export function MarkaModelSecici({
  marka,
  model,
  onMarkaDegisim,
  onModelDegisim,
  markaHatasi,
  modelHatasi,
  zorunlu,
}: {
  marka: string;
  model: string;
  onMarkaDegisim: (deger: string) => void;
  onModelDegisim: (deger: string) => void;
  markaHatasi?: string;
  modelHatasi?: string;
  zorunlu?: boolean;
}) {
  const markaId = useId();
  const modelId = useId();
  const markaListeId = `${markaId}-liste`;
  const modelListeId = `${modelId}-liste`;

  const modeller = markaModelleri(marka);
  const markaTanindi = modeller.length > 0;

  const alanSinifi = (hata?: string) =>
    `h-14 w-full rounded-lg border-2 px-3 text-lg focus:outline-none ${
      hata ? "border-red-600 focus:border-red-700" : "border-neutral-300 focus:border-blue-700"
    }`;

  return (
    <div className="space-y-3">
      {/* Marka */}
      <div>
        <label htmlFor={markaId} className="mb-1 block text-sm font-semibold text-neutral-700">
          Marka {zorunlu && <span className="text-red-700">*</span>}
        </label>

        <input
          id={markaId}
          list={markaListeId}
          value={marka}
          onChange={(olay) => {
            onMarkaDegisim(olay.target.value);
            // Marka değişince model sıfırlanır: eski markanın modeli kalmasın.
            if (olay.target.value !== marka) onModelDegisim("");
          }}
          placeholder="Yazın ya da listeden seçin"
          autoComplete="off"
          aria-invalid={!!markaHatasi}
          className={alanSinifi(markaHatasi)}
        />
        <datalist id={markaListeId}>
          {MARKALAR.map((m) => (
            <option key={m.ad} value={m.ad} />
          ))}
        </datalist>

        {markaHatasi ? (
          <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
            {markaHatasi}
          </p>
        ) : marka && !markaTanindi ? (
          <p className="mt-1 text-sm text-neutral-600">
            Listede olmayan marka — olduğu gibi kaydedilecek.
          </p>
        ) : null}
      </div>

      {/* Model */}
      <div>
        <label htmlFor={modelId} className="mb-1 block text-sm font-semibold text-neutral-700">
          Model {zorunlu && <span className="text-red-700">*</span>}
        </label>

        <input
          id={modelId}
          list={markaTanindi ? modelListeId : undefined}
          value={model}
          onChange={(olay) => onModelDegisim(olay.target.value)}
          placeholder={
            !marka
              ? "Önce marka yazın"
              : markaTanindi
                ? `${modeller.length} model — yazın ya da seçin`
                : "Model yazın"
          }
          autoComplete="off"
          aria-invalid={!!modelHatasi}
          className={alanSinifi(modelHatasi)}
        />
        {markaTanindi && (
          <datalist id={modelListeId}>
            {modeller.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        )}

        {modelHatasi && (
          <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
            {modelHatasi}
          </p>
        )}
      </div>
    </div>
  );
}
