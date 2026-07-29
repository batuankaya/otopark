/**
 * Türk plakası doğrulama, normalize etme ve gösterim yardımcıları.
 *
 * Kurallar:
 *  - İl kodu (01–81) + 1–3 harf + 2–5 rakam
 *    34 A 1234 · 34 A 12345 · 34 AB 123 · 34 AB 1234 · 34 ABC 12 · 34 ABC 123
 *  - Q, W, X harfleri Türk plakalarında kullanılmaz
 *  - Veritabanında boşluksuz ve büyük harf saklanır (34ABC123)
 *  - Ekranda boşluklu gösterilir (34 ABC 123)
 *
 * Bu dosya saf fonksiyonlardan oluşur; hem sunucuda hem tarayıcıda çalışır.
 */

/** Türk plakalarında kullanılan harfler (Q, W, X ve Türkçe karakterler hariç). */
export const GECERLI_HARFLER = "ABCDEFGHIJKLMNOPRSTUVYZ";

const HARF = `[${GECERLI_HARFLER}]`;

/** Harf grubunda en az/en çok kaç harf olabilir. */
export const EN_AZ_HARF = 1;
export const EN_COK_HARF = 3;
/** Rakam grubunda en az/en çok kaç rakam olabilir. */
export const EN_AZ_RAKAM = 2;
export const EN_COK_RAKAM = 5;

/**
 * İl kodu (01–81) + 1–3 harf + 2–5 rakam.
 *
 * Sahada karşılaşılan tüm kalıpları kapsar:
 *   34 A 1234 · 34 A 12345 · 34 AB 123 · 34 AB 1234 · 34 ABC 12 · 34 ABC 123
 *
 * Not: Başlangıçta yalnızca üç kalıp (NN L NNNN | NN LL NNN | NN LLL NN)
 * kabul ediliyordu; bu yüzden 3 harf + 3 rakam plakalar kaydedilemiyordu.
 * Bir aracı kaydedememek, gevşek doğrulamadan daha kötü olduğu için kalıp
 * listesi gerçek kullanıma göre genişletildi. Q, W, X yasağı ve il kodu
 * kontrolü korunuyor — bunlar hem gerçek kural hem de yazım hatası yakalıyor.
 *
 * Bilerek ^...$ ile sınırlandırıldı; kısmi eşleşme kabul edilmez.
 */
export const PLAKA_DESENI = new RegExp(
  `^(0[1-9]|[1-7][0-9]|8[01])${HARF}{${EN_AZ_HARF},${EN_COK_HARF}}\\d{${EN_AZ_RAKAM},${EN_COK_RAKAM}}$`,
);

/**
 * Türkçe karakterleri ASCII karşılıklarına çevirir.
 * `toLocaleUpperCase("tr")` kullanılmaz: "i" harfini "İ"ye çevirir ve plakayı bozar.
 */
const TURKCE_HARF_ESLESMESI: Record<string, string> = {
  ı: "I",
  İ: "I",
  i: "I",
  ğ: "G",
  Ğ: "G",
  ü: "U",
  Ü: "U",
  ş: "S",
  Ş: "S",
  ö: "O",
  Ö: "O",
  ç: "C",
  Ç: "C",
};

/**
 * Kullanıcının yazdığı plakayı veritabanı biçimine çevirir:
 * boşluk/tire/nokta atılır, harfler büyütülür, Türkçe karakterler sadeleşir.
 *
 *   " 34 abc 123 " -> "34ABC123"
 */
export function normalizePlaka(girdi: string): string {
  if (!girdi) return "";

  let sonuc = "";
  for (const karakter of girdi) {
    const cevrilmis = TURKCE_HARF_ESLESMESI[karakter] ?? karakter.toUpperCase();
    // Yalnızca A–Z ve 0–9 kalsın
    if (/[A-Z0-9]/.test(cevrilmis)) {
      sonuc += cevrilmis;
    }
  }
  return sonuc;
}

export type PlakaDogrulamaSonucu =
  | { gecerli: true; plaka: string }
  | { gecerli: false; hata: string };

/**
 * Plakayı normalize edip doğrular. Hata mesajları kullanıcıya doğrudan
 * gösterilebilecek şekilde Türkçe ve açıklayıcıdır.
 */
export function dogrulaPlaka(girdi: string): PlakaDogrulamaSonucu {
  const plaka = normalizePlaka(girdi);

  if (plaka.length === 0) {
    return { gecerli: false, hata: "Plaka boş olamaz." };
  }

  // Yasaklı harfleri özel olarak yakala ki kullanıcı sebebini anlasın.
  const yasakliHarfler = [...new Set(plaka.match(/[QWX]/g) ?? [])];
  if (yasakliHarfler.length > 0) {
    return {
      gecerli: false,
      hata: `Türk plakalarında ${yasakliHarfler.join(", ")} harfi kullanılmaz.`,
    };
  }

  const ilKodu = plaka.slice(0, 2);
  if (!/^\d{2}$/.test(ilKodu)) {
    return { gecerli: false, hata: "Plaka iki haneli il kodu ile başlamalıdır." };
  }

  const ilKoduSayi = Number(ilKodu);
  if (ilKoduSayi < 1 || ilKoduSayi > 81) {
    return { gecerli: false, hata: `Geçersiz il kodu: ${ilKodu}. İl kodu 01–81 arasında olmalıdır.` };
  }

  if (!PLAKA_DESENI.test(plaka)) {
    return {
      gecerli: false,
      hata: "Plaka biçimi geçersiz. İl kodundan sonra 1–3 harf ve 2–5 rakam olmalı (örn. 34 ABC 123).",
    };
  }

  return { gecerli: true, plaka };
}

