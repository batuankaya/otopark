import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET as plakaAra } from "@/app/api/plaka-ara/route";
import { prisma } from "@/lib/prisma";

import {
  oturumAc,
  oturumKapat,
  saatiAyarla,
  temelVeriyiKur,
  veritabaniniTemizle,
  zamaniDondur,
  zamaniSerbestBirak,
  type TemelVeri,
} from "./yardimcilar";

/**
 * Plaka arama uç noktası.
 *
 * Görevlinin en sık kullandığı ekran: çıkış yaptıracağı aracı buluyor.
 * Arama hem plakada hem araç bilgisinde (marka/model/renk) hem de notlarda
 * eşleşir; sonuçların SIRASI da davranışın parçasıdır — görevli listenin
 * başındakine dokunur.
 *
 * Bu testler sorgunun nasıl yazıldığını değil, NE DÖNDÜRDÜĞÜNÜ sabitler:
 * sorgu performans için yeniden yazıldığında sonuçlar değişmemeli.
 */
describe("plaka arama uç noktası", () => {
  let temel: TemelVeri;

  const ara = (sorgu: string) =>
    plakaAra(new Request(`http://test/api/plaka-ara?${sorgu}`));

  /** Yanıtı çözer ve plakaları sırasıyla verir. */
  async function plakalar(sorgu: string): Promise<string[]> {
    const cevap = await ara(sorgu);
    const veri = await cevap.json();
    return (veri.sonuclar ?? []).map((s: { plaka: string | null }) => s.plaka ?? "(plakasız)");
  }

  /** Test verisi: park kaydı oluşturur. */
  async function kayit(veri: {
    plaka?: string | null;
    marka?: string;
    model?: string;
    renk?: string;
    notlar?: string;
    aracNotu?: string;
    durum?: "ICERIDE" | "CIKTI" | "IPTAL";
    giris?: string;
  }) {
    const arac = veri.plaka
      ? await prisma.arac.upsert({
          where: { plaka: veri.plaka },
          create: {
            plaka: veri.plaka,
            plakaGosterim: veri.plaka,
            marka: veri.marka,
            model: veri.model,
            renk: veri.renk,
            notlar: veri.aracNotu,
          },
          update: { notlar: veri.aracNotu },
        })
      : null;

    return prisma.parkKaydi.create({
      data: {
        aracId: arac?.id ?? null,
        plaka: veri.plaka ?? null,
        plakaGosterim: veri.plaka ?? null,
        // Plakasız kayıtlarda araç bilgisi ParkKaydi üzerinde durur.
        marka: arac ? null : veri.marka,
        model: arac ? null : veri.model,
        renk: arac ? null : veri.renk,
        notlar: veri.notlar,
        durum: veri.durum ?? "ICERIDE",
        girisZamani: new Date(veri.giris ?? "2026-07-15T05:00:00.000Z"),
        cikisZamani: veri.durum === "CIKTI" ? new Date("2026-07-15T09:00:00.000Z") : null,
        girisYapanId: temel.gorevli.id,
        tarifeId: temel.tarife.id,
        vardiyaId: vardiyaId,
      },
    });
  }

  let vardiyaId: string;

  beforeEach(async () => {
    zamaniDondur();
    saatiAyarla("12:00");
    await veritabaniniTemizle();
    temel = await temelVeriyiKur();
    const vardiya = await prisma.vardiya.create({
      data: { kullaniciId: temel.gorevli.id, acilisKasa: 0 },
    });
    vardiyaId = vardiya.id;
    oturumAc(temel.gorevli.id);
  });

  afterEach(() => zamaniSerbestBirak());

  // -------------------------------------------------------------------------
  // Erişim ve giriş doğrulama
  // -------------------------------------------------------------------------

  it("oturum yoksa 401 döner", async () => {
    oturumKapat();
    const cevap = await ara("q=34ABC123");
    expect(cevap.status).toBe(401);
  });

  it("tek karakterle arama yapılmaz", async () => {
    await kayit({ plaka: "34ABC123" });
    const cevap = await ara("q=3");
    const veri = await cevap.json();

    expect(veri.sonuclar).toEqual([]);
    expect(veri.ipucu).toContain("2 karakter");
  });

  it("boş sorgu sonuç döndürmez", async () => {
    await kayit({ plaka: "34ABC123" });
    const veri = await (await ara("q=")).json();
    expect(veri.sonuclar).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Eşleşme
  // -------------------------------------------------------------------------

  it("tam plakayı bulur", async () => {
    await kayit({ plaka: "34ABC123" });
    expect(await plakalar("q=34ABC123")).toEqual(["34ABC123"]);
  });

  it("boşluklu yazılan plakayı normalize ederek bulur", async () => {
    await kayit({ plaka: "34ABC123" });
    expect(await plakalar("q=34 abc 123")).toEqual(["34ABC123"]);
  });

  it("il koduyla arar", async () => {
    await kayit({ plaka: "34ABC123" });
    await kayit({ plaka: "06DEF456" });
    expect(await plakalar("q=34")).toEqual(["34ABC123"]);
  });

  it("son hanelerle arar", async () => {
    await kayit({ plaka: "34ABC159" });
    await kayit({ plaka: "06DEF456" });
    expect(await plakalar("q=159")).toEqual(["34ABC159"]);
  });

  it("araç kaydındaki markayla arar", async () => {
    await kayit({ plaka: "34ABC123", marka: "Renault", model: "Clio" });
    expect(await plakalar("q=renault")).toEqual(["34ABC123"]);
  });

  it("araç kaydındaki renkle arar", async () => {
    await kayit({ plaka: "34ABC123", renk: "Beyaz" });
    expect(await plakalar("q=beyaz")).toEqual(["34ABC123"]);
  });

  it("araca kalıcı yazılmış notla arar", async () => {
    // "anahtar bizde" gibi notlar araç kaydında durur ve aranabilir olmalı.
    await kayit({ plaka: "34ABC123", aracNotu: "anahtar bizde" });
    expect(await plakalar("q=anahtar")).toEqual(["34ABC123"]);
  });

  it("park kaydındaki notla arar", async () => {
    await kayit({ plaka: "34ABC123", notlar: "sağ çamurluk hasarlı" });
    expect(await plakalar("q=çamurluk")).toEqual(["34ABC123"]);
  });

  it("plakasız kaydı marka/modelinden bulur", async () => {
    await kayit({ plaka: null, marka: "Toyota", model: "Corolla" });
    expect(await plakalar("q=corolla")).toEqual(["(plakasız)"]);
  });

  it("büyük/küçük harf farkı aramayı bozmaz", async () => {
    await kayit({ plaka: "34ABC123", marka: "Renault" });
    expect(await plakalar("q=RENAULT")).toEqual(["34ABC123"]);
    expect(await plakalar("q=ReNaUlT")).toEqual(["34ABC123"]);
  });

  it("eşleşme yoksa boş döner", async () => {
    await kayit({ plaka: "34ABC123" });
    expect(await plakalar("q=99ZZZ999")).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Süzme
  // -------------------------------------------------------------------------

  it("iptal edilen kayıtlar gelmez", async () => {
    await kayit({ plaka: "34ABC123", durum: "IPTAL" });
    expect(await plakalar("q=34")).toEqual([]);
  });

  it("çıkmış araçlar varsayılan aramada gelir", async () => {
    // Görevli dünkü bir kaydı da arayabilmeli (fiş, itiraz).
    await kayit({ plaka: "34ABC123", durum: "CIKTI" });
    expect(await plakalar("q=34")).toEqual(["34ABC123"]);
  });

  it("iceride=1 yalnızca içerideki araçları döndürür", async () => {
    await kayit({ plaka: "34ABC111", durum: "ICERIDE" });
    await kayit({ plaka: "34ABC222", durum: "CIKTI" });
    expect(await plakalar("q=34&iceride=1")).toEqual(["34ABC111"]);
  });

  // -------------------------------------------------------------------------
  // Sıralama — görevli listenin başındakine dokunuyor
  // -------------------------------------------------------------------------

  it("içerideki araçlar çıkmışlardan önce gelir", async () => {
    await kayit({ plaka: "34ABC111", durum: "CIKTI", giris: "2026-07-15T08:00:00.000Z" });
    await kayit({ plaka: "34ABC222", durum: "ICERIDE", giris: "2026-07-15T04:00:00.000Z" });

    // İçerideki daha ESKİ olmasına rağmen başta olmalı.
    expect(await plakalar("q=34")).toEqual(["34ABC222", "34ABC111"]);
  });

  it("terimle başlayan plakalar öne alınır", async () => {
    await kayit({ plaka: "06ABC340" }); // "34" ortada
    await kayit({ plaka: "34DEF123" }); // "34" başta

    expect(await plakalar("q=34")).toEqual(["34DEF123", "06ABC340"]);
  });

  it("plakada eşleşenler yalnızca araç bilgisinde eşleşenlerden önce gelir", async () => {
    await kayit({ plaka: "06DEF456", marka: "Renault", model: "Clio34" });
    await kayit({ plaka: "34ABC123" });

    expect(await plakalar("q=34")).toEqual(["34ABC123", "06DEF456"]);
  });

  it("eşitlikte en yeni giriş önce gelir", async () => {
    await kayit({ plaka: "34ABC111", giris: "2026-07-15T04:00:00.000Z" });
    await kayit({ plaka: "34ABC222", giris: "2026-07-15T08:00:00.000Z" });

    expect(await plakalar("q=34ABC")).toEqual(["34ABC222", "34ABC111"]);
  });

  // -------------------------------------------------------------------------
  // Sayfalama
  // -------------------------------------------------------------------------

  it("varsayılan olarak en fazla 20 sonuç döner", async () => {
    for (let i = 0; i < 25; i++) {
      await kayit({ plaka: `34ABC${String(100 + i)}` });
    }
    expect((await plakalar("q=34")).length).toBe(20);
  });

  it("adet parametresi sonuç sayısını belirler", async () => {
    for (let i = 0; i < 10; i++) {
      await kayit({ plaka: `34ABC${String(100 + i)}` });
    }
    expect((await plakalar("q=34&adet=5")).length).toBe(5);
  });

  it("adet 50 ile sınırlıdır", async () => {
    for (let i = 0; i < 60; i++) {
      await kayit({ plaka: `34ABC${String(100 + i)}` });
    }
    expect((await plakalar("q=34&adet=999")).length).toBe(50);
  });

  // -------------------------------------------------------------------------
  // Yanıt biçimi
  // -------------------------------------------------------------------------

  it("görevlinin ihtiyaç duyduğu alanları döndürür", async () => {
    await kayit({
      plaka: "34ABC123",
      marka: "Renault",
      model: "Clio",
      renk: "Kırmızı",
      aracNotu: "anahtar bizde",
    });

    const veri = await (await ara("q=34ABC123")).json();
    const sonuc = veri.sonuclar[0];

    expect(sonuc).toMatchObject({
      plaka: "34ABC123",
      durum: "ICERIDE",
      marka: "Renault",
      model: "Clio",
      renk: "Kırmızı",
      notlar: "anahtar bizde",
    });
    // Çıkış işlemi için kimlik ve fiş numarası gerekli.
    expect(typeof sonuc.id).toBe("string");
    expect(typeof sonuc.fisNo).toBe("number");
    expect(typeof sonuc.girisZamani).toBe("string");
  });

  it("plakasız kayıtta araç bilgisi park kaydından gelir", async () => {
    await kayit({ plaka: null, marka: "Toyota", model: "Corolla", renk: "Beyaz" });

    const veri = await (await ara("q=corolla")).json();
    expect(veri.sonuclar[0]).toMatchObject({
      plaka: null,
      marka: "Toyota",
      model: "Corolla",
      renk: "Beyaz",
    });
  });

  it("çıkmış araçta tahsilat bilgisi döner", async () => {
    const olusan = await kayit({ plaka: "34ABC123", durum: "CIKTI" });
    await prisma.parkKaydi.update({
      where: { id: olusan.id },
      data: { tahsilEdilenUcret: 150, odemeYontemi: "NAKIT" },
    });

    const veri = await (await ara("q=34ABC123")).json();
    expect(veri.sonuclar[0]).toMatchObject({
      tahsilEdilenUcret: 150,
      odemeYontemi: "NAKIT",
      durum: "CIKTI",
    });
  });
});
