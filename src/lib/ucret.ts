/**
 * Ücret hesaplama motoru — saf fonksiyon, yan etkisiz, birim testli.
 *
 * Otoparkın çalışma biçimi: İLK SAAT ÜCRETİ + SONRAKİ HER SAAT İÇİN ARTAN ÜCRET
 *
 *   Ücret = ilkSaatÜcreti + (saat − 1) × saatlikUcret
 *
 * Örnek (ilk saat 100 TL, artan 50 TL):
 *   1 saat → 100 TL · 2 saat → 150 TL · 3 saat → 200 TL · 5 saat → 300 TL
 *
 * İş kuralları:
 *  - İlk N dakika ücretsiz (tarifeden ayarlanabilir; 0 ise giriş anında ücret başlar)
 *  - Ücretsiz süre aşıldığında BAŞLAYAN her saat tam saat sayılır
 *  - Üst sınır yoktur. (Günlük tavan isteğe bağlı bir güvenlik ağı olarak
 *    korundu; tarifede 0 ise uygulanmaz.)
 *
 * Tutarlar TL cinsinden `number` olarak alınır/döner. Veritabanı sınırında
 * Prisma `Decimal`'e çevrilir (bkz. lib/para.ts).
 */

export type TarifeTuruDegeri = "SAATLIK" | "GUNLUK" | "ABONMAN";

export type UcretTarifesi = {
  ilkUcretsizDakika: number;
  /** İlk saatin (giriş) ücreti. */
  ilkSaatUcreti: number;
  /** İlk saatten sonraki her başlayan saat için eklenen tutar. */
  saatlikUcret: number;
  /** 0 veya null → üst sınır uygulanmaz (varsayılan çalışma biçimi). */
  gunlukTavanUcret?: number | null;
};

export type UcretGirdisi = {
  girisZamani: Date;
  cikisZamani: Date;
  tarife: UcretTarifesi;
  tarifeTuru: TarifeTuruDegeri;
  /** Abonman çıkış anında geçerli mi? `tarifeTuru === "ABONMAN"` ise anlamlıdır. */
  abonmanGecerli?: boolean;
};

export type UcretSonucu = {
  /** Toplam park süresi (dakika, yukarı yuvarlanmış). */
  toplamDakika: number;
  /** Ücretsiz süre düşüldükten sonra kalan dakika. */
  ucretliDakika: number;
  /** Ücretlendirilen toplam saat (ilk saat dahil). */
  saat: number;
  /** İlk saatten sonraki ücretli saat sayısı. */
  ekSaat: number;
  /** Ödenecek tutar (TL, 2 ondalık). */
  ucret: number;
  /** Hesapta fiilen uygulanan tarife türü (abonman düşerse SAATLIK olur). */
  uygulananTarifeTuru: TarifeTuruDegeri;
  /** Kullanıcıya gösterilecek uyarı (ör. abonman süresi dolmuş). */
  uyari?: string;
  /** Ücretsiz süre içinde kaldı mı? */
  ucretsizMi: boolean;
};

const DAKIKA_MS = 60_000;
const GUN_SAAT = 24;

/** Para tutarını 2 ondalığa yuvarlar (kayan nokta hatasına karşı korumalı). */
export function yuvarlaTutar(tutar: number): number {
  return Math.round((tutar + Number.EPSILON) * 100) / 100;
}

/**
 * İki zaman arasındaki süreyi dakika olarak verir. Saniyeli farklar yukarı
 * yuvarlanır — 59 saniye park eden araç 1 dakika sayılır.
 */
export function hesaplaDakika(girisZamani: Date, cikisZamani: Date): number {
  const fark = cikisZamani.getTime() - girisZamani.getTime();
  if (!Number.isFinite(fark) || fark <= 0) return 0;
  return Math.ceil(fark / DAKIKA_MS);
}

