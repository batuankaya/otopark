import { describe, expect, it, vi } from "vitest";

/**
 * Borç dağıtımı testleri.
 *
 * Kısmi tahsilatın hangi borca yazılacağı para meselesidir: yanlış dağıtım
 * eski bir borcu süresiz açık bırakır ya da kapanmış bir borcu tekrar açar.
 * `borcDagit` saf bir fonksiyondur, veritabanı gerekmez — modülün prisma
 * içe aktarımı taklit edilir.
 */

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { borcDagit, borcToplami, kurusYuvarla } = await import("@/lib/borc");

const borc = (id: string, kalan: number, gun: number) => ({
  id,
  fisNo: gun,
  cikisZamani: new Date(`2026-07-${String(gun).padStart(2, "0")}T12:00:00.000Z`),
  tutar: kalan,
  kalan,
});

describe("borcToplami", () => {
  it("kalan bakiyeleri toplar", () => {
    expect(borcToplami([borc("a", 50, 1), borc("b", 75.5, 2)])).toBe(125.5);
  });

  it("borç yoksa sıfırdır", () => {
    expect(borcToplami([])).toBe(0);
  });
});

describe("borcDagit", () => {
  it("tamamı ödenirse tüm borçlar kapanır", () => {
    const dagitim = borcDagit([borc("a", 50, 1), borc("b", 100, 2)], 150);

    expect(dagitim).toHaveLength(2);
    expect(dagitim.every((pay) => pay.kalan === 0)).toBe(true);
  });

  it("kısmi ödemede en eski borç önce kapanır", () => {
    // Sıra önemli: aksi hâlde en eski borç hiç kapanmadan bekler.
    const dagitim = borcDagit([borc("eski", 50, 1), borc("yeni", 100, 5)], 80);

    expect(dagitim).toEqual([
      { id: "eski", oncekiKalan: 50, dusulen: 50, kalan: 0 },
      { id: "yeni", oncekiKalan: 100, dusulen: 30, kalan: 70 },
    ]);
  });

  it("ilk borcu bile kapatmayan ödeme yalnızca onu azaltır", () => {
    const dagitim = borcDagit([borc("eski", 50, 1), borc("yeni", 100, 5)], 20);

    expect(dagitim).toEqual([{ id: "eski", oncekiKalan: 50, dusulen: 20, kalan: 30 }]);
  });

  it("sıfır tahsilat hiçbir borca dokunmaz", () => {
    expect(borcDagit([borc("a", 50, 1)], 0)).toEqual([]);
  });

  it("borçtan fazla ödeme fazlasını dağıtmaz", () => {
    // Sunucu bu durumu zaten reddediyor; dağıtım yine de fazla yazmamalı.
    const dagitim = borcDagit([borc("a", 50, 1)], 200);

    expect(dagitim).toEqual([{ id: "a", oncekiKalan: 50, dusulen: 50, kalan: 0 }]);
  });

  it("kuruşlu tutarlarda kayan nokta artığı bırakmaz", () => {
    const dagitim = borcDagit([borc("a", 0.1, 1), borc("b", 0.2, 2)], 0.3);

    expect(dagitim.map((pay) => pay.kalan)).toEqual([0, 0]);
  });
});

describe("kurusYuvarla", () => {
  it("iki haneye yuvarlar", () => {
    expect(kurusYuvarla(0.1 + 0.2)).toBe(0.3);
    expect(kurusYuvarla(12.345)).toBe(12.35);
  });
});
