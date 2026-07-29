"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { giderSil, type GiderDurumu } from "@/actions/gider";

function OnayButonu() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 rounded-lg bg-red-700 px-3 text-sm font-bold text-white disabled:bg-neutral-400"
    >
      {pending ? "Siliniyor…" : "Sil"}
    </button>
  );
}

/** Gideri siler — yanlışlıkla silinmesin diye tek adım onay ister. */
export function GiderSilButonu({ giderId }: { giderId: string }) {
  const router = useRouter();
  const [durum, islem] = useActionState<GiderDurumu, FormData>(giderSil, {});
  const [onayBekliyor, setOnayBekliyor] = useState(false);

  useEffect(() => {
    if (durum.basarili) {
      setOnayBekliyor(false);
      router.refresh();
    }
  }, [durum.basarili, router]);

  if (!onayBekliyor) {
    return (
      <button
        type="button"
        onClick={() => setOnayBekliyor(true)}
        aria-label="Gideri sil"
        className="min-h-12 shrink-0 rounded-lg border-2 border-neutral-300 px-3 text-sm font-semibold text-neutral-600 hover:bg-neutral-50"
      >
        Sil
      </button>
    );
  }

  return (
    <form action={islem} className="flex shrink-0 items-center gap-1">
      <input type="hidden" name="giderId" value={giderId} />
      <button
        type="button"
        onClick={() => setOnayBekliyor(false)}
        className="min-h-12 rounded-lg border-2 border-neutral-300 px-2 text-sm font-semibold text-neutral-700"
      >
        Vazgeç
      </button>
      <OnayButonu />
      {durum.hata && (
        <span role="alert" className="text-xs font-semibold text-red-700">
          {durum.hata}
        </span>
      )}
    </form>
  );
}
