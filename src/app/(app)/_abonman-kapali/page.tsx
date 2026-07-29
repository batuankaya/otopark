/**
 * ===========================================================================
 *  ABONMAN EKRANI — ŞU AN KAPALI
 * ===========================================================================
 *  Otopark yalnızca saatlik çalıştığı için abonman bölümü devre dışı.
 *  Klasör adı "_" ile başladığı için Next.js bunu ROTA OLARAK YAYINLAMAZ;
 *  kod duruyor ama /abonman adresi açılmıyor.
 *
 *  Yeniden açmak için:
 *    1) Bu klasörü  src/app/(app)/abonman  olarak yeniden adlandırın
 *    2) src/components/alt-menu.tsx içindeki abonman bağlantısını geri ekleyin
 *    3) src/app/(app)/page.tsx içindeki "bitmek üzere olan abonmanlar"
 *       bölümünü geri ekleyin
 *    4) Ayarlar'daki "aylık abonman ücreti" alanını geri ekleyin
 *
 *  Veri modeli (Abonman tablosu) ve iş kuralları yerinde: abonmanlı bir araç
 *  kaydı varsa giriş/çıkış akışı onu hâlâ tanır ve 0 TL uygular.
 * ===========================================================================
 */

import Link from "next/link";
import type { Metadata } from "next";

import { suresiDolanlariIsaretle } from "@/actions/abonman";
import { AbonmanFormu } from "@/components/abonman-formu";
import { PlakaGoster } from "@/components/plaka-goster";
import { formatlaPara } from "@/lib/para";
import { prisma } from "@/lib/prisma";
import { aktifTarifeyiAl } from "@/lib/sorgular";
import { turkceKarsilastir } from "@/lib/siralama";
import { formatlaTarih, kalanGun } from "@/lib/tarih";
import { oturumZorunlu } from "@/lib/yetki";

export const metadata: Metadata = { title: "Abonmanlar" };
export const dynamic = "force-dynamic";

type Filtre = "aktif" | "biten" | "tumu";

