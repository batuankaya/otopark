import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

/**
 * Tüm uygulama rotaları oturum ister; /raporlar ve /ayarlar yalnızca ADMIN'e
 * açıktır (kontrol `authConfig.callbacks.authorized` içinde).
 *
 * Middleware Edge runtime'da çalıştığı için burada Prisma'ya dokunulmaz;
 * yetki bilgisi JWT'den okunur. Sunucu tarafındaki her sayfa/işlem ayrıca
 * `lib/yetki.ts` ile kendi kontrolünü yapar (savunma katmanı).
 */
export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  matcher: [
    /*
     * Statik dosyalar ve Next.js iç kaynakları hariç her şey.
     * Fiş sayfası (/fis/...) da korumalıdır — plaka kişisel veridir.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
