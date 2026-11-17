/**
 * Brute force koruması.
 *
 * Başarısız giriş denemeleri hem HESAP hem IP bazlı sayılır:
 *  - Hesap bazlı: saldırgan tek hesaba yükleniyorsa o hesap kilitlenir
 *  - IP bazlı: saldırgan çok sayıda hesabı deniyorsa (kullanıcı adı taraması)
 *    o kaynak kilitlenir
 *
 * Kilit kalıcı DEĞİL, zaman aşımına uğrar: gerçek görevli şifresini üst üste
 * yanlış girip kendini sistem dışında bırakmasın. Sahada çalışan bir otoparkta
 * kalıcı kilit, saldırıdan daha çok zarar verir.
 *
 * Sayım veritabanından yapılır (bellek değil): uygulama yeniden başlasa da
 * kilit sürer ve birden fazla sunucu çalışsa bile ortak davranır.
 */

import { prisma } from "./prisma";

/** Hesap bazlı: bu kadar başarısız denemeden sonra kilit. */
export const HESAP_DENEME_SINIRI = 8;
/** IP bazlı: farklı hesaplara yayılan denemeler için daha yüksek eşik. */
export const IP_DENEME_SINIRI = 20;
/** Denemelerin sayıldığı pencere (dakika). */
export const PENCERE_DAKIKA = 15;
/** Kilit süresi (dakika). */
export const KILIT_DAKIKA = 15;
/** Bu süreden eski kayıtlar budanır (gün). */
const SAKLAMA_GUN = 7;

export type KorumaSonucu =
  | { engelli: false }
  | { engelli: true; kalanSaniye: number; sebep: "hesap" | "ip" };

/**
 * Var olmayan hesap için karşılaştırılan sahte bcrypt özeti.
 *
 * Gerçek bir özet olmalı (60 karakter, cost 12): bcryptjs biçimi bozuk özeti
 * hesaplama yapmadan anında reddeder. O zaman olmayan e-posta ~1 ms'de,
 * var olan ~250 ms'de cevaplanır ve hesapların varlığı cevap süresinden
 * anlaşılır. Rastgele bir şifrenin özetidir; hiçbir girdi eşleşmez.
 */
export const SAHTE_SIFRE_OZETI = "$2b$12$1vB.MKWdqo3vc2iD/oFYS.UhrL1ZK.2WLjmlptBq.xBg88KUsqzJO";

/**
 * İstek başlıklarından istemci IP'sini çıkarır.
 *
 * Uygulama üretimde tek bir ters proxy (Caddy) arkasında çalışır. Proxy,
 * bağlanan istemcinin adresini `X-Forwarded-For`un SONUNA yazar; listenin
 * önündeki değerler istemcinin kendi gönderdikleridir ve sahte olabilir.
 * İlk değeri almak, saldırganın her denemede farklı bir IP uydurup IP
 * kilidini atlatmasına izin veriyordu. Bu yüzden yalnızca son değere güvenilir.
 *
 * `x-real-ip` ve `cf-connecting-ip` okunmaz: proxy bunları yazmadığında
 * istemci doğrudan gönderebilir.
 */
export function ipAdresiniAl(basliklar: Headers): string | null {
  const son = basliklar.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return son || null;
}

/**
 * Giriş denemesine izin var mı?
 *
 * Şifre kontrolünden ÖNCE çağrılır: kilitliyken bcrypt çalıştırmak hem
 * gereksiz yük hem de saldırgana zaman bilgisi verir.
 */
