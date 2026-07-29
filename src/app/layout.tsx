import type { Metadata, Viewport } from "next";

import "./globals.css";

/**
 * Font olarak bilerek `next/font/google` KULLANILMIYOR:
 * derleme sırasında Google'a bağlanmayı gerektiriyor ve kesintili bağlantıda
 * build kilitleniyor. Sistem fontları hem ağ bağımlılığını kaldırıyor hem de
 * sahadaki telefonlarda sayfayı daha hızlı açıyor. Yazı tipi yığını
 * globals.css içinde tanımlı.
 */

export const metadata: Metadata = {
  title: "Otopark Yönetim Sistemi",
  description: "Otopark giriş-çıkış, ücretlendirme ve vardiya yönetimi",
  // Personel uygulaması: arama motorlarında görünmemeli.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Görme güçlüğü olan personel yakınlaştırabilsin diye kilitlenmedi.
  maximumScale: 5,
  themeColor: "#1d4ed8",
};

export default function KokDuzen({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
