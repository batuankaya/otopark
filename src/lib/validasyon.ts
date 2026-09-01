/**
 * Zod şemaları — istemci ve sunucu aynı doğrulamayı kullanır.
 * Hata mesajları doğrudan kullanıcıya gösterilebilecek şekilde Türkçedir.
 */

import { z } from "zod";
import { cozPlaka, dogrulaPlaka, ULKE_KODLARI } from "./plaka";
import { tutarAyristir } from "./para";
import { bugununSaati } from "./tarih";

/** Serbest metin alanlarını temizler; boş string yerine undefined döndürür. */
const bosluklarıTemizle = (deger: unknown) => {
  if (typeof deger !== "string") return deger;
  const temiz = deger.trim();
  return temiz === "" ? undefined : temiz;
};

/** Form alanından gelen tutarı ("1.234,50" veya "1234.5") sayıya çevirir. */
const tutarAlani = (etiket: string) =>
  z.preprocess((deger) => {
    if (typeof deger === "number") return deger;
    if (typeof deger !== "string") return deger;
    const temiz = deger.trim();
    if (temiz === "") return undefined;
    return tutarAyristir(temiz) ?? Number.NaN;
  }, z.number({ message: `${etiket} geçerli bir tutar olmalıdır.` }).min(0, `${etiket} negatif olamaz.`));

// ---------------------------------------------------------------------------
// Ortak alanlar
// ---------------------------------------------------------------------------

export const plakaAlani = z
  .string({ message: "Plaka zorunludur." })
  .transform((deger) => deger.trim())
  .superRefine((deger, ctx) => {
    const sonuc = dogrulaPlaka(deger);
    if (!sonuc.gecerli) {
      ctx.addIssue({ code: "custom", message: sonuc.hata });
    }
  })
  .transform((deger) => {
    const sonuc = dogrulaPlaka(deger);
    return sonuc.gecerli ? sonuc.plaka : deger;
  });

/** Checkbox / "on" / "true" değerlerini boolean'a çevirir. */
const isaretKutusu = z.preprocess(
  (deger) => deger === true || deger === "on" || deger === "true" || deger === "1",
  z.boolean(),
);

const ulkeKoduAlani = z.preprocess(
  bosluklarıTemizle,
  z
    .string()
    .transform((deger) => deger.toUpperCase())
    .refine((deger) => ULKE_KODLARI.includes(deger) || deger === "XX", {
      message: "Geçersiz ülke seçimi.",
    })
    .optional(),
);

/**
 * Türk ya da yabancı plaka kabul eden ortak alanlar.
 *
 * Yabancı plakalarda Türk kalıbı dayatılmaz (ülkeden ülkeye değişir, Q-W-X
 * serbesttir); yalnızca makul uzunluk ve içerik aranır. Çözümleme `cozPlaka`
 * ile tek yerden yapılır ki kural sunucu ve istemcide ayrışmasın.
 */
export const plakaGirdiAlanlari = {
  plaka: z.string({ message: "Plaka zorunludur." }),
  yabanciPlaka: isaretKutusu.default(false),
  ulkeKodu: ulkeKoduAlani,
};

type PlakaGirdisi = { plaka: string; yabanciPlaka: boolean; ulkeKodu?: string };

/** Plakanın (Türk ya da yabancı) geçerliliğini denetler. */
function plakaKontrolu(veri: PlakaGirdisi, ctx: z.RefinementCtx): void {
  const sonuc = cozPlaka(veri.plaka, veri.yabanciPlaka);
  if (!sonuc.gecerli) {
    ctx.addIssue({ code: "custom", message: sonuc.hata, path: ["plaka"] });
  }
}

/** Ham plakayı saklama ve gösterim biçimlerine ayırır. */
function plakayiCozumle<T extends PlakaGirdisi>(veri: T) {
  const sonuc = cozPlaka(veri.plaka, veri.yabanciPlaka);
  return {
    ...veri,
    plaka: sonuc.gecerli ? sonuc.deger.plaka : veri.plaka,
    plakaGosterim: sonuc.gecerli ? sonuc.deger.plakaGosterim : veri.plaka,
    // Türk plakasında ülke kodu tutulmaz.
    ulkeKodu: veri.yabanciPlaka ? (veri.ulkeKodu ?? null) : null,
  };
}

