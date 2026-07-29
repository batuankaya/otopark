/**
 * Gider kategorilerinin ekranda gösterilen adları.
 *
 * Bu sabit bilerek `actions/gider.ts` içinde DEĞİL: `"use server"` dosyaları
 * yalnızca async fonksiyon dışa aktarabilir, sabit dışa aktarmak derlemeyi
 * kırıyor. Hem sunucu hem istemci bileşenleri buradan okur.
 */

import type { GiderKategorisi } from "@prisma/client";

export const GIDER_ETIKETLERI: Record<GiderKategorisi, string> = {
  YEMEK: "Yemek",
  CAY: "Çay / içecek",
  TEMIZLIK: "Temizlik",
  BAKIM: "Bakım / onarım",
  KIRTASIYE: "Kırtasiye",
  DIGER: "Diğer",
};

/** Gider formundaki seçim sırası — en sık kullanılanlar önce. */
export const GIDER_KATEGORILERI = Object.entries(GIDER_ETIKETLERI) as [
  GiderKategorisi,
  string,
][];
