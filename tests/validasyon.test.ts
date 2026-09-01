import { afterEach, describe, expect, it, vi } from "vitest";
import type { ZodType } from "zod";
import type { AlanHatalari } from "@/lib/validasyon";
import {
  abonmanSemasi,
  aracCikisSemasi,
  aracGirisSemasi,
  ayarSemasi,
  formVerisiniAl,
  giderSemasi,
  girisSemasi,
  hatalariTopla,
  sifreDegistirSemasi,
  vardiyaAcSemasi,
  yeniKullaniciSemasi,
} from "@/lib/validasyon";

/**
 * Zod şemaları — istemci ve sunucunun paylaştığı tek doğrulama katmanı.
 *
 * Server Action'lar doğrudan istek atılarak da çağrılabildiği için bu
 * şemalar son savunma hattıdır; buradaki bir boşluk veritabanına bozuk
 * veri geçirir.
 */

/** Şemayı çalıştırıp alan hatalarını `{ alan: mesaj }` sözlüğü olarak verir. */
function hatalar(sema: ZodType, veri: unknown): AlanHatalari {
  const sonuc = sema.safeParse(veri);
  return sonuc.success ? {} : hatalariTopla(sonuc.error);
}

describe("girisSemasi", () => {
  it("e-postayı küçük harfe çevirip boşlukları atar", () => {
    const sonuc = girisSemasi.safeParse({ email: "  Admin@Otopark.COM ", sifre: "x" });
    expect(sonuc.success && sonuc.data.email).toBe("admin@otopark.com");
  });

  it("geçersiz e-posta reddedilir", () => {
    expect(hatalar(girisSemasi, { email: "abc", sifre: "x" }).email).toBeDefined();
  });

  it("boş şifre reddedilir", () => {
    expect(hatalar(girisSemasi, { email: "a@b.com", sifre: "" }).sifre).toBeDefined();
  });
});

describe("şifre kuralları", () => {
  const gecerli = { adSoyad: "Ali Veli", email: "a@b.com", rol: "GOREVLI" };

  it("en az 10 karakter ister", () => {
    expect(hatalar(yeniKullaniciSemasi, { ...gecerli, sifre: "Kisa12" }).sifre).toContain("10");
  });

  it("rakam ister", () => {
    expect(hatalar(yeniKullaniciSemasi, { ...gecerli, sifre: "sadeceharf" }).sifre).toContain(
      "rakam",
    );
  });

  it("harf ister", () => {
    expect(hatalar(yeniKullaniciSemasi, { ...gecerli, sifre: "1234567890" }).sifre).toBeDefined();
  });

  it("yaygın şifreleri reddeder", () => {
    // Brute force koruması olsa da ilk denemelerde tutturulabilir.
    expect(hatalar(yeniKullaniciSemasi, { ...gecerli, sifre: "otopark123" }).sifre).toContain(
      "yaygın",
    );
  });

  it("büyük/küçük harf farkı yaygın şifre kontrolünü atlatamaz", () => {
    expect(hatalar(yeniKullaniciSemasi, { ...gecerli, sifre: "Otopark123" }).sifre).toContain(
      "yaygın",
    );
  });

  it("geçerli şifreyi kabul eder", () => {
    expect(hatalar(yeniKullaniciSemasi, { ...gecerli, sifre: "Kirmizi2026Araba" })).toEqual({});
  });

  it("yeni kullanıcıda şifre zorunludur", () => {
    expect(hatalar(yeniKullaniciSemasi, gecerli).sifre).toBeDefined();
  });

  it("şifre tekrarı eşleşmeli", () => {
    const sonuc = hatalar(sifreDegistirSemasi, {
      mevcutSifre: "eski",
      yeniSifre: "Kirmizi2026Araba",
      yeniSifreTekrar: "Baska2026Araba",
    });
    expect(sonuc.yeniSifreTekrar).toContain("eşleşmiyor");
  });
});

