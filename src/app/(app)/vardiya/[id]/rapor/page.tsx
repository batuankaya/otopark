import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { vardiyaGiderleri } from "@/actions/gider";
import { GIDER_ETIKETLERI } from "@/lib/gider";
import { FisYazdirButonlari } from "@/components/fis-yazdir-butonlari";
import { PlakaGoster } from "@/components/plaka-goster";
import { formatlaPara, sayiyaCevir } from "@/lib/para";
import { prisma } from "@/lib/prisma";
import { formatlaSaat, formatlaTarihSaat, sureMetni } from "@/lib/tarih";
import { oturumZorunlu } from "@/lib/yetki";

export const metadata: Metadata = { title: "Vardiya Raporu" };
export const dynamic = "force-dynamic";

/** Vardiya devir raporu — bir sonraki görevliye teslim için yazdırılabilir. */
export default async function VardiyaRaporuSayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const kullanici = await oturumZorunlu();

  const vardiya = await prisma.vardiya.findUnique({
    where: { id },
    include: { kullanici: { select: { adSoyad: true } } },
  });

  if (!vardiya) notFound();

  // Görevli yalnızca kendi vardiya raporunu görebilir.
  if (vardiya.kullaniciId !== kullanici.id && kullanici.rol !== "ADMIN") {
    redirect("/?hata=yetkisiz");
  }

  const giderOzeti = await vardiyaGiderleri(id);

  const cikislar = await prisma.parkKaydi.findMany({
    where: { cikisVardiyaId: id, durum: "CIKTI" },
    orderBy: { cikisZamani: "asc" },
    select: {
      id: true,
      plaka: true,
      plakaGosterim: true,
      yabanciPlaka: true,
      ulkeKodu: true,
      marka: true,
      model: true,
      fisNo: true,
      cikisZamani: true,
      tahsilEdilenUcret: true,
      odemeYontemi: true,
      ucretDuzeltmeSebebi: true,
      borcTutari: true,
      tahsilEdilenBorc: true,
    },
  });

  // Devir raporunda "kasaya giren para" ile "açıkta kalan alacak" ayrı
  // görünmeli: teslim alan görevli neyi devraldığını bilsin.
  const olusanBorc = cikislar.reduce((toplam, c) => toplam + sayiyaCevir(c.borcTutari), 0);
  const tahsilEdilenBorc = cikislar.reduce(
    (toplam, c) => toplam + sayiyaCevir(c.tahsilEdilenBorc),
    0,
  );

  const acilis = sayiyaCevir(vardiya.acilisKasa);
  const nakit = sayiyaCevir(vardiya.toplamNakit);
  const kart = sayiyaCevir(vardiya.toplamKart);
  const kapanis = sayiyaCevir(vardiya.kapanisKasa);
  const fark = sayiyaCevir(vardiya.fark);
  const acikMi = !vardiya.bitis;

  return (
    <div className="space-y-4">
      <div className="yazdirma-gizle flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-neutral-900">Vardiya Raporu</h1>
        <Link href="/vardiya" className="min-h-12 rounded-lg border-2 border-neutral-300 px-3 py-3 text-sm font-semibold text-neutral-700">
          Geri
        </Link>
      </div>

      <section className="rounded-xl border border-neutral-300 bg-white p-4">
        <dl className="grid grid-cols-2 gap-3">
          <Alan etiket="Görevli" deger={vardiya.kullanici.adSoyad} />
          <Alan etiket="Durum" deger={acikMi ? "Açık" : "Kapalı"} />
          <Alan etiket="Başlangıç" deger={formatlaTarihSaat(vardiya.baslangic)} />
          <Alan etiket="Bitiş" deger={acikMi ? "—" : formatlaTarihSaat(vardiya.bitis)} />
          <Alan
            etiket="Süre"
            deger={sureMetni(vardiya.baslangic, vardiya.bitis ?? new Date())}
          />
          <Alan etiket="Çıkış sayısı" deger={`${cikislar.length} araç`} />
        </dl>
      </section>

      {/* Kasa dökümü */}
      <section className="rounded-xl border-2 border-neutral-900 bg-white p-4">
        <h2 className="text-lg font-bold text-neutral-900">Kasa</h2>
        <dl className="mt-3 space-y-2 text-lg">
          <Satir etiket="Açılış kasası" deger={formatlaPara(acilis)} />
          <Satir etiket="+ Nakit tahsilat" deger={formatlaPara(nakit)} />
          {giderOzeti.nakitGider > 0 && (
            <Satir etiket="− Nakit gider" deger={`−${formatlaPara(giderOzeti.nakitGider)}`} />
          )}
          <Satir
            etiket="Kasada olması gereken"
            deger={formatlaPara(acilis + nakit - giderOzeti.nakitGider)}
            kalin
          />
          {!acikMi && <Satir etiket="Sayılan kasa" deger={formatlaPara(kapanis)} kalin />}
          {!acikMi && (
            <div
              className={`flex justify-between rounded-lg px-3 py-2 text-xl font-bold ${
                fark === 0
                  ? "bg-green-50 text-green-800"
                  : fark < 0
                    ? "bg-red-50 text-red-800"
                    : "bg-amber-50 text-amber-800"
              }`}
            >
              <span>Fark</span>
              <span className="tabular-nums">
                {fark > 0 ? "+" : ""}
                {formatlaPara(fark)}
              </span>
            </div>
          )}
          <div className="border-t border-neutral-200 pt-2">
            <Satir etiket="Kart tahsilatı (kasa dışı)" deger={formatlaPara(kart)} />
            <Satir etiket="Toplam ciro" deger={formatlaPara(nakit + kart)} />
            {giderOzeti.toplamGider > 0 && (
              <Satir etiket="Toplam gider" deger={`−${formatlaPara(giderOzeti.toplamGider)}`} />
            )}
            <Satir
              etiket="Net kazanç"
              deger={formatlaPara(nakit + kart - giderOzeti.toplamGider)}
              kalin
            />
            {tahsilEdilenBorc > 0 && (
              <Satir
                etiket="Bunun eski borç tahsilatı olan kısmı"
                deger={formatlaPara(tahsilEdilenBorc)}
              />
            )}
            {olusanBorc > 0 && (
              <Satir
                etiket="Ödemeden çıkan araçların borcu (kasa dışı)"
                deger={formatlaPara(olusanBorc)}
              />
            )}
          </div>
        </dl>

        {vardiya.notlar && (
          <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-base text-neutral-700">
            <span className="font-semibold">Not: </span>
            {vardiya.notlar}
          </p>
        )}
      </section>

      {/* Çıkış listesi */}
      <section className="rounded-xl border border-neutral-300 bg-white">
        <h2 className="border-b border-neutral-200 px-4 py-3 text-base font-bold text-neutral-900">
          Vardiyada yapılan çıkışlar ({cikislar.length})
        </h2>

        {cikislar.length === 0 ? (
          <p className="px-4 py-6 text-center text-neutral-600">Bu vardiyada çıkış yapılmadı.</p>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {cikislar.map((cikis) => (
              <li key={cikis.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-14 shrink-0 text-sm tabular-nums text-neutral-600">
                  {formatlaSaat(cikis.cikisZamani)}
                </span>
                <div className="min-w-0 flex-1">
                  <PlakaGoster
                    plaka={cikis.plaka}
                    gosterim={cikis.plakaGosterim}
                    yabanci={cikis.yabanciPlaka}
                    ulkeKodu={cikis.ulkeKodu}
                    marka={cikis.marka}
                    model={cikis.model}
                    fisNo={cikis.fisNo}
                    boyut="kucuk"
                  />
                  {cikis.ucretDuzeltmeSebebi && (
                    <div className="mt-0.5 truncate text-xs text-amber-800">
                      Düzeltme: {cikis.ucretDuzeltmeSebebi}
                    </div>
                  )}
                  {sayiyaCevir(cikis.borcTutari) > 0 && (
                    <div className="mt-0.5 text-xs font-bold text-red-700">
                      {formatlaPara(cikis.borcTutari)} borç kaldı
                    </div>
                  )}
                  {sayiyaCevir(cikis.tahsilEdilenBorc) > 0 && (
                    <div className="mt-0.5 text-xs font-bold text-green-700">
                      + {formatlaPara(cikis.tahsilEdilenBorc)} eski borç tahsilatı
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-bold tabular-nums text-neutral-900">
                    {formatlaPara(cikis.tahsilEdilenUcret)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {cikis.odemeYontemi === "NAKIT"
                      ? "Nakit"
                      : cikis.odemeYontemi === "KART"
                        ? "Kart"
                        : "Ücretsiz"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Giderler */}
      {giderOzeti.kayitlar.length > 0 && (
        <section className="rounded-xl border border-neutral-300 bg-white">
          <h2 className="border-b border-neutral-200 px-4 py-3 text-base font-bold text-neutral-900">
            Vardiyada yapılan giderler ({giderOzeti.kayitlar.length}) ·{" "}
            {formatlaPara(giderOzeti.toplamGider)}
          </h2>
          <ul className="divide-y divide-neutral-200">
            {giderOzeti.kayitlar.map((gider) => (
              <li key={gider.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-14 shrink-0 text-sm tabular-nums text-neutral-600">
                  {formatlaSaat(gider.zaman)}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-neutral-900">
                    {GIDER_ETIKETLERI[gider.kategori]}
                  </span>
                  <div className="truncate text-sm text-neutral-600">{gider.aciklama}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-bold tabular-nums text-red-700">
                    −{formatlaPara(gider.tutar)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {gider.odemeYontemi === "NAKIT" ? "Nakit" : "Kart"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="yazdirma-gizle">
        <FisYazdirButonlari />
      </div>
    </div>
  );
}

function Alan({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <div>
      <dt className="text-sm text-neutral-600">{etiket}</dt>
      <dd className="font-semibold text-neutral-900">{deger}</dd>
    </div>
  );
}

function Satir({ etiket, deger, kalin }: { etiket: string; deger: string; kalin?: boolean }) {
  return (
    <div className={`flex justify-between ${kalin ? "font-bold text-neutral-900" : "text-neutral-700"}`}>
      <span>{etiket}</span>
      <span className="tabular-nums">{deger}</span>
    </div>
  );
}
