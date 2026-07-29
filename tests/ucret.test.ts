import { describe, expect, it } from "vitest";
import { hesaplaDakika, hesaplaUcret, ucretDokumu, type UcretTarifesi } from "@/lib/ucret";

/**
 * Otoparkın gerçek tarifesi: İLK SAAT 100 TL, sonraki her saat +50 TL.
 * Üst sınır yok (günlük tavan 0).
 */
const tarife: UcretTarifesi = {
  ilkUcretsizDakika: 15,
  ilkSaatUcreti: 100,
  saatlikUcret: 50,
  gunlukTavanUcret: 0,
};

const GIRIS = new Date("2026-07-28T08:00:00.000Z");

/** Girişten N dakika sonrası. */
const sonra = (dakika: number) => new Date(GIRIS.getTime() + dakika * 60_000);

const hesapla = (dakika: number, ek: Partial<Parameters<typeof hesaplaUcret>[0]> = {}) =>
  hesaplaUcret({
    girisZamani: GIRIS,
    cikisZamani: sonra(dakika),
    tarife,
    tarifeTuru: "SAATLIK",
    ...ek,
  });

/** Ücretsiz süre + N saat park eden araç. */
const saatlik = (saat: number) => hesapla(15 + (saat - 1) * 60 + 1);

describe("hesaplaDakika", () => {
  it("saniyeli farkları yukarı yuvarlar", () => {
    expect(hesaplaDakika(GIRIS, new Date(GIRIS.getTime() + 59_000))).toBe(1);
    expect(hesaplaDakika(GIRIS, new Date(GIRIS.getTime() + 61_000))).toBe(2);
  });

  it("negatif veya sıfır farkta 0 döner", () => {
    expect(hesaplaDakika(GIRIS, GIRIS)).toBe(0);
    expect(hesaplaDakika(GIRIS, new Date(GIRIS.getTime() - 60_000))).toBe(0);
  });
});

describe("ücretsiz süre", () => {
  it("tam 15 dakika ücretsizdir", () => {
    const sonuc = hesapla(15);
    expect(sonuc.ucret).toBe(0);
    expect(sonuc.ucretsizMi).toBe(true);
  });

  it("16 dakika ilk saat sayılır → 100 TL", () => {
    const sonuc = hesapla(16);
    expect(sonuc.ucretsizMi).toBe(false);
    expect(sonuc.saat).toBe(1);
    expect(sonuc.ekSaat).toBe(0);
    expect(sonuc.ucret).toBe(100);
  });

  it("ücretsiz süre 0 ise ilk dakikadan ilk saat ücreti alınır", () => {
    const sonuc = hesaplaUcret({
      girisZamani: GIRIS,
      cikisZamani: sonra(1),
      tarife: { ...tarife, ilkUcretsizDakika: 0 },
      tarifeTuru: "SAATLIK",
    });
    expect(sonuc.ucret).toBe(100);
  });
});

describe("ilk saat + artan saat — otoparkın asıl kuralı", () => {
  it("1 saat → 100 TL", () => {
    expect(saatlik(1).ucret).toBe(100);
  });

  it("2 saat → 150 TL", () => {
    const sonuc = saatlik(2);
    expect(sonuc.saat).toBe(2);
    expect(sonuc.ekSaat).toBe(1);
    expect(sonuc.ucret).toBe(150);
  });

  it("3 saat → 200 TL", () => {
    expect(saatlik(3).ucret).toBe(200);
  });

  it("5 saat → 300 TL", () => {
    expect(saatlik(5).ucret).toBe(300);
  });

  it("10 saat → 550 TL", () => {
    expect(saatlik(10).ucret).toBe(550);
  });

  it("24 saat → 1.250 TL", () => {
    expect(saatlik(24).ucret).toBe(1250);
  });

  it("başlayan saat tam saat sayılır", () => {
    // 15 dk ücretsiz + 60 dk = tam 1 saat → 100 TL
    expect(hesapla(75).ucret).toBe(100);
    // 1 dakika fazlası 2. saati başlatır → 150 TL
    expect(hesapla(76).ucret).toBe(150);
    // 15 dk ücretsiz + 120 dk = tam 2 saat → 150 TL
    expect(hesapla(135).ucret).toBe(150);
    expect(hesapla(136).ucret).toBe(200);
  });

  it("üst sınır yok — uzun parklar artmaya devam eder", () => {
    expect(saatlik(48).ucret).toBe(2450);
  });
});

