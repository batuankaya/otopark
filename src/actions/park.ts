"use server";

import { Prisma, type AracSinifi } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { acikBorclariAl, borcDagit, borcDagitiminiYazTx, borcToplami, kurusYuvarla } from "@/lib/borc";
import { islemGunluguYaz, islemGunluguYazTx } from "@/lib/gunluk";
import { aracEtiketi } from "@/lib/plaka";
import { prisma } from "@/lib/prisma";
import { sayiyaCevir } from "@/lib/para";
import { ARAC_SINIFI_ETIKETLERI } from "@/lib/arac-sinifi";
import {
  aktifTarifeyiAl,
  aracinAbonmaniniBul,
  ayarlariAl,
  gecerliAbonmaniBul,
  tarifeyiSadelestir,
} from "@/lib/sorgular";
import { hesaplaUcret } from "@/lib/ucret";
import {
  aracCikisSemasi,
  aracGirisSemasi,
  formVerisiniAl,
  hatalariTopla,
  kayitDuzenleSemasi,
  kayitIptalSemasi,
  type AlanHatalari,
} from "@/lib/validasyon";
import { islemIzniAl, oturumAl } from "@/lib/yetki";

export type IslemDurumu = {
  basarili?: boolean;
  hata?: string;
  alanHatalari?: AlanHatalari;
  /** Plaka zaten içerideyse mevcut kaydın kimliği — arayüz "Çıkışa git" gösterir. */
  mevcutKayitId?: string;
  /** Başarılı girişte fiş önizlemesi için. */
  yeniKayitId?: string;
  uyari?: string;
  vardiyaGerekli?: boolean;
};

// ---------------------------------------------------------------------------
// Araç girişi
// ---------------------------------------------------------------------------

