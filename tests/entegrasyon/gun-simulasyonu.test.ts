import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { aracCikisiYap, aracGirisiYap } from "@/actions/park";
import { giderEkle } from "@/actions/gider";
import { vardiyaAc, vardiyaKapat } from "@/actions/vardiya";
import { prisma } from "@/lib/prisma";
import { sayiyaCevir } from "@/lib/para";
import { vardiyaOzetiHesapla } from "@/lib/vardiya-ozet";
import { acikVardiyayiBul } from "@/lib/yetki";

import {
  BOS_DURUM,
  form,
  oturumAc,
  saatiAyarla,
  suankiSaat,
  temelVeriyiKur,
  vardiyaBaslangiciniAyarla,
  veritabaniniTemizle,
  zamaniDondur,
  zamaniSerbestBirak,
  type TemelVeri,
} from "./yardimcilar";

/**
 * Gerçek bir iş gününün uçtan uca simülasyonu — otopark 08:00'de açılıyor,
 * 20:30'da kapanıyor.
 *
 * Amaç tek tek fonksiyonları değil, GÜN SONUNDA KASANIN TUTMASINI kanıtlamak.
 * Testler sırayla çalışır ve her biri bir öncekinin bıraktığı durumu devralır;
 * dosya yukarıdan aşağı okununca günün kendisi okunur.
 *
 * Yapılandırma işletmenin gerçek ayarlarıyla aynı:
 *   tarife  — ilk 15 dakika ücretsiz · ilk saat 100 TL · sonraki her saat +50 TL
 *   vardiya — her gün 00:00'da sıfırlanır
 *
 * Sıfırlama saatinin çalışma saatleri DIŞINDA olması kritik: iş gününün içine
 * düşseydi (örneğin 12:00) vardiya gün ortasında kapanıp yeniden açılır ve tek
 * bir gün iki ayrı kasa defterine bölünürdü. Aşağıdaki testlerden biri bunun
 * olmadığını doğruluyor. Sıfırlama mekanizmasının kendisi ayrıca
 * `vardiya-akisi.test.ts` içinde sınanıyor.
 */
