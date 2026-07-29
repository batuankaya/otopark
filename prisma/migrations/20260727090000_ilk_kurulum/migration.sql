-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'GOREVLI');

-- CreateEnum
CREATE TYPE "TarifeTuru" AS ENUM ('SAATLIK', 'GUNLUK', 'ABONMAN');

-- CreateEnum
CREATE TYPE "OdemeYontemi" AS ENUM ('NAKIT', 'KART');

-- CreateEnum
CREATE TYPE "ParkDurumu" AS ENUM ('ICERIDE', 'CIKTI', 'IPTAL');

-- CreateEnum
CREATE TYPE "AbonmanDurumu" AS ENUM ('AKTIF', 'SURESI_DOLDU', 'IPTAL');

-- CreateEnum
CREATE TYPE "IslemTipi" AS ENUM ('GIRIS', 'GIRIS_BASARISIZ', 'CIKIS', 'IPTAL', 'UCRET_DUZELTME', 'TARIFE_DEGISIKLIGI', 'KULLANICI_DEGISIKLIGI', 'ABONMAN_DEGISIKLIGI', 'PARK_ALANI_DEGISIKLIGI', 'AYAR_DEGISIKLIGI', 'VARDIYA_ACILIS', 'VARDIYA_KAPANIS', 'DISA_AKTARMA', 'OTURUM_ACMA');

