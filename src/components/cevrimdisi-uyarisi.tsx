"use client";

import { useEffect, useState } from "react";

/**
 * İnternet bağlantısı koptuğunda ekranın üstünde sabit uyarı gösterir.
 *
 * Sahada mobil veriyle çalışıldığı için bağlantı sık kesilebilir; görevli
 * kaydın gitmediğini fark etmezse araç ücretsiz çıkar. Form verisi ayrıca
 * `useTaslak` ile localStorage'a yazılır (bkz. hooks/use-taslak.ts).
 */
export function CevrimdisiUyarisi() {
  const [cevrimdisi, setCevrimdisi] = useState(false);

  useEffect(() => {
    // İlk render sunucuda yapıldığı için navigator'a burada bakılır.
    setCevrimdisi(!navigator.onLine);

    const bagliOldu = () => setCevrimdisi(false);
    const koptu = () => setCevrimdisi(true);

    window.addEventListener("online", bagliOldu);
    window.addEventListener("offline", koptu);
    return () => {
      window.removeEventListener("online", bagliOldu);
      window.removeEventListener("offline", koptu);
    };
  }, []);

  if (!cevrimdisi) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="sticky top-0 z-50 flex min-h-12 items-center justify-center gap-2 bg-red-700 px-3 py-2 text-center text-base font-bold text-white shadow-lg"
    >
      <span aria-hidden className="text-xl">
        ⚠
      </span>
      <span>İnternet bağlantısı yok — işlemler kaydedilmeyecek. Yazdıklarınız korunuyor.</span>
    </div>
  );
}
