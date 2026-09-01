/**
 * ===========================================================================
 *  OTOPARK BAŞLANGIÇ DEĞERLERİ
 * ===========================================================================
 *  Tarife, kapasite ve park alanı bilgilerinin TEK kaynağı burasıdır.
 *  Kendi değerlerini vermek için sadece bu dosyayı düzenle, sonra:
 *
 *      npx prisma migrate reset      (veritabanını sıfırlar + seed çalıştırır)
 *
 *  Not: Bu değerler yalnızca ilk kurulum içindir. Sistem çalışmaya
 *  başladıktan sonra hepsi Ayarlar ekranından değiştirilebilir.
 * ===========================================================================
 */

export const otoparkBilgisi = {
  otoparkAdi: "Otopark",
  adres: "Eskişehir",
  telefon: "0222 000 00 00",
  /** Toplam araç kapasitesi — ana panodaki doluluk göstergesi bunu kullanır. */
  toplamKapasite: 150,
  /** Fişin en altında görünen not. */
  fisAltNotu: "Bizi tercih ettiğiniz için teşekkür ederiz.",
};

/**
 * Araç sınıfı başına bir tarife. Büyük araçlar (pickup, kamyonet, minibüs)
 * daha fazla yer kapladığı için binekten pahalıdır.
 *
 * Günlük üst sınır (TL) 0'dır: otopark saf saatlik çalışıyor, yani üst sınır
 * uygulanmaz. İleride bir gün için tavan koymak isterseniz buraya tutar
 * yazmanız (ya da Ayarlar'dan girmeniz) yeterli.
 */
export const varsayilanTarifeler = [
  {
    aracSinifi: "BINEK",
    ad: "Binek Tarifesi",
    /** Bu süreyi aşmayan parklardan ücret alınmaz (dakika). */
    ilkUcretsizDakika: 15,
    /** İlk saatin (giriş) ücreti — ilk saat tamamlanmasa da tam alınır (TL). */
    ilkSaatUcreti: 100,
    /** İlk saatten SONRAKİ her başlayan saat için eklenen tutar (TL). */
    saatlikUcret: 50,
    gunlukTavanUcret: 0,
  },
  {
    aracSinifi: "BUYUK",
    ad: "Büyük Araç Tarifesi",
    ilkUcretsizDakika: 15,
    ilkSaatUcreti: 150,
    saatlikUcret: 100,
    gunlukTavanUcret: 0,
  },
] as const;

/** Örnek park kayıtlarının ücretlendirildiği tarife. */
export const varsayilanTarife = varsayilanTarifeler[0];

export const kullanicilar = {
  admin: {
    adSoyad: "Sistem Yöneticisi",
    email: "admin@otopark.local",
    sifreEnv: "SEED_ADMIN_SIFRE",
    varsayilanSifre: "Otopark2026Admin",
  },
  gorevli: {
    adSoyad: "Ahmet Görevli",
    email: "gorevli@otopark.local",
    sifreEnv: "SEED_GOREVLI_SIFRE",
    varsayilanSifre: "Otopark2026Gorevli",
  },
};

/** Seed'in üreteceği örnek park kaydı sayısı. */
export const ornekParkKaydiSayisi = 30;
