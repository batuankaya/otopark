"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Form verisini localStorage'da tutar.
 *
 * Sahada internet koptuğunda ya da telefon uygulamayı arka planda kapattığında
 * görevlinin yazdıkları kaybolmasın diye kullanılır. Kayıt başarıyla
 * tamamlandığında `temizle()` çağrılır.
 */
export function useTaslak<T extends Record<string, unknown>>(
  anahtar: string,
  baslangic: T,
): {
  taslak: T;
  guncelle: (yama: Partial<T>) => void;
  temizle: () => void;
  yuklendi: boolean;
} {
  const [taslak, setTaslak] = useState<T>(baslangic);
  const [yuklendi, setYuklendi] = useState(false);

  // İlk yüklemede kayıtlı taslağı geri getir.
  useEffect(() => {
    try {
      const ham = window.localStorage.getItem(anahtar);
      if (ham) {
        const cozulmus = JSON.parse(ham) as Partial<T>;
        setTaslak((oncekii) => ({ ...oncekii, ...cozulmus }));
      }
    } catch {
      // Bozuk/erişilemez localStorage işlemi engellememeli.
    }
    setYuklendi(true);
  }, [anahtar]);

  const guncelle = useCallback(
    (yama: Partial<T>) => {
      setTaslak((onceki) => {
        const yeni = { ...onceki, ...yama };
        try {
          window.localStorage.setItem(anahtar, JSON.stringify(yeni));
        } catch {
          // Kota dolu olabilir; kullanıcıyı engellemeyelim.
        }
        return yeni;
      });
    },
    [anahtar],
  );

  const temizle = useCallback(() => {
    try {
      window.localStorage.removeItem(anahtar);
    } catch {
      /* yok say */
    }
    setTaslak(baslangic);
    // baslangic her render'da yeni nesne olabilir; bilerek bağımlılığa alınmadı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtar]);

  return { taslak, guncelle, temizle, yuklendi };
}
