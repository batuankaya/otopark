"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { girisYap, type GirisDurumu } from "@/actions/kimlik";

function GonderButonu() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-14 w-full rounded-lg bg-blue-700 text-lg font-bold text-white transition-colors hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:bg-neutral-400"
    >
      {pending ? "Giriş yapılıyor…" : "GİRİŞ YAP"}
    </button>
  );
}

export function GirisFormu() {
  const [durum, islem] = useActionState<GirisDurumu, FormData>(girisYap, {});

  return (
    <form action={islem} className="space-y-4" noValidate>
      {durum.hata && (
        <div
          role="alert"
          className="rounded-lg border-2 border-red-600 bg-red-50 px-4 py-3 text-base font-semibold text-red-800"
        >
          {durum.hata}
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1.5 block text-base font-semibold text-neutral-900">
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="ornek@otopark.local"
          aria-invalid={!!durum.alanHatalari?.email}
          className="h-14 w-full rounded-lg border-2 border-neutral-400 bg-white px-4 text-lg text-neutral-900 focus:border-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
        />
        {durum.alanHatalari?.email && (
          <p role="alert" className="mt-1.5 text-base font-semibold text-red-700">
            {durum.alanHatalari.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="sifre" className="mb-1.5 block text-base font-semibold text-neutral-900">
          Şifre
        </label>
        <input
          id="sifre"
          name="sifre"
          type="password"
          required
          autoComplete="current-password"
          aria-invalid={!!durum.alanHatalari?.sifre}
          className="h-14 w-full rounded-lg border-2 border-neutral-400 bg-white px-4 text-lg text-neutral-900 focus:border-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
        />
        {durum.alanHatalari?.sifre && (
          <p role="alert" className="mt-1.5 text-base font-semibold text-red-700">
            {durum.alanHatalari.sifre}
          </p>
        )}
      </div>

      <GonderButonu />
    </form>
  );
}
