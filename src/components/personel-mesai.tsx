"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { gelisSaatiniDuzelt, type PersonelDurumu } from "@/actions/personel";
import { SaatInput } from "@/components/saat-input";

export type GelisKaydi = {
  id: string;
  adSoyad: string;
  rol: "ADMIN" | "GOREVLI";
  /** "HH:MM" — İstanbul saatiyle. */
  saat: string;
  duzeltildi: boolean;
  /** Düzeltildiyse orijinal otomatik kayıt ("HH:MM"). */
  eskiSaat: string | null;
};

function KaydetButonu() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 rounded-lg bg-blue-700 px-4 text-sm font-bold text-white disabled:bg-neutral-400"
    >
      {pending ? "…" : "Kaydet"}
    </button>
  );
}

/** Tek satırın saat düzeltme formu. */
function SaatDuzelt({ kayit, onBitti }: { kayit: GelisKaydi; onBitti: () => void }) {
  const [durum, islem] = useActionState<PersonelDurumu, FormData>(gelisSaatiniDuzelt, {});
  const [saat, setSaat] = useState(kayit.saat);

  useEffect(() => {
    if (durum.basarili) onBitti();
  }, [durum.basarili, onBitti]);

  return (
    <form action={islem} className="mt-2 space-y-2 rounded-lg bg-neutral-50 p-3">
      <input type="hidden" name="kayitId" value={kayit.id} />
      <input type="hidden" name="saat" value={saat} />

      <SaatInput
        etiket={`${kayit.adSoyad} — gerçek geliş saati`}
        deger={saat}
        onDegisim={setSaat}
        hata={durum.alanHatalari?.saat ?? durum.hata}
        ipucu="Değişiklik işlem günlüğüne kaydedilir."
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBitti}
          className="min-h-12 rounded-lg border-2 border-neutral-300 px-4 text-sm font-semibold text-neutral-700"
        >
          Vazgeç
        </button>
        <KaydetButonu />
      </div>
    </form>
  );
}

/**
 * Personel geliş saatleri (yalnızca yönetici görür).
 *
 * Geliş kaydı, çalışan uygulamaya giriş yaptığında otomatik oluşur. Bu saat
 * fiili gelişten biraz sonra olabilir (10:00'da gelip 10:15'te giriş yapmak),
 * o yüzden yönetici düzeltebilir.
 */
export function PersonelMesai({
  gelenler,
  gelmeyenler,
}: {
  gelenler: GelisKaydi[];
  gelmeyenler: { id: string; adSoyad: string }[];
}) {
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-neutral-300 bg-white">
      <h2 className="border-b border-neutral-200 px-4 py-3 text-base font-bold text-neutral-900">
        Personel geliş saatleri — bugün
      </h2>

      {gelenler.length === 0 ? (
        <p className="px-4 py-6 text-center text-neutral-600">
          Bugün henüz kimse giriş yapmadı.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200">
          {gelenler.map((kayit, sira) => (
            <li key={kayit.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Kaçıncı geldiği: "ilk açan kim" sorusunun cevabı */}
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-700"
                >
                  {sira + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-neutral-900">{kayit.adSoyad}</div>
                  <div className="text-sm text-neutral-600">
                    {kayit.rol === "ADMIN" ? "Yönetici" : "Görevli"}
                    {kayit.duzeltildi && kayit.eskiSaat && (
                      <span className="ml-2 text-amber-800">
                        (düzeltildi — otomatik kayıt {kayit.eskiSaat})
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-xl font-bold tabular-nums text-neutral-900">
                    {kayit.saat}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDuzenlenen(duzenlenen === kayit.id ? null : kayit.id)}
                  className="min-h-12 shrink-0 rounded-lg border-2 border-neutral-300 px-3 text-sm font-semibold text-neutral-700"
                >
                  {duzenlenen === kayit.id ? "Kapat" : "Düzelt"}
                </button>
              </div>

              {duzenlenen === kayit.id && (
                <SaatDuzelt kayit={kayit} onBitti={() => setDuzenlenen(null)} />
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Gelmeyenler: "kim gelmedi" sorusu "kim geldi"den daha kritik */}
      {gelmeyenler.length > 0 && (
        <div className="border-t border-neutral-200 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-700">
            Bugün giriş yapmayan ({gelmeyenler.length})
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            {gelmeyenler.map((k) => k.adSoyad).join(", ")}
          </p>
        </div>
      )}

      <p className="border-t border-neutral-200 px-4 py-2 text-xs text-neutral-500">
        Geliş saati, çalışan uygulamaya giriş yaptığı an otomatik kaydedilir.
      </p>
    </section>
  );
}
