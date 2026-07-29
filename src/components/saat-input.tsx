"use client";

import { useId } from "react";

/**
 * 24 saatlik saat girişi.
 *
 * Neden `<input type="time">` kullanılmıyor?
 * Tarayıcı, saat seçicisini sayfanın değil KENDİ dil ayarının biçimine göre
 * çizer. İşletim sistemi İngilizceyse görevliye AM/PM'li seçici çıkıyordu.
 * Bu alan her ortamda 24 saat biçimindedir ve mobilde sayısal klavye açar.
 *
 * Görevli "1525" yazar, alan "15:25" yapar.
 */
export function SaatInput({
  deger,
  onDegisim,
  etiket,
  hata,
  ipucu,
  ad,
  enFazla,
}: {
  /** "HH:MM" ya da yazım sürerken kısmi değer. */
  deger: string;
  onDegisim: (deger: string) => void;
  etiket: string;
  hata?: string;
  ipucu?: string;
  ad?: string;
  /** Bu saatten sonrası kabul edilmez ("HH:MM") — bilgi amaçlı gösterilir. */
  enFazla?: string;
}) {
  const id = useId();
  const hataId = `${id}-hata`;

  const bicimlendir = (ham: string) => {
    const rakamlar = ham.replace(/\D/g, "").slice(0, 4);
    if (rakamlar.length <= 2) return rakamlar;
    return `${rakamlar.slice(0, 2)}:${rakamlar.slice(2)}`;
  };

  /** Tamamlanmış ama geçersiz saatleri (25:70 gibi) kullanıcıya bildir. */
  const tamamlandi = /^\d{2}:\d{2}$/.test(deger);
  const gecersiz =
    tamamlandi && (Number(deger.slice(0, 2)) > 23 || Number(deger.slice(3)) > 59);
  const eksik = deger.length > 0 && !tamamlandi;

  const gosterilecekHata =
    hata ??
    (gecersiz ? "Saat 00:00 – 23:59 arasında olmalıdır." : undefined) ??
    (eksik ? "Saati tam yazın. Örnek: 15:25" : undefined);

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-neutral-700">
        {etiket}
      </label>

      <input
        id={id}
        name={ad}
        type="text"
        value={deger}
        onChange={(olay) => onDegisim(bicimlendir(olay.target.value))}
        // Sayısal klavye; tarayıcının saat seçicisi devreye girmez.
        inputMode="numeric"
        autoComplete="off"
        maxLength={5}
        placeholder="15:25"
        aria-invalid={!!gosterilecekHata}
        aria-describedby={gosterilecekHata ? hataId : undefined}
        className={`h-16 w-full rounded-lg border-2 px-3 text-center font-mono text-3xl font-bold tabular-nums text-neutral-900 placeholder:font-normal placeholder:text-neutral-400 focus:outline-none focus:ring-4 ${
          gosterilecekHata
            ? "border-red-600 focus:border-red-700 focus:ring-red-200"
            : "border-neutral-300 focus:border-blue-700 focus:ring-blue-200"
        }`}
      />

      {gosterilecekHata ? (
        <p id={hataId} role="alert" className="mt-1 text-sm font-semibold text-red-700">
          {gosterilecekHata}
        </p>
      ) : ipucu ? (
        <p className="mt-1 text-sm text-neutral-600">
          {ipucu}
          {enFazla && ` Şu an ${enFazla}.`}
        </p>
      ) : null}
    </div>
  );
}