const sebepAlani = z
  .string({ message: "Sebep girilmesi zorunludur." })
  .trim()
  .min(1, "Sebep en az 1 karakter olmalıdır.")
  .max(500, "Sebep en fazla 500 karakter olabilir.");

const opsiyonelMetin = (enFazla = 200) =>
  z.preprocess(bosluklarıTemizle, z.string().max(enFazla, `En fazla ${enFazla} karakter.`).optional());

// ---------------------------------------------------------------------------
// Kimlik doğrulama
// ---------------------------------------------------------------------------

/**
 * Şifre alanı.
 *
 * Kural: en az 10 karakter + harf + rakam. Karmaşık simge zorunluluğu
 * BİLEREK yok — sahada tablet klavyesiyle çalışan görevliyi zorlar ve
 * kullanıcılar şifreyi bir yere yazmaya başlar, ki bu daha kötüdür.
 * Uzunluk, karmaşıklıktan daha etkilidir.
 *
 * Ayrıca en sık kullanılan şifreler reddedilir: brute force koruması olsa da
 * saldırganın ilk 8 denemede tutturması hâlâ mümkün.
 */
const YAYGIN_SIFRELER = [
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "parola123",
  "sifre123",
  "qwerty123",
  "admin123",
  "otopark123",
  "11111111",
  "asdasdasd",
  "123123123",
];

