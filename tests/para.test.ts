import { describe, expect, it } from "vitest";
import { formatlaPara, formatlaTutar, sayiyaCevir, tutarAyristir } from "@/lib/para";

/**
 * Para yardımcıları.
 *
 * Hesaplama katmanı `number` ile çalışır, veritabanı `Decimal` saklar;
 * dönüşüm hataları doğrudan kasaya yansır.
 */

describe("sayiyaCevir — veritabanı sınırı", () => {
  it("Prisma Decimal nesnesini çevirir", () => {
    // Gerçekte gelen nesne toNumber() sunar.
    expect(sayiyaCevir({ toNumber: () => 1234.56 })).toBe(1234.56);
  });

  it("yalnızca toString sunan nesneyi de çevirir", () => {
    expect(sayiyaCevir({ toString: () => "99.9" })).toBe(99.9);
  });

  it("sayı ve metni olduğu gibi çevirir", () => {
    expect(sayiyaCevir(42)).toBe(42);
    expect(sayiyaCevir("3.5")).toBe(3.5);
  });

  it("boş değerler sıfır olur (null yayılmaz)", () => {
    // Toplama işlemlerinde null NaN üretirdi; sıfır güvenli varsayılan.
    expect(sayiyaCevir(null)).toBe(0);
    expect(sayiyaCevir(undefined)).toBe(0);
  });

  it("çevrilemeyen değer sıfır olur", () => {
    expect(sayiyaCevir("abc")).toBe(0);
    expect(sayiyaCevir(true)).toBe(0);
  });

  it("sıfır, boş değerden ayırt edilir", () => {
    expect(sayiyaCevir(0)).toBe(0);
    expect(sayiyaCevir("0")).toBe(0);
  });
});

describe("biçimleme", () => {
  it("parayı Türk lirası olarak yazar", () => {
    expect(formatlaPara(1234.5)).toBe("₺1.234,50");
    expect(formatlaPara(0)).toBe("₺0,00");
  });

  it("tabloda simgesiz tutar yazar", () => {
    expect(formatlaTutar(1234.5)).toBe("1.234,50");
  });

  it("her zaman iki ondalık gösterir", () => {
    expect(formatlaTutar(100)).toBe("100,00");
    expect(formatlaTutar(0.5)).toBe("0,50");
  });

  it("Decimal nesnesini doğrudan biçimler", () => {
    expect(formatlaPara({ toNumber: () => 250 })).toBe("₺250,00");
  });

  it("boş değeri sıfır gösterir", () => {
    expect(formatlaPara(null)).toBe("₺0,00");
  });
});

describe("tutarAyristir — görevlinin yazdığı tutar", () => {
  it("Türkçe biçimi çözer", () => {
    expect(tutarAyristir("1.234,50")).toBe(1234.5);
    expect(tutarAyristir("12.500,00")).toBe(12500);
  });

  it("nokta ondalıklı biçimi de kabul eder", () => {
    expect(tutarAyristir("1234.50")).toBe(1234.5);
  });

  it("ayraçsız sayıyı çözer", () => {
    expect(tutarAyristir("1250")).toBe(1250);
    expect(tutarAyristir("0")).toBe(0);
  });

  it("virgüllü ondalığı çözer", () => {
    expect(tutarAyristir("1,5")).toBe(1.5);
    expect(tutarAyristir("99,99")).toBe(99.99);
  });

  it("boşlukları yok sayar", () => {
    expect(tutarAyristir("  100  ")).toBe(100);
  });

  it("kuruşa yuvarlar", () => {
    expect(tutarAyristir("10,999")).toBe(11);
  });

  it("geçersiz girdide null döner", () => {
    expect(tutarAyristir("")).toBeNull();
    expect(tutarAyristir("   ")).toBeNull();
    expect(tutarAyristir("abc")).toBeNull();
  });

  it("negatif tutar reddedilir", () => {
    // Kasaya eksi para girilemez; iade ayrı bir kavram.
    expect(tutarAyristir("-50")).toBeNull();
    expect(tutarAyristir("-1,5")).toBeNull();
  });

  /**
   * BİLİNEN KUSUR — virgülsüz nokta binlik ayracı sanılmıyor.
   *
   * Türkçede nokta binlik ayracıdır: görevli 1200 TL için "1.200" yazar.
   * Ayrıştırıcı ise virgül YOKSA noktayı ondalık kabul ediyor ve 1,20 TL
   * kaydediyor. Aşağıdaki testler doğru davranışı değil, BUGÜNKÜ davranışı
   * sabitler — düzeltme yapıldığında bu testler kırılıp gözden geçirmeye
   * zorlasın diye buradalar.
   *
   * Etkisi: gider tutarı, vardiya açılış/kapanış kasası, ücret düzeltmesi,
   * abonman ve tarife ücretleri. 1.200 TL'lik bir gider 1,20 TL yazılır.
   */
  describe("bilinen kusur: virgülsüz nokta binlik sayılmıyor", () => {
    it('"1.200" 1200 değil 1.2 olarak çözülüyor', () => {
      expect(tutarAyristir("1.200")).toBe(1.2);
    });

    it('"12.500" 12500 değil 12.5 olarak çözülüyor', () => {
      expect(tutarAyristir("12.500")).toBe(12.5);
    });

    it("virgül varsa nokta doğru şekilde binlik sayılıyor", () => {
      // Sorun yalnızca virgülün hiç yazılmadığı durumda.
      expect(tutarAyristir("1.200,00")).toBe(1200);
    });
  });
});