-- CreateTable
CREATE TABLE "Kullanici" (
    "id" TEXT NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sifreHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'GOREVLI',
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kullanici_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Arac" (
    "id" TEXT NOT NULL,
    "plaka" TEXT NOT NULL,
    "marka" TEXT,
    "model" TEXT,
    "renk" TEXT,
    "notlar" TEXT,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Arac_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarife" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "ilkUcretsizDakika" INTEGER NOT NULL DEFAULT 15,
    "saatlikUcret" DECIMAL(10,2) NOT NULL,
    "gunlukTavanUcret" DECIMAL(10,2) NOT NULL,
    "aylikAbonmanUcreti" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "gecerlilikBaslangic" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tarife_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkAlani" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "kapasite" INTEGER NOT NULL DEFAULT 0,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ParkAlani_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ayar" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "otoparkAdi" TEXT NOT NULL DEFAULT 'Otopark',
    "adres" TEXT,
    "telefon" TEXT,
    "toplamKapasite" INTEGER NOT NULL DEFAULT 100,
    "fisAltNotu" TEXT,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ayar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkKaydi" (
    "id" TEXT NOT NULL,
    "fisNo" SERIAL NOT NULL,
    "aracId" TEXT NOT NULL,
    "plaka" TEXT NOT NULL,
    "girisZamani" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cikisZamani" TIMESTAMP(3),
    "girisYapanId" TEXT NOT NULL,
    "cikisYapanId" TEXT,
    "tarifeId" TEXT NOT NULL,
    "tarifeTuru" "TarifeTuru" NOT NULL DEFAULT 'SAATLIK',
    "hesaplananUcret" DECIMAL(10,2),
    "tahsilEdilenUcret" DECIMAL(10,2),
    "odemeYontemi" "OdemeYontemi",
    "durum" "ParkDurumu" NOT NULL DEFAULT 'ICERIDE',
    "parkAlaniId" TEXT,
    "parkAlaniAd" TEXT,
    "abonmanId" TEXT,
    "vardiyaId" TEXT NOT NULL,
    "cikisVardiyaId" TEXT,
    "notlar" TEXT,
    "ucretDuzeltmeSebebi" TEXT,
    "iptalSebebi" TEXT,
    "iptalEdenId" TEXT,
    "iptalZamani" TIMESTAMP(3),
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkKaydi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Abonman" (
    "id" TEXT NOT NULL,
    "aracId" TEXT NOT NULL,
    "musteriAdi" TEXT NOT NULL,
    "telefon" TEXT,
    "baslangicTarihi" TIMESTAMP(3) NOT NULL,
    "bitisTarihi" TIMESTAMP(3) NOT NULL,
    "aylikUcret" DECIMAL(10,2) NOT NULL,
    "durum" "AbonmanDurumu" NOT NULL DEFAULT 'AKTIF',
    "notlar" TEXT,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Abonman_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vardiya" (
    "id" TEXT NOT NULL,
    "kullaniciId" TEXT NOT NULL,
    "baslangic" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bitis" TIMESTAMP(3),
    "acilisKasa" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "kapanisKasa" DECIMAL(10,2),
    "toplamNakit" DECIMAL(10,2),
    "toplamKart" DECIMAL(10,2),
    "fark" DECIMAL(10,2),
    "notlar" TEXT,

    CONSTRAINT "Vardiya_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IslemGunlugu" (
    "id" TEXT NOT NULL,
    "kullaniciId" TEXT,
    "zaman" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "islemTipi" "IslemTipi" NOT NULL,
    "ilgiliKayitId" TEXT,
    "eskiDeger" JSONB,
    "yeniDeger" JSONB,
    "aciklama" TEXT,

    CONSTRAINT "IslemGunlugu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Kullanici_email_key" ON "Kullanici"("email");

-- CreateIndex
CREATE INDEX "Kullanici_aktif_idx" ON "Kullanici"("aktif");

-- CreateIndex
CREATE UNIQUE INDEX "Arac_plaka_key" ON "Arac"("plaka");

-- CreateIndex
CREATE INDEX "Arac_plaka_idx" ON "Arac"("plaka");

-- CreateIndex
CREATE INDEX "Tarife_aktif_gecerlilikBaslangic_idx" ON "Tarife"("aktif", "gecerlilikBaslangic");

-- CreateIndex
CREATE UNIQUE INDEX "ParkAlani_ad_key" ON "ParkAlani"("ad");

-- CreateIndex
CREATE INDEX "ParkAlani_aktif_sira_idx" ON "ParkAlani"("aktif", "sira");

-- CreateIndex
CREATE UNIQUE INDEX "ParkKaydi_fisNo_key" ON "ParkKaydi"("fisNo");

-- CreateIndex
CREATE INDEX "ParkKaydi_plaka_idx" ON "ParkKaydi"("plaka");

-- CreateIndex
CREATE INDEX "ParkKaydi_durum_girisZamani_idx" ON "ParkKaydi"("durum", "girisZamani");

-- CreateIndex
CREATE INDEX "ParkKaydi_cikisZamani_idx" ON "ParkKaydi"("cikisZamani");

-- CreateIndex
CREATE INDEX "ParkKaydi_vardiyaId_idx" ON "ParkKaydi"("vardiyaId");

-- CreateIndex
CREATE INDEX "ParkKaydi_cikisVardiyaId_idx" ON "ParkKaydi"("cikisVardiyaId");

-- CreateIndex
CREATE INDEX "ParkKaydi_girisYapanId_idx" ON "ParkKaydi"("girisYapanId");

-- CreateIndex
CREATE INDEX "ParkKaydi_parkAlaniId_durum_idx" ON "ParkKaydi"("parkAlaniId", "durum");

-- CreateIndex
CREATE INDEX "Abonman_aracId_durum_idx" ON "Abonman"("aracId", "durum");

-- CreateIndex
CREATE INDEX "Abonman_bitisTarihi_idx" ON "Abonman"("bitisTarihi");

-- CreateIndex
CREATE INDEX "Abonman_durum_idx" ON "Abonman"("durum");

-- CreateIndex
CREATE INDEX "Vardiya_kullaniciId_bitis_idx" ON "Vardiya"("kullaniciId", "bitis");

-- CreateIndex
CREATE INDEX "Vardiya_baslangic_idx" ON "Vardiya"("baslangic");

-- CreateIndex
CREATE INDEX "IslemGunlugu_zaman_idx" ON "IslemGunlugu"("zaman");

-- CreateIndex
CREATE INDEX "IslemGunlugu_kullaniciId_zaman_idx" ON "IslemGunlugu"("kullaniciId", "zaman");

-- CreateIndex
CREATE INDEX "IslemGunlugu_islemTipi_zaman_idx" ON "IslemGunlugu"("islemTipi", "zaman");

-- CreateIndex
CREATE INDEX "IslemGunlugu_ilgiliKayitId_idx" ON "IslemGunlugu"("ilgiliKayitId");

-- AddForeignKey
ALTER TABLE "ParkKaydi" ADD CONSTRAINT "ParkKaydi_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkKaydi" ADD CONSTRAINT "ParkKaydi_girisYapanId_fkey" FOREIGN KEY ("girisYapanId") REFERENCES "Kullanici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkKaydi" ADD CONSTRAINT "ParkKaydi_cikisYapanId_fkey" FOREIGN KEY ("cikisYapanId") REFERENCES "Kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkKaydi" ADD CONSTRAINT "ParkKaydi_tarifeId_fkey" FOREIGN KEY ("tarifeId") REFERENCES "Tarife"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkKaydi" ADD CONSTRAINT "ParkKaydi_parkAlaniId_fkey" FOREIGN KEY ("parkAlaniId") REFERENCES "ParkAlani"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkKaydi" ADD CONSTRAINT "ParkKaydi_abonmanId_fkey" FOREIGN KEY ("abonmanId") REFERENCES "Abonman"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkKaydi" ADD CONSTRAINT "ParkKaydi_vardiyaId_fkey" FOREIGN KEY ("vardiyaId") REFERENCES "Vardiya"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkKaydi" ADD CONSTRAINT "ParkKaydi_cikisVardiyaId_fkey" FOREIGN KEY ("cikisVardiyaId") REFERENCES "Vardiya"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkKaydi" ADD CONSTRAINT "ParkKaydi_iptalEdenId_fkey" FOREIGN KEY ("iptalEdenId") REFERENCES "Kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abonman" ADD CONSTRAINT "Abonman_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vardiya" ADD CONSTRAINT "Vardiya_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IslemGunlugu" ADD CONSTRAINT "IslemGunlugu_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Kısmi (partial) unique index'ler — Prisma şemasıyla ifade edilemediği için
-- elle eklendi. İş kurallarını veritabanı seviyesinde garanti ederler:
-- iki görevli aynı anda işlem yapsa bile çakışma olamaz.
-- ---------------------------------------------------------------------------

-- Aynı plaka aynı anda birden fazla kez "içeride" olamaz.
-- (Aynı araç geçmişte defalarca girip çıkabilir; kısıt yalnızca ICERIDE için.)
CREATE UNIQUE INDEX "parkkaydi_plaka_iceride_uq"
  ON "ParkKaydi" ("plaka")
  WHERE "durum" = 'ICERIDE';

-- Bir kullanıcının aynı anda yalnızca bir açık vardiyası olabilir.
CREATE UNIQUE INDEX "vardiya_kullanici_acik_uq"
  ON "Vardiya" ("kullaniciId")
  WHERE "bitis" IS NULL;