const sifreAlani = z
  .string()
  .min(10, "Şifre en az 10 karakter olmalıdır.")
  .max(72, "Şifre en fazla 72 karakter olabilir.")
  .refine((deger) => /[0-9]/.test(deger), {
    message: "Şifre en az bir rakam içermelidir.",
  })
  .refine((deger) => /[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(deger), {
    message: "Şifre en az bir harf içermelidir.",
  })
  .refine((deger) => !YAYGIN_SIFRELER.includes(deger.toLowerCase()), {
    message: "Bu şifre çok yaygın kullanılıyor, başka bir şifre seçin.",
  });

export const girisSemasi = z.object({
  email: z
    .string({ message: "E-posta zorunludur." })
    .trim()
    .toLowerCase()
    .email("Geçerli bir e-posta adresi girin."),
  sifre: z.string({ message: "Şifre zorunludur." }).min(1, "Şifre zorunludur."),
});

export const kullaniciSemasi = z.object({
  adSoyad: z.string().trim().min(3, "Ad soyad en az 3 karakter olmalıdır.").max(100),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta adresi girin."),
  rol: z.enum(["ADMIN", "GOREVLI"], { message: "Rol seçilmelidir." }),
  aktif: z.coerce.boolean().default(true),
  sifre: z.preprocess(bosluklarıTemizle, sifreAlani.optional()),
});

/** Yeni kullanıcıda şifre zorunlu. */
export const yeniKullaniciSemasi = kullaniciSemasi.refine((veri) => !!veri.sifre, {
  message: "Yeni kullanıcı için şifre zorunludur.",
  path: ["sifre"],
});

export const sifreDegistirSemasi = z
  .object({
    mevcutSifre: z.string().min(1, "Mevcut şifre zorunludur."),
    yeniSifre: sifreAlani,
    yeniSifreTekrar: z.string().min(1, "Şifre tekrarı zorunludur."),
  })
  .refine((veri) => veri.yeniSifre === veri.yeniSifreTekrar, {
    message: "Şifreler eşleşmiyor.",
    path: ["yeniSifreTekrar"],
  });

// ---------------------------------------------------------------------------
// Araç giriş / çıkış
// ---------------------------------------------------------------------------

export const aracGirisSemasi = z
  .object({
    // Plaka boş bırakılabilir; o durumda marka + model zorunlu olur.
    plaka: z.preprocess(bosluklarıTemizle, z.string().optional()),
    yabanciPlaka: isaretKutusu.default(false),
    ulkeKodu: ulkeKoduAlani,
    marka: opsiyonelMetin(50),
    model: opsiyonelMetin(50),
    renk: opsiyonelMetin(30),
    parkAlaniId: z.preprocess(bosluklarıTemizle, z.string().optional()),
    tarifeTuru: z.enum(["SAATLIK", "GUNLUK", "ABONMAN"]).default("SAATLIK"),
    /** Ücreti belirleyen sınıf; her sınıfın kendi tarifesi vardır. */
    aracSinifi: z.enum(["BINEK", "BUYUK"]).default("BINEK"),
    /**
     * Geriye dönük giriş — yalnızca AYNI GÜN, yalnızca saat ("HH:MM").
     * Görevli 16:00'da "bu araç 15:25'te gelmişti" diyebilsin diye tarih
     * sorulmaz. Boş bırakılırsa şu anki saat kullanılır.
     */
    girisSaati: z.preprocess(bosluklarıTemizle, z.string().optional()),
    notlar: opsiyonelMetin(500),
  })
  .superRefine((veri, ctx) => {
    // Plakasız kayıt: aracı sonradan tanıyabilmek için marka ve model şart.
    if (!veri.plaka) {
      if (!veri.marka || !veri.model) {
        ctx.addIssue({
          code: "custom",
          message: "Plaka girilmediğinde marka ve model zorunludur.",
          path: [!veri.marka ? "marka" : "model"],
        });
      }
      return;
    }
    plakaKontrolu({ ...veri, plaka: veri.plaka }, ctx);
  })
  .superRefine((veri, ctx) => {
    if (!veri.girisSaati) return;

    const zaman = bugununSaati(veri.girisSaati);
    if (!zaman) {
      ctx.addIssue({
        code: "custom",
        message: "Saat geçersiz. Örnek: 15:25",
        path: ["girisSaati"],
      });
      return;
    }

    // Küçük saat sapmalarına tolerans: 2 dakika ileri kabul edilir.
    if (zaman.getTime() > Date.now() + 2 * 60_000) {
      ctx.addIssue({
        code: "custom",
        message: "Giriş saati ileri bir saat olamaz.",
        path: ["girisSaati"],
      });
    }
  })
  .transform((veri) => {
    const girisZamani = veri.girisSaati ? bugununSaati(veri.girisSaati) : null;

    if (!veri.plaka) {
      // Plakasız kayıt — araç marka/model ile tanınır.
      return {
        ...veri,
        plaka: null as string | null,
        plakaGosterim: null as string | null,
        ulkeKodu: null as string | null,
        yabanciPlaka: false,
        girisZamani,
      };
    }

    const cozum = plakayiCozumle({ ...veri, plaka: veri.plaka });
    return {
      ...cozum,
      plaka: cozum.plaka as string | null,
      plakaGosterim: cozum.plakaGosterim as string | null,
      girisZamani,
    };
  });

export const aracCikisSemasi = z.object({
  parkKaydiId: z.string().min(1, "Park kaydı bulunamadı."),
  odemeYontemi: z.enum(["NAKIT", "KART"], { message: "Ödeme yöntemi seçilmelidir." }),
  /**
   * İskonto sonrası tahakkuk eden tutar — görevli ücreti değiştirdiyse dolu
   * gelir. Boşsa tarifeden hesaplanan tutar geçerlidir.
   */
  duzeltilmisUcret: tutarAlani("Tahsil edilen ücret").optional(),
  ucretDuzeltmeSebebi: z.preprocess(bosluklarıTemizle, z.string().min(5, "Düzeltme sebebi en az 5 karakter olmalıdır.").max(500).optional()),
  /**
   * Müşterinin ŞU AN ödediği tutar. Tahakkuktan azsa aradaki fark borç
   * olarak kaydedilir. Boşsa tahakkukun tamamı ödenmiş sayılır.
   */
  alinanTutar: tutarAlani("Alınan tutar").optional(),
  /** Aracın eski borçlarından bu işlemde tahsil edilen tutar. */
  borcTahsilati: tutarAlani("Borç tahsilatı").optional(),
  notlar: opsiyonelMetin(500),
});

/**
 * İçerideki bir kaydı düzenleme.
 *
 * Giriş saati ücreti doğrudan etkilediği için burada da aynı gün + ileri
 * saat kuralı işler. Plakasız kayda plaka eklenebilir; plakalı kayıttan
 * plaka silinemez (araç zaten tanımlı).
 */
export const kayitDuzenleSemasi = z
  .object({
    parkKaydiId: z.string().min(1, "Kayıt bulunamadı."),
    plaka: z.preprocess(bosluklarıTemizle, z.string().optional()),
    yabanciPlaka: isaretKutusu.default(false),
    ulkeKodu: ulkeKoduAlani,
    marka: opsiyonelMetin(50),
    model: opsiyonelMetin(50),
    renk: opsiyonelMetin(30),
    /** Yanlış sınıf seçilmişse düzeltilebilir — ücreti doğrudan etkiler. */
    aracSinifi: z.enum(["BINEK", "BUYUK"]).default("BINEK"),
    girisSaati: z.preprocess(bosluklarıTemizle, z.string().optional()),
    notlar: opsiyonelMetin(500),
  })
  .superRefine((veri, ctx) => {
    if (veri.plaka) {
      plakaKontrolu({ ...veri, plaka: veri.plaka }, ctx);
    } else if (!veri.marka || !veri.model) {
      ctx.addIssue({
        code: "custom",
        message: "Plaka yoksa marka ve model zorunludur.",
        path: [!veri.marka ? "marka" : "model"],
      });
    }
  })
  .superRefine((veri, ctx) => {
    if (!veri.girisSaati) return;
    const zaman = bugununSaati(veri.girisSaati);
    if (!zaman) {
      ctx.addIssue({ code: "custom", message: "Saat geçersiz. Örnek: 15:25", path: ["girisSaati"] });
      return;
    }
    if (zaman.getTime() > Date.now() + 2 * 60_000) {
      ctx.addIssue({
        code: "custom",
        message: "Giriş saati ileri bir saat olamaz.",
        path: ["girisSaati"],
      });
    }
  })
  .transform((veri) => {
    const girisZamani = veri.girisSaati ? bugununSaati(veri.girisSaati) : null;
    if (!veri.plaka) {
      return { ...veri, plaka: null as string | null, plakaGosterim: null as string | null, ulkeKodu: null as string | null, yabanciPlaka: false, girisZamani };
    }
    const cozum = plakayiCozumle({ ...veri, plaka: veri.plaka });
    return {
      ...cozum,
      plaka: cozum.plaka as string | null,
      plakaGosterim: cozum.plakaGosterim as string | null,
      girisZamani,
    };
  });

export const kayitIptalSemasi = z.object({
  parkKaydiId: z.string().min(1),
  iptalSebebi: sebepAlani,
});

// ---------------------------------------------------------------------------
// Abonman
// ---------------------------------------------------------------------------

export const abonmanSemasi = z
  .object({
    ...plakaGirdiAlanlari,
    musteriAdi: z.string().trim().min(3, "Müşteri adı en az 3 karakter olmalıdır.").max(100),
    telefon: z.preprocess(
      bosluklarıTemizle,
      z
        .string()
        .regex(/^0?5\d{9}$|^0\d{10}$/, "Telefon 05XXXXXXXXX biçiminde olmalıdır.")
        .optional(),
    ),
    baslangicTarihi: z.coerce.date({ message: "Başlangıç tarihi geçersiz." }),
    bitisTarihi: z.coerce.date({ message: "Bitiş tarihi geçersiz." }),
    aylikUcret: tutarAlani("Aylık ücret"),
    durum: z.enum(["AKTIF", "SURESI_DOLDU", "IPTAL"]).default("AKTIF"),
    notlar: opsiyonelMetin(500),
  })
  .superRefine(plakaKontrolu)
  .refine((veri) => veri.bitisTarihi > veri.baslangicTarihi, {
    message: "Bitiş tarihi başlangıç tarihinden sonra olmalıdır.",
    path: ["bitisTarihi"],
  })
  .transform(plakayiCozumle);

// ---------------------------------------------------------------------------
// Personel mesai
// ---------------------------------------------------------------------------

export const personelSaatSemasi = z.object({
  kayitId: z.string().min(1, "Kayıt bulunamadı."),
  saat: z
    .string({ message: "Saat zorunludur." })
    .trim()
    .regex(/^\d{1,2}:\d{2}$/, "Saat SS:DD biçiminde olmalıdır. Örnek: 08:30"),
});

// ---------------------------------------------------------------------------
// Giderler
// ---------------------------------------------------------------------------

export const giderSemasi = z.object({
  kategori: z
    .enum(["YEMEK", "CAY", "TEMIZLIK", "BAKIM", "KIRTASIYE", "DIGER"])
    .default("DIGER"),
  tutar: tutarAlani("Gider tutarı").refine((deger) => deger > 0, {
    message: "Gider tutarı sıfırdan büyük olmalıdır.",
  }),
  aciklama: z
    .string({ message: "Açıklama zorunludur." })
    .trim()
    .min(2, "Açıklama en az 2 karakter olmalıdır.")
    .max(200, "Açıklama en fazla 200 karakter olabilir."),
  odemeYontemi: z.enum(["NAKIT", "KART"]).default("NAKIT"),
});

// ---------------------------------------------------------------------------
// Vardiya
// ---------------------------------------------------------------------------

export const vardiyaAcSemasi = z.object({
  acilisKasa: tutarAlani("Açılış kasası"),
  notlar: opsiyonelMetin(500),
});

export const vardiyaKapatSemasi = z.object({
  vardiyaId: z.string().min(1),
  kapanisKasa: tutarAlani("Kapanış kasası"),
  notlar: opsiyonelMetin(500),
});

// ---------------------------------------------------------------------------
// Ayarlar
// ---------------------------------------------------------------------------

export const tarifeSemasi = z.object({
  ad: z.string().trim().min(3, "Tarife adı en az 3 karakter olmalıdır.").max(60),
  aracSinifi: z.enum(["BINEK", "BUYUK"]).default("BINEK"),
  ilkUcretsizDakika: z.coerce
    .number({ message: "Ücretsiz süre sayı olmalıdır." })
    .int("Ücretsiz süre tam sayı olmalıdır.")
    .min(0, "Ücretsiz süre negatif olamaz.")
    .max(1440, "Ücretsiz süre en fazla 1440 dakika olabilir."),
  ilkSaatUcreti: tutarAlani("İlk saat ücreti"),
  saatlikUcret: tutarAlani("Sonraki saat ücreti"),
  gunlukTavanUcret: tutarAlani("Günlük tavan ücreti"),
});

export const parkAlaniSemasi = z.object({
  ad: z.string().trim().min(1, "Park alanı adı zorunludur.").max(40),
  kapasite: z.coerce.number().int().min(0, "Kapasite negatif olamaz.").max(10000),
  sira: z.coerce.number().int().min(0).max(999).default(0),
  aktif: z.coerce.boolean().default(true),
});

export const ayarSemasi = z.object({
  otoparkAdi: z.string().trim().min(2, "Otopark adı en az 2 karakter olmalıdır.").max(80),
  adres: opsiyonelMetin(200),
  telefon: opsiyonelMetin(30),
  toplamKapasite: z.coerce
    .number({ message: "Kapasite sayı olmalıdır." })
    .int("Kapasite tam sayı olmalıdır.")
    .min(1, "Kapasite en az 1 olmalıdır.")
    .max(100000),
  fisAltNotu: opsiyonelMetin(200),
  // Vardiyanın otomatik sıfırlandığı saat. 0 = gece yarısı, 12 = öğlen.
  //
  // Boş değer BİLEREK reddedilir: `z.coerce.number("")` sıfır üretir ve
  // sıfırlama saati sessizce gece yarısına kayar. Sıfır ancak açıkça
  // yazıldığında kabul edilmeli.
  vardiyaSifirlamaSaati: z.preprocess(
    (deger) => (typeof deger === "string" && deger.trim() === "" ? undefined : deger),
    z.coerce
      .number({ message: "Sıfırlama saati 0 ile 23 arasında bir sayı olmalıdır." })
      .int("Sıfırlama saati tam sayı olmalıdır (örn. 12).")
      .min(0, "Sıfırlama saati 0 ile 23 arasında olmalıdır.")
      .max(23, "Sıfırlama saati 0 ile 23 arasında olmalıdır."),
  ),
});

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

export type AlanHatalari = Record<string, string>;

/** Zod hatasını `{ alanAdi: "mesaj" }` biçimine indirger — form gösterimi için. */
export function hatalariTopla(hata: z.ZodError): AlanHatalari {
  const sonuc: AlanHatalari = {};
  for (const sorun of hata.issues) {
    const anahtar = sorun.path.join(".") || "_genel";
    if (!sonuc[anahtar]) sonuc[anahtar] = sorun.message;
  }
  return sonuc;
}

/** FormData'yı düz nesneye çevirir (checkbox'lar için "on" → true). */
export function formVerisiniAl(formData: FormData): Record<string, unknown> {
  const nesne: Record<string, unknown> = {};
  for (const [anahtar, deger] of formData.entries()) {
    if (typeof deger === "string") {
      nesne[anahtar] = deger === "on" ? true : deger;
    }
  }
  return nesne;
}