export async function aracGirisiYap(
  _onceki: IslemDurumu,
  formData: FormData,
): Promise<IslemDurumu> {
  const izin = await islemIzniAl();
  if (!izin.izinli) {
    return { hata: izin.hata, vardiyaGerekli: izin.vardiyaGerekli };
  }

  const ayrisma = aracGirisSemasi.safeParse(formVerisiniAl(formData));
  if (!ayrisma.success) {
    return { alanHatalari: hatalariTopla(ayrisma.error) };
  }

  const veri = ayrisma.data;
  const tarife = await aktifTarifeyiAl(veri.aracSinifi);
  if (!tarife) {
    return {
      hata: `${ARAC_SINIFI_ETIKETLERI[veri.aracSinifi]} sınıfı için tanımlı aktif tarife yok. Yönetici Ayarlar'dan tarife tanımlamalı.`,
    };
  }

  // Kapasite kontrolü
  const [ayar, icerideSayisi] = await Promise.all([
    ayarlariAl(),
    prisma.parkKaydi.count({ where: { durum: "ICERIDE" } }),
  ]);
  if (icerideSayisi >= ayar.toplamKapasite) {
    return { hata: `Otopark dolu (${icerideSayisi}/${ayar.toplamKapasite}). Yeni araç alınamaz.` };
  }

  // Mükerrer giriş kontrolü — kullanıcıya anlamlı mesaj verebilmek için önce
  // burada bakılır. Yarış durumunda aşağıdaki P2002 yakalaması devreye girer.
  // Plakasız kayıtlarda bu kontrol yapılmaz: aracı ayırt edecek bir anahtar yok.
  const zatenIceride = veri.plaka
    ? await prisma.parkKaydi.findFirst({
        where: { plaka: veri.plaka, durum: "ICERIDE" },
        select: { id: true },
      })
    : null;
  if (zatenIceride) {
    await islemGunluguYaz({
      kullaniciId: izin.kullanici.id,
      islemTipi: "GIRIS_BASARISIZ",
      ilgiliKayitId: zatenIceride.id,
      aciklama: `${veri.plakaGosterim ?? veri.plaka} zaten içeride — mükerrer giriş engellendi.`,
    });
    return {
      hata: `${veri.plakaGosterim ?? veri.plaka} zaten otoparkta görünüyor.`,
      mevcutKayitId: zatenIceride.id,
    };
  }

  // Park alanı (seçilmediyse boş bırakılır)
  const parkAlani = veri.parkAlaniId
    ? await prisma.parkAlani.findUnique({ where: { id: veri.parkAlaniId } })
    : null;

  try {
    const kayit = await prisma.$transaction(async (tx) => {
      // Araç kaydı yalnızca plaka varsa oluşturulur; plakasız kayıtlar
      // ParkKaydi üzerindeki marka/model/renk alanlarıyla tanınır.
      const arac = veri.plaka
        ? await tx.arac.upsert({
        where: { plaka: veri.plaka },
        create: {
          plaka: veri.plaka,
          plakaGosterim: veri.plakaGosterim,
          yabanciPlaka: veri.yabanciPlaka,
          ulkeKodu: veri.ulkeKodu,
          marka: veri.marka,
          model: veri.model,
          renk: veri.renk,
          // Not araçta da saklanır: "anahtar bizde", "hasarlı" gibi bilgiler
          // aracın bir sonraki gelişinde görevliye otomatik hatırlatılsın diye.
          notlar: veri.notlar,
          aracSinifi: veri.aracSinifi,
        },
        update: {
          // Boş bırakılan alanlar mevcut bilgiyi silmesin.
          plakaGosterim: veri.plakaGosterim,
          yabanciPlaka: veri.yabanciPlaka,
          // Sınıf her girişte tazelenir: araç sınıf değiştirmez ama görevli
          // önceki kaydı yanlış işaretlemişse düzeltmesi burada kalıcı olur.
          aracSinifi: veri.aracSinifi,
          ...(veri.ulkeKodu ? { ulkeKodu: veri.ulkeKodu } : {}),
          ...(veri.marka ? { marka: veri.marka } : {}),
          ...(veri.model ? { model: veri.model } : {}),
          ...(veri.renk ? { renk: veri.renk } : {}),
          ...(veri.notlar ? { notlar: veri.notlar } : {}),
        },
          })
        : null;

      // Abonman varsa tarife türü otomatik ABONMAN olur (plakasızda aranmaz).
      const abonman = arac
        ? await tx.abonman.findFirst({
        where: {
          aracId: arac.id,
          durum: "AKTIF",
          baslangicTarihi: { lte: new Date() },
          bitisTarihi: { gte: new Date() },
        },
        orderBy: { bitisTarihi: "desc" },
          })
        : null;

      const tarifeTuru = abonman ? "ABONMAN" : veri.tarifeTuru;

      const yeniKayit = await tx.parkKaydi.create({
        data: {
          aracId: arac?.id ?? null,
          plaka: arac?.plaka ?? null,
          // Geriye dönük giriş: verilmezse "şu an" (şema varsayılanı).
          ...(veri.girisZamani ? { girisZamani: veri.girisZamani } : {}),
          // Gösterim ve ülke bilgisi kayıt anında dondurulur: fiş ve listeler
          // aracı ayrıca sorgulamak zorunda kalmasın.
          plakaGosterim: arac?.plakaGosterim ?? null,
          yabanciPlaka: arac?.yabanciPlaka ?? false,
          ulkeKodu: arac?.ulkeKodu ?? null,
          // Plakasız kayıtta aracı tanıyan tek bilgi bunlar.
          marka: veri.marka ?? null,
          model: veri.model ?? null,
          renk: veri.renk ?? null,
          girisYapanId: izin.kullanici.id,
          tarifeId: tarife.id,
          tarifeTuru,
          aracSinifi: veri.aracSinifi,
          durum: "ICERIDE",
          parkAlaniId: parkAlani?.id ?? null,
          parkAlaniAd: parkAlani?.ad ?? null,
          abonmanId: abonman?.id ?? null,
          vardiyaId: izin.vardiyaId,
          notlar: veri.notlar,
        },
      });

      await islemGunluguYazTx(tx, {
        kullaniciId: izin.kullanici.id,
        islemTipi: "GIRIS",
        ilgiliKayitId: yeniKayit.id,
        yeniDeger: {
          plaka: yeniKayit.plaka,
          marka: veri.marka ?? null,
          model: veri.model ?? null,
          tarifeTuru,
          aracSinifi: veri.aracSinifi,
          ...(veri.girisZamani ? { geriyeDonukGiris: veri.girisZamani.toISOString() } : {}),
        },
        aciklama:
          `${arac?.plakaGosterim ?? arac?.plaka ?? [veri.marka, veri.model].filter(Boolean).join(" ")} girişi` +
          // Geriye dönük giriş ücreti doğrudan etkiler; denetim izinde belli olsun.
          (veri.girisZamani ? " (geriye dönük kayıt)" : ""),
      });

      return yeniKayit;
    });

    revalidatePath("/");
    revalidatePath("/icerideki-araclar");

    // Abonmanı süresi dolmuşsa görevliyi girişte uyar.
    const abonman = kayit.aracId ? await aracinAbonmaniniBul(kayit.aracId) : null;
    const uyari =
      abonman && abonman.bitisTarihi < new Date()
        ? `Bu aracın abonmanı dolmuş. Çıkışta normal tarifeden ücretlendirilecek.`
        : undefined;

    return { basarili: true, yeniKayitId: kayit.id, uyari };
  } catch (hata) {
    // Kısmi unique index: aynı plaka aynı anda iki kez içeride olamaz.
    if (hata instanceof Prisma.PrismaClientKnownRequestError && hata.code === "P2002") {
      const mevcut = await prisma.parkKaydi.findFirst({
        where: { plaka: veri.plaka, durum: "ICERIDE" },
        select: { id: true },
      });
      return {
        hata: `${veri.plakaGosterim ?? veri.plaka} az önce başka bir görevli tarafından girildi.`,
        mevcutKayitId: mevcut?.id,
      };
    }
    console.error("Araç girişi başarısız:", hata);
    return { hata: "Kayıt oluşturulamadı. Lütfen tekrar deneyin." };
  }
}

