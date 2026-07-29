import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { authConfig } from "./auth.config";
import { prisma } from "./prisma";
import { girisSemasi } from "./validasyon";

/**
 * Auth.js — e-posta + şifre ile oturum tabanlı kimlik doğrulama.
 * Oturum httpOnly çerezde şifreli olarak tutulur; şifre hash'i hiçbir
 * response'a sızmaz (aşağıda yalnızca gerekli alanlar seçilir).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-posta", type: "email" },
        sifre: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        const ayrisma = girisSemasi.safeParse(credentials);
        if (!ayrisma.success) return null;

        const { email, sifre } = ayrisma.data;

        const kullanici = await prisma.kullanici.findUnique({
          where: { email },
          select: {
            id: true,
            adSoyad: true,
            email: true,
            sifreHash: true,
            rol: true,
            aktif: true,
          },
        });

        // Kullanıcı yoksa da bcrypt çalıştırılır: cevap süresinden hesabın
        // var olup olmadığı anlaşılmasın (kullanıcı sayımı saldırısına karşı).
        const hash = kullanici?.sifreHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi";
        const sifreDogru = await bcrypt.compare(sifre, hash);

        if (!kullanici || !sifreDogru || !kullanici.aktif) return null;

        return {
          id: kullanici.id,
          email: kullanici.email,
          name: kullanici.adSoyad,
          adSoyad: kullanici.adSoyad,
          rol: kullanici.rol,
        };
      },
    }),
  ],
});
