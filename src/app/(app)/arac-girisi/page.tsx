import Link from "next/link";
import type { Metadata } from "next";

import { AracGirisFormu } from "@/components/arac-giris-formu";
import { aktifTarifeyiAl, dolulukAl } from "@/lib/sorgular";
import { acikVardiyayiBul, oturumZorunlu } from "@/lib/yetki";

export const metadata: Metadata = { title: "Araç Girişi" };
export const dynamic = "force-dynamic";

export default async function AracGirisiSayfasi() {
  await oturumZorunlu(); // oturum ve hesap geçerliliği kontrolü
  const [tarife, doluluk, acikVardiya] = await Promise.all([
    aktifTarifeyiAl(),
    dolulukAl(),
    acikVardiyayiBul(),
  ]);

  if (!acikVardiya) {
    return (
      <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-5">
        <h1 className="text-xl font-bold text-amber-900">Otoparkta açık vardiya yok</h1>
        <p className="mt-2 text-base text-amber-900">
          Tahsil edilen paranın kasaya yazılabilmesi için vardiya açılmalı. Vardiya ortaktır:
          bir görevli açtığında diğerleri de aynı kasaya işlem yapar.
        </p>
        <Link
          href="/vardiya"
          className="mt-4 flex min-h-14 items-center justify-center rounded-lg bg-amber-600 text-lg font-bold text-white hover:bg-amber-700"
        >
          VARDİYA AÇ
        </Link>
      </div>
    );
  }

  if (!tarife) {
    return (
      <div className="rounded-xl border-2 border-red-600 bg-red-50 p-5">
        <h1 className="text-xl font-bold text-red-800">Tanımlı tarife yok</h1>
        <p className="mt-2 text-base text-red-900">
          Ücret hesaplanamayacağı için araç girişi yapılamıyor. Yöneticinin Ayarlar &gt; Tarife
          bölümünden bir tarife tanımlaması gerekiyor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-neutral-900">Araç Girişi</h1>
        <span className="text-sm font-semibold text-neutral-600">
          {doluluk.bosYer} boş / {doluluk.kapasite}
        </span>
      </div>

      {doluluk.doluMu && (
        <p
          role="alert"
          className="rounded-lg border-2 border-red-600 bg-red-50 px-4 py-3 font-bold text-red-800"
        >
          Otopark dolu — yeni araç kaydı oluşturulamaz.
        </p>
      )}

      <AracGirisFormu />
    </div>
  );
}
