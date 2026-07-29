import Link from "next/link";
import { notFound } from "next/navigation";

import { FisYazdirButonlari } from "@/components/fis-yazdir-butonlari";
import { aracEtiketi } from "@/lib/plaka";
import { formatlaPara, sayiyaCevir } from "@/lib/para";
import { prisma } from "@/lib/prisma";
import { ayarlariAl } from "@/lib/sorgular";
import { formatlaSure, formatlaTarihSaat } from "@/lib/tarih";
import { hesaplaDakika } from "@/lib/ucret";
import { oturumZorunlu } from "@/lib/yetki";

export const dynamic = "force-dynamic";

/**
 * Fiş — 58 mm termal yazıcıyla uyumlu sade HTML.
 * Yazdırma stilleri globals.css içindeki @media print bloğunda.
 */
export default async function FisSayfasi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ yeni?: string }>;
}) {
  await oturumZorunlu(); // KVKK: plaka kişisel veri — fiş de korumalı
  const { id } = await params;
  const { yeni } = await searchParams;

  const [kayit, ayar] = await Promise.all([
    prisma.parkKaydi.findUnique({
      where: { id },
      include: {
        arac: true,
        tarife: true,
        girisYapan: { select: { adSoyad: true } },
        cikisYapan: { select: { adSoyad: true } },
      },
    }),
    ayarlariAl(),
  ]);

  if (!kayit) notFound();

  const cikisYapildi = kayit.durum === "CIKTI" && !!kayit.cikisZamani;
  const dakika = cikisYapildi ? hesaplaDakika(kayit.girisZamani, kayit.cikisZamani!) : 0;
  const tutar = sayiyaCevir(kayit.tahsilEdilenUcret);
  const hesaplanan = sayiyaCevir(kayit.hesaplananUcret);
  const iskontoVar = cikisYapildi && Math.abs(hesaplanan - tutar) > 0.009;

  const cizgi = "--------------------------------";

  return (
    <div className="min-h-dvh bg-neutral-200 py-4">
      {/* Ekrandaki kontroller — yazdırırken gizlenir */}
      <div className="yazdirma-gizle mx-auto mb-4 flex max-w-md flex-col gap-2 px-4">
        {yeni === "1" && (
          <p className="rounded-lg border-2 border-green-600 bg-green-50 px-4 py-3 text-center font-bold text-green-800">
            Araç girişi kaydedildi.
          </p>
        )}
        <FisYazdirButonlari />
        <Link
          href="/"
          className="flex min-h-14 items-center justify-center rounded-lg border-2 border-neutral-400 bg-white text-lg font-bold text-neutral-800"
        >
          PANOYA DÖN
        </Link>
      </div>

      {/* Fişin kendisi */}
      <div className="mx-auto w-[58mm] bg-white p-3 font-mono text-[11px] leading-tight text-black shadow-lg print:shadow-none">
        <div className="fis">
          <div className="text-center">
            <div className="text-[13px] font-bold uppercase">{ayar.otoparkAdi}</div>
            {ayar.adres && <div>{ayar.adres}</div>}
            {ayar.telefon && <div>Tel: {ayar.telefon}</div>}
          </div>

          <div className="my-1">{cizgi}</div>

          <div className="text-center text-[12px] font-bold">
            {cikisYapildi ? "ÇIKIŞ FİŞİ" : "GİRİŞ FİŞİ"}
          </div>
          <div className="text-center">Fiş No: {String(kayit.fisNo).padStart(6, "0")}</div>

          <div className="my-1">{cizgi}</div>

          <div className="my-1 text-center text-[18px] font-bold tracking-wider">
            {aracEtiketi(kayit)}
          </div>

          {/* Plakasız kayıtta marka/model başlıkta zaten var; burada renk vb. */}
          {(() => {
            const bilgi = [
              kayit.plaka ? (kayit.marka ?? kayit.arac?.marka) : null,
              kayit.plaka ? (kayit.model ?? kayit.arac?.model) : null,
              kayit.renk ?? kayit.arac?.renk,
            ]
              .filter(Boolean)
              .join(" ");
            return bilgi ? <div className="text-center">{bilgi}</div> : null;
          })()}

          {!kayit.plaka && (
            <div className="text-center font-bold">*** PLAKASIZ KAYIT ***</div>
          )}

          <div className="my-1">{cizgi}</div>

          <Satir etiket="Giriş" deger={formatlaTarihSaat(kayit.girisZamani)} />
          {cikisYapildi && <Satir etiket="Çıkış" deger={formatlaTarihSaat(kayit.cikisZamani)} />}
          {cikisYapildi && <Satir etiket="Süre" deger={formatlaSure(dakika)} />}
          <Satir
            etiket="Tarife"
            deger={
              kayit.tarifeTuru === "ABONMAN"
                ? "Abonman"
                : kayit.tarifeTuru === "GUNLUK"
                  ? "Günlük"
                  : "Saatlik"
            }
          />

          {!cikisYapildi && (
            <>
              <div className="my-1">{cizgi}</div>
              <div>İlk {kayit.tarife.ilkUcretsizDakika} dk ücretsiz</div>
              <Satir etiket="İlk saat" deger={formatlaPara(kayit.tarife.ilkSaatUcreti)} />
              <Satir etiket="Sonraki saat" deger={formatlaPara(kayit.tarife.saatlikUcret)} />
            </>
          )}

          {cikisYapildi && (
            <>
              <div className="my-1">{cizgi}</div>
              {iskontoVar && (
                <>
                  <Satir etiket="Hesaplanan" deger={formatlaPara(hesaplanan)} />
                  <Satir etiket="Düzeltme" deger={formatlaPara(tutar - hesaplanan)} />
                </>
              )}
              <div className="flex justify-between text-[15px] font-bold">
                <span>TOPLAM</span>
                <span>{formatlaPara(tutar)}</span>
              </div>
              <Satir
                etiket="Ödeme"
                deger={
                  kayit.odemeYontemi === "NAKIT"
                    ? "Nakit"
                    : kayit.odemeYontemi === "KART"
                      ? "Kart"
                      : "Ücretsiz"
                }
              />
            </>
          )}

          <div className="my-1">{cizgi}</div>

          <Satir
            etiket="Görevli"
            deger={(cikisYapildi ? kayit.cikisYapan?.adSoyad : kayit.girisYapan.adSoyad) ?? "—"}
          />

          {(kayit.notlar ?? kayit.arac?.notlar) && (
            <>
              <div className="my-1">{cizgi}</div>
              <div>Not: {kayit.notlar ?? kayit.arac?.notlar}</div>
            </>
          )}

          {kayit.durum === "IPTAL" && (
            <div className="my-1 text-center font-bold">*** KAYIT İPTAL EDİLDİ ***</div>
          )}

          <div className="my-1">{cizgi}</div>

          {!cikisYapildi && (
            <div className="text-center">
              Bu fişi çıkışta ibraz ediniz.
              <br />
              Araç ve içindeki eşyalardan
              <br />
              sorumluluk kabul edilmez.
            </div>
          )}

          {ayar.fisAltNotu && <div className="mt-1 text-center">{ayar.fisAltNotu}</div>}

          <div className="mt-2 text-center text-[10px]">{formatlaTarihSaat(new Date())}</div>
        </div>
      </div>
    </div>
  );
}

function Satir({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{etiket}</span>
      <span className="text-right font-bold">{deger}</span>
    </div>
  );
}
