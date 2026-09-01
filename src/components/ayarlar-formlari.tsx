"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  ayarlariKaydet,
  kullaniciKaydet,
  parkAlaniKaydet,
  tarifeKaydet,
  type AyarDurumu,
} from "@/actions/ayarlar";
import type { AracSinifi } from "@prisma/client";

import { ARAC_SINIFI_ETIKETLERI, ARAC_SINIFI_ORNEKLERI } from "@/lib/arac-sinifi";
import { formatlaPara } from "@/lib/para";

const ALAN =
  "h-14 w-full rounded-lg border-2 border-neutral-300 px-3 text-lg focus:border-blue-700 focus:outline-none";

function Kaydet({ etiket = "KAYDET" }: { etiket?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-14 w-full items-center justify-center rounded-lg bg-blue-700 text-lg font-bold text-white hover:bg-blue-800 disabled:bg-neutral-400"
    >
      {pending ? "Kaydediliyor…" : etiket}
    </button>
  );
}

function Geribildirim({ durum }: { durum: AyarDurumu }) {
  if (durum.hata) {
    return (
      <p role="alert" className="rounded-lg border-2 border-red-600 bg-red-50 px-3 py-2 font-semibold text-red-800">
        {durum.hata}
      </p>
    );
  }
  if (durum.basarili && durum.bilgi) {
    return (
      <p className="rounded-lg border-2 border-green-600 bg-green-50 px-3 py-2 font-semibold text-green-800">
        {durum.bilgi}
      </p>
    );
  }
  return null;
}

function Alan({
  ad,
  etiket,
  varsayilan,
  tip = "text",
  ipucu,
  hata,
  gerekli,
  inputMode,
}: {
  ad: string;
  etiket: string;
  varsayilan?: string | number | null;
  tip?: string;
  ipucu?: string;
  hata?: string;
  gerekli?: boolean;
  inputMode?: "text" | "numeric" | "decimal" | "tel";
}) {
  return (
    <div>
      <label htmlFor={`ayar-${ad}`} className="mb-1 block text-base font-semibold text-neutral-900">
        {etiket}
      </label>
      <input
        id={`ayar-${ad}`}
        name={ad}
        type={tip}
        inputMode={inputMode}
        defaultValue={varsayilan ?? ""}
        required={gerekli}
        autoComplete="off"
        aria-invalid={!!hata}
        className={ALAN}
      />
      {hata ? (
        <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
          {hata}
        </p>
      ) : ipucu ? (
        <p className="mt-1 text-sm text-neutral-600">{ipucu}</p>
      ) : null}
    </div>
  );
}

