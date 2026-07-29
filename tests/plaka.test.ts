import { describe, expect, it } from "vitest";
import {
  cozPlaka,
  dogrulaPlaka,
  dogrulaYabanciPlaka,
  formatlaPlaka,
  gosterimPlakasiOlustur,
  maskelePlaka,
  normalizePlaka,
  normalizeYabanciPlaka,
  plakaGecerliMi,
  ulkeAdi,
} from "@/lib/plaka";

describe("normalizePlaka", () => {
  it("boşlukları ve tireleri atar, büyük harfe çevirir", () => {
    expect(normalizePlaka(" 34 abc 123 ")).toBe("34ABC123");
    expect(normalizePlaka("34-abc-123")).toBe("34ABC123");
    expect(normalizePlaka("26.A.1234")).toBe("26A1234");
  });

  it("Türkçe karakterleri ASCII karşılığına çevirir", () => {
    // "i" harfi toLocaleUpperCase('tr') ile "İ" olur ve plakayı bozardı.
    expect(normalizePlaka("34 ist 12")).toBe("34IST12");
    expect(normalizePlaka("34 şoğ 12")).toBe("34SOG12");
  });

  it("boş girdide boş string döner", () => {
    expect(normalizePlaka("")).toBe("");
  });
});

describe("dogrulaPlaka — geçerli plakalar", () => {
  const gecerliler = [
    ["34A1234", "1 harf + 4 rakam"],
    ["34A12345", "1 harf + 5 rakam"],
    ["26AB123", "2 harf + 3 rakam"],
    ["26AB1234", "2 harf + 4 rakam"],
    ["06ABC12", "3 harf + 2 rakam"],
    ["34ABC123", "3 harf + 3 rakam — sahada karşılaşılan kalıp"],
    ["01A1234", "en küçük il kodu"],
    ["81ABC12", "en büyük il kodu"],
    ["26 AB 123", "boşluklu yazım"],
  ] as const;

  for (const [plaka, aciklama] of gecerliler) {
    it(`${plaka} geçerli (${aciklama})`, () => {
      expect(plakaGecerliMi(plaka)).toBe(true);
    });
  }

  it("normalize edilmiş plakayı döndürür", () => {
    const sonuc = dogrulaPlaka("06 abc 12");
    expect(sonuc.gecerli).toBe(true);
    if (sonuc.gecerli) expect(sonuc.plaka).toBe("06ABC12");
  });

  it("normalize edip gösterim biçimini üretir (3 harf + 3 rakam)", () => {
    const sonuc = dogrulaPlaka("34 abc 123");
    expect(sonuc.gecerli).toBe(true);
    if (sonuc.gecerli) expect(sonuc.plaka).toBe("34ABC123");
    expect(formatlaPlaka("34ABC123")).toBe("34 ABC 123");
  });
});

describe("dogrulaPlaka — geçersiz plakalar", () => {
  it("Q, W, X harflerini reddeder ve sebebini söyler", () => {
    for (const plaka of ["34Q1234", "34W1234", "34X1234", "34QWX12"]) {
      const sonuc = dogrulaPlaka(plaka);
      expect(sonuc.gecerli).toBe(false);
      if (!sonuc.gecerli) expect(sonuc.hata).toMatch(/kullanılmaz/);
    }
  });

  it("il kodu 00 veya 82+ olan plakaları reddeder", () => {
    for (const plaka of ["00A1234", "82A1234", "99ABC12"]) {
      const sonuc = dogrulaPlaka(plaka);
      expect(sonuc.gecerli).toBe(false);
      if (!sonuc.gecerli) expect(sonuc.hata).toMatch(/il kodu/i);
    }
  });

  it("kalıba uymayan plakaları reddeder", () => {
    const gecersizler = [
      "34ABCD12", // 4 harf — en fazla 3 olabilir
      "34ABC1", // tek rakam — en az 2 olmalı
      "34ABC123456", // 6 rakam — en fazla 5 olabilir
      "34123456", // harf yok
      "3A1234", // tek haneli il kodu
      "ABC1234", // il kodu yok
      "34ABC12A", // rakamdan sonra harf
    ];
    for (const plaka of gecersizler) {
      expect(plakaGecerliMi(plaka)).toBe(false);
    }
  });

  it("boş plakayı reddeder", () => {
    const sonuc = dogrulaPlaka("   ");
    expect(sonuc.gecerli).toBe(false);
    if (!sonuc.gecerli) expect(sonuc.hata).toMatch(/boş/i);
  });
});

describe("formatlaPlaka", () => {
  it("veritabanı biçimini ekran biçimine çevirir", () => {
    expect(formatlaPlaka("34ABC123")).toBe("34 ABC 123");
    expect(formatlaPlaka("26A1234")).toBe("26 A 1234");
    expect(formatlaPlaka("06AB123")).toBe("06 AB 123");
  });

  it("eksik plakayı olduğu gibi bırakır", () => {
    expect(formatlaPlaka("34AB")).toBe("34AB");
  });
});

