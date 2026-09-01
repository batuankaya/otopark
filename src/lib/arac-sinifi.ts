/**
 * Araç sınıfı — ücreti belirleyen tek ayrım.
 *
 * Otopark iki sınıf işletiyor: binek araçlar ve daha fazla yer kaplayan büyük
 * araçlar (pickup, kamyonet, minibüs). Her sınıfın kendi yürürlükteki tarifesi
 * vardır; girişte sınıf seçilir, ücret o tarifeden hesaplanır.
 */

import type { AracSinifi } from "@prisma/client";

export const ARAC_SINIFLARI = ["BINEK", "BUYUK"] as const;

export const ARAC_SINIFI_ETIKETLERI: Record<AracSinifi, string> = {
  BINEK: "Binek",
  BUYUK: "Büyük araç",
};

/** Görevliye hangi aracın hangi sınıfa girdiğini hatırlatan örnekler. */
export const ARAC_SINIFI_ORNEKLERI: Record<AracSinifi, string> = {
  BINEK: "Otomobil, station, hatchback",
  BUYUK: "Pickup, kamyonet, minibüs, panelvan",
};

export const VARSAYILAN_ARAC_SINIFI: AracSinifi = "BINEK";