export function hesaplaUcret(girdi: UcretGirdisi): UcretSonucu {
  const { girisZamani, cikisZamani, tarife, tarifeTuru } = girdi;

  const toplamDakika = hesaplaDakika(girisZamani, cikisZamani);

  const ucretsizSonuc = (tur: TarifeTuruDegeri): UcretSonucu => ({
    toplamDakika,
    ucretliDakika: 0,
    saat: 0,
    ekSaat: 0,
    ucret: 0,
    ucretsizMi: true,
    uygulananTarifeTuru: tur,
  });

  // --- Abonman (ekranları kapalı; veri modeli korunuyor) -------------------
  if (tarifeTuru === "ABONMAN") {
    if (girdi.abonmanGecerli) return ucretsizSonuc("ABONMAN");

    // Abonman süresi dolmuş: uyar ve normal tarifeden ücretlendir.
    const normalSonuc = hesaplaUcret({ ...girdi, tarifeTuru: "SAATLIK" });
    return {
      ...normalSonuc,
      uyari: "Abonman süresi dolmuş. Ücret normal tarifeden hesaplandı.",
    };
  }

  // --- Ücretsiz süre -------------------------------------------------------
  const ilkUcretsizDakika = Math.max(0, tarife.ilkUcretsizDakika ?? 0);
  if (toplamDakika <= ilkUcretsizDakika) {
    return ucretsizSonuc(tarifeTuru === "GUNLUK" ? "SAATLIK" : tarifeTuru);
  }

  const ucretliDakika = toplamDakika - ilkUcretsizDakika;

  // --- İlk saat + artan saatler -------------------------------------------
  // Başlayan her saat tam saat sayılır; en az 1 saat ücretlendirilir.
  const saat = Math.max(1, Math.ceil(ucretliDakika / 60));
  const ekSaat = saat - 1;

  let ucret = tarife.ilkSaatUcreti + ekSaat * tarife.saatlikUcret;

  // --- İsteğe bağlı günlük tavan ------------------------------------------
  // Tarifede 0 ise uygulanmaz. Tanımlıysa her başlayan 24 saat için tavan
  // kadar üst sınır konur.
  const gunlukTavan = tarife.gunlukTavanUcret ?? 0;
  if (gunlukTavan > 0) {
    const gunSayisi = Math.max(1, Math.ceil(saat / GUN_SAAT));
    ucret = Math.min(ucret, gunSayisi * gunlukTavan);
  }

  return {
    toplamDakika,
    ucretliDakika,
    saat,
    ekSaat,
    ucret: yuvarlaTutar(ucret),
    uygulananTarifeTuru: "SAATLIK",
    ucretsizMi: false,
  };
}

/**
 * Ücretin nasıl oluştuğunu tek satırda açıklar — çıkış ekranında ve fişte
 * görevlinin müşteriye izah edebilmesi için.
 */
export function ucretAciklamasi(sonuc: UcretSonucu, tarife: UcretTarifesi): string {
  if (sonuc.uygulananTarifeTuru === "ABONMAN") return "Abonman aracı — ücret alınmaz";
  if (sonuc.ucretsizMi) return `İlk ${tarife.ilkUcretsizDakika} dakika ücretsiz`;

  if (sonuc.ekSaat === 0) return "İlk saat";
  return `İlk saat + ${sonuc.ekSaat} saat`;
}

/**
 * Çıkış ekranındaki hesap dökümü satırları.
 * Örn: ["İlk saat  100,00 ₺", "2 ek saat × 50,00 ₺  100,00 ₺"]
 */
export function ucretDokumu(
  sonuc: UcretSonucu,
  tarife: UcretTarifesi,
): Array<{ etiket: string; tutar: number }> {
  if (sonuc.uygulananTarifeTuru === "ABONMAN") {
    return [{ etiket: "Abonman aracı", tutar: 0 }];
  }
  if (sonuc.ucretsizMi) {
    return [{ etiket: `İlk ${tarife.ilkUcretsizDakika} dk ücretsiz`, tutar: 0 }];
  }

  const satirlar = [{ etiket: "İlk saat", tutar: tarife.ilkSaatUcreti }];
  if (sonuc.ekSaat > 0) {
    satirlar.push({
      etiket: `${sonuc.ekSaat} ek saat × ${tarife.saatlikUcret}`,
      tutar: yuvarlaTutar(sonuc.ekSaat * tarife.saatlikUcret),
    });
  }
  return satirlar;
}
