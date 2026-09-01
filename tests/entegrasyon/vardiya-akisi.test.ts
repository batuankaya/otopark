import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { giderEkle, giderSil } from "@/actions/gider";
import { aracCikisiYap, aracGirisiYap } from "@/actions/park";
import { vardiyaAc, vardiyaKapat } from "@/actions/vardiya";
import { prisma } from "@/lib/prisma";
import { sayiyaCevir } from "@/lib/para";
import { vardiyaOzetiHesapla } from "@/lib/vardiya-ozet";
import { sifirlamaOnbelleginiTemizle } from "@/lib/vardiya-sifirlama";
import { acikVardiyayiBul } from "@/lib/yetki";

import {
  BOS_DURUM,
  form,
  istanbulAni,
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

describe("vardiya ve kasa", () => {
  let temel: TemelVeri;

  /** Vardiya açıp başlangıcını verilen ana (varsayılan: şimdi) hizalar. */
  async function vardiyaAcVeHizala(acilisKasa = "0", an: Date = new Date()) {
    await vardiyaAc(BOS_DURUM, form({ acilisKasa }));
    const acik = await acikVardiyayiBul();
    await vardiyaBaslangiciniAyarla(acik!.id, an);
    return acik!.id;
  }

  beforeEach(async () => {
    zamaniDondur();
    saatiAyarla("09:00");
    await veritabaniniTemizle();
    temel = await temelVeriyiKur();
    oturumAc(temel.gorevli.id);
  });

  afterEach(() => zamaniSerbestBirak());

  // -------------------------------------------------------------------------
  // Tek açık vardiya
  // -------------------------------------------------------------------------

  describe("tek açık vardiya kuralı", () => {
    it("açık vardiya varken ikincisi açılmaz", async () => {
      await vardiyaAcVeHizala("500");

      const ikinci = await vardiyaAc(BOS_DURUM, form({ acilisKasa: "300" }));
      expect(ikinci.hata).toContain("zaten açık bir vardiya var");
      expect(await prisma.vardiya.count()).toBe(1);
    });

    it("başka görevlinin açtığı vardiya adıyla bildirilir", async () => {
      await vardiyaAcVeHizala("500");

      oturumAc(temel.gorevliIki.id);
      const ikinci = await vardiyaAc(BOS_DURUM, form({ acilisKasa: "300" }));
      expect(ikinci.hata).toContain("Mehmet Görevli");
    });

    it("iki görevli aynı anda açarsa yalnızca biri başarılı olur", async () => {
      // Veritabanındaki kısmi unique index (vardiya_tek_acik_uq) hakem.
      const [a, b] = await Promise.all([
        vardiyaAc(BOS_DURUM, form({ acilisKasa: "500" })),
        vardiyaAc(BOS_DURUM, form({ acilisKasa: "300" })),
      ]);

      expect([a, b].filter((s) => s.basarili).length).toBe(1);
      expect(await prisma.vardiya.count({ where: { bitis: null } })).toBe(1);
    });

    it("kapanan vardiyadan sonra yenisi açılabilir", async () => {
      const ilk = await vardiyaAcVeHizala("500");
      await vardiyaKapat(BOS_DURUM, form({ vardiyaId: ilk, kapanisKasa: "500" }));

      const ikinci = await vardiyaAc(BOS_DURUM, form({ acilisKasa: "500" }));
      expect(ikinci.basarili).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Kapanış ve fark
  // -------------------------------------------------------------------------

  describe("kapanış mutabakatı", () => {
    /** Vardiyaya nakit tahsilat ekler (araç girip çıkararak). */
    async function nakitTahsilat(plaka: string, girisSaati: string, cikisSaati: string) {
      saatiAyarla(girisSaati);
      const giren = await aracGirisiYap(
        BOS_DURUM,
        form({ plaka, girisSaati: suankiSaat() }),
      );
      saatiAyarla(cikisSaati);
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, odemeYontemi: "NAKIT" }),
      );
    }

    it("kasa tam sayıldığında fark sıfırdır", async () => {
      const vardiyaId = await vardiyaAcVeHizala("500");
      await nakitTahsilat("34ABC123", "09:10", "10:30"); // 80 dk → 150 TL

      saatiAyarla("18:00");
      await vardiyaKapat(BOS_DURUM, form({ vardiyaId, kapanisKasa: "650" }));

      const kapali = await prisma.vardiya.findUniqueOrThrow({ where: { id: vardiyaId } });
      expect(sayiyaCevir(kapali.fark)).toBe(0);
      expect(sayiyaCevir(kapali.toplamNakit)).toBe(150);
    });

    it("kasa eksik sayılırsa fark negatif çıkar", async () => {
      const vardiyaId = await vardiyaAcVeHizala("500");
      await nakitTahsilat("34ABC123", "09:10", "10:30");

      saatiAyarla("18:00");
      await vardiyaKapat(BOS_DURUM, form({ vardiyaId, kapanisKasa: "600" }));

      // Kasada 650 olmalıydı, 600 sayıldı → 50 TL açık.
      const kapali = await prisma.vardiya.findUniqueOrThrow({ where: { id: vardiyaId } });
      expect(sayiyaCevir(kapali.fark)).toBe(-50);
    });

    it("kasa fazla sayılırsa fark pozitif çıkar", async () => {
      const vardiyaId = await vardiyaAcVeHizala("500");
      await nakitTahsilat("34ABC123", "09:10", "10:30");

      saatiAyarla("18:00");
      await vardiyaKapat(BOS_DURUM, form({ vardiyaId, kapanisKasa: "680" }));

      const kapali = await prisma.vardiya.findUniqueOrThrow({ where: { id: vardiyaId } });
      expect(sayiyaCevir(kapali.fark)).toBe(30);
    });

    it("nakit gider beklenen kasadan düşer", async () => {
      const vardiyaId = await vardiyaAcVeHizala("500");
      await nakitTahsilat("34ABC123", "09:10", "10:30"); // +150

      saatiAyarla("11:00");
      await giderEkle(
        BOS_DURUM,
        form({ kategori: "CAY", tutar: "70", aciklama: "Çay", odemeYontemi: "NAKIT" }),
      );

      saatiAyarla("18:00");
      await vardiyaKapat(BOS_DURUM, form({ vardiyaId, kapanisKasa: "580" }));

      // 500 + 150 − 70 = 580 → fark 0
      const kapali = await prisma.vardiya.findUniqueOrThrow({ where: { id: vardiyaId } });
      expect(sayiyaCevir(kapali.fark)).toBe(0);
    });

    it("kapanmış vardiya ikinci kez kapatılamaz", async () => {
      const vardiyaId = await vardiyaAcVeHizala("500");
      await vardiyaKapat(BOS_DURUM, form({ vardiyaId, kapanisKasa: "500" }));

      const ikinci = await vardiyaKapat(BOS_DURUM, form({ vardiyaId, kapanisKasa: "500" }));
      expect(ikinci.hata).toContain("zaten kapatılmış");
    });

    it("vardiyayı açan değil, başka bir görevli de kapatabilir", async () => {
      // Vardiya ortak kasadır; açan kişi izinde olabilir.
      const vardiyaId = await vardiyaAcVeHizala("500");

      oturumAc(temel.gorevliIki.id);
      const sonuc = await vardiyaKapat(BOS_DURUM, form({ vardiyaId, kapanisKasa: "500" }));
      expect(sonuc.basarili).toBe(true);

      const kapali = await prisma.vardiya.findUniqueOrThrow({ where: { id: vardiyaId } });
      expect(kapali.kapatanId).toBe(temel.gorevliIki.id);
      expect(kapali.kullaniciId).toBe(temel.gorevli.id);
    });

    it("kuruşlu tutarlarda fark kuruş hassasiyetinde kalır", async () => {
      const vardiyaId = await vardiyaAcVeHizala("100,50");

      saatiAyarla("18:00");
      await vardiyaKapat(BOS_DURUM, form({ vardiyaId, kapanisKasa: "100,45" }));

      const kapali = await prisma.vardiya.findUniqueOrThrow({ where: { id: vardiyaId } });
      expect(sayiyaCevir(kapali.fark)).toBe(-0.05);
    });
  });

  // -------------------------------------------------------------------------
  // Günlük otomatik sıfırlama
  // -------------------------------------------------------------------------

  describe("günlük otomatik sıfırlama", () => {
    // Bu testler sınır davranışını sınıyor, o yüzden sıfırlama saati bilerek
    // çalışma saatlerinin içine (12:00) alınıyor — sınırı geçmek kolay olsun.
    beforeEach(async () => {
      await prisma.ayar.update({ where: { id: 1 }, data: { vardiyaSifirlamaSaati: 12 } });
      sifirlamaOnbelleginiTemizle();
    });

    it("sıfırlama saatinden sonra açılmış vardiyaya dokunulmaz", async () => {
      saatiAyarla("14:00");
      const vardiyaId = await vardiyaAcVeHizala("500");

      saatiAyarla("16:00");
      const acik = await acikVardiyayiBul();

      expect(acik!.id).toBe(vardiyaId);
      expect(await prisma.vardiya.count()).toBe(1);
    });

    it("sınır geçilince vardiya kapanır ve YENİSİ AÇILMAZ", async () => {
      saatiAyarla("08:00");
      const eskiId = await vardiyaAcVeHizala("500");

      saatiAyarla("12:30");
      const acik = await acikVardiyayiBul();

      // Yeni vardiyayı sabah gelen görevli açar; sistem kendiliğinden açmaz.
      expect(acik).toBeNull();
      expect(await prisma.vardiya.count()).toBe(1);

      const eski = await prisma.vardiya.findUniqueOrThrow({ where: { id: eskiId } });
      expect(eski.otomatikKapanis).toBe(true);
      expect(eski.bitis!.toISOString()).toBe(istanbulAni("12:00").toISOString());
    });

    it("açık vardiya kalmadığı için araç işlemi yapılamaz", async () => {
      saatiAyarla("08:00");
      await vardiyaAcVeHizala("500");

      saatiAyarla("12:30");
      const sonuc = await aracGirisiYap(
        BOS_DURUM,
        form({ plaka: "34ABC123", girisSaati: suankiSaat() }),
      );

      expect(sonuc.hata).toContain("açık vardiya yok");
      expect(sonuc.vardiyaGerekli).toBe(true);
    });

    it("kapanan vardiyanın notunda kasada olması gereken tutar yazar", async () => {
      // Sabah gelen görevli açılış kasasını elle giriyor; karşılaştıracağı
      // rakamı hesaplamak zorunda kalmasın diye nota yazılır.
      saatiAyarla("08:00");
      const eskiId = await vardiyaAcVeHizala("500");

      saatiAyarla("09:00");
      const giren = await aracGirisiYap(
        BOS_DURUM,
        form({ plaka: "34ABC123", girisSaati: suankiSaat() }),
      );
      saatiAyarla("10:30");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, odemeYontemi: "NAKIT" }),
      );

      saatiAyarla("12:30");
      await acikVardiyayiBul();

      // 500 açılış + 150 nakit tahsilat = 650
      const eski = await prisma.vardiya.findUniqueOrThrow({ where: { id: eskiId } });
      expect(eski.notlar).toContain("Kasada olması gereken: 650 TL");
    });

    it("sabah açılan yeni vardiya kasayı devralmaz, görevli elle girer", async () => {
      saatiAyarla("08:00");
      await vardiyaAcVeHizala("500");

      saatiAyarla("12:30");
      await acikVardiyayiBul();

      // Görevli saydığı tutarı giriyor — sistem bir tutar dayatmıyor.
      const acilis = await vardiyaAc(BOS_DURUM, form({ acilisKasa: "480" }));
      expect(acilis.basarili).toBe(true);

      const yeni = await prisma.vardiya.findFirstOrThrow({ where: { bitis: null } });
      expect(sayiyaCevir(yeni.acilisKasa)).toBe(480);
      expect(yeni.otomatikKapanis).toBe(false);
    });

    it("uygulama günlerce kapalı kalsa bile en son sınıra göre kapanır", async () => {
      // Vardiya 3 gün önce açılmış ve unutulmuş.
      saatiAyarla("08:00");
      const eskiId = await vardiyaAcVeHizala("500", istanbulAni("08:00", "2026-07-12"));

      // Uygulama 15 Temmuz 14:00'te yeniden açılıyor.
      saatiAyarla("14:00");
      await acikVardiyayiBul();

      const eski = await prisma.vardiya.findUniqueOrThrow({ where: { id: eskiId } });
      // 12 Temmuz'daki değil, BUGÜNKÜ 12:00 sınırında kapanmalı.
      expect(eski.bitis!.toISOString()).toBe(istanbulAni("12:00").toISOString());
    });

    it("devreden kasa kesintisizdir", async () => {
      saatiAyarla("08:00");
      const eskiId = await vardiyaAcVeHizala("500");

      saatiAyarla("09:00");
      const giren = await aracGirisiYap(
        BOS_DURUM,
        form({ plaka: "34ABC123", girisSaati: suankiSaat() }),
      );
      saatiAyarla("10:30");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, odemeYontemi: "NAKIT" }),
      );
      await giderEkle(
        BOS_DURUM,
        form({ kategori: "CAY", tutar: "50", aciklama: "Çay", odemeYontemi: "NAKIT" }),
      );

      saatiAyarla("12:30");
      expect(await acikVardiyayiBul()).toBeNull();

      // Kapanan vardiyanın hesabı bozulmamalı: 500 + 150 − 50 = 600.
      // Bu tutar sabah açılışta göreve önerilecek referans.
      const ozet = await vardiyaOzetiHesapla(eskiId);
      expect(ozet.beklenenKasa).toBe(600);
      expect(ozet.toplamNakit).toBe(150);
      expect(ozet.nakitGider).toBe(50);
    });

    it("sıfırlama saati ayarlanabilir (gece yarısı)", async () => {
      await prisma.ayar.update({ where: { id: 1 }, data: { vardiyaSifirlamaSaati: 0 } });
      sifirlamaOnbelleginiTemizle();

      // Vardiya dün 22:00'de açıldı.
      saatiAyarla("22:00", "2026-07-14");
      const eskiId = await vardiyaAcVeHizala("500", istanbulAni("22:00", "2026-07-14"));

      saatiAyarla("01:00");
      await acikVardiyayiBul();

      const eski = await prisma.vardiya.findUniqueOrThrow({ where: { id: eskiId } });
      expect(eski.bitis!.toISOString()).toBe(istanbulAni("00:00").toISOString());
    });

    it("bir vardiyada girip başkasında çıkan aracın parası İKİNCİ kasaya yazılır", async () => {
      saatiAyarla("08:00");
      const eskiId = await vardiyaAcVeHizala("500");

      // Araç sabah giriyor…
      saatiAyarla("10:00");
      const giren = await aracGirisiYap(
        BOS_DURUM,
        form({ plaka: "34ABC123", girisSaati: suankiSaat() }),
      );

      // …vardiya sınırda kapanıyor, görevli yeni vardiyayı elle açıyor,
      // araç öğleden sonra çıkıyor.
      saatiAyarla("13:00");
      expect(await acikVardiyayiBul()).toBeNull();
      await vardiyaAc(BOS_DURUM, form({ acilisKasa: "500" }));

      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, odemeYontemi: "NAKIT" }),
      );

      const yeni = await prisma.vardiya.findFirstOrThrow({ where: { bitis: null } });
      const kayit = await prisma.parkKaydi.findUniqueOrThrow({
        where: { id: giren.yeniKayitId! },
      });

      expect(kayit.vardiyaId).toBe(eskiId);
      expect(kayit.cikisVardiyaId).toBe(yeni.id);

      // Para ikinci kasada; birincide görünmemeli.
      const [birinci, ikinci] = await Promise.all([
        vardiyaOzetiHesapla(eskiId),
        vardiyaOzetiHesapla(yeni.id),
      ]);
      expect(birinci.toplamNakit).toBe(0);
      expect(ikinci.toplamNakit).toBe(200); // 180 dk − 15 = 165 → 3 saat
      // Giriş sayısı ise birinci vardiyaya ait.
      expect(birinci.girisSayisi).toBe(1);
      expect(ikinci.cikisSayisi).toBe(1);
    });

    it("otomatik kapanışta kasa sayılmadığı için fark üretilmez", async () => {
      saatiAyarla("08:00");
      const eskiId = await vardiyaAcVeHizala("500");

      saatiAyarla("12:30");
      await acikVardiyayiBul();

      const eski = await prisma.vardiya.findUniqueOrThrow({ where: { id: eskiId } });
      expect(eski.kapanisKasa).toBeNull();
      expect(eski.fark).toBeNull();
      expect(eski.notlar).toContain("otomatik kapatıldı");
    });

    it("eşzamanlı iki istekte vardiya yalnızca bir kez devredilir", async () => {
      saatiAyarla("08:00");
      await vardiyaAcVeHizala("500");

      saatiAyarla("12:30");
      // İki görevli aynı anda sayfa açıyor; ikisi de sıfırlamayı tetikler.
      await Promise.all([acikVardiyayiBul(), acikVardiyayiBul()]);

      // Vardiya iki kez kapatılmaya çalışılsa da tek kayıt kalır ve
      // kendiliğinden yeni vardiya oluşmaz.
      expect(await prisma.vardiya.count()).toBe(1);
      expect(await prisma.vardiya.count({ where: { bitis: null } })).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Giderler
  // -------------------------------------------------------------------------

  describe("giderler", () => {
    let vardiyaId: string;

    beforeEach(async () => {
      vardiyaId = await vardiyaAcVeHizala("1000");
    });

    it("nakit gider kasadan düşer, kart gideri düşmez", async () => {
      await giderEkle(
        BOS_DURUM,
        form({ kategori: "YEMEK", tutar: "200", aciklama: "Öğle", odemeYontemi: "NAKIT" }),
      );
      await giderEkle(
        BOS_DURUM,
        form({ kategori: "BAKIM", tutar: "300", aciklama: "Onarım", odemeYontemi: "KART" }),
      );

      const ozet = await vardiyaOzetiHesapla(vardiyaId);
      expect(ozet.nakitGider).toBe(200);
      expect(ozet.kartGider).toBe(300);
      expect(ozet.toplamGider).toBe(500);
      expect(ozet.beklenenKasa).toBe(800);
    });

    it("Türkçe tutar biçimi kabul edilir", async () => {
      await giderEkle(
        BOS_DURUM,
        form({ kategori: "DIGER", tutar: "1.234,50", aciklama: "Malzeme" }),
      );

      const gider = await prisma.gider.findFirstOrThrow();
      expect(sayiyaCevir(gider.tutar)).toBe(1234.5);
    });

    it("sıfır tutarlı gider reddedilir", async () => {
      const sonuc = await giderEkle(
        BOS_DURUM,
        form({ kategori: "DIGER", tutar: "0", aciklama: "Boş" }),
      );
      expect(sonuc.alanHatalari?.tutar).toBeDefined();
      expect(await prisma.gider.count()).toBe(0);
    });

    it("negatif tutar reddedilir", async () => {
      const sonuc = await giderEkle(
        BOS_DURUM,
        form({ kategori: "DIGER", tutar: "-50", aciklama: "Hatalı" }),
      );
      expect(sonuc.alanHatalari?.tutar).toBeDefined();
    });

    it("açıklama zorunludur", async () => {
      const sonuc = await giderEkle(BOS_DURUM, form({ kategori: "DIGER", tutar: "50" }));
      expect(sonuc.alanHatalari?.aciklama).toBeDefined();
    });

    it("açık vardiya yokken gider eklenemez", async () => {
      await vardiyaKapat(BOS_DURUM, form({ vardiyaId, kapanisKasa: "1000" }));

      const sonuc = await giderEkle(
        BOS_DURUM,
        form({ kategori: "CAY", tutar: "50", aciklama: "Çay" }),
      );
      expect(sonuc.hata).toContain("Açık vardiya yok");
      expect(sonuc.vardiyaGerekli).toBe(true);
    });

    it("açık vardiyanın gideri silinir ve günlüğe yazılır", async () => {
      await giderEkle(
        BOS_DURUM,
        form({ kategori: "CAY", tutar: "50", aciklama: "Yanlış giriş" }),
      );
      const gider = await prisma.gider.findFirstOrThrow();

      const sonuc = await giderSil(BOS_DURUM, form({ giderId: gider.id }));
      expect(sonuc.basarili).toBe(true);
      expect(await prisma.gider.count()).toBe(0);

      const gunluk = await prisma.islemGunlugu.findFirstOrThrow({
        where: { islemTipi: "GIDER_SILME" },
      });
      // Silinen kaydın eski değeri denetim izinde durmalı.
      expect(gunluk.eskiDeger).toMatchObject({ tutar: 50, aciklama: "Yanlış giriş" });
    });

    it("kapanmış vardiyanın gideri silinemez", async () => {
      await giderEkle(BOS_DURUM, form({ kategori: "CAY", tutar: "50", aciklama: "Çay" }));
      const gider = await prisma.gider.findFirstOrThrow();

      await vardiyaKapat(BOS_DURUM, form({ vardiyaId, kapanisKasa: "950" }));

      const sonuc = await giderSil(BOS_DURUM, form({ giderId: gider.id }));
      expect(sonuc.hata).toContain("Kapanmış vardiyanın");
      expect(await prisma.gider.count()).toBe(1);
    });
  });
});