describe("maskelePlaka — kullanıcı yazarken", () => {
  it("yazım ilerledikçe boşlukları ekler", () => {
    expect(maskelePlaka("3")).toBe("3");
    expect(maskelePlaka("34")).toBe("34");
    expect(maskelePlaka("34a")).toBe("34 A");
    expect(maskelePlaka("34ab")).toBe("34 AB");
    expect(maskelePlaka("34abc")).toBe("34 ABC");
    expect(maskelePlaka("34abc1")).toBe("34 ABC 1");
    expect(maskelePlaka("34abc123")).toBe("34 ABC 123");
  });

  it("3 harf + 3 rakam plakayı doğru maskeler", () => {
    expect(maskelePlaka("34abc123")).toBe("34 ABC 123");
  });

  it("üst sınırı aşan girdiyi kırpar (en fazla 3 harf + 5 rakam)", () => {
    expect(maskelePlaka("34abc1234567")).toBe("34 ABC 12345");
  });
});

// ---------------------------------------------------------------------------
// Yabancı plakalar
// ---------------------------------------------------------------------------

describe("yabancı plakalar", () => {
  it("Türk kalıbına uymayan gerçek plakaları kabul eder", () => {
    const ornekler = [
      ["CB 1234 AK", "Bulgaristan"],
      ["M-AB 1234", "Almanya"],
      ["AA-123-BB", "Gürcistan"],
      ["XY 9876", "genel"],
      ["12-QWX-99", "Q/W/X içeren"],
      ["AB1234", "boşluksuz"],
    ] as const;

    for (const [plaka, ulke] of ornekler) {
      const sonuc = dogrulaYabanciPlaka(plaka);
      expect(sonuc.gecerli, `${plaka} (${ulke}) geçerli olmalı`).toBe(true);
    }
  });

  it("Q, W, X harflerini reddetmez (Türk kuralı yabancıya uygulanmaz)", () => {
    expect(dogrulaYabanciPlaka("WX 1234").gecerli).toBe(true);
    // Aynı plaka Türk plakası olarak reddedilir
    expect(plakaGecerliMi("WX1234")).toBe(false);
  });

  it("il kodu kuralı uygulanmaz", () => {
    // 99 geçersiz bir Türk il kodu ama yabancı plakada sorun değil
    expect(dogrulaYabanciPlaka("99 ABC 12").gecerli).toBe(true);
    expect(plakaGecerliMi("99ABC12")).toBe(false);
  });

  it("boş ve çok kısa plakaları reddeder", () => {
    expect(dogrulaYabanciPlaka("").gecerli).toBe(false);
    expect(dogrulaYabanciPlaka("  ").gecerli).toBe(false);
    expect(dogrulaYabanciPlaka("A").gecerli).toBe(false);
  });

  it("saklama biçimi boşluksuz ve büyük harftir", () => {
    expect(normalizeYabanciPlaka("cb 1234 ak")).toBe("CB1234AK");
    expect(normalizeYabanciPlaka("M-AB 1234")).toBe("MAB1234");
  });

  it("aynı plakanın farklı yazımları tek araca denk gelir", () => {
    // Mükerrer araç kaydı oluşmasın diye kritik
    expect(normalizeYabanciPlaka("M-AB 1234")).toBe(normalizeYabanciPlaka("m ab 1234"));
    expect(normalizeYabanciPlaka("MAB1234")).toBe(normalizeYabanciPlaka("M-AB-1234"));
  });
});

describe("gosterimPlakasiOlustur", () => {
  it("görevlinin yazdığı okunabilir hâli korur", () => {
    expect(gosterimPlakasiOlustur("cb 1234 ak")).toBe("CB 1234 AK");
    expect(gosterimPlakasiOlustur("M-AB 1234")).toBe("M-AB 1234");
  });

  it("fazla boşlukları sadeleştirir", () => {
    expect(gosterimPlakasiOlustur("  CB   1234  AK  ")).toBe("CB 1234 AK");
  });
});

describe("cozPlaka — Türk / yabancı ayrımı", () => {
  it("Türk plakasını normalize eder ve gösterimini biçimlendirir", () => {
    const sonuc = cozPlaka("34 a 1234", false);
    expect(sonuc.gecerli).toBe(true);
    if (sonuc.gecerli) {
      expect(sonuc.deger.plaka).toBe("34A1234");
      expect(sonuc.deger.plakaGosterim).toBe("34 A 1234");
    }
  });

  it("yabancı plakada yazılan hâli gösterim olarak saklar", () => {
    const sonuc = cozPlaka("cb 1234 ak", true);
    expect(sonuc.gecerli).toBe(true);
    if (sonuc.gecerli) {
      expect(sonuc.deger.plaka).toBe("CB1234AK");
      expect(sonuc.deger.plakaGosterim).toBe("CB 1234 AK");
    }
  });

  it("yabancı işaretlenmemiş geçersiz plaka Türk kuralıyla reddedilir", () => {
    const sonuc = cozPlaka("CB 1234 AK", false);
    expect(sonuc.gecerli).toBe(false);
  });
});

describe("ulkeAdi", () => {
  it("bilinen kodu Türkçe ada çevirir", () => {
    expect(ulkeAdi("BG")).toBe("Bulgaristan");
    expect(ulkeAdi("GE")).toBe("Gürcistan");
  });

  it("bilinmeyen kodu olduğu gibi döndürür, boşta null verir", () => {
    expect(ulkeAdi("XX")).toBe("XX");
    expect(ulkeAdi(null)).toBeNull();
  });
});