/** `dogrulaPlaka` üzerine ince bir sarmalayıcı. */
export function plakaGecerliMi(girdi: string): boolean {
  return dogrulaPlaka(girdi).gecerli;
}

/**
 * Ekranda gösterim için plakayı gruplara ayırır: "34ABC123" -> "34 ABC 123".
 * Geçersiz/eksik plakalarda girdiyi olduğu gibi döndürür (kullanıcı yazarken
 * ekranın bozulmaması için).
 */
export function formatlaPlaka(girdi: string): string {
  const plaka = normalizePlaka(girdi);
  const eslesme = plaka.match(/^(\d{2})([A-Z]{1,3})(\d{2,5})$/);
  if (!eslesme) return plaka;
  return `${eslesme[1]} ${eslesme[2]} ${eslesme[3]}`;
}

/**
 * Kullanıcı yazarken alana uygulanan maske. Doğrulama yapmaz — yalnızca
 * okunabilirlik için araya boşluk koyar ve uzunluğu sınırlar.
 *
 *   "34a"      -> "34 A"
 *   "34abc123" -> "34 ABC 123"
 */
export function maskelePlaka(girdi: string): string {
  const ham = normalizePlaka(girdi).slice(0, 2 + EN_COK_HARF + EN_COK_RAKAM);
  if (ham.length <= 2) return ham;

  const ilKodu = ham.slice(0, 2);
  const kalan = ham.slice(2);

  const harfler = kalan.match(/^[A-Z]{0,3}/)?.[0] ?? "";
  const rakamlar = kalan.slice(harfler.length).replace(/\D/g, "").slice(0, EN_COK_RAKAM);

  if (!harfler) return ilKodu;
  if (!rakamlar) return `${ilKodu} ${harfler}`;
  return `${ilKodu} ${harfler} ${rakamlar}`;
}

/**
 * Kısmi arama girdisini normalize eder. Görevli "123", "34abc" veya
 * "34 ABC 123" yazabilir; hepsi aynı biçime indirgenir.
 */
export function normalizeAramaTerimi(girdi: string): string {
  return normalizePlaka(girdi).slice(0, 14);
}

// ---------------------------------------------------------------------------
// Plakasız kayıtlar
// ---------------------------------------------------------------------------

export type AracKimligi = {
  plaka?: string | null;
  plakaGosterim?: string | null;
  marka?: string | null;
  model?: string | null;
  fisNo?: number | null;
};

/**
 * Bir park kaydını ekranda tanıtan metin.
 *
 * Plaka varsa plaka; yoksa marka + model. İkisi de yoksa fiş numarası.
 * Görevli plakayı okuyamadığında aracı marka/model ile kaydedebildiği için
 * (plaka sonradan eklenir) listelerin hepsi bu yardımcıdan geçer.
 */
export function aracEtiketi(kayit: AracKimligi): string {
  if (kayit.plaka) return kayit.plakaGosterim || formatlaPlaka(kayit.plaka);

  const aracBilgisi = [kayit.marka, kayit.model].filter(Boolean).join(" ");
  if (aracBilgisi) return aracBilgisi;

  return kayit.fisNo ? `Fiş #${kayit.fisNo}` : "Plakasız araç";
}

/** Kayıt plakasız mı? (arayüzde farklı rozet gösterilir) */
export function plakasizMi(kayit: AracKimligi): boolean {
  return !kayit.plaka;
}

// ---------------------------------------------------------------------------
// Yabancı plakalar
// ---------------------------------------------------------------------------

/**
 * Yabancı plakalar Türk kalıplarına uymaz: ülkeden ülkeye harf/rakam düzeni
 * değişir, Q-W-X serbesttir, uzunluk farklıdır. Bu yüzden kalıp dayatmak
 * yerine yalnızca "makul" olup olmadığı kontrol edilir — görevli sahadaki
 * aracı kaydedemeden kalmasın.
 */
export const YABANCI_PLAKA_EN_AZ = 2;
export const YABANCI_PLAKA_EN_COK = 14;

/**
 * Yabancı plakayı veritabanı biçimine çevirir: yalnızca A–Z ve 0–9 kalır.
 * Arama ve benzersizlik bu biçim üzerinden çalışır — böylece "M-AB 1234" ile
 * "MAB1234" aynı araç sayılır ve mükerrer kayıt oluşmaz.
 */