describe("ücret dökümü", () => {
  it("tek saatlik parkta yalnızca ilk saat satırı olur", () => {
    expect(ucretDokumu(saatlik(1), tarife)).toEqual([{ etiket: "İlk saat", tutar: 100 }]);
  });

  it("çok saatlik parkta ek saat satırı eklenir", () => {
    expect(ucretDokumu(saatlik(3), tarife)).toEqual([
      { etiket: "İlk saat", tutar: 100 },
      { etiket: "2 ek saat × 50", tutar: 100 },
    ]);
  });

  it("ücretsiz sürede tek satır", () => {
    expect(ucretDokumu(hesapla(10), tarife)).toEqual([
      { etiket: "İlk 15 dk ücretsiz", tutar: 0 },
    ]);
  });
});

describe("isteğe bağlı günlük tavan (Ayarlar'dan tanımlanırsa)", () => {
  const tavanli: UcretTarifesi = { ...tarife, gunlukTavanUcret: 400 };
  const tavanliSaat = (saat: number) =>
    hesaplaUcret({
      girisZamani: GIRIS,
      cikisZamani: sonra(15 + (saat - 1) * 60 + 1),
      tarife: tavanli,
      tarifeTuru: "SAATLIK",
    });

  it("tavanın altındaki park normal ücretlenir", () => {
    expect(tavanliSaat(3).ucret).toBe(200);
  });

  it("tavanı aşan park tavanla sınırlanır", () => {
    // 10 saat normalde 550 TL olurdu
    expect(tavanliSaat(10).ucret).toBe(400);
  });

  it("24 saati aşan parkta tavan gün başına uygulanır", () => {
    // 25 saat → 2 gün dilimi → en fazla 800 TL
    expect(tavanliSaat(25).ucret).toBe(800);
  });
});

describe("abonman (veri modeli korunuyor, ekranları kapalı)", () => {
  it("geçerli abonmanda ücret alınmaz", () => {
    const sonuc = hesapla(15 + 3000, { tarifeTuru: "ABONMAN", abonmanGecerli: true });
    expect(sonuc.ucret).toBe(0);
    expect(sonuc.uygulananTarifeTuru).toBe("ABONMAN");
    expect(sonuc.uyari).toBeUndefined();
  });

  it("süresi dolmuş abonmanda normal tarifeye düşer ve uyarır", () => {
    const sonuc = hesapla(15 + 61, { tarifeTuru: "ABONMAN", abonmanGecerli: false });
    expect(sonuc.ucret).toBe(150);
    expect(sonuc.uygulananTarifeTuru).toBe("SAATLIK");
    expect(sonuc.uyari).toMatch(/Abonman süresi dolmuş/);
  });
});

describe("uç durumlar", () => {
  it("giriş ve çıkış aynı anda ise ücret 0", () => {
    expect(hesapla(0).ucret).toBe(0);
  });

  it("ondalıklı tarifelerde tutar 2 haneye yuvarlanır", () => {
    const sonuc = hesaplaUcret({
      girisZamani: GIRIS,
      cikisZamani: sonra(15 + 61),
      tarife: { ilkUcretsizDakika: 15, ilkSaatUcreti: 99.99, saatlikUcret: 33.333 },
      tarifeTuru: "SAATLIK",
    });
    expect(sonuc.ucret).toBe(133.32);
  });

  it("eski GUNLUK kayıtları normal tarifeye düşer", () => {
    const sonuc = hesapla(15 + 61, { tarifeTuru: "GUNLUK" });
    expect(sonuc.uygulananTarifeTuru).toBe("SAATLIK");
    expect(sonuc.ucret).toBe(150);
  });

  it("tavan alanı hiç verilmezse sınırsız çalışır", () => {
    const sonuc = hesaplaUcret({
      girisZamani: GIRIS,
      cikisZamani: sonra(15 + 601),
      tarife: { ilkUcretsizDakika: 15, ilkSaatUcreti: 100, saatlikUcret: 50 },
      tarifeTuru: "SAATLIK",
    });
    expect(sonuc.ucret).toBe(600);
  });
});
