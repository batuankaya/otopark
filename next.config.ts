import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const buDosya = fileURLToPath(import.meta.url);
const uretim = process.env.NODE_ENV === "production";

/**
 * İçerik Güvenliği Politikası (CSP).
 *
 * XSS'e karşı ikinci savunma hattı: React zaten kaçış yapıyor, CSP ise bir
 * açık oluşursa saldırganın script çalıştırmasını/veri sızdırmasını engeller.
 *
 * `'unsafe-inline'` ve `'unsafe-eval'` neden var?
 *  - Next.js, sayfa durumunu satır içi script ile aktarır (hydration).
 *    Nonce tabanlı çözüm her isteği dinamik yapar ve statik sayfaları
 *    devre dışı bırakır — bu uygulamada kazancı maliyetini karşılamıyor.
 *  - `unsafe-eval` yalnızca geliştirmede gerekli (hot reload); üretimde yok.
 *
 * Asıl korumayı `default-src 'self'` sağlıyor: uygulama hiçbir dış kaynağa
 * bağlanmaz, veri dışarı gönderilemez. Zaten dış bağımlılık da yok —
 * fontlar sistem fontu, grafik kütüphanesi paket olarak kurulu.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${uretim ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  // data: — fişteki/arayüzdeki gömülü görseller için
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Uygulama hiçbir dış servise istek atmaz.
  "connect-src 'self'",
  // Eklenti, iframe ve applet tamamen kapalı.
  "object-src 'none'",
  "frame-src 'none'",
  // Bu sayfayı kimse iframe'e gömemez (X-Frame-Options'ın modern karşılığı).
  "frame-ancestors 'none'",
  // <base> etiketiyle göreli yolların kaçırılmasını engeller.
  "base-uri 'self'",
  // Form yalnızca kendi sunucusuna gönderilebilir.
  "form-action 'self'",
]
  .concat(uretim ? ["upgrade-insecure-requests"] : [])
  .join("; ");

const nextConfig: NextConfig = {
  /**
   * Üst klasörlerde başka lockfile'lar olduğu için Next.js çalışma alanı kökünü
   * yanlış tahmin edip uyarı veriyordu. Kökü açıkça bu projeye sabitliyoruz.
   */
  outputFileTracingRoot: path.dirname(buDosya),

  /** Sunucu yanıtlarında Next.js sürümünü sızdırma. */
  poweredByHeader: false,

  async headers() {
    return [
      {
        // Personel uygulaması: plaka ve telefon kişisel veri.
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // Tarayıcı özelliklerini kapat: uygulama hiçbirini kullanmıyor.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          // Diğer sitelerin bu sayfanın kaynaklarını okumasını engeller.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          /**
           * HSTS — tarayıcıya "bu siteye bir daha asla HTTP ile bağlanma" der.
           *
           * Yalnızca üretimde: geliştirmede http://localhost'a eklenirse
           * tarayıcı localhost'u HTTPS'e zorlar ve tüm yerel projeler bozulur
           * (kalıcı, temizlemesi zahmetli bir durum).
           *
           * ÖNEMLİ: Üretimde HTTPS gerçekten çalışmıyorsa bu başlık siteyi
           * erişilemez yapar. Sertifika kurulduktan sonra yayına alın.
           */
          ...(uretim
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains",
                },
              ]
            : []),
        ],
      },
      {
        // API yanıtları asla önbelleğe alınmamalı: plaka ve tutar bilgisi
        // proxy'de ya da tarayıcı geçmişinde kalmasın.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
