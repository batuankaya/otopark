import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Vardiya kasa özeti testleri.
 *
 * Bu hesap sistemin en pahalı hata noktası: otomatik vardiya sıfırlaması
 * `beklenenKasa`yı doğrudan yeni vardiyanın açılış kasası olarak devrediyor
 * (bkz. lib/vardiya-sifirlama.ts). Buradaki bir kayma her gün sessizce
 * büyüyerek kasaya yazılır — kimse fark etmez.
 *
 * Veritabanı gerekmesin diye `prisma` taklit edilir; test edilen şey
 * sorguların sonucu değil, sonuçlar üzerinde yapılan ARİTMETİK ve
 * sorguların hangi alana göre süzüldüğüdür.
 */

const { sahte } = vi.hoisted(() => ({
  sahte: {
    tahsilatlar: [] as Array<Record<string, unknown>>,
    giderler: [] as Array<Record<string, unknown>>,
    vardiya: null as Record<string, unknown> | null,
    girisSayisi: 0,
    cikisSayisi: 0,
    ucretsizCikisSayisi: 0,
    borclar: { _sum: { borcTutari: null as unknown }, _count: { _all: 0 } },
    sorgular: [] as Array<{ ad: string; where?: Record<string, unknown> }>,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    parkKaydi: {
      groupBy: (arg: { where: Record<string, unknown> }) => {
        sahte.sorgular.push({ ad: "tahsilat", where: arg.where });
        return Promise.resolve(sahte.tahsilatlar);
      },
      count: (arg: { where: Record<string, unknown> }) => {
        // Üç farklı sayım aynı fonksiyondan geçiyor: girişler vardiyaId ile,
        // çıkışlar cikisVardiyaId ile, ücretsiz çıkışlar ayrıca ödeme
        // yöntemi ve borç süzgeciyle.
        const ad = "odemeYontemi" in arg.where
          ? "ucretsizCikisSayisi"
          : "cikisVardiyaId" in arg.where
            ? "cikisSayisi"
            : "girisSayisi";
        sahte.sorgular.push({ ad, where: arg.where });
        return Promise.resolve(
          ad === "ucretsizCikisSayisi"
            ? sahte.ucretsizCikisSayisi
            : ad === "cikisSayisi"
              ? sahte.cikisSayisi
              : sahte.girisSayisi,
        );
      },
      aggregate: (arg: { where: Record<string, unknown> }) => {
        sahte.sorgular.push({ ad: "borc", where: arg.where });
        return Promise.resolve(sahte.borclar);
      },
    },
    vardiya: {
      findUnique: () => Promise.resolve(sahte.vardiya),
    },
    gider: {
      groupBy: (arg: { where: Record<string, unknown> }) => {
        sahte.sorgular.push({ ad: "gider", where: arg.where });
        return Promise.resolve(sahte.giderler);
      },
    },
  },
}));

const { vardiyaOzetiHesapla } = await import("@/lib/vardiya-ozet");

/** Prisma `Decimal` nesnesini taklit eder — gerçekte de `toNumber` gelir. */
const desimal = (deger: number) => ({ toNumber: () => deger });

const tahsilat = (
  yontem: "NAKIT" | "KART" | null,
  tutar: number,
  adet = 1,
  borcTahsilati = 0,
) => ({
  odemeYontemi: yontem,
  _sum: {
    tahsilEdilenUcret: tutar === 0 ? null : desimal(tutar),
    tahsilEdilenBorc: borcTahsilati === 0 ? null : desimal(borcTahsilati),
  },
  _count: { _all: adet },
});

const gider = (yontem: "NAKIT" | "KART", tutar: number) => ({
  odemeYontemi: yontem,
  _sum: { tutar: desimal(tutar) },
});

beforeEach(() => {
  sahte.tahsilatlar = [];
  sahte.giderler = [];
  sahte.vardiya = { acilisKasa: desimal(0) };
  sahte.girisSayisi = 0;
  sahte.cikisSayisi = 0;
  sahte.ucretsizCikisSayisi = 0;
  sahte.borclar = { _sum: { borcTutari: null }, _count: { _all: 0 } };
  sahte.sorgular = [];
});

