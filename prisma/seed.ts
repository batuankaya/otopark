/**
 * Seed script — geliştirme ve demo verisi.
 *
 * Oluşturur:
 *   - 2 kullanıcı (1 ADMIN, 1 GOREVLI)
 *   - 1 tarife (ilk saat + artan saat) ve genel ayarlar
 *   - 30 örnek park kaydı (çıkmış / içeride / iptal karışık)
 *   - Kapanmış vardiyalar ve kasa devirleri
 *
 * Değerler `prisma/seed-config.ts` dosyasından okunur.
 *
 * Çalıştırmak için:  npx prisma db seed
 * (veya sıfırdan:    npx prisma migrate reset)
 */

import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

import { MARKALAR as KATALOG } from "../src/lib/araclar";
import { hesaplaUcret } from "../src/lib/ucret";
import {
  kullanicilar,
  ornekParkKaydiSayisi,
  otoparkBilgisi,
  varsayilanTarife,
} from "./seed-config";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

/** Tekrarlanabilir sonuç için sabit tohumlu basit rastgele üretici. */
let tohum = 20260727;
function rastgele(): number {
  tohum = (tohum * 1664525 + 1013904223) % 4294967296;
  return tohum / 4294967296;
}

const rastgeleTamsayi = (enAz: number, enCok: number) =>
  enAz + Math.floor(rastgele() * (enCok - enAz + 1));

const rastgeleSec = <T>(liste: readonly T[]): T => liste[rastgeleTamsayi(0, liste.length - 1)];

const PLAKA_HARFLERI = "ABCDEFGHIJKLMNOPRSTUVYZ"; // Q, W, X yok
const IL_KODLARI = ["26", "34", "06", "35", "16", "42", "01", "07", "43", "38"];

/** Geçerli bir Türk plakası üretir. */
function plakaUret(kullanilan: Set<string>): string {
  for (let deneme = 0; deneme < 500; deneme++) {
    const il = rastgeleSec(IL_KODLARI);
    const harfSayisi = rastgeleTamsayi(1, 3);
    let harfler = "";
    for (let i = 0; i < harfSayisi; i++) {
      harfler += PLAKA_HARFLERI[rastgeleTamsayi(0, PLAKA_HARFLERI.length - 1)];
    }
    const rakamSayisi = 5 - harfSayisi; // 1 harf→4, 2 harf→3, 3 harf→2 rakam
    const enAz = 10 ** (rakamSayisi - 1);
    const rakamlar = String(rastgeleTamsayi(enAz, 10 ** rakamSayisi - 1));
    const plaka = `${il}${harfler}${rakamlar}`;
    if (!kullanilan.has(plaka)) {
      kullanilan.add(plaka);
      return plaka;
    }
  }
  throw new Error("Benzersiz plaka üretilemedi.");
}

// Marka/model listesi uygulamayla ortak: src/lib/araclar.ts
// (Modeli olmayan "Diğer" markası örnek veride kullanılmaz.)
const MARKALAR = KATALOG.filter((m) => m.modeller.length > 0);
const RENKLER = ["Beyaz", "Siyah", "Gri", "Kırmızı", "Mavi", "Lacivert", "Gümüş"];

