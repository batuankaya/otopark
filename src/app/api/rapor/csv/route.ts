import { ARAC_SINIFI_ETIKETLERI } from "@/lib/arac-sinifi";
import { islemGunluguYaz } from "@/lib/gunluk";
import { formatlaPlaka } from "@/lib/plaka";
import { sayiyaCevir } from "@/lib/para";
import { prisma } from "@/lib/prisma";
import { ciroOzeti, gunlukSeri } from "@/lib/raporlar";
import { formatlaTarihSaat, tarihAraligiOlustur, tarihGirdisiDegeri } from "@/lib/tarih";
import { hesaplaDakika } from "@/lib/ucret";
import { oturumAl } from "@/lib/yetki";

/**
 * CSV dışa aktarma (yalnızca ADMIN).
 *
 * KVKK: Plaka kişisel veridir; her dışa aktarma işlem günlüğüne yazılır —
 * kim, ne zaman, hangi aralığı, kaç satır aldı.
 *
 * Excel Türkçe yerelde noktalı virgülle ayrılmış dosya bekler; ayrıca
 * Türkçe karakterlerin bozulmaması için BOM eklenir.
 */

const AYIRAC = ";";

function csvAlani(deger: unknown): string {
  if (deger === null || deger === undefined) return "";
  const metin = String(deger);
  if (metin.includes(AYIRAC) || metin.includes('"') || metin.includes("\n")) {
    return `"${metin.replace(/"/g, '""')}"`;
  }
  return metin;
}

function csvSatiri(alanlar: unknown[]): string {
  return alanlar.map(csvAlani).join(AYIRAC);
}

/** Türkçe Excel ondalık ayıracı virgüldür. */
function tutarMetni(deger: unknown): string {
  return sayiyaCevir(deger).toFixed(2).replace(".", ",");
}

