import type { Metadata } from "next";

import { AyarlarFormu, KullanicilarBolumu, TarifeFormu } from "@/components/ayarlar-formlari";
import { prisma } from "@/lib/prisma";
import { ARAC_SINIFLARI } from "@/lib/arac-sinifi";
import { aktifTarifeleriAl, ayarlariAl } from "@/lib/sorgular";
import { turkceSirala } from "@/lib/siralama";
import { formatlaTarihSaat } from "@/lib/tarih";
import { adminZorunlu } from "@/lib/yetki";

export const metadata: Metadata = { title: "Ayarlar" };
export const dynamic = "force-dynamic";

export default async function AyarlarSayfasi() {
  await adminZorunlu();

  const [ayar, tarifeler, kullanicilar, tarifeGecmisi] = await Promise.all([
    ayarlariAl(),
    aktifTarifeleriAl(),
    prisma.kullanici.findMany({
      // KVKK / güvenlik: şifre hash'i asla sorgudan çıkmaz.
      select: { id: true, adSoyad: true, email: true, rol: true, aktif: true },
    }),
    // Geçmiş sınıf başına gösterilir; 5'er satır için toplamda 10 yeter.
    prisma.tarife.findMany({ orderBy: { gecerlilikBaslangic: "desc" }, take: 20 }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">Ayarlar</h1>

      <AyarlarFormu
        mevcut={{
          otoparkAdi: ayar.otoparkAdi,
          adres: ayar.adres,
          telefon: ayar.telefon,
          toplamKapasite: ayar.toplamKapasite,
          fisAltNotu: ayar.fisAltNotu,
          vardiyaSifirlamaSaati: ayar.vardiyaSifirlamaSaati,
        }}
      />

      {ARAC_SINIFLARI.map((sinif) => {
        const tarife = tarifeler[sinif];
        return (
          <TarifeFormu
            key={sinif}
            aracSinifi={sinif}
            mevcut={
              tarife
                ? {
                    ad: tarife.ad,
                    ilkUcretsizDakika: tarife.ilkUcretsizDakika,
                    ilkSaatUcreti: Number(tarife.ilkSaatUcreti),
                    saatlikUcret: Number(tarife.saatlikUcret),
                    gunlukTavanUcret: Number(tarife.gunlukTavanUcret),
                  }
                : null
            }
            gecmis={tarifeGecmisi
              .filter((t) => t.aracSinifi === sinif)
              .slice(0, 5)
              .map((t) => ({
                id: t.id,
                ad: t.ad,
                aktif: t.aktif,
                gecerlilikBaslangic: formatlaTarihSaat(t.gecerlilikBaslangic),
                ilkSaatUcreti: Number(t.ilkSaatUcreti),
                saatlikUcret: Number(t.saatlikUcret),
                gunlukTavanUcret: Number(t.gunlukTavanUcret),
              }))}
          />
        );
      })}

      <KullanicilarBolumu kullanicilar={turkceSirala(kullanicilar, (k) => k.adSoyad)} />
    </div>
  );
}
