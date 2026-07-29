"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { abonmanIptalEt, abonmanKaydet, type AbonmanDurumuSonucu } from "@/actions/abonman";
import { PlakaInput } from "@/components/plaka-input";
import { normalizePlaka } from "@/lib/plaka";
import { tarihGirdisiDegeri } from "@/lib/tarih";

type Mevcut = {
  id: string;
  plaka: string;
  musteriAdi: string;
  telefon: string | null;
  baslangicTarihi: string;
  bitisTarihi: string;
  aylikUcret: number;
  durum: "AKTIF" | "SURESI_DOLDU" | "IPTAL";
  notlar: string | null;
};

function Gonder({ duzenleme }: { duzenleme: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-16 w-full items-center justify-center rounded-xl bg-blue-700 text-xl font-bold text-white hover:bg-blue-800 disabled:bg-neutral-400"
    >
      {pending ? "Kaydediliyor…" : duzenleme ? "DEĞİŞİKLİKLERİ KAYDET" : "ABONMAN OLUŞTUR"}
    </button>
  );
}

export function AbonmanFormu({
  mevcut,
  varsayilanUcret,
}: {
  mevcut?: Mevcut;
  varsayilanUcret: number;
}) {
  const router = useRouter();
  const [durum, islem] = useActionState<AbonmanDurumuSonucu, FormData>(abonmanKaydet, {});
  const [iptalDurum, iptalIslem] = useActionState<AbonmanDurumuSonucu, FormData>(
    abonmanIptalEt,
    {},
  );
  const [plaka, setPlaka] = useState(mevcut ? normalizePlaka(mevcut.plaka) : "");

  useEffect(() => {
    if (durum.basarili || iptalDurum.basarili) router.push("/abonman");
  }, [durum.basarili, iptalDurum.basarili, router]);

  // Varsayılan: bugünden bir ay sonrası
  const bugun = new Date();
  const birAySonra = new Date(bugun);
  birAySonra.setMonth(birAySonra.getMonth() + 1);

  const alanSinifi =
    "h-14 w-full rounded-lg border-2 border-neutral-300 px-3 text-lg focus:border-blue-700 focus:outline-none";

  return (
    <div className="space-y-4">
      <form action={islem} className="space-y-4 rounded-xl border border-neutral-300 bg-white p-4">
        {mevcut && <input type="hidden" name="abonmanId" value={mevcut.id} />}
        <input type="hidden" name="plaka" value={plaka} />

        {(durum.hata || iptalDurum.hata) && (
          <p role="alert" className="rounded-lg border-2 border-red-600 bg-red-50 px-3 py-2 font-semibold text-red-800">
            {durum.hata ?? iptalDurum.hata}
          </p>
        )}

        <PlakaInput
          deger={plaka}
          onDegisim={setPlaka}
          hata={durum.alanHatalari?.plaka}
          otomatikOdak={!mevcut}
          ipucu="Araç kayıtlı değilse otomatik oluşturulur."
        />

        <div>
          <label htmlFor="musteriAdi" className="mb-1 block text-base font-semibold text-neutral-900">
            Müşteri adı / firma
          </label>
          <input
            id="musteriAdi"
            name="musteriAdi"
            defaultValue={mevcut?.musteriAdi}
            required
            autoComplete="off"
            aria-invalid={!!durum.alanHatalari?.musteriAdi}
            className={alanSinifi}
          />
          {durum.alanHatalari?.musteriAdi && (
            <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
              {durum.alanHatalari.musteriAdi}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="telefon" className="mb-1 block text-base font-semibold text-neutral-900">
            Telefon
          </label>
          <input
            id="telefon"
            name="telefon"
            type="tel"
            inputMode="tel"
            defaultValue={mevcut?.telefon ?? ""}
            placeholder="05XXXXXXXXX"
            autoComplete="off"
            aria-invalid={!!durum.alanHatalari?.telefon}
            className={alanSinifi}
          />
          {durum.alanHatalari?.telefon && (
            <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
              {durum.alanHatalari.telefon}
            </p>
          )}
          <p className="mt-1 text-xs text-neutral-500">
            KVKK: Telefon kişisel veridir, yalnızca yetkili personel görebilir.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="baslangicTarihi" className="mb-1 block text-base font-semibold text-neutral-900">
              Başlangıç
            </label>
            <input
              id="baslangicTarihi"
              name="baslangicTarihi"
              type="date"
              required
              defaultValue={
                mevcut ? tarihGirdisiDegeri(new Date(mevcut.baslangicTarihi)) : tarihGirdisiDegeri(bugun)
              }
              className={alanSinifi}
            />
          </div>
          <div>
            <label htmlFor="bitisTarihi" className="mb-1 block text-base font-semibold text-neutral-900">
              Bitiş
            </label>
            <input
              id="bitisTarihi"
              name="bitisTarihi"
              type="date"
              required
              defaultValue={
                mevcut ? tarihGirdisiDegeri(new Date(mevcut.bitisTarihi)) : tarihGirdisiDegeri(birAySonra)
              }
              aria-invalid={!!durum.alanHatalari?.bitisTarihi}
              className={alanSinifi}
            />
            {durum.alanHatalari?.bitisTarihi && (
              <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
                {durum.alanHatalari.bitisTarihi}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="aylikUcret" className="mb-1 block text-base font-semibold text-neutral-900">
            Aylık ücret (TL)
          </label>
          <input
            id="aylikUcret"
            name="aylikUcret"
            type="text"
            inputMode="decimal"
            required
            defaultValue={mevcut?.aylikUcret ?? varsayilanUcret}
            aria-invalid={!!durum.alanHatalari?.aylikUcret}
            className={`${alanSinifi} font-bold tabular-nums`}
          />
          {durum.alanHatalari?.aylikUcret && (
            <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
              {durum.alanHatalari.aylikUcret}
            </p>
          )}
        </div>

        {mevcut && (
          <div>
            <label htmlFor="durum" className="mb-1 block text-base font-semibold text-neutral-900">
              Durum
            </label>
            <select id="durum" name="durum" defaultValue={mevcut.durum} className={alanSinifi}>
              <option value="AKTIF">Aktif</option>
              <option value="SURESI_DOLDU">Süresi doldu</option>
              <option value="IPTAL">İptal</option>
            </select>
          </div>
        )}
        {!mevcut && <input type="hidden" name="durum" value="AKTIF" />}

        <div>
          <label htmlFor="abonmanNotlar" className="mb-1 block text-sm font-semibold text-neutral-700">
            Not
          </label>
          <textarea
            id="abonmanNotlar"
            name="notlar"
            rows={2}
            defaultValue={mevcut?.notlar ?? ""}
            className="w-full rounded-lg border-2 border-neutral-300 p-3 text-base focus:border-blue-700 focus:outline-none"
          />
        </div>

        <Gonder duzenleme={!!mevcut} />
      </form>

      {mevcut && mevcut.durum !== "IPTAL" && (
        <form action={iptalIslem}>
          <input type="hidden" name="abonmanId" value={mevcut.id} />
          <button
            type="submit"
            className="flex min-h-14 w-full items-center justify-center rounded-xl border-2 border-red-600 bg-white font-bold text-red-700 hover:bg-red-50"
          >
            ABONMANI İPTAL ET
          </button>
          <p className="mt-1.5 text-center text-xs text-neutral-500">
            Abonman silinmez, iptal olarak işaretlenir. Geçmiş park kayıtları korunur.
          </p>
        </form>
      )}
    </div>
  );
}