export async function GET(istek: Request) {
  const kullanici = await oturumAl();
  if (!kullanici) {
    return new Response("Yetkisiz.", { status: 401 });
  }
  if (kullanici.rol !== "ADMIN") {
    return new Response("Bu işlem için yönetici yetkisi gerekir.", { status: 403 });
  }

  const url = new URL(istek.url);
  const donem = (url.searchParams.get("donem") ?? "bugun") as "bugun" | "hafta" | "ay";
  const tur = url.searchParams.get("tur") ?? "kayitlar";
  const aralik = tarihAraligiOlustur(donem);

  let icerik: string;
  let satirSayisi: number;
  let dosyaAdi: string;

  if (tur === "ozet") {
    const [seri, ozet] = await Promise.all([gunlukSeri(aralik), ciroOzeti(aralik)]);

    const satirlar = [
      csvSatiri(["Tarih", "Ciro (TL)", "Çıkan araç"]),
      ...seri.map((gun) => csvSatiri([gun.tarih, tutarMetni(gun.ciro), gun.arac])),
      "",
      csvSatiri(["TOPLAM", tutarMetni(ozet.toplamCiro), ozet.cikisSayisi]),
      csvSatiri(["Nakit", tutarMetni(ozet.nakit), ""]),
      csvSatiri(["Kart", tutarMetni(ozet.kart), ""]),
      csvSatiri(["Giren araç", ozet.girisSayisi, ""]),
      csvSatiri(["İptal edilen kayıt", ozet.iptalSayisi, ""]),
      csvSatiri(["Ücret düzeltmesi", tutarMetni(ozet.iskontoToplami), ""]),
      csvSatiri(["Ödemeden çıkan araç", ozet.borcluCikisSayisi, ""]),
      csvSatiri(["Oluşan borç", tutarMetni(ozet.olusanBorc), ""]),
      csvSatiri(["Eski borç tahsilatı", tutarMetni(ozet.tahsilEdilenBorc), ""]),
    ];

    icerik = satirlar.join("\r\n");
    satirSayisi = seri.length;
    dosyaAdi = `otopark-ozet-${tarihGirdisiDegeri(aralik.baslangic)}.csv`;
  } else {
    const kayitlar = await prisma.parkKaydi.findMany({
      where: {
        OR: [
          { girisZamani: { gte: aralik.baslangic, lt: aralik.bitis } },
          { cikisZamani: { gte: aralik.baslangic, lt: aralik.bitis } },
        ],
      },
      orderBy: { girisZamani: "asc" },
      include: {
        arac: { select: { marka: true, model: true, renk: true } },
        girisYapan: { select: { adSoyad: true } },
        cikisYapan: { select: { adSoyad: true } },
      },
    });

    const durumEtiketi = { ICERIDE: "İçeride", CIKTI: "Çıktı", IPTAL: "İptal" } as const;
    const tarifeEtiketi = { SAATLIK: "Saatlik", GUNLUK: "Günlük", ABONMAN: "Abonman" } as const;

    const satirlar = [
      csvSatiri([
        "Fiş No",
        "Plaka",
        "Marka",
        "Model",
        "Renk",
        "Araç sınıfı",
        "Giriş",
        "Çıkış",
        "Süre (dk)",
        "Tarife",
        "Hesaplanan (TL)",
        "Tahsil edilen (TL)",
        "Borç (TL)",
        "Kalan borç (TL)",
        "Eski borç tahsilatı (TL)",
        "Ödeme",
        "Durum",
        "Giriş yapan",
        "Çıkış yapan",
        "Düzeltme sebebi",
        "İptal sebebi",
      ]),
      ...kayitlar.map((kayit) =>
        csvSatiri([
          kayit.fisNo,
          kayit.plaka ? formatlaPlaka(kayit.plaka) : "(plakasız)",
          kayit.marka ?? kayit.arac?.marka ?? "",
          kayit.model ?? kayit.arac?.model ?? "",
          kayit.renk ?? kayit.arac?.renk ?? "",
          ARAC_SINIFI_ETIKETLERI[kayit.aracSinifi],
          formatlaTarihSaat(kayit.girisZamani),
          kayit.cikisZamani ? formatlaTarihSaat(kayit.cikisZamani) : "",
          kayit.cikisZamani ? hesaplaDakika(kayit.girisZamani, kayit.cikisZamani) : "",
          tarifeEtiketi[kayit.tarifeTuru],
          kayit.hesaplananUcret !== null ? tutarMetni(kayit.hesaplananUcret) : "",
          kayit.tahsilEdilenUcret !== null ? tutarMetni(kayit.tahsilEdilenUcret) : "",
          tutarMetni(kayit.borcTutari),
          tutarMetni(kayit.borcKalan),
          tutarMetni(kayit.tahsilEdilenBorc),
          kayit.odemeYontemi === "NAKIT" ? "Nakit" : kayit.odemeYontemi === "KART" ? "Kart" : "",
          durumEtiketi[kayit.durum],
          kayit.girisYapan.adSoyad,
          kayit.cikisYapan?.adSoyad ?? "",
          kayit.ucretDuzeltmeSebebi ?? "",
          kayit.iptalSebebi ?? "",
        ]),
      ),
    ];

    icerik = satirlar.join("\r\n");
    satirSayisi = kayitlar.length;
    dosyaAdi = `otopark-kayitlar-${tarihGirdisiDegeri(aralik.baslangic)}.csv`;
  }

  // KVKK: dışa aktarma kaydı
  await islemGunluguYaz({
    kullaniciId: kullanici.id,
    islemTipi: "DISA_AKTARMA",
    yeniDeger: {
      tur,
      donem: aralik.etiket,
      baslangic: aralik.baslangic.toISOString(),
      bitis: aralik.bitis.toISOString(),
      satirSayisi,
    },
    aciklama: `${aralik.etiket} dönemi ${tur === "ozet" ? "özet" : "park kayıtları"} CSV olarak dışa aktarıldı (${satirSayisi} satır).`,
  });

  // BOM: Excel'in UTF-8'i doğru tanıması için
  return new Response("﻿" + icerik, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dosyaAdi}"`,
      "Cache-Control": "no-store",
    },
  });
}
