-- CreateEnum
CREATE TYPE "GiderKategorisi" AS ENUM ('YEMEK', 'CAY', 'TEMIZLIK', 'BAKIM', 'KIRTASIYE', 'DIGER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IslemTipi" ADD VALUE 'GIDER_EKLEME';
ALTER TYPE "IslemTipi" ADD VALUE 'GIDER_SILME';
ALTER TYPE "IslemTipi" ADD VALUE 'KAYIT_DUZENLEME';

-- DropForeignKey
ALTER TABLE "ParkKaydi" DROP CONSTRAINT "ParkKaydi_aracId_fkey";

-- AlterTable
ALTER TABLE "ParkKaydi" ADD COLUMN     "marka" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "renk" TEXT,
ALTER COLUMN "aracId" DROP NOT NULL,
ALTER COLUMN "plaka" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Gider" (
    "id" TEXT NOT NULL,
    "vardiyaId" TEXT NOT NULL,
    "kullaniciId" TEXT NOT NULL,
    "kategori" "GiderKategorisi" NOT NULL DEFAULT 'DIGER',
    "tutar" DECIMAL(10,2) NOT NULL,
    "aciklama" TEXT NOT NULL,
    "odemeYontemi" "OdemeYontemi" NOT NULL DEFAULT 'NAKIT',
    "zaman" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Gider_vardiyaId_idx" ON "Gider"("vardiyaId");

-- CreateIndex
CREATE INDEX "Gider_zaman_idx" ON "Gider"("zaman");

-- CreateIndex
CREATE INDEX "Gider_kategori_zaman_idx" ON "Gider"("kategori", "zaman");

-- AddForeignKey
ALTER TABLE "ParkKaydi" ADD CONSTRAINT "ParkKaydi_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gider" ADD CONSTRAINT "Gider_vardiyaId_fkey" FOREIGN KEY ("vardiyaId") REFERENCES "Vardiya"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gider" ADD CONSTRAINT "Gider_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
