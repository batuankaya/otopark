"use server";

import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { signIn, signOut } from "@/lib/auth";
import { islemGunluguYaz } from "@/lib/gunluk";
import { prisma } from "@/lib/prisma";
import { formVerisiniAl, girisSemasi, hatalariTopla } from "@/lib/validasyon";

export type GirisDurumu = {
  basarili?: boolean;
  hata?: string;
  alanHatalari?: Record<string, string>;
};

/**
 * E-posta + şifre ile oturum açar.
 *
 * Hatalı e-posta ile hatalı şifre arasında ayrım yapılmaz: saldırgan
 * hangi hesapların var olduğunu öğrenemesin diye tek mesaj döner.
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
      // Başarısız denemeyi kayda geçir (hangi hesap denendiği önemli).
      const kullanici = await prisma.kullanici
        .findUnique({ where: { email }, select: { id: true, aktif: true } })
        .catch(() => null);

      await islemGunluguYaz({
        kullaniciId: kullanici?.id ?? null,
        islemTipi: "OTURUM_ACMA",
        aciklama: `Başarısız giriş denemesi: ${email}`,
      });

      if (kullanici && !kullanici.aktif) {
        return { hata: "Hesabınız pasif durumda. Lütfen yöneticinizle görüşün." };
      }
      return { hata: "E-posta veya şifre hatalı." };
    }

    console.error("Giriş sırasında beklenmeyen hata:", hata);
    return { hata: "Giriş yapılamadı. Lütfen tekrar deneyin." };
  }

  return { basarili: true };
}

export async function cikisYap(): Promise<void> {
  await signOut({ redirectTo: "/giris" });
}
