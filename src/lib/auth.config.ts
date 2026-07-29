import type { NextAuthConfig } from "next-auth";

/**
 * Edge (middleware) tarafında da çalışabilen Auth.js yapılandırması.
 *
 * Burada Prisma veya bcrypt KULLANILMAZ — middleware Edge runtime'da çalışır
 * ve bu paketler orada çalışmaz. Kimlik doğrulayan Credentials sağlayıcısı
 * `lib/auth.ts` içinde eklenir; middleware yalnızca çerezdeki oturumu okur.
 */

/** ADMIN dışındaki rollerin erişemeyeceği bölümler. */
export const ADMIN_ROTALARI = ["/raporlar", "/ayarlar"];

export const authConfig = {
  pages: {
    signIn: "/giris",
    error: "/giris",
  },
  session: {
    strategy: "jwt",
    // Vardiya boyu düşünülerek 12 saat; her istekte tazelenir.
    maxAge: 12 * 60 * 60,
  },
  trustHost: true,
  providers: [],
  callbacks: {
    /** Rol ve ad bilgisini token'a taşı ki middleware DB'ye gitmesin. */
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.rol = (user as { rol?: string }).rol ?? "GOREVLI";
        token.adSoyad = (user as { adSoyad?: string }).adSoyad ?? user.name ?? "";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? "";
        session.user.rol = (token.rol as "ADMIN" | "GOREVLI") ?? "GOREVLI";
        session.user.adSoyad = (token.adSoyad as string) ?? "";
      }
      return session;
    },
    /** Rota koruması — middleware bu callback'i kullanır. */
    authorized({ auth, request }) {
      const yol = request.nextUrl.pathname;
      const oturumAcik = !!auth?.user;

      // Oturum kapatma yolu her zaman açık olmalı: geçersiz oturumu temizleyen
      // tek çıkış burası, middleware buraya karışırsa döngü oluşur.
      const herkeseAcik =
        yol === "/giris" || yol.startsWith("/api/auth") || yol === "/api/oturum-kapat";
      if (herkeseAcik) {
        // Oturum açıkken giriş sayfasına gelen kullanıcıyı panoya yolla.
        if (oturumAcik && yol === "/giris") {
          return Response.redirect(new URL("/", request.nextUrl));
        }
        return true;
      }

      if (!oturumAcik) return false; // Auth.js otomatik olarak /giris'e yönlendirir

      const rol = auth?.user?.rol;
      if (rol !== "ADMIN" && ADMIN_ROTALARI.some((rota) => yol.startsWith(rota))) {
        return Response.redirect(new URL("/?hata=yetkisiz", request.nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
