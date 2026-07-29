/**
 * Türkçe sıralama yardımcıları.
 *
 * JavaScript'in varsayılan sıralaması Türkçe alfabeyi bilmez:
 * "Çilek" < "Damla" veya "İzmir" < "Jale" gibi karşılaştırmalar yanlış çıkar.
 * Bu yüzden tüm metin sıralamaları buradan geçer.
 */

const turkceKarsilastirici = new Intl.Collator("tr", {
  sensitivity: "base",
  numeric: true,
});

/** Array.prototype.sort için doğrudan kullanılabilir karşılaştırıcı. */
export function turkceKarsilastir(a: string, b: string): number {
  return turkceKarsilastirici.compare(a ?? "", b ?? "");
}

/** Nesne dizisini belirtilen metin alanına göre Türkçe sıralar (yeni dizi döner). */
export function turkceSirala<T>(
  liste: readonly T[],
  anahtar: (oge: T) => string,
  yon: "artan" | "azalan" = "artan",
): T[] {
  const carpan = yon === "artan" ? 1 : -1;
  return [...liste].sort((a, b) => carpan * turkceKarsilastir(anahtar(a), anahtar(b)));
}
