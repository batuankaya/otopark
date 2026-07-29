"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { vardiyaAc, vardiyaKapat, type VardiyaDurumu } from "@/actions/vardiya";
import { formatlaPara, tutarAyristir } from "@/lib/para";

function Gonder({ etiket, bekleyen, renk }: { etiket: string; bekleyen: string; renk: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex min-h-16 w-full items-center justify-center rounded-xl text-xl font-bold text-white disabled:bg-neutral-400 ${renk}`}
    >
      {pending ? bekleyen : etiket}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Vardiya aç
// ---------------------------------------------------------------------------

export function VardiyaAcFormu() {
  const router = useRouter();
  const [durum, islem] = useActionState<VardiyaDurumu, FormData>(vardiyaAc, {});

  useEffect(() => {
    if (durum.basarili) router.refresh();
  }, [durum.basarili, router]);

  return (
    <form action={islem} className="space-y-3 rounded-xl border border-neutral-300 bg-white p-4">
      <h2 className="text-lg font-bold text-neutral-900">Vardiya aç</h2>

      {durum.hata && (
        <p role="alert" className="rounded-lg border-2 border-red-600 bg-red-50 px-3 py-2 font-semibold text-red-800">
          {durum.hata}
        </p>
      )}

      <div>
        <label htmlFor="acilisKasa" className="mb-1 block text-base font-semibold text-neutral-900">
          Kasadaki başlangıç nakiti (TL)
        </label>
        <input
          id="acilisKasa"
          name="acilisKasa"
          type="text"
          inputMode="decimal"
          defaultValue="0"
          required
          aria-invalid={!!durum.alanHatalari?.acilisKasa}
          className="h-16 w-full rounded-lg border-2 border-neutral-400 px-4 text-2xl font-bold tabular-nums focus:border-blue-700 focus:outline-none"
        />
        {durum.alanHatalari?.acilisKasa && (
          <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
            {durum.alanHatalari.acilisKasa}
          </p>
        )}
        <p className="mt-1 text-sm text-neutral-600">
          Vardiyaya başlarken kasada bulunan para. Gün sonunda fark bu tutara göre hesaplanır.
        </p>
      </div>

      <div>
        <label htmlFor="acilisNotlar" className="mb-1 block text-sm font-semibold text-neutral-700">
          Not (isteğe bağlı)
        </label>
        <textarea
          id="acilisNotlar"
          name="notlar"
          rows={2}
          className="w-full rounded-lg border-2 border-neutral-300 p-3 text-base focus:border-blue-700 focus:outline-none"
        />
      </div>

      <Gonder etiket="VARDİYAYI AÇ" bekleyen="Açılıyor…" renk="bg-green-700 hover:bg-green-800" />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Vardiya kapat
// ---------------------------------------------------------------------------

export function VardiyaKapatFormu({
  vardiyaId,
  beklenenKasa,
  toplamNakit,
  toplamKart,
  acilisKasa,
  nakitGider,
  kartGider,
}: {
  vardiyaId: string;
  beklenenKasa: number;
  toplamNakit: number;
  toplamKart: number;
  acilisKasa: number;
  nakitGider: number;
  kartGider: number;
}) {
  const router = useRouter();
  const [durum, islem] = useActionState<VardiyaDurumu, FormData>(vardiyaKapat, {});
  const [acik, setAcik] = useState(false);
  const [sayilanKasa, setSayilanKasa] = useState("");

  useEffect(() => {
    if (durum.basarili && durum.vardiyaId) {
      router.push(`/vardiya/${durum.vardiyaId}/rapor`);
    }
  }, [durum.basarili, durum.vardiyaId, router]);

  const sayilan = tutarAyristir(sayilanKasa);
  const fark = sayilan === null ? null : Math.round((sayilan - beklenenKasa) * 100) / 100;

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="flex min-h-16 w-full items-center justify-center rounded-xl border-2 border-red-600 bg-white text-xl font-bold text-red-700 hover:bg-red-50"
      >
        VARDİYAYI KAPAT
      </button>
    );
  }

  return (
    <form action={islem} className="space-y-4 rounded-xl border-2 border-red-500 bg-white p-4">
      <input type="hidden" name="vardiyaId" value={vardiyaId} />

      <h2 className="text-lg font-bold text-neutral-900">Kasa sayımı</h2>

      {durum.hata && (
        <p role="alert" className="rounded-lg border-2 border-red-600 bg-red-50 px-3 py-2 font-semibold text-red-800">
          {durum.hata}
        </p>
      )}

      {/* Beklenen kasa dökümü */}
      <dl className="space-y-1 rounded-lg bg-neutral-50 p-3 text-base">
        <div className="flex justify-between">
          <dt className="text-neutral-600">Açılış kasası</dt>
          <dd className="font-semibold tabular-nums">{formatlaPara(acilisKasa)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-600">+ Nakit tahsilat</dt>
          <dd className="font-semibold tabular-nums">{formatlaPara(toplamNakit)}</dd>
        </div>
        {nakitGider > 0 && (
          <div className="flex justify-between">
            <dt className="text-neutral-600">− Nakit gider</dt>
            <dd className="font-semibold tabular-nums text-red-700">
              −{formatlaPara(nakitGider)}
            </dd>
          </div>
        )}
        <div className="flex justify-between border-t border-neutral-300 pt-1">
          <dt className="font-bold text-neutral-900">Kasada olması gereken</dt>
          <dd className="font-bold tabular-nums text-blue-800">{formatlaPara(beklenenKasa)}</dd>
        </div>
        <div className="flex justify-between pt-1 text-sm">
          <dt className="text-neutral-500">Kart tahsilatı (kasaya girmez)</dt>
          <dd className="tabular-nums text-neutral-500">{formatlaPara(toplamKart)}</dd>
        </div>
        {kartGider > 0 && (
          <div className="flex justify-between text-sm">
            <dt className="text-neutral-500">Kart gideri (kasadan çıkmaz)</dt>
            <dd className="tabular-nums text-neutral-500">−{formatlaPara(kartGider)}</dd>
          </div>
        )}
      </dl>

      <div>
        <label htmlFor="kapanisKasa" className="mb-1 block text-base font-semibold text-neutral-900">
          Kasada sayılan nakit (TL)
        </label>
        <input
          id="kapanisKasa"
          name="kapanisKasa"
          type="text"
          inputMode="decimal"
          value={sayilanKasa}
          onChange={(olay) => setSayilanKasa(olay.target.value)}
          required
          autoFocus
          placeholder="0,00"
          aria-invalid={!!durum.alanHatalari?.kapanisKasa}
          className="h-16 w-full rounded-lg border-2 border-neutral-400 px-4 text-2xl font-bold tabular-nums focus:border-blue-700 focus:outline-none"
        />
        {durum.alanHatalari?.kapanisKasa && (
          <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
            {durum.alanHatalari.kapanisKasa}
          </p>
        )}
      </div>

      {/* Fark — sayım girildikçe anında hesaplanır */}
      {fark !== null && (
        <div
          className={`rounded-lg border-2 p-3 text-center ${
            fark === 0
              ? "border-green-600 bg-green-50"
              : fark < 0
                ? "border-red-600 bg-red-50"
                : "border-amber-500 bg-amber-50"
          }`}
        >
          <div className="text-sm font-semibold uppercase tracking-wide text-neutral-600">Fark</div>
          <div
            className={`text-3xl font-bold tabular-nums ${
              fark === 0 ? "text-green-700" : fark < 0 ? "text-red-700" : "text-amber-700"
            }`}
          >
            {fark > 0 ? "+" : ""}
            {formatlaPara(fark)}
          </div>
          <div className="mt-1 text-sm font-semibold">
            {fark === 0 ? "Kasa tutuyor." : fark < 0 ? "Kasa açığı var." : "Kasada fazla var."}
          </div>
        </div>
      )}

      <div>
        <label htmlFor="kapanisNotlar" className="mb-1 block text-sm font-semibold text-neutral-700">
          Not {fark !== null && fark !== 0 && <span className="text-red-700">(fark için açıklama yazın)</span>}
        </label>
        <textarea
          id="kapanisNotlar"
          name="notlar"
          rows={2}
          className="w-full rounded-lg border-2 border-neutral-300 p-3 text-base focus:border-blue-700 focus:outline-none"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAcik(false)}
          className="flex min-h-16 items-center justify-center rounded-xl border-2 border-neutral-300 px-5 font-semibold text-neutral-700"
        >
          Vazgeç
        </button>
        <Gonder etiket="VARDİYAYI KAPAT" bekleyen="Kapatılıyor…" renk="bg-red-700 hover:bg-red-800" />
      </div>
    </form>
  );
}
