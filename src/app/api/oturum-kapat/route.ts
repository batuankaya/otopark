import { signOut } from "@/lib/auth";

/**
 * Oturumu sonlandırıp giriş ekranına yollar.
 *
 * Neden ayrı bir uç nokta gerekiyor?
 * Middleware Edge runtime'da çalışır ve veritabanına bakamaz; yalnızca
 * çerezdeki JWT'ye güvenir. Kullanıcı silinmiş ya da pasifleştirilmişse
 * sayfa tarafı bunu fark edip `/giris`'e yönlendiriyor, ama middleware
 * hâlâ geçerli görünen JWT yüzünden panoya geri yolluyordu — sonsuz
 * yönlendirme döngüsü. Buradan geçince çerez silindiği için döngü kırılır.
 */
export async function GET() {
  await signOut({ redirectTo: "/giris?bilgi=oturum-sonlandi" });
}
