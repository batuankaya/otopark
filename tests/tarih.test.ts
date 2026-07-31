import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bugununSaati,
  formatlaSaat,
  formatlaSure,
  formatlaTarih,
  formatlaTarihSaat,
  gunBaslangici,
  gunEkle,
  gunSonu,
  kalanGun,
  saatGirdisiDegeri,
  sureMetni,
  tarihAraligiOlustur,
  tarihGirdisiDegeri,
  yirmiDortSaatiAstiMi,
} from "@/lib/tarih";

/**
 * Tarih yardımcıları — sistemin en sinsi hata kaynağı.
 *
 * Kural: veritabanı UTC saklar, her şey Europe/Istanbul'a göre yorumlanır.
 * "Bugünün cirosu" sunucunun saat dilimine göre kaymamalı; bu yüzden testler
 * sunucu saati UTC'ye ayarlıyken koşar (bkz. vitest.config.ts). İşlevler
 * saat dilimini açıkça belirttiği için sonuçlar değişmemeli.
 *
 * Türkiye yaz saati uygulamıyor: UTC+3 sabittir.
 */

// 15 Temmuz 2026, İstanbul'da 08:00 (UTC 05:00) — Çarşamba.
const AN = new Date("2026-07-15T05:00:00.000Z");

describe("gün sınırları", () => {
  it("gün başlangıcı İstanbul gece yarısıdır", () => {
    // İstanbul 15 Temmuz 00:00 = UTC 14 Temmuz 21:00
    expect(gunBaslangici(AN).toISOString()).toBe("2026-07-14T21:00:00.000Z");
  });

  it("gün sonu ertesi günün başlangıcıdır", () => {
    expect(gunSonu(AN).toISOString()).toBe("2026-07-15T21:00:00.000Z");
  });

  it("gün, UTC gece yarısında değil İstanbul gece yarısında döner", () => {
    // UTC 22:00 → İstanbul'da ertesi gün 01:00. Gün ARTIK değişmiş olmalı.
    const geceYarisindanSonra = new Date("2026-07-14T22:00:00.000Z");
    expect(gunBaslangici(geceYarisindanSonra).toISOString()).toBe("2026-07-14T21:00:00.000Z");

    // UTC 20:59 → İstanbul'da hâlâ 23:59, önceki gün.
    const geceYarisindanOnce = new Date("2026-07-14T20:59:00.000Z");
    expect(gunBaslangici(geceYarisindanOnce).toISOString()).toBe("2026-07-13T21:00:00.000Z");
  });

  it("gün ekleme takvim gününü kaydırır", () => {
    const bas = gunBaslangici(AN);
    expect(gunEkle(bas, 1).toISOString()).toBe("2026-07-15T21:00:00.000Z");
    expect(gunEkle(bas, -1).toISOString()).toBe("2026-07-13T21:00:00.000Z");
  });

  it("ay sonunda doğru güne geçer", () => {
    const ayinSonu = new Date("2026-07-31T20:00:00.000Z"); // İstanbul 31 Tem 23:00
    expect(gunBaslangici(ayinSonu).toISOString()).toBe("2026-07-30T21:00:00.000Z");
  });
});

describe("rapor aralıkları", () => {
  it("bugün = İstanbul günü", () => {
    const aralik = tarihAraligiOlustur("bugun", AN);
    expect(aralik.baslangic.toISOString()).toBe("2026-07-14T21:00:00.000Z");
    expect(aralik.bitis.toISOString()).toBe("2026-07-15T21:00:00.000Z");
    expect(aralik.etiket).toBe("Bugün");
  });

  it("hafta bugün dahil son 7 gündür", () => {
    const aralik = tarihAraligiOlustur("hafta", AN);
    // 6 gün geriye: 9 Temmuz'un başlangıcı
    expect(aralik.baslangic.toISOString()).toBe("2026-07-08T21:00:00.000Z");
    const gunSayisi =
      (aralik.bitis.getTime() - aralik.baslangic.getTime()) / (24 * 60 * 60 * 1000);
    expect(gunSayisi).toBe(7);
  });

  it("ay bugün dahil son 30 gündür", () => {
    const aralik = tarihAraligiOlustur("ay", AN);
    const gunSayisi =
      (aralik.bitis.getTime() - aralik.baslangic.getTime()) / (24 * 60 * 60 * 1000);
    expect(gunSayisi).toBe(30);
  });
});

describe("süre biçimleme", () => {
  it.each([
    [0, "0 dk"],
    [1, "1 dk"],
    [45, "45 dk"],
    [60, "1 sa"],
    [90, "1 sa 30 dk"],
    [1440, "1 gün"],
    [1500, "1 gün 1 sa"],
    [1530, "1 gün 1 sa 30 dk"],
    [2880, "2 gün"],
  ])("%i dakika → %s", (dakika, beklenen) => {
    expect(formatlaSure(dakika)).toBe(beklenen);
  });

  it("geçersiz süre çizgi gösterir", () => {
    expect(formatlaSure(-1)).toBe("—");
    expect(formatlaSure(Number.NaN)).toBe("—");
  });

  it("iki zaman arası süreyi yazar", () => {
    const giris = new Date("2026-07-15T05:00:00.000Z");
    const cikis = new Date("2026-07-15T07:30:00.000Z");
    expect(sureMetni(giris, cikis)).toBe("2 sa 30 dk");
  });

  it("negatif aralık sıfır sayılır", () => {
    const giris = new Date("2026-07-15T07:00:00.000Z");
    const cikis = new Date("2026-07-15T05:00:00.000Z");
    expect(sureMetni(giris, cikis)).toBe("0 dk");
  });
});

