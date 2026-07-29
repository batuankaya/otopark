"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { kaydiIptalEt, type IslemDurumu } from "@/actions/park";

function OnayButonu() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-14 flex-1 items-center justify-center rounded-lg bg-red-700 text-lg font-bold text-white hover:bg-red-800 disabled:bg-neutral-400"
    >
      {pending ? "İptal ediliyor…" : "KAYDI İPTAL ET"}
    </button>
  );
}

/**
 * Kayıt iptali (soft delete) — yalnızca ADMIN'e gösterilir.
 * Sebep girilmeden gönderilemez; işlem günlüğüne yazılır.
 */
export function KayitIptalButonu({ parkKaydiId }: { parkKaydiId: string }) {
  const [acik, setAcik] = useState(false);
  const [durum, islem] = useActionState<IslemDurumu, FormData>(kaydiIptalEt, {});

  useEffect(() => {
    if (durum.basarili) setAcik(false);
  }, [durum.basarili]);

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="flex min-h-14 items-center justify-center rounded-lg border-2 border-red-300 px-4 font-semibold text-red-700 hover:bg-red-50"
      >
        İptal
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border-2 border-red-400 bg-red-50 p-3">
      <p className="text-base font-bold text-red-900">Kaydı iptal et</p>
      <p className="mt-0.5 text-sm text-red-900">
        Kayıt silinmez, iptal edilmiş olarak işaretlenir. Sebep zorunludur.
      </p>

      <form action={islem} className="mt-2 space-y-2">
        <input type="hidden" name="parkKaydiId" value={parkKaydiId} />

        <textarea
          name="iptalSebebi"
          rows={2}
          required
          minLength={5}
          placeholder="İptal sebebi (en az 5 karakter)"
          aria-invalid={!!durum.alanHatalari?.iptalSebebi}
          className="w-full rounded-lg border-2 border-red-300 p-3 text-base focus:border-red-600 focus:outline-none"
        />

        {(durum.alanHatalari?.iptalSebebi || durum.hata) && (
          <p role="alert" className="text-sm font-semibold text-red-800">
            {durum.alanHatalari?.iptalSebebi ?? durum.hata}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAcik(false)}
            className="flex min-h-14 items-center justify-center rounded-lg border-2 border-neutral-300 bg-white px-4 font-semibold text-neutral-700"
          >
            Vazgeç
          </button>
          <OnayButonu />
        </div>
      </form>
    </div>
  );
}