describe("bir iş günü: 08:00 → 20:30", () => {
  let temel: TemelVeri;
  let vardiyaId: string;
  /** Plaka (veya takma ad) → park kaydı kimliği. */
  const kayitlar: Record<string, string> = {};

  /**
   * Araç girişi yapar ve kaydın kimliğini saklar.
   *
   * Giriş saati açıkça verilir — sebebi `yardimcilar.ts` içindeki
   * `suankiSaat` açıklamasında: şema varsayılanı veritabanı saatini yazar.
   */
  async function giris(ad: string, alanlar: Record<string, string | undefined>) {
    const sonuc = await aracGirisiYap(BOS_DURUM, form({ girisSaati: suankiSaat(), ...alanlar }));
    expect(sonuc.hata, `${ad} girişi başarısız`).toBeUndefined();
    expect(sonuc.alanHatalari, `${ad} doğrulama hatası`).toBeUndefined();
    kayitlar[ad] = sonuc.yeniKayitId!;
    return sonuc;
  }

  /** Araç çıkışı yapar. */
  async function cikis(
    ad: string,
    alanlar: Record<string, string | undefined> = { odemeYontemi: "NAKIT" },
  ) {
    const sonuc = await aracCikisiYap(
      BOS_DURUM,
      form({ parkKaydiId: kayitlar[ad], ...alanlar }),
    );
    expect(sonuc.hata, `${ad} çıkışı başarısız`).toBeUndefined();
    expect(sonuc.alanHatalari, `${ad} doğrulama hatası`).toBeUndefined();
    return sonuc;
  }

  /** Bir kaydın tahsilat bilgilerini okur. */
  async function tahsilat(ad: string) {
    const kayit = await prisma.parkKaydi.findUniqueOrThrow({ where: { id: kayitlar[ad] } });
    return {
      tutar: sayiyaCevir(kayit.tahsilEdilenUcret),
      hesaplanan: sayiyaCevir(kayit.hesaplananUcret),
      yontem: kayit.odemeYontemi,
      cikisVardiyaId: kayit.cikisVardiyaId,
      girisVardiyaId: kayit.vardiyaId,
    };
  }

  beforeAll(async () => {
    zamaniDondur();
    saatiAyarla("08:00");
    await veritabaniniTemizle();
    // İşletmenin gerçek ayarı: vardiya gece yarısı sıfırlanır.
    temel = await temelVeriyiKur({ sifirlamaSaati: 0 });
    oturumAc(temel.gorevli.id);
  });

  afterAll(() => zamaniSerbestBirak());

  // -------------------------------------------------------------------------
  // Sabah
  // -------------------------------------------------------------------------

  it("08:00 — Mehmet vardiyayı 500 TL açılış kasasıyla açar", async () => {
    const an = saatiAyarla("08:00");

    const sonuc = await vardiyaAc(BOS_DURUM, form({ acilisKasa: "500" }));
    expect(sonuc.basarili).toBe(true);

    const acik = await acikVardiyayiBul();
    vardiyaId = acik!.id;
    expect(sayiyaCevir(acik!.acilisKasa)).toBe(500);

    // Başlangıç anını simülasyona hizala (gerekçe: yardimcilar.ts).
    await vardiyaBaslangiciniAyarla(vardiyaId, an);
  });

  it("08:05–08:45 — gün başında üç araç girer", async () => {
    saatiAyarla("08:05");
    await giris("34ABC123", { plaka: "34 abc 123", marka: "Renault", model: "Clio" });

    saatiAyarla("08:20");
    await giris("06DEF456", { plaka: "06DEF456", marka: "Fiat", model: "Egea" });

    saatiAyarla("08:45");
    await giris("35GHI789", { plaka: "35 GHI 789" });

    expect(await prisma.parkKaydi.count({ where: { durum: "ICERIDE" } })).toBe(3);
  });

  it("plaka normalize edilerek saklanır, gösterim ayrı tutulur", async () => {
    // "34 abc 123" girildi; veritabanında boşluksuz ve büyük harf durmalı.
    const kayit = await prisma.parkKaydi.findUniqueOrThrow({
      where: { id: kayitlar["34ABC123"] },
    });
    expect(kayit.plaka).toBe("34ABC123");
    expect(kayit.plakaGosterim).toBe("34 ABC 123");
  });

  it("09:30 — ilk çıkış: 85 dakika, 150 TL nakit", async () => {
    saatiAyarla("09:30");
    await cikis("34ABC123", { odemeYontemi: "NAKIT" });

    // 85 dk − 15 dk ücretsiz = 70 dk → 2 başlayan saat → 100 + 50 = 150 TL
    const sonuc = await tahsilat("34ABC123");
    expect(sonuc.tutar).toBe(150);
    expect(sonuc.yontem).toBe("NAKIT");
    expect(sonuc.cikisVardiyaId).toBe(vardiyaId);
  });

  it("10:00 — çay gideri kasadan düşülür (50 TL nakit)", async () => {
    saatiAyarla("10:00");

    const sonuc = await giderEkle(
      BOS_DURUM,
      form({ kategori: "CAY", tutar: "50", aciklama: "Çay ocağı", odemeYontemi: "NAKIT" }),
    );
    expect(sonuc.basarili).toBe(true);
  });

  it("10:15 — kartla ödenen çıkış kasaya nakit eklemez", async () => {
    saatiAyarla("10:15");
    await cikis("06DEF456", { odemeYontemi: "KART" });

    // 115 dk − 15 = 100 dk → 2 saat → 150 TL
    const sonuc = await tahsilat("06DEF456");
    expect(sonuc.tutar).toBe(150);
    expect(sonuc.yontem).toBe("KART");

    const ozet = await vardiyaOzetiHesapla(vardiyaId);
    expect(ozet.toplamKart).toBe(150);
    // Kasada yalnızca nakit var: 500 açılış + 150 nakit − 50 gider
    expect(ozet.beklenenKasa).toBe(600);
  });

  it("11:00 — plakası okunamayan araç marka/model ile kaydedilir", async () => {
    saatiAyarla("11:00");
    await giris("plakasiz", { marka: "Toyota", model: "Corolla", renk: "Beyaz" });

    const kayit = await prisma.parkKaydi.findUniqueOrThrow({
      where: { id: kayitlar["plakasiz"] },
    });
    expect(kayit.plaka).toBeNull();
    expect(kayit.aracId).toBeNull();
    expect(kayit.marka).toBe("Toyota");
  });

  it("11:50 — 3 saatlik park 200 TL", async () => {
    saatiAyarla("11:50");
    await cikis("35GHI789", { odemeYontemi: "NAKIT" });

    // 185 dk − 15 = 170 dk → 3 başlayan saat → 100 + 50 + 50 = 200 TL
    expect((await tahsilat("35GHI789")).tutar).toBe(200);
  });

  // -------------------------------------------------------------------------
  // Öğlen — vardiya bölünmemeli
  // -------------------------------------------------------------------------

  it("12:00 geçilir, vardiya bölünmez", async () => {
    saatiAyarla("12:30");

    // Sıfırlama saati 00:00 olduğu için öğlen sınırı yok. Bu, ayarın
    // yanlışlıkla çalışma saatlerinin içine çekilmesine karşı bekçi:
    // 12:00 olsaydı burada vardiya kapanır ve gün ikiye bölünürdü.
    const acik = await acikVardiyayiBul();
    expect(acik!.id).toBe(vardiyaId);
    expect(await prisma.vardiya.count()).toBe(1);
  });

  it("13:00 — sabah giren plakasız araç çıkar", async () => {
    saatiAyarla("13:00");
    await cikis("plakasiz", { odemeYontemi: "NAKIT" });

    // 120 dk − 15 = 105 dk → 2 saat → 150 TL
    const sonuc = await tahsilat("plakasiz");
    expect(sonuc.tutar).toBe(150);
    // Giriş ve çıkış aynı vardiyada: gün bölünmediği için kasa da tek.
    expect(sonuc.girisVardiyaId).toBe(vardiyaId);
    expect(sonuc.cikisVardiyaId).toBe(vardiyaId);
  });

  // -------------------------------------------------------------------------
  // Öğleden sonra
  // -------------------------------------------------------------------------

  it("14:00 — yemek gideri (200 TL nakit)", async () => {
    saatiAyarla("14:00");
    const sonuc = await giderEkle(
      BOS_DURUM,
      form({ kategori: "YEMEK", tutar: "200", aciklama: "Öğle yemeği", odemeYontemi: "NAKIT" }),
    );
    expect(sonuc.basarili).toBe(true);
  });

  it("15:00 — aynı plaka gün içinde ikinci kez park edip çıkabilir", async () => {
    saatiAyarla("12:30");
    await giris("34ABC123-2", { plaka: "34ABC123", marka: "Renault", model: "Clio" });

    saatiAyarla("15:00");
    await cikis("34ABC123-2", { odemeYontemi: "KART" });

    // 150 dk − 15 = 135 dk → 3 saat → 200 TL
    expect((await tahsilat("34ABC123-2")).tutar).toBe(200);
  });

  it("16:10 — ilk 15 dakika içinde çıkan araçtan ücret alınmaz", async () => {
    saatiAyarla("16:00");
    await giris("07JKL012", { plaka: "07JKL012" });

    saatiAyarla("16:10");
    await cikis("07JKL012", { odemeYontemi: "NAKIT" });

    const sonuc = await tahsilat("07JKL012");
    expect(sonuc.tutar).toBe(0);
    // 0 TL'de ödeme yöntemi anlamsız — boş bırakılır.
    expect(sonuc.yontem).toBeNull();
  });

  it("18:00 — görevli indirim yapar, sebep denetim izine yazılır", async () => {
    saatiAyarla("17:00");
    await giris("16MNP345", { plaka: "16MNP345" });

    saatiAyarla("18:00");
    await cikis("16MNP345", {
      odemeYontemi: "NAKIT",
      duzeltilmisUcret: "80",
      ucretDuzeltmeSebebi: "Esnaf indirimi — komşu dükkân",
    });

    const sonuc = await tahsilat("16MNP345");
    // 60 dk − 15 = 45 dk → 1 saat → 100 TL hesaplandı, 80 TL tahsil edildi.
    expect(sonuc.hesaplanan).toBe(100);
    expect(sonuc.tutar).toBe(80);

    const duzeltme = await prisma.islemGunlugu.findFirst({
      where: { islemTipi: "UCRET_DUZELTME", ilgiliKayitId: kayitlar["16MNP345"] },
    });
    expect(duzeltme?.aciklama).toBe("Esnaf indirimi — komşu dükkân");
    expect(duzeltme?.eskiDeger).toEqual({ tutar: 100 });
    expect(duzeltme?.yeniDeger).toEqual({ tutar: 80 });
  });

  it("sebepsiz ücret değişikliği reddedilir", async () => {
    saatiAyarla("18:05");
    await giris("34RST678", { plaka: "34RST678" });

    saatiAyarla("18:30");
    const sonuc = await aracCikisiYap(
      BOS_DURUM,
      form({
        parkKaydiId: kayitlar["34RST678"],
        odemeYontemi: "NAKIT",
        duzeltilmisUcret: "10",
      }),
    );

    expect(sonuc.alanHatalari?.ucretDuzeltmeSebebi).toBeDefined();
    // Araç hâlâ içeride: reddedilen çıkış kaydı değiştirmemeli.
    const kayit = await prisma.parkKaydi.findUniqueOrThrow({
      where: { id: kayitlar["34RST678"] },
    });
    expect(kayit.durum).toBe("ICERIDE");
  });

  it("19:00 — kartla ödenen gider kasayı etkilemez", async () => {
    saatiAyarla("19:00");
    await giderEkle(
      BOS_DURUM,
      form({ kategori: "BAKIM", tutar: "120", aciklama: "Bariyer onarımı", odemeYontemi: "KART" }),
    );

    const ozet = await vardiyaOzetiHesapla(vardiyaId);
    expect(ozet.kartGider).toBe(120);
    // 500 açılış + 580 nakit tahsilat − 250 nakit gider = 830
    expect(ozet.beklenenKasa).toBe(830);
  });

  it("20:00 — gece kalacak araç girer, çıkış yapmaz", async () => {
    saatiAyarla("20:00");
    await giris("34VYZ111", { plaka: "34VYZ111", marka: "Honda", model: "Civic" });

    // 18:05'te giren 34RST678 ile birlikte iki araç gecelik kalıyor.
    expect(await prisma.parkKaydi.count({ where: { durum: "ICERIDE" } })).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Kapanış — mutabakat
  // -------------------------------------------------------------------------

  it("20:30 — kasa sayılır ve fark sıfır çıkar", async () => {
    saatiAyarla("20:30");

    const ozet = await vardiyaOzetiHesapla(vardiyaId);
    expect(ozet.beklenenKasa).toBe(830);

    const sonuc = await vardiyaKapat(
      BOS_DURUM,
      form({ vardiyaId, kapanisKasa: "830", notlar: "Gün sonu" }),
    );
    expect(sonuc.basarili).toBe(true);

    const kapali = await prisma.vardiya.findUniqueOrThrow({ where: { id: vardiyaId } });
    expect(sayiyaCevir(kapali.fark)).toBe(0);
    expect(kapali.otomatikKapanis).toBe(false);
    expect(kapali.kapatanId).toBe(temel.gorevli.id);
  });

  it("gün tek vardiyada tamamlanır", async () => {
    // 08:00'de açılan vardiya 20:30'da kapandı; arada bölünme yok.
    expect(await prisma.vardiya.count()).toBe(1);

    const vardiya = await prisma.vardiya.findUniqueOrThrow({ where: { id: vardiyaId } });
    expect(vardiya.baslangic.toISOString()).toBe("2026-07-15T05:00:00.000Z"); // 08:00
    expect(vardiya.bitis!.toISOString()).toBe("2026-07-15T17:30:00.000Z"); // 20:30
  });

  it("günün toplamı: 930 TL tahsilat, 370 TL gider, 560 TL net", async () => {
    const ozet = await vardiyaOzetiHesapla(vardiyaId);

    expect(ozet.toplamNakit).toBe(580);
    expect(ozet.toplamKart).toBe(350);
    expect(ozet.toplamTahsilat).toBe(930);
    expect(ozet.toplamGider).toBe(370);
    expect(ozet.netKazanc).toBe(560);
  });

  it("kasa zinciri baştan sona tutar", async () => {
    const ozet = await vardiyaOzetiHesapla(vardiyaId);

    // Kasaya giren nakit − kasadan çıkan nakit
    const nakitAkisi = 500 + ozet.toplamNakit - ozet.nakitGider;

    expect(ozet.nakitGider).toBe(250);
    expect(nakitAkisi).toBe(830);
    expect(nakitAkisi).toBe(ozet.beklenenKasa);
    // Kart tahsilatı ve kart gideri kasaya hiç dokunmaz.
    expect(ozet.toplamKart).toBe(350);
    expect(ozet.kartGider).toBe(120);
  });

  it("araç sayıları tutar", async () => {
    const ozet = await vardiyaOzetiHesapla(vardiyaId);

    expect(ozet.girisSayisi).toBe(9);
    expect(ozet.cikisSayisi).toBe(7);
    expect(ozet.ucretsizCikisSayisi).toBe(1);
  });

  it("gecelik araçlar ertesi güne devreder", async () => {
    const iceride = await prisma.parkKaydi.findMany({
      where: { durum: "ICERIDE" },
      select: { plaka: true },
      orderBy: { plaka: "asc" },
    });

    expect(iceride.map((k) => k.plaka)).toEqual(["34RST678", "34VYZ111"]);
  });

  it("günün her işlemi denetim izine yazılmıştır", async () => {
    const sayimlar = await prisma.islemGunlugu.groupBy({
      by: ["islemTipi"],
      _count: { _all: true },
    });
    const say = (tip: string) => sayimlar.find((s) => s.islemTipi === tip)?._count._all ?? 0;

    expect(say("GIRIS")).toBe(9);
    expect(say("CIKIS")).toBe(7); // 2 araç içeride kaldı
    expect(say("GIDER_EKLEME")).toBe(3);
    expect(say("UCRET_DUZELTME")).toBe(1);
    expect(say("VARDIYA_ACILIS")).toBe(1);
    expect(say("VARDIYA_KAPANIS")).toBe(1);
  });

  it("işlem günlüğü kaydı kullanıcıya bağlıdır (KVKK: kim yaptı)", async () => {
    const kayitsiz = await prisma.islemGunlugu.count({ where: { kullaniciId: null } });
    expect(kayitsiz).toBe(0);
  });
});
