import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const buDosya = fileURLToPath(import.meta.url);

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
        // Personel uygulaması: plaka ve telefon kişisel veri. Sayfaların
        // iframe'e gömülmesini ve dışarıya referrer sızmasını engelle.
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