export function normalizeYabanciPlaka(girdi: string): string {
  return normalizePlaka(girdi).slice(0, YABANCI_PLAKA_EN_COK);
}

/**
 * Görevlinin yazdığı okunabilir hâli korur ("M AB 1234").
 * Yabancı plakalarda gruplama kuralı ülkeye göre değiştiği için gösterim
 * biçimi hesaplanamaz; kullanıcının yazdığı gibi saklanır.
 */
export function gosterimPlakasiOlustur(girdi: string): string {
  let sonuc = "";
  for (const karakter of girdi) {
    const cevrilmis = TURKCE_HARF_ESLESMESI[karakter] ?? karakter.toUpperCase();
    // Harf, rakam ve okunabilirlik için boşluk/tire kabul edilir.
    if (/[A-Z0-9 -]/.test(cevrilmis)) sonuc += cevrilmis;
  }
  // Baştaki/sondaki ve tekrar eden boşlukları sadeleştir.
  return sonuc.replace(/\s+/g, " ").trim().slice(0, 18);
}

export function dogrulaYabanciPlaka(girdi: string): PlakaDogrulamaSonucu {
  const plaka = normalizeYabanciPlaka(girdi);

  if (plaka.length === 0) {
    return { gecerli: false, hata: "Plaka boş olamaz." };
  }
  if (plaka.length < YABANCI_PLAKA_EN_AZ) {
    return { gecerli: false, hata: `Plaka en az ${YABANCI_PLAKA_EN_AZ} karakter olmalıdır.` };
  }
  if (!/\d/.test(plaka) && !/[A-Z]/.test(plaka)) {
    return { gecerli: false, hata: "Plaka harf veya rakam içermelidir." };
  }

  return { gecerli: true, plaka };
}

export type CozulmusPlaka = {
  /** Veritabanına yazılan biçim: boşluksuz, büyük harf. */
  plaka: string;
  /** Ekranda gösterilen biçim. */
  plakaGosterim: string;
};

/**
 * Türk / yabancı ayrımını tek yerde çözer. Hem Server Action'lar hem de
 * doğrulama şemaları buradan geçer ki kural iki yerde ayrışmasın.
 */
export function cozPlaka(
  girdi: string,
  yabanci: boolean,
): { gecerli: true; deger: CozulmusPlaka } | { gecerli: false; hata: string } {
  if (yabanci) {
    const sonuc = dogrulaYabanciPlaka(girdi);
    if (!sonuc.gecerli) return { gecerli: false, hata: sonuc.hata };
    return {
      gecerli: true,
      deger: { plaka: sonuc.plaka, plakaGosterim: gosterimPlakasiOlustur(girdi) },
    };
  }

  const sonuc = dogrulaPlaka(girdi);
  if (!sonuc.gecerli) return { gecerli: false, hata: sonuc.hata };
  return {
    gecerli: true,
    deger: { plaka: sonuc.plaka, plakaGosterim: formatlaPlaka(sonuc.plaka) },
  };
}

/**
 * Otoparka en sık gelen yabancı plaka ülkeleri.
 * `kod` alanı plakanın yanındaki şeritte gösterilir; listede olmayan ülkeler
 * için "Diğer" seçilir.
 */
export const ULKELER = [
  { kod: "BG", ad: "Bulgaristan" },
  { kod: "DE", ad: "Almanya" },
  { kod: "GE", ad: "Gürcistan" },
  { kod: "IR", ad: "İran" },
  { kod: "IQ", ad: "Irak" },
  { kod: "SY", ad: "Suriye" },
  { kod: "AZ", ad: "Azerbaycan" },
  { kod: "NL", ad: "Hollanda" },
  { kod: "FR", ad: "Fransa" },
  { kod: "AT", ad: "Avusturya" },
  { kod: "BE", ad: "Belçika" },
  { kod: "CH", ad: "İsviçre" },
  { kod: "GB", ad: "Birleşik Krallık" },
  { kod: "GR", ad: "Yunanistan" },
  { kod: "RO", ad: "Romanya" },
  { kod: "RS", ad: "Sırbistan" },
  { kod: "MK", ad: "Kuzey Makedonya" },
  { kod: "XK", ad: "Kosova" },
  { kod: "MD", ad: "Moldova" },
  { kod: "UA", ad: "Ukrayna" },
  { kod: "RU", ad: "Rusya" },
  { kod: "KZ", ad: "Kazakistan" },
  { kod: "TM", ad: "Türkmenistan" },
  { kod: "IT", ad: "İtalya" },
  { kod: "PL", ad: "Polonya" },
  { kod: "KKTC", ad: "KKTC" },
] as const;

export const ULKE_KODLARI = ULKELER.map((ulke) => ulke.kod) as readonly string[];

/** Ülke kodundan okunabilir ad ("BG" → "Bulgaristan"). */
export function ulkeAdi(kod: string | null | undefined): string | null {
  if (!kod) return null;
  return ULKELER.find((ulke) => ulke.kod === kod)?.ad ?? kod;
}
