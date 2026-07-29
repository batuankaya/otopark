"use client";

/** Fiş sayfasındaki yazdır butonu — yazdırırken kendisi gizlenir. */
export function FisYazdirButonlari() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex min-h-16 w-full items-center justify-center rounded-lg bg-blue-700 text-xl font-bold text-white hover:bg-blue-800"
    >
      FİŞİ YAZDIR
    </button>
  );
}
