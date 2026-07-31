"use server";

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { islemGunluguYazTx } from "@/lib/gunluk";
import { sayiyaCevir } from "@/lib/para";
import { prisma } from "@/lib/prisma";
import {
  ayarSemasi,
  formVerisiniAl,
  hatalariTopla,
  kullaniciSemasi,
  parkAlaniSemasi,
  tarifeSemasi,
  type AlanHatalari,
} from "@/lib/validasyon";
import { sifirlamaOnbelleginiTemizle } from "@/lib/vardiya-sifirlama";
import { oturumAl } from "@/lib/yetki";

export type AyarDurumu = {
  basarili?: boolean;
  hata?: string;
  bilgi?: string;
  alanHatalari?: AlanHatalari;
};

/** Ayar işlemleri yalnızca ADMIN'e açıktır. */
async function adminKontrolu() {
  const kullanici = await oturumAl();
  if (!kullanici) return { hata: "Oturumunuz sonlanmış." as const };
  if (kullanici.rol !== "ADMIN") return { hata: "Bu işlem için yönetici yetkisi gerekir." as const };
  return { kullanici };
}

// ---------------------------------------------------------------------------
// Genel ayarlar
// ---------------------------------------------------------------------------

export async function ayarlariKaydet(
  _onceki: AyarDurumu,
  formData: FormData,
): Promise<AyarDurumu> {
  const kontrol = await adminKontrolu();
  if ("hata" in kontrol) return { hata: kontrol.hata };

  const ayrisma = ayarSemasi.safeParse(formVerisiniAl(formData));
  if (!ayrisma.success) return { alanHatalari: hatalariTopla(ayrisma.error) };

  const eski = await prisma.ayar.findUnique({ where: { id: 1 } });

  await prisma.$transaction(async (tx) => {
    await tx.ayar.upsert({
      where: { id: 1 },
      create: { id: 1, ...ayrisma.data },
      update: ayrisma.data,
    });

    await islemGunluguYazTx(tx, {
      kullaniciId: kontrol.kullanici.id,
      islemTipi: "AYAR_DEGISIKLIGI",
      eskiDeger: eski
        ? {
            otoparkAdi: eski.otoparkAdi,
            toplamKapasite: eski.toplamKapasite,
            vardiyaSifirlamaSaati: eski.vardiyaSifirlamaSaati,
          }
        : undefined,
      yeniDeger: {
        otoparkAdi: ayrisma.data.otoparkAdi,
        toplamKapasite: ayrisma.data.toplamKapasite,
        vardiyaSifirlamaSaati: ayrisma.data.vardiyaSifirlamaSaati,
      },
      aciklama: "Genel ayarlar güncellendi",
    });
  });

  // Sıfırlama saati işlem içi önbellekte tutuluyor; yeni değer anında geçerli olsun.
  sifirlamaOnbelleginiTemizle();

  revalidatePath("/ayarlar");
  revalidatePath("/vardiya");
  revalidatePath("/");
  return { basarili: true, bilgi: "Ayarlar kaydedildi." };
}

// ---------------------------------------------------------------------------
// Tarife — güncellenmez, yeni sürüm oluşturulur
// ---------------------------------------------------------------------------

export async function tarifeKaydet(
  _onceki: AyarDurumu,
  formData: FormData,
): Promise<AyarDurumu> {
  const kontrol = await adminKontrolu();
  if ("hata" in kontrol) return { hata: kontrol.hata };

  const ayrisma = tarifeSemasi.safeParse(formVerisiniAl(formData));
  if (!ayrisma.success) return { alanHatalari: hatalariTopla(ayrisma.error) };
  const veri = ayrisma.data;

  const mevcut = await prisma.tarife.findFirst({
    where: { aktif: true },
    orderBy: { gecerlilikBaslangic: "desc" },
  });

  await prisma.$transaction(async (tx) => {
    // Eski tarife pasifleşir ama silinmez: geçmiş kayıtlar hangi tarifeyle
    // ücretlendirildiğini göstermeye devam etsin.
    if (mevcut) {
      await tx.tarife.update({ where: { id: mevcut.id }, data: { aktif: false } });
    }

    const yeni = await tx.tarife.create({
      data: {
        ad: veri.ad,
        ilkUcretsizDakika: veri.ilkUcretsizDakika,
        ilkSaatUcreti: new Prisma.Decimal(veri.ilkSaatUcreti),
        saatlikUcret: new Prisma.Decimal(veri.saatlikUcret),
        gunlukTavanUcret: new Prisma.Decimal(veri.gunlukTavanUcret),
        // Abonman ekranları kapalı; mevcut değer korunur.
        aylikAbonmanUcreti: mevcut?.aylikAbonmanUcreti ?? new Prisma.Decimal(0),
        aktif: true,
      },
    });

    await islemGunluguYazTx(tx, {
      kullaniciId: kontrol.kullanici.id,
      islemTipi: "TARIFE_DEGISIKLIGI",
      ilgiliKayitId: yeni.id,
      eskiDeger: mevcut
        ? {
            ad: mevcut.ad,
            ilkUcretsizDakika: mevcut.ilkUcretsizDakika,
            ilkSaatUcreti: sayiyaCevir(mevcut.ilkSaatUcreti),
            saatlikUcret: sayiyaCevir(mevcut.saatlikUcret),
            gunlukTavanUcret: sayiyaCevir(mevcut.gunlukTavanUcret),
          }
        : undefined,
      yeniDeger: {
        ad: veri.ad,
        ilkUcretsizDakika: veri.ilkUcretsizDakika,
        ilkSaatUcreti: veri.ilkSaatUcreti,
        saatlikUcret: veri.saatlikUcret,
        gunlukTavanUcret: veri.gunlukTavanUcret,
      },
      aciklama: `Yeni tarife yürürlüğe girdi: ${veri.ad}`,
    });
  });

  revalidatePath("/ayarlar");
  return {
    basarili: true,
    bilgi: "Yeni tarife yürürlüğe girdi. Mevcut park kayıtları eski tarifeden ücretlendirilir.",
  };
}

