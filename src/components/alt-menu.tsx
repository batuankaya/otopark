"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Alt gezinme çubuğu — mobilde başparmak menzilinde kalsın diye ekranın
 * altına sabitlendi. Her hedef en az 56px yüksekliğinde.
 */
const BAGLANTILAR = [
  { yol: "/", etiket: "Pano", simge: "⌂" },
  { yol: "/ara", etiket: "Ara", simge: "⌕" },
  { yol: "/icerideki-araclar", etiket: "İçeride", simge: "▤" },
  { yol: "/vardiya", etiket: "Vardiya", simge: "₺" },
  { yol: "/giderler", etiket: "Gider", simge: "−" },
] as const;

const ADMIN_BAGLANTILARI = [
  { yol: "/raporlar", etiket: "Rapor", simge: "◷" },
  { yol: "/ayarlar", etiket: "Ayarlar", simge: "⚙" },
] as const;

export function AltMenu({ rol }: { rol: "ADMIN" | "GOREVLI" }) {
  const yol = usePathname();
  const baglantilar = rol === "ADMIN" ? [...BAGLANTILAR, ...ADMIN_BAGLANTILARI] : BAGLANTILAR;

  const aktifMi = (hedef: string) => (hedef === "/" ? yol === "/" : yol.startsWith(hedef));

  return (
    <nav
      aria-label="Ana menü"
      className="sticky bottom-0 z-40 border-t border-neutral-300 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-4xl">
        {baglantilar.map((baglanti) => {
          const aktif = aktifMi(baglanti.yol);
          return (
            <li key={baglanti.yol} className="flex-1">
              <Link
                href={baglanti.yol}
                aria-current={aktif ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-xs font-semibold ${
                  aktif
                    ? "border-t-4 border-blue-700 text-blue-800"
                    : "border-t-4 border-transparent text-neutral-600"
                }`}
              >
                <span aria-hidden className="text-lg leading-none">
                  {baglanti.simge}
                </span>
                {baglanti.etiket}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