const gunler = (sayi: number) => sayi * 24 * 60 * 60 * 1000;
const dakikalar = (sayi: number) => sayi * 60 * 1000;

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log("Seed başlıyor…\n");

  // --- Temizlik (bağımlılık sırasına göre) --------------------------------
  await prisma.islemGunlugu.deleteMany();
  await prisma.gider.deleteMany();
  await prisma.parkKaydi.deleteMany();
  await prisma.abonman.deleteMany();
  await prisma.vardiya.deleteMany();
  await prisma.arac.deleteMany();
  await prisma.parkAlani.deleteMany();
  await prisma.tarife.deleteMany();
  await prisma.kullanici.deleteMany();
  await prisma.ayar.deleteMany();

  // --- Ayarlar -------------------------------------------------------------
  await prisma.ayar.create({
    data: { id: 1, ...otoparkBilgisi },
  });
  console.log(`✓ Ayarlar (kapasite: ${otoparkBilgisi.toplamKapasite})`);

  // --- Tarife --------------------------------------------------------------
  const tarife = await prisma.tarife.create({
    data: {
      ad: varsayilanTarife.ad,
      ilkUcretsizDakika: varsayilanTarife.ilkUcretsizDakika,
      ilkSaatUcreti: varsayilanTarife.ilkSaatUcreti,
      saatlikUcret: varsayilanTarife.saatlikUcret,
      gunlukTavanUcret: varsayilanTarife.gunlukTavanUcret,
      aktif: true,
    },
  });
  console.log(
    `✓ Tarife: ${tarife.ad} — ilk ${varsayilanTarife.ilkUcretsizDakika} dk ücretsiz, ` +
      `ilk saat ${varsayilanTarife.ilkSaatUcreti} TL, sonraki her saat +${varsayilanTarife.saatlikUcret} TL` +
      (varsayilanTarife.gunlukTavanUcret > 0
        ? `, günlük tavan ${varsayilanTarife.gunlukTavanUcret} TL`
        : ", üst sınır yok (saf saatlik)"),
  );

  // Park alanı (blok) kullanılmıyor — otopark tek alan olarak işletiliyor.

  // --- Kullanıcılar --------------------------------------------------------
  const adminSifre = process.env[kullanicilar.admin.sifreEnv] ?? kullanicilar.admin.varsayilanSifre;
  const gorevliSifre =
    process.env[kullanicilar.gorevli.sifreEnv] ?? kullanicilar.gorevli.varsayilanSifre;

  const admin = await prisma.kullanici.create({
    data: {
      adSoyad: kullanicilar.admin.adSoyad,
      email: kullanicilar.admin.email,
      sifreHash: await bcrypt.hash(adminSifre, 12),
      rol: "ADMIN",
    },
  });

  const gorevli = await prisma.kullanici.create({
    data: {
      adSoyad: kullanicilar.gorevli.adSoyad,
      email: kullanicilar.gorevli.email,
      sifreHash: await bcrypt.hash(gorevliSifre, 12),
      rol: "GOREVLI",
    },
  });
  console.log(`✓ 2 kullanıcı: ${admin.email} (ADMIN), ${gorevli.email} (GOREVLI)`);

  // --- Araçlar -------------------------------------------------------------
  const kullanilanPlakalar = new Set<string>();
  const aracSayisi = ornekParkKaydiSayisi + 6; // bazı araçlar birden fazla kez gelsin

  const araclar = [];
  for (let i = 0; i < aracSayisi; i++) {
    const secim = rastgeleSec(MARKALAR);
    araclar.push(
      await prisma.arac.create({
        data: {
          plaka: plakaUret(kullanilanPlakalar),
          marka: secim.ad,
          model: rastgeleSec(secim.modeller),
          renk: rastgeleSec(RENKLER),
        },
      }),
    );
  }
  console.log(`✓ ${araclar.length} araç`);

  const simdi = new Date();

  // --- Abonmanlar ---------------------------------------------------------
  // Otopark saatlik çalışıyor; abonman ekranları kapalı olduğu için örnek
  // abonman üretilmiyor. Veri modeli duruyor (bkz. src/app/(app)/_abonman-kapali).
  const abonmanlar: { id: string; aracId: string; bitisTarihi: Date }[] = [];

  // --- Vardiyalar ----------------------------------------------------------
  // Son 6 gün için kapanmış vardiyalar. Açık vardiya bırakılmaz; kullanıcı
  // uygulamaya girince kendi vardiyasını açar.
  const vardiyalar = [];
  for (let gun = 6; gun >= 1; gun--) {
    const baslangic = new Date(simdi.getTime() - gunler(gun) - dakikalar(rastgeleTamsayi(0, 120)));
    const bitis = new Date(baslangic.getTime() + dakikalar(rastgeleTamsayi(480, 600)));
    vardiyalar.push(
      await prisma.vardiya.create({
        data: {
          kullaniciId: gun % 2 === 0 ? gorevli.id : admin.id,
          baslangic,
          bitis,
          acilisKasa: 500,
          notlar: null,
        },
      }),
    );
  }
  console.log(`✓ ${vardiyalar.length} kapanmış vardiya`);

  // --- Park kayıtları ------------------------------------------------------
  const ucretTarifesi = {
    ilkUcretsizDakika: varsayilanTarife.ilkUcretsizDakika,
    ilkSaatUcreti: varsayilanTarife.ilkSaatUcreti,
    saatlikUcret: varsayilanTarife.saatlikUcret,
    gunlukTavanUcret: varsayilanTarife.gunlukTavanUcret,
  };

  let cikan = 0;
  let iceride = 0;
  let iptal = 0;

  for (let i = 0; i < ornekParkKaydiSayisi; i++) {
    const arac = araclar[i];
    const abonman = abonmanlar.find((a) => a.aracId === arac.id);
    const vardiya = rastgeleSec(vardiyalar);

    // Kayıtların dağılımı: 6 içeride, 2 iptal, kalanı çıkmış
    const durum: "ICERIDE" | "CIKTI" | "IPTAL" =
      i < 6 ? "ICERIDE" : i < 8 ? "IPTAL" : "CIKTI";

    const girisZamani =
      durum === "ICERIDE"
        ? // İçeridekilerden biri 24 saati aşsın ki liste işaretlemesi görünsün
          new Date(simdi.getTime() - (i === 0 ? dakikalar(1830) : dakikalar(rastgeleTamsayi(20, 700))))
        : new Date(simdi.getTime() - gunler(rastgeleTamsayi(1, 6)) - dakikalar(rastgeleTamsayi(0, 600)));

    const tarifeTuru = "SAATLIK" as const;

    const veri: Prisma.ParkKaydiUncheckedCreateInput = {
      aracId: arac.id,
      plaka: arac.plaka,
      girisZamani,
      girisYapanId: rastgele() < 0.5 ? gorevli.id : admin.id,
      tarifeId: tarife.id,
      tarifeTuru,
      durum,
      abonmanId: abonman?.id ?? null,
      vardiyaId: vardiya.id,
    };

    if (durum === "CIKTI") {
      const parkDakikasi = rastgeleTamsayi(20, 1900);
      const cikisZamani = new Date(girisZamani.getTime() + dakikalar(parkDakikasi));
      const abonmanGecerli = abonman ? abonman.bitisTarihi > cikisZamani : false;

      const sonuc = hesaplaUcret({
        girisZamani,
        cikisZamani,
        tarife: ucretTarifesi,
        tarifeTuru,
        abonmanGecerli,
      });

      veri.cikisZamani = cikisZamani;
      veri.cikisYapanId = rastgele() < 0.5 ? gorevli.id : admin.id;
      veri.cikisVardiyaId = vardiya.id;
      veri.hesaplananUcret = sonuc.ucret;
      veri.tahsilEdilenUcret = sonuc.ucret;
      veri.tarifeTuru = sonuc.uygulananTarifeTuru;
      veri.odemeYontemi = sonuc.ucret === 0 ? null : rastgele() < 0.65 ? "NAKIT" : "KART";
      cikan++;
    } else if (durum === "IPTAL") {
      veri.iptalSebebi = rastgeleSec([
        "Yanlış plaka girildi, kayıt tekrar oluşturuldu.",
        "Müşteri araç park etmeden ayrıldı.",
      ]);
      veri.iptalEdenId = admin.id;
      veri.iptalZamani = new Date(girisZamani.getTime() + dakikalar(rastgeleTamsayi(2, 20)));
      iptal++;
    } else {
      iceride++;
    }

    const kayit = await prisma.parkKaydi.create({ data: veri });

    // İşlem günlüğü — gerçekçi denetim izi
    await prisma.islemGunlugu.create({
      data: {
        kullaniciId: veri.girisYapanId,
        zaman: girisZamani,
        islemTipi: "GIRIS",
        ilgiliKayitId: kayit.id,
        aciklama: `${arac.plaka} girişi`,
      },
    });

    if (durum === "CIKTI") {
      await prisma.islemGunlugu.create({
        data: {
          kullaniciId: veri.cikisYapanId as string,
          zaman: veri.cikisZamani as Date,
          islemTipi: "CIKIS",
          ilgiliKayitId: kayit.id,
          aciklama: `${arac.plaka} çıkışı — ${veri.tahsilEdilenUcret} TL`,
        },
      });
    } else if (durum === "IPTAL") {
      await prisma.islemGunlugu.create({
        data: {
          kullaniciId: admin.id,
          zaman: veri.iptalZamani as Date,
          islemTipi: "IPTAL",
          ilgiliKayitId: kayit.id,
          aciklama: veri.iptalSebebi as string,
        },
      });
    }
  }

  console.log(
    `✓ ${ornekParkKaydiSayisi} park kaydı (${cikan} çıkmış, ${iceride} içeride, ${iptal} iptal)`,
  );

  // --- Vardiya kasa özetlerini gerçek tahsilatlardan hesapla ---------------
  for (const vardiya of vardiyalar) {
    const tahsilatlar = await prisma.parkKaydi.groupBy({
      by: ["odemeYontemi"],
      where: { cikisVardiyaId: vardiya.id, durum: "CIKTI" },
      _sum: { tahsilEdilenUcret: true },
    });

    const topla = (yontem: "NAKIT" | "KART") =>
      Number(tahsilatlar.find((t) => t.odemeYontemi === yontem)?._sum.tahsilEdilenUcret ?? 0);

    const toplamNakit = topla("NAKIT");
    const toplamKart = topla("KART");
    const acilis = Number(vardiya.acilisKasa);
    // Gerçekçi olsun diye bazı vardiyalarda küçük kasa farkı bırakılır.
    const fark = rastgele() < 0.3 ? rastgeleTamsayi(-20, 20) : 0;

    await prisma.vardiya.update({
      where: { id: vardiya.id },
      data: {
        toplamNakit,
        toplamKart,
        kapanisKasa: acilis + toplamNakit + fark,
        fark,
      },
    });

    await prisma.islemGunlugu.create({
      data: {
        kullaniciId: vardiya.kullaniciId,
        zaman: vardiya.bitis as Date,
        islemTipi: "VARDIYA_KAPANIS",
        ilgiliKayitId: vardiya.id,
        aciklama: `Vardiya kapatıldı — nakit ${toplamNakit} TL, kart ${toplamKart} TL, fark ${fark} TL`,
      },
    });
  }
  console.log("✓ Vardiya kasa özetleri hesaplandı");

  // --- Giderler -----------------------------------------------------------
  // Gerçekçi gün sonu tablosu için her vardiyaya birkaç gider.
  const GIDER_ORNEKLERI = [
    { kategori: "YEMEK" as const, aciklama: "Öğle yemeği", enAz: 150, enCok: 400 },
    { kategori: "CAY" as const, aciklama: "Çaycıya verilen", enAz: 50, enCok: 150 },
    { kategori: "TEMIZLIK" as const, aciklama: "Temizlik malzemesi", enAz: 80, enCok: 250 },
    { kategori: "KIRTASIYE" as const, aciklama: "Fiş rulosu", enAz: 60, enCok: 180 },
  ];

  let giderSayisi = 0;
  for (const vardiya of vardiyalar) {
    const adet = rastgeleTamsayi(1, 3);
    for (let i = 0; i < adet; i++) {
      const ornek = rastgeleSec(GIDER_ORNEKLERI);
      await prisma.gider.create({
        data: {
          vardiyaId: vardiya.id,
          kullaniciId: vardiya.kullaniciId,
          kategori: ornek.kategori,
          tutar: rastgeleTamsayi(ornek.enAz, ornek.enCok),
          aciklama: ornek.aciklama,
          odemeYontemi: rastgele() < 0.8 ? "NAKIT" : "KART",
          zaman: new Date(vardiya.baslangic.getTime() + dakikalar(rastgeleTamsayi(30, 400))),
        },
      });
      giderSayisi++;
    }
  }
  console.log(`✓ ${giderSayisi} gider kaydı`);

  console.log("\nSeed tamamlandı.\n");
  console.log("Giriş bilgileri:");
  console.log(`  ADMIN   → ${admin.email}  /  ${adminSifre}`);
  console.log(`  GOREVLI → ${gorevli.email}  /  ${gorevliSifre}\n`);
}

main()
  .catch((hata) => {
    console.error("Seed başarısız:", hata);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