export async function girisIzniVarMi(
  email: string,
  ip: string | null,
  /** Sayıma katılmayacak deneme — çağıranın kendi açtığı kayıt. */
  haricDenemeId?: string,
): Promise<KorumaSonucu> {
  const pencereBaslangici = new Date(Date.now() - PENCERE_DAKIKA * 60_000);
  const haric = haricDenemeId ? { id: { not: haricDenemeId } } : {};

  const [hesapDenemeleri, ipDenemeleri] = await Promise.all([
    prisma.girisDenemesi.findMany({
      where: { email, zaman: { gte: pencereBaslangici }, ...haric },
      orderBy: { zaman: "desc" },
      select: { zaman: true },
    }),
    ip
      ? prisma.girisDenemesi.findMany({
          where: { ip, zaman: { gte: pencereBaslangici }, ...haric },
          orderBy: { zaman: "desc" },
          select: { zaman: true },
        })
      : Promise.resolve([]),
  ]);

  // Kilit, son kayıtlı denemeden itibaren başlar. Kilitliyken gelen
  // istekler kaydedilmez (bkz. denemeyiGeriAl), kilidi uzatmaz.
  const kalan = (denemeler: { zaman: Date }[]) => {
    const sonDeneme = denemeler[0]?.zaman;
    if (!sonDeneme) return 0;
    const bitis = sonDeneme.getTime() + KILIT_DAKIKA * 60_000;
    return Math.max(0, Math.ceil((bitis - Date.now()) / 1000));
  };

  if (hesapDenemeleri.length >= HESAP_DENEME_SINIRI) {
    const kalanSaniye = kalan(hesapDenemeleri);
    if (kalanSaniye > 0) return { engelli: true, kalanSaniye, sebep: "hesap" };
  }

  if (ipDenemeleri.length >= IP_DENEME_SINIRI) {
    const kalanSaniye = kalan(ipDenemeleri);
    if (kalanSaniye > 0) return { engelli: true, kalanSaniye, sebep: "ip" };
  }

  return { engelli: false };
}

/**
 * Denemeyi şifre kontrolünden ÖNCE kaydeder ve kaydın kimliğini döner.
 *
 * Kayıt şifre kontrolünden sonra yazılsaydı, aynı anda gönderilen yüzlerce
 * istek bcrypt sürerken (~250 ms) sayacı boş görüp hepsi denetimden geçerdi:
 * 8 deneme sınırı paralel isteklerle yüzlerce denemeye çıkıyordu. Önce yazıp
 * sonra saymak, eşzamanlı her isteğin diğerlerini görmesini sağlar.
 *
 * Kayıt yazılamazsa hata fırlatılır ve giriş reddedilir: koruma çalışmıyorken
 * sınırsız deneme açık kalmasın.
 */
export async function denemeyiBaslat(email: string, ip: string | null): Promise<string> {
  const deneme = await prisma.girisDenemesi.create({ data: { email, ip }, select: { id: true } });

  // Eski kayıtları buda — ayrı bir zamanlanmış göreve ihtiyaç kalmasın.
  // Her denemede değil, ~%5 olasılıkla çalıştırılır (gereksiz yük olmasın).
  if (Math.random() < 0.05) {
    await prisma.girisDenemesi
      .deleteMany({
        where: { zaman: { lt: new Date(Date.now() - SAKLAMA_GUN * 86_400_000) } },
      })
      .catch((hata) => console.error("Eski giriş denemeleri budanamadı:", hata));
  }

  return deneme.id;
}

/**
 * Kilit yüzünden hiç denenmemiş girişin kaydını siler: kilitliyken gelen
 * istekler tabloyu büyütmesin ve kilidi uzatmasın.
 */
export async function denemeyiGeriAl(id: string): Promise<void> {
  await prisma.girisDenemesi.deleteMany({ where: { id } });
}

/** Başarılı girişte hesabın deneme sayacını sıfırlar. */
export async function denemeleriTemizle(email: string): Promise<void> {
  try {
    await prisma.girisDenemesi.deleteMany({ where: { email } });
  } catch (hata) {
    console.error("Giriş denemeleri temizlenemedi:", hata);
  }
}

/** Kalan süreyi kullanıcıya gösterilecek metne çevirir. */
export function beklemeMetni(kalanSaniye: number): string {
  const dakika = Math.ceil(kalanSaniye / 60);
  return dakika <= 1 ? "1 dakika" : `${dakika} dakika`;
}
