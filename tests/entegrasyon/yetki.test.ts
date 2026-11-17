import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { ayarlariKaydet, kullaniciKaydet, parkAlaniKaydet, tarifeKaydet } from "@/actions/ayarlar";
import { kaydiIptalEt } from "@/actions/park";
import { gelisSaatiniDuzelt } from "@/actions/personel";
import { cikisYap } from "@/actions/kimlik";

import {
  BOS_DURUM,
  form,
  oturumAc,
  oturumKapat,
  temelVeriyiKur,
  veritabaniniTemizle,
  type TemelVeri,
} from "./yardimcilar";

/**
 * Yönetici yetkisi gerektiren işlemler, Server Action olarak doğrudan
 * çağrılabilir (arayüzde buton görünmese de). Middleware bunları korumaz;
 * tek savunma işlemin kendi içindeki kontroldür. Bu dosya o kontrolün her
 * yönetici işleminde gerçekten çalıştığını sınar.
 */

const YONETICI_ISLEMLERI = {
  ayarlariKaydet: () => ayarlariKaydet(BOS_DURUM, form({})),
  tarifeKaydet: () => tarifeKaydet(BOS_DURUM, form({})),
  parkAlaniKaydet: () => parkAlaniKaydet(BOS_DURUM, form({})),
  kullaniciKaydet: () => kullaniciKaydet(BOS_DURUM, form({})),
  kaydiIptalEt: () => kaydiIptalEt(BOS_DURUM, form({})),
  gelisSaatiniDuzelt: () => gelisSaatiniDuzelt(BOS_DURUM, form({})),
};

describe("yönetici yetkisi", () => {
  let veri: TemelVeri;

  beforeEach(async () => {
    await veritabaniniTemizle();
    veri = await temelVeriyiKur();
    oturumKapat();
  });

  describe.each(Object.entries(YONETICI_ISLEMLERI))("%s", (_ad, islem) => {
    it("oturumsuz reddedilir", async () => {
      expect(await islem()).toMatchObject({ hata: expect.stringMatching(/oturum/i) });
    });

    it("görevliye reddedilir", async () => {
      await oturumAc(veri.gorevli.id);
      expect(await islem()).toMatchObject({ hata: expect.stringMatching(/yönetici/i) });
    });
  });

  it("görevli kendini yönetici yapamaz", async () => {
    await oturumAc(veri.gorevli.id);
    const sonuc = await kullaniciKaydet(
      BOS_DURUM,
      form({
        kullaniciId: veri.gorevli.id,
        adSoyad: veri.gorevli.adSoyad,
        email: veri.gorevli.email,
        rol: "ADMIN",
        aktif: true,
      }),
    );

    expect(sonuc.hata).toMatch(/yönetici/i);
    const sonra = await prisma.kullanici.findUniqueOrThrow({ where: { id: veri.gorevli.id } });
    expect(sonra.rol).toBe("GOREVLI");
  });

  it("görevli yeni yönetici hesabı açamaz", async () => {
    await oturumAc(veri.gorevli.id);
    const sonuc = await kullaniciKaydet(
      BOS_DURUM,
      form({ adSoyad: "Sızma Hesabı", email: "sizma@otopark.test", rol: "ADMIN", aktif: true, sifre: "GucluSifre2026x" }),
    );

    expect(sonuc.hata).toMatch(/yönetici/i);
    expect(await prisma.kullanici.count({ where: { email: "sizma@otopark.test" } })).toBe(0);
  });

  it("yönetici aynı işlemi yapabilir (testin boşa geçmediğinin kanıtı)", async () => {
    await oturumAc(veri.yonetici.id);
    const sonuc = await kullaniciKaydet(
      BOS_DURUM,
      form({
        kullaniciId: veri.gorevli.id,
        adSoyad: veri.gorevli.adSoyad,
        email: veri.gorevli.email,
        rol: "ADMIN",
        aktif: true,
      }),
    );

    expect(sonuc.basarili).toBe(true);
    const sonra = await prisma.kullanici.findUniqueOrThrow({ where: { id: veri.gorevli.id } });
    expect(sonra.rol).toBe("ADMIN");
  });

  it("pasifleştirilen yöneticinin açık oturumu yetkisini kaybeder", async () => {
    await oturumAc(veri.yonetici.id);
    await prisma.kullanici.update({ where: { id: veri.yonetici.id }, data: { aktif: false } });

    expect(await ayarlariKaydet(BOS_DURUM, form({}))).toMatchObject({ hata: expect.stringMatching(/oturum/i) });
  });

  it("şifresi değiştirilen kullanıcının eski oturumu düşer, yeni oturumu çalışır", async () => {
    await oturumAc(veri.gorevli.id);
    const eskiOturum = globalThis.__testOturumu;

    await oturumAc(veri.yonetici.id);
    const sonuc = await kullaniciKaydet(
      BOS_DURUM,
      form({
        kullaniciId: veri.gorevli.id,
        adSoyad: veri.gorevli.adSoyad,
        email: veri.gorevli.email,
        rol: "GOREVLI",
        aktif: "true",
        sifre: "YeniSifre2026x",
      }),
    );
    expect(sonuc).toMatchObject({ basarili: true });

    globalThis.__testOturumu = eskiOturum;
    expect(await kaydiIptalEt(BOS_DURUM, form({}))).toMatchObject({ hata: expect.stringMatching(/oturum/i) });

    await oturumAc(veri.gorevli.id);
    expect(await kaydiIptalEt(BOS_DURUM, form({}))).not.toMatchObject({
      hata: expect.stringMatching(/oturum/i),
    });
  });

  it("çıkış yapılan oturumun kopyası da geçersiz olur", async () => {
    // Çerez çalınmış/kopyalanmış olsun: kullanıcı çıkış yapınca o kopya da düşmeli.
    await oturumAc(veri.yonetici.id);
    const kopya = globalThis.__testOturumu;

    await cikisYap();

    globalThis.__testOturumu = kopya;
    expect(await ayarlariKaydet(BOS_DURUM, form({}))).toMatchObject({ hata: expect.stringMatching(/oturum/i) });
  });

  it("pasifleştirilip yeniden açılan hesabın eski oturumu geri canlanmaz", async () => {
    await oturumAc(veri.gorevli.id);
    const eskiOturum = globalThis.__testOturumu;

    await oturumAc(veri.yonetici.id);
    const temel = {
      kullaniciId: veri.gorevli.id,
      adSoyad: veri.gorevli.adSoyad,
      email: veri.gorevli.email,
      rol: "GOREVLI",
    };
    await kullaniciKaydet(BOS_DURUM, form({ ...temel }));
    await kullaniciKaydet(BOS_DURUM, form({ ...temel, aktif: "true" }));

    globalThis.__testOturumu = eskiOturum;
    expect(await kaydiIptalEt(BOS_DURUM, form({}))).toMatchObject({ hata: expect.stringMatching(/oturum/i) });
  });

  it("yetkisi düşürülen yönetici, oturumu açık olsa da yönetici işlemi yapamaz", async () => {
    await oturumAc(veri.yonetici.id);
    await prisma.kullanici.update({ where: { id: veri.yonetici.id }, data: { rol: "GOREVLI" } });

    expect(await ayarlariKaydet(BOS_DURUM, form({}))).toMatchObject({ hata: expect.stringMatching(/yönetici/i) });
  });
});
