"use client";

import { useId, useState } from "react";

import { MARKALAR, markaModelleri } from "@/lib/araclar";

/**
 * Marka ve model seçimi.
 *
 * Katalogdan seçim hızlıdır (görevli yazmak zorunda kalmaz) ama katalog asla
 * kısıtlayıcı değildir: listede olmayan araç için "Listede yok — elle yaz"
 * seçeneği her zaman vardır. Sahada beklenmedik bir araç geldiğinde kayıt
 * yapılamaması, gevşek veriden daha kötüdür.
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

  // Katalogda olmayan bir marka geldiyse (düzenleme, eski kayıt) serbest
  // metin kipinde aç ki değer görünmeden kaybolmasın.
  const katalogdaVar = MARKALAR.some((m) => m.ad === marka);
  const [serbestMarka, setSerbestMarka] = useState(!!marka && !katalogdaVar);

  const modeller = markaModelleri(marka);
  const modelKatalogdaVar = modeller.includes(model);
  const [serbestModel, setSerbestModel] = useState(!!model && !modelKatalogdaVar);

  const alanSinifi = (hata?: string) =>
    `h-14 w-full rounded-lg border-2 px-3 text-lg focus:outline-none ${
      hata ? "border-red-600 focus:border-red-700" : "border-neutral-300 focus:border-blue-700"
    }`;

  const ELLE = "__elle__";

  return (
    <div className="space-y-3">
      {/* Marka */}
      <div>
        <label htmlFor={markaId} className="mb-1 block text-sm font-semibold text-neutral-700">
          Marka {zorunlu && <span className="text-red-700">*</span>}
        </label>

        {serbestMarka ? (
          <div className="flex gap-2">
            <input
              id={markaId}
              value={marka}
              onChange={(olay) => onMarkaDegisim(olay.target.value)}
              placeholder="Marka yazın"
              autoComplete="off"
              className={alanSinifi(markaHatasi)}
            />
            <button
              type="button"
              onClick={() => {
                setSerbestMarka(false);
                onMarkaDegisim("");
                onModelDegisim("");
              }}
              className="min-h-14 shrink-0 rounded-lg border-2 border-neutral-300 px-3 text-sm font-semibold text-neutral-700"
            >
              Listeden
            </button>
          </div>
        ) : (
          <select
            id={markaId}
            value={marka}
            onChange={(olay) => {
              if (olay.target.value === ELLE) {
                setSerbestMarka(true);
                onMarkaDegisim("");
                onModelDegisim("");
                return;
              }
              onMarkaDegisim(olay.target.value);
              onModelDegisim(""); // marka değişince model sıfırlanır
              setSerbestModel(false);
            }}
            className={alanSinifi(markaHatasi)}
          >
            <option value="">Seçiniz</option>
            {MARKALAR.map((m) => (
              <option key={m.ad} value={m.ad}>
                {m.ad}
              </option>
            ))}
            <option value={ELLE}>Listede yok — elle yaz</option>
          </select>
        )}

        {markaHatasi && (
          <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
            {markaHatasi}
          </p>
        )}
      </div>

      {/* Model */}
      <div>
        <label htmlFor={modelId} className="mb-1 block text-sm font-semibold text-neutral-700">
          Model {zorunlu && <span className="text-red-700">*</span>}
        </label>

        {serbestModel || serbestMarka || modeller.length === 0 ? (
          <div className="flex gap-2">
            <input
              id={modelId}
              value={model}
              onChange={(olay) => onModelDegisim(olay.target.value)}
              placeholder={marka ? "Model yazın" : "Önce marka seçin"}
              disabled={!marka && !serbestMarka}
              autoComplete="off"
              className={alanSinifi(modelHatasi)}
            />
            {modeller.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSerbestModel(false);
                  onModelDegisim("");
                }}
                className="min-h-14 shrink-0 rounded-lg border-2 border-neutral-300 px-3 text-sm font-semibold text-neutral-700"
              >
                Listeden
              </button>
            )}
          </div>
        ) : (
          <select
            id={modelId}
            value={model}
            onChange={(olay) => {
              if (olay.target.value === ELLE) {
                setSerbestModel(true);
                onModelDegisim("");
                return;
              }
              onModelDegisim(olay.target.value);
            }}
            className={alanSinifi(modelHatasi)}
          >
            <option value="">Seçiniz</option>
            {modeller.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value={ELLE}>Listede yok — elle yaz</option>
          </select>
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
