"use client";

import { forwardRef, useId } from "react";
import { gosterimPlakasiOlustur, maskelePlaka, normalizePlaka } from "@/lib/plaka";

type Props = {
  /**
   * Türk modunda normalize plaka ("34A1234"),
   * yabancı modda görevlinin yazdığı ham metin ("CB 1234 AK").
   */
  deger: string;
  onDegisim: (deger: string) => void;
  /** Yabancı plaka modu: Türk maskesi ve kalıp zorlaması uygulanmaz. */
  yabanci?: boolean;
  etiket?: string;
  hata?: string;
  ipucu?: string;
  otomatikOdak?: boolean;
  ad?: string;
  devreDisi?: boolean;
};

/**
 * Plaka giriş alanı.
 *
 * - Yazılan her karakter anında büyük harfe çevrilir
 * - Türk modunda maskelenir (34 ABC 12); yabancı modda görevlinin yazdığı
 *   düzen korunur çünkü gruplama ülkeden ülkeye değişir
 * - Mobilde harf klavyesi açılır, otomatik düzeltme/öneri kapalıdır
 * - Alan yüksekliği 64px: eldivenle ve tek elle kullanılabilsin diye
 */
export const PlakaInput = forwardRef<HTMLInputElement, Props>(function PlakaInput(
  {
    deger,
    onDegisim,
    yabanci = false,
    etiket = "Plaka",
    hata,
    ipucu,
    otomatikOdak,
    ad = "plaka",
    devreDisi,
  },
  ref,
) {
  const id = useId();
  const hataId = `${id}-hata`;
  const ipucuId = `${id}-ipucu`;

  const gosterilenDeger = yabanci ? deger : maskelePlaka(deger);

  const degisimiIsle = (ham: string) => {
    onDegisim(yabanci ? gosterimPlakasiOlustur(ham) : normalizePlaka(ham));
  };

  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-1.5 block text-base font-semibold text-neutral-900">
        {etiket}
      </label>

      <input
        ref={ref}
        id={id}
        name={ad}
        type="text"
        value={gosterilenDeger}
        onChange={(olay) => degisimiIsle(olay.target.value)}
        disabled={devreDisi}
        autoFocus={otomatikOdak}
        // Mobilde harf klavyesi + büyük harf; sözlük/otomatik düzeltme kapalı
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        maxLength={yabanci ? 18 : 12}
        placeholder={yabanci ? "CB 1234 AK" : "34 ABC 123"}
        aria-invalid={!!hata}
        aria-describedby={hata ? hataId : ipucu ? ipucuId : undefined}
        className={`h-16 w-full rounded-lg border-2 bg-white px-4 text-center font-mono text-3xl font-bold uppercase tracking-widest text-neutral-900 placeholder:font-normal placeholder:tracking-normal placeholder:text-neutral-400 focus:outline-none focus:ring-4 disabled:bg-neutral-100 ${
          hata
            ? "border-red-600 focus:border-red-700 focus:ring-red-200"
            : yabanci
              ? "border-amber-500 focus:border-amber-600 focus:ring-amber-200"
              : "border-neutral-400 focus:border-blue-700 focus:ring-blue-200"
        }`}
      />

      {hata ? (
        <p id={hataId} role="alert" className="mt-1.5 text-base font-semibold text-red-700">
          {hata}
        </p>
      ) : ipucu ? (
        <p id={ipucuId} className="mt-1.5 text-sm text-neutral-600">
          {ipucu}
        </p>
      ) : null}
    </div>
  );
});