describe("vardiyaOzetiHesapla — tahsilat toplamları", () => {
  it("nakit ve kart tahsilatını ayrı ayrı toplar", async () => {
    sahte.tahsilatlar = [tahsilat("NAKIT", 750), tahsilat("KART", 250)];

    const ozet = await vardiyaOzetiHesapla("v1");

    expect(ozet.toplamNakit).toBe(750);
    expect(ozet.toplamKart).toBe(250);
    expect(ozet.toplamTahsilat).toBe(1000);
  });

  it("hiç tahsilat yoksa sıfırlar döner (null değil)", async () => {
    const ozet = await vardiyaOzetiHesapla("v1");

    expect(ozet.toplamNakit).toBe(0);
    expect(ozet.toplamKart).toBe(0);
    expect(ozet.toplamTahsilat).toBe(0);
    expect(ozet.netKazanc).toBe(0);
  });

  it("ücretsiz çıkışları ayrı sorgudan alır", async () => {
    // İlk 15 dakikada çıkan araçlar: tahsilat yok, ödeme yöntemi de yok.
    // Borçlu çıkışta da ödeme yöntemi boştur; bu yüzden sayı gruplamadan
    // değil, borcu olmayan çıkışları süzen ayrı bir sorgudan gelir.
    sahte.tahsilatlar = [tahsilat("NAKIT", 300), tahsilat(null, 0, 4)];
    sahte.ucretsizCikisSayisi = 4;

    const ozet = await vardiyaOzetiHesapla("v1");

    expect(ozet.ucretsizCikisSayisi).toBe(4);
    expect(ozet.toplamNakit).toBe(300);
  });

  it("ücretsiz çıkış sayımı borçlu çıkışları dışarıda bırakır", async () => {
    // Borçlu çıkışta ödeme yöntemi boş kalır ama araç ücretsiz çıkmamıştır.
    sahte.ucretsizCikisSayisi = 0;

    await vardiyaOzetiHesapla("v1");

    const sorgu = sahte.sorgular.find((s) => s.ad === "ucretsizCikisSayisi");
    expect(sorgu?.where).toMatchObject({ odemeYontemi: null, borcTutari: 0 });
  });

  it("eski borç tahsilatı nakit/kart toplamlarına eklenir", async () => {
    // Borcun kendisi başka bir vardiyada doğmuş olabilir; para BU vardiyada
    // kasaya girdiği için burada sayılır.
    sahte.tahsilatlar = [tahsilat("NAKIT", 100, 1, 50), tahsilat("KART", 200, 1, 25)];

    const ozet = await vardiyaOzetiHesapla("v1");

    expect(ozet.toplamNakit).toBe(150);
    expect(ozet.toplamKart).toBe(225);
    expect(ozet.toplamTahsilat).toBe(375);
    expect(ozet.tahsilEdilenBorc).toBe(75);
  });

  it("borçlu çıkışlar kasaya değil borç toplamına yazılır", async () => {
    sahte.tahsilatlar = [tahsilat("NAKIT", 100)];
    sahte.borclar = { _sum: { borcTutari: desimal(240) }, _count: { _all: 3 } };

    const ozet = await vardiyaOzetiHesapla("v1");

    expect(ozet.olusanBorc).toBe(240);
    expect(ozet.borcluCikisSayisi).toBe(3);
    // Borç kasayı etkilemez: para henüz alınmamıştır.
    expect(ozet.beklenenKasa).toBe(100);
  });

  it("ücretsiz çıkış yoksa sayı sıfırdır", async () => {
    sahte.tahsilatlar = [tahsilat("NAKIT", 100)];

    const ozet = await vardiyaOzetiHesapla("v1");

    expect(ozet.ucretsizCikisSayisi).toBe(0);
  });
});