// ---------------------------------------------------------------------------
// Çıkış önizlemesi (ücret hesabı) — mutasyon değil, okuma
// ---------------------------------------------------------------------------

export type CikisOnizlemesi = {
  bulundu: boolean;
  hata?: string;
  kayit?: {
    id: string;
    plaka: string | null;
    plakaGosterim: string | null;
    yabanciPlaka: boolean;
    ulkeKodu: string | null;
    girisZamani: string;
    parkAlaniAd: string | null;
    marka: string | null;
    model: string | null;
    renk: string | null;
    notlar: string | null;
    tarifeTuru: string;
    aracSinifi: AracSinifi;
  };
  ucret?: {
    tutar: number;
    toplamDakika: number;
    aciklama: string;
    uyari?: string;
    uygulananTarifeTuru: string;
  };
  /** Aracın önceki çıkışlarından kalan, henüz tahsil edilmemiş borç. */
  eskiBorc?: {
    toplam: number;
    kayitlar: Array<{ id: string; fisNo: number; cikisZamani: string | null; kalan: number }>;
  };
};

export async function cikisOnizle(parkKaydiId: string): Promise<CikisOnizlemesi> {
  const kullanici = await oturumAl();
  if (!kullanici) return { bulundu: false, hata: "Oturumunuz sonlanmış." };

  const kayit = await prisma.parkKaydi.findUnique({
    where: { id: parkKaydiId },
    include: { arac: true, tarife: true },
  });

  if (!kayit) return { bulundu: false, hata: "Kayıt bulunamadı." };
  if (kayit.durum !== "ICERIDE") {
    return { bulundu: false, hata: "Bu araç zaten çıkış yapmış veya kayıt iptal edilmiş." };
  }

  const simdi = new Date();
  const [abonman, acikBorclar] = await Promise.all([
    kayit.abonmanId && kayit.aracId ? gecerliAbonmaniBul(kayit.aracId, simdi) : null,
    kayit.aracId ? acikBorclariAl(kayit.aracId) : [],
  ]);

  const sonuc = hesaplaUcret({
    girisZamani: kayit.girisZamani,
    cikisZamani: simdi,
    tarife: tarifeyiSadelestir(kayit.tarife),
    tarifeTuru: kayit.tarifeTuru,
    abonmanGecerli: !!abonman,
  });

  return {
    bulundu: true,
    kayit: {
      id: kayit.id,
      plaka: kayit.plaka,
      plakaGosterim: kayit.plakaGosterim,
      yabanciPlaka: kayit.yabanciPlaka,
      ulkeKodu: kayit.ulkeKodu,
      girisZamani: kayit.girisZamani.toISOString(),
      parkAlaniAd: kayit.parkAlaniAd,
      // Plakasız kayıtta bilgi ParkKaydi üzerinde; plakalıda araçtan gelir.
      marka: kayit.marka ?? kayit.arac?.marka ?? null,
      model: kayit.model ?? kayit.arac?.model ?? null,
      renk: kayit.renk ?? kayit.arac?.renk ?? null,
      notlar: kayit.notlar ?? kayit.arac?.notlar ?? null,
      tarifeTuru: kayit.tarifeTuru,
      aracSinifi: kayit.aracSinifi,
    },
    ucret: {
      tutar: sonuc.ucret,
      toplamDakika: sonuc.toplamDakika,
      aciklama: "",
      uyari: sonuc.uyari,
      uygulananTarifeTuru: sonuc.uygulananTarifeTuru,
    },
    eskiBorc: {
      toplam: borcToplami(acikBorclar),
      kayitlar: acikBorclar.map((borc) => ({
        id: borc.id,
        fisNo: borc.fisNo,
        cikisZamani: borc.cikisZamani?.toISOString() ?? null,
        kalan: borc.kalan,
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Araç çıkışı
// ---------------------------------------------------------------------------

export async function aracCikisiYap(
  _onceki: IslemDurumu,
  formData: FormData,
): Promise<IslemDurumu> {
  const izin = await islemIzniAl();
  if (!izin.izinli) {
    return { hata: izin.hata, vardiyaGerekli: izin.vardiyaGerekli };
  }

  const ayrisma = aracCikisSemasi.safeParse(formVerisiniAl(formData));
  if (!ayrisma.success) {
    return { alanHatalari: hatalariTopla(ayrisma.error) };
  }
  const veri = ayrisma.data;

  const kayit = await prisma.parkKaydi.findUnique({
    where: { id: veri.parkKaydiId },
    include: { tarife: true },
  });

  if (!kayit) return { hata: "Kayıt bulunamadı." };
  if (kayit.durum !== "ICERIDE") {
    return { hata: "Bu araç zaten çıkış yapmış. Listeyi yenileyin." };
  }

  const cikisZamani = new Date();
  const abonman =
    kayit.abonmanId && kayit.aracId
      ? await gecerliAbonmaniBul(kayit.aracId, cikisZamani)
      : null;

  const sonuc = hesaplaUcret({
    girisZamani: kayit.girisZamani,
    cikisZamani,
    tarife: tarifeyiSadelestir(kayit.tarife),
    tarifeTuru: kayit.tarifeTuru,
    abonmanGecerli: !!abonman,
  });

  // Görevli ücreti değiştirdiyse sebep zorunludur.
  const elleGirilenTutar = veri.duzeltilmisUcret;
  const ucretDegisti =
    elleGirilenTutar !== undefined && Math.abs(elleGirilenTutar - sonuc.ucret) > 0.009;

  if (ucretDegisti && !veri.ucretDuzeltmeSebebi) {
    return {
      alanHatalari: {
        ucretDuzeltmeSebebi: "Ücreti değiştirdiniz — sebep girmeniz zorunludur.",
      },
    };
  }

  /** İskonto sonrası ödenmesi gereken tutar. */
  const tahakkuk = ucretDegisti ? elleGirilenTutar! : sonuc.ucret;

  // Müşteri tahakkukun tamamını ödemediyse fark borç olarak kalır.
  const tahsilEdilen = veri.alinanTutar !== undefined ? veri.alinanTutar : tahakkuk;
  if (tahsilEdilen - tahakkuk > 0.009) {
    return {
      alanHatalari: {
        alinanTutar: "Alınan tutar, ödenecek tutardan fazla olamaz.",
      },
    };
  }
  const borcTutari = kurusYuvarla(Math.max(0, tahakkuk - tahsilEdilen));

  // Aracın önceki çıkışlarından kalan borç bu işlemde de tahsil edilebilir.
  const acikBorclar = kayit.aracId ? await acikBorclariAl(kayit.aracId) : [];
  const acikBorcToplami = borcToplami(acikBorclar);
  const borcTahsilati = kurusYuvarla(veri.borcTahsilati ?? 0);
  if (borcTahsilati - acikBorcToplami > 0.009) {
    return {
      alanHatalari: {
        borcTahsilati: `Aracın açık borcu ${acikBorcToplami} TL. Daha fazlası tahsil edilemez.`,
      },
    };
  }
  const borcDagitimi = borcDagit(acikBorclar, borcTahsilati);

  // Kasaya giren para: bu çıkışın ücreti + kapatılan eski borç.
  const kasayaGiren = kurusYuvarla(tahsilEdilen + borcTahsilati);

  try {
    await prisma.$transaction(async (tx) => {
      // Koşullu güncelleme: iki görevli aynı anda çıkış yapamasın.
      const guncelleme = await tx.parkKaydi.updateMany({
        where: { id: kayit.id, durum: "ICERIDE" },
        data: {
          durum: "CIKTI",
          cikisZamani,
          cikisYapanId: izin.kullanici.id,
          cikisVardiyaId: izin.vardiyaId,
          hesaplananUcret: new Prisma.Decimal(sonuc.ucret),
          tahsilEdilenUcret: new Prisma.Decimal(tahsilEdilen),
          // 0 TL'de ödeme yöntemi anlamsız. Ücret hiç alınmayıp yalnızca
          // eski borç tahsil edildiyse yöntem yine kaydedilir: para kasaya
          // o yöntemle girmiştir.
          odemeYontemi: kasayaGiren > 0 ? veri.odemeYontemi : null,
          borcTutari: new Prisma.Decimal(borcTutari),
          borcKalan: new Prisma.Decimal(borcTutari),
          tahsilEdilenBorc: new Prisma.Decimal(borcTahsilati),
          tarifeTuru: sonuc.uygulananTarifeTuru,
          ucretDuzeltmeSebebi: ucretDegisti ? veri.ucretDuzeltmeSebebi : null,
          ...(veri.notlar ? { notlar: veri.notlar } : {}),
        },
      });

      if (guncelleme.count === 0) {
        throw new Error("CAKISMA");
      }

      await borcDagitiminiYazTx(tx, borcDagitimi);

      await islemGunluguYazTx(tx, {
        kullaniciId: izin.kullanici.id,
        islemTipi: "CIKIS",
        ilgiliKayitId: kayit.id,
        yeniDeger: {
          plaka: kayit.plaka,
          hesaplananUcret: sonuc.ucret,
          tahsilEdilenUcret: tahsilEdilen,
          borcTutari,
          tahsilEdilenBorc: borcTahsilati,
          odemeYontemi: kasayaGiren > 0 ? veri.odemeYontemi : null,
        },
        aciklama:
          `${aracEtiketi(kayit)} çıkışı — ${tahsilEdilen} TL` +
          (borcTutari > 0 ? ` (${borcTutari} TL BORÇ kaldı)` : ""),
      });

      // Eski borç tahsilatı ayrı bir denetim kaydı: para bu vardiyanın
      // kasasına girer ama bu kaydın kendi ücreti değildir.
      if (borcTahsilati > 0) {
        await islemGunluguYazTx(tx, {
          kullaniciId: izin.kullanici.id,
          islemTipi: "BORC_TAHSILATI",
          ilgiliKayitId: kayit.id,
          eskiDeger: { acikBorcToplami },
          yeniDeger: {
            tahsilEdilenBorc: borcTahsilati,
            kapatilanKayitlar: borcDagitimi.map((pay) => ({ id: pay.id, dusulen: pay.dusulen })),
            odemeYontemi: veri.odemeYontemi,
          },
          aciklama: `${aracEtiketi(kayit)} eski borcundan ${borcTahsilati} TL tahsil edildi`,
        });
      }

      // Ücret düzeltmesi ayrı bir denetim kaydı olarak da tutulur.
      if (ucretDegisti) {
        await islemGunluguYazTx(tx, {
          kullaniciId: izin.kullanici.id,
          islemTipi: "UCRET_DUZELTME",
          ilgiliKayitId: kayit.id,
          eskiDeger: { tutar: sonuc.ucret },
          yeniDeger: { tutar: tahsilEdilen },
          aciklama: veri.ucretDuzeltmeSebebi ?? null,
        });
      }
    });
  } catch (hata) {
    if (hata instanceof Error && hata.message === "CAKISMA") {
      return { hata: "Bu araç az önce başka bir görevli tarafından çıkarıldı." };
    }
    if (hata instanceof Error && hata.message === "BORC_DEGISTI") {
      return { hata: "Aracın borcu az önce değişti. Ekranı yenileyip tekrar deneyin." };
    }
    console.error("Araç çıkışı başarısız:", hata);
    return { hata: "Çıkış tamamlanamadı. Lütfen tekrar deneyin." };
  }

  revalidatePath("/");
  revalidatePath("/icerideki-araclar");
  revalidatePath("/vardiya");

  return { basarili: true, yeniKayitId: kayit.id, uyari: sonuc.uyari };
}

// ---------------------------------------------------------------------------
// Kayıt iptali (soft delete) — yalnızca ADMIN
// ---------------------------------------------------------------------------

export async function kaydiIptalEt(
  _onceki: IslemDurumu,
  formData: FormData,
): Promise<IslemDurumu> {
  const kullanici = await oturumAl();
  if (!kullanici) return { hata: "Oturumunuz sonlanmış." };
  if (kullanici.rol !== "ADMIN") {
    return { hata: "Kayıt iptali yalnızca yönetici tarafından yapılabilir." };
  }

  const ayrisma = kayitIptalSemasi.safeParse(formVerisiniAl(formData));
  if (!ayrisma.success) {
    return { alanHatalari: hatalariTopla(ayrisma.error) };
  }
  const { parkKaydiId, iptalSebebi } = ayrisma.data;

  const kayit = await prisma.parkKaydi.findUnique({ where: { id: parkKaydiId } });
  if (!kayit) return { hata: "Kayıt bulunamadı." };
  if (kayit.durum === "IPTAL") return { hata: "Bu kayıt zaten iptal edilmiş." };

  await prisma.$transaction(async (tx) => {
    await tx.parkKaydi.update({
      where: { id: parkKaydiId },
      data: {
        durum: "IPTAL",
        iptalSebebi,
        iptalEdenId: kullanici.id,
        iptalZamani: new Date(),
        // İptal edilen kaydın alacağı da düşer; aksi hâlde açık borç
        // listesinde artık var olmayan bir kayıt görünürdü.
        borcKalan: 0,
      },
    });

    await islemGunluguYazTx(tx, {
      kullaniciId: kullanici.id,
      islemTipi: "IPTAL",
      ilgiliKayitId: parkKaydiId,
      eskiDeger: {
        durum: kayit.durum,
        tahsilEdilenUcret: sayiyaCevir(kayit.tahsilEdilenUcret),
        borcKalan: sayiyaCevir(kayit.borcKalan),
      },
      yeniDeger: { durum: "IPTAL" },
      aciklama: iptalSebebi,
    });
  });

  revalidatePath("/");
  revalidatePath("/icerideki-araclar");
  revalidatePath("/raporlar");

  return { basarili: true };
}

// ---------------------------------------------------------------------------
// İçerideki kaydı düzenleme
// ---------------------------------------------------------------------------

/**
 * İçerideki bir park kaydının giriş saatini, araç bilgilerini ve notunu
 * düzenler; plakasız kayda plaka ekler.
 *
 * Giriş saati ücreti doğrudan değiştirdiği için her düzenleme eski ve yeni
 * değerleriyle işlem günlüğüne yazılır.
 */
export async function kaydiDuzenle(
  _onceki: IslemDurumu,
  formData: FormData,
): Promise<IslemDurumu> {
  const kullanici = await oturumAl();
  if (!kullanici) return { hata: "Oturumunuz sonlanmış." };

  const ayrisma = kayitDuzenleSemasi.safeParse(formVerisiniAl(formData));
  if (!ayrisma.success) return { alanHatalari: hatalariTopla(ayrisma.error) };
  const veri = ayrisma.data;

  const kayit = await prisma.parkKaydi.findUnique({
    where: { id: veri.parkKaydiId },
    include: { arac: true },
  });
  if (!kayit) return { hata: "Kayıt bulunamadı." };
  if (kayit.durum !== "ICERIDE") {
    return { hata: "Yalnızca içerideki araçlar düzenlenebilir." };
  }

  // Plaka ekleniyor/değişiyorsa: o plaka başka bir araçta içeride olmasın.
  if (veri.plaka && veri.plaka !== kayit.plaka) {
    const cakisan = await prisma.parkKaydi.findFirst({
      where: { plaka: veri.plaka, durum: "ICERIDE", id: { not: kayit.id } },
      select: { id: true },
    });
    if (cakisan) {
      return {
        hata: `${veri.plakaGosterim} zaten otoparkta görünüyor.`,
        mevcutKayitId: cakisan.id,
      };
    }
  }

  // Sınıf değiştiyse ücret de değişmeli: kayıt yeni sınıfın yürürlükteki
  // tarifesine bağlanır. Aksi hâlde "büyük araç" işaretlenir ama binek
  // tarifesinden ücretlendirilirdi.
  const sinifDegisti = veri.aracSinifi !== kayit.aracSinifi;
  const yeniTarife = sinifDegisti ? await aktifTarifeyiAl(veri.aracSinifi) : null;
  if (sinifDegisti && !yeniTarife) {
    return {
      hata: `${ARAC_SINIFI_ETIKETLERI[veri.aracSinifi]} sınıfı için tanımlı aktif tarife yok.`,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Plaka verildiyse araç kaydını oluştur/tazele ve kayda bağla.
      let aracId = kayit.aracId;
      if (veri.plaka) {
        const arac = await tx.arac.upsert({
          where: { plaka: veri.plaka },
          create: {
            plaka: veri.plaka,
            plakaGosterim: veri.plakaGosterim,
            yabanciPlaka: veri.yabanciPlaka,
            ulkeKodu: veri.ulkeKodu,
            marka: veri.marka,
            model: veri.model,
            renk: veri.renk,
            notlar: veri.notlar,
            aracSinifi: veri.aracSinifi,
          },
          update: {
            plakaGosterim: veri.plakaGosterim,
            yabanciPlaka: veri.yabanciPlaka,
            ...(veri.ulkeKodu ? { ulkeKodu: veri.ulkeKodu } : {}),
            ...(veri.marka ? { marka: veri.marka } : {}),
            ...(veri.model ? { model: veri.model } : {}),
            ...(veri.renk ? { renk: veri.renk } : {}),
            // Not araçta kalıcıdır — aracın bir sonraki gelişinde hatırlatılır.
            notlar: veri.notlar ?? null,
            aracSinifi: veri.aracSinifi,
          },
        });
        aracId = arac.id;
      }

      const guncelleme = await tx.parkKaydi.updateMany({
        where: { id: kayit.id, durum: "ICERIDE" },
        data: {
          aracId,
          plaka: veri.plaka,
          plakaGosterim: veri.plakaGosterim,
          yabanciPlaka: veri.yabanciPlaka,
          ulkeKodu: veri.ulkeKodu,
          marka: veri.marka ?? null,
          model: veri.model ?? null,
          renk: veri.renk ?? null,
          notlar: veri.notlar ?? null,
          aracSinifi: veri.aracSinifi,
          ...(yeniTarife ? { tarifeId: yeniTarife.id } : {}),
          ...(veri.girisZamani ? { girisZamani: veri.girisZamani } : {}),
        },
      });
      if (guncelleme.count === 0) throw new Error("DURUM_DEGISTI");

      await islemGunluguYazTx(tx, {
        kullaniciId: kullanici.id,
        islemTipi: "KAYIT_DUZENLEME",
        ilgiliKayitId: kayit.id,
        eskiDeger: {
          plaka: kayit.plaka,
          marka: kayit.marka ?? kayit.arac?.marka ?? null,
          model: kayit.model ?? kayit.arac?.model ?? null,
          renk: kayit.renk ?? kayit.arac?.renk ?? null,
          aracSinifi: kayit.aracSinifi,
          girisZamani: kayit.girisZamani.toISOString(),
          notlar: kayit.notlar,
        },
        yeniDeger: {
          plaka: veri.plaka,
          marka: veri.marka ?? null,
          model: veri.model ?? null,
          renk: veri.renk ?? null,
          aracSinifi: veri.aracSinifi,
          girisZamani: (veri.girisZamani ?? kayit.girisZamani).toISOString(),
          notlar: veri.notlar ?? null,
        },
        aciklama:
          `${aracEtiketi({ ...kayit })} kaydı düzenlendi` +
          (veri.girisZamani && veri.girisZamani.getTime() !== kayit.girisZamani.getTime()
            ? " (giriş saati değişti — ücreti etkiler)"
            : "") +
          (sinifDegisti
            ? ` (araç sınıfı ${ARAC_SINIFI_ETIKETLERI[veri.aracSinifi]} olarak değişti — ücreti etkiler)`
            : "") +
          (!kayit.plaka && veri.plaka ? " (plaka eklendi)" : ""),
      });
    });
  } catch (hata) {
    if (hata instanceof Error && hata.message === "DURUM_DEGISTI") {
      return { hata: "Araç az önce çıkış yaptı. Listeyi yenileyin." };
    }
    if (hata instanceof Prisma.PrismaClientKnownRequestError && hata.code === "P2002") {
      return { hata: "Bu plaka az önce başka bir kayda eklendi." };
    }
    console.error("Kayıt düzenlenemedi:", hata);
    return { hata: "Kayıt düzenlenemedi. Lütfen tekrar deneyin." };
  }

  revalidatePath("/");
  revalidatePath("/icerideki-araclar");
  revalidatePath("/ara");

  return { basarili: true, yeniKayitId: kayit.id };
}