export default async function AbonmanSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: Filtre; duzenle?: string; yeni?: string }>;
}) {
  const { filtre = "aktif", duzenle, yeni } = await searchParams;
  await oturumZorunlu();

  // Süresi geçmiş abonmanları otomatik işaretle.
  await suresiDolanlariIsaretle();

  const [abonmanlar, tarife, duzenlenen] = await Promise.all([
    prisma.abonman.findMany({
      where: filtre === "tumu" ? {} : filtre === "aktif" ? { durum: "AKTIF" } : {},
      include: { arac: { select: { plaka: true, marka: true, model: true } } },
      orderBy: { bitisTarihi: "asc" },
    }),
    aktifTarifeyiAl(),
    duzenle
      ? prisma.abonman.findUnique({
          where: { id: duzenle },
          include: { arac: { select: { plaka: true } } },
        })
      : null,
  ]);

  const simdi = new Date();
  const zenginlestirilmis = abonmanlar
    .map((abonman) => ({ ...abonman, kalan: kalanGun(abonman.bitisTarihi, simdi) }))
    .filter((abonman) => (filtre === "biten" ? abonman.durum === "AKTIF" && abonman.kalan <= 7 : true))
    .sort((a, b) => {
      // Önce bitişe kalan gün, eşitse müşteri adı (Türkçe sıralama)
      if (a.kalan !== b.kalan) return a.kalan - b.kalan;
      return turkceKarsilastir(a.musteriAdi, b.musteriAdi);
    });

  const bitenSayisi = abonmanlar.filter((a) => a.durum === "AKTIF" && kalanGun(a.bitisTarihi, simdi) <= 7).length;

  // Form açıksa yalnızca formu göster — mobilde ekran kalabalıklaşmasın.
  if (yeni === "1" || duzenlenen) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-neutral-900">
            {duzenlenen ? "Abonman Düzenle" : "Yeni Abonman"}
          </h1>
          <Link
            href="/abonman"
            className="min-h-12 rounded-lg border-2 border-neutral-300 px-3 py-3 text-sm font-semibold text-neutral-700"
          >
            Geri
          </Link>
        </div>

        <AbonmanFormu
          varsayilanUcret={Number(tarife?.aylikAbonmanUcreti ?? 0)}
          mevcut={
            duzenlenen
              ? {
                  id: duzenlenen.id,
                  plaka: duzenlenen.arac.plaka,
                  musteriAdi: duzenlenen.musteriAdi,
                  telefon: duzenlenen.telefon,
                  baslangicTarihi: duzenlenen.baslangicTarihi.toISOString(),
                  bitisTarihi: duzenlenen.bitisTarihi.toISOString(),
                  aylikUcret: Number(duzenlenen.aylikUcret),
                  durum: duzenlenen.durum,
                  notlar: duzenlenen.notlar,
                }
              : undefined
          }
        />
      </div>
    );
  }

  const filtreSinifi = (aktif: boolean) =>
    `flex min-h-12 items-center rounded-lg border-2 px-3 text-sm font-bold ${
      aktif ? "border-blue-700 bg-blue-700 text-white" : "border-neutral-300 bg-white text-neutral-800"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-neutral-900">Abonmanlar</h1>
        <Link
          href="/abonman?yeni=1"
          className="flex min-h-12 items-center rounded-lg bg-blue-700 px-4 font-bold text-white hover:bg-blue-800"
        >
          + Yeni
        </Link>
      </div>

      {bitenSayisi > 0 && filtre !== "biten" && (
        <Link
          href="/abonman?filtre=biten"
          className="block rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-3 font-semibold text-amber-900"
        >
          {bitenSayisi} abonmanın bitişine 7 gün veya daha az kaldı →
        </Link>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/abonman" className={filtreSinifi(filtre === "aktif")}>
          Aktif
        </Link>
        <Link href="/abonman?filtre=biten" className={filtreSinifi(filtre === "biten")}>
          Bitmek üzere ({bitenSayisi})
        </Link>
        <Link href="/abonman?filtre=tumu" className={filtreSinifi(filtre === "tumu")}>
          Tümü
        </Link>
      </div>

      {zenginlestirilmis.length === 0 ? (
        <p className="rounded-xl border border-neutral-300 bg-white px-4 py-10 text-center text-neutral-600">
          Kayıt yok.
        </p>
      ) : (
        <ul className="space-y-2">
          {zenginlestirilmis.map((abonman) => {
            const uyari = abonman.durum === "AKTIF" && abonman.kalan <= 7;
            const bitti = abonman.durum !== "AKTIF";
            return (
              <li
                key={abonman.id}
                className={`rounded-xl border-2 bg-white p-4 ${
                  bitti ? "border-neutral-300 opacity-75" : uyari ? "border-amber-500" : "border-neutral-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <PlakaGoster plaka={abonman.arac.plaka} boyut="orta" />
                    <div className="mt-1.5 font-semibold text-neutral-900">{abonman.musteriAdi}</div>
                    {abonman.telefon && (
                      <a
                        href={`tel:${abonman.telefon}`}
                        className="mt-0.5 block min-h-8 text-sm text-blue-800 underline"
                      >
                        {abonman.telefon}
                      </a>
                    )}
                    <div className="mt-1 text-sm text-neutral-600">
                      {formatlaTarih(abonman.baslangicTarihi)} – {formatlaTarih(abonman.bitisTarihi)}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="font-bold tabular-nums text-neutral-900">
                      {formatlaPara(abonman.aylikUcret)}
                    </div>
                    <div className="text-xs text-neutral-500">aylık</div>

                    <div className="mt-2">
                      {abonman.durum === "IPTAL" ? (
                        <span className="rounded-full bg-neutral-200 px-2 py-1 text-xs font-bold text-neutral-700">
                          İPTAL
                        </span>
                      ) : abonman.durum === "SURESI_DOLDU" || abonman.kalan < 0 ? (
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-800">
                          SÜRESİ DOLDU
                        </span>
                      ) : (
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-bold ${
                            uyari ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-800"
                          }`}
                        >
                          {abonman.kalan === 0 ? "BUGÜN BİTİYOR" : `${abonman.kalan} GÜN`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Link
                  href={`/abonman?duzenle=${abonman.id}`}
                  className="mt-3 flex min-h-12 items-center justify-center rounded-lg border-2 border-neutral-300 font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  Düzenle
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
