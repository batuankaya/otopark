import { describe, expect, it } from "vitest";
import { turkceKarsilastir, turkceSirala } from "@/lib/siralama";

/**
 * Türkçe sıralama.
 *
 * JavaScript'in varsayılan sıralaması Türkçe alfabeyi bilmez: Ç, Ğ, İ, Ö, Ş, Ü
 * harfleri Unicode sırasında Z'den sonra gelir, dolayısıyla "Çilek" listenin
 * dibine düşer. Görevlinin aradığı plakayı/adı bulamaması bu yüzden olur.
 */

describe("turkceKarsilastir", () => {
  it("Ç harfini C ile D arasına koyar", () => {
    // Varsayılan sıralamada "Çilek" > "Damla" çıkardı.
    expect(turkceKarsilastir("Çilek", "Damla")).toBeLessThan(0);
    expect(turkceKarsilastir("Cem", "Çilek")).toBeLessThan(0);
  });

  it("İ harfini I ile J arasına koyar", () => {
    expect(turkceKarsilastir("İzmir", "Jale")).toBeLessThan(0);
    expect(turkceKarsilastir("Hakan", "İzmir")).toBeLessThan(0);
  });

  it("Ş harfini S ile T arasına koyar", () => {
    expect(turkceKarsilastir("Şahin", "Tuna")).toBeLessThan(0);
    expect(turkceKarsilastir("Sena", "Şahin")).toBeLessThan(0);
  });

  it("Ö ve Ü harflerini doğru yerleştirir", () => {
    expect(turkceKarsilastir("Öztürk", "Palandöken")).toBeLessThan(0);
    expect(turkceKarsilastir("Ünal", "Vural")).toBeLessThan(0);
  });

  it("büyük/küçük harf farkını yok sayar", () => {
    expect(turkceKarsilastir("ahmet", "Ahmet")).toBe(0);
  });

  it("sayıları sayısal olarak karşılaştırır", () => {
    // Metin sıralamasında "Kat 10" < "Kat 2" çıkardı.
    expect(turkceKarsilastir("Kat 2", "Kat 10")).toBeLessThan(0);
  });

  it("boş değerlerde çökmez", () => {
    expect(() => turkceKarsilastir("", "")).not.toThrow();
    expect(turkceKarsilastir("", "Ahmet")).toBeLessThan(0);
  });
});

describe("turkceSirala", () => {
  const alanlar = [
    { ad: "Zemin Kat" },
    { ad: "Çatı" },
    { ad: "Bodrum 10" },
    { ad: "Bodrum 2" },
    { ad: "İç Bahçe" },
  ];

  it("nesne dizisini alana göre sıralar", () => {
    const sirali = turkceSirala(alanlar, (a) => a.ad).map((a) => a.ad);
    expect(sirali).toEqual(["Bodrum 2", "Bodrum 10", "Çatı", "İç Bahçe", "Zemin Kat"]);
  });

  it("azalan sıralama yapar", () => {
    const sirali = turkceSirala(alanlar, (a) => a.ad, "azalan").map((a) => a.ad);
    expect(sirali[0]).toBe("Zemin Kat");
    expect(sirali.at(-1)).toBe("Bodrum 2");
  });

  it("özgün diziyi değiştirmez", () => {
    const kopya = [...alanlar];
    turkceSirala(alanlar, (a) => a.ad);
    expect(alanlar).toEqual(kopya);
  });

  it("boş dizide çalışır", () => {
    expect(turkceSirala([], (a: { ad: string }) => a.ad)).toEqual([]);
  });
});
