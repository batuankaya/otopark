import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { aracCikisiYap, aracGirisiYap, cikisOnizle, kaydiDuzenle, kaydiIptalEt } from "@/actions/park";
import { vardiyaAc } from "@/actions/vardiya";
import { prisma } from "@/lib/prisma";
import { sayiyaCevir } from "@/lib/para";
import { vardiyaOzetiHesapla } from "@/lib/vardiya-ozet";
import { acikVardiyayiBul } from "@/lib/yetki";

import {
  BOS_DURUM,
  form,
  oturumAc,
  oturumKapat,
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
 * Araç giriş/çıkış akışının sınır durumları.
 *
 * Buradaki senaryolar mutlu yolun dışında kalan, sahada gerçekten yaşanan
 * durumlar: aynı plakanın iki kez girilmesi, otoparkın dolması, iki görevlinin
 * aynı anda aynı araca çıkış vermesi, abonmanın araç içerideyken dolması.
 */
describe("araç giriş/çıkış akışı", () => {
  let temel: TemelVeri;
  let vardiyaId: string;

  /** Vardiya açar ve başlangıcını simülasyon saatine hizalar. */
  async function vardiyaHazirla() {
    const an = new Date();
    await vardiyaAc(BOS_DURUM, form({ acilisKasa: "0" }));
    const acik = await acikVardiyayiBul();
    await vardiyaBaslangiciniAyarla(acik!.id, an);
    return acik!.id;
  }

  async function giris(alanlar: Record<string, string | undefined>) {
    return aracGirisiYap(BOS_DURUM, form({ girisSaati: suankiSaat(), ...alanlar }));
  }

  beforeEach(async () => {
    zamaniDondur();
    saatiAyarla("09:00");
    await veritabaniniTemizle();
    temel = await temelVeriyiKur();
    oturumAc(temel.gorevli.id);
    vardiyaId = await vardiyaHazirla();
  });

  afterEach(() => zamaniSerbestBirak());

  // -------------------------------------------------------------------------
  // Giriş
  // -------------------------------------------------------------------------

  describe("giriş engelleri", () => {
    it("aynı plaka ikinci kez içeri alınmaz", async () => {
      await giris({ plaka: "34ABC123" });
      const ikinci = await giris({ plaka: "34 abc 123" });

      expect(ikinci.hata).toContain("zaten otoparkta");
      // Arayüz "Çıkışa git" düğmesi gösterebilsin diye mevcut kayıt döner.
      expect(ikinci.mevcutKayitId).toBeDefined();
      expect(await prisma.parkKaydi.count()).toBe(1);
    });

    it("engellenen mükerrer giriş denetim izine yazılır", async () => {
      await giris({ plaka: "34ABC123" });
      await giris({ plaka: "34ABC123" });

      const gunluk = await prisma.islemGunlugu.findFirst({
        where: { islemTipi: "GIRIS_BASARISIZ" },
      });
      expect(gunluk).not.toBeNull();
      expect(gunluk?.aciklama).toContain("mükerrer");
    });

    it("otopark doluyken yeni araç alınmaz", async () => {
      await prisma.ayar.update({ where: { id: 1 }, data: { toplamKapasite: 2 } });

      await giris({ plaka: "34ABC123" });
      await giris({ plaka: "06DEF456" });
      const ucuncu = await giris({ plaka: "35GHI789" });

      expect(ucuncu.hata).toContain("dolu");
      expect(await prisma.parkKaydi.count({ where: { durum: "ICERIDE" } })).toBe(2);
    });

    it("çıkan araç yer açar", async () => {
      await prisma.ayar.update({ where: { id: 1 }, data: { toplamKapasite: 1 } });

      const ilk = await giris({ plaka: "34ABC123" });
      expect((await giris({ plaka: "06DEF456" })).hata).toContain("dolu");

      saatiAyarla("10:00");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: ilk.yeniKayitId!, odemeYontemi: "NAKIT" }),
      );

      expect((await giris({ plaka: "06DEF456" })).basarili).toBe(true);
    });

    it("açık vardiya yokken giriş yapılamaz", async () => {
      await prisma.vardiya.update({ where: { id: vardiyaId }, data: { bitis: new Date() } });

      const sonuc = await giris({ plaka: "34ABC123" });
      expect(sonuc.hata).toContain("açık vardiya yok");
      expect(sonuc.vardiyaGerekli).toBe(true);
    });

    it("oturum yoksa giriş yapılamaz", async () => {
      oturumKapat();
      const sonuc = await giris({ plaka: "34ABC123" });
      expect(sonuc.hata).toContain("Oturumunuz sonlanmış");
    });

    it("pasifleştirilen kullanıcı işlem yapamaz", async () => {
      // Oturum çerezi hâlâ geçerli görünür; kontrol veritabanından yapılır.
      await prisma.kullanici.update({
        where: { id: temel.gorevli.id },
        data: { aktif: false },
      });

      const sonuc = await giris({ plaka: "34ABC123" });
      expect(sonuc.hata).toContain("Oturumunuz sonlanmış");
    });

    it("şifre oturumdan sonra değiştiyse işlem reddedilir", async () => {
      // Şifre, oturum açıldıktan SONRA değişmeli. Aynı saniyede değişirse
      // oturum geçerli kalır (kontrol kesin büyüktür) — bu doğru davranış:
      // kullanıcı kendi şifresini değiştirince kendi oturumu düşmemeli.
      saatiAyarla("09:30");
      await prisma.kullanici.update({
        where: { id: temel.gorevli.id },
        data: { sifreDegisimi: new Date() },
      });

      const sonuc = await giris({ plaka: "34ABC123" });
      expect(sonuc.hata).toContain("Oturumunuz sonlanmış");
    });
  });

  describe("giriş doğrulaması", () => {
    it("geçersiz plaka reddedilir", async () => {
      // W harfi Türk plakalarında kullanılmaz.
      const sonuc = await giris({ plaka: "34WWW123" });
      expect(sonuc.alanHatalari?.plaka).toBeDefined();
      expect(await prisma.parkKaydi.count()).toBe(0);
    });

    it("plakasız kayıtta marka ve model zorunludur", async () => {
      const sonuc = await giris({ marka: "Toyota" });
      expect(sonuc.alanHatalari?.model).toBeDefined();
    });

    it("plakasız araçlar birbirini engellemez", async () => {
      // Kısmi unique index NULL'ları çakıştırmaz — birden fazla plakasız
      // araç aynı anda içeride olabilir.
      await giris({ marka: "Toyota", model: "Corolla" });
      await giris({ marka: "Honda", model: "Civic" });

      expect(await prisma.parkKaydi.count({ where: { durum: "ICERIDE" } })).toBe(2);
    });

    it("ileri bir giriş saati kabul edilmez", async () => {
      const sonuc = await aracGirisiYap(
        BOS_DURUM,
        form({ plaka: "34ABC123", girisSaati: "23:00" }),
      );
      expect(sonuc.alanHatalari?.girisSaati).toContain("ileri");
    });

    it("geriye dönük giriş saati ücreti etkiler", async () => {
      // Görevli 09:00'da "bu araç 07:30'da gelmişti" diyor.
      const sonuc = await aracGirisiYap(
        BOS_DURUM,
        form({ plaka: "34ABC123", girisSaati: "07:30" }),
      );
      expect(sonuc.basarili).toBe(true);

      const kayit = await prisma.parkKaydi.findUniqueOrThrow({
        where: { id: sonuc.yeniKayitId! },
      });
      expect(kayit.girisZamani.toISOString()).toBe("2026-07-15T04:30:00.000Z");

      saatiAyarla("10:00");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: sonuc.yeniKayitId!, odemeYontemi: "NAKIT" }),
      );

      // 07:30 → 10:00 = 150 dk − 15 = 135 dk → 3 saat → 200 TL
      const cikan = await prisma.parkKaydi.findUniqueOrThrow({
        where: { id: sonuc.yeniKayitId! },
      });
      expect(sayiyaCevir(cikan.tahsilEdilenUcret)).toBe(200);
    });

    it("yabancı plaka Türk kalıbına zorlanmaz", async () => {
      const sonuc = await giris({
        plaka: "M AB 1234",
        yabanciPlaka: "on",
        ulkeKodu: "DE",
      });
      expect(sonuc.basarili).toBe(true);

      const kayit = await prisma.parkKaydi.findUniqueOrThrow({
        where: { id: sonuc.yeniKayitId! },
      });
      expect(kayit.yabanciPlaka).toBe(true);
      expect(kayit.ulkeKodu).toBe("DE");
    });

    it("araç bilgisi bir sonraki gelişte hatırlanır", async () => {
      await giris({ plaka: "34ABC123", marka: "Renault", model: "Clio", renk: "Kırmızı" });
      const ilk = await prisma.parkKaydi.findFirstOrThrow({ where: { plaka: "34ABC123" } });

      saatiAyarla("10:00");
      await aracCikisiYap(BOS_DURUM, form({ parkKaydiId: ilk.id, odemeYontemi: "NAKIT" }));

      saatiAyarla("11:00");
      await giris({ plaka: "34ABC123" });

      // Marka/model araç kaydında saklandığı için ikinci girişte sorulmadı.
      const arac = await prisma.arac.findUniqueOrThrow({ where: { plaka: "34ABC123" } });
      expect(arac.marka).toBe("Renault");
      expect(arac.renk).toBe("Kırmızı");
    });
  });

  // -------------------------------------------------------------------------
  // Çıkış
  // -------------------------------------------------------------------------

  describe("çıkış", () => {
    it("çıkmış araç ikinci kez çıkarılamaz", async () => {
      const giren = await giris({ plaka: "34ABC123" });
      saatiAyarla("10:00");

      const form1 = form({ parkKaydiId: giren.yeniKayitId!, odemeYontemi: "NAKIT" });
      const form2 = form({ parkKaydiId: giren.yeniKayitId!, odemeYontemi: "NAKIT" });

      expect((await aracCikisiYap(BOS_DURUM, form1)).basarili).toBe(true);
      expect((await aracCikisiYap(BOS_DURUM, form2)).hata).toContain("zaten çıkış yapmış");
    });

    it("iki görevli aynı anda çıkış verirse yalnızca biri başarılı olur", async () => {
      const giren = await giris({ plaka: "34ABC123" });
      saatiAyarla("10:00");

      // Gerçek yarış: iki istek paralel gider, koşullu updateMany hakem olur.
      const [a, b] = await Promise.all([
        aracCikisiYap(BOS_DURUM, form({ parkKaydiId: giren.yeniKayitId!, odemeYontemi: "NAKIT" })),
        aracCikisiYap(BOS_DURUM, form({ parkKaydiId: giren.yeniKayitId!, odemeYontemi: "NAKIT" })),
      ]);

      const basarili = [a, b].filter((s) => s.basarili).length;
      const basarisiz = [a, b].filter((s) => s.hata).length;
      expect(basarili).toBe(1);
      expect(basarisiz).toBe(1);

      // Para bir kez tahsil edilmiş olmalı.
      const cikislar = await prisma.parkKaydi.count({ where: { durum: "CIKTI" } });
      expect(cikislar).toBe(1);
      const gunluk = await prisma.islemGunlugu.count({ where: { islemTipi: "CIKIS" } });
      expect(gunluk).toBe(1);
    });

    it("aynı plaka aynı anda iki kez girilemez", async () => {
      const [a, b] = await Promise.all([
        giris({ plaka: "34ABC123" }),
        giris({ plaka: "34ABC123" }),
      ]);

      // Biri kısmi unique index'e takılır (P2002).
      expect([a, b].filter((s) => s.basarili).length).toBe(1);
      expect(await prisma.parkKaydi.count({ where: { durum: "ICERIDE" } })).toBe(1);
    });

    it("ücret düzeltmesi sebep olmadan reddedilir, kayıt değişmez", async () => {
      const giren = await giris({ plaka: "34ABC123" });
      saatiAyarla("10:00");

      const sonuc = await aracCikisiYap(
        BOS_DURUM,
        form({
          parkKaydiId: giren.yeniKayitId!,
          odemeYontemi: "NAKIT",
          duzeltilmisUcret: "0",
        }),
      );

      expect(sonuc.alanHatalari?.ucretDuzeltmeSebebi).toBeDefined();
      const kayit = await prisma.parkKaydi.findUniqueOrThrow({
        where: { id: giren.yeniKayitId! },
      });
      expect(kayit.durum).toBe("ICERIDE");
    });

    it("hesaplanan ücretle aynı tutar sebep istemez", async () => {
      const giren = await giris({ plaka: "34ABC123" });
      saatiAyarla("10:00");

      // 60 dk − 15 = 45 dk → 1 saat → 100 TL; görevli aynı tutarı yazıyor.
      const sonuc = await aracCikisiYap(
        BOS_DURUM,
        form({
          parkKaydiId: giren.yeniKayitId!,
          odemeYontemi: "NAKIT",
          duzeltilmisUcret: "100",
        }),
      );

      expect(sonuc.basarili).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Abonman
  // -------------------------------------------------------------------------

  describe("abonman", () => {
    async function abonmanliArac(bitis: Date) {
      const arac = await prisma.arac.create({
        data: { plaka: "34ABO001", plakaGosterim: "34 ABO 001" },
      });
      await prisma.abonman.create({
        data: {
          aracId: arac.id,
          musteriAdi: "Ali Abonman",
          baslangicTarihi: new Date("2026-07-01T00:00:00.000Z"),
          bitisTarihi: bitis,
          aylikUcret: 1500,
          durum: "AKTIF",
        },
      });
      return arac;
    }

    it("geçerli abonmanlı araçtan ücret alınmaz", async () => {
      await abonmanliArac(new Date("2026-08-01T00:00:00.000Z"));

      const giren = await giris({ plaka: "34ABO001" });
      const kayit = await prisma.parkKaydi.findUniqueOrThrow({
        where: { id: giren.yeniKayitId! },
      });
      expect(kayit.tarifeTuru).toBe("ABONMAN");

      saatiAyarla("14:00");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, odemeYontemi: "NAKIT" }),
      );

      const cikan = await prisma.parkKaydi.findUniqueOrThrow({
        where: { id: giren.yeniKayitId! },
      });
      // Çıkışın gerçekten yapıldığı önce doğrulanır: aksi hâlde başarısız bir
      // çıkışta alanlar boş kalır ve "ücret 0" beklentisi yanlış yere geçer.
      expect(cikan.durum).toBe("CIKTI");
      expect(sayiyaCevir(cikan.tahsilEdilenUcret)).toBe(0);
      expect(cikan.odemeYontemi).toBeNull();
    });

    it("araç içerideyken abonman dolarsa normal tarifeden ücretlendirilir", async () => {
      // Abonman 11:00'de bitiyor; araç 09:00'da giriyor, 12:00'de çıkıyor.
      await abonmanliArac(new Date("2026-07-15T08:00:00.000Z")); // 11:00 İstanbul

      const giren = await giris({ plaka: "34ABO001" });
      saatiAyarla("11:30");

      const sonuc = await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, odemeYontemi: "NAKIT" }),
      );
      expect(sonuc.uyari).toContain("Abonman süresi dolmuş");

      // 150 dk − 15 = 135 dk → 3 saat → 200 TL
      const cikan = await prisma.parkKaydi.findUniqueOrThrow({
        where: { id: giren.yeniKayitId! },
      });
      expect(sayiyaCevir(cikan.tahsilEdilenUcret)).toBe(200);
      expect(cikan.tarifeTuru).toBe("SAATLIK");
    });
  });

  // -------------------------------------------------------------------------
  // İptal ve düzenleme
  // -------------------------------------------------------------------------

  describe("kayıt iptali", () => {
    it("görevli kayıt iptal edemez", async () => {
      const giren = await giris({ plaka: "34ABC123" });

      const sonuc = await kaydiIptalEt(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, iptalSebebi: "Yanlış kayıt" }),
      );
      expect(sonuc.hata).toContain("yönetici");
    });

    it("yönetici iptal eder, kayıt silinmez", async () => {
      const giren = await giris({ plaka: "34ABC123" });
      oturumAc(temel.yonetici.id);

      const sonuc = await kaydiIptalEt(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, iptalSebebi: "Görevli yanlış plaka girdi" }),
      );
      expect(sonuc.basarili).toBe(true);

      // Soft delete: satır duruyor, durumu değişti.
      const kayit = await prisma.parkKaydi.findUniqueOrThrow({
        where: { id: giren.yeniKayitId! },
      });
      expect(kayit.durum).toBe("IPTAL");
      expect(kayit.iptalSebebi).toBe("Görevli yanlış plaka girdi");
      expect(kayit.iptalEdenId).toBe(temel.yonetici.id);
    });

    it("iptal sebebi zorunludur", async () => {
      const giren = await giris({ plaka: "34ABC123" });
      oturumAc(temel.yonetici.id);

      const sonuc = await kaydiIptalEt(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, iptalSebebi: "" }),
      );
      expect(sonuc.alanHatalari?.iptalSebebi).toBeDefined();
    });

    it("iptal edilen plaka tekrar girilebilir", async () => {
      const giren = await giris({ plaka: "34ABC123" });
      oturumAc(temel.yonetici.id);
      await kaydiIptalEt(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, iptalSebebi: "Yanlış plaka" }),
      );

      // Kısmi unique index yalnızca ICERIDE kayıtları kapsıyor.
      oturumAc(temel.gorevli.id);
      expect((await giris({ plaka: "34ABC123" })).basarili).toBe(true);
    });
  });

  describe("kayıt düzenleme", () => {
    it("plakasız kayda sonradan plaka eklenir", async () => {
      const giren = await giris({ marka: "Toyota", model: "Corolla" });

      const sonuc = await kaydiDuzenle(
        BOS_DURUM,
        form({
          parkKaydiId: giren.yeniKayitId!,
          plaka: "34ABC123",
          marka: "Toyota",
          model: "Corolla",
        }),
      );
      expect(sonuc.basarili).toBe(true);

      const kayit = await prisma.parkKaydi.findUniqueOrThrow({
        where: { id: giren.yeniKayitId! },
      });
      expect(kayit.plaka).toBe("34ABC123");
      // Araç kaydı da oluşturulup bağlanmalı.
      expect(kayit.aracId).not.toBeNull();
    });

    it("içeride olan bir plaka başka kayda eklenemez", async () => {
      await giris({ plaka: "34ABC123" });
      const plakasiz = await giris({ marka: "Honda", model: "Civic" });

      const sonuc = await kaydiDuzenle(
        BOS_DURUM,
        form({
          parkKaydiId: plakasiz.yeniKayitId!,
          plaka: "34ABC123",
          marka: "Honda",
          model: "Civic",
        }),
      );
      expect(sonuc.hata).toContain("zaten otoparkta");
    });

    it("giriş saati düzeltmesi eski/yeni değeriyle günlüğe yazılır", async () => {
      const giren = await giris({ plaka: "34ABC123" });

      await kaydiDuzenle(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, plaka: "34ABC123", girisSaati: "07:00" }),
      );

      const gunluk = await prisma.islemGunlugu.findFirstOrThrow({
        where: { islemTipi: "KAYIT_DUZENLEME" },
      });
      expect(gunluk.aciklama).toContain("ücreti etkiler");
      expect((gunluk.yeniDeger as { girisZamani: string }).girisZamani).toBe(
        "2026-07-15T04:00:00.000Z",
      );
    });

    it("çıkmış kayıt düzenlenemez", async () => {
      const giren = await giris({ plaka: "34ABC123" });
      saatiAyarla("10:00");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, odemeYontemi: "NAKIT" }),
      );

      const sonuc = await kaydiDuzenle(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, plaka: "34ABC123" }),
      );
      expect(sonuc.hata).toContain("içerideki araçlar");
    });
  });

  // -------------------------------------------------------------------------
  // Borç — ödemeden çıkan araçlar
  // -------------------------------------------------------------------------

  describe("borç", () => {
    /** 09:00 girip 10:00'da çıkan araç: 60 dk − 15 = 45 dk → 1 saat → 100 TL. */
    async function birSaatlikArac(plaka: string) {
      const giren = await giris({ plaka });
      saatiAyarla("10:00");
      return giren.yeniKayitId!;
    }

    it("kısmi tahsilatta kalan tutar borca yazılır", async () => {
      const kayitId = await birSaatlikArac("34ABC123");

      const sonuc = await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: kayitId, odemeYontemi: "NAKIT", alinanTutar: "40" }),
      );
      expect(sonuc.basarili).toBe(true);

      const kayit = await prisma.parkKaydi.findUniqueOrThrow({ where: { id: kayitId } });
      expect(sayiyaCevir(kayit.hesaplananUcret)).toBe(100);
      expect(sayiyaCevir(kayit.tahsilEdilenUcret)).toBe(40);
      expect(sayiyaCevir(kayit.borcTutari)).toBe(60);
      expect(sayiyaCevir(kayit.borcKalan)).toBe(60);
      // Para alındığı için ödeme yöntemi durur.
      expect(kayit.odemeYontemi).toBe("NAKIT");
    });

    it("hiç ödeme alınmazsa ücretin tamamı borç olur", async () => {
      const kayitId = await birSaatlikArac("34ABC123");

      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: kayitId, odemeYontemi: "NAKIT", alinanTutar: "0" }),
      );

      const kayit = await prisma.parkKaydi.findUniqueOrThrow({ where: { id: kayitId } });
      expect(sayiyaCevir(kayit.tahsilEdilenUcret)).toBe(0);
      expect(sayiyaCevir(kayit.borcKalan)).toBe(100);
      // Kasaya para girmediyse ödeme yöntemi yazılmaz — ücretsiz çıkışla
      // karıştırılmasın diye ayırt edici alan `borcTutari`.
      expect(kayit.odemeYontemi).toBeNull();
    });

    it("alınan tutar ödenecek tutardan fazla olamaz", async () => {
      const kayitId = await birSaatlikArac("34ABC123");

      const sonuc = await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: kayitId, odemeYontemi: "NAKIT", alinanTutar: "150" }),
      );
      expect(sonuc.alanHatalari?.alinanTutar).toBeDefined();
      expect(await prisma.parkKaydi.count({ where: { durum: "CIKTI" } })).toBe(0);
    });

    it("borçlu araç tekrar girdiğinde çıkış önizlemesi eski borcu gösterir", async () => {
      const ilkKayit = await birSaatlikArac("34ABC123");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: ilkKayit, odemeYontemi: "NAKIT", alinanTutar: "40" }),
      );

      saatiAyarla("12:00");
      const ikinci = await giris({ plaka: "34ABC123" });
      saatiAyarla("13:00");

      const onizleme = await cikisOnizle(ikinci.yeniKayitId!);
      expect(onizleme.eskiBorc?.toplam).toBe(60);
      expect(onizleme.eskiBorc?.kayitlar).toHaveLength(1);
      expect(onizleme.eskiBorc?.kayitlar[0].kalan).toBe(60);
    });

    it("sonraki çıkışta eski borç güncel ücretle birlikte tahsil edilir", async () => {
      const ilkKayit = await birSaatlikArac("34ABC123");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: ilkKayit, odemeYontemi: "NAKIT", alinanTutar: "40" }),
      );

      saatiAyarla("12:00");
      const ikinci = await giris({ plaka: "34ABC123" });
      saatiAyarla("13:00");
      const sonuc = await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: ikinci.yeniKayitId!, odemeYontemi: "NAKIT", borcTahsilati: "60" }),
      );
      expect(sonuc.basarili).toBe(true);

      // Eski kaydın bakiyesi kapandı; `borcTutari` denetim için yerinde durur.
      const eski = await prisma.parkKaydi.findUniqueOrThrow({ where: { id: ilkKayit } });
      expect(sayiyaCevir(eski.borcTutari)).toBe(60);
      expect(sayiyaCevir(eski.borcKalan)).toBe(0);

      // Tahsil edilen para, parayı alan çıkışın üstünde durur.
      const yeni = await prisma.parkKaydi.findUniqueOrThrow({
        where: { id: ikinci.yeniKayitId! },
      });
      expect(sayiyaCevir(yeni.tahsilEdilenUcret)).toBe(100);
      expect(sayiyaCevir(yeni.tahsilEdilenBorc)).toBe(60);
    });

    it("borçtan kısmi tahsilat yapılabilir", async () => {
      const ilkKayit = await birSaatlikArac("34ABC123");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: ilkKayit, odemeYontemi: "NAKIT", alinanTutar: "0" }),
      );

      saatiAyarla("12:00");
      const ikinci = await giris({ plaka: "34ABC123" });
      saatiAyarla("13:00");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: ikinci.yeniKayitId!, odemeYontemi: "NAKIT", borcTahsilati: "30" }),
      );

      const eski = await prisma.parkKaydi.findUniqueOrThrow({ where: { id: ilkKayit } });
      expect(sayiyaCevir(eski.borcKalan)).toBe(70);
    });

    it("birden fazla borç en eskisinden başlayarak kapatılır", async () => {
      // Birinci borç: 100 TL
      const ilk = await birSaatlikArac("34ABC123");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: ilk, odemeYontemi: "NAKIT", alinanTutar: "0" }),
      );

      // İkinci borç: yine 100 TL
      saatiAyarla("11:00");
      const ikinci = await giris({ plaka: "34ABC123" });
      saatiAyarla("12:00");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: ikinci.yeniKayitId!, odemeYontemi: "NAKIT", alinanTutar: "0" }),
      );

      // Üçüncü çıkışta 120 TL borç ödeniyor: ilk borç tamamen, ikincisi kısmen.
      saatiAyarla("13:00");
      const ucuncu = await giris({ plaka: "34ABC123" });
      saatiAyarla("14:00");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: ucuncu.yeniKayitId!, odemeYontemi: "NAKIT", borcTahsilati: "120" }),
      );

      expect(
        sayiyaCevir((await prisma.parkKaydi.findUniqueOrThrow({ where: { id: ilk } })).borcKalan),
      ).toBe(0);
      expect(
        sayiyaCevir(
          (await prisma.parkKaydi.findUniqueOrThrow({ where: { id: ikinci.yeniKayitId! } }))
            .borcKalan,
        ),
      ).toBe(80);
    });

    it("açık borçtan fazlası tahsil edilemez", async () => {
      const ilkKayit = await birSaatlikArac("34ABC123");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: ilkKayit, odemeYontemi: "NAKIT", alinanTutar: "40" }),
      );

      saatiAyarla("12:00");
      const ikinci = await giris({ plaka: "34ABC123" });
      saatiAyarla("13:00");
      const sonuc = await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: ikinci.yeniKayitId!, odemeYontemi: "NAKIT", borcTahsilati: "100" }),
      );

      expect(sonuc.alanHatalari?.borcTahsilati).toContain("60");
      // Hiçbir şey yazılmamalı: araç hâlâ içeride.
      const kayit = await prisma.parkKaydi.findUniqueOrThrow({
        where: { id: ikinci.yeniKayitId! },
      });
      expect(kayit.durum).toBe("ICERIDE");
    });

    it("borç tahsilatı denetim izine ayrı satır olarak yazılır", async () => {
      const ilkKayit = await birSaatlikArac("34ABC123");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: ilkKayit, odemeYontemi: "NAKIT", alinanTutar: "40" }),
      );

      saatiAyarla("12:00");
      const ikinci = await giris({ plaka: "34ABC123" });
      saatiAyarla("13:00");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: ikinci.yeniKayitId!, odemeYontemi: "NAKIT", borcTahsilati: "60" }),
      );

      const gunluk = await prisma.islemGunlugu.findFirstOrThrow({
        where: { islemTipi: "BORC_TAHSILATI" },
      });
      expect(gunluk.aciklama).toContain("60");
    });

    it("borçlu çıkış kasaya girmez, borç tahsilatı girer", async () => {
      const ilkKayit = await birSaatlikArac("34ABC123");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: ilkKayit, odemeYontemi: "NAKIT", alinanTutar: "40" }),
      );

      saatiAyarla("12:00");
      const ikinci = await giris({ plaka: "34ABC123" });
      saatiAyarla("13:00");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: ikinci.yeniKayitId!, odemeYontemi: "NAKIT", borcTahsilati: "60" }),
      );

      const ozet = await vardiyaOzetiHesapla(vardiyaId);
      // 40 (kısmi) + 100 (ikinci park) + 60 (eski borç) = 200
      expect(ozet.toplamNakit).toBe(200);
      expect(ozet.olusanBorc).toBe(60);
      expect(ozet.tahsilEdilenBorc).toBe(60);
      expect(ozet.borcluCikisSayisi).toBe(1);
      // Borçlu çıkış "ücretsiz çıkış" sayılmamalı.
      expect(ozet.ucretsizCikisSayisi).toBe(0);
    });

    it("iptal edilen kaydın borcu silinir", async () => {
      const kayitId = await birSaatlikArac("34ABC123");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: kayitId, odemeYontemi: "NAKIT", alinanTutar: "0" }),
      );

      oturumAc(temel.yonetici.id);
      const sonuc = await kaydiIptalEt(
        BOS_DURUM,
        form({ parkKaydiId: kayitId, iptalSebebi: "Görevli yanlış tutar girdi" }),
      );
      expect(sonuc.basarili).toBe(true);

      const kayit = await prisma.parkKaydi.findUniqueOrThrow({ where: { id: kayitId } });
      expect(sayiyaCevir(kayit.borcKalan)).toBe(0);
      // Denetim izi için asıl borç tutarı korunur.
      expect(sayiyaCevir(kayit.borcTutari)).toBe(100);
    });

    it("iptal edilen borç sonraki çıkışta görünmez", async () => {
      const kayitId = await birSaatlikArac("34ABC123");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: kayitId, odemeYontemi: "NAKIT", alinanTutar: "0" }),
      );

      oturumAc(temel.yonetici.id);
      await kaydiIptalEt(
        BOS_DURUM,
        form({ parkKaydiId: kayitId, iptalSebebi: "Görevli yanlış tutar girdi" }),
      );
      oturumAc(temel.gorevli.id);

      saatiAyarla("12:00");
      const ikinci = await giris({ plaka: "34ABC123" });
      saatiAyarla("13:00");

      const onizleme = await cikisOnizle(ikinci.yeniKayitId!);
      expect(onizleme.eskiBorc?.toplam).toBe(0);
    });

    it("düzeltilmiş ücretin üstünden borç hesaplanır", async () => {
      const kayitId = await birSaatlikArac("34ABC123");

      await aracCikisiYap(
        BOS_DURUM,
        form({
          parkKaydiId: kayitId,
          odemeYontemi: "NAKIT",
          duzeltilmisUcret: "80",
          ucretDuzeltmeSebebi: "Bariyer arızası nedeniyle indirim",
          alinanTutar: "50",
        }),
      );

      const kayit = await prisma.parkKaydi.findUniqueOrThrow({ where: { id: kayitId } });
      expect(sayiyaCevir(kayit.hesaplananUcret)).toBe(100);
      expect(sayiyaCevir(kayit.tahsilEdilenUcret)).toBe(50);
      // İskonto 20 TL, borç 30 TL — ikisi ayrı kalemler.
      expect(sayiyaCevir(kayit.borcKalan)).toBe(30);
    });
  });

  // -------------------------------------------------------------------------
  // Araç sınıfı — binek / büyük araç tarifesi
  // -------------------------------------------------------------------------

  describe("araç sınıfı", () => {
    it("büyük araç kendi tarifesinden ücretlendirilir", async () => {
      const giren = await giris({ plaka: "34ABC123", aracSinifi: "BUYUK" });
      saatiAyarla("10:00");

      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, odemeYontemi: "NAKIT" }),
      );

      // 60 dk − 15 = 45 dk → 1 saat → büyük araç ilk saati 150 TL.
      const kayit = await prisma.parkKaydi.findUniqueOrThrow({
        where: { id: giren.yeniKayitId! },
      });
      expect(kayit.aracSinifi).toBe("BUYUK");
      expect(kayit.tarifeId).toBe(temel.buyukTarife.id);
      expect(sayiyaCevir(kayit.tahsilEdilenUcret)).toBe(150);
    });

    it("sonraki saatler büyük araçta 100 TL artar", async () => {
      const giren = await giris({ plaka: "34ABC123", aracSinifi: "BUYUK" });
      saatiAyarla("12:00");

      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, odemeYontemi: "NAKIT" }),
      );

      // 180 dk − 15 = 165 dk → 3 saat → 150 + 2 × 100 = 350 TL.
      const kayit = await prisma.parkKaydi.findUniqueOrThrow({
        where: { id: giren.yeniKayitId! },
      });
      expect(sayiyaCevir(kayit.tahsilEdilenUcret)).toBe(350);
    });

    it("sınıf belirtilmezse binek tarifesi uygulanır", async () => {
      const giren = await giris({ plaka: "34ABC123" });
      saatiAyarla("10:00");

      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, odemeYontemi: "NAKIT" }),
      );

      const kayit = await prisma.parkKaydi.findUniqueOrThrow({
        where: { id: giren.yeniKayitId! },
      });
      expect(kayit.aracSinifi).toBe("BINEK");
      expect(kayit.tarifeId).toBe(temel.tarife.id);
      expect(sayiyaCevir(kayit.tahsilEdilenUcret)).toBe(100);
    });

    it("sınıf araçta hatırlanır, ikinci gelişte otomatik gelir", async () => {
      const ilk = await giris({ plaka: "34ABC123", aracSinifi: "BUYUK" });
      saatiAyarla("10:00");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: ilk.yeniKayitId!, odemeYontemi: "NAKIT" }),
      );

      const arac = await prisma.arac.findUniqueOrThrow({ where: { plaka: "34ABC123" } });
      expect(arac.aracSinifi).toBe("BUYUK");
    });

    it("plakasız kayıt da büyük araç olarak alınabilir", async () => {
      const giren = await giris({ marka: "Ford", model: "Ranger", aracSinifi: "BUYUK" });
      saatiAyarla("10:00");

      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, odemeYontemi: "NAKIT" }),
      );

      const kayit = await prisma.parkKaydi.findUniqueOrThrow({
        where: { id: giren.yeniKayitId! },
      });
      expect(sayiyaCevir(kayit.tahsilEdilenUcret)).toBe(150);
    });

    it("düzenlemede sınıf değişirse tarife de değişir", async () => {
      const giren = await giris({ plaka: "34ABC123" });

      const sonuc = await kaydiDuzenle(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, plaka: "34ABC123", aracSinifi: "BUYUK" }),
      );
      expect(sonuc.basarili).toBe(true);

      const kayit = await prisma.parkKaydi.findUniqueOrThrow({
        where: { id: giren.yeniKayitId! },
      });
      expect(kayit.aracSinifi).toBe("BUYUK");
      // Asıl mesele bu: sınıf işaretlenip tarife eskisinde kalırsa araç
      // "büyük" görünür ama binek fiyatından ücretlendirilirdi.
      expect(kayit.tarifeId).toBe(temel.buyukTarife.id);

      saatiAyarla("10:00");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, odemeYontemi: "NAKIT" }),
      );
      const cikan = await prisma.parkKaydi.findUniqueOrThrow({
        where: { id: giren.yeniKayitId! },
      });
      expect(sayiyaCevir(cikan.tahsilEdilenUcret)).toBe(150);
    });

    it("sınıf değişikliği denetim izine yazılır", async () => {
      const giren = await giris({ plaka: "34ABC123" });

      await kaydiDuzenle(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, plaka: "34ABC123", aracSinifi: "BUYUK" }),
      );

      const gunluk = await prisma.islemGunlugu.findFirstOrThrow({
        where: { islemTipi: "KAYIT_DUZENLEME" },
      });
      expect(gunluk.aciklama).toContain("araç sınıfı");
      expect((gunluk.eskiDeger as { aracSinifi: string }).aracSinifi).toBe("BINEK");
      expect((gunluk.yeniDeger as { aracSinifi: string }).aracSinifi).toBe("BUYUK");
    });

    it("çıkmış kayıt eski tarifesiyle kalır, yeni tarife etkilemez", async () => {
      const giren = await giris({ plaka: "34ABC123", aracSinifi: "BUYUK" });
      saatiAyarla("10:00");
      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, odemeYontemi: "NAKIT" }),
      );

      // Büyük araç tarifesi zamlanıyor; çıkmış kayıt etkilenmemeli.
      await prisma.tarife.update({
        where: { id: temel.buyukTarife.id },
        data: { aktif: false },
      });
      await prisma.tarife.create({
        data: {
          ad: "Büyük Araç — zamlı",
          aracSinifi: "BUYUK",
          ilkUcretsizDakika: 15,
          ilkSaatUcreti: 200,
          saatlikUcret: 150,
          gunlukTavanUcret: 0,
          aktif: true,
          gecerlilikBaslangic: new Date("2020-01-01T00:00:00.000Z"),
        },
      });

      const kayit = await prisma.parkKaydi.findUniqueOrThrow({
        where: { id: giren.yeniKayitId! },
      });
      expect(sayiyaCevir(kayit.tahsilEdilenUcret)).toBe(150);
      expect(kayit.tarifeId).toBe(temel.buyukTarife.id);
    });

    it("sınıfın aktif tarifesi yoksa o sınıftan giriş yapılamaz", async () => {
      await prisma.tarife.update({
        where: { id: temel.buyukTarife.id },
        data: { aktif: false },
      });

      const sonuc = await giris({ plaka: "34ABC123", aracSinifi: "BUYUK" });
      expect(sonuc.hata).toContain("tarife yok");
      expect(await prisma.parkKaydi.count()).toBe(0);

      // Binek girişi etkilenmemeli.
      expect((await giris({ plaka: "06DEF456" })).basarili).toBe(true);
    });

    it("büyük araç borcu kendi tarifesinden hesaplanır", async () => {
      const giren = await giris({ plaka: "34ABC123", aracSinifi: "BUYUK" });
      saatiAyarla("10:00");

      await aracCikisiYap(
        BOS_DURUM,
        form({ parkKaydiId: giren.yeniKayitId!, odemeYontemi: "NAKIT", alinanTutar: "50" }),
      );

      const kayit = await prisma.parkKaydi.findUniqueOrThrow({
        where: { id: giren.yeniKayitId! },
      });
      expect(sayiyaCevir(kayit.borcKalan)).toBe(100);
    });
  });
});