function Bolum({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-300 bg-white p-4">
      <h2 className="mb-3 text-lg font-bold text-neutral-900">{baslik}</h2>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Genel ayarlar
// ---------------------------------------------------------------------------

export function AyarlarFormu({
  mevcut,
}: {
  mevcut: {
    otoparkAdi: string;
    adres: string | null;
    telefon: string | null;
    toplamKapasite: number;
    fisAltNotu: string | null;
    vardiyaSifirlamaSaati: number;
  };
}) {
  const router = useRouter();
  const [durum, islem] = useActionState<AyarDurumu, FormData>(ayarlariKaydet, {});

  useEffect(() => {
    if (durum.basarili) router.refresh();
  }, [durum.basarili, router]);

  return (
    <Bolum baslik="Genel">
      <form action={islem} className="space-y-3">
        <Geribildirim durum={durum} />

        <Alan
          ad="otoparkAdi"
          etiket="Otopark adı"
          varsayilan={mevcut.otoparkAdi}
          gerekli
          hata={durum.alanHatalari?.otoparkAdi}
          ipucu="Fişin başlığında ve üst çubukta görünür."
        />
        <Alan ad="adres" etiket="Adres" varsayilan={mevcut.adres} hata={durum.alanHatalari?.adres} />
        <Alan
          ad="telefon"
          etiket="Telefon"
          varsayilan={mevcut.telefon}
          inputMode="tel"
          hata={durum.alanHatalari?.telefon}
        />
        <Alan
          ad="toplamKapasite"
          etiket="Toplam kapasite (araç)"
          varsayilan={mevcut.toplamKapasite}
          inputMode="numeric"
          gerekli
          hata={durum.alanHatalari?.toplamKapasite}
          ipucu="Doluluk göstergesi ve 'otopark dolu' uyarısı bunu kullanır."
        />
        <Alan
          ad="vardiyaSifirlamaSaati"
          etiket="Vardiya sıfırlama saati (0–23)"
          varsayilan={mevcut.vardiyaSifirlamaSaati}
          inputMode="numeric"
          gerekli
          hata={durum.alanHatalari?.vardiyaSifirlamaSaati}
          ipucu="Her gün bu saatte açık vardiya kapanır, kasa devrederek yenisi açılır. 12 = öğlen, 0 = gece yarısı."
        />
        <Alan
          ad="fisAltNotu"
          etiket="Fiş alt notu"
          varsayilan={mevcut.fisAltNotu}
          hata={durum.alanHatalari?.fisAltNotu}
        />

        <Kaydet />
      </form>
    </Bolum>
  );
}

// ---------------------------------------------------------------------------
// Tarife
// ---------------------------------------------------------------------------

export function TarifeFormu({
  aracSinifi,
  mevcut,
  gecmis,
}: {
  aracSinifi: AracSinifi;
  mevcut: {
    ad: string;
    ilkUcretsizDakika: number;
    ilkSaatUcreti: number;
    saatlikUcret: number;
    gunlukTavanUcret: number;
  } | null;
  gecmis: Array<{
    id: string;
    ad: string;
    aktif: boolean;
    gecerlilikBaslangic: string;
    ilkSaatUcreti: number;
    saatlikUcret: number;
    gunlukTavanUcret: number;
  }>;
}) {
  const router = useRouter();
  const [durum, islem] = useActionState<AyarDurumu, FormData>(tarifeKaydet, {});

  useEffect(() => {
    if (durum.basarili) router.refresh();
  }, [durum.basarili, router]);

  return (
    <Bolum baslik={`Tarife — ${ARAC_SINIFI_ETIKETLERI[aracSinifi]}`}>
      <p className="mb-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
        {ARAC_SINIFI_ORNEKLERI[aracSinifi]} için geçerlidir. Tarife düzenlenmez,{" "}
        <strong>yeni sürüm oluşturulur</strong>. Böylece geçmiş kayıtların ücreti değişmez; her
        park kaydı kendi tarifesini hatırlar.
      </p>

      <form action={islem} className="space-y-3">
        <Geribildirim durum={durum} />
        <input type="hidden" name="aracSinifi" value={aracSinifi} />

        <Alan
          ad="ad"
          etiket="Tarife adı"
          varsayilan={mevcut?.ad ?? `${ARAC_SINIFI_ETIKETLERI[aracSinifi]} Tarifesi`}
          gerekli
          hata={durum.alanHatalari?.ad}
        />
        <Alan
          ad="ilkUcretsizDakika"
          etiket="İlk ücretsiz süre (dakika)"
          varsayilan={mevcut?.ilkUcretsizDakika ?? 0}
          inputMode="numeric"
          gerekli
          hata={durum.alanHatalari?.ilkUcretsizDakika}
          ipucu="Bu süreyi aşmayan parklardan ücret alınmaz."
        />
        <Alan
          ad="ilkSaatUcreti"
          etiket="İlk saat ücreti (TL)"
          varsayilan={mevcut?.ilkSaatUcreti ?? (aracSinifi === "BUYUK" ? 150 : 100)}
          inputMode="decimal"
          gerekli
          hata={durum.alanHatalari?.ilkSaatUcreti}
          ipucu="Giriş ücreti. İlk saat tamamlanmasa da tam alınır."
        />
        <Alan
          ad="saatlikUcret"
          etiket="Sonraki her saat (TL)"
          varsayilan={mevcut?.saatlikUcret ?? (aracSinifi === "BUYUK" ? 100 : 50)}
          inputMode="decimal"
          gerekli
          hata={durum.alanHatalari?.saatlikUcret}
          ipucu="İlk saatten sonra başlayan her saat için eklenir. Örnek: ilk saat 100 TL + sonraki 50 TL ise 3 saat = 200 TL."
        />
        <Alan
          ad="gunlukTavanUcret"
          etiket="Günlük tavan ücreti (TL) — 0 = sınır yok"
          varsayilan={mevcut?.gunlukTavanUcret ?? 0}
          inputMode="decimal"
          gerekli
          hata={durum.alanHatalari?.gunlukTavanUcret}
          ipucu="Otopark saf saatlik çalışıyor; 0 bırakırsanız üst sınır uygulanmaz. Bir gün için üst sınır koymak isterseniz tutarı buraya yazmanız yeterli."
        />

        <Kaydet etiket="YENİ TARİFEYİ YÜRÜRLÜĞE AL" />
      </form>

      {gecmis.length > 0 && (
        <div className="mt-4 border-t border-neutral-200 pt-3">
          <h3 className="text-sm font-bold text-neutral-700">
            {ARAC_SINIFI_ETIKETLERI[aracSinifi]} tarife geçmişi
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {gecmis.map((tarife) => (
              <li key={tarife.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-neutral-700">
                  {tarife.ad}
                  {tarife.aktif && (
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
                      YÜRÜRLÜKTE
                    </span>
                  )}
                  <span className="ml-1 text-xs text-neutral-500">{tarife.gecerlilikBaslangic}</span>
                </span>
                <span className="shrink-0 tabular-nums text-neutral-600">
                  {formatlaPara(tarife.ilkSaatUcreti)} + {formatlaPara(tarife.saatlikUcret)}/sa
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Bolum>
  );
}

// ---------------------------------------------------------------------------
// Park alanları
// ---------------------------------------------------------------------------

export function ParkAlanlariBolumu({
  alanlar,
}: {
  alanlar: Array<{ id: string; ad: string; kapasite: number; sira: number; aktif: boolean }>;
}) {
  const router = useRouter();
  const [durum, islem] = useActionState<AyarDurumu, FormData>(parkAlaniKaydet, {});
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);

  useEffect(() => {
    if (durum.basarili) {
      setDuzenlenen(null);
      router.refresh();
    }
  }, [durum.basarili, router]);

  const secili = alanlar.find((alan) => alan.id === duzenlenen);

  return (
    <Bolum baslik="Park alanları">
      <ul className="mb-3 space-y-2">
        {alanlar.map((alan) => (
          <li
            key={alan.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-neutral-900">{alan.ad}</span>
              {!alan.aktif && (
                <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-bold text-neutral-600">
                  PASİF
                </span>
              )}
              <div className="text-sm text-neutral-600">Kapasite: {alan.kapasite}</div>
            </div>
            <button
              type="button"
              onClick={() => setDuzenlenen(duzenlenen === alan.id ? null : alan.id)}
              className="min-h-12 shrink-0 rounded-lg border-2 border-neutral-300 px-3 text-sm font-semibold text-neutral-700"
            >
              {duzenlenen === alan.id ? "Kapat" : "Düzenle"}
            </button>
          </li>
        ))}
      </ul>

      <form action={islem} className="space-y-3 rounded-lg bg-neutral-50 p-3">
        <input type="hidden" name="alanId" value={secili?.id ?? ""} />
        <h3 className="font-bold text-neutral-900">
          {secili ? `Düzenle: ${secili.ad}` : "Yeni park alanı"}
        </h3>

        <Geribildirim durum={durum} />

        <Alan
          key={`ad-${secili?.id ?? "yeni"}`}
          ad="ad"
          etiket="Alan adı"
          varsayilan={secili?.ad}
          gerekli
          hata={durum.alanHatalari?.ad}
        />
        <div className="grid grid-cols-2 gap-3">
          <Alan
            key={`kapasite-${secili?.id ?? "yeni"}`}
            ad="kapasite"
            etiket="Kapasite"
            varsayilan={secili?.kapasite ?? 0}
            inputMode="numeric"
            hata={durum.alanHatalari?.kapasite}
          />
          <Alan
            key={`sira-${secili?.id ?? "yeni"}`}
            ad="sira"
            etiket="Sıra"
            varsayilan={secili?.sira ?? alanlar.length + 1}
            inputMode="numeric"
          />
        </div>

        <label className="flex min-h-12 items-center gap-3">
          <input
            key={`aktif-${secili?.id ?? "yeni"}`}
            type="checkbox"
            name="aktif"
            defaultChecked={secili ? secili.aktif : true}
            className="h-6 w-6"
          />
          <span className="text-base font-semibold text-neutral-900">Aktif</span>
        </label>

        <Kaydet etiket={secili ? "GÜNCELLE" : "EKLE"} />
      </form>
    </Bolum>
  );
}

// ---------------------------------------------------------------------------
// Kullanıcılar
// ---------------------------------------------------------------------------

export function KullanicilarBolumu({
  kullanicilar,
}: {
  kullanicilar: Array<{
    id: string;
    adSoyad: string;
    email: string;
    rol: "ADMIN" | "GOREVLI";
    aktif: boolean;
  }>;
}) {
  const router = useRouter();
  const [durum, islem] = useActionState<AyarDurumu, FormData>(kullaniciKaydet, {});
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);

  useEffect(() => {
    if (durum.basarili) {
      setDuzenlenen(null);
      router.refresh();
    }
  }, [durum.basarili, router]);

  const secili = kullanicilar.find((kullanici) => kullanici.id === duzenlenen);

  return (
    <Bolum baslik="Kullanıcılar">
      <ul className="mb-3 space-y-2">
        {kullanicilar.map((kullanici) => (
          <li
            key={kullanici.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-neutral-900">
                {kullanici.adSoyad}
                {!kullanici.aktif && (
                  <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-bold text-neutral-600">
                    PASİF
                  </span>
                )}
              </div>
              <div className="truncate text-sm text-neutral-600">
                {kullanici.email} · {kullanici.rol === "ADMIN" ? "Yönetici" : "Görevli"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDuzenlenen(duzenlenen === kullanici.id ? null : kullanici.id)}
              className="min-h-12 shrink-0 rounded-lg border-2 border-neutral-300 px-3 text-sm font-semibold text-neutral-700"
            >
              {duzenlenen === kullanici.id ? "Kapat" : "Düzenle"}
            </button>
          </li>
        ))}
      </ul>

      <form action={islem} className="space-y-3 rounded-lg bg-neutral-50 p-3">
        <input type="hidden" name="kullaniciId" value={secili?.id ?? ""} />
        <h3 className="font-bold text-neutral-900">
          {secili ? `Düzenle: ${secili.adSoyad}` : "Yeni kullanıcı"}
        </h3>

        <Geribildirim durum={durum} />

        <Alan
          key={`ad-${secili?.id ?? "yeni"}`}
          ad="adSoyad"
          etiket="Ad soyad"
          varsayilan={secili?.adSoyad}
          gerekli
          hata={durum.alanHatalari?.adSoyad}
        />
        <Alan
          key={`email-${secili?.id ?? "yeni"}`}
          ad="email"
          etiket="E-posta"
          tip="email"
          varsayilan={secili?.email}
          gerekli
          hata={durum.alanHatalari?.email}
        />
        <Alan
          key={`sifre-${secili?.id ?? "yeni"}`}
          ad="sifre"
          etiket={secili ? "Yeni şifre (değiştirmek istemiyorsanız boş bırakın)" : "Şifre"}
          tip="password"
          hata={durum.alanHatalari?.sifre}
          ipucu="En az 8 karakter. Şifreler bcrypt ile saklanır, hiçbir yerde düz metin tutulmaz."
        />

        <div>
          <label htmlFor="rol" className="mb-1 block text-base font-semibold text-neutral-900">
            Rol
          </label>
          <select
            key={`rol-${secili?.id ?? "yeni"}`}
            id="rol"
            name="rol"
            defaultValue={secili?.rol ?? "GOREVLI"}
            className={ALAN}
          >
            <option value="GOREVLI">Görevli — giriş/çıkış, arama, kendi vardiyası</option>
            <option value="ADMIN">Yönetici — tüm yetkiler</option>
          </select>
        </div>

        <label className="flex min-h-12 items-center gap-3">
          <input
            key={`aktif-${secili?.id ?? "yeni"}`}
            type="checkbox"
            name="aktif"
            defaultChecked={secili ? secili.aktif : true}
            className="h-6 w-6"
          />
          <span className="text-base font-semibold text-neutral-900">
            Aktif (pasif kullanıcı giriş yapamaz)
          </span>
        </label>

        <Kaydet etiket={secili ? "GÜNCELLE" : "KULLANICI OLUŞTUR"} />
      </form>
    </Bolum>
  );
}