describe("24 saat uyarısı", () => {
  it("tam 24 saatte işaretlenir", () => {
    const giris = new Date("2026-07-14T05:00:00.000Z");
    expect(yirmiDortSaatiAstiMi(giris, new Date("2026-07-15T05:00:00.000Z"))).toBe(true);
  });

  it("24 saatin bir dakika altında işaretlenmez", () => {
    const giris = new Date("2026-07-14T05:00:00.000Z");
    expect(yirmiDortSaatiAstiMi(giris, new Date("2026-07-15T04:59:00.000Z"))).toBe(false);
  });
});

describe("saat ayrıştırma", () => {
  it("HH:MM o günün İstanbul saatine çevrilir", () => {
    // 15 Temmuz 15:25 İstanbul = 12:25 UTC
    expect(bugununSaati("15:25", AN)?.toISOString()).toBe("2026-07-15T12:25:00.000Z");
  });

  it("gece yarısı bir önceki UTC gününe düşer", () => {
    expect(bugununSaati("00:00", AN)?.toISOString()).toBe("2026-07-14T21:00:00.000Z");
  });

  it("tek haneli saat kabul edilir", () => {
    expect(bugununSaati("7:05", AN)?.toISOString()).toBe("2026-07-15T04:05:00.000Z");
  });

  it("başındaki/sonundaki boşluk yok sayılır", () => {
    expect(bugununSaati("  09:30  ", AN)?.toISOString()).toBe("2026-07-15T06:30:00.000Z");
  });

  it.each(["24:00", "23:60", "abc", "", "9:5", "09-30", "09:300"])(
    "geçersiz saat reddedilir: %s",
    (girdi) => {
      expect(bugununSaati(girdi, AN)).toBeNull();
    },
  );

  it("23:59 sınırı kabul edilir", () => {
    expect(bugununSaati("23:59", AN)).not.toBeNull();
  });
});

describe("girdi biçimleri", () => {
  it("tarih girdisi YYYY-MM-DD verir", () => {
    expect(tarihGirdisiDegeri(AN)).toBe("2026-07-15");
  });

  it("tarih girdisi İstanbul gününü kullanır", () => {
    // UTC 21:30 → İstanbul'da ertesi gün 00:30
    expect(tarihGirdisiDegeri(new Date("2026-07-15T21:30:00.000Z"))).toBe("2026-07-16");
  });

  it("saat girdisi 24 saatlik biçimdedir", () => {
    expect(saatGirdisiDegeri(AN)).toBe("08:00");
    expect(saatGirdisiDegeri(new Date("2026-07-15T18:45:00.000Z"))).toBe("21:45");
  });

  it("saat girdisi ile ayrıştırma birbirinin tersidir", () => {
    const saat = saatGirdisiDegeri(AN);
    expect(bugununSaati(saat, AN)?.toISOString()).toBe(AN.toISOString());
  });
});

describe("gösterim biçimleri", () => {
  it("tarih ve saati İstanbul'a göre yazar", () => {
    expect(formatlaTarihSaat(AN)).toBe("15.07.2026 08:00");
    expect(formatlaTarih(AN)).toBe("15.07.2026");
    expect(formatlaSaat(AN)).toBe("08:00");
  });

  it("boş değerler çizgi gösterir", () => {
    expect(formatlaTarihSaat(null)).toBe("—");
    expect(formatlaSaat(undefined)).toBe("—");
    expect(formatlaTarih(null)).toBe("—");
  });

  it("saat AM/PM'e dönmez", () => {
    // hour12: false açıkça verilmezse işletim sistemi diline göre kayabilir.
    expect(formatlaSaat(new Date("2026-07-15T15:00:00.000Z"))).toBe("18:00");
  });
});

describe("abonman kalan gün", () => {
  it("bitişe kalan tam gün sayısını verir", () => {
    expect(kalanGun(new Date("2026-07-20T10:00:00.000Z"), AN)).toBe(5);
  });

  it("bugün bitiyorsa sıfırdır", () => {
    expect(kalanGun(new Date("2026-07-15T20:00:00.000Z"), AN)).toBe(0);
  });

  it("geçmiş bitiş negatif döner", () => {
    expect(kalanGun(new Date("2026-07-13T10:00:00.000Z"), AN)).toBe(-2);
  });
});

describe("varsayılan 'şimdi' parametresi", () => {
  afterEach(() => vi.useRealTimers());

  it("parametresiz çağrılar sistem saatini kullanır", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AN);

    expect(gunBaslangici().toISOString()).toBe("2026-07-14T21:00:00.000Z");
    expect(tarihGirdisiDegeri()).toBe("2026-07-15");
    expect(bugununSaati("15:25")?.toISOString()).toBe("2026-07-15T12:25:00.000Z");
  });
});