describe("aracGirisSemasi", () => {
  afterEach(() => vi.useRealTimers());

  it("plakayı normalize eder ve gösterimi ayrı üretir", () => {
    const sonuc = aracGirisSemasi.safeParse({ plaka: " 34 abc 123 " });
    expect(sonuc.success).toBe(true);
    if (sonuc.success) {
      expect(sonuc.data.plaka).toBe("34ABC123");
      expect(sonuc.data.plakaGosterim).toBe("34 ABC 123");
    }
  });

  it("plakasız kayıtta marka ve model zorunludur", () => {
    expect(hatalar(aracGirisSemasi, {}).marka).toBeDefined();
    expect(hatalar(aracGirisSemasi, { marka: "Toyota" }).model).toBeDefined();
    expect(hatalar(aracGirisSemasi, { marka: "Toyota", model: "Corolla" })).toEqual({});
  });

  it("plakasız kayıtta plaka alanları boşaltılır", () => {
    const sonuc = aracGirisSemasi.safeParse({ marka: "Toyota", model: "Corolla" });
    expect(sonuc.success && sonuc.data.plaka).toBeNull();
    expect(sonuc.success && sonuc.data.plakaGosterim).toBeNull();
  });

  it("Türk plakasında ülke kodu tutulmaz", () => {
    const sonuc = aracGirisSemasi.safeParse({ plaka: "34ABC123", ulkeKodu: "DE" });
    expect(sonuc.success && sonuc.data.ulkeKodu).toBeNull();
  });

  it("yabancı plakada ülke kodu korunur", () => {
    const sonuc = aracGirisSemasi.safeParse({
      plaka: "M AB 1234",
      yabanciPlaka: "on",
      ulkeKodu: "de",
    });
    expect(sonuc.success && sonuc.data.ulkeKodu).toBe("DE");
  });

  it("geçersiz ülke kodu reddedilir", () => {
    const sonuc = hatalar(aracGirisSemasi, {
      plaka: "M AB 1234",
      yabanciPlaka: "on",
      ulkeKodu: "ZZ",
    });
    expect(sonuc.ulkeKodu).toBeDefined();
  });

  it("varsayılan tarife türü saatliktir", () => {
    const sonuc = aracGirisSemasi.safeParse({ plaka: "34ABC123" });
    expect(sonuc.success && sonuc.data.tarifeTuru).toBe("SAATLIK");
  });

  describe("giriş saati", () => {
    // 15 Temmuz 2026, İstanbul 16:00
    const AN = new Date("2026-07-15T13:00:00.000Z");

    function saatiSabitle() {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(AN);
    }

    it("geçmiş saat kabul edilir", () => {
      saatiSabitle();
      const sonuc = aracGirisSemasi.safeParse({ plaka: "34ABC123", girisSaati: "15:25" });
      expect(sonuc.success && sonuc.data.girisZamani?.toISOString()).toBe(
        "2026-07-15T12:25:00.000Z",
      );
    });

    it("ileri saat reddedilir", () => {
      saatiSabitle();
      expect(hatalar(aracGirisSemasi, { plaka: "34ABC123", girisSaati: "18:00" }).girisSaati)
        .toContain("ileri");
    });

    it("iki dakikalık saat sapmasına tolerans var", () => {
      saatiSabitle();
      // 16:01 — saat biraz ileri giden tablette işlem takılmasın.
      expect(hatalar(aracGirisSemasi, { plaka: "34ABC123", girisSaati: "16:01" })).toEqual({});
    });

    it("biçimsiz saat reddedilir", () => {
      saatiSabitle();
      expect(hatalar(aracGirisSemasi, { plaka: "34ABC123", girisSaati: "25:99" }).girisSaati)
        .toContain("geçersiz");
    });

    it("saat verilmezse zaman boş bırakılır", () => {
      saatiSabitle();
      const sonuc = aracGirisSemasi.safeParse({ plaka: "34ABC123" });
      expect(sonuc.success && sonuc.data.girisZamani).toBeNull();
    });
  });
});

describe("aracCikisSemasi", () => {
  it("ödeme yöntemi zorunludur", () => {
    expect(hatalar(aracCikisSemasi, { parkKaydiId: "abc" }).odemeYontemi).toBeDefined();
  });

  it("geçersiz ödeme yöntemi reddedilir", () => {
    expect(
      hatalar(aracCikisSemasi, { parkKaydiId: "abc", odemeYontemi: "HAVALE" }).odemeYontemi,
    ).toBeDefined();
  });

  it("düzeltme sebebi en az 5 karakterdir", () => {
    const sonuc = hatalar(aracCikisSemasi, {
      parkKaydiId: "abc",
      odemeYontemi: "NAKIT",
      ucretDuzeltmeSebebi: "kısa",
    });
    expect(sonuc.ucretDuzeltmeSebebi).toBeDefined();
  });

  it("düzeltilmiş ücret Türkçe biçimde girilebilir", () => {
    const sonuc = aracCikisSemasi.safeParse({
      parkKaydiId: "abc",
      odemeYontemi: "NAKIT",
      duzeltilmisUcret: "1.234,50",
      ucretDuzeltmeSebebi: "Esnaf indirimi",
    });
    expect(sonuc.success && sonuc.data.duzeltilmisUcret).toBe(1234.5);
  });

  it("alınan tutar ve borç tahsilatı Türkçe biçimde girilebilir", () => {
    const sonuc = aracCikisSemasi.safeParse({
      parkKaydiId: "abc",
      odemeYontemi: "NAKIT",
      alinanTutar: "50",
      borcTahsilati: "1.234,50",
    });
    expect(sonuc.success && sonuc.data.alinanTutar).toBe(50);
    expect(sonuc.success && sonuc.data.borcTahsilati).toBe(1234.5);
  });

  it("negatif alınan tutar reddedilir", () => {
    expect(
      hatalar(aracCikisSemasi, {
        parkKaydiId: "abc",
        odemeYontemi: "NAKIT",
        alinanTutar: "-10",
      }).alinanTutar,
    ).toBeDefined();
  });
});

