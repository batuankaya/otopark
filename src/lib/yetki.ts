/**
 * Yetki ve vardiya kontrolleri.
 *
 * Middleware ilk savunma hattıdır; burası ikincisidir. Her sayfa ve her
 * Server Action, veriye dokunmadan önce buradaki kontrollerden geçer —
 * doğrudan istek atılarak middleware atlanamasın diye.
 */

import { redirect } from "next/navigation";
import { auth } from "./auth";
import { prisma } from "./prisma";

export type OturumKullanicisi = {
  id: string;
  adSoyad: string;
  email: string;
  rol: "ADMIN" | "GOREVLI";
};

/**
 * Oturumdaki kullanıcıyı veritabanından doğrular.
 *
 * Oturum bilgisi çerezdeki JWT'de taşınır ve 12 saat geçerlidir. Yalnızca
 * JWT'ye güvenmek iki soruna yol açıyordu:
 *   1. Pasifleştirilen (veya silinen) kullanıcı, oturumu dolana kadar
 *      çalışmaya devam ediyordu — güvenlik açığı.
 *   2. Silinmiş kullanıcıya ait oturumla yapılan işlem, işlem günlüğü
 *      yazarken yabancı anahtar hatası verip 500'e düşüyordu.
 *
 * Bu yüzden her istekte birincil anahtar üzerinden tek bir sorgu yapılır
 * (ucuzdur) ve rol/ad bilgisi de tazelenmiş olur: yetki değişikliği anında
 * yürürlüğe girer.
 */
async function dogrulanmisKullanici(): Promise<OturumKullanicisi | null> {
  const oturum = await auth();
  if (!oturum?.user?.id) return null;

  const kullanici = await prisma.kullanici.findUnique({
    where: { id: oturum.user.id },
    select: { id: true, adSoyad: true, email: true, rol: true, aktif: true },
  });

  // Hesap silinmiş ya da pasifleştirilmişse oturum geçersiz sayılır.
  if (!kullanici || !kullanici.aktif) return null;

  return {
    id: kullanici.id,
    adSoyad: kullanici.adSoyad,
    email: kullanici.email,
    rol: kullanici.rol,
  };
}

/**
 * Sayfalarda kullanılır: oturum geçersizse çıkış yaptırıp giriş ekranına yollar.
 *
 * Doğrudan `/giris`'e yönlendirmiyoruz: çerezdeki JWT hâlâ "geçerli" göründüğü
 * için middleware kullanıcıyı panoya geri atar ve sonsuz döngü oluşur.
 * `/api/oturum-kapat` çerezi silerek döngüyü kırar.
 */
export async function oturumZorunlu(): Promise<OturumKullanicisi> {
  const kullanici = await dogrulanmisKullanici();
  if (!kullanici) redirect("/api/oturum-kapat");
  return kullanici;
}

/** Sayfalarda kullanılır: ADMIN değilse panoya yönlendirir. */
export async function adminZorunlu(): Promise<OturumKullanicisi> {
  const kullanici = await oturumZorunlu();
  if (kullanici.rol !== "ADMIN") redirect("/?hata=yetkisiz");
  return kullanici;
}

/**
 * Server Action'larda kullanılır: yönlendirme yapmaz, `null` döner.
 * Böylece işlem kullanıcıya düzgün bir hata mesajıyla dönebilir.
 */
export async function oturumAl(): Promise<OturumKullanicisi | null> {
  return dogrulanmisKullanici();
}

// ---------------------------------------------------------------------------
// Vardiya
// ---------------------------------------------------------------------------

/**
 * Otoparkın açık vardiyası (yoksa null).
 *
 * Vardiya kullanıcı başına DEĞİL, otopark genelinde tektir: bir görevli
 * vardiyayı açtığında diğerleri ayrıca açmaz, hepsi aynı kasaya işlem yapar.
 * Veritabanı da bunu `vardiya_tek_acik_uq` kısmi unique index'i ile garanti
 * eder — iki görevli aynı anda açmaya çalışsa bile yalnızca biri başarılı olur.
 */
export async function acikVardiyayiBul() {
  return prisma.vardiya.findFirst({
    where: { bitis: null },
    include: { kullanici: { select: { id: true, adSoyad: true } } },
    orderBy: { baslangic: "desc" },
  });
}

export type IslemIzni =
  | { izinli: true; kullanici: OturumKullanicisi; vardiyaId: string }
  | { izinli: false; hata: string; vardiyaGerekli?: boolean };

/**
 * Araç giriş/çıkış işlemleri için ortak ön kontrol:
 * oturum var mı + otoparkta açık vardiya var mı?
 *
 * Açık vardiya zorunludur; aksi hâlde tahsil edilen para hiçbir kasaya
 * yazılamaz ve gün sonu devri tutmaz. Vardiyayı kimin açtığı önemli değildir —
 * vardiya açıksa tüm görevliler işlem yapabilir.
 */
export async function islemIzniAl(): Promise<IslemIzni> {
  const kullanici = await oturumAl();
  if (!kullanici) {
    return { izinli: false, hata: "Oturumunuz sonlanmış. Lütfen tekrar giriş yapın." };
  }

  const vardiya = await acikVardiyayiBul();
  if (!vardiya) {
    return {
      izinli: false,
      hata: "Otoparkta açık vardiya yok. İşlem yapabilmek için önce vardiya açılmalı.",
      vardiyaGerekli: true,
    };
  }

  return { izinli: true, kullanici, vardiyaId: vardiya.id };
}
