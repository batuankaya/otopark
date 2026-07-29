import { AltMenu } from "@/components/alt-menu";
import { CevrimdisiUyarisi } from "@/components/cevrimdisi-uyarisi";
import { UstCubuk } from "@/components/ust-cubuk";
import { ayarlariAl } from "@/lib/sorgular";
import { acikVardiyayiBul, oturumZorunlu } from "@/lib/yetki";

/**
 * Oturum açmış personelin gördüğü tüm sayfaların ortak kabuğu.
 * Middleware'e ek olarak burada da oturum kontrolü yapılır (savunma katmanı).
 */
export default async function UygulamaDuzeni({ children }: { children: React.ReactNode }) {
  const kullanici = await oturumZorunlu();
  const [ayar, acikVardiya] = await Promise.all([
    ayarlariAl(),
    acikVardiyayiBul(),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-100">
      <CevrimdisiUyarisi />
      <UstCubuk
        kullanici={kullanici}
        otoparkAdi={ayar.otoparkAdi}
        vardiyaAcik={!!acikVardiya}
      />

      <main className="mx-auto w-full max-w-4xl flex-1 px-3 py-4">{children}</main>

      <AltMenu rol={kullanici.rol} />
    </div>
  );
}