describe("giderSemasi", () => {
  it("sıfır tutarı reddeder", () => {
    expect(hatalar(giderSemasi, { tutar: "0", aciklama: "Test" }).tutar).toBeDefined();
  });

  it("negatif tutarı reddeder", () => {
    expect(hatalar(giderSemasi, { tutar: "-5", aciklama: "Test" }).tutar).toBeDefined();
  });

  it("açıklama en az iki karakterdir", () => {
    expect(hatalar(giderSemasi, { tutar: "50", aciklama: "x" }).aciklama).toBeDefined();
  });

  it("varsayılanlar diğer/nakittir", () => {
    const sonuc = giderSemasi.safeParse({ tutar: "50", aciklama: "Çay" });
    expect(sonuc.success && sonuc.data.kategori).toBe("DIGER");
    expect(sonuc.success && sonuc.data.odemeYontemi).toBe("NAKIT");
  });
});

describe("vardiyaAcSemasi", () => {
  it("sıfır açılış kasası geçerlidir", () => {
    expect(hatalar(vardiyaAcSemasi, { acilisKasa: "0" })).toEqual({});
  });

  it("negatif açılış kasası reddedilir", () => {
    expect(hatalar(vardiyaAcSemasi, { acilisKasa: "-1" }).acilisKasa).toBeDefined();
  });

  it("boş açılış kasası reddedilir", () => {
    expect(hatalar(vardiyaAcSemasi, { acilisKasa: "" }).acilisKasa).toBeDefined();
  });
});

describe("ayarSemasi", () => {
  const temel = { otoparkAdi: "Otopark", toplamKapasite: "100" };

  it("sıfırlama saati 0–23 aralığındadır", () => {
    expect(hatalar(ayarSemasi, { ...temel, vardiyaSifirlamaSaati: "24" })
      .vardiyaSifirlamaSaati).toBeDefined();
    expect(hatalar(ayarSemasi, { ...temel, vardiyaSifirlamaSaati: "-1" })
      .vardiyaSifirlamaSaati).toBeDefined();
  });

  it("sıfırlama saati 0 açıkça yazılırsa kabul edilir", () => {
    const sonuc = ayarSemasi.safeParse({ ...temel, vardiyaSifirlamaSaati: "0" });
    expect(sonuc.success && sonuc.data.vardiyaSifirlamaSaati).toBe(0);
  });

  it("boş sıfırlama saati sessizce sıfıra düşmez", () => {
    // z.coerce.number("") sıfır üretirdi ve sıfırlama gece yarısına kayardı.
    expect(hatalar(ayarSemasi, { ...temel, vardiyaSifirlamaSaati: "" })
      .vardiyaSifirlamaSaati).toBeDefined();
  });

  it("kapasite en az 1 olmalıdır", () => {
    expect(hatalar(ayarSemasi, { ...temel, toplamKapasite: "0", vardiyaSifirlamaSaati: "12" })
      .toplamKapasite).toBeDefined();
  });
});

describe("abonmanSemasi", () => {
  const temel = {
    plaka: "34ABC123",
    musteriAdi: "Ali Veli",
    baslangicTarihi: "2026-07-01",
    bitisTarihi: "2026-08-01",
    aylikUcret: "1500",
  };

  it("geçerli abonmanı kabul eder", () => {
    expect(hatalar(abonmanSemasi, temel)).toEqual({});
  });

  it("bitiş tarihi başlangıçtan sonra olmalıdır", () => {
    expect(
      hatalar(abonmanSemasi, { ...temel, bitisTarihi: "2026-06-01" }).bitisTarihi,
    ).toBeDefined();
  });

  it("telefon biçimini denetler", () => {
    expect(hatalar(abonmanSemasi, { ...temel, telefon: "123" }).telefon).toBeDefined();
    expect(hatalar(abonmanSemasi, { ...temel, telefon: "05321234567" })).toEqual({});
  });

  it("telefon isteğe bağlıdır (KVKK: zorunlu kişisel veri toplanmaz)", () => {
    expect(hatalar(abonmanSemasi, { ...temel, telefon: "" })).toEqual({});
  });
});

describe("form yardımcıları", () => {
  it("FormData'yı düz nesneye çevirir", () => {
    const veri = new FormData();
    veri.set("plaka", "34ABC123");
    veri.set("yabanciPlaka", "on");

    const nesne = formVerisiniAl(veri);
    expect(nesne.plaka).toBe("34ABC123");
    // Checkbox "on" değeri boolean'a çevrilir.
    expect(nesne.yabanciPlaka).toBe(true);
  });

  it("hataları alan adına göre toplar ve ilkini tutar", () => {
    const sonuc = giderSemasi.safeParse({ tutar: "-5", aciklama: "" });
    expect(sonuc.success).toBe(false);
    if (!sonuc.success) {
      const alanlar = hatalariTopla(sonuc.error);
      expect(Object.keys(alanlar).sort()).toEqual(["aciklama", "tutar"]);
      expect(typeof alanlar.tutar).toBe("string");
    }
  });
});