// ---------------------------------------------------------------------------
// Park alanları
// ---------------------------------------------------------------------------

export async function parkAlaniKaydet(
  _onceki: AyarDurumu,
  formData: FormData,
): Promise<AyarDurumu> {
  const kontrol = await adminKontrolu();
  if ("hata" in kontrol) return { hata: kontrol.hata };

  const veriler = formVerisiniAl(formData);
  const alanId = typeof veriler.alanId === "string" && veriler.alanId ? veriler.alanId : undefined;

  const ayrisma = parkAlaniSemasi.safeParse(veriler);
  if (!ayrisma.success) return { alanHatalari: hatalariTopla(ayrisma.error) };

  try {
    await prisma.$transaction(async (tx) => {
      const kayit = alanId
        ? await tx.parkAlani.update({ where: { id: alanId }, data: ayrisma.data })
        : await tx.parkAlani.create({ data: ayrisma.data });

      await islemGunluguYazTx(tx, {
        kullaniciId: kontrol.kullanici.id,
        islemTipi: "PARK_ALANI_DEGISIKLIGI",
        ilgiliKayitId: kayit.id,
        yeniDeger: { ad: kayit.ad, kapasite: kayit.kapasite, aktif: kayit.aktif },
        aciklama: alanId ? `Park alanı güncellendi: ${kayit.ad}` : `Park alanı eklendi: ${kayit.ad}`,
      });
    });
  } catch (hata) {
    if (hata instanceof Prisma.PrismaClientKnownRequestError && hata.code === "P2002") {
      return { alanHatalari: { ad: "Bu adda bir park alanı zaten var." } };
    }
    console.error("Park alanı kaydedilemedi:", hata);
    return { hata: "Park alanı kaydedilemedi." };
  }

  revalidatePath("/ayarlar");
  revalidatePath("/icerideki-araclar");
  return { basarili: true, bilgi: "Park alanı kaydedildi." };
}

// ---------------------------------------------------------------------------
// Kullanıcılar
// ---------------------------------------------------------------------------

export async function kullaniciKaydet(
  _onceki: AyarDurumu,
  formData: FormData,
): Promise<AyarDurumu> {
  const kontrol = await adminKontrolu();
  if ("hata" in kontrol) return { hata: kontrol.hata };

  const veriler = formVerisiniAl(formData);
  const kullaniciId =
    typeof veriler.kullaniciId === "string" && veriler.kullaniciId ? veriler.kullaniciId : undefined;

  const ayrisma = kullaniciSemasi.safeParse(veriler);
  if (!ayrisma.success) return { alanHatalari: hatalariTopla(ayrisma.error) };
  const veri = ayrisma.data;

  if (!kullaniciId && !veri.sifre) {
    return { alanHatalari: { sifre: "Yeni kullanıcı için şifre zorunludur." } };
  }

  // Yönetici kendi hesabını pasifleştiremesin ya da yetkisini düşüremesin:
  // sistemde yönetici kalmaması riskine karşı.
  if (kullaniciId === kontrol.kullanici.id && (veri.rol !== "ADMIN" || !veri.aktif)) {
    return { hata: "Kendi yönetici yetkinizi kaldıramaz veya hesabınızı pasifleştiremezsiniz." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const sifreHash = veri.sifre ? await bcrypt.hash(veri.sifre, 12) : undefined;

      const kayit = kullaniciId
        ? await tx.kullanici.update({
            where: { id: kullaniciId },
            data: {
              adSoyad: veri.adSoyad,
              email: veri.email,
              rol: veri.rol,
              aktif: veri.aktif,
              // Şifre değişince damga güncellenir: o kullanıcının açık
              // oturumları anında geçersiz olur.
              ...(sifreHash ? { sifreHash, sifreDegisimi: new Date() } : {}),
            },
          })
        : await tx.kullanici.create({
            data: {
              adSoyad: veri.adSoyad,
              email: veri.email,
              rol: veri.rol,
              aktif: veri.aktif,
              sifreHash: sifreHash!,
            },
          });

      await islemGunluguYazTx(tx, {
        kullaniciId: kontrol.kullanici.id,
        islemTipi: "KULLANICI_DEGISIKLIGI",
        ilgiliKayitId: kayit.id,
        // Şifre hiçbir zaman günlüğe yazılmaz — yalnızca değiştirildiği bilgisi.
        yeniDeger: {
          adSoyad: kayit.adSoyad,
          email: kayit.email,
          rol: kayit.rol,
          aktif: kayit.aktif,
          sifreDegisti: !!sifreHash,
        },
        aciklama: kullaniciId
          ? `Kullanıcı güncellendi: ${kayit.email}`
          : `Kullanıcı oluşturuldu: ${kayit.email}`,
      });
    });
  } catch (hata) {
    if (hata instanceof Prisma.PrismaClientKnownRequestError && hata.code === "P2002") {
      return { alanHatalari: { email: "Bu e-posta adresi zaten kayıtlı." } };
    }
    console.error("Kullanıcı kaydedilemedi:", hata);
    return { hata: "Kullanıcı kaydedilemedi." };
  }

  revalidatePath("/ayarlar");
  return { basarili: true, bilgi: "Kullanıcı kaydedildi." };
}