describe("vardiyaOzetiHesapla — kasa devri", () => {
  it("beklenen kasa = açılış + nakit tahsilat − nakit gider", async () => {
    sahte.vardiya = { acilisKasa: desimal(500) };
    sahte.tahsilatlar = [tahsilat("NAKIT", 1200)];
    sahte.giderler = [gider("NAKIT", 300)];

    const ozet = await vardiyaOzetiHesapla("v1");

    expect(ozet.beklenenKasa).toBe(1400);
  });

  it("kartla ödenen gider kasayı etkilemez, net kazancı etkiler", async () => {
    // Kritik ayrım: kart gideri kasadan para çıkarmaz ama kâra yansır.
    sahte.vardiya = { acilisKasa: desimal(500) };
    sahte.tahsilatlar = [tahsilat("NAKIT", 1000)];
    sahte.giderler = [gider("KART", 400)];

    const ozet = await vardiyaOzetiHesapla("v1");

    expect(ozet.beklenenKasa).toBe(1500);
    expect(ozet.kartGider).toBe(400);
    expect(ozet.netKazanc).toBe(600);
  });

  it("kart tahsilatı kasaya girmez", async () => {
    // Kartla ödenen park ücreti bankaya gider; kasada nakit artmaz.
    sahte.vardiya = { acilisKasa: desimal(100) };
    sahte.tahsilatlar = [tahsilat("NAKIT", 200), tahsilat("KART", 900)];

    const ozet = await vardiyaOzetiHesapla("v1");

    expect(ozet.beklenenKasa).toBe(300);
    expect(ozet.toplamTahsilat).toBe(1100);
  });

  it("gider tahsilatı aşarsa kasa eksiye düşebilir", async () => {
    // Engellenmiyor ve engellenmemeli: kasa açığı raporda görünmeli.
    sahte.vardiya = { acilisKasa: desimal(0) };
    sahte.tahsilatlar = [tahsilat("NAKIT", 100)];
    sahte.giderler = [gider("NAKIT", 250)];

    const ozet = await vardiyaOzetiHesapla("v1");

    expect(ozet.beklenenKasa).toBe(-150);
    expect(ozet.netKazanc).toBe(-150);
  });

  it("vardiya bulunamazsa açılış kasası sıfır sayılır", async () => {
    sahte.vardiya = null;
    sahte.tahsilatlar = [tahsilat("NAKIT", 400)];

    const ozet = await vardiyaOzetiHesapla("v1");

    expect(ozet.acilisKasa).toBe(0);
    expect(ozet.beklenenKasa).toBe(400);
  });

  it("Prisma Decimal nesnelerini sayıya çevirir", async () => {
    sahte.vardiya = { acilisKasa: desimal(1000.5) };
    sahte.tahsilatlar = [tahsilat("NAKIT", 249.5)];

    const ozet = await vardiyaOzetiHesapla("v1");

    expect(ozet.acilisKasa).toBe(1000.5);
    expect(ozet.beklenenKasa).toBe(1250);
  });

  it("kuruşlu tutarlarda kayan nokta hatası kuruş sınırını aşmaz", async () => {
    // Fonksiyon yuvarlama yapmaz; veritabanı sınırında Decimal(10,2)'ye
    // çevrildiği için kuruş altı sapma orada eriyor. Yine de büyümediğini
    // burada sabitliyoruz.
    sahte.vardiya = { acilisKasa: desimal(0.1) };
    sahte.tahsilatlar = [tahsilat("NAKIT", 0.2)];

    const ozet = await vardiyaOzetiHesapla("v1");

    expect(ozet.beklenenKasa).toBeCloseTo(0.3, 2);
  });
});

describe("vardiyaOzetiHesapla — gider toplamları", () => {
  it("nakit ve kart giderlerini ayırır", async () => {
    sahte.giderler = [gider("NAKIT", 120), gider("KART", 80)];

    const ozet = await vardiyaOzetiHesapla("v1");

    expect(ozet.nakitGider).toBe(120);
    expect(ozet.kartGider).toBe(80);
    expect(ozet.toplamGider).toBe(200);
  });

  it("gider yoksa sıfır döner", async () => {
    const ozet = await vardiyaOzetiHesapla("v1");

    expect(ozet.toplamGider).toBe(0);
  });
});

describe("vardiyaOzetiHesapla — sorgu süzgeçleri", () => {
  it("tahsilatı çıkış vardiyasına göre süzer, giriş vardiyasına göre değil", async () => {
    // Araç bir vardiyada girip başkasında çıkabilir; para çıkış kasasına yazılır.
    await vardiyaOzetiHesapla("v1");

    const tahsilatSorgusu = sahte.sorgular.find((s) => s.ad === "tahsilat");
    expect(tahsilatSorgusu?.where).toMatchObject({ cikisVardiyaId: "v1", durum: "CIKTI" });
    expect(tahsilatSorgusu?.where).not.toHaveProperty("vardiyaId");
  });

  it("giriş sayısında iptal edilen kayıtları saymaz", async () => {
    await vardiyaOzetiHesapla("v1");

    const girisSorgusu = sahte.sorgular.find((s) => s.ad === "girisSayisi");
    expect(girisSorgusu?.where).toMatchObject({ vardiyaId: "v1", durum: { not: "IPTAL" } });
  });

  it("çıkış sayısında yalnızca çıkmış araçları sayar", async () => {
    await vardiyaOzetiHesapla("v1");

    const cikisSorgusu = sahte.sorgular.find((s) => s.ad === "cikisSayisi");
    expect(cikisSorgusu?.where).toMatchObject({ cikisVardiyaId: "v1", durum: "CIKTI" });
  });

  it("giderleri vardiyanın kendi kimliğiyle süzer", async () => {
    await vardiyaOzetiHesapla("v1");

    const giderSorgusu = sahte.sorgular.find((s) => s.ad === "gider");
    expect(giderSorgusu?.where).toMatchObject({ vardiyaId: "v1" });
  });

  it("giriş ve çıkış sayılarını olduğu gibi aktarır", async () => {
    sahte.girisSayisi = 37;
    sahte.cikisSayisi = 31;

    const ozet = await vardiyaOzetiHesapla("v1");

    expect(ozet.girisSayisi).toBe(37);
    expect(ozet.cikisSayisi).toBe(31);
  });
});
