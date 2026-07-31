import { describe, expect, it } from "vitest";
import {
  formatlaTarihSaat,
  sonrakiVardiyaSifirlamasi,
  vardiyaGunBaslangici,
} from "@/lib/tarih";

/**
 * Vardiya günü, takvim gününden farklıdır: gece yarısında değil, işletmenin
 * belirlediği saatte (varsayılan 12:00) sıfırlanır.
 *
 * Türkiye UTC+3'tür ve yaz saati uygulaması yoktur; testler UTC girdi verip
 * İstanbul saatiyle beklenen sonucu kontrol eder.
 */

/** Beklenen sınırı "31.07.2026 12:00" gibi okunabilir hâlde karşılaştırır. */
function sinir(an: string, saat = 12): string {
  return formatlaTarihSaat(vardiyaGunBaslangici(saat, new Date(an)));
}

describe("vardiyaGunBaslangici", () => {
  it("sıfırlama saatinden SONRA bugünün sınırını verir", () => {
    // İstanbul 14:00 → yürürlükteki vardiya günü bugün 12:00'de başladı
    expect(sinir("2026-07-31T11:00:00.000Z")).toBe("31.07.2026 12:00");
  });

  it("sıfırlama saatinden ÖNCE dünün sınırını verir", () => {
    // İstanbul 10:00 → henüz sıfırlanmadı, vardiya günü dün 12:00'de başladı
    expect(sinir("2026-07-31T07:00:00.000Z")).toBe("30.07.2026 12:00");
  });

  it("tam sıfırlama anında yeni güne geçer", () => {
    // İstanbul tam 12:00:00
    expect(sinir("2026-07-31T09:00:00.000Z")).toBe("31.07.2026 12:00");
  });

  it("sıfırlama anından bir dakika önce hâlâ önceki gündedir", () => {
    expect(sinir("2026-07-31T08:59:00.000Z")).toBe("30.07.2026 12:00");
  });

  it("gece yarısını geçmek tek başına vardiyayı sıfırlamaz", () => {
    // İstanbul 00:30 — takvim günü değişti ama vardiya günü değişmedi
    expect(sinir("2026-07-30T21:30:00.000Z")).toBe("30.07.2026 12:00");
  });

  it("ay sonunda önceki aya doğru düzgün geriler", () => {
    // 1 Ağustos 09:00 İstanbul → 31 Temmuz 12:00
    expect(sinir("2026-08-01T06:00:00.000Z")).toBe("31.07.2026 12:00");
  });

  it("sıfırlama saati 0 verilirse gece yarısına düşer", () => {
    expect(sinir("2026-07-31T07:00:00.000Z", 0)).toBe("31.07.2026 00:00");
    expect(sinir("2026-07-30T21:30:00.000Z", 0)).toBe("31.07.2026 00:00");
  });

  it("farklı bir saat (08:00) ayarlanabilir", () => {
    // İstanbul 07:30 → dün 08:00
    expect(sinir("2026-07-31T04:30:00.000Z", 8)).toBe("30.07.2026 08:00");
    // İstanbul 08:30 → bugün 08:00
    expect(sinir("2026-07-31T05:30:00.000Z", 8)).toBe("31.07.2026 08:00");
  });

  it("geçersiz saat değerleri 0–23 aralığına çekilir", () => {
    expect(sinir("2026-07-31T11:00:00.000Z", -5)).toBe("31.07.2026 00:00");
    expect(sinir("2026-07-31T11:00:00.000Z", 99)).toBe("30.07.2026 23:00");
  });
});

describe("sonrakiVardiyaSifirlamasi", () => {
  it("yürürlükteki sınırın 24 saat sonrasını verir", () => {
    const an = new Date("2026-07-31T07:00:00.000Z"); // İstanbul 10:00
    expect(formatlaTarihSaat(sonrakiVardiyaSifirlamasi(12, an))).toBe("31.07.2026 12:00");
  });

  it("sıfırlama saati geçmişse ertesi günü gösterir", () => {
    const an = new Date("2026-07-31T11:00:00.000Z"); // İstanbul 14:00
    expect(formatlaTarihSaat(sonrakiVardiyaSifirlamasi(12, an))).toBe("01.08.2026 12:00");
  });

  it("her zaman gelecektedir", () => {
    for (const saat of [0, 6, 12, 20, 23]) {
      for (const dakika of [0, 1, 359, 720, 1439]) {
        const an = new Date(Date.UTC(2026, 6, 31, 0, dakika));
        expect(sonrakiVardiyaSifirlamasi(saat, an).getTime()).toBeGreaterThan(an.getTime());
      }
    }
  });
});
