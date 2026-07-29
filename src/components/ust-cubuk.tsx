import Link from "next/link";

import { cikisYap } from "@/actions/kimlik";
import type { OturumKullanicisi } from "@/lib/yetki";

/**
 * Üst çubuk: otopark adı, açık vardiya rozeti, kullanıcı ve çıkış.
 * Ana gezinme altta (bkz. alt-menu.tsx) — başparmakla erişilebilsin diye.
 */
export function UstCubuk({
  kullanici,
  otoparkAdi,
  vardiyaAcik,
}: {
  kullanici: OturumKullanicisi;
  otoparkAdi: string;
  vardiyaAcik: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-300 bg-white">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-3 py-2">
        <Link href="/" className="flex min-h-12 flex-1 items-center gap-2 font-bold text-neutral-900">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-lg text-white"
          >
            P
          </span>
          <span className="truncate">{otoparkAdi}</span>
        </Link>

        <Link
          href="/vardiya"
          className={`flex min-h-12 items-center rounded-lg px-3 text-sm font-bold ${
            vardiyaAcik
              ? "bg-green-100 text-green-900"
              : "animate-pulse bg-amber-100 text-amber-900"
          }`}
        >
          {vardiyaAcik ? "Vardiya açık" : "Vardiya yok"}
        </Link>

        <div className="hidden text-right text-sm sm:block">
          <div className="font-semibold text-neutral-900">{kullanici.adSoyad}</div>
          <div className="text-neutral-600">
            {kullanici.rol === "ADMIN" ? "Yönetici" : "Görevli"}
          </div>
        </div>

        <form action={cikisYap}>
          <button
            type="submit"
            className="flex min-h-12 min-w-12 items-center justify-center rounded-lg border-2 border-neutral-300 px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
            title="Çıkış yap"
          >
            Çıkış
          </button>
        </form>
      </div>
    </header>
  );
}
