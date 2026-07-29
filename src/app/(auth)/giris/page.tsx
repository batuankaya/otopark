import type { Metadata } from "next";

import { GirisFormu } from "@/components/giris-formu";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Giriş — Otopark Yönetim Sistemi",
};

export default async function GirisSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ bilgi?: string }>;
}) {
  const { bilgi } = await searchParams;

  // Otopark adı ayarlardan okunur; kurulum tamamlanmadıysa varsayılan kullanılır.
  const ayar = await prisma.ayar
    .findUnique({ where: { id: 1 }, select: { otoparkAdi: true } })
    .catch(() => null);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div
            aria-hidden
            className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-700 text-3xl text-white"
          >
            P
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">
            {ayar?.otoparkAdi ?? "Otopark Yönetim Sistemi"}
          </h1>
          <p className="mt-1 text-base text-neutral-600">Personel girişi</p>
        </div>

        {bilgi === "oturum-sonlandi" && (
          <p
            role="status"
            className="mb-4 rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-3 text-base font-semibold text-amber-900"
          >
            Oturumunuz sonlandırıldı. Lütfen tekrar giriş yapın.
          </p>
        )}

        <div className="rounded-xl border border-neutral-300 bg-white p-6 shadow-sm">
          <GirisFormu />
        </div>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Bu sistem yalnızca yetkili personel içindir. Tüm işlemler kayıt altına alınır.
        </p>
      </div>
    </main>
  );
}
