"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { signIn, signOut } from "@/lib/auth";
import { beklemeMetni, girisIzniVarMi, ipAdresiniAl } from "@/lib/giris-koruma";
import { islemGunluguYaz } from "@/lib/gunluk";
import { prisma } from "@/lib/prisma";
import { formVerisiniAl, girisSemasi, hatalariTopla } from "@/lib/validasyon";

export type GirisDurumu = {
  basarili?: boolean;
  hata?: string;
  alanHatalari?: Record<string, string>;
  /** Brute force koruması devredeyse arayüz formu devre dışı bırakır. */
  kilitli?: boolean;
};

/**
 * E-posta + şifre ile oturum açar.
 *
 * Hatalı e-posta ile hatalı şifre arasında ayrım yapılmaz: saldırgan
 * hangi hesapların var olduğunu öğrenemesin diye tek mesaj döner.
 *
 * Brute force koruması: başarısız denemeler hesap ve IP bazlı sayılır,
 * eşik aşılınca giriş geçici olarak engellenir (bkz. lib/giris-koruma.ts).
 */
export async function girisYap(
  _oncekiDurum: GirisDurumu,
  formData: FormData,
): Promise<GirisDurumu> {
  const ayrisma = girisSemasi.safeParse(formVerisiniAl(formData));
  if (!ayrisma.success) {
    return { alanHatalari: hatalariTopla(ayrisma.error) };
  }

  const { email, sifre } = ayrisma.data;
  const ip = ipAdresiniAl(await headers());

  // Asıl koruma lib/auth.ts içindeki authorize callback'inde (uç noktaya
  // doğrudan istek atılarak burası atlanabilir). Buradaki kontrol yalnızca
  // kullanıcıya "ne kadar beklemesi gerektiğini" söylemek için.
  const izin = await girisIzniVarMi(email, ip);
  if (izin.engelli) {
    await islemGunluguYaz({
      islemTipi: "OTURUM_ACMA",
      aciklama:
        `Giriş engellendi (${izin.sebep === "hesap" ? "hesap" : "IP"} bazlı koruma): ` +
        `${email}${ip ? ` — ${ip}` : ""}`,
    });

    return {
      kilitli: true,
      hata:
        izin.sebep === "hesap"
          ? `Çok fazla hatalı deneme. Bu hesapla giriş ${beklemeMetni(izin.kalanSaniye)} sonra tekrar denenebilir.`
          : `Çok fazla hatalı deneme yapıldı. ${beklemeMetni(izin.kalanSaniye)} sonra tekrar deneyin.`,
    };
  }

  try {
    await signIn("credentials", {
      email,
      sifre,
      redirectTo: "/",
    });
  } catch (hata) {
    // signIn başarılı olduğunda yönlendirme için hata fırlatır — yutmayalım.
    if (isRedirectError(hata)) throw hata;

    if (hata instanceof AuthError) {
      // Deneme sayacı authorize callback'inde artırıldı; burada yalnızca
      // denetim günlüğü yazılır.
      const kullanici = await prisma.kullanici
        .findUnique({ where: { email }, select: { id: true, aktif: true } })
        .catch(() => null);

      await islemGunluguYaz({
        kullaniciId: kullanici?.id ?? null,
        islemTipi: "OTURUM_ACMA",
        aciklama: `Başarısız giriş denemesi: ${email}${ip ? ` — ${ip}` : ""}`,
      });

      if (kullanici && !kullanici.aktif) {
        return { hata: "Hesabınız pasif durumda. Lütfen yöneticinizle görüşün." };
      }
      return { hata: "E-posta veya şifre hatalı." };
    }

    console.error("Giriş sırasında beklenmeyen hata:", hata);
    return { hata: "Giriş yapılamadı. Lütfen tekrar deneyin." };
  }

  // Buraya normalde ulaşılmaz: signIn başarıda yönlendirme hatası fırlatır.
  // Sayaç temizleme lib/auth.ts içindeki authorize callback'inde yapılır.
  return { basarili: true };
}

export async function cikisYap(): Promise<void> {
  await signOut({ redirectTo: "/giris" });
}
